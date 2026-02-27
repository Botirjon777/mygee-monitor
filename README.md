# Expense Monitoring Bot

## Setup

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Edit `.env` and provide:
   - `MONGODB_URI`: Your MongoDB connection string.
   - `TELEGRAM_BOT_TOKEN`: Your bot token from BotFather.
   - `OLLAMA_MODEL`: Set to `mistral:7b`.

3. **Run Ollama**:
   Ensure Ollama is running and the model is pulled:

   ```bash
   ollama pull mistral:7b
   ollama serve
   ```

4. **Run the Bot**:
   - For development (with auto-reload):
     ```bash
     npm run dev
     ```
   - For production:
     ```bash
     npm run start
     ```

## Usage

- Send `/start` to the bot on Telegram.
- Send messages like:
  - "I spend 20000 sum for eating"
  - "150000 for gas car"
  - "100000 for electricity"
- The bot will categorize them and save them to your database.
- Warnings will be sent if you spend too much on certain categories (e.g., Alcohol, Eating outside).
