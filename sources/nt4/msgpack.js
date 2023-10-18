import * as util from "../../util.mjs";


const pow32 = 0x100000000;

export function serialize(data, options) {
	options = util.ensure(options, "obj");
	if (options.multiple && !util.is(data, "arr")) throw "Invalid argument type: Expected an Array to serialize multiple values";
	let floatBuff, floatView;
	let arr = new Uint8Array(128), l = 0;

	let th = "";
	if (util.is(options.typeHint, "str")) th = options.typeHint;

	if (options.multiple) data.forEach(subdata => append(subdata, false, th));
	else append(data, false, th);

	return arr.subarray(0, l);

	function append(data, replace, th) {
		switch (typeof(data)) {
			case "undefined":
				appendNull(data);
				break;
			case "boolean":
				appendBoolean(data);
				break;
			case "number":
				appendNumber(data, th);
				break;
			case "string":
				appendString(data);
				break;
			case "object":
				if (data == null) appendNull(data);
				else if (data instanceof Date) appendDate(data);
				else if (util.is(data, "arr")) appendArray(data);
				else if (
					data instanceof Uint8Array ||
					data instanceof Uint8ClampedArray
				) appendBinArray(data);
				else if (
					data instanceof Int8Array ||
					data instanceof Int16Array ||
					data instanceof Uint16Array ||
					data instanceof Int32Array ||
					data instanceof Uint32Array ||
					data instanceof Float32Array ||
					data instanceof Float64Array
				) appendArray(data);
				else appendObject(data);
				break;
			default:
				if (!replace && options.invalidTypeReplacement) {
					if (util.is(options.invalidTypeReplacement, "func")) append(options.invalidTypeReplacement(data), true, th);
					else append(options.invalidTypeReplacement, true, th);
				} else throw `Invalid argument type: The type '${typeof(data)}' cannot be serialized`;
		}
	}
	function appendNull(data) { return appendByte(0xc0); }
	function appendBoolean(data) { return appendByte(data ? 0xc3 : 0xc2); }
	function appendNumber(data, th) {
		let isInt = (th == "int") || (util.is(data, "int") && th != "double" && th != "float");
		if (isInt) {
			if (data >= 0 && data <= 0x7f) appendByte(data);
			else if (data < 0 && data >= -0x20) appendByte(data);
			else if (data > 0 && data <= 0xff) appendBytes([0xcc, data]); // uint8
			else if (data >= -0x80 && data <= 0x7f) appendBytes([0xd0, data]); // int8
			else if (data > 0 && data <= 0xffff) appendBytes([0xcd, data >>> 8, data]); // uint16
			else if (data >= -0x8000 && data <= 0x7fff) appendBytes([0xd1, data >>> 8, data]); // int16
			else if (data > 0 && data <= 0xffffffff) appendBytes([0xce, data >>> 24, data >>> 16, data >>> 8, data]); // uint32
			else if (data >= -0x80000000 && data <= 0x7fffffff) appendBytes([0xd2, data >>> 24, data >>> 16, data >>> 8, data]); // int32
			else if (data > 0 && data <= 0xffffffffffffffff) {
				// uint64
				let hi = data / pow32;
				let lo = data % pow32;
				appendBytes([0xd3, hi >>> 24, hi >>> 16, hi >>> 8, hi, lo >>> 24, lo >>> 16, lo >>> 8, lo]);
			}
			else if (data >= -0x8000000000000000 && data <= 0x7fffffffffffffff) {
				// int64
				appendByte(0xd3);
				appendInt64(data);
			}
			else if (data < 0) appendBytes([0xd3, 0x80, 0, 0, 0, 0, 0, 0, 0]); // below int64
			else appendBytes([0xcf, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]); // above uint64
		} else {
			if (!(floatView instanceof DataView)) {
				floatBuff = new ArrayBuffer(8);
				floatView = new DataView(floatBuff);
			}
			floatView.setFloat64(0, data);
			appendByte(0xcb);
			appendBytes(new Uint8Array(floatBuff));
		}
	}
	function appendString(data) {
		let bytes = encodeUtf8(data);
		let length = bytes.length;
		if (length <= 0x1f) appendByte(0xa0 + length);
		else if (length <= 0xff) appendBytes([0xd9, length]);
		else if (length <= 0xffff) appendBytes([0xda, length >>> 8, length]);
		else appendBytes([0xdb, length >>> 24, length >>> 16, length >>> 8, length]);
		appendBytes(bytes);
	}
	function appendArray(data) {
		let length = data.length;
		if (length <= 0xf) appendByte(0x90 + length);
		else if (length <= 0xffff) appendBytes([0xdc, length >>> 8, length]);
		else appendBytes([0xdd, length >>> 24, length >>> 16, length >>> 8, length]);
		data.forEach(subdata => append(subdata));
	}
	function appendBinArray(data) {
		let length = data.length;
		if (length <= 0xf) appendBytes([0xc4, length]);
		else if (length <= 0xffff) appendBytes([0xc5, length >>> 8, length]);
		else appendBytes([0xc6, length >>> 24, length >>> 16, length >>> 8, length]);
		appendBytes(data);
	}
	function appendObject(data) {
		let length = 0;
		for (let k in data)
			if (data[k] !== undefined)
				length++;

		if (length <= 0xf) appendByte(0x80 + length);
		else if (length <= 0xffff) appendBytes([0xde, length >>> 8, length]);
		else appendBytes([0xdf, length >>> 24, length >>> 16, length >>> 8, length]);
		for (let k in data) {
			let v = data[k];
			if (k === undefined) continue;
			append(k);
			append(v);
		}
	}
	function appendDate(data) {
		let s = data.getTime() / 1000;
		if (data.getMilliseconds() == 0 && sec >= 0 && sec < 0x100000000) appendBytes([0xd6, 0xff, sec >>> 24, sec >>> 16, sec >>> 8, sec]); // 32 bit seconds
		else if (sec >= 0 && sec < 0x400000000) {
			// 30 bit nanoseconds, 34 bit seconds
			let ns = data.getMilliseconds() * 1000000;
			appendBytes([0xd7, 0xff, ns >>> 22, ns >>> 14, ns >>> 6, ((ns << 2) >>> 0) | (sec / pow32), sec >>> 24, sec >>> 16, sec >>> 8, sec]);
		}
		else {
			// 32 bit nanoseconds, 64 bit seconds, negative values allowed
			let ns = data.getMilliseconds() * 1000000;
			appendBytes([0xc7, 12, 0xff, ns >>> 24, ns >>> 16, ns >>> 8, ns]);
			appendInt64(sec);
		}
	}
	function appendByte(byte) {
		if (arr.length < l+1) {
			let newL = arr.length * 2;
			while (newL < l+1) newL *= 2;
			let newArr = new Uint8Array(newL);
			newArr.set(arr);
			arr = newArr;
		}
		arr[l++] = byte;
	}
	function appendBytes(bytes) {
		if (arr.length < l+bytes.length) {
			let newL = arr.length * 2;
			while (newL < l+bytes.length) newL *= 2;
			let newArr = new Uint8Array(newL);
			newArr.set(arr);
			arr = newArr;
		}
		arr.set(bytes, l);
		l += bytes.length;
	}
	function appendInt64(value) {
		let hi, lo;
		if (value >= 0) {
			hi = value / pow32;
			lo = value % pow32;
		} else {
			value++;
			hi = Math.abs(value) / pow32;
			lo = Math.abs(value) % pow32;
			hi = ~hi;
			lo = ~lo;
		}
		appendBytes([hi >>> 24, hi >>> 16, hi >>> 8, hi, lo >>> 24, lo >>> 16, lo >>> 8, lo]);
	}
}

export function deserialize(arr, options) {
	options = util.ensure(options, "obj");
	let pos = 0;
	if (arr instanceof ArrayBuffer) arr = new Uint8Array(arr);
	if (!util.is(arr, "obj")) throw "Invalid argument type: Expected a byte array (Array or Uint8Array) to deserialize";
	if (!util.is(arr.length, "num")) throw "Invalid argument: The byte array to deserialize is empty";
	if (!(arr instanceof Uint8Array)) arr = new Uint8Array(arr);
	let data;
	if (options.multiple) {
		data = [];
		while (pos < arr.length) data.push(read());
	} else data = read();
	return data;

	function read() {
		const byte = arr[pos++];
		if (byte >= 0x00 && byte <= 0x7f) return byte;
		if (byte >= 0x80 && byte <= 0x8f) return readMap(byte - 0x80);
		if (byte >= 0x90 && byte <= 0x9f) return readArray(byte - 0x90);
		if (byte >= 0xa0 && byte <= 0xbf) return readStr(byte - 0xa0);
		if (byte == 0xc0) return null;
		if (byte == 0xc1) throw "Invalid byte code 0xc1 found";
		if (byte == 0xc2) return false;
		if (byte == 0xc3) return true;
		if (byte == 0xc4) return readBin(-1, 1);
		if (byte == 0xc5) return readBin(-1, 2);
		if (byte == 0xc6) return readBin(-1, 4);
		if (byte == 0xc7) return readExt(-1, 1);
		if (byte == 0xc8) return readExt(-1, 2);
		if (byte == 0xc9) return readExt(-1, 4);
		if (byte == 0xca) return readFloat(4);
		if (byte == 0xcb) return readFloat(8);
		if (byte == 0xcc) return readUInt(1);
		if (byte == 0xcd) return readUInt(2);
		if (byte == 0xce) return readUInt(4);
		if (byte == 0xcf) return readUInt(8);
		if (byte == 0xd0) return readInt(1);
		if (byte == 0xd1) return readInt(2);
		if (byte == 0xd2) return readInt(4);
		if (byte == 0xd3) return readInt(8);
		if (byte == 0xd4) return readExt(1);
		if (byte == 0xd5) return readExt(2);
		if (byte == 0xd6) return readExt(4);
		if (byte == 0xd7) return readExt(8);
		if (byte == 0xd8) return readExt(16);
		if (byte == 0xd9) return readStr(-1, 1);
		if (byte == 0xda) return readStr(-1, 2);
		if (byte == 0xdb) return readStr(-1, 4);
		if (byte == 0xdc) return readArray(-1, 2);
		if (byte == 0xdd) return readArray(-1, 4);
		if (byte == 0xde) return readMap(-1, 2);
		if (byte == 0xdf) return readMap(-1, 4);
		if (byte >= 0xe0 && byte <= 0xff) return byte - 256;
		throw `Invalid byte value '${byte}' at index ${pos-1} in the MessagePack binary data (length ${arr.length}): Expecting a range of 0 to 255. This is not a byte array`;
	}
	function readInt(size) {
		let v = 0, first = true;
		while (size-- > 0) {
			if (first) {
				let byte = arr[pos++];
				v += byte & 0x7f;
				if (byte & 0x80) v -= 0x80;
				first = false;
				continue;
			}
			v *= 256;
			v += arr[pos++];
		}
		return v;
	}
	function readUInt(size) {
		let v = 0;
		while (size-- > 0) {
			v *= 256;
			v += arr[pos++];
		}
		return v;
	}
	function readFloat(size) {
		let view = new DataView(arr.buffer, pos+arr.byteOffset, size);
		pos += size;
		if (size == 4) return view.getFloat32(0, false);
		if (size == 8) return view.getFloat64(0, false);
		return null;
	}
	function readBin(size, lengthSize) {
		if (size < 0) size = readUInt(lengthSize);
		let data = arr.subarray(pos, pos+size);
		pos += size;
		return data;
	}
	function readMap(size, lengthSize) {
		if (size < 0) size = readUInt(lengthSize);
		let data = {};
		while (size-- > 0) {
			let k = read();
			data[k] = read();
		}
		return data;
	}
	function readArray(size, lengthSize) {
		if (size < 0) size = readUInt(lengthSize);
		let data = [];
		while (size-- > 0)
			data.push(read());
		return data;
	}
	function readStr(size, lengthSize) {
		if (size < 0) size = readUInt(lengthSize);
		let start = pos;
		pos += size;
		return decodeUtf8(arr, start, size);
	}
	function readExt(size, lengthSize) {
		if (size < 0) size = readUInt(lengthSize);
		let type = readUInt(1);
		let data = readBin(size);
		switch (type) {
			case 255:
				return readExtDate(data);
		}
		return { type: type, data: data };
	}
	function readExtDate(data) {
		if (data.length == 4) {
			let sec = ((data[0] << 24) >>> 0) +
				((data[1] << 16) >>> 0) +
				((data[2] << 8) >>> 0) +
				data[3];
			return new Date(sec * 1000);
		}
		if (data.length == 8) {
			let ns = ((data[0] << 22) >>> 0) +
				((data[1] << 14) >>> 0) +
				((data[2] << 6) >>> 0) +
				(data[3] >>> 2);
			let sec = ((data[3] & 0x3) * pow32) +
				((data[4] << 24) >>> 0) +
				((data[5] << 16) >>> 0) +
				((data[6] << 8) >>> 0) +
				data[7];
			return new Date(sec * 1000 + ns / 1000000);
		}
		if (data.length == 12) {
			let ns = ((data[0] << 24) >>> 0) +
				((data[1] << 16) >>> 0) +
				((data[2] << 8) >>> 0) +
				data[3];
			pos -= 8;
			let sec = readInt(8);
			return new Date(sec * 1000 + ns / 1000000);
		}
		throw "Invalid data length for a date value";
	}
}

function encodeUtf8(str) {
	let ascii = true, l = str.length;
	for (let x = 0; x < l; x++) {
		if (str.charCodeAt(x) > 127) {
			ascii = false;
			break;
		}
	}
	let i = 0, bytes = new Uint8Array(l * (ascii?1:4));
	for (let x = 0; x < length; x++) {
		let c = str.charCodeAt(x);
		if (c < 128) {
			bytes[i++] = c;
			continue;
		}
		if (c < 2048) bytes[i++] = c >> 6 | 192;
		else {
			if (c > 0xd7ff && c < 0xdc00) {
				if (++x >= length) throw "UTF-8 encode: incomplete surrogate pair";
				let c2 = str.charCodeAt(x);
				if (c2 < 0xdc00 || c2 > 0xdfff) throw `UTF-8 encode: second surrogate character 0x${c2.toString(16)} at index ${ci} out of range`;
				c = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
				bytes[i++] = c >> 18 | 240;
				bytes[i++] = c >> 12 & 63 | 128;
			}
			else bytes[i++] = c >> 12 | 224;
			bytes[i++] = c >> 6 & 63 | 128;
		}
		bytes[i++] = c & 63 | 128;
	}
	return ascii ? bytes : bytes.subarray(0, i);
}
function decodeUtf8(bytes, start, length) {
	let i = start, str = "";
	length += start;
	while (i < length) {
		let c = bytes[i++];
		if (c > 127) {
			if (c > 191 && c < 224) {
				if (i >= length) throw "UTF-8 decode: incomplete 2-byte sequence";
				c = (c & 31) << 6 | bytes[i++] & 63;
			} else if (c > 223 && c < 240) {
				if (i+1 >= length) throw "UTF-8 decode: incomplete 3-byte sequence";
				c = (c & 15) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
			} else if (c > 239 && c < 248) {
				if (i + 2 >= length) throw "UTF-8 decode: incomplete 4-byte sequence";
				c = (c & 7) << 18 | (bytes[i++] & 63) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
			} else throw `UTF-8 decode: unknown multibyte start 0x${c.toString(16)} at index ${i-1}`;
		}
		if (c <= 0xffff) str += String.fromCharCode(c);
		else if (c <= 0x10ffff) {
			c -= 0x10000;
			str += String.fromCharCode(c >> 10 | 0xd800);
			str += String.fromCharCode(c & 0x3FF | 0xdc00);
		} else throw `UTF-8 decode: code point 0x${c.toString(16)} exceeds UTF-16 reach`;
	}
	return str;
}
