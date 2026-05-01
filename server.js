require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ CONEXIÓN A MONGODB ============
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/finance-tracker';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Conectado a MongoDB Atlas'))
.catch(err => console.error('❌ Error conectando a MongoDB:', err));

// ============ MODELOS DE DATOS ============

// Esquema de Transacción
const transactionSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  type: { type: String, enum: ['ingreso', 'gasto'], required: true },
  date: { type: String, required: true },
  userId: { type: String, default: 'default' },
  createdAt: { type: Date, default: Date.now }
});

// Esquema de Perfil de Usuario
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

// Esquema de Categorías
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
  USD: 1,
  EUR: 0.92,
  MXN: 17.50,
  COP: 4000,
  ARS: 850,
  GBP: 0.79
};

// ============ FUNCIONES AUXILIARES ============

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getCategoryEmoji(category) {
  const emojis = {
    'Comida': '🍔',
    'Transporte': '🚗',
    'Entretenimiento': '🎬',
    'Servicios': '💡',
    'Salud': '🏥',
    'Educación': '📚',
    'Otros': '📦'
  };
  return emojis[category] || '📊';
}

function getBenchmarkByCategory(category) {
  const benchmarks = {
    'Comida': 15,
    'Transporte': 10,
    'Entretenimiento': 8,
    'Servicios': 12,
    'Salud': 5,
    'Educación': 5,
    'Otros': 10
  };
  return benchmarks[category] || 10;
}

function getCategoryAdvice(category) {
  const advice = {
    'Comida': 'Reduce comidas fuera: cocina 2 veces más por semana → ahorro del 40%',
    'Transporte': 'Usa transporte público 3 días por semana → ahorra 30-50%',
    'Entretenimiento': 'Reemplaza 2 salidas mensuales por actividades gratis → ahorra 60%',
    'Servicios': 'Negocia tus suscripciones cada 6 meses → ahorra 15-25%',
    'Salud': 'Prevención > cura: ejercicio y chequeos anuales reducen gastos mayores',
    'Educación': 'Invierte en habilidades que aumenten ingresos, no solo gastes',
    'Otros': 'Clasifica estos gastos mejor para identificar oportunidades reales'
  };
  return advice[category] || 'Revisa si cada gasto añade valor real a tu vida';
}

function calculateAntSavings(smallFrequent, allTransactions) {
  let total = 0;
  Object.keys(smallFrequent).forEach(desc => {
    const amount = allTransactions
      .filter(t => t.description === desc && t.type === 'gasto')
      .reduce((sum, t) => sum + t.amount, 0);
    total += amount * 0.7;
  });
  return total;
}

// ============ ENDPOINTS ============

// Clasificación con IA
app.post('/api/ai/classify', async (req, res) => {
  try {
    const { description, amount } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    // Obtener categorías del usuario
    const categoriesDoc = await Category.findOne({ userId: 'default' });
    const categories = categoriesDoc?.categories || ['Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Educación', 'Otros'];

    const prompt = `Clasifica el siguiente gasto en una de estas categorías: ${categories.join(', ')}.
Descripción: "${description}"
Monto: $${amount}

Responde SOLO con el nombre de la categoría más adecuada.`;

    const result = await model.generateContent(prompt);
    const category = result.response.text().trim();
    const validCategory = categories.find(c => c.toLowerCase() === category.toLowerCase()) || 'Otros';
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
    const incomeFrequency = userProfile?.incomeFrequency || 'mensual';
    const rent = userProfile?.rent || 0;
    const services = userProfile?.services || 0;
    const groceries = userProfile?.groceries || 0;
    const transport = userProfile?.transport || 0;
    const fixedExpenses = rent + services + groceries + transport;
    const hasDebt = userProfile?.hasDebt || false;
    const debtAmount = userProfile?.debtAmount || 0;
    const debtInterest = userProfile?.debtInterest || 0;
    const savings = userProfile?.savings || 0;
    const goal = userProfile?.goal || 'ahorro';
    const projectionMonths = userProfile?.projectionMonths || 12;
    const emergencyFundMonths = userProfile?.emergencyFundMonths || 0;
    
    const categorySummary = {};
    let totalExpensesCount = 0;
    
    transactions.forEach(t => {
      if (t.type === 'gasto') {
        totalExpensesCount++;
        categorySummary[t.category] = (categorySummary[t.category] || 0) + t.amount;
      }
    });
    
    const totalVariableExpenses = totalExpenses;
    const totalAllExpenses = fixedExpenses + totalVariableExpenses;
    const realBalance = monthlyIncome - totalAllExpenses;
    const savingsRate = monthlyIncome > 0 ? ((realBalance / monthlyIncome) * 100).toFixed(1) : 0;
    const expenseToIncomeRatio = monthlyIncome > 0 ? ((totalAllExpenses / monthlyIncome) * 100).toFixed(1) : 0;
    
    const topCategory = Object.entries(categorySummary).sort((a, b) => b[1] - a[1])[0];
    const topPercentage = topCategory ? ((topCategory[1] / totalVariableExpenses) * 100).toFixed(1) : 0;
    const benchmarkTop = topCategory ? getBenchmarkByCategory(topCategory[0]) : 10;
    
    const largeExpenses = transactions
      .filter(t => t.type === 'gasto' && t.amount > monthlyIncome * 0.1)
      .sort((a, b) => b.amount - a.amount);
    
    const smallFrequentExpenses = transactions
      .filter(t => t.type === 'gasto' && t.amount < (monthlyIncome * 0.02))
      .reduce((acc, t) => {
        acc[t.description] = (acc[t.description] || 0) + 1;
        return acc;
      }, {});
    
    const frequencyText = { 'semanal': 'semanal', 'quincenal': 'quincenal', 'mensual': 'mensual' };
    const goalMap = {
      'ahorro': 'Ahorrar para emergencias',
      'casa': 'Comprar casa/departamento',
      'auto': 'Comprar auto',
      'viaje': 'Hacer un viaje',
      'invertir': 'Invertir y hacer crecer mi dinero',
      'libertad': 'Libertad financiera',
      'deudas': 'Pagar deudas'
    };
    
    const prompt = `Eres un ASESOR FINANCIERO SENIOR con más de 10 AÑOS DE EXPERIENCIA.

DATOS REALES DEL CLIENTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 FRECUENCIA: ${frequencyText[incomeFrequency] || 'mensual'}
💰 INGRESO MENSUAL: ${currency} ${monthlyIncome.toLocaleString()}

📋 GASTOS FIJOS MENSUALES:
• Renta: ${currency} ${rent.toLocaleString()}
• Servicios: ${currency} ${services.toLocaleString()}
• Supermercado: ${currency} ${groceries.toLocaleString()}
• Transporte: ${currency} ${transport.toLocaleString()}
• TOTAL FIJOS: ${currency} ${fixedExpenses.toLocaleString()}

💸 GASTOS VARIABLES: ${currency} ${totalVariableExpenses.toLocaleString()}
💰 TOTAL GASTOS: ${currency} ${totalAllExpenses.toLocaleString()}
⚖️ BALANCE: ${currency} ${realBalance.toLocaleString()}
📈 TASA AHORRO: ${savingsRate}%

🎯 META: ${goalMap[goal] || goal}
💰 AHORROS: ${currency} ${savings.toLocaleString()}
📅 PROYECCIÓN: ${projectionMonths} meses

${hasDebt && debtAmount > 0 ? `⚠️ DEUDAS: ${currency} ${debtAmount.toLocaleString()} al ${debtInterest}% anual` : '✅ SIN DEUDAS'}

${emergencyFundMonths > 0 ? `🚨 FONDO EMERGENCIA: ${emergencyFundMonths} meses` : '🚨 SIN FONDO DE EMERGENCIA'}

📊 GASTOS POR CATEGORÍA:
${Object.entries(categorySummary).map(([cat, amt]) => {
  const percentage = totalVariableExpenses > 0 ? ((amt / totalVariableExpenses) * 100).toFixed(1) : 0;
  return `• ${cat}: ${currency} ${amt.toFixed(2)} (${percentage}%)`;
}).join('\n')}

Genera un análisis FINANCIERO PROFESIONAL con este formato:

🎯 DIAGNÓSTICO EJECUTIVO
(2-3 oraciones directas)

📊 RADIOGRAFÍA FINANCIERA
| Indicador | Valor | Benchmark | Estatus |
| Tasa ahorro | ${savingsRate}% | 20% | ${savingsRate >= 20 ? '✅' : savingsRate >= 10 ? '⚠️' : '🔴'} |
| Gastos fijos | ${((fixedExpenses/monthlyIncome)*100).toFixed(1)}% | <50% | ${fixedExpenses/monthlyIncome > 0.5 ? '🔴' : '✅'} |

🔍 TOP 3 FILTRACIONES
1. [Basado en datos reales]
2. [Segunda filtración]
3. [Tercera filtración]

💼 ESTRATEGIA PARA ${projectionMonths} MESES
SEMANA 1: Acción específica
SEMANA 2: Segunda acción
SEMANA 3-4: Acciones finales

💰 PROYECCIÓN
Ahorro actual: ${currency} ${savings.toLocaleString()}
Meta en ${projectionMonths} meses: ${currency} ${(savings + (monthlyIncome * 0.2 * projectionMonths)).toLocaleString()}

${hasDebt && debtAmount > 0 ? `💳 ESTRATEGIA DE DEUDAS
• Paga la deuda con mayor interés primero
• Tiempo estimado: ${Math.ceil(debtAmount / (realBalance * 0.3))} meses
` : ''}

🎓 CONSEJO DE EXPERTO
(Frase motivacional específica)

💪 COMPROMISO SEMANAL
(Frase que rete al cliente)`;

    const result = await model.generateContent(prompt);
    let recommendations = result.response.text();
    recommendations = recommendations.replace(/\*\*/g, '').replace(/\\boxed\{/g, '').replace(/\}/g, '');
    
    res.json({ recommendations });
    
  } catch (error) {
    console.error('AI Analysis error:', error);
    res.json({ recommendations: generateFallbackAnalysis(req.body) });
  }
});

function generateFallbackAnalysis(data) {
  const { currency = '$', userProfile = {} } = data;
  const monthlyIncome = userProfile.monthlyIncome || 0;
  const savings = userProfile.savings || 0;
  const savingsRate = monthlyIncome > 0 ? (( (monthlyIncome - (userProfile.rent+userProfile.services+userProfile.groceries+userProfile.transport)) / monthlyIncome) * 100).toFixed(1) : 0;
  
  return `🎯 DIAGNÓSTICO EJECUTIVO
Basado en tus datos, tu tasa de ahorro actual es del ${savingsRate}%.

📊 RADIOGRAFÍA FINANCIERA
| Indicador | Tu valor | Benchmark | Estatus |
| Tasa ahorro | ${savingsRate}% | 20% | ${savingsRate >= 20 ? '✅ Excelente' : savingsRate >= 10 ? '⚠️ Mejorable' : '🔴 Crítica'} |

💼 ESTRATEGIA DE 30 DÍAS
SEMANA 1: Automatiza ahorro del 15% de tu ingreso
SEMANA 2: Reduce 20% tu categoría de mayor gasto
SEMANA 3-4: Construye fondo de emergencia

💰 PROYECCIÓN
Ahorro actual: ${currency}${savings.toLocaleString()}
Meta a 12 meses: ${currency}${(savings + (monthlyIncome * 0.2 * 12)).toLocaleString()}

💪 COMPROMISO
"Esta semana ahorraré el 15% de mi ingreso antes de gastar."`;
}

// ============ ENDPOINTS CON MONGODB ============

// Obtener todas las transacciones
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: 'default' }).sort({ date: -1 });
    const categoriesDoc = await Category.findOne({ userId: 'default' });
    const categories = categoriesDoc?.categories || ['Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Educación', 'Otros'];
    res.json({ transactions, categories });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Error fetching data' });
  }
});

// Agregar transacción
app.post('/api/transactions', async (req, res) => {
  try {
    const { description, amount, category, type, date } = req.body;
    const newTransaction = new Transaction({
      description,
      amount: parseFloat(amount),
      category,
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

// Eliminar transacción
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await Transaction.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Error deleting transaction' });
  }
});

// Obtener perfil del usuario
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

// Guardar perfil del usuario
app.post('/api/profile', async (req, res) => {
  try {
    const profileData = req.body;
    const profile = await Profile.findOneAndUpdate(
      { userId: 'default' },
      { ...profileData, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true, profile });
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({ error: 'Error saving profile' });
  }
});

// Obtener tasas de cambio
app.get('/api/rates', (req, res) => {
  res.json({ rates: exchangeRates });
});

// Convertir moneda
app.post('/api/convert', (req, res) => {
  const { amount, from, to } = req.body;
  const amountInUSD = amount / exchangeRates[from];
  const convertedAmount = amountInUSD * exchangeRates[to];
  res.json({ amount: convertedAmount, rate: exchangeRates[to] / exchangeRates[from] });
});

// ============ INICIAR SERVIDOR ============
app.listen(PORT, () => {
  console.log(`🚀 FinanceTracker AI - Asesor Financiero con IA`);
  console.log(`📊 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`💾 Base de datos: ${MONGODB_URI.includes('localhost') ? 'Local' : 'MongoDB Atlas'}`);
});