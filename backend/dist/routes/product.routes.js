"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET /api/products - Advanced search & filtering by category
router.get('/', async (req, res) => {
    try {
        const { search, category, requiresPrescription, pharmacyId } = req.query;
        const whereClause = {};
        if (search) {
            whereClause.OR = [
                { name: { contains: String(search) } },
                { activeIngredient: { contains: String(search) } },
                { description: { contains: String(search) } },
            ];
        }
        if (category) {
            whereClause.category = String(category);
        }
        if (requiresPrescription) {
            whereClause.requiresPrescription = requiresPrescription === 'true';
        }
        if (pharmacyId) {
            whereClause.pharmacyId = parseInt(String(pharmacyId), 10);
        }
        const products = await db_1.default.product.findMany({
            where: whereClause,
            include: {
                pharmacy: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                    },
                },
            },
        });
        return res.json(products);
    }
    catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// GET /api/products/expiring - Expiring products batch tracking (Pharmacist / Admin only)
router.get('/expiring', auth_1.authenticateToken, (0, auth_1.requireRoles)(['PHARMACIST', 'ADMIN']), async (req, res) => {
    try {
        // Products expiring within the next 12 months, sorted by closest expiration date
        const oneYearFromNow = new Date();
        oneYearFromNow.setMonth(oneYearFromNow.getMonth() + 12);
        const products = await db_1.default.product.findMany({
            where: {
                expirationDate: {
                    lte: oneYearFromNow,
                },
            },
            include: {
                pharmacy: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: {
                expirationDate: 'asc',
            },
        });
        return res.json(products);
    }
    catch (error) {
        console.error('Error fetching expiring products:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// GET /api/products/:id
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }
        const product = await db_1.default.product.findUnique({
            where: { id },
            include: {
                pharmacy: true,
            },
        });
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        return res.json(product);
    }
    catch (error) {
        console.error('Error fetching product details:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// POST /api/products - Add product (Pharmacist/Admin)
router.post('/', auth_1.authenticateToken, (0, auth_1.requireRoles)(['PHARMACIST', 'ADMIN']), async (req, res) => {
    try {
        const { name, activeIngredient, description, category, price, stockQuantity, sku, requiresPrescription, expirationDate, pharmacyId, } = req.body;
        if (!name || !category || price === undefined || stockQuantity === undefined || !sku || !pharmacyId) {
            return res.status(400).json({ message: 'Missing required product fields' });
        }
        const existingProduct = await db_1.default.product.findUnique({
            where: { sku },
        });
        if (existingProduct) {
            return res.status(400).json({ message: 'SKU already exists' });
        }
        const newProduct = await db_1.default.product.create({
            data: {
                name,
                activeIngredient: activeIngredient || 'N/A',
                description: description || '',
                category,
                price: parseFloat(price),
                stockQuantity: parseInt(stockQuantity, 10),
                sku,
                requiresPrescription: !!requiresPrescription,
                expirationDate: new Date(expirationDate || new Date().setFullYear(new Date().getFullYear() + 2)),
                pharmacyId: parseInt(pharmacyId, 10),
            },
        });
        return res.status(201).json(newProduct);
    }
    catch (error) {
        console.error('Error creating product:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// PUT /api/products/:id - Update product inventory & details (Pharmacist/Admin)
router.put('/:id', auth_1.authenticateToken, (0, auth_1.requireRoles)(['PHARMACIST', 'ADMIN']), async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }
        const { name, activeIngredient, description, category, price, stockQuantity, sku, requiresPrescription, expirationDate, pharmacyId, } = req.body;
        const existingProduct = await db_1.default.product.findUnique({
            where: { id },
        });
        if (!existingProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        // Check SKU conflict
        if (sku && sku !== existingProduct.sku) {
            const skuConflict = await db_1.default.product.findUnique({
                where: { sku },
            });
            if (skuConflict) {
                return res.status(400).json({ message: 'SKU already exists' });
            }
        }
        const updatedProduct = await db_1.default.product.update({
            where: { id },
            data: {
                name: name || undefined,
                activeIngredient: activeIngredient || undefined,
                description: description || undefined,
                category: category || undefined,
                price: price !== undefined ? parseFloat(price) : undefined,
                stockQuantity: stockQuantity !== undefined ? parseInt(stockQuantity, 10) : undefined,
                sku: sku || undefined,
                requiresPrescription: requiresPrescription !== undefined ? !!requiresPrescription : undefined,
                expirationDate: expirationDate ? new Date(expirationDate) : undefined,
                pharmacyId: pharmacyId ? parseInt(pharmacyId, 10) : undefined,
            },
        });
        return res.json(updatedProduct);
    }
    catch (error) {
        console.error('Error updating product:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
// DELETE /api/products/:id - Delete product (Pharmacist/Admin)
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.requireRoles)(['PHARMACIST', 'ADMIN']), async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }
        const existingProduct = await db_1.default.product.findUnique({
            where: { id },
        });
        if (!existingProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        await db_1.default.product.delete({
            where: { id },
        });
        return res.json({ message: 'Product deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting product:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
exports.default = router;
