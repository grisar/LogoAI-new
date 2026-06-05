import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { prisma } from '../services/prisma.js';

const router = express.Router();

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        generationsUsed: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const genLimit = getGenerationLimit(user.plan);

    res.json({
      ...user,
      genLimit
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: { name },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        generationsUsed: true,
        createdAt: true
      }
    });

    res.json({ user: { ...user, genLimit: getGenerationLimit(user.plan) } });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.get('/subscription', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        plan: true,
        generationsUsed: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const genLimit = getGenerationLimit(user.plan);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const totalProjects = await prisma.project.count({
      where: { userId: req.user.userId }
    });

    res.json({
      plan: user.plan,
      generationsUsed: user.generationsUsed,
      generationsLimit: genLimit,
      renewsAt: tomorrow,
      totalProjects
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

function getGenerationLimit(plan) {
  const limits = {
    free: parseInt(process.env.RATE_LIMIT_FREE) || 3,
    basic: parseInt(process.env.RATE_LIMIT_BASIC) || 30,
    pro: parseInt(process.env.RATE_LIMIT_PRO) || 999999
  };
  return limits[plan] || limits.free;
}

export default router;