const User = require('../models/User');

const getOrCreateUser = async (telegramUser) => {
  const telegramId = telegramUser.id;
  const name = telegramUser.first_name || 'User';
  
  let user = await User.findOne({ telegramId: telegramId.toString() });
  
  // Migration: If not found by telegramId, search by legacy email
  if (!user) {
    user = await User.findOne({ email: `${telegramId}@telegram.com` });
    if (user) {
      user.telegramId = telegramId.toString();
      await user.save();
    }
  }

  if (!user) {
    user = new User({ 
      telegramId: telegramId.toString(),
      name: name, 
      email: `${telegramId}@telegram.com` 
    });
    await user.save();
  }
  return user;
};

const updateUserState = async (userId, state) => {
  return await User.findByIdAndUpdate(userId, { state }, { new: true });
};

const updateUserProfile = async (userId, data) => {
  const update = {};
  if (data.name) update.name = data.name;
  
  if (data.email) {
    // Check if email is already taken by another user
    const existingUser = await User.findOne({ 
      email: data.email, 
      _id: { $ne: userId } 
    });
    if (existingUser) {
      const error = new Error('Email already in use');
      error.code = 'DUPLICATE_EMAIL';
      throw error;
    }
    update.email = data.email;
  }

  if (data.dailyLimit) {
    update['preferences.dailyLimit'] = data.dailyLimit;
  }
  return await User.findByIdAndUpdate(userId, update, { new: true });
};

const getAllUsers = async () => {
  return await User.find({});
};

module.exports = { getOrCreateUser, updateUserState, updateUserProfile, getAllUsers };
