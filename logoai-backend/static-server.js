#!/usr/bin/env node

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.FRONTEND_PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'logoai-frontend.html'));
});

app.get('/welcome', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'welcome.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'frontend' });
});

app.listen(PORT, HOST, () => {
  console.log(`LogoAI frontend running on http://${HOST}:${PORT}`);
});