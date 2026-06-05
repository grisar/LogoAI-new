import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { prisma } from '../services/prisma.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        logos: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    const total = await prisma.project.count({
      where: { userId: req.user.userId }
    });

    const result = projects.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      isFavorite: p.isFavorite,
      thumbnailUrl: p.thumbnailUrl || p.logos[0]?.thumbnailUrl,
      bg: '#f4f4f6',
      svg: '<svg viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="30" stroke="#C68DFF" stroke-width="3"/><text x="40" y="48" text-anchor="middle" font-size="20" fill="#C68DFF" font-weight="700">L</text></svg>',
      date: p.createdAt.toLocaleDateString('ru-RU')
    }));

    res.json({ projects: result, total });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = await prisma.project.create({
      data: {
        userId: req.user.userId,
        name
      }
    });

    res.status(201).json({ project });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isFavorite } = req.body;

    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.userId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { name, isFavorite }
    });

    res.json({ project: updated });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findFirst({
      where: { id, userId: req.user.userId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await prisma.project.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;