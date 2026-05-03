// controllers/adminController.js
const adminService = require('../services/adminService');

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
