# BillBoard

Sistema di digital signage self-hosted: un server sul cloud con pannello di controllo web,
e schermi (Raspberry Pi) che si associano con un codice e riproducono le playlist assegnate.

```
┌──────────────────────── Cloud ────────────────────────┐
│  BillBoard server (Node.js + SQLite)                  │
│   /admin/   pannello: schermi, playlist, media        │
│   /player/  pagina riprodotta dai Raspberry           │
│   /api/     REST (admin con cookie, device con token) │
└───────────────────────────┬───────────────────────────┘
                            │ HTTPS, polling ogni 15 s
        ┌───────────────────┼───────────────────┐
   Raspberry #1        Raspberry #2         Raspberry #n
   Chromium kiosk      Chromium kiosk       Chromium kiosk
```

## Funzionalità

- **Associazione dispositivi**: lo schermo appena acceso mostra un codice a 6 caratteri; dal pannello
  lo associ dandogli un nome e una playlist. Nessuna configurazione sul Pi oltre all'URL del server.
- **Playlist** con immagini, video (mp4/webm), pagine web (iframe) e testi, con durata per elemento.
- **Stile dei testi**: 10 caratteri (Google Fonts), dimensione, colore, sfondo, allineamento, grassetto,
  testo scorrevole con velocità regolabile.
- **Testo in sovraimpressione** su immagini e video: fascia in alto, al centro o in basso, opacità
  dello sfondo, statica o scorrevole. Immagini e video adattabili (intero o riempi schermo).
- **Posizione e dimensione libere**: testo, immagini e video si spostano e ridimensionano trascinandoli
  nell'anteprima o con valori in percentuale dello schermo, quindi la stessa playlist si adatta a
  qualsiasi risoluzione.
- **Orientamento per playlist** (orizzontale o verticale): l'anteprima usa il formato giusto, il
  pannello avvisa se uno schermo verticale ha una playlist orizzontale (o viceversa) e con "Copia in
  verticale" si duplica una playlist nell'altro orientamento con le dimensioni dei testi riadattate.
  La rotazione fisica dello schermo si imposta sul Raspberry (Screen Configuration o `wlr-randr`).
- **Widget televisivi** sovrapponibili a qualsiasi contenuto (anche più di uno per elemento): testi liberi,
  terzo inferiore (etichetta "IN DIRETTA", nome, ruolo), barra notizie con testata, categoria, orologio e
  titoli scorrevoli, orologio/data in tempo reale, logo in un angolo. Ogni widget si posiziona e
  ridimensiona trascinandolo nell'anteprima; sfondi a colore, sfumatura o immagine.
- **Anteprima dal vivo** di ogni elemento nel pannello e anteprima dell'intera playlist a schermo intero.
- I player si ricaricano da soli quando il server viene aggiornato.
- **Libreria media** con upload dal browser.
- **Stato schermi**: online/offline, risoluzione, ultimo contatto, IP.
- I player si aggiornano da soli entro pochi secondi da ogni modifica e continuano a riprodurre
  l'ultima playlist anche se la connessione cade.
- Un solo container, dati in una cartella (`data/`): backup = copia della cartella.

## 1. Server sul cloud

Funziona su qualsiasi VPS con Docker (Hetzner, DigitalOcean, OVH, AWS Lightsail…).

```bash
git clone <questo repo> billboard && cd billboard

# HTTP semplice sulla porta 8080
ADMIN_PASSWORD='una-password-robusta' docker compose up -d --build

# Oppure con HTTPS automatico (serve un dominio che punta al server)
DOMAIN=billboard.tuodominio.it ADMIN_PASSWORD='una-password-robusta' \
  docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

Poi apri `https://billboard.tuodominio.it/admin/` (o `http://IP:8080/admin/`).

Variabili d'ambiente (vedi `.env.example`):

| Variabile        | Descrizione                                                                 |
|------------------|-----------------------------------------------------------------------------|
| `ADMIN_PASSWORD` | Password del pannello (obbligatoria)                                        |
| `SESSION_SECRET` | Segreto per i cookie di sessione; impostalo per non perdere il login ai riavvii |
| `PORT`           | Porta HTTP (default 8080)                                                   |
| `DATA_DIR`       | Cartella dati (default `./data`, in Docker `/app/data`)                     |
| `MAX_UPLOAD_MB`  | Limite upload per file (default 300)                                        |

**HTTPS è consigliato**: Chromium sul Pi accetta l'autoplay dei video e mantiene il token in modo
affidabile solo su origini sicure. Con `docker-compose.https.yml` Caddy ottiene i certificati da
Let's Encrypt in automatico.

Anche senza Docker: `npm install && ADMIN_PASSWORD=... npm start` (Node 20+).

## 2. Raspberry Pi

Serve Raspberry Pi OS **con desktop** (Bookworm o Bullseye), collegato in rete.

```bash
curl -fsSL https://billboard.tuodominio.it/pi/install.sh -o install.sh   # oppure copia pi/install.sh via scp
bash install.sh https://billboard.tuodominio.it
sudo reboot
```

Lo script installa Chromium, disattiva lo spegnimento dello schermo, abilita il login automatico
e avvia al boot Chromium in modalità chiosco sulla pagina `/player/`. Se Chromium si chiude viene
riavviato. Al boot lo schermo mostra il **codice di associazione**.

> Nota: `pi/install.sh` non è servito dal server, copialo sul Pi (scp, chiavetta) o dal repo.

## 3. Associare uno schermo

1. Pannello → **Dispositivi**: lo schermo acceso compare tra quelli "in attesa" con il suo codice.
2. Clicca **Associa**, dai un nome (es. "Vetrina") e scegli la playlist.
3. Entro 5 secondi lo schermo inizia a riprodurre.

Per cambiare contenuti: **Media** per caricare file, **Playlist** per comporre e salvare.
Gli schermi ricaricano la playlist entro 15 secondi.

## API (riassunto)

Admin (cookie di sessione, login su `POST /api/auth/login`):

| Metodo | Percorso                          | Descrizione                              |
|--------|-----------------------------------|------------------------------------------|
| GET    | /api/admin/devices                | Schermi associati                        |
| GET    | /api/admin/devices/pending        | Schermi in attesa (con codice)           |
| POST   | /api/admin/devices/pair           | `{code, name, playlist_id?}`             |
| PATCH  | /api/admin/devices/:id            | `{name?, playlist_id?}`                  |
| DELETE | /api/admin/devices/:id            | Rimuove (lo schermo torna al codice)     |
| GET/POST | /api/admin/playlists            | Lista / crea `{name}`                    |
| GET/PATCH/DELETE | /api/admin/playlists/:id | Dettaglio con items / rinomina / elimina |
| PUT    | /api/admin/playlists/:id/items    | `{items:[{type, media_id|url|text, duration, options}]}` |
| POST   | /api/admin/playlists/:id/duplicate | `{orientation?, name?}` copia nell'altro orientamento |
| GET/POST | /api/admin/media                | Lista / upload multipart `files[]`       |
| DELETE | /api/admin/media/:id              | Elimina file                             |

Player (token Bearer):

| Metodo | Percorso              | Descrizione                                           |
|--------|-----------------------|-------------------------------------------------------|
| POST   | /api/device/register  | Crea il dispositivo, ritorna `{token, code}`          |
| GET    | /api/device/state     | `{paired, code}` oppure `{paired, name, playlist}`    |

Qualsiasi altro dispositivo capace di aprire una pagina web (Android TV, mini PC, Chromecast con
browser) può fare da player: basta aprire `/player/` a schermo intero.

## Struttura

```
server/            Express + SQLite (better-sqlite3)
  index.js         avvio, static, cleanup
  auth.js          sessione admin, token dispositivi
  routes/admin.js  dispositivi, playlist, media
  routes/device.js registrazione e stato player
public/admin/      pannello di controllo (HTML/JS senza build)
public/player/     player a schermo intero (anche /player/?preview=<id> per l'anteprima)
public/shared/     motore di rendering condiviso tra player e anteprima (render.js)
server/style.js    validazione delle opzioni grafiche
pi/install.sh      installazione chiosco su Raspberry Pi OS
Dockerfile, docker-compose*.yml, Caddyfile
```
