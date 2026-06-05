#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/auth.js';

const prisma = new PrismaClient();

async function seed() {
  console.log('Starting database seed...');

  // Create test users
  const users = [
    {
      name: 'Тестовый Пользователь',
      email: 'test@example.com',
      passwordHash: await hashPassword('password123'),
      plan: 'free',
      generationsUsed: 1
    },
    {
      name: 'Алексей Иванов',
      email: 'alex@example.com',
      passwordHash: await hashPassword('password123'),
      plan: 'basic',
      generationsUsed: 15
    },
    {
      name: 'Мария Петрова',
      email: 'maria@example.com',
      passwordHash: await hashPassword('password123'),
      plan: 'pro',
      generationsUsed: 127
    }
  ];

  const createdUsers = [];
  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: userData
    });
    createdUsers.push(user);
    console.log(`✓ Created user: ${user.email} (${user.plan})`);
  }

  // Create projects
  const projectsData = [
    {
      userId: createdUsers[0].id,
      name: 'TechStartup',
      status: 'done',
      isFavorite: true,
      thumbnailUrl: '/uploads/logo_1.png'
    },
    {
      userId: createdUsers[0].id,
      name: 'Coffee Shop',
      status: 'draft',
      isFavorite: false
    },
    {
      userId: createdUsers[1].id,
      name: 'Fitness Pro',
      status: 'done',
      isFavorite: true,
      thumbnailUrl: '/uploads/logo_2.png'
    },
    {
      userId: createdUsers[2].id,
      name: 'Creative Studio',
      status: 'done',
      isFavorite: false,
      thumbnailUrl: '/uploads/logo_3.png'
    },
    {
      userId: createdUsers[2].id,
      name: 'Green Energy',
      status: 'done',
      isFavorite: true,
      thumbnailUrl: '/uploads/logo_4.png'
    }
  ];

  const createdProjects = [];
  for (const projectData of projectsData) {
    const project = await prisma.project.upsert({
      where: {
        id: projectData.id || 'temp-' + Math.random()
      },
      update: {},
      create: projectData
    });
    createdProjects.push(project);
    console.log(`✓ Created project: ${project.name} (${project.status})`);
  }

  // Create logos
  const logosData = [
    {
      projectId: createdProjects[0].id,
      userId: createdUsers[0].id,
      thumbnailUrl: '/uploads/logo_tech_1.png',
      bgColor: '#C68DFF',
      brandName: 'TechStartup',
      style: 'minimal',
      industry: 'technology',
      isPublic: true
    },
    {
      projectId: createdProjects[0].id,
      userId: createdUsers[0].id,
      thumbnailUrl: '/uploads/logo_tech_2.png',
      bgColor: '#CBE857',
      brandName: 'TechStartup',
      style: 'geometric',
      industry: 'technology',
      isPublic: true
    },
    {
      projectId: createdProjects[2].id,
      userId: createdUsers[1].id,
      thumbnailUrl: '/uploads/logo_fitness_1.png',
      bgColor: '#5BA84A',
      brandName: 'Fitness Pro',
      style: 'modern',
      industry: 'sports',
      isPublic: true
    },
    {
      projectId: createdProjects[3].id,
      userId: createdUsers[2].id,
      thumbnailUrl: '/uploads/logo_creative_1.png',
      bgColor: '#E25A6F',
      brandName: 'Creative Studio',
      style: 'handwritten',
      industry: 'design',
      isPublic: true
    },
    {
      projectId: createdProjects[4].id,
      userId: createdUsers[2].id,
      thumbnailUrl: '/uploads/logo_green_1.png',
      bgColor: '#323843',
      brandName: 'Green Energy',
      style: 'minimal',
      industry: 'energy',
      isPublic: true
    }
  ];

  const createdLogos = [];
  for (const logoData of logosData) {
    const logo = await prisma.logo.create({
      data: logoData
    });
    createdLogos.push(logo);
    console.log(`✓ Created logo: ${logo.brandName} (${logo.style})`);
  }

  // Create sample generation jobs
  const jobsData = [
    {
      userId: createdUsers[0].id,
      projectId: createdProjects[0].id,
      status: 'done',
      progress: 100,
      params: {
        brandName: 'TechStartup',
        industry: 'technology',
        style: 'minimal',
        colors: ['#C68DFF', '#323843'],
        font: 'modern',
        prompt: 'Tech startup logo, clean design'
      },
      completedAt: new Date()
    }
  ];

  for (const jobData of jobsData) {
    const job = await prisma.generationJob.create({
      data: {
        ...jobData,
        resultLogoIds: createdLogos.slice(0, 2).map(l => l.id)
      }
    });
    console.log(`✓ Created generation job: ${job.id} (${job.status})`);
  }

  console.log('\n✅ Database seeded successfully!');
  console.log('\nTest users:');
  console.log('  - test@example.com / password123 (Free)');
  console.log('  - alex@example.com / password123 (Basic)');
  console.log('  - maria@example.com / password123 (Pro)');
}

seed()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });