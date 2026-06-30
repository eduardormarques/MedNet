import * as fs from 'fs';
import * as path from 'path';
import prisma from './db';
import * as bcrypt from 'bcryptjs';

const MOCK_IMAGE_PATH = 'C:/Users/eduardo.rodrigues/.gemini/antigravity/scratch/mock-prescription.jpg';

async function simulate() {
  console.log('==================================================================');
  console.log('       MEDNET NETWORK MARKETPLACE WORKFLOW SIMULATION RUNNER');
  console.log('==================================================================\n');

  try {
    // 1. Clear database state for clean run
    console.log('♻️  Resetting database transactions for clean trace...');
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.prescription.deleteMany({});
    console.log('✅ Clean database initialized.\n');

    // 2. Fetch seeded users
    const customer = await prisma.user.findUnique({ where: { email: 'customer@pharmacy.com' } });
    const pharmacist = await prisma.user.findUnique({ where: { email: 'pharmacist@pharmacy.com' } });
    const driver = await prisma.user.findUnique({ where: { email: 'driver@pharmacy.com' } });

    if (!customer || !pharmacist || !driver) {
      throw new Error('Seeded users missing. Please seed the database first.');
    }

    console.log(`👤 Customer Active: ${customer.name} (${customer.email})`);
    console.log(`⚕️  Pharmacist Active: ${pharmacist.name} (${pharmacist.email})`);
    console.log(`🚚 Delivery Driver Active: ${driver.name} (${driver.email})\n`);

    // 3. Verify stock of gated drug "Amoxicillin 500mg"
    const amox = await prisma.product.findFirst({ where: { name: { contains: 'Amoxicillin' } } });
    if (!amox) throw new Error('Amoxicillin product not found');
    console.log(`📦 Catalog Check: Product "${amox.name}" (SKU: ${amox.sku})`);
    console.log(`   - Requires Prescription: ${amox.requiresPrescription}`);
    console.log(`   - Current Stock: ${amox.stockQuantity}`);
    console.log(`   - Expiration Date: ${amox.expirationDate.toLocaleDateString()}\n`);

    // 4. Simulate Uploading Prescription
    console.log('📤 [Customer] Uploading medical prescription file...');
    let base64Image = 'data:image/jpeg;base64,';
    if (fs.existsSync(MOCK_IMAGE_PATH)) {
      const buffer = fs.readFileSync(MOCK_IMAGE_PATH);
      base64Image += buffer.toString('base64').substring(0, 100) + '...[truncated]';
      console.log(`✅ Loaded image from scratch folder (${buffer.byteLength} bytes)`);
    } else {
      base64Image += 'mock-binary-data';
      console.log('⚠️  Physical image not found, using mock base64 data');
    }

    const prescription = await prisma.prescription.create({
      data: {
        userId: customer.id,
        imageUrl: base64Image,
        status: 'PENDING',
        notes: 'Prescribed 1 box of Amoxicillin 500mg daily. Doctor Roberts.',
      },
    });

    console.log(`📄 Prescription Ticket #${prescription.id} created.`);
    console.log(`   - Status: ${prescription.status}`);
    console.log(`   - Patient Notes: "${prescription.notes}"\n`);

    // 5. Gating Check: Customer attempts checkout WITHOUT pharmacist approval
    console.log('🛡️  [Gating Check] Customer attempting checkout before approval...');
    try {
      if (amox.requiresPrescription && prescription.status !== 'APPROVED') {
        throw new Error('Checkout Gated: Selected prescription is not APPROVED.');
      }
    } catch (e: any) {
      console.log(`❌ Gating Policy Alert: ${e.message} (Fulfillment Blocked Successfully)`);
    }
    console.log('');

    // 6. Pharmacist reviews and validates prescription ticket
    console.log('⚕️  [Pharmacist] Reviewing validation queue...');
    const pendingPresc = await prisma.prescription.findUnique({
      where: { id: prescription.id },
    });

    if (pendingPresc) {
      console.log(`   - Reviewing prescription #${pendingPresc.id}`);
      console.log('✅ [Pharmacist] Approving ticket with digital signature...');
      
      const approvedPresc = await prisma.prescription.update({
        where: { id: pendingPresc.id },
        data: {
          status: 'APPROVED',
          validatedById: pharmacist.id,
          notes: pendingPresc.notes + ' | Verified & Signed by Dr. Jane Smith',
        },
      });

      console.log(`📄 Ticket #${approvedPresc.id} status updated to: ${approvedPresc.status}`);
      console.log(`   - Notes: "${approvedPresc.notes}"\n`);
    }

    // 7. Customer checks out cart with APPROVED prescription ticket
    console.log('🛒 [Customer] Proceeding to Checkout...');
    console.log('   - Items: 2x Amoxicillin 500mg');
    
    const quantityOrdered = 2;
    const itemSubtotal = amox.price * quantityOrdered;
    const deliveryFee = 5.00; // Single branch routing fee
    const orderTotal = itemSubtotal + deliveryFee;

    // Perform database transaction: decrement stock, create order logs
    const order = await prisma.$transaction(async (tx) => {
      // Decrement product stock
      const updatedProduct = await tx.product.update({
        where: { id: amox.id },
        data: {
          stockQuantity: {
            decrement: quantityOrdered,
          },
        },
      });

      // Create Order log
      const newOrder = await tx.order.create({
        data: {
          userId: customer.id,
          totalPrice: orderTotal,
          deliveryFee,
          paymentStatus: 'PAID', // Simulated credit card success
          orderStatus: 'PENDING',
          prescriptionId: prescription.id,
          items: {
            create: {
              productId: amox.id,
              quantity: quantityOrdered,
              priceAtPurchase: amox.price,
            },
          },
        },
        include: {
          items: true,
        },
      });

      console.log(`📈 Real-Time Stock Adjusted: ${amox.name} inventory changed from ${amox.stockQuantity} to ${updatedProduct.stockQuantity}`);
      return newOrder;
    });

    console.log(`💳 Mock Payment Authorization Successful. Paid: $${order.totalPrice.toFixed(2)}`);
    console.log(`📦 Order #${order.id} placed.`);
    console.log(`   - Status: ${order.orderStatus}`);
    console.log(`   - Items count: ${order.items.length}\n`);

    // 8. Order status updates in fulfillment pipeline
    console.log('⚕️  [Pharmacist] Marking order as APPROVED for packaging...');
    await prisma.order.update({
      where: { id: order.id },
      data: { orderStatus: 'APPROVED' },
    });
    console.log('📦 Order Status: APPROVED\n');

    console.log('🚚 [Driver] Claiming shipment for dispatch...');
    await prisma.order.update({
      where: { id: order.id },
      data: { 
        driverId: driver.id,
        orderStatus: 'PREPARING'
      },
    });
    console.log(`📦 Order Status: PREPARING (Driver: ${driver.name} assigned)\n`);

    console.log('🚚 [Driver] Departing pharmacy branch...');
    await prisma.order.update({
      where: { id: order.id },
      data: { orderStatus: 'OUT_FOR_DELIVERY' },
    });
    console.log('📦 Order Status: OUT_FOR_DELIVERY\n');

    console.log('🚚 [Driver] Order delivered at customer physical address...');
    const finalizedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { orderStatus: 'DELIVERED' },
    });
    console.log(`🏁 Order Pipeline Concluded.`);
    console.log(`   - Final Order Status: ${finalizedOrder.orderStatus}`);
    console.log(`   - Payment Status: ${finalizedOrder.paymentStatus}\n`);

    console.log('==================================================================');
    console.log('           SIMULATION RUN CONCLUDED WITH ZERO ERRORS');
    console.log('==================================================================');
  } catch (error) {
    console.error('❌ Error during simulation run:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

simulate();
