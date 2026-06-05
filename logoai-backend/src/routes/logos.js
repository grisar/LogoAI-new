import express from 'express';
import Joi from 'joi';
import { authMiddleware, checkPlanRateLimit } from '../middleware/auth.js';
import { prisma } from '../services/prisma.js';
import { generationQueue } from '../services/queue.js';

const router = express.Router();

const generateSchema = Joi.object({
  projectId: Joi.string().uuid().optional(),
  brandName: Joi.string().required(),
  industry: Joi.string().required(),
  style: Joi.string().required(),
  colors: Joi.array().items(Joi.string()).min(1).required(),
  font: Joi.string().default('modern'),
  prompt: Joi.string().allow('').optional()
});

router.get('/public', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const logos = await prisma.logo.findMany({
      where: { isPublic: true },
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' }
    });

    const result = logos.map(l => ({
      id: l.id,
      thumbnailUrl: l.thumbnailUrl,
      brandName: l.brandName,
      style: l.style
    }));

    res.json({ logos: result });
  } catch (error) {
    console.error('Get public logos error:', error);
    res.status(500).json({ error: 'Failed to fetch public logos' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const logo = await prisma.logo.findUnique({
      where: { id }
    });

    if (!logo) {
      return res.status(404).json({ error: 'Logo not found' });
    }

    res.json({ logo });
  } catch (error) {
    console.error('Get logo error:', error);
    res.status(500).json({ error: 'Failed to fetch logo' });
  }
});

router.post('/generate', authMiddleware, checkPlanRateLimit, async (req, res) => {
  try {
    const { error, value } = generateSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    let projectId = value.projectId;

    if (!projectId) {
      const project = await prisma.project.create({
        data: {
          userId: req.user.userId,
          name: value.brandName
        }
      });
      projectId = project.id;
    } else {
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: req.user.userId }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    const job = await prisma.generationJob.create({
      data: {
        userId: req.user.userId,
        projectId,
        status: 'pending',
        progress: 0,
        params: value,
        resultLogoIds: []
      }
    });

    await generationQueue.add('generate-logo', {
      userId: req.user.userId,
      projectId,
      params: value
    }, {
      jobId: job.id
    });

    res.status(201).json({ jobId: job.id });
  } catch (error) {
    console.error('Generate logo error:', error);
    res.status(500).json({ error: 'Failed to start generation' });
  }
});

router.get('/generate/:jobId/status', authMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.generationJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let logos = [];

    if (job.status === 'done' && job.resultLogoIds && job.resultLogoIds.length > 0) {
      const logosData = await prisma.logo.findMany({
        where: {
          id: { in: job.resultLogoIds }
        },
        select: {
          id: true,
          thumbnailUrl: true,
          bgColor: true,
          brandName: true
        }
      });

      logos = logosData.map(l => ({
        id: l.id,
        thumbnailUrl: l.thumbnailUrl,
        svgUrl: l.thumbnailUrl,
        bgColor: l.bgColor,
        brandName: l.brandName
      }));
    }

    res.json({
      status: job.status,
      progress: job.progress,
      logos,
      errorMessage: job.errorMessage
    });
  } catch (error) {
    console.error('Get job status error:', error);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

export default router;