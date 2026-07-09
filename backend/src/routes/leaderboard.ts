import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get top 100 students
router.get('/', async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      orderBy: { totalScore: 'desc' },
      take: 100,
      select: {
        username: true,
        totalScore: true,
        badges: true
      }
    });
    res.json({ success: true, leaderboard: students });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

export default router;
