import { Router } from 'express';
import prisma from '../db';

const router = Router();

// GET /api/pharmacies - List all pharmacies in the network
router.get('/', async (req, res) => {
  try {
    const pharmacies = await prisma.pharmacy.findMany({
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
    return res.json(pharmacies);
  } catch (error) {
    console.error('Error fetching pharmacies:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
