import { Router } from 'express';
import fetch from 'node-fetch';
import config from '../config.js';

const router = Router();
const BASE = `https://api.airtable.com/v0/${config.airtable.baseId}`;
const HEADERS = {
  'Authorization': `Bearer ${config.airtable.pat}`,
  'Content-Type': 'application/json',
};

router.get('/:table', async (req, res) => {
  try {
    const tableId = config.airtable.tables[req.params.table];
    if (!tableId) return res.status(404).json({ error: `Unknown table: ${req.params.table}` });

    const { filterByFormula, ...rest } = req.query;
    let url = `${BASE}/${tableId}`;
    const params = new URLSearchParams(rest);
    const paramStr = params.toString();
    if (paramStr) url += `?${paramStr}`;
    if (filterByFormula) url += `${paramStr ? '&' : '?'}filterByFormula=${filterByFormula}`;

    console.log('Airtable URL:', url);

    const response = await fetch(url, { headers: HEADERS });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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