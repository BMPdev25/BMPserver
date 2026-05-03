// services/devoteeService.js
const User = require('../models/user');
const PriestProfile = require('../models/priestProfile');
const Booking = require('../models/booking');
const Notification = require('../models/notification');
const Review = require('../models/review');
const Ceremony = require('../models/ceremony');
const mongoose = require('mongoose');

const getAllPriests = async () => {
  return await PriestProfile.find({})
    .populate({
      path: 'userId',
      select: 'name email phone location languagesSpoken',
      populate: { path: 'languagesSpoken', select: 'name' },
    })
    .lean()
    .exec();
};

const searchPriests = async (query) => {
  const { ceremony, city, religion, minRating, search, page = 1, limit = 10 } = query;
  const filter = { 'currentAvailability.status': 'available' };

  if (ceremony) {
    const ceremonyDoc = await Ceremony.findOne({
      name: new RegExp(ceremony, 'i'),
      isActive: true,
    })
      .select('_id')
      .lean();
    if (ceremonyDoc) filter['services.ceremonyId'] = ceremonyDoc._id;
    else return { priests: [], total: 0 };
  }

  if (city) {
    const cityRegex = new RegExp(city, 'i');
    const cityUsers = await User.find({ 'location.city': cityRegex }).select('_id').lean();
    filter.userId = { $in: cityUsers.map((u) => u._id) };
  }

  if (religion) filter.religiousTradition = new RegExp(religion, 'i');
  if (minRating) filter['ratings.average'] = { $gte: parseFloat(minRating) };

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    const matchingUsers = await User.find({ name: searchRegex }).select('_id').lean();
    filter.$or = [
      { userId: { $in: matchingUsers.map((u) => u._id) } },
      { description: searchRegex },
    ];
  }

  const priests = await PriestProfile.find(filter)
    .populate({
      path: 'userId',
      select: 'name email phone location languagesSpoken',
      populate: { path: 'languagesSpoken', select: 'name' },
    })
    .populate('services.ceremonyId', 'name')
    .sort({ 'ratings.average': -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean()
    .exec();

  const total = await PriestProfile.countDocuments(filter);
  return { priests, total };
};

const getPriestDetails = async (priestId) => {
  if (!mongoose.isValidObjectId(priestId)) {
    const error = new Error('Invalid priest ID');
    error.statusCode = 400;
    throw error;
  }

  let priest = await PriestProfile.findById(priestId)
    .populate({
      path: 'userId',
      select: 'name email phone location languagesSpoken',
      populate: { path: 'languagesSpoken', select: 'name' },
    })
    .populate('services.ceremonyId', 'name ritualSteps')
    .lean()
    .exec();

  if (!priest) {
    priest = await PriestProfile.findOne({ userId: priestId })
      .populate({
        path: 'userId',
        select: 'name email phone location languagesSpoken',
        populate: { path: 'languagesSpoken', select: 'name' },
      })
      .populate('services.ceremonyId', 'name ritualSteps')
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
    case 'update':
      const idx = user.addresses.findIndex((a) => a._id.toString() === addressId);
      if (idx === -1) throw new Error('Address not found');
      if (addressData.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
      user.addresses[idx] = { ...user.addresses[idx], ...addressData };
      break;
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
  searchPriests,
  getPriestDetails,
  updateProfile,
  manageAddress,
};
