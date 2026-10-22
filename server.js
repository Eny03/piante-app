const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Load environment variables from .env if present
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// Directories
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'plants.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Multer storage for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueName = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo i file immagine sono ammessi'));
    }
  }
});

// Helper for atomic file persistence
function readPlants() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Errore lettura plants.json:', err);
    return [];
  }
}

function writePlants(plants) {
  try {
    const tmpFile = `${DATA_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(plants, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DATA_FILE);
    return true;
  } catch (err) {
    console.error('Errore scrittura plants.json:', err);
    return false;
  }
}

// SSE (Server-Sent Events) clients for real-time synchronization
const sseClients = new Set();

function broadcastEvent(type, payload) {
  const data = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  for (const client of sseClients) {
    try {
      client.write(`event: botanical-update\ndata: ${data}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// Real-time SSE endpoint
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write(': connected\n\n');

  sseClients.add(res);

  // Keep-alive heartbeat
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// API Routes

// GET /api/plants - Lista di tutte le piante
app.get('/api/plants', (req, res) => {
  const plants = readPlants();
  res.json(plants);
});

// GET /api/plants/:id - Dettaglio singola pianta
app.get('/api/plants/:id', (req, res) => {
  const plants = readPlants();
  const plant = plants.find(p => p.id === req.params.id);
  if (!plant) {
    return res.status(404).json({ error: 'Pianta non trovata' });
  }
  res.json(plant);
});

// POST /api/plants - Aggiunta nuova pianta
app.post('/api/plants', (req, res) => {
  const { name, ph, temperature, humidity, scientificName, sunlight, notes, imageUrl } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Il nome della pianta è obbligatorio' });
  }

  const plants = readPlants();
  const now = new Date().toISOString();
  const newPlant = {
    id: `pl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    ph: (ph || '').trim(),
    temperature: (temperature || '').trim(),
    humidity: (humidity || 'Media').trim(),
    scientificName: (scientificName || '').trim(),
    sunlight: (sunlight || '').trim(),
    notes: (notes || '').trim(),
    imageUrl: (imageUrl || '').trim(),
    createdAt: now,
    updatedAt: now
  };

  plants.unshift(newPlant); // aggiungi in cima
  writePlants(plants);

  // Notifica in tempo reale tutti i client connessi
  broadcastEvent('created', newPlant);

  res.status(201).json(newPlant);
});

// PUT /api/plants/:id - Modifica pianta esistente
app.put('/api/plants/:id', (req, res) => {
  const { id } = req.params;
  const { name, ph, temperature, humidity, scientificName, sunlight, notes, imageUrl } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Il nome della pianta è obbligatorio' });
  }

  const plants = readPlants();
  const index = plants.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Pianta non trovata' });
  }

  const existing = plants[index];
  const updatedPlant = {
    ...existing,
    name: name.trim(),
    ph: ph !== undefined ? ph.trim() : existing.ph,
    temperature: temperature !== undefined ? temperature.trim() : existing.temperature,
    humidity: humidity !== undefined ? humidity.trim() : existing.humidity,
    scientificName: scientificName !== undefined ? scientificName.trim() : existing.scientificName,
    sunlight: sunlight !== undefined ? sunlight.trim() : existing.sunlight,
    notes: notes !== undefined ? notes.trim() : existing.notes,
    imageUrl: imageUrl !== undefined ? imageUrl.trim() : existing.imageUrl,
    updatedAt: new Date().toISOString()
  };

  plants[index] = updatedPlant;
  writePlants(plants);

  // Notifica in tempo reale
  broadcastEvent('updated', updatedPlant);

  res.json(updatedPlant);
});

// DELETE /api/plants/:id - Eliminazione pianta
app.delete('/api/plants/:id', (req, res) => {
  const { id } = req.params;
  const plants = readPlants();
  const index = plants.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Pianta non trovata' });
  }

  const [deletedPlant] = plants.splice(index, 1);
  writePlants(plants);

  // Notifica in tempo reale
  broadcastEvent('deleted', { id, name: deletedPlant.name });

  res.json({ success: true, message: 'Pianta eliminata con successo', id });
});

// POST /api/upload - Caricamento foto
app.post('/api/upload', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nessun file caricato' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.filename });
});

// GET /api/preset-photos - Elenco foto disponibili nel database
app.get('/api/preset-photos', (req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const photos = files
      .filter(f => /\.(jpe?g|png|webp|gif)$/i.test(f))
      .map(f => `/uploads/${f}`);
    res.json(photos);
  } catch (e) {
    res.json([]);
  }
});

/* ==========================================================
   AI BOTANICAL VISION & IDENTIFICATION SYSTEM
   ========================================================== */

// Curated Botanical Knowledge Base
const BOTANICAL_KNOWLEDGE_BASE = [
  {
    keywords: ['monstera', 'deliciosa', 'costola', 'adamo'],
    name: 'Monstera (Costola d\'Adamo)',
    scientificName: 'Monstera deliciosa',
    ph: '5.5 - 6.5',
    temperature: '18°C - 27°C',
    humidity: '45% - 60%',
    sunlight: 'Luce indiretta luminosa',
    notes: 'Grandi foglie fenestrate. Annaffiare quando la parte superficiale del terriccio è asciutta.'
  },
  {
    keywords: ['aloe', 'aristata', 'aristaloe', 'piumosa'],
    name: 'Aloe piumosa',
    scientificName: 'Aristaloe aristata',
    ph: '6.0 - 6.8',
    temperature: '15°C - 28°C',
    humidity: '15% - 25%',
    sunlight: 'Luce solare luminosa',
    notes: 'Succulenta a rosetta con puntinature bianche. Terriccio minerale molto drenante, annaffiature rare.'
  },
  {
    keywords: ['agave', 'americana', 'potatorum', 'blu'],
    name: 'Agave blu ornamentale',
    scientificName: 'Agave americana',
    ph: '6.5 - 7.5',
    temperature: '16°C - 32°C',
    humidity: '10% - 20%',
    sunlight: 'Pieno sole',
    notes: 'Foglie carnose cerulee con spine apicali. Terreno roccioso, annaffiature minime.'
  },
  {
    keywords: ['victoriae', 'reginae', 'regina vittoria'],
    name: 'Agave Regina Vittoria',
    scientificName: 'Agave victoriae-reginae',
    ph: '6.5 - 7.5',
    temperature: '14°C - 28°C',
    humidity: '10% - 20%',
    sunlight: 'Pieno sole',
    notes: 'Splendida forma geometrica a rosetta con venature bianche. Crescita molto lenta.'
  },
  {
    keywords: ['tradescantia', 'sillamontana', 'misera pelosa'],
    name: 'Misera pelosa',
    scientificName: 'Tradescantia sillamontana',
    ph: '6.0 - 6.8',
    temperature: '18°C - 26°C',
    humidity: '20% - 30%',
    sunlight: 'Molta luce diffusa',
    notes: 'Foglie coperte da una fitta lanugine bianca protettiva. Non bagnare il fogliame.'
  },
  {
    keywords: ['callisia', 'repens', 'tartaruga'],
    name: 'Pianta tartaruga (Callisia)',
    scientificName: 'Callisia repens',
    ph: '6.0 - 6.5',
    temperature: '18°C - 24°C',
    humidity: '35% - 50%',
    sunlight: 'Luce brillante indiretta',
    notes: 'Foglioline dense violacee ricadenti. Mantenere terreno fresco ma non bagnato.'
  },
  {
    keywords: ['phalaenopsis', 'orchidea', 'orchidee'],
    name: 'Orchidea Phalaenopsis',
    scientificName: 'Phalaenopsis sp.',
    ph: '5.5 - 6.5',
    temperature: '18°C - 25°C',
    humidity: '50% - 65%',
    sunlight: 'Luce indiretta luminosa',
    notes: 'Epifita in corteccia (bark). Annaffiare per immersione quando le radici diventano argentee.'
  },
  {
    keywords: ['echinocactus', 'grusonii', 'cuscino', 'suocera'],
    name: 'Cuscino della suocera',
    scientificName: 'Echinocactus grusonii',
    ph: '6.0 - 7.0',
    temperature: '15°C - 32°C',
    humidity: '10% - 18%',
    sunlight: 'Pieno sole',
    notes: 'Cactus globoso a costolature con spine dorate. Sospendere irrigazioni nei mesi freddi.'
  },
  {
    keywords: ['parodia', 'notocactus', 'leninghausii', 'palla dorata'],
    name: 'Cactus palla dorata',
    scientificName: 'Parodia leninghausii',
    ph: '6.0 - 6.8',
    temperature: '16°C - 28°C',
    humidity: '12% - 22%',
    sunlight: 'Luce intensa / Mezz\'ombra',
    notes: 'Cactus con fitto mantello di setole dorate. Gradisce caldo asciutto.'
  },
  {
    keywords: ['bonsai', 'larix', 'larice', 'pseudolarix'],
    name: 'Bonsai boschetto di larici',
    scientificName: 'Pseudolarix amabilis',
    ph: '5.5 - 6.2',
    temperature: '10°C - 22°C',
    humidity: '40% - 55%',
    sunlight: 'Luce filtrata / Mezz\'ombra',
    notes: 'Boschetto su vassoio piano con muschio. Terriccio fresco e arieggiato.'
  },
  {
    keywords: ['sansevieria', 'laurentii', 'dracaena trifasciata'],
    name: 'Sansevieria \'Laurentii\'',
    scientificName: 'Dracaena trifasciata \'Laurentii\'',
    ph: '6.0 - 7.0',
    temperature: '16°C - 28°C',
    humidity: '15% - 25%',
    sunlight: 'Ombra luminosa o luce media',
    notes: 'Foglie erette a spada con margini gialli. Bagnare solo a terriccio completamente secco.'
  },
  {
    keywords: ['futura superba', 'sansevieria compatta'],
    name: 'Sansevieria \'Futura Superba\'',
    scientificName: 'Dracaena trifasciata \'Futura Superba\'',
    ph: '6.0 - 7.0',
    temperature: '16°C - 28°C',
    humidity: '15% - 25%',
    sunlight: 'Luce filtrata o penombra',
    notes: 'Rosetta compatta, ottima purificatrice dell\'aria. Resiste alla siccità.'
  },
  {
    keywords: ['pothos', 'epipremnum', 'aureum', 'scindapsus'],
    name: 'Pothos dorato',
    scientificName: 'Epipremnum aureum',
    ph: '6.0 - 6.5',
    temperature: '17°C - 26°C',
    humidity: '40% - 55%',
    sunlight: 'Luce indiretta luminosa',
    notes: 'Rampicante o ricadente vigorosa con screziature dorate. Facile da curare e propagare.'
  },
  {
    keywords: ['zamioculcas', 'zanzibar', 'padre pio'],
    name: 'Gemma di Zanzibar (Zamioculcas)',
    scientificName: 'Zamioculcas zamiifolia',
    ph: '6.0 - 7.0',
    temperature: '18°C - 26°C',
    humidity: '15% - 25%',
    sunlight: 'Mezz\'ombra o luce indiretta',
    notes: 'Fusti carnosi con riserva d\'acqua nei tuberi sotterranei. Non tollera i ristagni.'
  },
  {
    keywords: ['dracaena', 'compacta', 'deremensis'],
    name: 'Tronchetto compatto (Dracena)',
    scientificName: 'Dracaena fragrans \'Compacta\'',
    ph: '6.0 - 6.8',
    temperature: '17°C - 25°C',
    humidity: '30% - 45%',
    sunlight: 'Luce indiretta o penombra',
    notes: 'Rosetta fitta di foglie corte verde scuro ondulato. Evitare sole diretto e freddo.'
  },
  {
    keywords: ['sieboldii', 'hylotelephium', 'sedum', 'teresina'],
    name: 'Erba teresina (Sedum)',
    scientificName: 'Hylotelephium sieboldii',
    ph: '6.5 - 7.5',
    temperature: '12°C - 25°C',
    humidity: '15% - 25%',
    sunlight: 'Pieno sole o molta luce',
    notes: 'Fusti ricadenti con foglie tonde glauche sfumate di rosa in autunno.'
  },
  {
    keywords: ['beaucarnea', 'recurvata', 'mangiafumo', 'nolina'],
    name: 'Pianta mangiafumo (Nolina)',
    scientificName: 'Beaucarnea recurvata',
    ph: '6.0 - 7.0',
    temperature: '15°C - 26°C',
    humidity: '15% - 25%',
    sunlight: 'Molta luce / Sole parziale',
    notes: 'Tronco a zampa d\'elefante rigonfio alla base. Annaffiare molto raramente.'
  },
  {
    keywords: ['peperomia', 'argyreia', 'watermelon', 'anguria'],
    name: 'Peperomia anguria (Watermelon)',
    scientificName: 'Peperomia argyreia',
    ph: '6.0 - 6.6',
    temperature: '18°C - 24°C',
    humidity: '30% - 45%',
    sunlight: 'Luce indiretta moderata',
    notes: 'Foglie carnose peltate a strisce argentate e verdi con piccioli rossi.'
  },
  {
    keywords: ['ficus', 'lyrata', 'violino'],
    name: 'Ficus Lyrata (Foglia di Violino)',
    scientificName: 'Ficus lyrata',
    ph: '6.0 - 7.0',
    temperature: '18°C - 26°C',
    humidity: '35% - 50%',
    sunlight: 'Luce diffusa intensa',
    notes: 'Grandi foglie a forma di violino. Teme correnti d\'aria e sbalzi termici.'
  },
  {
    keywords: ['ficus', 'elastica', 'caucciù'],
    name: 'Ficus Elastica (Albero della gomma)',
    scientificName: 'Ficus elastica',
    ph: '6.0 - 6.8',
    temperature: '16°C - 26°C',
    humidity: '35% - 50%',
    sunlight: 'Luce brillante non diretta',
    notes: 'Foglie spesse e cerose. Pulire periodicamente la polvere dalle lamine.'
  },
  {
    keywords: ['spatifillo', 'spathiphyllum', 'pace'],
    name: 'Giglio della Pace (Spatifillo)',
    scientificName: 'Spathiphyllum wallisii',
    ph: '5.5 - 6.5',
    temperature: '18°C - 25°C',
    humidity: '50% - 65%',
    sunlight: 'Ombra luminosa',
    notes: 'Fiori a spata bianca candida. Abbassa le foglie quando ha bisogno d\'acqua.'
  },
  {
    keywords: ['calathea', 'orbifolia', 'maranta'],
    name: 'Calathea Orbifolia',
    scientificName: 'Goeppertia orbifolia',
    ph: '5.5 - 6.2',
    temperature: '18°C - 24°C',
    humidity: '50% - 65%',
    sunlight: 'Luce filtrata / Mezz\'ombra',
    notes: 'Foglie rigate argentee. Richiede elevata umidità ambientale e acqua non calcarea.'
  },
  {
    keywords: ['pilea', 'peperomioides', 'monete'],
    name: 'Pilea (Pianta delle monete)',
    scientificName: 'Pilea peperomioides',
    ph: '6.0 - 7.0',
    temperature: '15°C - 24°C',
    humidity: '30% - 45%',
    sunlight: 'Luce indiretta luminosa',
    notes: 'Foglie rotonde a piattino. Ruotare il vaso settimanalmente per crescita simmetrica.'
  },
  {
    keywords: ['crassula', 'ovata', 'giada'],
    name: 'Albero di Giada',
    scientificName: 'Crassula ovata',
    ph: '6.0 - 7.0',
    temperature: '15°C - 28°C',
    humidity: '15% - 25%',
    sunlight: 'Pieno sole o molta luce',
    notes: 'Succulenta a portamento arbustivo. Molto resistente e duratura.'
  }
];

const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY;

// Gemini Vision API Call
async function identifyWithGemini(imageBuffer, mimeType, apiKey) {
  const base64Data = imageBuffer.toString('base64');
  const candidateModels = [
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash'
  ];

  const prompt = `Sei un botanico ed agronomo professionista. Analizza l'immagine di questa pianta e riconoscila con precisione.
Restituisci ESCLUSIVAMENTE un JSON valido (senza testo descrittivo, senza markdown o delimitatori di codice) con questi campi:
{
  "name": "Nome comune in italiano (es. Monstera, Ficus, Sansevieria)",
  "scientificName": "Nome scientifico botanico (Genere e specie)",
  "ph": "intervallo numerico di pH ottimale pulito (es: 6.0 - 6.8)",
  "temperature": "intervallo temperatura ideale (es: 18°C - 24°C)",
  "humidity": "intervallo percentuale umidità ottimale del terreno per igrometro (es: 35% - 50% oppure 15% - 25%)",
  "sunlight": "Esposizione consigliata (scegli una tra: 'Luce indiretta luminosa', 'Pieno sole', 'Mezz\\'ombra', 'Ombra luminosa')",
  "notes": "Consigli pratici di coltivazione sintetici (terriccio, annaffiatura e drenaggio)"
}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType || 'image/jpeg',
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1
    }
  };

  let lastError = null;
  for (const model of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Model ${model} returned ${response.status}: ${errText}`);
        lastError = new Error(`Model ${model} error: ${errText}`);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (err) {
      console.warn(`Error calling ${model}:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('Nessun modello Gemini ha risposto');
}

// Built-in Knowledge & Image Hash Recognition Fallback
function identifyWithBotanicalEngine(filenameOrUrl, imageBuffer) {
  const currentPlants = readPlants();
  const lowerQuery = (filenameOrUrl || '').toLowerCase();

  // 1. Direct match with existing plant photos (e.g. plant_1.jpeg ... plant_22.jpeg)
  const plantNumMatch = lowerQuery.match(/plant_(\d+)/i);
  if (plantNumMatch) {
    const index = parseInt(plantNumMatch[1], 10) - 1;
    if (currentPlants[index]) {
      return { ...currentPlants[index] };
    }
  }

  // 2. MD5 / Buffer comparison against uploaded gallery photos
  if (imageBuffer) {
    const uploadedHash = crypto.createHash('md5').update(imageBuffer).digest('hex');
    for (const p of currentPlants) {
      if (p.imageUrl) {
        const localPath = path.join(__dirname, 'public', p.imageUrl.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
          const fileBuf = fs.readFileSync(localPath);
          const fileHash = crypto.createHash('md5').update(fileBuf).digest('hex');
          if (fileHash === uploadedHash) {
            return { ...p };
          }
        }
      }
    }
  }

  // 3. Keyword matching against botanical knowledge base
  for (const entry of BOTANICAL_KNOWLEDGE_BASE) {
    for (const kw of entry.keywords) {
      if (lowerQuery.includes(kw)) {
        return {
          name: entry.name,
          scientificName: entry.scientificName,
          ph: entry.ph,
          temperature: entry.temperature,
          humidity: entry.humidity,
          sunlight: entry.sunlight,
          notes: entry.notes
        };
      }
    }
  }

  // 4. Smart generic default when no key and no match
  return {
    name: '',
    scientificName: '',
    ph: '6.0 - 6.8',
    temperature: '18°C - 24°C',
    humidity: '35% - 50%',
    sunlight: 'Luce indiretta luminosa',
    notes: 'Terriccio drenante. Annaffiare quando i primi centimetri di suolo risultano asciutti al tatto.',
    isDefaultFallback: true
  };
}

// POST /api/ai-identify - Endpoint per il riconoscimento AI della foto
app.post('/api/ai-identify', upload.single('photo'), async (req, res) => {
  try {
    let imageBuffer = null;
    let mimeType = 'image/jpeg';
    let fileUrl = null;

    if (req.file) {
      imageBuffer = fs.readFileSync(req.file.path);
      mimeType = req.file.mimetype || 'image/jpeg';
      fileUrl = `/uploads/${req.file.filename}`;
    } else if (req.body.imageUrl) {
      fileUrl = req.body.imageUrl;
      const localPath = path.join(__dirname, 'public', fileUrl.replace(/^\//, ''));
      if (fs.existsSync(localPath)) {
        imageBuffer = fs.readFileSync(localPath);
      }
    }

    const userApiKey = req.headers['x-gemini-key'] || req.body.apiKey || DEFAULT_GEMINI_KEY;

    let result = null;
    let recognitionSource = 'botanical-engine';

    // Prova il riconoscimento con Gemini Vision se l'API key è disponibile
    if (userApiKey && imageBuffer) {
      try {
        result = await identifyWithGemini(imageBuffer, mimeType, userApiKey);
        recognitionSource = 'gemini-vision';
      } catch (geminiErr) {
        console.warn('Gemini API non disponibile, utilizzo motore botanico locale:', geminiErr.message);
      }
    }

    // Se non riconosciuta o senza chiave, usa il motore di conoscenza botanico
    if (!result) {
      const queryName = req.file ? req.file.originalname : (req.body.imageUrl || '');
      result = identifyWithBotanicalEngine(queryName, imageBuffer);
    }

    if (fileUrl) {
      result.imageUrl = fileUrl;
    }

    res.json({
      success: true,
      source: recognitionSource,
      plant: result
    });
  } catch (err) {
    console.error('Errore /api/ai-identify:', err);
    res.status(500).json({ error: 'Errore durante l\'analisi AI della pianta' });
  }
});

// Fallback index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Avvio server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌿 Botanical Database Server avviato su http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  server.close();
});
