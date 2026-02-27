const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const listUsers = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({});
  console.log(JSON.stringify(users, null, 2));
  await mongoose.disconnect();
};

listUsers();
