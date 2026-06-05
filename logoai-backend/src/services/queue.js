import Queue from 'bull';
import { prisma } from './prisma.js';
import { CloudflareService } from './cloudflare.js';
import { StorageService } from './storage.js';

export const generationQueue = new Queue('logo-generation', process.env.REDIS_URL || 'redis://localhost:6379', {
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

const cloudflare = new CloudflareService();
const storage = new StorageService();

generationQueue.process('*', async (job) => {
  console.log(`Processing job ${job.id} with name ${job.name}`);

  const { userId, projectId, params } = job.data;

  try {
    console.log(`[Job ${job.id}] Starting generation for user ${userId}, project ${projectId}`);
    job.progress(10);

    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: 'processing', progress: 20 }
    });
    console.log(`[Job ${job.id}] Updated job status to processing`);

    job.progress(30);
    console.log(`[Job ${job.id}] Calling Cloudflare API with params:`, JSON.stringify(params));

    const variations = await cloudflare.generateVariations(params, 4);
    console.log(`[Job ${job.id}] Got ${variations.length} variations from Cloudflare`);

    job.progress(60);

    const generatedLogos = [];
    const resultLogoIds = [];

    for (let i = 0; i < variations.length; i++) {
      const result = variations[i];

      if (result.success) {
        console.log(`[Job ${job.id}] Processing variation ${i + 1}`);
        const filename = await storage.generateFilename(`logo_${userId}_${projectId}_${i}`);
        console.log(`[Job ${job.id}] Generated filename: ${filename}`);
        
        const thumbnailUrl = await storage.saveBase64Image(result.data, filename);
        console.log(`[Job ${job.id}] Saved image to: ${thumbnailUrl}`);

        const logo = await prisma.logo.create({
          data: {
            projectId,
            userId,
            thumbnailUrl,
            bgColor: '#ffffff',
            brandName: params.brandName || 'Logo',
            style: params.style || 'minimal',
            industry: params.industry || 'general',
            isPublic: false,
            generationParams: params
          }
        });
        console.log(`[Job ${job.id}] Created logo: ${logo.id}`);

        generatedLogos.push({
          id: logo.id,
          thumbnailUrl: logo.thumbnailUrl,
          svgUrl: logo.thumbnailUrl,
          bgColor: logo.bgColor,
          brandName: logo.brandName
        });

        resultLogoIds.push(logo.id);
      } else {
        console.log(`[Job ${job.id}] Variation ${i + 1} failed:`, result.error);
      }
    }

    job.progress(90);
    console.log(`[Job ${job.id}] Created ${generatedLogos.length} logos`);

    const completedAt = new Date();

    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: 'done',
        progress: 100,
        resultLogoIds,
        completedAt
      }
    });
    console.log(`[Job ${job.id}] Updated job status to done`);

    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'done', thumbnailUrl: generatedLogos[0]?.thumbnailUrl }
    });
    console.log(`[Job ${job.id}] Updated project status`);

    await prisma.user.update({
      where: { id: userId },
      data: { generationsUsed: { increment: 1 } }
    });
    console.log(`[Job ${job.id}] Incremented user generation count`);

    job.progress(100);

    console.log(`Job ${job.id} completed successfully`);
    return { logos: generatedLogos };
  } catch (error) {
    console.error(`[Job ${job.id}] Generation job error:`, error);

    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        errorMessage: error.message
      }
    });

    throw error;
  }
});

generationQueue.on('completed', (job) => {
  console.log(`Generation job ${job.id} completed`);
});

generationQueue.on('failed', (job, err) => {
  console.error(`Generation job ${job?.id} failed:`, err.message);
});

generationQueue.on('error', (error) => {
  console.error('Queue error:', error);
});

console.log('Logo generation queue initialized with processor');