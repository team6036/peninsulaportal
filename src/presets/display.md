<h1 align="center"><span style="color:var(--a);">Peninsula</span>Presets</h1>

<p>
    <span>Version</span>
    <span class="space"></span>
    <input class="val" id="version" placeholder="No version" style="background-color:transparent;text-align:right;">
</p>

## Application Data

<p>
    <span>Application Data Directory</span>
    <span class="space"></span>
    <button class="cmd normal" id="cleanup-app-data-dir">Cleanup</button>
    <button class="cmd normal" id="open-app-data-dir">Open<ion-icon name="open-outline"></ion-icon></button>
</p>
<p>
    <span>Application Log Directory</span>
    <span class="space"></span>
    <button class="cmd off" id="clear-app-log-dir">Clear</button>
    <button class="cmd normal" id="open-app-log-dir">Open<ion-icon name="open-outline"></ion-icon></button>
</p>
<p>
    <span>Database Host URL</span>
    <span class="space"></span>
    <button class="cmd normal" id="poll-db-host">Repoll</button>
    <input class="val" id="db-host" placeholder="Host URL" style="min-width:300px;color:var(--cy);">
</p>
<p>
    <span>Database Assets URL</span>
    <span class="space"></span>
    <input class="val" id="assets-host" placeholder="Assets URL" style="min-width:300px;color:var(--cy);">
</p>
<p>
    <span>Socket Host URL</span>
    <span class="space"></span>
    <input class="val" id="socket-host" placeholder="Socket Host URL" style="min-width:300px;color:var(--cy);">
</p>
<p>
    <span>Competition Mode</span>
    <span class="space"></span>
    <label class="switch">
        <input class="val" id="comp-mode">
        <span></span>
    </label>
</p>

## Appearance

<p>
    <span>Theme</span>
    <span class="space"></span>
    <button id="theme" class="normal"><div></div><ion-icon name="chevron-forward"></ion-icon></button>
</p>

<p>
    <span>Native Theme</span>
    <span class="space"></span>
    <button id="native-theme" class="normal"><div></div><ion-icon name="chevron-forward"></ion-icon></button>
</p>

<p>
    <span>Holiday</span>
    <span class="space"></span>
    <input class="val" id="holiday" placeholder="No holiday" style="background-color:transparent;color:var(--a);text-align:right;">
    <span style="display:flex;flex-direction:row;flex-wrap:nowrap;justify-content:center;align-items:center;align-content:center;">
        <label class="switch">
            <input class="val" id="holiday-opt">
            <span></span>
        </label>
        <span class="tooltip hov sx">Opt out of Holiday Fun</span>
    </span>
</p>

Colorsheet  

<div id="colorsheet"></div>

## Panel

<p>
    <span>Data Root Directory</span>
    <span class="space"></span>
    <label id="panel-root" class="pick-root">
        <input placeholder="Type a root directory..."></input>
        <button>Browse</button>
    </label>
</p>

## Planner

<p>
    <span>Data Root Directory</span>
    <span class="space"></span>
    <label id="planner-root" class="pick-root">
        <input placeholder="Type a root directory..."></input>
        <button>Browse</button>
    </label>
</p>
