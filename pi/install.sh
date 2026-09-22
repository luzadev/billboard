#!/usr/bin/env bash
# Installa il player BillBoard su Raspberry Pi OS Desktop (Trixie, Bookworm o Bullseye).
# Uso:  bash install.sh https://billboard.tuodominio.it
# Variabili opzionali: BILLBOARD_USER=<utente che avvia il chiosco> (default: chi lancia lo script)
set -euo pipefail

SERVER_URL="${1:-}"
if [[ -z "$SERVER_URL" ]]; then
  read -rp "URL del server BillBoard (es. https://billboard.tuodominio.it): " SERVER_URL
fi
SERVER_URL="${SERVER_URL%/}"
PLAYER_URL="$SERVER_URL/player/"
RUN_USER="${BILLBOARD_USER:-${SUDO_USER:-$USER}}"
if [[ "$RUN_USER" == "root" ]]; then RUN_USER="$(getent passwd 1000 | cut -d: -f1)"; fi
USER_HOME="$(getent passwd "$RUN_USER" | cut -d: -f6)"
SUDO=""; [[ $EUID -ne 0 ]] && SUDO="sudo"
APT="$SUDO apt-get -o DPkg::Lock::Timeout=600 -y -qq"

echo "==> Installo Chromium e utility (utente chiosco: $RUN_USER)"
$APT update
$APT install chromium unclutter 2>/dev/null || $APT install chromium-browser unclutter
CHROMIUM="$(command -v chromium || command -v chromium-browser)"

echo "==> Disabilito lo spegnimento dello schermo"
$SUDO raspi-config nonint do_blanking 1 2>/dev/null || true

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
  "$CHROMIUM" --kiosk --password-store=basic --noerrdialogs --disable-infobars --disable-session-crashed-bubble \\
    --autoplay-policy=no-user-gesture-required --check-for-update-interval=31536000 \\
    --disable-features=TranslateUI,Translate --disable-translate --lang=it --overscroll-history-navigation=0 --disable-pinch \\
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
# Wayland labwc (Raspberry Pi OS Bookworm e Trixie)
mkdir -p "$USER_HOME/.config/labwc"
if ! grep -q billboard-kiosk "$USER_HOME/.config/labwc/autostart" 2>/dev/null; then
  echo "$USER_HOME/.local/bin/billboard-kiosk.sh &" >> "$USER_HOME/.config/labwc/autostart"
fi
# Wayland wayfire (prime versioni di Bookworm)
if [[ -f "$USER_HOME/.config/wayfire.ini" ]] && ! grep -q billboard-kiosk "$USER_HOME/.config/wayfire.ini"; then
  printf '\n[autostart]\nbillboard = %s/.local/bin/billboard-kiosk.sh\n' "$USER_HOME" >> "$USER_HOME/.config/wayfire.ini"
fi
$SUDO chown -R "$RUN_USER":"$RUN_USER" "$USER_HOME/.local" "$USER_HOME/.config"

echo "==> Abilito il login automatico sul desktop per $RUN_USER"
SUDO_USER="$RUN_USER" $SUDO raspi-config nonint do_boot_behaviour B4 2>/dev/null || true

echo
echo "Fatto. Riavvia il Raspberry: al boot lo schermo mostrerà un codice."
echo "Inserisci il codice nel pannello admin ($SERVER_URL/admin/) per associarlo."
echo "Per riavviare subito:  sudo reboot"
