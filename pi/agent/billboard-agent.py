#!/usr/bin/env python3
"""
BillBoard agent per Raspberry Pi.

- Il chiosco (Chromium) apre sempre http://127.0.0.1/ : se il Pi e' in rete e ha un server
  configurato, l'agente rimanda al player; altrimenti mostra lo stato o le istruzioni di setup.
- Se il Pi resta senza rete, l'agente crea un hotspot Wi-Fi "BillBoard-Setup-XXXX" con una pagina
  (portale captive) da cui, con il telefono, si impostano rete Wi-Fi e URL del server.
- All'avvio legge anche /boot/firmware/billboard.txt (SERVER=, WIFI_SSID=, WIFI_PASS=, WIFI_COUNTRY=)
  e lo applica, togliendo poi la password dal file.
"""
import html
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import threading
import time
import urllib.parse
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

AGENT_VERSION = '1.1'
REPORT_EVERY_S = 30
RAW_INSTALLER = 'https://raw.githubusercontent.com/luzadev/billboard/main/pi/install.sh'

CONFIG_DIR = '/etc/billboard'
CONFIG_FILE = os.path.join(CONFIG_DIR, 'config.json')
BOOT_FILES = ['/boot/firmware/billboard.txt', '/boot/billboard.txt']
HOTSPOT_CON = 'billboard-setup'
HOTSPOT_IP = '10.42.0.1'
HOTSPOT_PASS = 'billboard'
PORT = int(os.environ.get('BILLBOARD_AGENT_PORT', '80'))
OFFLINE_GRACE_S = int(os.environ.get('BILLBOARD_OFFLINE_GRACE', '90'))   # attesa prima di aprire l'hotspot
RETRY_KNOWN_EVERY_S = 300                                                  # in setup, riprova le reti note
MOCK = os.environ.get('BILLBOARD_MOCK') == '1'

state = {
    'mode': 'boot',          # boot | online | offline | setup
    'server': '',
    'hostname': socket.gethostname(),
    'hotspot_ssid': '',
    'networks': [],          # reti viste prima di aprire l'hotspot
    'message': '',
    'offline_since': None,
    'lock': threading.Lock(),
    'token': '',
    'token_lock': threading.Lock(),
}


# ---------- utilità ----------
def log(msg):
    print(time.strftime('%H:%M:%S'), msg, flush=True)


def run(cmd, timeout=60):
    if MOCK:
        log('MOCK: ' + ' '.join(cmd))
        return subprocess.CompletedProcess(cmd, 0, '', '')
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        return subprocess.CompletedProcess(cmd, 127, '', f'comando non trovato: {cmd[0]}')
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(cmd, 124, '', f'timeout: {cmd[0]}')


def load_config():
    try:
        with open(CONFIG_FILE) as f:
            return json.load(f)
    except Exception:
        return {}


def save_config(cfg):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    tmp = CONFIG_FILE + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(cfg, f, indent=2)
    os.replace(tmp, CONFIG_FILE)


def valid_server(url):
    return bool(re.match(r'^https?://[^\s/]+(:\d+)?(/.*)?$', url or ''))


def restart_kiosk():
    """Chiude Chromium: lo script del chiosco lo riavvia sulla pagina locale."""
    run(['pkill', '-f', 'billboard-kiosk-profile'], timeout=10)


# ---------- rete (NetworkManager) ----------
def nm_connected():
    if MOCK:
        return os.environ.get('BILLBOARD_MOCK_ONLINE') == '1'
    r = run(['nmcli', '-t', '-f', 'STATE', 'general'], timeout=15)
    if 'connected' not in (r.stdout or '') or 'disconnected' in (r.stdout or ''):
        return False
    # in modalita' hotspot NetworkManager si dichiara "connected": escludilo
    return not hotspot_active()


def hotspot_active():
    if MOCK:
        return state['mode'] == 'setup'
    r = run(['nmcli', '-t', '-f', 'NAME', 'connection', 'show', '--active'], timeout=15)
    return HOTSPOT_CON in (r.stdout or '').split('\n')


def ethernet_carrier():
    try:
        with open('/sys/class/net/eth0/carrier') as f:
            return f.read().strip() == '1'
    except Exception:
        return False


def scan_networks():
    if MOCK:
        return [('ReteCasa', 80, True), ('Ufficio', 55, True), ('Bar-Free', 30, False)]
    run(['nmcli', 'device', 'wifi', 'rescan'], timeout=20)
    time.sleep(2)
    r = run(['nmcli', '-t', '-f', 'SSID,SIGNAL,SECURITY', 'device', 'wifi', 'list'], timeout=20)
    seen, nets = {}, []
    for line in (r.stdout or '').splitlines():
        parts = line.split(':')
        if len(parts) < 3 or not parts[0]:
            continue
        ssid, signal, sec = parts[0], int(parts[1] or 0), ':'.join(parts[2:])
        if ssid not in seen or seen[ssid] < signal:
            seen[ssid] = signal
            nets = [n for n in nets if n[0] != ssid] + [(ssid, signal, sec.strip() not in ('', '--'))]
    return sorted(nets, key=lambda n: -n[1])[:20]


def wifi_prepare(country=None):
    """Sblocca il Wi-Fi: su Raspberry Pi OS resta bloccato (rfkill) finche' non e' impostato il paese."""
    country = country or load_config().get('country')
    if country:
        run(['raspi-config', 'nonint', 'do_wifi_country', country], timeout=60)
        run(['iw', 'reg', 'set', country], timeout=10)
    run(['rfkill', 'unblock', 'all'], timeout=10)
    run(['nmcli', 'radio', 'wifi', 'on'], timeout=15)
    for _ in range(10):
        r = run(['nmcli', '-t', '-f', 'DEVICE,TYPE,STATE', 'device'], timeout=15)
        if 'wlan0:wifi:' in (r.stdout or '') and 'unavailable' not in (r.stdout or '').split('wlan0:wifi:')[1].split('\n')[0]:
            return True
        time.sleep(2)
    return False


def wifi_diagnostics():
    r1 = run(['nmcli', '-t', '-f', 'DEVICE,STATE', 'device'], timeout=15)
    r2 = run(['rfkill', 'list', 'wifi'], timeout=10)
    wl = next((l for l in (r1.stdout or '').splitlines() if l.startswith('wlan0')), 'wlan0 assente')
    blocked = 'bloccato' if 'yes' in (r2.stdout or '') else 'sbloccato'
    return f'{wl} · rfkill {blocked}'


def connect_wifi(ssid, password, country=None):
    wifi_prepare(country)
    run(['rfkill', 'unblock', 'wifi'], timeout=10)
    run(['nmcli', 'connection', 'delete', ssid], timeout=15)   # rimpiazza un profilo con lo stesso nome
    cmd = ['nmcli', 'device', 'wifi', 'connect', ssid, 'ifname', 'wlan0']
    if password:
        cmd += ['password', password]
    r = run(cmd, timeout=90)
    ok = r.returncode == 0
    log(f'connessione a {ssid}: {"ok" if ok else "fallita: " + (r.stderr or r.stdout).strip()}')
    return ok, (r.stderr or r.stdout).strip()


def start_hotspot():
    ssid = state['hotspot_ssid']
    wifi_prepare()
    run(['nmcli', 'connection', 'delete', HOTSPOT_CON], timeout=15)
    r = run(['nmcli', 'device', 'wifi', 'hotspot', 'ifname', 'wlan0', 'con-name', HOTSPOT_CON,
             'ssid', ssid, 'band', 'bg', 'password', HOTSPOT_PASS], timeout=60)
    if r.returncode == 0:
        log(f'hotspot {ssid}: attivo')
        return True
    err1 = (r.stderr or r.stdout or '').strip()
    log(f'hotspot rapido fallito: {err1}; provo la creazione manuale')
    # Fallback: connessione AP creata a mano (2.4 GHz, canale 6, WPA2, IP condiviso 10.42.0.1)
    run(['nmcli', 'connection', 'delete', HOTSPOT_CON], timeout=15)
    run(['nmcli', 'connection', 'add', 'type', 'wifi', 'ifname', 'wlan0', 'con-name', HOTSPOT_CON,
         'autoconnect', 'no', 'ssid', ssid, 'mode', 'ap', 'ipv4.method', 'shared', 'ipv6.method', 'disabled',
         'wifi.band', 'bg', 'wifi.channel', '6', 'wifi-sec.key-mgmt', 'wpa-psk', 'wifi-sec.psk', HOTSPOT_PASS], timeout=30)
    r2 = run(['nmcli', 'connection', 'up', HOTSPOT_CON], timeout=90)
    if r2.returncode == 0:
        log(f'hotspot {ssid}: attivo (manuale)')
        return True
    err2 = (r2.stderr or r2.stdout or '').strip()
    state['message'] = f'hotspot non creato: {err2[:90] or err1[:90]} · {wifi_diagnostics()}'
    log(state['message'])
    return False


def stop_hotspot():
    run(['nmcli', 'connection', 'down', HOTSPOT_CON], timeout=30)
    run(['nmcli', 'connection', 'delete', HOTSPOT_CON], timeout=15)


# ---------- dialogo con il server BillBoard ----------
def api(path, data=None, token=None, timeout=15):
    url = state['server'].rstrip('/') + path
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method='POST' if body is not None else 'GET')
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, json.loads(r.read().decode() or '{}')


def set_token(token):
    with state['token_lock']:
        state['token'] = token or ''
        cfg = load_config()
        if token:
            cfg['token'] = token
        else:
            cfg.pop('token', None)
        save_config(cfg)


def ensure_token():
    """Registra questo dispositivo sul server se non ha ancora un token (lo stesso usato dal player)."""
    if state['token'] or not state['server']:
        return state['token']
    try:
        st, j = api('/api/device/register', {'screen': ''})
        if j.get('token'):
            set_token(j['token'])
            log('dispositivo registrato sul server (codice di associazione: %s)' % j.get('code'))
    except Exception as e:
        log(f'registrazione fallita: {e}')
    return state['token']


def read_first(path, default=''):
    try:
        with open(path) as f:
            return f.read().strip()
    except Exception:
        return default


def telemetry():
    info = {'hostname': state['hostname'], 'ip': ip_address(), 'agent_version': AGENT_VERSION, 'mode': state['mode'],
            'user': load_config().get('user', '')}
    try:
        info['uptime'] = int(float(read_first('/proc/uptime', '0').split()[0]))
    except Exception:
        pass
    t = read_first('/sys/class/thermal/thermal_zone0/temp')
    if t.isdigit():
        info['cpu_temp'] = round(int(t) / 1000, 1)
    m = re.search(r'PRETTY_NAME="([^"]+)"', read_first('/etc/os-release'))
    if m:
        info['os'] = m.group(1)
    try:
        info['disk_free_mb'] = shutil.disk_usage('/').free // (1024 * 1024)
    except Exception:
        pass
    m = re.search(r'MemAvailable:\s+(\d+)', read_first('/proc/meminfo'))
    if m:
        info['mem_free_mb'] = int(m.group(1)) // 1024
    r = run(['nmcli', '-t', '-f', 'ACTIVE,SSID,SIGNAL', 'device', 'wifi'], timeout=15)
    for line in (r.stdout or '').splitlines():
        if line.startswith('yes:'):
            parts = line.split(':')
            info['wifi_ssid'] = parts[1]
            info['wifi_signal'] = parts[2] if len(parts) > 2 else ''
            break
    info['eth'] = 'connesso' if ethernet_carrier() else 'no'
    r = run(['pgrep', '-f', 'billboard-kiosk-profile'], timeout=10)
    info['player_running'] = 'yes' if r.returncode == 0 else 'no'
    return info


def execute(cmd):
    name, p = cmd.get('command'), cmd.get('payload') or {}
    log(f'comando {name} {p if name != "wifi_add" else {"ssid": p.get("ssid")}}')
    if name == 'restart_player':
        restart_kiosk()
        return True, 'player riavviato'
    if name == 'restart_agent':
        threading.Timer(2, lambda: os._exit(0)).start()
        return True, 'agente in riavvio'
    if name == 'reboot':
        threading.Timer(3, lambda: run(['systemctl', 'reboot'], timeout=30)).start()
        return True, 'riavvio del Raspberry tra 3 secondi'
    if name == 'set_server':
        url = p.get('url', '').rstrip('/')
        if not valid_server(url):
            return False, 'URL non valido'
        cfg = load_config()
        cfg['server'] = url
        save_config(cfg)
        state['server'] = url
        set_token('')            # sul nuovo server serve una nuova registrazione
        threading.Timer(2, restart_kiosk).start()
        return True, f'server impostato su {url}; lo schermo va riassociato sul nuovo pannello'
    if name == 'wifi_add':
        ssid, password = p.get('ssid', ''), p.get('password', '')
        wifi_prepare()
        run(['nmcli', 'connection', 'delete', ssid], timeout=15)
        add = ['nmcli', 'connection', 'add', 'type', 'wifi', 'ifname', 'wlan0', 'con-name', ssid, 'ssid', ssid, 'autoconnect', 'yes']
        if password:
            add += ['wifi-sec.key-mgmt', 'wpa-psk', 'wifi-sec.psk', password]
        r = run(add, timeout=30)
        if r.returncode != 0:
            return False, (r.stderr or r.stdout).strip()
        if p.get('connect'):
            r2 = run(['nmcli', 'connection', 'up', ssid], timeout=90)
            return r2.returncode == 0, ('collegato a ' + ssid) if r2.returncode == 0 else (r2.stderr or r2.stdout).strip()
        return True, f'rete {ssid} salvata: verra\' usata quando disponibile'
    if name == 'update':
        user = load_config().get('user') or (subprocess.getoutput('getent passwd 1000').split(':') or [''])[0]
        r = run(['bash', '-c', f'curl -fsSL {RAW_INSTALLER} | BILLBOARD_USER={user} BILLBOARD_COUNTRY={load_config().get("country", "")} bash -s {state["server"]}'], timeout=900)
        out = ((r.stdout or '') + (r.stderr or '')).strip()[-1500:]
        if r.returncode == 0:
            threading.Timer(3, lambda: os._exit(0)).start()   # riavvia l'agente con la nuova versione
            threading.Timer(2, restart_kiosk).start()
        return r.returncode == 0, out
    return False, 'comando sconosciuto'


def reporter():
    """Ogni 30 s manda la telemetria al server ed esegue i comandi in coda."""
    while True:
        try:
            if state['server'] and state['mode'] == 'online':
                token = ensure_token()
                if token:
                    try:
                        st, j = api('/api/device/agent', {'info': telemetry()}, token=token)
                        for cmd in j.get('commands', []):
                            ok, out = execute(cmd)
                            try:
                                api('/api/device/agent/result', {'id': cmd['id'], 'ok': ok, 'output': out}, token=token)
                            except Exception as e:
                                log(f'invio esito fallito: {e}')
                    except urllib.error.HTTPError as e:
                        if e.code == 401:
                            log('token non piu\' valido sul server: nuova registrazione')
                            set_token('')
                        else:
                            log(f'report fallito: HTTP {e.code}')
        except Exception as e:
            log(f'errore nel reporter: {e}')
        time.sleep(REPORT_EVERY_S)


# ---------- file di configurazione sulla partizione di boot ----------
def apply_boot_file():
    for path in BOOT_FILES:
        if not os.path.isfile(path):
            continue
        log(f'trovato {path}')
        kv = {}
        try:
            with open(path, encoding='utf-8', errors='replace') as f:
                for line in f:
                    m = re.match(r'^\s*([A-Z_]+)\s*=\s*(.*?)\s*$', line)
                    if m:
                        kv[m.group(1)] = m.group(2).strip().strip('"').strip("'")
        except Exception as e:
            log(f'impossibile leggere {path}: {e}')
            continue
        cfg = load_config()
        if valid_server(kv.get('SERVER', '')):
            cfg['server'] = kv['SERVER'].rstrip('/')
            save_config(cfg)
            log('server impostato da file di boot')
        if kv.get('WIFI_SSID'):
            connect_wifi(kv['WIFI_SSID'], kv.get('WIFI_PASS', ''), kv.get('WIFI_COUNTRY'))
        # togli la password dal file: e' gia' registrata in NetworkManager
        try:
            with open(path, encoding='utf-8', errors='replace') as f:
                lines = [l for l in f if not l.strip().startswith('WIFI_PASS')]
            with open(path, 'w') as f:
                f.writelines(lines)
                f.write('# applicato il ' + time.strftime('%Y-%m-%d %H:%M') + '\n')
        except Exception:
            pass


# ---------- pagine ----------
CSS = """
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b1020;color:#eef2ff}
.wrap{max-width:520px;margin:0 auto;padding:28px 20px}h1{font-size:1.6rem;margin:0 0 6px}p{color:#b6c0da;line-height:1.5}
label{display:block;font-size:.85rem;color:#b6c0da;margin:14px 0 6px}input,select{width:100%;font:inherit;padding:12px;border-radius:10px;border:1px solid #3a4870;background:#131a2e;color:#fff}
button{width:100%;margin-top:18px;font:inherit;font-weight:700;padding:14px;border:0;border-radius:10px;background:linear-gradient(135deg,#6d7cff,#a06bff);color:#fff}
.card{background:#131a2e;border:1px solid #232d47;border-radius:16px;padding:20px;margin-top:18px}.ok{color:#34d399}.err{color:#f87171}
code{font-family:ui-monospace,Menlo,monospace;background:#0a0f1e;padding:2px 6px;border-radius:6px}
.screen{display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:5vw}
.screen h1{font-size:5vw}.screen p{font-size:2.2vw}.screen .big{font-size:4vw;font-weight:800;letter-spacing:.06em;color:#fff}
.steps{text-align:left;display:inline-block;font-size:2vw;color:#dfe5ff;line-height:1.7}
.dot{display:inline-block;width:1.2vw;height:1.2vw;border-radius:50%;background:#f87171;margin-right:.6vw}.dot.on{background:#34d399}
"""


def page(title, body, refresh=None, screen=False):
    meta = f'<meta http-equiv="refresh" content="{refresh}">' if refresh else ''
    return f"""<!doctype html><html lang="it"><head><meta charset="utf-8"><title>{html.escape(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">{meta}<style>{CSS}</style></head>
<body>{'<div class="screen"><div>' if screen else '<div class="wrap">'}{body}</div>{'</div>' if screen else ''}</body></html>"""


def screen_page():
    mode, server = state['mode'], state['server']
    if mode == 'online' and server:
        return None  # redirect
    if mode == 'setup':
        body = f"""<h1>Configurazione schermo</h1>
<p>Questo schermo non trova una rete conosciuta.</p>
<p class="big">Wi‑Fi: {html.escape(state['hotspot_ssid'])}<br>Password: {HOTSPOT_PASS}</p>
<div class="steps">1. Con il telefono collegati alla rete Wi‑Fi qui sopra<br>
2. Si apre la pagina di configurazione (altrimenti visita <b>http://{HOTSPOT_IP}</b>)<br>
3. Scegli la rete Wi‑Fi di questa sede e indica il server</div>
<p>{html.escape(state['message'])}</p>"""
        return page('Configurazione', body, refresh=10, screen=True)
    if mode == 'online' and not server:
        body = f"""<h1>Schermo collegato, server mancante</h1>
<p>Il Pi è in rete ma non sa a quale server BillBoard collegarsi.</p>
<p>Apri <code>http://{ip_address() or state['hostname']}/setup</code> da un computer sulla stessa rete e imposta l'indirizzo del server.</p>"""
        return page('Server mancante', body, refresh=10, screen=True)
    body = f"""<h1><span class="dot"></span>Connessione in corso…</h1>
<p>{html.escape(state['hostname'])} · in attesa della rete{(' · ' + html.escape(state['message'])) if state['message'] else ''}</p>
<p>Se non si collega entro {OFFLINE_GRACE_S} secondi verrà creata una rete Wi‑Fi di configurazione.</p>"""
    return page('Connessione', body, refresh=5, screen=True)


def setup_form(msg='', err=''):
    nets = state['networks']
    opts = ''.join(f'<option value="{html.escape(n[0])}">{html.escape(n[0])} · {n[1]}%{" · aperta" if not n[2] else ""}</option>' for n in nets)
    body = f"""<h1>BillBoard</h1><p>Configura lo schermo <b>{html.escape(state['hostname'])}</b>.</p>
{f'<div class="card ok">{html.escape(msg)}</div>' if msg else ''}{f'<div class="card err">{html.escape(err)}</div>' if err else ''}
<form method="post" action="/apply">
<label>Rete Wi‑Fi</label>
<select name="ssid_pick" onchange="document.querySelector('[name=ssid]').value=this.value"><option value="">— scegli tra le reti trovate —</option>{opts}</select>
<label>Nome rete (SSID)</label><input name="ssid" placeholder="Nome della rete Wi‑Fi" autocapitalize="none">
<label>Password Wi‑Fi</label><input name="password" type="password" placeholder="Lascia vuoto se la rete è aperta">
<label>Server BillBoard</label><input name="server" value="{html.escape(state['server'])}" placeholder="https://billboard.tuodominio.it" inputmode="url" autocapitalize="none">
<button type="submit">Salva e collega</button></form>
<p style="margin-top:20px;font-size:.85rem">Per usare solo il cavo di rete lascia vuoto il nome della rete Wi‑Fi.</p>"""
    return page('Configurazione BillBoard', body)


def ip_address():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        return s.getsockname()[0]
    except Exception:
        return ''


PROBE_PATHS = ('/generate_204', '/gen_204', '/hotspot-detect.html', '/library/test/success.html',
               '/connecttest.txt', '/ncsi.txt', '/success.txt', '/canonical.html', '/redirect', '/check_network_status.txt')


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def _send(self, code, body, ctype='text/html; charset=utf-8', headers=None):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def _redirect(self, url):
        self._send(302, '', headers={'Location': url})

    def _local(self):
        return self.client_address[0] in ('127.0.0.1', '::1')

    CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'}

    def do_OPTIONS(self):
        self._send(204, '', headers=self.CORS)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if self._local():
            if path == '/token':
                # il player (Chromium su questo Pi) usa lo stesso token dell'agente
                return self._send(200, json.dumps({'token': ensure_token(), 'server': state['server'], 'agent': AGENT_VERSION}),
                                  'application/json', headers=self.CORS)
            if path == '/setup':
                return self._send(200, setup_form())
            body = screen_page()
            if body is None:
                return self._redirect(state['server'].rstrip('/') + '/player/')
            return self._send(200, body)
        # richieste dal telefono / dalla rete
        if state['mode'] != 'setup' and not (state['mode'] == 'online' and not state['server']):
            return self._send(403, page('Non disponibile', '<h1>Schermo già configurato</h1><p>La configurazione è disponibile solo quando lo schermo apre la rete BillBoard‑Setup.</p>'))
        if path in ('/setup', '/'):
            return self._send(200, setup_form())
        if path in PROBE_PATHS or path.endswith('.txt') or path.endswith('.html'):
            return self._redirect(f'http://{HOTSPOT_IP}/setup')   # portale captive
        return self._redirect('/setup')

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path in ('/token', '/token/invalid') and self._local():
            n = int(self.headers.get('Content-Length') or 0)
            try:
                body = json.loads(self.rfile.read(n).decode() or '{}')
            except Exception:
                body = {}
            tok = str(body.get('token') or '')[:128]
            if path == '/token' and tok and not state['token']:
                set_token(tok)                   # il player aveva gia' un token: lo adotta l'agente
                log('token ricevuto dal player')
            if path == '/token/invalid' and tok and tok == state['token']:
                set_token('')
                ensure_token()
            return self._send(200, json.dumps({'token': state['token']}), 'application/json', headers=self.CORS)
        if path != '/apply':
            return self._redirect('/setup')
        if not self._local() and state['mode'] != 'setup' and not (state['mode'] == 'online' and not state['server']):
            return self._send(403, 'non consentito')
        n = int(self.headers.get('Content-Length') or 0)
        form = urllib.parse.parse_qs(self.rfile.read(n).decode(errors='replace'))
        ssid = (form.get('ssid', [''])[0] or form.get('ssid_pick', [''])[0]).strip()
        password = form.get('password', [''])[0]
        server = form.get('server', [''])[0].strip().rstrip('/')
        if server and not valid_server(server):
            return self._send(200, setup_form(err='Indirizzo del server non valido: deve iniziare con http:// o https://'))
        if ssid and password and len(password) < 8:
            return self._send(200, setup_form(err='La password Wi‑Fi deve avere almeno 8 caratteri (o lascia vuoto per una rete aperta).'))
        cfg = load_config()
        if server:
            cfg['server'] = server
            save_config(cfg)
            state['server'] = server
        msg = 'Impostazioni salvate. ' + ('Lo schermo si collega ora alla rete ' + ssid + ': la rete BillBoard‑Setup si chiude e lo schermo mostrerà l\'esito.' if ssid else 'Lo schermo si ricollega.')
        self._send(200, page('Salvato', f'<h1>Fatto</h1><div class="card ok">{html.escape(msg)}</div>'))
        threading.Thread(target=apply_settings, args=(ssid, password), daemon=True).start()


def apply_settings(ssid, password):
    time.sleep(2)
    with state['lock']:
        if state['mode'] == 'setup':
            stop_hotspot()
        if ssid:
            state['mode'] = 'offline'
            state['message'] = f'connessione a {ssid}…'
            restart_kiosk()
            ok, err = connect_wifi(ssid, password)
            state['message'] = '' if ok else f'connessione a {ssid} fallita ({err[:80]})'
        state['offline_since'] = time.time() if not nm_connected() else None
        if state['mode'] != 'setup':
            state['mode'] = 'online' if nm_connected() else 'offline'
        restart_kiosk()


# ---------- ciclo di controllo ----------
def enter_setup():
    state['networks'] = scan_networks()
    if start_hotspot():
        state['mode'] = 'setup'
        state['message'] = ''
        restart_kiosk()
        return True
    state['offline_since'] = time.time()   # riprova tra un altro periodo di grazia
    if not state['message']:
        state['message'] = 'impossibile creare la rete di configurazione'
    return False


def monitor():
    last_retry = time.time()
    while True:
        try:
            with state['lock']:
                if state['mode'] == 'setup':
                    # ogni tanto chiudi l'hotspot per vedere se una rete nota e' tornata raggiungibile
                    if time.time() - last_retry > RETRY_KNOWN_EVERY_S:
                        last_retry = time.time()
                        stop_hotspot()
                        for _ in range(9):
                            time.sleep(5)
                            if nm_connected():
                                break
                        if nm_connected():
                            state['mode'] = 'online'
                            state['offline_since'] = None
                            restart_kiosk()
                            log('rete nota ritrovata, esco dal setup')
                        else:
                            start_hotspot()
                else:
                    online = nm_connected()
                    if online:
                        if state['mode'] != 'online':
                            state['mode'] = 'online'
                            state['message'] = ''
                            restart_kiosk()
                            log('online')
                        state['offline_since'] = None
                    else:
                        if state['offline_since'] is None:
                            state['offline_since'] = time.time()
                        if state['mode'] == 'online':
                            state['mode'] = 'offline'
                            log('offline')
                        if time.time() - state['offline_since'] > OFFLINE_GRACE_S and not ethernet_carrier():
                            log('senza rete da troppo tempo: apro l\'hotspot di configurazione')
                            enter_setup()
                            last_retry = time.time()
        except Exception as e:
            log(f'errore nel monitor: {e}')
        time.sleep(10)


def main():
    cfg = load_config()
    state['server'] = cfg.get('server', '')
    state['token'] = cfg.get('token', '')
    suffix = cfg.get('hotspot_suffix') or secrets.token_hex(2).upper()
    if 'hotspot_suffix' not in cfg:
        cfg['hotspot_suffix'] = suffix
        save_config(cfg)
    state['hotspot_ssid'] = f'BillBoard-Setup-{suffix}'
    if not MOCK:
        stop_hotspot()   # pulizia da un riavvio precedente
        apply_boot_file()
    state['mode'] = 'offline'
    state['offline_since'] = time.time()
    threading.Thread(target=monitor, daemon=True).start()
    threading.Thread(target=reporter, daemon=True).start()
    log(f'agente in ascolto sulla porta {PORT}, server: {state["server"] or "(nessuno)"}, hotspot: {state["hotspot_ssid"]}')
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()


if __name__ == '__main__':
    main()
