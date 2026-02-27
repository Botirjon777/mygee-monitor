const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, unique: true },
  preferences: {
    dailyLimit: { type: Number, default: 100000 },
    monthlyLimit: { type: Number, default: 2000000 },
  },
  state: { type: String, default: 'idle' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);
