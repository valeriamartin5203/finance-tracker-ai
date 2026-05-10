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
});require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ CONFIGURACIÓN DE ARCHIVOS JSON ============
const DATA_DIR = path.join(__dirname, 'data');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const PROFILE_FILE = path.join(DATA_DIR, 'profile.json');
const TAGS_FILE = path.join(DATA_DIR, 'tags.json');
const REMINDERS_FILE = path.join(DATA_DIR, 'reminders.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Crear directorio data si no existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Crear archivos si no existen
const initFile = (file, defaultData) => {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
  }
};

initFile(TRANSACTIONS_FILE, []);
initFile(PROFILE_FILE, { userId: 'default', monthlyIncome: 0, incomeFrequency: 'mensual', rent: 0, services: 0, groceries: 0, transport: 0, hasDebt: false, debtAmount: 0, debtInterest: 0, savings: 0, goal: 'ahorro', projectionMonths: 12 });
initFile(TAGS_FILE, []);
initFile(REMINDERS_FILE, []);
initFile(USERS_FILE, []);

// ============ FUNCIONES DE LECTURA/ESCRITURA ============
const readJSON = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return [];
  }
};

const writeJSON = (file, data) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error escribiendo ${file}:`, error);
    return false;
  }
};

// ============ CONFIGURACIÓN EMAIL ============
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ============ INICIALIZAR GEMINI ============
let genAI = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'tu_api_key_aqui' && apiKey.length > 10) {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Gemini IA inicializada');
  }
} catch (error) {
  console.log('⚠️ Error inicializando Gemini:', error.message);
}

app.use(express.json());
app.use(express.static('public'));

// ============ MIDDLEWARE DE AUTENTICACIÓN ============
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

// ============ FUNCIONES DE ANÁLISIS ============
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
  
  return `🎯 **DIAGNÓSTICO FINANCIERO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Basado en tus datos, tu tasa de ahorro actual es del ${savingsRate}%. ${savingsRate >= 20 ? '¡Excelente!' : savingsRate >= 10 ? 'Vas por buen camino.' : 'Necesitas mejorar.'}

📊 **RADIOGRAFÍA FINANCIERA**
| Indicador | Tu valor | Ideal | Estatus |
| Tasa ahorro | ${savingsRate}% | 20% | ${savingsRate >= 20 ? '✅' : savingsRate >= 10 ? '⚠️' : '🔴'} |
| Gastos fijos | ${((fixedExpenses/monthlyIncome)*100).toFixed(1)}% | <50% | ${fixedExpenses/monthlyIncome <= 0.5 ? '✅' : '🔴'} |

🔍 **3 RECOMENDACIONES**
1. Automatiza ahorro del ${Math.min(20, parseInt(savingsRate) + 10)}% de tu ingreso
2. Reduce gastos fijos en 10% este mes
3. Registra todos tus gastos diariamente

💼 **ESTRATEGIA PARA ${userProfile?.projectionMonths || 12} MESES**
Meta: ${goalText[userProfile?.goal] || 'mejorar finanzas'}

💰 **PROYECCIÓN**
Ahorro actual: ${currency} ${(userProfile?.savings || 0).toLocaleString()}
Meta: ${currency} ${(((userProfile?.savings || 0) + (monthlyIncome * 0.2 * (userProfile?.projectionMonths || 12)))).toLocaleString()}

💪 **COMPROMISO**: "Ahorraré el ${Math.min(20, parseInt(savingsRate) + 5)}% de mi próximo ingreso"`;
}

// ============ ENVÍO DE REPORTE POR EMAIL ============
async function sendWeeklyReport(email, transactions, userProfile, currency) {
  const monthlyIncome = userProfile?.monthlyIncome || 0;
  const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0);
  const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
  const balance = totalIngresos - totalGastos;
  
  const html = `
    <h1>📊 Reporte Semanal FinanceTracker AI</h1>
    <p>Hola, aquí está tu resumen financiero de la semana:</p>
    
    <table style="border-collapse: collapse; width: 100%;">
      <tr style="background: #f0f0f0;">
        <th style="padding: 10px; border: 1px solid #ddd;">Indicador</th>
        <th style="padding: 10px; border: 1px solid #ddd;">Valor</th>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">💰 Ingresos</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${currency} ${totalIngresos.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">💸 Gastos</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${currency} ${totalGastos.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">⚖️ Balance</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${currency} ${balance.toLocaleString()}</td>
      </tr>
    </table>
    
    <p>📅 Ingreso mensual: ${currency} ${monthlyIncome.toLocaleString()}</p>
    <p>🎯 Meta: ${userProfile?.goal || 'Mejorar finanzas'}</p>
    
    <hr>
    <p>💪 Sigue así! Revisa tu progreso en https://finance-tracker-ai.onrender.com</p>
  `;
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: '📊 Tu Reporte Semanal FinanceTracker AI',
    html
  });
}

// ============ ENDPOINTS DE AUTENTICACIÓN ============
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const users = readJSON(USERS_FILE);
    
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Usuario ya existe' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(),
      email,
      name,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    writeJSON(USERS_FILE, users);
    
    const token = jwt.sign({ id: newUser.id, email }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { id: newUser.id, email, name } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.email === email);
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    const token = jwt.sign({ id: user.id, email }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { id: user.id, email, name: user.name } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ENDPOINTS DE TRANSACCIONES ============
app.get('/api/transactions', (req, res) => {
  const transactions = readJSON(TRANSACTIONS_FILE);
  res.json({ transactions, categories: ['Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Educacion', 'Otros'] });
});

app.post('/api/transactions', (req, res) => {
  try {
    const transactions = readJSON(TRANSACTIONS_FILE);
    const newTransaction = {
      _id: Date.now().toString(),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    transactions.unshift(newTransaction);
    writeJSON(TRANSACTIONS_FILE, transactions);
    res.json({ success: true, transaction: newTransaction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/transactions/:id', (req, res) => {
  const transactions = readJSON(TRANSACTIONS_FILE);
  const filtered = transactions.filter(t => t._id !== req.params.id);
  writeJSON(TRANSACTIONS_FILE, filtered);
  res.json({ success: true });
});

// ============ ENDPOINTS DE PRESUPUESTOS ============
app.get('/api/budgets', (req, res) => {
  const budgets = readJSON(path.join(DATA_DIR, 'budgets.json')) || [];
  res.json({ budgets });
});

app.post('/api/budgets', (req, res) => {
  writeJSON(path.join(DATA_DIR, 'budgets.json'), req.body);
  res.json({ success: true });
});

// ============ ENDPOINTS DE ETIQUETAS ============
app.get('/api/tags', (req, res) => {
  const tags = readJSON(TAGS_FILE);
  res.json({ tags });
});

app.post('/api/tags', (req, res) => {
  const tags = readJSON(TAGS_FILE);
  tags.push(req.body);
  writeJSON(TAGS_FILE, tags);
  res.json({ success: true });
});

// ============ ENDPOINTS DE RECORDATORIOS ============
app.get('/api/reminders', (req, res) => {
  const reminders = readJSON(REMINDERS_FILE);
  res.json({ reminders });
});

app.post('/api/reminders', (req, res) => {
  const reminders = readJSON(REMINDERS_FILE);
  reminders.push({ ...req.body, _id: Date.now().toString(), createdAt: new Date().toISOString() });
  writeJSON(REMINDERS_FILE, reminders);
  res.json({ success: true });
});

app.delete('/api/reminders/:id', (req, res) => {
  const reminders = readJSON(REMINDERS_FILE);
  const filtered = reminders.filter(r => r._id !== req.params.id);
  writeJSON(REMINDERS_FILE, filtered);
  res.json({ success: true });
});

// ============ ENDPOINTS DE PERFIL ============
app.get('/api/profile', (req, res) => {
  const profile = readJSON(PROFILE_FILE);
  res.json({ profile });
});

app.post('/api/profile', (req, res) => {
  writeJSON(PROFILE_FILE, req.body);
  res.json({ success: true });
});

// ============ ENDPOINT DE REPORTE POR EMAIL ============
app.post('/api/send-report', async (req, res) => {
  try {
    const { email, transactions, userProfile, currency } = req.body;
    await sendWeeklyReport(email, transactions, userProfile, currency);
    res.json({ success: true });
  } catch (error) {
    console.error('Error enviando email:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ ANÁLISIS CON IA ============
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { transactions, userProfile, currency } = req.body;
    
    const monthlyIncome = userProfile?.monthlyIncome || 0;
    const fixedExpenses = (userProfile?.rent || 0) + (userProfile?.services || 0) + (userProfile?.groceries || 0) + (userProfile?.transport || 0);
    const variableExpenses = (transactions || []).filter(t => t.type === 'gasto').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = fixedExpenses + variableExpenses;
    const balance = monthlyIncome - totalExpenses;
    const savingsRate = monthlyIncome > 0 ? ((balance / monthlyIncome) * 100).toFixed(1) : 0;
    
    if (!genAI) {
      return res.json({ recommendations: generarAnalisisLocal(monthlyIncome, totalExpenses, balance, savingsRate, fixedExpenses, userProfile, currency) });
    }
    
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Eres un ASESOR FINANCIERO EXPERTO. Datos: ingreso ${currency}${monthlyIncome}, gastos ${currency}${totalExpenses}, ahorro ${savingsRate}%. Da 3 recomendaciones.`;
    
    const result = await model.generateContent(prompt);
    res.json({ recommendations: result.response.text() });
  } catch (error) {
    console.error('Error en IA:', error);
    res.json({ recommendations: generarAnalisisLocal(0, 0, 0, 0, 0, {}, '$') });
  }
});

// ============ TASAS DE CAMBIO ============
app.get('/api/rates', (req, res) => {
  res.json({ rates: { USD: 1, EUR: 0.92, MXN: 17.50, COP: 4000, ARS: 850, GBP: 0.79 } });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
  console.log(`🤖 IA: ${genAI ? 'ACTIVA' : 'LOCAL'}`);
});