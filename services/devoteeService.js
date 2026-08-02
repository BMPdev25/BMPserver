// services/devoteeService.js
const User = require('../models/user');
const PriestProfile = require('../models/priestProfile');
const mongoose = require('mongoose');
const { escapeRegex } = require('../utils/escapeRegex');

const getAllPriests = async () => {
  return await PriestProfile.find({})
    .populate({
      path: 'userId',
      select: 'name email phone location languagesSpoken',
    })
    .lean()
    .exec();
};

const getPriestDetails = async (priestId) => {
  if (!mongoose.isValidObjectId(priestId)) {
    const error = new Error('Invalid priest ID');
    error.statusCode = 400;
    throw error;
  }

  let priest = await PriestProfile.findById(priestId)
    .select(
      'userId services ratings experience description religiousTradition availability location currentAvailability isVerified specializations ceremonyCount profilePicture analytics'
    )
    .populate({
      path: 'userId',
      select: 'name profilePicture languagesSpoken',
    })
    .populate('services.ceremonyId', 'name category duration ritualSteps')
    .lean()
    .exec();

  if (!priest) {
    priest = await PriestProfile.findOne({ userId: priestId })
      .select(
        'userId services ratings experience description religiousTradition availability location currentAvailability isVerified specializations ceremonyCount profilePicture analytics'
      )
      .populate({
        path: 'userId',
        select: 'name profilePicture languagesSpoken',
      })
      .populate('services.ceremonyId', 'name category duration ritualSteps')
      .lean()
      .exec();
  }

  if (!priest) {
    const error = new Error('Priest not found');
    error.statusCode = 404;
    throw error;
  }

  return priest;
};

const updateProfile = async (userId, updateData) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const { name, email, phone, familyDetails } = updateData;
  if (name) user.name = name;
  if (email) user.email = email;
  if (phone) user.phone = phone;
  if (familyDetails) {
    user.familyDetails = { ...user.familyDetails, ...familyDetails };
  }

  await user.save();
  return user;
};

const manageAddress = async (userId, action, addressData, addressId = null) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  switch (action) {
    case 'add':
      if (addressData.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
      else if (user.addresses.length === 0) addressData.isDefault = true;
      user.addresses.push(addressData);
      break;
    case 'update': {
      const idx = user.addresses.findIndex((a) => a._id.toString() === addressId);
      if (idx === -1) throw new Error('Address not found');
      if (addressData.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
      user.addresses[idx] = { ...user.addresses[idx], ...addressData };
      break;
    }
    case 'delete':
      user.addresses = user.addresses.filter((a) => a._id.toString() !== addressId);
      if (user.addresses.length > 0 && !user.addresses.some((a) => a.isDefault)) {
        user.addresses[0].isDefault = true;
      }
      break;
  }

  await user.save();
  return user.addresses;
};

module.exports = {
  getAllPriests,
  getPriestDetails,
  updateProfile,
  manageAddress,
};
