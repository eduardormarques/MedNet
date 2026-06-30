"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// GET /api/pharmacies - List all pharmacies in the network
router.get('/', async (req, res) => {
    try {
        const pharmacies = await db_1.default.pharmacy.findMany({
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });
        return res.json(pharmacies);
    }
    catch (error) {
        console.error('Error fetching pharmacies:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
exports.default = router;
