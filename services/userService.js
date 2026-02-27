const User = require('../models/User');

const getOrCreateUser = async (telegramUser) => {
  const telegramId = telegramUser.id;
  const name = telegramUser.first_name || 'User';
  
  let user = await User.findOne({ email: `${telegramId}@telegram.com` });
  if (!user) {
    user = new User({ 
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
  if (data.email) update.email = data.email;
  if (data.dailyLimit) {
    update['preferences.dailyLimit'] = data.dailyLimit;
  }
  return await User.findByIdAndUpdate(userId, update, { new: true });
};

module.exports = { getOrCreateUser, updateUserState, updateUserProfile };
