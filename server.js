require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ CONFIGURACIÓN DE ARCHIVOS JSON ============
const DATA_DIR = path.join(__dirname, 'data');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const PROFILE_FILE = path.join(DATA_DIR, 'profile.json');

// Crear directorio data si no existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Crear archivos si no existen
if (!fs.existsSync(TRANSACTIONS_FILE)) {
  fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify([], null, 2));
}

if (!fs.existsSync(PROFILE_FILE)) {
  const defaultProfile = {
    userId: 'default',
    monthlyIncome: 0,
    incomeFrequency: 'mensual',
    rent: 0,
    services: 0,
    groceries: 0,
    transport: 0,
    hasDebt: false,
    debtAmount: 0,
    debtInterest: 0,
    savings: 0,
    goal: 'ahorro',
    projectionMonths: 12,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(defaultProfile, null, 2));
}

// ============ FUNCIONES DE LECTURA/ESCRITURA ============

function readTransactions() {
  try {
    const data = fs.readFileSync(TRANSACTIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error leyendo transacciones:', error);
    return [];
  }
}

function writeTransactions(transactions) {
  try {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
    return true;
  } catch (error) {
    console.error('Error guardando transacciones:', error);
    return false;
  }
}

function readProfile() {
  try {
    const data = fs.readFileSync(PROFILE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error leyendo perfil:', error);
    return {
      userId: 'default',
      monthlyIncome: 0,
      incomeFrequency: 'mensual',
      rent: 0,
      services: 0,
      groceries: 0,
      transport: 0,
      hasDebt: false,
      debtAmount: 0,
      debtInterest: 0,
      savings: 0,
      goal: 'ahorro',
      projectionMonths: 12
    };
  }
}

function writeProfile(profile) {
  try {
    profile.updatedAt = new Date().toISOString();
    fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2));
    return true;
  } catch (error) {
    console.error('Error guardando perfil:', error);
    return false;
  }
}

// ============ INICIALIZAR GEMINI ============
let genAI = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'tu_api_key_aqui' && apiKey.length > 10) {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Gemini IA inicializada');
  } else {
    console.log('⚠️ No hay API Key válida de Gemini, usando modo local');
  }
} catch (error) {
  console.log('⚠️ Error inicializando Gemini:', error.message);
}

app.use(express.json());
app.use(express.static('public'));

// Tasas de cambio
const exchangeRates = {
  USD: 1, EUR: 0.92, MXN: 17.50, COP: 4000, ARS: 850, GBP: 0.79
};

// ============ FUNCIÓN DE ANÁLISIS LOCAL ============
function generarAnalisisLocal(monthlyIncome, totalExpenses, balance, savingsRate, fixedExpenses, userProfile, currency) {
  const goalText = {
    'ahorro': 'ahorrar para emergencias',
    'casa': 'comprar casa',
    'auto': 'comprar auto',
    'viaje': 'hacer un viaje',
    'invertir': 'invertir',
    'libertad': 'libertad financiera',
    'deudas': 'pagar deudas'
  };
  
  let analysis = `🎯 **DIAGNÓSTICO FINANCIERO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Basado en tus datos, tu tasa de ahorro actual es del ${savingsRate}%. `;
  
  if (savingsRate >= 20) {
    analysis += `¡Excelente! Estás por encima del promedio.`;
  } else if (savingsRate >= 10) {
    analysis += `Vas por buen camino, pero puedes llegar al 20%.`;
  } else {
    analysis += `Necesitas aumentar tu ahorro urgentemente.`;
  }

  analysis += `\n\n📊 **RADIOGRAFÍA FINANCIERA**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Indicador | Tu valor | Ideal | Estatus |
|-----------|----------|-------|---------|
| Tasa de ahorro | ${savingsRate}% | 20% | ${savingsRate >= 20 ? '✅ Excelente' : savingsRate >= 10 ? '⚠️ Mejorable' : '🔴 Crítica'} |
| Gastos fijos | ${((fixedExpenses/monthlyIncome)*100).toFixed(1)}% | <50% | ${fixedExpenses/monthlyIncome <= 0.5 ? '✅ Controlado' : '🔴 Excesivo'} |

🔍 **3 RECOMENDACIONES PRIORITARIAS**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 🎯 **Automatiza tu ahorro**
   Configura una transferencia automática del ${Math.min(20, parseInt(savingsRate) + 10)}% de tu ingreso el día que te pagan.

2. 💡 **Reduce gastos fijos**
   Revisa tus suscripciones y servicios. Intenta reducir un 10% este mes.

3. 📊 **Control de gastos hormiga**
   Registra todos los gastos menores durante 30 días. Identifica patrones.

💼 **ESTRATEGIA PARA ${(userProfile?.projectionMonths || 12)} MESES**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Meta: ${goalText[userProfile?.goal] || 'mejorar finanzas'}**

• **Semana 1:** Abre una cuenta separada para ahorro (sin tarjeta de débito)
• **Semana 2:** Reduce 20% tu categoría de mayor gasto
• **Semana 3-4:** Construye fondo de emergencia de 3 meses

💰 **PROYECCIÓN DE AHORRO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Ahorro actual: ${currency} ${(userProfile?.savings || 0).toLocaleString()}
• Meta en ${userProfile?.projectionMonths || 12} meses: ${currency} ${(((userProfile?.savings || 0) + (monthlyIncome * 0.2 * (userProfile?.projectionMonths || 12)))).toLocaleString()}`;

  if (userProfile?.hasDebt && userProfile?.debtAmount > 0) {
    analysis += `\n\n💳 **ESTRATEGIA DE DEUDAS**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Destina el 30% de tu balance mensual a pagar deudas
• Método: Paga primero la deuda con mayor tasa de interés
• Tiempo estimado: ${Math.ceil(userProfile.debtAmount / (balance * 0.3))} meses libre de deudas`;
  }

  analysis += `\n\n🎓 **CONSEJO DE EXPERTO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"El dinero que no gastas hoy y lo inviertes, se multiplica solo. Cada peso que ahorras es un empleado que trabaja 24/7 para ti."

💪 **COMPROMISO SEMANAL**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"Esta semana ahorraré el ${Math.min(20, parseInt(savingsRate) + 5)}% de mi próximo ingreso ANTES de gastar."`;

  return analysis;
}

// ============ ENDPOINTS ============

// Análisis financiero con IA
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { transactions, userProfile, currency } = req.body;
    
    const monthlyIncome = userProfile?.monthlyIncome || 0;
    const rent = userProfile?.rent || 0;
    const services = userProfile?.services || 0;
    const groceries = userProfile?.groceries || 0;
    const transport = userProfile?.transport || 0;
    const fixedExpenses = rent + services + groceries + transport;
    const variableExpenses = (transactions || []).filter(t => t.type === 'gasto').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = fixedExpenses + variableExpenses;
    const balance = monthlyIncome - totalExpenses;
    const savingsRate = monthlyIncome > 0 ? ((balance / monthlyIncome) * 100).toFixed(1) : 0;
    
    // Calcular categorías
    const categorySummary = {};
    (transactions || []).filter(t => t.type === 'gasto').forEach(t => {
      categorySummary[t.category] = (categorySummary[t.category] || 0) + t.amount;
    });
    const topCategory = Object.entries(categorySummary).sort((a, b) => b[1] - a[1])[0];
    
    // Si no hay IA, usar análisis local
    if (!genAI) {
      return res.json({ recommendations: generarAnalisisLocal(monthlyIncome, totalExpenses, balance, savingsRate, fixedExpenses, userProfile, currency) });
    }
    
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `Eres un ASESOR FINANCIERO EXPERTO con 10+ años de experiencia.

DATOS DEL CLIENTE:
💰 Ingreso mensual: ${currency} ${monthlyIncome.toLocaleString()}
🏠 Gastos fijos: ${currency} ${fixedExpenses.toLocaleString()}
💸 Gastos variables: ${currency} ${variableExpenses.toLocaleString()}
⚖️ Balance: ${currency} ${balance.toLocaleString()}
📈 Tasa de ahorro: ${savingsRate}%
🎯 Meta: ${userProfile?.goal || 'mejorar finanzas'}
${topCategory ? `🔥 Mayor gasto: ${topCategory[0]} (${currency} ${topCategory[1].toLocaleString()})` : ''}

Da 3 recomendaciones específicas con este formato:
**1.** [Recomendación con números]
**2.** [Segunda recomendación]
**3.** [Tercera recomendación]

Además, da una frase motivacional personalizada.`;

    const result = await model.generateContent(prompt);
    const recommendations = result.response.text();
    res.json({ recommendations });
    
  } catch (error) {
    console.error('Error en análisis IA:', error.message);
    const { transactions, userProfile, currency } = req.body;
    const monthlyIncome = userProfile?.monthlyIncome || 0;
    const rent = userProfile?.rent || 0;
    const services = userProfile?.services || 0;
    const groceries = userProfile?.groceries || 0;
    const transport = userProfile?.transport || 0;
    const fixedExpenses = rent + services + groceries + transport;
    const variableExpenses = (transactions || []).filter(t => t.type === 'gasto').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = fixedExpenses + variableExpenses;
    const balance = monthlyIncome - totalExpenses;
    const savingsRate = monthlyIncome > 0 ? ((balance / monthlyIncome) * 100).toFixed(1) : 0;
    res.json({ recommendations: generarAnalisisLocal(monthlyIncome, totalExpenses, balance, savingsRate, fixedExpenses, userProfile, currency) });
  }
});

// ============ CRUD TRANSACCIONES ============

app.get('/api/transactions', (req, res) => {
  try {
    const transactions = readTransactions();
    console.log(`📡 Enviando ${transactions.length} transacciones`);
    res.json({ 
      transactions, 
      categories: ['Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Educacion', 'Otros'] 
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.json({ transactions: [], categories: ['Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Educacion', 'Otros'] });
  }
});

app.post('/api/transactions', (req, res) => {
  try {
    console.log('📥 Recibiendo transacción:', req.body);
    
    const { description, amount, category, type, date } = req.body;
    
    if (!description || !amount || !category || !type) {
      return res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
    }
    
    const transactions = readTransactions();
    
    const newTransaction = {
      _id: Date.now().toString(),
      description: String(description),
      amount: Number(amount),
      category: String(category),
      type: type === 'ingreso' ? 'ingreso' : 'gasto',
      date: date || new Date().toISOString().split('T')[0],
      userId: 'default',
      createdAt: new Date().toISOString()
    };
    
    transactions.unshift(newTransaction);
    writeTransactions(transactions);
    
    console.log('✅ Transacción guardada:', newTransaction._id);
    res.json({ success: true, transaction: newTransaction });
    
  } catch (error) {
    console.error('❌ Error en POST /api/transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/transactions/:id', (req, res) => {
  try {
    const id = req.params.id;
    let transactions = readTransactions();
    transactions = transactions.filter(t => t._id !== id);
    writeTransactions(transactions);
    console.log('✅ Transacción eliminada:', id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PERFIL DE USUARIO ============

app.get('/api/profile', (req, res) => {
  try {
    const profile = readProfile();
    console.log('📡 Perfil enviado');
    res.json({ profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.json({ profile: {
      monthlyIncome: 0,
      incomeFrequency: 'mensual',
      rent: 0,
      services: 0,
      groceries: 0,
      transport: 0,
      hasDebt: false,
      debtAmount: 0,
      debtInterest: 0,
      savings: 0,
      goal: 'ahorro',
      projectionMonths: 12
    } });
  }
});

app.post('/api/profile', (req, res) => {
  try {
    console.log('📥 Guardando perfil:', req.body);
    const profile = req.body;
    profile.userId = 'default';
    writeProfile(profile);
    console.log('✅ Perfil guardado');
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ TASAS DE CAMBIO ============
app.get('/api/rates', (req, res) => {
  res.json({ rates: exchangeRates });
});

app.post('/api/convert', (req, res) => {
  const { amount, from, to } = req.body;
  const amountInUSD = amount / exchangeRates[from];
  const convertedAmount = amountInUSD * exchangeRates[to];
  res.json({ amount: convertedAmount, rate: exchangeRates[to] / exchangeRates[from] });
});

// ============ INICIAR SERVIDOR ============
app.listen(PORT, () => {
  console.log(`🚀 FinanceTracker AI corriendo en http://localhost:${PORT}`);
  console.log(`🤖 IA: ${genAI ? 'ACTIVA (Gemini)' : 'DESACTIVADA (usando modo local experto)'}`);
  console.log(`💾 Datos guardados en: ${DATA_DIR}`);
  console.log(`📁 Archivos: transactions.json y profile.json`);
});