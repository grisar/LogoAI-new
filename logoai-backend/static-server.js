#!/usr/bin/env node

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.FRONTEND_PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

import http from 'http';

const API_PORT = process.env.API_PORT || 3000;

app.use('/api', (req, res) => {
  const proxy = http.request(
    {
      hostname: '127.0.0.1',
      port: API_PORT,
      path: '/api' + req.url,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${API_PORT}` }
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  req.pipe(proxy);
  proxy.on('error', (e) => {
    console.error('Proxy error:', e.message);
    res.status(502).json({ error: 'Backend unavailable' });
  });
});

app.use(express.static(path.join(__dirname, '..')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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