import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { prisma } from '../services/prisma.js';

const router = express.Router();

const exportSchema = {
  format: ['png', 'jpg', 'pdf'],
  size: ['512', '1024', '2048'],
  colorMode: ['color', 'mono', 'white']
};

router.post('/:logoId', authMiddleware, async (req, res) => {
  try {
    const { logoId } = req.params;
    const { format = 'png', size = '1024', colorMode = 'color' } = req.body;

    if (!exportSchema.format.includes(format)) {
      return res.status(400).json({ error: 'Invalid format' });
    }

    if (!exportSchema.size.includes(size)) {
      return res.status(400).json({ error: 'Invalid size' });
    }

    if (!exportSchema.colorMode.includes(colorMode)) {
      return res.status(400).json({ error: 'Invalid color mode' });
    }

    const logo = await prisma.logo.findUnique({
      where: { id: logoId }
    });

    if (!logo) {
      return res.status(404).json({ error: 'Logo not found' });
    }

    if (logo.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const downloadUrl = `${process.env.API_BASE || 'http://localhost:3000/api'}/export/download/${logoId}.${format}?size=${size}&colorMode=${colorMode}`;

    res.json({ downloadUrl });
  } catch (error) {
    console.error('Export logo error:', error);
    res.status(500).json({ error: 'Failed to export logo' });
  }
});

export default router;