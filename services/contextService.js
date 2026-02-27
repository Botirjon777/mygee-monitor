const ChatHistory = require('../models/ChatHistory');

/**
 * Saves a message to the chat history.
 * @param {string} userId 
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content 
 */
const saveMessage = async (userId, role, content) => {
  try {
    const message = new ChatHistory({ userId, role, content });
    await message.save();
    
    // Optional: Limit history to last 50 messages per user to keep DB clean
    const count = await ChatHistory.countDocuments({ userId });
    if (count > 50) {
      const oldest = await ChatHistory.findOne({ userId }).sort({ timestamp: 1 });
      await ChatHistory.deleteOne({ _id: oldest._id });
    }
  } catch (err) {
    console.error(`Error saving history: ${err.message}`);
  }
};

/**
 * Retrieves the recent chat history for a user.
 * @param {string} userId 
 * @param {number} limit 
 * @returns {Promise<Array>}
 */
const getRecentHistory = async (userId, limit = 5) => {
  try {
    const history = await ChatHistory.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit);
    
    return history.reverse().map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  } catch (err) {
    console.error(`Error fetching history: ${err.message}`);
    return [];
  }
};

module.exports = { saveMessage, getRecentHistory };
