import { Router } from 'express';
import { spawn } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import config from '../config.js';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

// Upload staging area — files land here before being moved to OneDrive
const uploadDir = join(__dirname, '..', '..', 'uploads', 'genealogy');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    cb(null, `${timestamp}_${file.originalname}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Pipeline run log (in-memory, last 20 runs)
const runLog = [];

// POST upload document for extraction
router.post('/upload', upload.single('document'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({
    ok: true,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    path: req.file.path,
    message: 'File uploaded. Open Claude Projects > Genealogy Document Extractions to run extraction.',
  });
});

// POST trigger PowerShell processing script
router.post('/run', async (req, res) => {
  const { jsonFile } = req.body;
  if (!jsonFile) return res.status(400).json({ error: 'jsonFile path required' });

  const runEntry = {
    id: Date.now(),
    startedAt: new Date().toISOString(),
    jsonFile,
    status: 'running',
    output: [],
    error: null,
    finishedAt: null,
  };
  runLog.unshift(runEntry);
  if (runLog.length > 20) runLog.pop();

  res.json({ ok: true, runId: runEntry.id, message: 'Pipeline started' });

  // Shell out to PowerShell
  const ps = spawn('powershell.exe', [
    '-ExecutionPolicy', 'Bypass',
    '-File', config.genealogy.scriptPath,
    '-JsonFile', jsonFile,
  ]);

  ps.stdout.on('data', (data) => {
    runEntry.output.push(data.toString());
  });
  ps.stderr.on('data', (data) => {
    runEntry.output.push(`[ERR] ${data.toString()}`);
  });
  ps.on('close', (code) => {
    runEntry.status = code === 0 ? 'success' : 'error';
    runEntry.finishedAt = new Date().toISOString();
    if (code !== 0) runEntry.error = `Exit code ${code}`;
  });
});

// GET pipeline run log
router.get('/log', (_req, res) => {
  res.json(runLog);
});

// GET single run status (poll this from UI)
router.get('/log/:runId', (req, res) => {
  const entry = runLog.find(r => r.id === parseInt(req.params.runId));
  if (!entry) return res.status(404).json({ error: 'Run not found' });
  res.json(entry);
});

export default router;
