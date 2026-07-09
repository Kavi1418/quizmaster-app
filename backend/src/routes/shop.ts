import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get shop data for current user (coins and unlocked items)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true, unlockedItems: true }
    });

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    res.json({ success: true, coins: user.coins, unlockedItems: user.unlockedItems });
  } catch (error) {
    console.error('Shop Get Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Buy an item
router.post('/buy', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { itemId, cost } = req.body;
    if (!itemId || typeof cost !== 'number') {
      return res.status(400).json({ success: false, error: 'Item ID and cost are required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    if (user.coins < cost) {
      return res.status(400).json({ success: false, error: 'Not enough coins' });
    }

    if (user.unlockedItems.includes(itemId)) {
      return res.status(400).json({ success: false, error: 'Item already unlocked' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        coins: { decrement: cost },
        unlockedItems: { push: itemId }
      },
      select: { coins: true, unlockedItems: true }
    });

    res.json({ success: true, coins: updatedUser.coins, unlockedItems: updatedUser.unlockedItems });
  } catch (error) {
    console.error('Shop Buy Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
