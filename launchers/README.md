# Launchers — run AgentScore as a desktop app

AgentScore is a static web app, but ES modules need to be served over HTTP (not
opened as `file://`), so these launchers start a tiny local server and open your
browser. Nothing is installed system-wide; no data leaves your machine.

## Linux

```bash
launchers/install-linux.sh     # one-time: adds an "AgentScore" launcher to your
                               # app menu + a double-clickable Desktop icon
```

Then launch it from the menu / Desktop, or directly:

```bash
launchers/launch-linux.sh      # serves the app and opens it in your browser
```

Requires `python3` (preinstalled on virtually every Linux). Stop it with
`kill $(cat /tmp/agentscore.pid)`.

## Windows

Double-click **`launchers/launch-windows.bat`**. It uses built-in PowerShell to
serve the folder (no Python needed) and opens your default browser. Close the
console window to stop the server.

To get a proper icon, right-click `launch-windows.bat` → *Create shortcut*, then
*Properties → Change Icon* and pick `launchers/icon.ico`.

## Icon

`icon.png` (Linux) / `icon.ico` (Windows) — a small equalizer mark.
