# BillBoard, guida d'uso

Questa guida spiega come usare il pannello di controllo una volta che il server è installato
(per l'installazione vedi il [README](README.md)).

## Indice

1. [Accesso al pannello](#1-accesso-al-pannello)
2. [Collegare uno schermo](#2-collegare-uno-schermo)
3. [Caricare immagini e video](#3-caricare-immagini-e-video)
4. [Creare una playlist](#4-creare-una-playlist)
5. [Stile dei testi](#5-stile-dei-testi)
6. [Posizionare e ridimensionare](#6-posizionare-e-ridimensionare)
7. [Widget: terzo inferiore, barra notizie, orologio, logo](#7-widget)
8. [Schermi verticali e orientamento](#8-schermi-verticali-e-orientamento)
9. [Consigli sui contenuti](#9-consigli-sui-contenuti)
10. [Problemi comuni](#10-problemi-comuni)

---

## 1. Accesso al pannello

Apri nel browser l'indirizzo del server seguito da `/admin/`, per esempio
`https://billboard.tuodominio.it/admin/`, e inserisci la password impostata all'installazione.

Il pannello ha tre sezioni nella barra laterale:

- **Schermi**: i dispositivi collegati e quelli in attesa.
- **Playlist**: le sequenze di contenuti.
- **Media**: la libreria di immagini e video.

## 2. Collegare uno schermo

Il Raspberry può essere preparato in due modi (vedi il README): con lo script `install.sh` su un
Raspberry Pi OS già avviato, oppure scrivendo sulla microSD l'**immagine già configurata** creata
con `build-image.sh`, che al primo avvio si installa da sola senza tastiera né mouse (servono
alcuni minuti e un riavvio automatico).

1. Accendi il Raspberry con il player installato. Dopo qualche secondo lo schermo mostra un
   **codice di 6 caratteri** (per esempio `K7XM2Q`).
2. Nel pannello, sezione **Schermi**, lo schermo compare nel riquadro "In attesa di associazione"
   con il suo codice. Clicca **Associa**.
3. Dai un nome allo schermo (es. "Vetrina") e scegli la playlist iniziale. Conferma.
4. Entro 5 secondi lo schermo inizia a riprodurre.

Se il codice non compare in lista (per esempio lo schermo è su un'altra rete), usa
**Inserisci codice** in alto a destra e digitalo a mano.

Nella scheda di ogni schermo puoi:

- cambiare il **nome** cliccandoci sopra;
- cambiare la **playlist** dal menu a tendina (lo schermo si aggiorna entro 15 secondi);
- vedere stato **online/offline**, risoluzione, ultimo contatto e indirizzo IP;
- **rimuovere** lo schermo con il cestino: tornerà a mostrare un codice di associazione.

Uno schermo è considerato offline se non contatta il server da più di 90 secondi. Anche offline
continua a riprodurre l'ultima playlist ricevuta.

## 3. Caricare immagini e video

Nella sezione **Media** trascina i file nell'area tratteggiata oppure usa **Carica file**.

Formati supportati: JPG, PNG, GIF, WebP, AVIF, SVG per le immagini; MP4, WebM, OGG, MOV per i video.
Limite per file: 300 MB (modificabile nella configurazione del server).

Per eliminare un file passa il mouse sulla sua anteprima e clicca il cestino. Se il file è usato
in qualche playlist viene tolto anche da lì.

## 4. Creare una playlist

1. Sezione **Playlist**: scrivi il nome, scegli l'orientamento (orizzontale o verticale) e clicca
   **Crea**.
2. Aggiungi contenuti con i pulsanti in alto:
   - **Immagine / Video**: scegli un file dalla libreria.
   - **Pagina web**: inserisci un indirizzo `https://…` (meteo, sito, dashboard…). Nota: alcuni
     siti non permettono di essere incorporati e mostreranno una pagina vuota.
   - **Testo**: un testo a schermo intero, che poi personalizzi.
3. Per ogni elemento imposta la **durata** in secondi. I video durano fino alla fine.
4. Riordina con le frecce ↑ ↓, elimina con ✕.
5. Clicca **Salva**. Gli schermi che usano la playlist si aggiornano entro pochi secondi.

Altri pulsanti nell'intestazione:

- **Anteprima**: apre la playlist a schermo intero in una nuova scheda, senza bisogno di uno schermo
  fisico. Si aggiorna da sola quando salvi.
- **Copia in verticale / orizzontale**: crea una copia della playlist per l'altro orientamento
  (vedi sezione 8).
- **Cestino**: elimina la playlist. Gli schermi che la usavano restano senza contenuti.

Il pulsante con le **due frecce circolari** su un'immagine o un video sostituisce solo il file,
mantenendo durata, posizione e widget.

Se una playlist ha un solo elemento, lo schermo lo mostra fisso senza ricominciare da capo: utile
per una scritta scorrevole continua sopra un'immagine.

## 5. Stile dei testi

Clicca **Stile** su un elemento. In alto c'è l'**anteprima dal vivo**, sotto i controlli.

Per i testi (sia l'elemento Testo, sia i testi in sovraimpressione):

- **Carattere**: 10 caratteri tra cui scegliere, dal classico all'elegante al calligrafico.
- **Dimensione testo**: in percentuale della larghezza dello schermo, così il risultato è uguale
  su Full HD e 4K.
- **Colori**: testo e sfondo, con **opacità** dello sfondo (0 = nessuna fascia dietro il testo).
- **Allineamento** e **grassetto**.
- **Testo scorrevole**: con **direzione** (verso sinistra, destra, alto, basso) e **velocità**.
  Nello scorrimento verticale il testo può essere su più righe.
- **Rotazione**: ruota il testo di 90° per le fasce laterali strette.

Le modifiche si vedono subito nell'anteprima; diventano definitive con **Salva**.

## 6. Posizionare e ridimensionare

Ogni testo, widget, immagine o video occupa un **riquadro** definito in percentuale dello schermo.
Puoi modificarlo in tre modi:

- **Trascinando nell'anteprima**: gli elementi hanno un bordo tratteggiato. Trascinali per
  spostarli, usa il quadratino nell'angolo in basso a destra per ridimensionarli.
- **Con i numeri**: da sinistra, dall'alto, larghezza e altezza (sezione "Posizione e dimensione").
- **Con le preimpostazioni**: schermo intero, fascia in alto/centrale/in basso, bordo sinistro/destro,
  metà sinistra/destra, ecc.

Per immagini e video c'è anche **Adattamento**: "Intero" mostra tutta l'immagine con eventuali
bande nere, "Riempi" la ritaglia per coprire il riquadro. Le zone dello schermo non coperte
restano nere: puoi ad esempio mettere il video nella metà sinistra e i testi a destra.

## 7. Widget

Nella sezione "Widget in sovraimpressione" di ogni elemento puoi aggiungere fino a 12 widget,
ognuno con posizione e stile propri. Valgono per immagini, video, testi e pagine web.

| Widget | Cosa fa | Campi principali |
|--------|---------|------------------|
| **Testo** | Una scritta libera, fissa o scorrevole | vedi sezione 5 |
| **Terzo inferiore** | La fascia dei telegiornali con etichetta (es. "IN DIRETTA"), nome e ruolo | etichetta, titolo, sottotitolo, colori, sfumatura, immagine di sfondo |
| **Barra notizie** | Barra con testata, categoria, orologio e titoli che scorrono | testata, categoria, feed RSS, notizie scritte a mano (una per riga), velocità, orologio sì/no |
| **Orologio** | Ora e/o data aggiornate ogni secondo | formato (ora, ora con secondi, data, data e ora), dimensione, colori |
| **Logo** | Un'immagine in un angolo | immagine dalla libreria, opacità |

Suggerimenti:

- Nel terzo inferiore e nella barra notizie le dimensioni dei testi seguono l'**altezza del
  riquadro**: per testi più grandi alza il riquadro.
- Per il logo usa un **PNG con sfondo trasparente**.
- Come sfondo del terzo inferiore o della barra puoi usare una grafica tua (per esempio un
  gradiente "breaking news") al posto dei colori.
- **Notizie da un feed RSS**: incolla l'indirizzo del feed nel campo "Feed RSS" della barra
  (per esempio `https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml`). Il pannello verifica
  subito il feed e mostra i primi titoli; sullo schermo i titoli si aggiornano ogni 5 minuti.
  Scegli quanti titoli mostrare con "Titoli dal feed". Le notizie scritte a mano vengono mostrate
  dopo i titoli del feed, oppure da sole se il feed non risponde. Funzionano i feed RSS e Atom.

## 7b. Spostare uno schermo in un'altra sede (rete o server diversi)

Ogni Raspberry ha un piccolo **agente** che controlla la rete. Se all'accensione non trova una
rete conosciuta per circa un minuto e mezzo (e non c'è un cavo di rete collegato), crea da solo
una rete Wi‑Fi di configurazione e mostra le istruzioni sullo schermo:

1. Con il telefono collegati alla rete **BillBoard‑Setup‑XXXX** (password `billboard`), il codice
   XXXX è scritto sullo schermo.
2. Si apre automaticamente la pagina di configurazione (se non compare, apri `http://10.42.0.1`).
3. Scegli la rete Wi‑Fi della sede tra quelle trovate, inserisci la password e, se serve, il nuovo
   indirizzo del server BillBoard. Premi **Salva e collega**.
4. La rete di configurazione si chiude, lo schermo si collega alla nuova rete e dopo pochi secondi
   mostra il codice di associazione (o riprende la playlist, se era già associato allo stesso
   server).

Se la rete conosciuta torna disponibile mentre la rete di configurazione è aperta, ogni 5 minuti
lo schermo prova a ricollegarsi da solo.

In alternativa, senza telefono: spegni il Pi, inserisci la microSD in un computer e crea nella
partizione `bootfs` un file di testo `billboard.txt`:

```
SERVER=https://billboard.tuodominio.it
WIFI_SSID=NomeRete
WIFI_PASS=password
WIFI_COUNTRY=IT
```

All'avvio il Pi applica le impostazioni e cancella la password dal file.

## 8. Schermi verticali e orientamento

Ogni playlist ha un orientamento, **orizzontale** o **verticale**. L'anteprima usa il formato
corrispondente (16:9 o 9:16) così vedi il risultato reale.

- La rotazione fisica del monitor si imposta **sul Raspberry** (Screen Configuration nel desktop,
  oppure `wlr-randr`). Il player si adatta da solo allo schermo che trova.
- Nella scheda di uno schermo compare un **avviso** se la playlist assegnata ha un orientamento
  diverso da quello dello schermo: funziona lo stesso, ma non sarà impaginata come in anteprima.
- Per avere entrambe le versioni usa **Copia in verticale**: crea una nuova playlist con gli stessi
  elementi e le dimensioni dei testi riadattate. Poi sostituisci le foto orizzontali con versioni
  verticali (pulsante con le due frecce).

Le posizioni sono in percentuale, quindi una playlist orizzontale si vede identica su Full HD e
4K. Carica però le immagini alla risoluzione più alta che userai (per il 4K almeno 3840 px sul
lato lungo), altrimenti risulteranno sfocate.

## 9. Consigli sui contenuti

- **Immagini**: JPG per le foto, PNG per grafiche con testo o trasparenze. Prepara le immagini già
  nel formato dello schermo (16:9 o 9:16) per evitare bande nere.
- **Video**: MP4 H.264 fino a 1080p è il formato più sicuro sul Raspberry Pi 3/4; sul Pi 5 va bene
  anche il 4K. I video vengono riprodotti senza audio.
- **Durate**: 8–15 secondi per un'immagine sono una buona base; per i testi scorrevoli lunghi
  aumenta la durata o riduci la velocità.
- **Leggibilità**: testo chiaro su fascia scura semitrasparente (opacità 50–70%) si legge bene su
  qualsiasi foto.

## 10. Problemi comuni

**Lo schermo mostra il codice ma non compare nel pannello.**
Controlla che il Raspberry raggiunga il server (stesso indirizzo usato nell'installazione).
Se il codice c'è ma il pannello non lo vede, usa "Inserisci codice".

**Lo schermo è offline.**
Ha perso la connessione al server: continua a riprodurre l'ultima playlist. Verifica rete e
alimentazione; tornerà online da solo.

**Ho modificato la playlist ma lo schermo non cambia.**
Hai cliccato **Salva**? Le modifiche nell'anteprima non sono attive finché non salvi. Dopo il
salvataggio servono fino a 15 secondi.

**Una pagina web resta bianca.**
Il sito non permette di essere incorporato in altre pagine. Non c'è soluzione lato BillBoard:
usa un'altra fonte o un'immagine.

**Il feed RSS non viene letto.**
Il pannello indica il motivo sotto il campo: indirizzo errato, sito che non risponde o pagina che
non è un feed. Cerca sul sito della testata il link "RSS" (di solito termina con `.xml` o `/rss`).
Per sicurezza non sono ammessi feed su indirizzi privati o locali.

**I video non partono o scattano.**
Riduci la risoluzione o il bitrate (1080p, H.264). Evita formati esotici.

**Voglio rimuovere uno schermo o spostarlo altrove.**
Cestino nella sua scheda: lo schermo torna a mostrare un codice e può essere associato di nuovo,
anche con un altro nome.

**Ho dimenticato la password del pannello.**
Si cambia nella configurazione del server (`ADMIN_PASSWORD`) e si riavvia il container.
