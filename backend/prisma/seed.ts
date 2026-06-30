import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.prescription.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.pharmacy.deleteMany({});
  await prisma.user.deleteMany({});

  // Hash passwords
  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Users
  const customer = await prisma.user.create({
    data: {
      email: 'customer@pharmacy.com',
      name: 'John Doe (Customer)',
      passwordHash,
      role: 'CUSTOMER',
      phone: '+1 555-0100',
      address: '123 Maple Street, Downtown',
    },
  });

  const pharmacist = await prisma.user.create({
    data: {
      email: 'pharmacist@pharmacy.com',
      name: 'Dr. Jane Smith (Pharmacist)',
      passwordHash,
      role: 'PHARMACIST',
      phone: '+1 555-0200',
      address: '456 Oak Avenue, Uptown',
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@pharmacy.com',
      name: 'Alice Johnson (Admin)',
      passwordHash,
      role: 'ADMIN',
      phone: '+1 555-0300',
      address: '789 Pine Road, Headquarters',
    },
  });

  const driver = await prisma.user.create({
    data: {
      email: 'driver@pharmacy.com',
      name: 'Bob Miller (Driver)',
      passwordHash,
      role: 'DRIVER',
      phone: '+1 555-0400',
      address: '321 Elm Lane, Depot',
    },
  });

  console.log('Users seeded:', {
    customer: customer.email,
    pharmacist: pharmacist.email,
    admin: admin.email,
    driver: driver.email,
  });

  // 2. Create Pharmacies
  const downtownPharmacy = await prisma.pharmacy.create({
    data: {
      name: 'Downtown Care Pharmacy',
      address: '100 Main Street, Downtown',
      phone: '+1 555-1000',
    },
  });

  const uptownPharmacy = await prisma.pharmacy.create({
    data: {
      name: 'Uptown Wellness Pharmacy',
      address: '900 Broadway Ave, Uptown',
      phone: '+1 555-2000',
    },
  });

  console.log('Pharmacies seeded:', downtownPharmacy.name, 'and', uptownPharmacy.name);

  // 3. Create Products
  const productsData = [
    // Prescription Drugs
    {
      name: 'Amoxicillin 500mg',
      activeIngredient: 'Amoxicillin',
      description: 'Antibiotic used to treat a wide variety of bacterial infections.',
      category: 'Prescription Drugs',
      price: 18.50,
      stockQuantity: 120,
      sku: 'AMX-500-DWT',
      requiresPrescription: true,
      expirationDate: new Date('2027-08-15'),
      pharmacyId: downtownPharmacy.id,
    },
    {
      name: 'Lipitor 20mg',
      activeIngredient: 'Atorvastatin',
      description: 'Statin medication used to prevent cardiovascular disease and lower lipids.',
      category: 'Prescription Drugs',
      price: 32.00,
      stockQuantity: 85,
      sku: 'LIP-020-UPT',
      requiresPrescription: true,
      expirationDate: new Date('2027-04-10'),
      pharmacyId: uptownPharmacy.id,
    },
    {
      name: 'Metformin 850mg',
      activeIngredient: 'Metformin Hydrochloride',
      description: 'First-line medication for the treatment of type 2 diabetes.',
      category: 'Prescription Drugs',
      price: 14.25,
      stockQuantity: 150,
      sku: 'MET-850-DWT',
      requiresPrescription: true,
      expirationDate: new Date('2026-12-30'),
      pharmacyId: downtownPharmacy.id,
    },
    // OTC Medicines
    {
      name: 'Ibuprofen 400mg',
      activeIngredient: 'Ibuprofen',
      description: 'Nonsteroidal anti-inflammatory drug (NSAID) used for treating pain, fever, and inflammation.',
      category: 'OTC Medicines',
      price: 6.50,
      stockQuantity: 300,
      sku: 'IBU-400-DWT',
      requiresPrescription: false,
      expirationDate: new Date('2026-11-20'),
      pharmacyId: downtownPharmacy.id,
    },
    {
      name: 'Claritin 10mg',
      activeIngredient: 'Loratadine',
      description: 'Antihistamine that treats symptoms such as itching, runny nose, watery eyes, and sneezing.',
      category: 'OTC Medicines',
      price: 12.99,
      stockQuantity: 200,
      sku: 'CLA-010-UPT',
      requiresPrescription: false,
      expirationDate: new Date('2027-06-15'),
      pharmacyId: uptownPharmacy.id,
    },
    // Cosmetics
    {
      name: 'Retinol Serum 1%',
      activeIngredient: 'Retinol',
      description: 'Facial serum designed to reduce the appearance of fine lines and wrinkles.',
      category: 'Cosmetics',
      price: 24.95,
      stockQuantity: 50,
      sku: 'RET-001-UPT',
      requiresPrescription: false,
      expirationDate: new Date('2027-01-01'),
      pharmacyId: uptownPharmacy.id,
    },
    {
      name: 'Hydrating Sunscreen SPF 50',
      activeIngredient: 'Zinc Oxide, Titanium Dioxide',
      description: 'Broad-spectrum sun protection with skin hydrating ceramides.',
      category: 'Cosmetics',
      price: 18.99,
      stockQuantity: 90,
      sku: 'SUN-050-DWT',
      requiresPrescription: false,
      expirationDate: new Date('2027-03-30'),
      pharmacyId: downtownPharmacy.id,
    },
    // Medical Equipment
    {
      name: 'Digital Blood Pressure Monitor',
      activeIngredient: 'N/A',
      description: 'Easy-to-use automatic upper arm blood pressure monitor.',
      category: 'Medical Equipment',
      price: 49.99,
      stockQuantity: 40,
      sku: 'BPM-DIG-DWT',
      requiresPrescription: false,
      expirationDate: new Date('2031-12-31'),
      pharmacyId: downtownPharmacy.id,
    },
    {
      name: 'Infrared Forehead Thermometer',
      activeIngredient: 'N/A',
      description: 'Non-contact digital thermometer for quick and hygienic temperature readings.',
      category: 'Medical Equipment',
      price: 29.99,
      stockQuantity: 60,
      sku: 'THR-INF-UPT',
      requiresPrescription: false,
      expirationDate: new Date('2030-05-15'),
      pharmacyId: uptownPharmacy.id,
    },
  ];

  for (const product of productsData) {
    await prisma.product.create({
      data: product,
    });
  }

  console.log(`Successfully seeded ${productsData.length} products.`);
  console.log('Database seeding finished.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
