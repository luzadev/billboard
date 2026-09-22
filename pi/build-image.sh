#!/usr/bin/env bash
# Crea un'immagine SD di Raspberry Pi OS gia' configurata come player BillBoard.
# Al primo avvio il Raspberry imposta utente, Wi-Fi, hostname e fuso orario, installa il
# player in modalita' chiosco e si riavvia mostrando il codice di associazione. Nessuna tastiera.
#
# Uso (macOS o Linux):
#   bash pi/build-image.sh --server https://billboard.tuodominio.it \
#        --wifi-ssid "MiaRete" --wifi-pass "segreta" --pass "password-del-pi" [opzioni]
#
# Opzioni:
#   --server URL          URL del server BillBoard (obbligatorio)
#   --pass PASSWORD       password dell'utente del Raspberry (obbligatoria)
#   --user NOME           nome utente (default: billboard)
#   --hostname NOME       hostname (default: billboard-XXXX casuale)
#   --wifi-ssid SSID      rete Wi-Fi (se omesso si usa solo il cavo Ethernet)
#   --wifi-pass PASSWORD  password Wi-Fi
#   --wifi-hidden         la rete Wi-Fi e' nascosta
#   --country CC          paese Wi-Fi, due lettere (default: IT)
#   --timezone TZ         fuso orario (default: Europe/Rome)
#   --keymap XX           layout tastiera (default: it)
#   --ssh                 abilita SSH (con password)
#   --image FILE          usa un'immagine locale .img o .img.xz invece di scaricare l'ultima ufficiale
#   --lite                usa Raspberry Pi OS Lite (senza desktop: NON adatto al player, solo per test)
#   --out FILE            nome del file .img prodotto (default: billboard-<data>.img nella cartella corrente)
#   --compress            comprime l'immagine finale in .img.xz (piu' lento, file piu' piccolo)
set -euo pipefail

SERVER=""; USER_NAME="billboard"; USER_PASS=""; HOSTNAME_=""; WIFI_SSID=""; WIFI_PASS=""; WIFI_HIDDEN=0
COUNTRY="IT"; TZ_="Europe/Rome"; KEYMAP="it"; SSH=0; IMAGE=""; LITE=0; OUT=""; COMPRESS=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --server) SERVER="${2%/}"; shift 2;;
    --user) USER_NAME="$2"; shift 2;;
    --pass) USER_PASS="$2"; shift 2;;
    --hostname) HOSTNAME_="$2"; shift 2;;
    --wifi-ssid) WIFI_SSID="$2"; shift 2;;
    --wifi-pass) WIFI_PASS="$2"; shift 2;;
    --wifi-hidden) WIFI_HIDDEN=1; shift;;
    --country) COUNTRY="$2"; shift 2;;
    --timezone) TZ_="$2"; shift 2;;
    --keymap) KEYMAP="$2"; shift 2;;
    --ssh) SSH=1; shift;;
    --image) IMAGE="$2"; shift 2;;
    --lite) LITE=1; shift;;
    --out) OUT="$2"; shift 2;;
    --compress) COMPRESS=1; shift;;
    -h|--help) sed -n '2,25p' "$0"; exit 0;;
    *) echo "Opzione sconosciuta: $1" >&2; exit 1;;
  esac
done
[[ -n "$SERVER" ]] || { echo "Manca --server" >&2; exit 1; }
[[ "$SERVER" =~ ^https?:// ]] || { echo "--server deve iniziare con http:// o https://" >&2; exit 1; }
[[ -n "$USER_PASS" ]] || { echo "Manca --pass (password dell'utente del Raspberry)" >&2; exit 1; }
[[ "$USER_NAME" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || { echo "Nome utente non valido: $USER_NAME" >&2; exit 1; }
[[ -z "$WIFI_SSID" || -n "$WIFI_PASS" ]] || { echo "Con --wifi-ssid serve anche --wifi-pass" >&2; exit 1; }
[[ -n "$HOSTNAME_" ]] || HOSTNAME_="billboard-$(openssl rand -hex 2)"
[[ -n "$OUT" ]] || OUT="billboard-$(date +%Y%m%d).img"
for t in xz curl python3; do command -v "$t" >/dev/null || { echo "Serve il comando '$t'" >&2; exit 1; }; done

HERE="$(cd "$(dirname "$0")" && pwd)"
CACHE="$HERE/cache"; mkdir -p "$CACHE"
OS="$(uname -s)"

# ---------- 1. immagine di partenza ----------
if [[ -z "$IMAGE" ]]; then
  echo "==> Cerco l'ultima Raspberry Pi OS (64-bit$([[ $LITE == 1 ]] && echo ' Lite')) ufficiale"
  NAME='Raspberry Pi OS (64-bit)'; [[ $LITE == 1 ]] && NAME='Raspberry Pi OS Lite (64-bit)'
  URL="$(curl -fsSL https://downloads.raspberrypi.com/os_list_imagingutility_v4.json | python3 -c "
import json,sys
want=sys.argv[1]
def walk(l):
    for o in l:
        if 'subitems' in o:
            r=walk(o['subitems'])
            if r: return r
        elif o.get('name')==want and o.get('init_format')=='cloudinit-rpi': return o['url']
print(walk(json.load(sys.stdin)['os_list']) or '')" "$NAME")"
  [[ -n "$URL" ]] || { echo "Immagine non trovata nella lista ufficiale" >&2; exit 1; }
  IMAGE="$CACHE/$(basename "$URL")"
  if [[ -f "$IMAGE" ]]; then echo "    uso la copia in cache: $IMAGE"
  else echo "    scarico $URL"; curl -fL --progress-bar -o "$IMAGE.part" "$URL" && mv "$IMAGE.part" "$IMAGE"; fi
fi
[[ -f "$IMAGE" ]] || { echo "Immagine non trovata: $IMAGE" >&2; exit 1; }

echo "==> Preparo $OUT"
rm -f "$OUT"
case "$IMAGE" in
  *.xz) xz -dkc "$IMAGE" > "$OUT";;
  *.img) cp "$IMAGE" "$OUT";;
  *) echo "Formato immagine non riconosciuto (serve .img o .img.xz)" >&2; exit 1;;
esac

# ---------- 2. monta la partizione di boot (FAT) ----------
MNT=""; DEV=""
cleanup() {
  if [[ "$OS" == "Darwin" ]]; then [[ -n "$DEV" ]] && hdiutil detach "$DEV" -quiet 2>/dev/null || true
  else [[ -n "$MNT" ]] && sudo umount "$MNT" 2>/dev/null || true; [[ -n "$DEV" ]] && sudo losetup -d "$DEV" 2>/dev/null || true; fi
}
trap cleanup EXIT
echo "==> Monto la partizione di boot"
if [[ "$OS" == "Darwin" ]]; then
  PLIST="$(hdiutil attach -imagekey diskimage-class=CRawDiskImage -plist "$OUT")"
  DEV="$(echo "$PLIST" | python3 -c "
import plistlib,sys
p=plistlib.loads(sys.stdin.buffer.read())
print(min(e['dev-entry'] for e in p['system-entities']))")"
  MNT="$(echo "$PLIST" | python3 -c "
import plistlib,sys
p=plistlib.loads(sys.stdin.buffer.read())
print(next((e['mount-point'] for e in p['system-entities'] if e.get('mount-point')), ''))")"
  [[ -n "$MNT" ]] || { echo "Partizione di boot non montata (hdiutil)" >&2; exit 1; }
else
  DEV="$(sudo losetup -Pf --show "$OUT")"
  MNT="$(mktemp -d)"; sudo mount "${DEV}p1" "$MNT"
fi
[[ -f "$MNT/cmdline.txt" || -f "$MNT/config.txt" ]] || { echo "Questa non sembra la partizione di boot di Raspberry Pi OS" >&2; exit 1; }
echo "    boot montata in $MNT"

# ---------- 3. genera la configurazione di primo avvio (cloud-init, come Raspberry Pi Imager) ----------
PASS_HASH="$(printf '%s' "$USER_PASS" | openssl passwd -6 -stdin)"
INSTALL_B64="$(base64 < "$HERE/install.sh" | tr -d '\n')"
AGENT_FILES=""
for f in billboard-agent.py billboard-agent.service captive.conf; do
  AGENT_FILES+="  - path: /usr/local/bin/agent/$f
    permissions: \"0644\"
    encoding: b64
    content: $(base64 < "$HERE/agent/$f" | tr -d '\n')
"
done
{
cat <<YAML
#cloud-config
hostname: $HOSTNAME_
manage_etc_hosts: true
apt:
  preserve_sources_list: true
  conf: |
    Acquire {
      Check-Date "false";
    };
timezone: $TZ_
keyboard:
  model: pc105
  layout: "$KEYMAP"
user:
  name: $USER_NAME
  shell: /bin/bash
  lock_passwd: false
  passwd: "$PASS_HASH"
  sudo: ALL=(ALL) NOPASSWD:ALL
ssh_pwauth: $([[ $SSH == 1 ]] && echo true || echo false)
write_files:
  - path: /usr/local/bin/billboard-install.sh
    permissions: "0755"
    encoding: b64
    content: $INSTALL_B64
$AGENT_FILES
runcmd:
YAML
[[ $SSH == 1 ]] && echo "  - [ systemctl, enable, --now, ssh ]"
cat <<YAML
  - [ sh, -c, "echo '$USER_NAME ALL=(ALL) NOPASSWD:ALL' >/etc/sudoers.d/010_$USER_NAME-nopasswd && chmod 0440 /etc/sudoers.d/010_$USER_NAME-nopasswd" ]
  - [ rfkill, unblock, wifi ]
  - [ sh, -c, "for f in /var/lib/systemd/rfkill/*:wlan; do echo 0 > \"\$f\"; done" ]
  - [ sh, -c, "BILLBOARD_USER=$USER_NAME bash /usr/local/bin/billboard-install.sh '$SERVER' >/var/log/billboard-install.log 2>&1" ]
power_state:
  mode: reboot
  timeout: 30
  condition: true
YAML
} > "$MNT/user-data"
printf 'instance-id: %s\nlocal-hostname: %s\n' "$HOSTNAME_" "$HOSTNAME_" > "$MNT/meta-data"

if [[ -n "$WIFI_SSID" ]]; then
  # PSK esadecimale (come fa Raspberry Pi Imager) per non lasciare la password in chiaro
  PSK="$(python3 -c "import hashlib,sys;print(hashlib.pbkdf2_hmac('sha1',sys.argv[2].encode(),sys.argv[1].encode(),4096,32).hex())" "$WIFI_SSID" "$WIFI_PASS")"
  SSID_ESC="${WIFI_SSID//\"/\\\"}"
  {
cat <<YAML
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: true
      dhcp6: true
      optional: true
  wifis:
    wlan0:
      dhcp4: true
      regulatory-domain: "$COUNTRY"
      access-points:
        "$SSID_ESC":
YAML
  [[ $WIFI_HIDDEN == 1 ]] && echo "          hidden: true"
  echo "          password: \"$PSK\""
  echo "      optional: true"
  } > "$MNT/network-config"
else
  printf 'network:\n  version: 2\n  ethernets:\n    eth0:\n      dhcp4: true\n      dhcp6: true\n      optional: true\n' > "$MNT/network-config"
fi

sync
echo "==> Smonto"
cleanup; trap - EXIT; DEV=""; MNT=""

if [[ $COMPRESS == 1 ]]; then
  echo "==> Comprimo (puo' richiedere alcuni minuti)"
  xz -T0 -6 -f "$OUT"; OUT="$OUT.xz"
fi

cat <<EOT

Immagine pronta: $OUT
  server:    $SERVER
  utente:    $USER_NAME   hostname: $HOSTNAME_
  wi-fi:     ${WIFI_SSID:-(solo Ethernet)}   ssh: $([[ $SSH == 1 ]] && echo attivo || echo disattivo)

Scrivila sulla microSD con Raspberry Pi Imager ("Usa immagine personalizzata", senza applicare
altre personalizzazioni), balenaEtcher oppure dd. Al primo avvio il Raspberry impiega alcuni
minuti (configurazione + installazione di Chromium), si riavvia da solo e mostra il codice
di associazione. Log sul Pi: /var/log/billboard-install.log
EOT
