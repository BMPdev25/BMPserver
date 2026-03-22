const User = require("../models/user");
const PriestProfile = require("../models/priestProfile");
const Notification = require("../models/notification");

// Get all priests with pending verification status
exports.getPendingVerifications = async (req, res) => {
  try {
    const pendingPriests = await PriestProfile.find({ 
      verificationStatus: 'pending' 
    }).populate('userId', 'name email phone profilePicture');

    res.status(200).json({
      success: true,
      count: pendingPriests.length,
      data: pendingPriests
    });
  } catch (error) {
    console.error("Get pending verifications error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Review specific document status
exports.reviewDocument = async (req, res) => {
  try {
    const { priestId, docType } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const profile = await PriestProfile.findOne({ userId: priestId });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const docIndex = profile.verificationDocuments.findIndex(d => d.type === docType);
    if (docIndex === -1) return res.status(404).json({ message: "Document not found" });

    profile.verificationDocuments[docIndex].status = status;
    
    // If rejected, we can optionally clear the data to force re-upload, 
    // but better to keep it for admin reference until new one arrives.
    
    await profile.save();

    res.status(200).json({ success: true, message: `Document ${docType} marked as ${status}` });
  } catch (error) {
    console.error("Review document error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update overall priest verification status
exports.updateVerificationStatus = async (req, res) => {
  try {
    const { priestId } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const profile = await PriestProfile.findOne({ userId: priestId });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    profile.verificationStatus = status;
    profile.rejectionReason = status === 'rejected' ? rejectionReason : '';
    
    if (status === 'approved') {
      profile.isVerified = true;
      // Also update isVerified on User model for consistency
      await User.findByIdAndUpdate(priestId, { isVerified: true });
    } else {
      profile.isVerified = false;
      await User.findByIdAndUpdate(priestId, { isVerified: false });
    }

    await profile.save();

    // Create Notification for the Priest
    await Notification.create({
      userId: priestId,
      title: status === 'approved' ? "Profile Verified! 🎉" : "Verification Update Required",
      message: status === 'approved' 
        ? "Congratulations! Your account is now verified. You can now go online and accept bookings."
        : `Your verification request was rejected. Reason: ${rejectionReason}. Please update your profile.`,
      type: 'profile_update',
      targetId: priestId,
      targetType: 'Profile'
    });

    res.status(200).json({ 
      success: true, 
      message: `Priest verification ${status}`,
      data: profile 
    });
  } catch (error) {
    console.error("Update verification status error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
