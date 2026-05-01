require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.json());
app.use(express.static('public'));

// In-memory storage (for demo purposes)
let transactions = [];
let categories = ['Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Educación', 'Otros'];

// Currency exchange rates (USD base)
const exchangeRates = {
  USD: 1,
  EUR: 0.92,
  MXN: 17.50,
  COP: 4000,
  ARS: 850,
  GBP: 0.79
};

// AI Classification endpoint
app.post('/api/ai/classify', async (req, res) => {
  try {
    const { description, amount } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    const prompt = `Clasifica el siguiente gasto en una de estas categorías: ${categories.join(', ')}.
    Descripción: "${description}"
    Monto: $${amount}
    
    Responde SOLO con el nombre de la categoría más adecuada.`;
    
    const result = await model.generateContent(prompt);
    const category = result.response.text().trim();
    
    // Validate category exists
    const validCategory = categories.find(c => c.toLowerCase() === category.toLowerCase()) || 'Otros';
    
    res.json({ category: validCategory });
  } catch (error) {
    console.error('AI Classification error:', error);
    res.json({ category: 'Otros' });
  }
});

// AI Financial Analysis endpoint
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { transactions, totalIncome, totalExpenses, balance } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    // Prepare transaction summary
    const categorySummary = {};
    transactions.forEach(t => {
      if (t.type === 'gasto') {
        categorySummary[t.category] = (categorySummary[t.category] || 0) + t.amount;
      }
    });
    
    const prompt = `Analiza estos datos financieros personales y da 3 recomendaciones específicas para mejorar el ahorro:
    
    Ingresos totales: $${totalIncome}
    Gastos totales: $${totalExpenses}
    Balance: $${balance}
    
    Gastos por categoría:
    ${Object.entries(categorySummary).map(([cat, amt]) => `- ${cat}: $${amt}`).join('\n')}
    
    Responde en español con recomendaciones prácticas y concisas. Formato: lista numerada.`;
    
    const result = await model.generateContent(prompt);
    const recommendations = result.response.text();
    
    res.json({ recommendations });
  } catch (error) {
    console.error('AI Analysis error:', error);
    res.json({ recommendations: '1. Registra todos tus gastos diariamente\n2. Establece un presupuesto por categorías\n3. Ahorra al menos el 10% de tus ingresos' });
  }
});

// Get all transactions
app.get('/api/transactions', (req, res) => {
  res.json({ transactions, categories });
});

// Add transaction
app.post('/api/transactions', (req, res) => {
  const { description, amount, category, type, date } = req.body;
  const newTransaction = {
    id: Date.now(),
    description,
    amount: parseFloat(amount),
    category,
    type,
    date: date || new Date().toISOString().split('T')[0]
  };
  transactions.push(newTransaction);
  res.json({ success: true, transaction: newTransaction });
});

// Delete transaction
app.delete('/api/transactions/:id', (req, res) => {
  const id = parseInt(req.params.id);
  transactions = transactions.filter(t => t.id !== id);
  res.json({ success: true });
});

// Get exchange rates
app.get('/api/rates', (req, res) => {
  res.json({ rates: exchangeRates });
});

// Convert currency
app.post('/api/convert', (req, res) => {
  const { amount, from, to } = req.body;
  const amountInUSD = amount / exchangeRates[from];
  const convertedAmount = amountInUSD * exchangeRates[to];
  res.json({ amount: convertedAmount, rate: exchangeRates[to] / exchangeRates[from] });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});