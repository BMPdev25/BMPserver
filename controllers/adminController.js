// controllers/adminController.js
const adminService = require('../services/adminService');
const { uploadPublicFile, deletePublicFile, getPresignedUrl } = require('../services/storageService');
const { keyFromPublicUrl } = require('../utils/s3Keys');

// --- PUJARI VERIFICATION ---

exports.getPendingVerifications = async (req, res, next) => {
  try {
    const pendingPriests = await adminService.getPendingVerifications();
    res.status(200).json({
      success: true,
      count: pendingPriests.length,
      data: pendingPriests,
    });
  } catch (error) {
    next(error);
  }
};

exports.reviewDocument = async (req, res, next) => {
  try {
    const { priestId, docType } = req.params;
    const { status } = req.body;
    if (!['verified', 'rejected'].includes(status))
      return res.status(400).json({ message: 'Invalid status' });
    await adminService.reviewDocument(priestId, docType, status);
    res.status(200).json({ success: true, message: `Document ${docType} marked as ${status}` });
  } catch (error) {
    next(error);
  }
};

exports.getDocumentPresignedUrl = async (req, res, next) => {
  try {
    const { priestId, docType } = req.params;
    const PriestProfile = require('../models/priestProfile');
    const profile = await PriestProfile.findOne({ userId: priestId });
    if (!profile) return res.status(404).json({ success: false, message: 'Priest profile not found' });
    const doc = (profile.verificationDocuments || []).find((d) => d.type === docType);
    if (!doc || !doc.url) return res.status(404).json({ success: false, message: 'Document not found or not uploaded yet' });
    const presignedUrl = await getPresignedUrl(doc.url, 3600); // 1-hour expiry
    res.status(200).json({ success: true, data: { url: presignedUrl } });
  } catch (error) {
    next(error);
  }
};

exports.updateVerificationStatus = async (req, res, next) => {
  try {
    const { priestId } = req.params;
    const { status, rejectionReason } = req.body;
    if (!['approved', 'rejected'].includes(status))
      return res.status(400).json({ message: 'Invalid status' });
    const profile = await adminService.updateVerificationStatus(priestId, {
      status,
      rejectionReason,
    });
    res
      .status(200)
      .json({ success: true, message: `Priest verification ${status}`, data: profile });
  } catch (error) {
    next(error);
  }
};

// --- BANNER MANAGEMENT ---

exports.getAllBanners = async (req, res, next) => {
  try {
    const banners = await adminService.getAllBanners();
    res.status(200).json({ success: true, data: banners });
  } catch (error) {
    next(error);
  }
};

exports.createBanner = async (req, res, next) => {
  try {
    const bannerData = { ...req.body };
    
    if (req.file) {
      const key = `banners/${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
      const imageUrl = await uploadPublicFile(req.file.buffer, key, req.file.mimetype);
      bannerData.imageUrl = imageUrl;
    }

    const banner = await adminService.createBanner(bannerData);
    res.status(201).json({ success: true, message: 'Banner created successfully', data: banner });
  } catch (error) {
    next(error);
  }
};

exports.updateBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const bannerData = { ...req.body };

    const Banner = require('../models/banner');
    const existing = await Banner.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    if (req.file) {
      // Delete old image
      if (existing.imageUrl) {
        const oldKey = keyFromPublicUrl(existing.imageUrl);
        if (oldKey) await deletePublicFile(oldKey).catch(() => {});
      }
      
      const key = `banners/${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
      const imageUrl = await uploadPublicFile(req.file.buffer, key, req.file.mimetype);
      bannerData.imageUrl = imageUrl;
    }

    const banner = await adminService.updateBanner(id, bannerData);
    res.status(200).json({ success: true, message: 'Banner updated successfully', data: banner });
  } catch (error) {
    next(error);
  }
};

exports.deleteBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const Banner = require('../models/banner');
    const existing = await Banner.findById(id);
    
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    if (existing.imageUrl) {
      const oldKey = keyFromPublicUrl(existing.imageUrl);
      if (oldKey) await deletePublicFile(oldKey).catch(() => {});
    }

    await adminService.deleteBanner(id);
    res.status(200).json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// --- CEREMONY MANAGEMENT ---

exports.getAllCeremonies = async (req, res, next) => {
  try {
    const ceremonies = await adminService.getAllCeremonies(req.query);
    res.status(200).json({ success: true, data: ceremonies });
  } catch (error) {
    next(error);
  }
};

exports.createCeremony = async (req, res, next) => {
  try {
    // Parse complex body properties (typically sent as JSON string in multipart)
    const ceremonyData = { ...req.body };
    ['duration', 'pricing', 'requirements', 'ritualSteps', 'images', 'videos', 'religiousTraditions', 'regions', 'languages', 'seasonality'].forEach(field => {
      if (typeof ceremonyData[field] === 'string') {
        try {
          ceremonyData[field] = JSON.parse(ceremonyData[field]);
        } catch {
          // Keep as is or default if invalid JSON
        }
      }
    });

    if (req.files && req.files.length > 0) {
      ceremonyData.images = [];
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const key = `ceremonies/${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
        const url = await uploadPublicFile(file.buffer, key, file.mimetype);
        ceremonyData.images.push({
          url,
          alt: file.originalname,
          isPrimary: i === 0
        });
      }
    }

    const ceremony = await adminService.createCeremony(ceremonyData);
    res.status(201).json({ success: true, message: 'Ceremony created successfully', data: ceremony });
  } catch (error) {
    next(error);
  }
};

exports.updateCeremony = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ceremonyData = { ...req.body };

    const Ceremony = require('../models/ceremony');
    const existing = await Ceremony.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Ceremony not found' });
    }

    ['duration', 'pricing', 'requirements', 'ritualSteps', 'images', 'videos', 'religiousTraditions', 'regions', 'languages', 'seasonality'].forEach(field => {
      if (typeof ceremonyData[field] === 'string') {
        try {
          ceremonyData[field] = JSON.parse(ceremonyData[field]);
        } catch {
          // Keep as is
        }
      }
    });

    // If new files are uploaded, delete existing S3 images and upload new ones
    if (req.files && req.files.length > 0) {
      if (existing.images && existing.images.length > 0) {
        for (const img of existing.images) {
          const oldKey = keyFromPublicUrl(img.url);
          if (oldKey) await deletePublicFile(oldKey).catch(() => {});
        }
      }

      ceremonyData.images = [];
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const key = `ceremonies/${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
        const url = await uploadPublicFile(file.buffer, key, file.mimetype);
        ceremonyData.images.push({
          url,
          alt: file.originalname,
          isPrimary: i === 0
        });
      }
    }

    const ceremony = await adminService.updateCeremony(id, ceremonyData);
    res.status(200).json({ success: true, message: 'Ceremony updated successfully', data: ceremony });
  } catch (error) {
    next(error);
  }
};

exports.deleteCeremony = async (req, res, next) => {
  try {
    const { id } = req.params;
    await adminService.deleteCeremony(id);
    res.status(200).json({ success: true, message: 'Ceremony deactivated successfully' });
  } catch (error) {
    next(error);
  }
};

exports.hardDeleteCeremony = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ceremony = await adminService.hardDeleteCeremony(id);
    if (ceremony.images && ceremony.images.length > 0) {
      for (const img of ceremony.images) {
        const oldKey = keyFromPublicUrl(img.url);
        if (oldKey) await deletePublicFile(oldKey).catch(() => {});
      }
    }
    res.status(200).json({ success: true, message: 'Ceremony permanently deleted' });
  } catch (error) {
    next(error);
  }
};

// --- DEVOTEE MANAGEMENT ---

exports.getAllDevotees = async (req, res, next) => {
  try {
    const devotees = await adminService.getAllDevotees();
    res.status(200).json({ success: true, data: devotees });
  } catch (error) {
    next(error);
  }
};

exports.toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const user = await adminService.toggleUserStatus(id, isActive);
    res.status(200).json({ success: true, message: `User status set to ${isActive ? 'active' : 'inactive'}`, data: user });
  } catch (error) {
    next(error);
  }
};

// --- DASHBOARD STATISTICS ---

exports.getStats = async (req, res, next) => {
  try {
    const stats = await adminService.getStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

// --- BOOKINGS MANAGEMENT ---

exports.getAllBookings = async (req, res, next) => {
  try {
    const bookings = await adminService.getAllBookings(req.query);
    res.status(200).json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    next(error);
  }
};

exports.getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await adminService.getBookingById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const booking = await adminService.updateBookingStatus(id, status);
    res.status(200).json({ success: true, message: 'Booking status updated successfully', data: booking });
  } catch (error) {
    next(error);
  }
};

exports.assignPujariToBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { pujariId } = req.body;
    const booking = await adminService.assignPujariToBooking(id, pujariId);
    res.status(200).json({ success: true, message: 'Pujari assigned successfully', data: booking });
  } catch (error) {
    next(error);
  }
};

exports.updateBookingItemsStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { itemsDeliveryStatus } = req.body;
    const booking = await adminService.updateBookingItemsStatus(id, itemsDeliveryStatus);
    res.status(200).json({ success: true, message: 'Items status updated successfully', data: booking });
  } catch (error) {
    next(error);
  }
};

// --- PUJARI MANAGEMENT ---

exports.getAllPujaris = async (req, res, next) => {
  try {
    const pujaris = await adminService.getAllPujaris(req.query);
    res.status(200).json({ success: true, count: pujaris.length, data: pujaris });
  } catch (error) {
    next(error);
  }
};

exports.getPujariById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pujari = await adminService.getPujariById(id);
    if (!pujari) {
      return res.status(404).json({ success: false, message: 'Pujari not found' });
    }
    res.status(200).json({ success: true, data: pujari });
  } catch (error) {
    next(error);
  }
};

exports.createPujari = async (req, res, next) => {
  try {
    const user = await adminService.createPujari(req.body);
    res.status(201).json({ success: true, message: 'Pujari created successfully', data: user });
  } catch (error) {
    next(error);
  }
};

exports.updatePujari = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await adminService.updatePujari(id, req.body);
    res.status(200).json({ success: true, message: 'Pujari updated successfully', data: user });
  } catch (error) {
    next(error);
  }
};

exports.deletePujari = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await adminService.deletePujari(id);
    res.status(200).json({ success: true, message: 'Pujari deactivated successfully', data: user });
  } catch (error) {
    next(error);
  }
};
