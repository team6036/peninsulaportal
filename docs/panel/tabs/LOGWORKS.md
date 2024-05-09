<a href="../MAIN.md" class="back">← Back</a>

# LogWorks Tab

Log file actions, including merging and converting logs.

## Navigation

### Merge Logs
The ability to merge selected logs into a singular log.

#### Merge Configuration
Settings for how to merge logs:
- **Conflict Affix**  
    How to resolve conflicts using modifiers
    - **Prefix** — inserts counter before field name
    - **Suffix** — appends counter after field name
- **Conflict Counter**  
    How the counter is used
    - **Numerically** — simple numerical count from 1
    - **Hexadecimally** — counting using hexadecimal system
    - **Alphabetically** — essentially base 26
- **Global Prefix**  
    A piece of text inserted before every field

#### Logs
List of logs to merge. Drag and drop them in from your OS.

#### Merging
You will be asked for a save location. You can provide any file extension you want, but a blank extension will result in the automatic appending of `.wpilog` as the extension.

### Export Logs
The ability to export certain logs from one format into another.

#### Export Configuration
Settings for how to export logs:
- **Import**  
    What type are the log(s) that will be imported
    - **Current Session** — whatever is currently loaded in the project
    - **WPILOG** — a WPILOG file
    - **CSV-Time** — a CSV file with time as the y-axis
    - **CSV-Field** — a CSV file with field names as the y-axis
- **Export**  
    What type are the log(s) that will be exported
    - **Current Session** — loads into current project
    - **WPILOG** — a WPILOG file
    - **CSV-Time** — a CSV file with time as the y-axis
    - **CSV-Field** — a CSV file with field names as the y-axis

It is important to note that for file exports, the exported file will automatically be created in the same directory as the imported file, unless the imported log was from **Current Session**. File extensions will be automatically removed and the proper ones will be appended. If exporting to **Current Session**, only one log import is supported. Here is the extension mapping:
- WPILOG `.wpilog`
- CSV-Time `.time.csv`
- CSV-Field `.field.csv`

#### Logs
List of logs to merge. Drag and drop them in from your OS.
