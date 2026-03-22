const express = require('express');
const router = express.Router();
const metadataController = require('../controllers/metadataController');

// Get home screen banners
router.get('/banners', metadataController.getBanners);

// Get Panchang for today or specific date
router.get('/panchang', metadataController.getPanchang);

// Get ceremony categories
router.get('/categories', metadataController.getCategories);

module.exports = router;
