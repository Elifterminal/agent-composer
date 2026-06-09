#!/usr/bin/env bash
# install-linux.sh — create a double-clickable AgentScore launcher (app menu +
# Desktop) pointing at this checkout, with the icon.
set -euo pipefail
HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"   # launchers/
chmod +x "$HERE/launch-linux.sh"

DESKTOP_FILE_CONTENT="[Desktop Entry]
Type=Application
Version=1.0
Name=AgentScore
Comment=Text-native music composer for AI agents
Exec=bash \"$HERE/launch-linux.sh\"
Icon=$HERE/icon.png
Terminal=false
Categories=AudioVideo;Audio;Development;
"

APPS="$HOME/.local/share/applications"
mkdir -p "$APPS"
printf '%s' "$DESKTOP_FILE_CONTENT" > "$APPS/agentscore.desktop"
chmod +x "$APPS/agentscore.desktop"

# also drop one on the Desktop (mark trusted for GNOME)
DESK="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
if [ -d "$DESK" ]; then
  cp "$APPS/agentscore.desktop" "$DESK/AgentScore.desktop"
  chmod +x "$DESK/AgentScore.desktop"
  gio set "$DESK/AgentScore.desktop" metadata::trusted true 2>/dev/null || true
fi

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" 2>/dev/null || true
echo "Installed AgentScore launcher → app menu + $DESK/AgentScore.desktop"
echo "Double-click it (or run launch-linux.sh) to start."
