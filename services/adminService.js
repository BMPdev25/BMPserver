// services/adminService.js
const User = require('../models/user');
const PriestProfile = require('../models/priestProfile');
const Notification = require('../models/notification');

const getPendingVerifications = async () => {
  return await PriestProfile.find({ verificationStatus: 'pending' }).populate(
    'userId',
    'name email phone profilePicture'
  );
};

const reviewDocument = async (priestId, docType, status) => {
  const profile = await PriestProfile.findOne({ userId: priestId });
  if (!profile) {
    const error = new Error('Profile not found');
    error.statusCode = 404;
    throw error;
  }

  const docIndex = profile.verificationDocuments.findIndex((d) => d.type === docType);
  if (docIndex === -1) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }

  profile.verificationDocuments[docIndex].status = status;
  await profile.save();
  return true;
};

const updateVerificationStatus = async (priestId, { status, rejectionReason }) => {
  const profile = await PriestProfile.findOne({ userId: priestId });
  if (!profile) {
    const error = new Error('Profile not found');
    error.statusCode = 404;
    throw error;
  }

  profile.verificationStatus = status;
  profile.rejectionReason = status === 'rejected' ? rejectionReason : '';
  profile.isVerified = status === 'approved';

  await User.findByIdAndUpdate(priestId, { isVerified: profile.isVerified });
  await profile.save();

  await Notification.create({
    userId: priestId,
    title: status === 'approved' ? 'Profile Verified! 🎉' : 'Verification Update Required',
    message:
      status === 'approved'
        ? 'Congratulations! Your account is now verified.'
        : `Your verification request was rejected. Reason: ${rejectionReason}.`,
    type: 'profile_update',
    targetId: priestId,
  });

  return profile;
};

module.exports = {
  getPendingVerifications,
  reviewDocument,
  updateVerificationStatus,
};
