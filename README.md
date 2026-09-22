# BillBoard

Digital signage self-hosted: un server sul cloud con pannello di controllo web, e schermi
(Raspberry Pi o qualsiasi dispositivo con un browser) che si associano con un codice e
riproducono le playlist assegnate.

> **Guida d'uso del pannello:** [GUIDA.md](GUIDA.md)

```
┌──────────────────────── Cloud ────────────────────────┐
│  BillBoard server (Node.js + SQLite)                  │
│   /admin/   pannello: schermi, playlist, media        │
│   /player/  pagina riprodotta dagli schermi           │
│   /api/     REST (admin con cookie, device con token) │
└───────────────────────────┬───────────────────────────┘
                            │ HTTPS, polling ogni 15 s
        ┌───────────────────┼───────────────────┐
   Raspberry #1        Raspberry #2         Raspberry #n
   Chromium kiosk      Chromium kiosk       Chromium kiosk
```

## Funzionalità

- **Associazione schermi con codice**: lo schermo appena acceso mostra un codice a 6 caratteri,
  dal pannello gli dai un nome e una playlist. Nessuna configurazione sul Pi oltre all'URL del server.
- **Playlist** con immagini, video (mp4/webm), pagine web e testi, durata per elemento, orientamento
  orizzontale o verticale, copia adattata nell'altro orientamento.
- **Testi** con 10 caratteri (Google Fonts), dimensione, colori, allineamento, scorrimento nelle
  quattro direzioni, rotazione per le fasce laterali.
- **Widget televisivi** sovrapponibili a qualsiasi contenuto: testi liberi, terzo inferiore
  (etichetta, nome, ruolo), barra notizie con testata, categoria, orologio e titoli scorrevoli
  **anche da feed RSS/Atom** (aggiornati ogni 5 minuti), orologio/data in tempo reale, logo.
  Tutto posizionabile e ridimensionabile trascinandolo nell'anteprima.
- **Immagini e video** ridimensionabili e posizionabili sullo schermo (intero o riempi).
- **Anteprima dal vivo** nel pannello e anteprima dell'intera playlist a schermo intero.
- **Stato schermi**: online/offline, risoluzione, orientamento, ultimo contatto, IP; avviso se la
  playlist ha un orientamento diverso dallo schermo.
- I player si aggiornano da soli entro pochi secondi da ogni modifica, continuano a riprodurre
  l'ultima playlist se cade la rete e si ricaricano quando il server viene aggiornato.
- Un solo container, dati in una cartella (`data/`): backup = copia della cartella.

## Requisiti

- **Server**: qualsiasi VPS Linux con Docker (Hetzner, DigitalOcean, OVH, AWS Lightsail…),
  oppure Node.js 20+ senza Docker. Un dominio è consigliato per avere HTTPS.
- **Schermi**: Raspberry Pi 3/4/5 con Raspberry Pi OS Desktop, collegato in rete. In alternativa
  qualunque dispositivo con Chromium/Chrome (mini PC, Android TV con browser).

## Installazione del server

```bash
git clone https://github.com/luzadev/billboard.git && cd billboard

# HTTP sulla porta 8080
ADMIN_PASSWORD='una-password-robusta' docker compose up -d --build

# Oppure HTTPS automatico (Let's Encrypt) con un dominio che punta al server
DOMAIN=billboard.tuodominio.it ADMIN_PASSWORD='una-password-robusta' \
  docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

Poi apri `https://billboard.tuodominio.it/admin/` (o `http://IP:8080/admin/`).

Senza Docker: `npm install && ADMIN_PASSWORD=... npm start`. In alternativa copia `.env.example`
in `.env` e compilalo.

| Variabile        | Descrizione                                                                      |
|------------------|----------------------------------------------------------------------------------|
| `ADMIN_PASSWORD` | Password del pannello (obbligatoria)                                             |
| `SESSION_SECRET` | Segreto per i cookie di sessione; impostalo per non perdere il login ai riavvii  |
| `PORT`           | Porta HTTP (default 8080)                                                        |
| `DATA_DIR`       | Cartella dati (default `./data`, in Docker `/app/data`)                          |
| `MAX_UPLOAD_MB`  | Limite upload per file (default 300)                                             |

**Aggiornare** il server: `git pull && docker compose up -d --build`. Gli schermi si ricaricano da soli.

**Backup**: copia la cartella `data/` (contiene `billboard.db` e `uploads/`).

## Installazione sul Raspberry Pi

Con Raspberry Pi OS **Desktop** (Bookworm o Bullseye) già avviato e collegato in rete:

```bash
git clone https://github.com/luzadev/billboard.git
bash billboard/pi/install.sh https://billboard.tuodominio.it
sudo reboot
```

Lo script installa Chromium, disattiva lo spegnimento dello schermo, abilita il login automatico e
avvia al boot Chromium in modalità chiosco sulla pagina `/player/`; se Chromium si chiude viene
riavviato. Al boot lo schermo mostra il codice di associazione.

Sul Pi gira anche un **agente** (`pi/agent/`): il chiosco apre `http://127.0.0.1/`, l'agente
rimanda al server quando la rete c'è; se il Pi resta senza rete apre l'hotspot
**BillBoard‑Setup‑XXXX** con portale captive per impostare Wi‑Fi e server dal telefono, e
applica il file `billboard.txt` dalla partizione di boot (vedi la guida, sezione 7b).

Per uno schermo **verticale** imposta la rotazione sul Pi (Screen Configuration nel desktop,
oppure `wlr-randr`), il player si adatta da solo.

### Immagine SD già configurata (senza tastiera)

In alternativa, `pi/build-image.sh` crea dal Mac o da Linux un'immagine di Raspberry Pi OS
personalizzata: al primo avvio il Pi configura utente, Wi‑Fi, hostname e fuso orario, installa il
player e si riavvia mostrando il codice di associazione. Usa lo stesso meccanismo di primo avvio
(cloud-init) di Raspberry Pi Imager.

```bash
bash pi/build-image.sh --server https://billboard.tuodominio.it \
  --wifi-ssid "MiaRete" --wifi-pass "segreta" --pass "password-del-pi" --ssh
# → billboard-YYYYMMDD.img da scrivere sulla microSD con Raspberry Pi Imager
#   ("Usa immagine personalizzata", senza altre personalizzazioni), balenaEtcher o dd
```

Lo script scarica l'ultima Raspberry Pi OS 64-bit Desktop ufficiale (una volta sola, poi la
tiene in `pi/cache/`), la decomprime e scrive `user-data`, `meta-data` e `network-config` nella
partizione di boot. Serve `xz` (`brew install xz` su macOS). Opzioni: `--user`, `--hostname`,
`--country`, `--timezone`, `--keymap`, `--wifi-hidden`, `--image` (immagine locale), `--compress`.
La stessa immagine va bene per tutti gli schermi che usano lo stesso server e la stessa rete: ogni
Pi riceve un codice di associazione diverso.

## API (riassunto)

Admin (cookie di sessione, login su `POST /api/auth/login`):

| Metodo | Percorso                            | Descrizione                                                  |
|--------|-------------------------------------|--------------------------------------------------------------|
| GET    | /api/admin/devices                  | Schermi associati                                            |
| GET    | /api/admin/devices/pending          | Schermi in attesa (con codice)                               |
| POST   | /api/admin/devices/pair             | `{code, name, playlist_id?}`                                 |
| PATCH  | /api/admin/devices/:id              | `{name?, playlist_id?}`                                      |
| DELETE | /api/admin/devices/:id              | Rimuove (lo schermo torna al codice)                         |
| GET/POST | /api/admin/playlists              | Lista / crea `{name, orientation?}`                          |
| GET/PATCH/DELETE | /api/admin/playlists/:id  | Dettaglio con items / rinomina, orientamento / elimina       |
| PUT    | /api/admin/playlists/:id/items      | `{items:[{type, media_id|url|text, duration, options}]}`     |
| POST   | /api/admin/playlists/:id/duplicate  | `{orientation?, name?}` copia nell'altro orientamento        |
| GET/POST | /api/admin/media                  | Lista / upload multipart `files[]`                           |
| DELETE | /api/admin/media/:id                | Elimina file                                                 |

Feed (sessione admin oppure token dispositivo):

| Metodo | Percorso   | Descrizione                                                        |
|--------|------------|--------------------------------------------------------------------|
| GET    | /api/feed  | `?url=<rss>&max=10` → `{titles, fetched_at}`, cache 5 min, solo host pubblici |

Player (token Bearer):

| Metodo | Percorso              | Descrizione                                              |
|--------|-----------------------|----------------------------------------------------------|
| POST   | /api/device/register  | Crea il dispositivo, ritorna `{token, code}`             |
| GET    | /api/device/state     | `{paired, code}` oppure `{paired, name, playlist, app_version}` |

Lo schema delle opzioni grafiche (`options`) è definito e validato in `server/style.js`.

## Struttura

```
server/            Express + SQLite (better-sqlite3)
  index.js         avvio, static, versione asset, pulizia
  auth.js          sessione admin, token dispositivi
  style.js         validazione delle opzioni grafiche e dei widget
  routes/admin.js  dispositivi, playlist, media
  routes/device.js registrazione e stato player
  routes/feed.js   lettura feed RSS/Atom con cache per la barra notizie
public/admin/      pannello di controllo (HTML/CSS/JS senza build)
public/player/     player a schermo intero (/player/?preview=<id> per l'anteprima)
public/shared/     motore di rendering condiviso tra player e anteprima
pi/install.sh      installazione chiosco + agente su Raspberry Pi OS
pi/agent/          agente: stato rete, hotspot di configurazione, portale captive
pi/build-image.sh  crea un'immagine SD preconfigurata (cloud-init)
Dockerfile, docker-compose*.yml, Caddyfile
```

## Licenza

MIT
