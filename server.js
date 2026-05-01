require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ CONEXIÓN A MONGODB ============
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/finance-tracker';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// ============ MODELOS DE DATOS ============

const transactionSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  type: { type: String, enum: ['ingreso', 'gasto'], required: true },
  date: { type: String, required: true },
  userId: { type: String, default: 'default' },
  createdAt: { type: Date, default: Date.now }
});

const profileSchema = new mongoose.Schema({
  userId: { type: String, default: 'default', unique: true },
  monthlyIncome: { type: Number, default: 0 },
  incomeFrequency: { type: String, enum: ['semanal', 'quincenal', 'mensual'], default: 'mensual' },
  rent: { type: Number, default: 0 },
  services: { type: Number, default: 0 },
  groceries: { type: Number, default: 0 },
  transport: { type: Number, default: 0 },
  hasDebt: { type: Boolean, default: false },
  debtAmount: { type: Number, default: 0 },
  debtInterest: { type: Number, default: 0 },
  savings: { type: Number, default: 0 },
  goal: { type: String, default: 'ahorro' },
  projectionMonths: { type: Number, default: 12 },
  updatedAt: { type: Date, default: Date.now }
});

const categorySchema = new mongoose.Schema({
  userId: { type: String, default: 'default' },
  categories: { type: [String], default: ['Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Educación', 'Otros'] }
});

const Transaction = mongoose.model('Transaction', transactionSchema);
const Profile = mongoose.model('Profile', profileSchema);
const Category = mongoose.model('Category', categorySchema);

// Inicializar Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.json());
app.use(express.static('public'));

// Tasas de cambio
const exchangeRates = {
  USD: 1, EUR: 0.92, MXN: 17.50, COP: 4000, ARS: 850, GBP: 0.79
};

// ============ FUNCIONES AUXILIARES ============
function getCategoryEmoji(category) {
  const emojis = {
    'Comida': '🍔', 'Transporte': '🚗', 'Entretenimiento': '🎬',
    'Servicios': '💡', 'Salud': '🏥', 'Educación': '📚', 'Otros': '📦'
  };
  return emojis[category] || '📊';
}

// ============ ENDPOINTS ============

// Clasificación con IA
app.post('/api/ai/classify', async (req, res) => {
  try {
    const { description, amount } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const categoriesDoc = await Category.findOne({ userId: 'default' });
    const categories = categoriesDoc?.categories || ['Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Educación', 'Otros'];

    const prompt = `Clasifica el siguiente gasto en una de estas categorías: ${categories.join(', ')}.
Descripción: "${description}"
Monto: $${amount}
Responde SOLO con el nombre de la categoría más adecuada.`;

    const result = await model.generateContent(prompt);
    const category = result.response.text().trim();
    let validCategory = categories.find(c => c.toLowerCase() === category.toLowerCase());
    if (!validCategory) validCategory = 'Otros';
    res.json({ category: validCategory });
  } catch (error) {
    console.error('AI Classification error:', error);
    res.json({ category: 'Otros' });
  }
});

// Análisis financiero con IA
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { transactions, totalIncome, totalExpenses, balance, currency, userProfile } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    const monthlyIncome = userProfile?.monthlyIncome || totalIncome;
    const rent = userProfile?.rent || 0;
    const services = userProfile?.services || 0;
    const groceries = userProfile?.groceries || 0;
    const transport = userProfile?.transport || 0;
    const fixedExpenses = rent + services + groceries + transport;
    const totalAllExpenses = fixedExpenses + totalExpenses;
    const realBalance = monthlyIncome - totalAllExpenses;
    const savingsRate = monthlyIncome > 0 ? ((realBalance / monthlyIncome) * 100).toFixed(1) : 0;
    
    const categorySummary = {};
    transactions.forEach(t => {
      if (t.type === 'gasto') {
        categorySummary[t.category] = (categorySummary[t.category] || 0) + t.amount;
      }
    });
    
    const prompt = `Eres un ASESOR FINANCIERO EXPERTO. Analiza estos datos reales:

💰 INGRESO MENSUAL: ${currency} ${monthlyIncome.toLocaleString()}
🏠 GASTOS FIJOS: ${currency} ${fixedExpenses.toLocaleString()}
💸 GASTOS VARIABLES: ${currency} ${totalExpenses.toLocaleString()}
⚖️ BALANCE: ${currency} ${realBalance.toLocaleString()}
📈 TASA AHORRO: ${savingsRate}%

Responde con este formato exacto:

🎯 DIAGNÓSTICO (2 líneas)

📊 RADIOGRAFÍA
| Indicador | Tu valor | Ideal |
| Ingreso | ${currency} ${monthlyIncome.toLocaleString()} | - |
| Gastos fijos | ${((fixedExpenses/monthlyIncome)*100).toFixed(1)}% | <50% |
| Tasa ahorro | ${savingsRate}% | 20% |

🔍 TOP 3 CONSEJOS
1. [Consejo específico con números reales]
2. [Segundo consejo personalizado]
3. [Tercer consejo basado en gastos]

💪 COMPROMISO SEMANAL: "Esta semana ahorraré el ${Math.min(20, parseInt(savingsRate)+5)}% de mi ingreso"`;

    const result = await model.generateContent(prompt);
    let recommendations = result.response.text();
    res.json({ recommendations });
  } catch (error) {
    console.error('AI Analysis error:', error);
    res.json({ recommendations: '⚠️ Usando análisis local. Tus datos se guardaron correctamente. Intenta de nuevo en unos segundos.' });
  }
});

// ============ ENDPOINTS CON MONGODB ============

app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: 'default' }).sort({ date: -1 });
    const categoriesDoc = await Category.findOne({ userId: 'default' });
    let categories = categoriesDoc?.categories;
    if (!categories || categories.length === 0) {
      categories = ['Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Educación', 'Otros'];
    }
    res.json({ transactions, categories });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Error fetching data' });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { description, amount, category, type, date } = req.body;
    const newTransaction = new Transaction({
      description,
      amount: parseFloat(amount),
      category: category || 'Otros',
      type,
      date: date || new Date().toISOString().split('T')[0],
      userId: 'default'
    });
    await newTransaction.save();
    res.json({ success: true, transaction: newTransaction });
  } catch (error) {
    console.error('Error saving transaction:', error);
    res.status(500).json({ error: 'Error saving transaction' });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Error deleting transaction' });
  }
});

app.get('/api/profile', async (req, res) => {
  try {
    let profile = await Profile.findOne({ userId: 'default' });
    if (!profile) {
      profile = new Profile({ userId: 'default' });
      await profile.save();
    }
    res.json({ profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

app.post('/api/profile', async (req, res) => {
  try {
    const profile = await Profile.findOneAndUpdate(
      { userId: 'default' },
      { ...req.body, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true, profile });
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({ error: 'Error saving profile' });
  }
});

app.get('/api/rates', (req, res) => {
  res.json({ rates: exchangeRates });
});

app.post('/api/convert', (req, res) => {
  const { amount, from, to } = req.body;
  const amountInUSD = amount / exchangeRates[from];
  const convertedAmount = amountInUSD * exchangeRates[to];
  res.json({ amount: convertedAmount, rate: exchangeRates[to] / exchangeRates[from] });
});

app.listen(PORT, () => {
  console.log(`🚀 FinanceTracker AI corriendo en http://localhost:${PORT}`);
});