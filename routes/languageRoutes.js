const express = require('express');
const router = express.Router();
const languageController = require('../controllers/languageController');

// Get all languages
router.get('/', languageController.getAllLanguages);

// Get language by ID
router.get('/:id', languageController.getLanguageById);

module.exports = router;
