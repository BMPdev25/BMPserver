const express = require('express');
const adminController = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// All admin routes are protected and require the 'admin' role
router.use(protect);
router.use(adminOnly);

// Get all priests pending verification
router.get('/verifications/pending', adminController.getPendingVerifications);

// Update individual document status (verified/rejected)
router.put('/verifications/:priestId/documents/:docType', adminController.reviewDocument);

// Finalize overall verification status (approved/rejected)
router.put('/verifications/:priestId/status', adminController.updateVerificationStatus);

module.exports = router;
