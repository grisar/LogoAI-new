import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const rateLimitMiddleware = (generationsPerDay) => {
  return async (req, res, next) => {
    try {
      const { prisma } = await import('../services/prisma.js');
      const userId = req.user.userId;

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const generationsToday = await prisma.generationJob.count({
        where: {
          userId,
          status: 'done',
          createdAt: { gte: today }
        }
      });

      if (generationsToday >= generationsPerDay) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `You have reached your daily limit of ${generationsPerDay} generations`,
          limit: generationsPerDay,
          used: generationsToday
        });
      }

      next();
    } catch (error) {
      console.error('Rate limit error:', error);
      next();
    }
  };
};

export const checkPlanRateLimit = async (req, res, next) => {
  try {
    const { prisma } = await import('../services/prisma.js');
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const limits = {
      free: parseInt(process.env.RATE_LIMIT_FREE) || 3,
      basic: parseInt(process.env.RATE_LIMIT_BASIC) || 30,
      pro: parseInt(process.env.RATE_LIMIT_PRO) || 999999
    };

    const limit = limits[user.plan] || limits.free;
    const middleware = rateLimitMiddleware(limit);
    middleware(req, res, next);
  } catch (error) {
    console.error('Plan rate limit error:', error);
    next();
  }
};