import { Router, Response } from 'express';
import prisma from '../db';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// POST /api/orders/checkout - Process cart, check stock, verify prescriptions, process payment
router.post('/checkout', authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { items, prescriptionId, shippingAddress } = req.body; // items: [{ productId: number, quantity: number }]
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Cart items are required' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const customerId = req.user.id;

    // 1. Fetch products & validate
    const productIds = items.map((i) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { pharmacy: true },
    });

    if (dbProducts.length !== productIds.length) {
      return res.status(400).json({ message: 'One or more products in your cart do not exist' });
    }

    // Map items for easy lookup
    const itemsMap = new Map<number, number>();
    items.forEach((item) => itemsMap.set(item.productId, item.quantity));

    // Validations: Stock, Prescription, Expiration
    let prescriptionRequired = false;
    let totalPrice = 0;
    const pharmacyIds = new Set<number>();
    const now = new Date();

    for (const prod of dbProducts) {
      const quantity = itemsMap.get(prod.id) || 0;

      // Real-time stock verification
      if (prod.stockQuantity < quantity) {
        return res.status(400).json({
          message: `Insufficient stock for product: ${prod.name}. Available: ${prod.stockQuantity}, Requested: ${quantity}`,
        });
      }

      // Block purchase of expired drugs
      if (prod.expirationDate < now) {
        return res.status(400).json({
          message: `Product ${prod.name} has expired (Expiration: ${prod.expirationDate.toLocaleDateString()}) and cannot be purchased.`,
        });
      }

      if (prod.requiresPrescription) {
        prescriptionRequired = true;
      }

      totalPrice += prod.price * quantity;
      pharmacyIds.add(prod.pharmacyId);
    }

    // 2. Prescription verification
    let validatedPrescription = null;
    if (prescriptionRequired) {
      if (!prescriptionId) {
        return res.status(400).json({
          message: 'One or more items in your cart require a medical prescription. Please upload and select a prescription.',
        });
      }

      // Check prescription in database
      const prescription = await prisma.prescription.findUnique({
        where: { id: parseInt(String(prescriptionId), 10) },
      });

      if (!prescription || prescription.userId !== customerId) {
        return res.status(400).json({ message: 'Invalid prescription selected' });
      }

      if (prescription.status !== 'APPROVED') {
        return res.status(400).json({
          message: `The selected prescription is not approved yet. Current status: ${prescription.status}. Pharmacist approval is required.`,
        });
      }

      validatedPrescription = prescription;
    }

    // 3. Multi-vendor cart routing and delivery fee calculation
    // Base delivery fee: $5.00 for the first pharmacy branch, +$2.00 for each additional branch/vendor.
    const uniquePharmaciesCount = pharmacyIds.size;
    const deliveryFee = uniquePharmaciesCount > 0 ? 5.00 + (uniquePharmaciesCount - 1) * 2.00 : 0;
    const finalTotalPrice = totalPrice + deliveryFee;

    // 4. Mock Payment Gateway Integration
    // In a real app, we would make a request to Stripe/PayPal here.
    // We mock success unless specified otherwise.
    const paymentSuccess = true; 
    const paymentStatus = paymentSuccess ? 'PAID' : 'FAILED';

    if (!paymentSuccess) {
      return res.status(400).json({ message: 'Payment authorization failed.' });
    }

    // 5. Database transaction: Create order & update product stocks
    const order = await prisma.$transaction(async (tx) => {
      // Create Order
      const newOrder = await tx.order.create({
        data: {
          userId: customerId,
          totalPrice: finalTotalPrice,
          deliveryFee,
          paymentStatus,
          orderStatus: 'PENDING', // starts as Pending
          prescriptionId: validatedPrescription ? validatedPrescription.id : null,
          items: {
            create: dbProducts.map((prod) => {
              const qty = itemsMap.get(prod.id) || 0;
              return {
                productId: prod.id,
                quantity: qty,
                priceAtPurchase: prod.price,
              };
            }),
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Decrease stock levels (real-time stock update)
      for (const prod of dbProducts) {
        const qty = itemsMap.get(prod.id) || 0;
        await tx.product.update({
          where: { id: prod.id },
          data: {
            stockQuantity: {
              decrement: qty,
            },
          },
        });
      }

      return newOrder;
    });

    return res.status(201).json({
      message: 'Order placed successfully',
      orderId: order.id,
      totalPrice: order.totalPrice,
      deliveryFee: order.deliveryFee,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      items: order.items,
    });
  } catch (error) {
    console.error('Error during checkout:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/orders - Fetch orders based on role
router.get('/', authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { role, id: userId } = req.user;

    let orders;

    if (role === 'CUSTOMER') {
      // Customers see their own orders
      orders = await prisma.order.findMany({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                include: { pharmacy: true },
              },
            },
          },
          driver: {
            select: { name: true, phone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else if (role === 'DRIVER') {
      // Drivers see orders they claimed, OR orders that are ready for pickup
      orders = await prisma.order.findMany({
        where: {
          OR: [
            { driverId: userId },
            { orderStatus: 'APPROVED' }, // Approved and ready to prepare/pickup
            { orderStatus: 'PREPARING' },
          ],
        },
        include: {
          user: {
            select: { name: true, phone: true, address: true },
          },
          items: {
            include: {
              product: {
                include: { pharmacy: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else if (role === 'PHARMACIST' || role === 'ADMIN') {
      // Pharmacists and admins see all orders
      orders = await prisma.order.findMany({
        include: {
          user: {
            select: { name: true, email: true, phone: true, address: true },
          },
          items: {
            include: {
              product: {
                include: { pharmacy: true },
              },
            },
          },
          driver: {
            select: { name: true, phone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/orders/:id - Single order details
router.get('/:id', authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, address: true },
        },
        driver: {
          select: { id: true, name: true, phone: true },
        },
        prescription: true,
        items: {
          include: {
            product: {
              include: { pharmacy: true },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Access check: Customer can only view their own orders
    if (req.user.role === 'CUSTOMER' && order.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access forbidden' });
    }

    return res.json(order);
  } catch (error) {
    console.error('Error fetching order details:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/orders/:id/status - Update order status (Admin, Pharmacist, Driver depending on status)
router.put('/:id/status', authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body; // PENDING, APPROVED, PREPARING, OUT_FOR_DELIVERY, DELIVERED

    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    const validStatuses = ['PENDING', 'APPROVED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({ message: 'Invalid order status' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Permissions logic:
    // - Pharmacist & Admin can set APPROVED, PREPARING, or cancel/revert.
    // - Driver can set OUT_FOR_DELIVERY and DELIVERED (if they are the assigned driver).
    const newStatus = status.toUpperCase();

    if (['APPROVED', 'PREPARING'].includes(newStatus)) {
      if (req.user.role !== 'PHARMACIST' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Only pharmacists or admins can approve or prepare orders' });
      }
    }

    if (['OUT_FOR_DELIVERY', 'DELIVERED'].includes(newStatus)) {
      if (req.user.role !== 'DRIVER' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Only delivery drivers or admins can mark orders out for delivery or delivered' });
      }
      
      // If it is a driver, ensure they claimed the order first
      if (req.user.role === 'DRIVER' && order.driverId !== req.user.id) {
        return res.status(400).json({ message: 'You must claim this order before updating its delivery status' });
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        orderStatus: newStatus,
      },
      include: {
        user: { select: { name: true, phone: true, address: true } },
        driver: { select: { name: true, phone: true } },
      },
    });

    return res.json({
      message: `Order status updated to ${newStatus}`,
      order: updatedOrder,
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/orders/:id/claim - Delivery driver claims an order for delivery
router.put('/:id/claim', authenticateToken as any, requireRoles(['DRIVER', 'ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.driverId) {
      return res.status(400).json({ message: 'Order has already been claimed by another driver' });
    }

    // Drivers can only claim orders that have been APPROVED (or PREPARING)
    if (order.orderStatus === 'PENDING') {
      return res.status(400).json({ message: 'Order must be approved by a pharmacist before it can be claimed' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        driverId: req.user.id,
        orderStatus: 'PREPARING', // automatically transition to preparing when driver claims, if not already
      },
      include: {
        user: { select: { name: true, phone: true, address: true } },
        driver: { select: { name: true, phone: true } },
      },
    });

    return res.json({
      message: 'Order claimed successfully',
      order: updatedOrder,
    });
  } catch (error) {
    console.error('Error claiming order:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
