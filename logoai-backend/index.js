import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './src/routes/auth.js';
import userRoutes from './src/routes/user.js';
import projectRoutes from './src/routes/projects.js';
import logoRoutes from './src/routes/logos.js';
import exportRoutes from './src/routes/export.js';

dotenv.config();

import './src/services/queue.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
  if (req.path.includes('/auth/')) {
    console.log(`[AUTH] ${req.method} ${req.path} headers=${JSON.stringify(req.headers.authorization || 'none')}`);
  }
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/logos', logoRoutes);
app.use('/api/export', exportRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
  console.log(`LogoAI backend running on http://${process.env.HOST || '0.0.0.0'}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});