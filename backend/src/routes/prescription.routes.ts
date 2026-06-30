import { Router, Response } from 'express';
import prisma from '../db';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// POST /api/prescriptions/upload - Customer uploads a prescription
router.post('/upload', authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { imageUrl, notes } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ message: 'Prescription image URL/data is required' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const prescription = await prisma.prescription.create({
      data: {
        userId: req.user.id,
        imageUrl,
        status: 'PENDING',
        notes: notes || '',
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return res.status(201).json(prescription);
  } catch (error) {
    console.error('Error uploading prescription:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/prescriptions - List prescriptions based on role
router.get('/', authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let prescriptions;

    if (req.user.role === 'CUSTOMER') {
      // Customers only see their own prescriptions
      prescriptions = await prisma.prescription.findMany({
        where: { userId: req.user.id },
        include: {
          validatedBy: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else if (req.user.role === 'PHARMACIST' || req.user.role === 'ADMIN') {
      // Pharmacists and Admins see all prescriptions
      prescriptions = await prisma.prescription.findMany({
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
          validatedBy: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [
          // Pending ones first, then by date
          { status: 'asc' }, // 'APPROVED', 'PENDING', 'REJECTED' (in SQLite alphabetical order, PENDING is in the middle, but we can sort in memory or do dual sort)
          { createdAt: 'desc' },
        ],
      });
      
      // Let's sort manually so PENDING is strictly first
      prescriptions.sort((a, b) => {
        if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
        if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else {
      return res.status(403).json({ message: 'Access forbidden' });
    }

    return res.json(prescriptions);
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/prescriptions/:id - Single details
router.get('/:id', authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid prescription ID' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        validatedBy: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Access control: customer can only view their own
    if (req.user.role === 'CUSTOMER' && prescription.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access forbidden: Not your prescription' });
    }

    return res.json(prescription);
  } catch (error) {
    console.error('Error fetching prescription:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/prescriptions/:id/validate - Pharmacist validates prescription (Approve/Reject)
router.post('/:id/validate', authenticateToken as any, requireRoles(['PHARMACIST', 'ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, notes } = req.body; // status: APPROVED or REJECTED

    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid prescription ID' });
    }

    if (!status || !['APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
      return res.status(400).json({ message: 'Status must be APPROVED or REJECTED' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const prescription = await prisma.prescription.findUnique({
      where: { id },
    });

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    const updatedPrescription = await prisma.prescription.update({
      where: { id },
      data: {
        status: status.toUpperCase(),
        notes: notes || undefined,
        validatedById: req.user.id,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        validatedBy: {
          select: {
            name: true,
          },
        },
      },
    });

    return res.json({
      message: `Prescription successfully ${status.toLowerCase()}`,
      prescription: updatedPrescription,
    });
  } catch (error) {
    console.error('Error validating prescription:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
