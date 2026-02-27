const ollama = require('ollama');
require('dotenv').config();

const model = process.env.OLLAMA_MODEL || 'mistral';

/**
 * Categorizes a natural language spending description or answers a question using Ollama.
 * @param {string} text - The input text from the user.
 * @param {Array} history - Recent chat history [{role, content}].
 * @param {string} summary - Current spending summary for context.
 * @returns {Promise<Object>} - The categorized transaction data or chat response.
 */
const categorizeTransaction = async (text, history = [], summary = "No spending data available yet.") => {
  const contextString = history.length > 0 
    ? history.map(h => `${h.role}: ${h.content}`).join('\n')
    : "No previous context.";

  const prompt = `
    You are a financial assistant bot. Analyze the user input and determine the intent.
    
    Intent Options:
    1. "record": **PRIORITY**. Use this if the user provides any numbers/amounts along with descriptions (e.g., "100 for food").
    2. "chat": Use this ONLY if the user is asking a question, seeking advice, or requesting a report WITHOUT providing new transaction data.

    User Spending Summary:
    ${summary}

    Conversation history for context:
    ${contextString}

    Current User Input: "${text}"

    Respond ONLY with a JSON object in the following format:
    {
      "intent": "record" | "chat",
      "transactions": [ // Only if intent is "record"
        {
          "amount": number,
          "description": "string",
          "category": "string",
          "type": "either 'expense' or 'income'"
        }
      ],
      "answer": "string" // Only if intent is "chat"
    }

    Instructions:
    - If "record": List ALL specific items mentioned with their amounts. Ensure 'type' is 'expense' or 'income' and 'amount' is a positive number.
    - **Categories**: [Food, Transport, Healthcare, Internet, Utilities, Shopping, Entertainment, Bills, Alcohol, Cigarettes, Income, Others]
    - **Categorization Rules**:
      - **Food**: meals, groceries, snacks, restaurants, coffee.
      - **Transport**: taxi, bus, metro, train, parking.
      - **Healthcare**: medicine, pharmacy, clinics, doctors, hospital.
      - **Internet**: wifi, mobile data, internet bills.
    - If "chat": Use the "User Spending Summary" to provide an accurate and helpful answer.
    - **Formatting**: Ensure all Markdown symbols (like stars, underscores, or backticks) are correctly closed.
    - Output ONLY the JSON.

    Example (record): "50000 for taxi and 150000 for medicine" -> {"intent": "record", "transactions": [{"amount": 50000, "description": "taxi", "category": "Transport", "type": "expense"}, {"amount": 150000, "description": "medicine", "category": "Healthcare", "type": "expense"}]}
    Example (chat): "How much did I spend?" -> {"intent": "chat", "answer": "Based on your records, your total spending is..."}
  `;

  try {
    const response = await ollama.default.chat({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      format: 'json'
    });

    return JSON.parse(response.message.content);
  } catch (err) {
    console.error(`AI Analysis Error: ${err.message}`);
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
