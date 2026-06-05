import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.js';
import { prisma } from '../services/prisma.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: { id: true, name: true, email: true, plan: true, generationsUsed: true, createdAt: true }
    });

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: { ...user, genLimit: getGenerationLimit(user.plan) }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    console.log('[LOGIN] body:', JSON.stringify(req.body));
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        generationsUsed: user.generationsUsed,
        genLimit: getGenerationLimit(user.plan)
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', authMiddleware, async (req, res) => {
  res.json({ success: true });
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