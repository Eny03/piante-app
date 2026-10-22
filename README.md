# 🌿 Herbarium — Database Botanico Full-Stack

Applicazione web full-stack moderna per la gestione collaborativa di un database botanico.
Accessibile online tramite link pubblico, senza bisogno di registrazione o login, con sincronizzazione istantanea in tempo reale (SSE).

---

## 🌐 URL Pubblico Condivisibile Attivo

> **Link Live**: [https://countries-plastics-programmer-shoot.trycloudflare.com](https://countries-plastics-programmer-shoot.trycloudflare.com)
> 
> *Chiunque apra questo link può visualizzare il catalogo botanico, aggiungere nuove piante, modificarle ed eliminarle in tempo reale.*

---

## 🚀 Funzionalità Principali

### 1. Dashboard Botanico (Griglia Responsive)
- Visualizzazione a card di tutte le piante con foto, nome botanico, nome scientifico e metriche.
- Badges visivi color-coded per:
  - 🧪 **pH del terreno** (es. `5.5 - 6.5`, `6.0 - 7.0`)
  - 🌡️ **Temperatura ideale** con unità in °C (es. `18°C - 24°C`)
  - 💧 **Umidità del terreno** (`Bassa`, `Media`, `Alta` o percentuale personalizzata)
  - ☀️ **Esposizione solare**
  - 📝 **Note di coltivazione e consigli**
- Statistiche in tempo reale: totale piante, conteggio piante ad alta e bassa umidità.
- Barra di ricerca istantanea (per nome, nome scientifico o note).
- Filtro rapido per livello di umidità e ordinamento (più recenti, alfabetico A-Z, pH).

### 2. Aggiunta Piante
- Form modale con validazione dei campi obbligatori.
- Preset rapidi cliccabili per pH e temperature più frequenti.
- Caricamento foto dal dispositivo o dalla fotocamera dello smartphone.
- Galleria integrata per selezionare rapidamente le 22 foto botaniche precaricate.
- Inserimento opzionale di URL immagine personalizzato.

### 3. Modifica ed Eliminazione
- Pulsante **Modifica** su ogni card per aggiornare qualunque parametro.
- Pulsante **Elimina** con modale di conferma di sicurezza per evitare cancellazioni accidentali.

### 4. Sincronizzazione in Tempo Reale (Zero Login)
- Architettura basata su **Server-Sent Events (SSE)**.
- Quando un utente aggiunge, modifica o elimina una pianta, tutti gli altri utenti connessi al link vedono l'aggiornamento istantaneamente sullo schermo, senza dover ricaricare la pagina.
- Notifiche Toast visive per feedback immediato ad ogni operazione.

### 5. Condivisione Semplificata
- Pulsante **Condividi** integrato nella barra di navigazione con:
  - Generazione dinamica di **QR Code** da inquadrare con lo smartphone.
  - Pulsante con copia negli appunti con un click.

---

## 🛠️ Stack Tecnologico

- **Backend**: Node.js + Express.js
- **Database**: Store JSON persistente atomico con salvataggio sicuro su disco (`data/plants.json`).
- **Sincronizzazione**: Server-Sent Events (SSE) native `/api/events`.
- **Upload File**: Multer con supporto per immagini scattate da smartphone o caricate da PC.
- **Frontend**: HTML5 semantico, CSS3 moderno (palette naturale verde/crema/terracotta), JavaScript vanilla asincrono senza framework pesanti (velocissimo su qualsiasi dispositivo).
- **Tunneling & Deploy**: Cloudflare Tunnel (`cloudflared`) su protocollo QUIC sicuro HTTPS.

---

## 📦 Struttura File

```
PIANTE APP/
├── data/
│   └── plants.json         # Database JSON persistente
├── public/
│   ├── index.html          # Interfaccia grafica completa
│   ├── style.css           # Tema cromatico naturale e responsive
│   ├── app.js              # Logica frontend, CRUD e SSE
│   └── uploads/            # Cartella immagini e foto precaricate
├── server.js               # Server Node.js con API REST e SSE
├── package.json            # Dipendenze (express, cors, multer)
├── cloudflared.exe         # Binario Cloudflare Tunnel per accesso online
├── start.bat               # Script di avvio rapido con doppio click
└── README.md               # Documentazione
```

---

## 💻 Come avviare localmente in futuro

Per riavviare l'app in qualsiasi momento sul computer:
1. Fai doppio click su `start.bat`
2. Oppure apri il terminale e digita:
   ```powershell
   node server.js
   .\cloudflared.exe tunnel --url http://localhost:3000
   ```
