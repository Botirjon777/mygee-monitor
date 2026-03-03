const cron = require('node-cron');
const userService = require('./userService');
const { generateFinancialTip } = require('../utils/ai');

const initScheduler = (bot) => {
  // Morning Tip: 08:00
  cron.schedule('0 8 * * *', async () => {
    console.log('Running 08:00 Morning Tip job...');
    try {
      const tip = await generateFinancialTip();
      const users = await userService.getAllUsers();
      
      for (const user of users) {
        if (user.telegramId) {
          await bot.sendMessage(user.telegramId, tip, { parse_mode: 'Markdown' });
        }
      }
    } catch (err) {
      console.error('Error in 08:00 Tip job:', err);
    }
  });

  // Evening Reminder: 20:00
  cron.schedule('0 20 * * *', async () => {
    console.log('Running 20:00 Evening Reminder job...');
    try {
      const users = await userService.getAllUsers();
      const reminder = "🌙 **Evening Reminder**: Don't forget to record your expenses for today! Just type them here.";
      
      for (const user of users) {
        if (user.telegramId) {
          await bot.sendMessage(user.telegramId, reminder, { parse_mode: 'Markdown' });
        }
      }
    } catch (err) {
      console.error('Error in 20:00 Reminder job:', err);
    }
  });

  console.log('Scheduler initialized (08:00 Tip, 20:00 Reminder)');
};

module.exports = { initScheduler };
