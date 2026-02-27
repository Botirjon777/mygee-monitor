const ollama = require('ollama');
require('dotenv').config();

const model = process.env.OLLAMA_MODEL || 'mistral';

/**
 * Categorizes a natural language spending description using Ollama, with context.
 * @param {string} text - The input text from the user.
 * @param {Array} history - Recent chat history [{role, content}].
 * @returns {Promise<Object>} - The categorized transaction data.
 */
const categorizeTransaction = async (text, history = []) => {
  const contextString = history.length > 0 
    ? history.map(h => `${h.role}: ${h.content}`).join('\n')
    : "No previous context.";

  const prompt = `
    You are a financial assistant bot. Categorize the following user input into a transaction.
    
    Conversation history for context:
    ${contextString}

    Current User Input: "${text}"

    Respond ONLY with a JSON object in the following format:
    {
      "transactions": [
        {
          "amount": number,
          "description": "string",
          "category": "one of [Food, Gas, Bills, Entertainment, General, Taxi, Alcohol, Cigarettes, Shopping, Income, Others]",
          "type": "either 'expense' or 'income'"
        }
      ]
    }

    Instructions:
    - If the user provides multiple expenses or incomes in one message, list them all in the "transactions" array.
    - If it's about meals, groceries, or eating (even with friends), use 'Food'.
    - 'Entertainment' is for movies, games, hobbies, etc.
    - 'Income' is for salaries, gifts, etc.
    - Output ONLY the JSON.

    Example Input: "20000 for lunch and 50000 for taxi"
    Example Output: {
      "transactions": [
        {"amount": 20000, "description": "lunch", "category": "Food", "type": "expense"},
        {"amount": 50000, "description": "taxi", "category": "Taxi", "type": "expense"}
      ]
    }
  `;

  try {
    const response = await ollama.default.chat({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      format: 'json'
    });

    return JSON.parse(response.message.content);
  } catch (err) {
    console.error(`AI Categorization Error: ${err.message}`);
    return null;
  }
};

/**
 * Checks for spending warnings based on category and amount.
 * @param {string} category 
 * @param {number} amount 
 * @returns {string|null} - Warning message or null if safe.
 */
const checkWarnings = (category, amount) => {
  const warnings = {
    'Gaming': { limit: 50000, msg: "You're spending too much on gaming!" },
    'Alcohol': { limit: 30000, msg: "Take it easy on the alcohol, it's getting expensive." },
    'Cigarettes': { limit: 20000, msg: "Cigarettes are bad for your health and wallet." },
    'Eating': { limit: 100000, msg: "You've spent a lot on eating out lately." }
  };

  const rule = warnings[category];
  if (rule && amount >= rule.limit) {
    return rule.msg;
  }
  return null;
};

module.exports = { categorizeTransaction, checkWarnings };
