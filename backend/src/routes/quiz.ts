import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get all quizzes for the logged-in host
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const hostId = req.user?.id;
    if (!hostId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const quizzes = await prisma.quiz.findMany({
      where: { hostId },
      include: {
        questions: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, quizzes });
  } catch (error) {
    console.error('Fetch Quizzes Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get a specific quiz
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const hostId = req.user?.id;
    const { id } = req.params;

    const quiz = await prisma.quiz.findFirst({
      where: { id, hostId },
      include: { questions: true }
    });

    if (!quiz) return res.status(404).json({ success: false, error: 'Quiz not found' });

    res.json({ success: true, quiz });
  } catch (error) {
    console.error('Fetch Quiz Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create a new quiz
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const hostId = req.user?.id;
    if (!hostId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { title, questions } = req.body;

    if (!title || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ success: false, error: 'Title and questions array are required' });
    }

    const quiz = await prisma.quiz.create({
      data: {
        title,
        hostId,
        questions: {
          create: questions.map((q: any) => ({
            text: q.questionText || q.text,
            imageUrl: q.imageUrl || null,
            options: q.options || [],
            correctOption: q.correctOptionIndex !== undefined ? q.correctOptionIndex : q.correctOption || 0,
            type: q.type || 'MULTIPLE_CHOICE',
            correctText: q.correctText || null
          }))
        }
      },
      include: { questions: true }
    });

    res.status(201).json({ success: true, quiz });
  } catch (error) {
    console.error('Create Quiz Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update an existing quiz
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const hostId = req.user?.id;
    const { id } = req.params;
    const { title, questions } = req.body;

    if (!hostId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // Ensure they own it
    const existing = await prisma.quiz.findFirst({ where: { id, hostId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Quiz not found' });

    // To update correctly, it's often easiest to delete existing questions and recreate them
    await prisma.$transaction([
      prisma.question.deleteMany({ where: { quizId: id } }),
      prisma.quiz.update({
        where: { id },
        data: {
          title,
          questions: {
            create: questions.map((q: any) => ({
              text: q.questionText || q.text,
              imageUrl: q.imageUrl || null,
              options: q.options || [],
              correctOption: q.correctOptionIndex !== undefined ? q.correctOptionIndex : q.correctOption || 0,
              type: q.type || 'MULTIPLE_CHOICE',
              correctText: q.correctText || null
            }))
          }
        }
      })
    ]);

    const updatedQuiz = await prisma.quiz.findUnique({
      where: { id },
      include: { questions: true }
    });

    res.json({ success: true, quiz: updatedQuiz });
  } catch (error) {
    console.error('Update Quiz Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Add a quiz result (no auth needed for students)
router.post('/:id/results', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { playerName, score } = req.body;

    if (!playerName || typeof score !== 'number') {
      return res.status(400).json({ success: false, error: 'Player name and score are required' });
    }

    const result = await prisma.quizResult.create({
      data: {
        quizId: id,
        playerName,
        score
      }
    });

    // Try to find if this playerName matches a registered STUDENT
    const user = await prisma.user.findUnique({
      where: { username: playerName }
    });

    if (user && user.role === 'STUDENT') {
      // Update score
      await prisma.user.update({
        where: { id: user.id },
        data: {
          totalScore: { increment: score }
        }
      });
    }

    res.status(201).json({ success: true, result });
  } catch (error) {
    console.error('Submit Quiz Result Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get quiz results for host dashboard
router.get('/:id/results', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const hostId = req.user?.id;
    const { id } = req.params;

    if (!hostId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const quiz = await prisma.quiz.findFirst({ where: { id, hostId } });
    if (!quiz) return res.status(404).json({ success: false, error: 'Quiz not found' });

    const results = await prisma.quizResult.findMany({
      where: { quizId: id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, results });
  } catch (error) {
    console.error('Fetch Quiz Results Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
