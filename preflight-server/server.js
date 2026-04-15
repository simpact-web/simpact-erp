/* ═══════════════════════════════════════════════════════════════
   SIMPACT PREFLIGHT SERVER v1.0
   Serveur Express + WebSocket pour l'analyse et correction de PDF
   Dépendances système : Ghostscript (gs) pour la rastérisation
   ═══════════════════════════════════════════════════════════════ */

const express      = require('express');
const multer       = require('multer');
const cors         = require('cors');
const { WebSocketServer } = require('ws');
const http         = require('http');
const path         = require('path');
const fs           = require('fs');
const { v4: uuid } = require('uuid');
const { PreflightEngine } = require('./lib/preflight-engine');

/* ── Config ──────────────────────────────────────────────────── */
const PORT     = process.env.PORT || 3200;
const JOBS_DIR = path.join(__dirname, 'jobs');

if (!fs.existsSync(JOBS_DIR)) fs.mkdirSync(JOBS_DIR, { recursive: true });

/* ── Express setup ───────────────────────────────────────────── */
const app    = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use('/jobs', express.static(JOBS_DIR));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Seuls les fichiers PDF sont acceptés.'));
  },
});

/* ── WebSocket for progress ──────────────────────────────────── */
const wss = new WebSocketServer({ server, path: '/ws' });
const wsClients = new Map(); // jobId → Set<ws>

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    try {
      const { type, jobId } = JSON.parse(msg);
      if (type === 'subscribe' && jobId) {
        if (!wsClients.has(jobId)) wsClients.set(jobId, new Set());
        wsClients.get(jobId).add(ws);
      }
    } catch { /* ignore malformed messages */ }
  });
  ws.on('close', () => {
    for (const [, subs] of wsClients) subs.delete(ws);
  });
});

function broadcast(jobId, payload) {
  const subs = wsClients.get(jobId);
  if (!subs) return;
  const msg = JSON.stringify(payload);
  for (const ws of subs) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

/* ── In-memory job store ─────────────────────────────────────── */
const jobs = new Map();

/* ── Routes ──────────────────────────────────────────────────── */

// POST /api/preflight — Lance un job d'analyse
app.post('/api/preflight', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier PDF requis.' });

  let jobSpec;
  try {
    jobSpec = JSON.parse(req.body.spec || '{}');
  } catch {
    return res.status(400).json({ error: 'Spec JSON invalide.' });
  }

  const jobId  = uuid();
  const jobDir = path.join(JOBS_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  // Sauvegarder le PDF original
  const originalPath = path.join(jobDir, 'original.pdf');
  fs.writeFileSync(originalPath, req.file.buffer);

  const job = {
    id: jobId,
    status: 'processing',
    createdAt: new Date().toISOString(),
    spec: jobSpec,
    report: null,
    error: null,
  };
  jobs.set(jobId, job);

  res.json({ jobId, status: 'processing' });

  // Traitement asynchrone
  processJob(jobId, req.file.buffer, jobSpec, jobDir).catch(err => {
    console.error(`Job ${jobId} failed:`, err);
    job.status = 'error';
    job.error = err.message;
    broadcast(jobId, { type: 'error', error: err.message });
  });
});

// GET /api/preflight/:jobId — Récupérer le résultat
app.get('/api/preflight/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job introuvable.' });
  res.json(job);
});

// GET /api/preflight/:jobId/corrected — Télécharger le PDF corrigé
app.get('/api/preflight/:jobId/corrected', (req, res) => {
  const jobDir = path.join(JOBS_DIR, req.params.jobId);
  const corrected = path.join(jobDir, 'corrected.pdf');
  if (!fs.existsSync(corrected)) {
    return res.status(404).json({ error: 'PDF corrigé non disponible.' });
  }
  res.download(corrected, 'simpact-corrected.pdf');
});

/* ── Traitement principal ────────────────────────────────────── */

async function processJob(jobId, pdfBuffer, spec, jobDir) {
  const job    = jobs.get(jobId);
  const engine = new PreflightEngine();

  const progress = (step, pct, detail) => {
    broadcast(jobId, { type: 'progress', step, pct, detail });
  };

  try {
    progress('init', 5, 'Chargement du PDF…');

    const result = await engine.run(pdfBuffer, spec, {
      jobDir,
      onProgress: progress,
    });

    // Sauvegarder le PDF corrigé
    fs.writeFileSync(path.join(jobDir, 'corrected.pdf'), result.correctedPdf);

    // Construire les URLs de preview
    const previews = result.previews.map((p, i) => ({
      page: i + 1,
      url: `/jobs/${jobId}/preview_${i + 1}.png`,
      width: p.width,
      height: p.height,
    }));

    job.status = result.report.hasBlockingErrors ? 'errors' :
                 result.report.hasWarnings ? 'warnings' : 'ok';
    job.report = { ...result.report, previews };

    progress('done', 100, 'Preflight terminé.');
    broadcast(jobId, { type: 'complete', job });

  } catch (err) {
    job.status = 'error';
    job.error  = err.message;
    broadcast(jobId, { type: 'error', error: err.message });
    throw err;
  }
}

/* ── Démarrage ───────────────────────────────────────────────── */
server.listen(PORT, () => {
  console.log(`\n  🔍 SIMPACT Preflight Server`);
  console.log(`     API  : http://localhost:${PORT}/api/preflight`);
  console.log(`     WS   : ws://localhost:${PORT}/ws`);
  console.log(`     Jobs : ${JOBS_DIR}\n`);
});
