const express = require('express');
const adminController = require('../controllers/adminController');
const adminAuthController = require('../controllers/adminAuthController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const multer = require('multer');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Public admin routes
router.post('/auth/login', adminAuthController.login);

// All other admin routes require JWT protect + adminOnly
router.use(protect);
router.use(adminOnly);

// Authenticated user checks
router.get('/auth/me', adminAuthController.me);

// Dashboard Statistics
router.get('/dashboard/stats', adminController.getStats);

// Pujari Verifications
router.get('/verifications/pending', adminController.getPendingVerifications);
router.put('/verifications/:priestId/documents/:docType', adminController.reviewDocument);
router.put('/verifications/:priestId/status', adminController.updateVerificationStatus);

// Banners Campaign
router.get('/banners', adminController.getAllBanners);
router.post('/banners', upload.single('image'), adminController.createBanner);
router.put('/banners/:id', upload.single('image'), adminController.updateBanner);
router.delete('/banners/:id', adminController.deleteBanner);

// Ceremonies Catalog
router.get('/ceremonies', adminController.getAllCeremonies);
router.post('/ceremonies', upload.array('images', 5), adminController.createCeremony);
router.put('/ceremonies/:id', upload.array('images', 5), adminController.updateCeremony);
router.delete('/ceremonies/:id', adminController.deleteCeremony);

// Devotees List & Status Management
router.get('/devotees', adminController.getAllDevotees);
router.put('/devotees/:id/status', adminController.toggleUserStatus);

// Bookings Management
router.get('/bookings', adminController.getAllBookings);
router.get('/bookings/:id', adminController.getBookingById);
router.put('/bookings/:id/status', adminController.updateBookingStatus);
router.put('/bookings/:id/assign', adminController.assignPujariToBooking);
router.put('/bookings/:id/items-status', adminController.updateBookingItemsStatus);

// Pujaris Management
router.get('/pujaris', adminController.getAllPujaris);
router.get('/pujaris/:id', adminController.getPujariById);
router.post('/pujaris', adminController.createPujari);
router.put('/pujaris/:id', adminController.updatePujari);
router.delete('/pujaris/:id', adminController.deletePujari);

module.exports = router;
