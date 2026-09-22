#!/usr/bin/env bash
# Installa il player BillBoard su Raspberry Pi OS (Desktop, Bookworm o Bullseye).
# Uso:  bash install.sh https://billboard.tuodominio.it
set -euo pipefail

SERVER_URL="${1:-}"
if [[ -z "$SERVER_URL" ]]; then
  read -rp "URL del server BillBoard (es. https://billboard.tuodominio.it): " SERVER_URL
fi
SERVER_URL="${SERVER_URL%/}"
PLAYER_URL="$SERVER_URL/player/"
USER_HOME="$(getent passwd "${SUDO_USER:-$USER}" | cut -d: -f6)"
RUN_USER="${SUDO_USER:-$USER}"

echo "==> Installo Chromium e utility"
sudo apt-get update -qq
sudo apt-get install -y -qq chromium unclutter 2>/dev/null || sudo apt-get install -y -qq chromium-browser unclutter
CHROMIUM="$(command -v chromium || command -v chromium-browser)"

echo "==> Disabilito lo spegnimento dello schermo"
sudo raspi-config nonint do_blanking 1 2>/dev/null || true

echo "==> Creo lo script di avvio"
mkdir -p "$USER_HOME/.local/bin" "$USER_HOME/.config"
cat > "$USER_HOME/.local/bin/billboard-kiosk.sh" <<KIOSK
#!/usr/bin/env bash
# Player BillBoard: Chromium in modalita' chiosco
PLAYER_URL="$PLAYER_URL"
# Evita doppio avvio
if pgrep -f "billboard-kiosk-profile" >/dev/null; then exit 0; fi
sleep 5
command -v xset >/dev/null && { xset s off; xset -dpms; xset s noblank; } 2>/dev/null || true
command -v unclutter >/dev/null && unclutter -idle 0.5 -root &
PROFILE="\$HOME/.config/billboard-kiosk-profile"
# Rimuove il flag di "chiusura anomala" per evitare il banner di ripristino
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' "\$PROFILE/Default/Preferences" 2>/dev/null || true
while true; do
  "$CHROMIUM" --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble \\
    --autoplay-policy=no-user-gesture-required --check-for-update-interval=31536000 \\
    --disable-features=TranslateUI --overscroll-history-navigation=0 --disable-pinch \\
    --user-data-dir="\$PROFILE" --start-fullscreen "\$PLAYER_URL"
  sleep 3
done
KIOSK
chmod +x "$USER_HOME/.local/bin/billboard-kiosk.sh"

echo "==> Configuro l'avvio automatico"
# XDG autostart (X11 / LXDE)
mkdir -p "$USER_HOME/.config/autostart"
cat > "$USER_HOME/.config/autostart/billboard.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=BillBoard Player
Exec=$USER_HOME/.local/bin/billboard-kiosk.sh
X-GNOME-Autostart-enabled=true
DESK
# Wayland labwc (Raspberry Pi OS Bookworm)
mkdir -p "$USER_HOME/.config/labwc"
if ! grep -q billboard-kiosk "$USER_HOME/.config/labwc/autostart" 2>/dev/null; then
  echo "$USER_HOME/.local/bin/billboard-kiosk.sh &" >> "$USER_HOME/.config/labwc/autostart"
fi
# Wayland wayfire (Raspberry Pi OS Bookworm, versioni precedenti)
if [[ -f "$USER_HOME/.config/wayfire.ini" ]] && ! grep -q billboard-kiosk "$USER_HOME/.config/wayfire.ini"; then
  printf '\n[autostart]\nbillboard = %s/.local/bin/billboard-kiosk.sh\n' "$USER_HOME" >> "$USER_HOME/.config/wayfire.ini"
fi
chown -R "$RUN_USER":"$RUN_USER" "$USER_HOME/.local" "$USER_HOME/.config"

echo "==> Abilito il login automatico sul desktop"
sudo raspi-config nonint do_boot_behaviour B4 2>/dev/null || true

echo
echo "Fatto. Riavvia il Raspberry: al boot lo schermo mostrerà un codice."
echo "Inserisci il codice nel pannello admin ($SERVER_URL/admin/) per associarlo."
echo "Per riavviare subito:  sudo reboot"
