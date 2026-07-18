import { Router } from 'express';
import fetch from 'node-fetch';
import config from '../config.js';

const router = Router();
const BASE = `https://api.airtable.com/v0/${config.airtable.baseId}`;
const HEADERS = {
  'Authorization': `Bearer ${config.airtable.pat}`,
  'Content-Type': 'application/json',
};

// Generic GET — /api/airtable/:table?filterByFormula=...&maxRecords=...&sort[0][field]=...
router.get('/:table', async (req, res) => {
  try {
    const tableId = config.airtable.tables[req.params.table];
    if (!tableId) return res.status(404).json({ error: `Unknown table: ${req.params.table}` });

    const params = new URLSearchParams(req.query);
    const url = `${BASE}/${tableId}?${params}`;
    const response = await fetch(url, { headers: HEADERS });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generic POST — create record
router.post('/:table', async (req, res) => {
  try {
    const tableId = config.airtable.tables[req.params.table];
    if (!tableId) return res.status(404).json({ error: `Unknown table: ${req.params.table}` });

    const response = await fetch(`${BASE}/${tableId}`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ fields: req.body, typecast: true }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generic PATCH — update record
router.patch('/:table/:recordId', async (req, res) => {
  try {
    const tableId = config.airtable.tables[req.params.table];
    if (!tableId) return res.status(404).json({ error: `Unknown table: ${req.params.table}` });

    const response = await fetch(`${BASE}/${tableId}/${req.params.recordId}`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify({ fields: req.body, typecast: true }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generic DELETE
router.delete('/:table/:recordId', async (req, res) => {
  try {
    const tableId = config.airtable.tables[req.params.table];
    if (!tableId) return res.status(404).json({ error: `Unknown table: ${req.params.table}` });

    const response = await fetch(`${BASE}/${tableId}/${req.params.recordId}`, {
      method: 'DELETE',
      headers: HEADERS,
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
