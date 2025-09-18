// routes/searchRoutes.js
const express = require('express');
const router = express.Router();
const {
  universalSearch,
  getPopularCeremonies,
  getCeremonyDetails,
  getCeremonyCategories,
  getSearchSuggestions,
} = require('../controllers/searchController');
const {protect} = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

// Rate limiting for search operations
const searchLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 searches per minute
  message: {
    success: false,
    message: 'Too many search requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply authentication middleware to protected routes
router.use(protect);

// Universal search
router.get('/universal', searchLimit, universalSearch);

// Search suggestions (autocomplete)
router.get('/suggestions', searchLimit, getSearchSuggestions);

// Ceremony routes
router.get('/ceremonies/popular', getPopularCeremonies);
router.get('/ceremonies/categories', getCeremonyCategories);
router.get('/ceremonies/:ceremonyId', getCeremonyDetails);

module.exports = router;
