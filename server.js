require('dotenv').config();
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
initFile(PROFILE_FILE, { 
  userId: 'default', 
  email: '',
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
  receiveEmailReports: true
});
initFile(USERS_FILE, []);

// ============ CONFIGURACIÓN DE EMAIL ============
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verificar conexión de email al iniciar
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Error de configuración de email:', error);
  } else {
    console.log('✅ Servidor de email listo para enviar correos');
  }
});

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

// ============ FUNCIÓN PARA ENVIAR REPORTE POR EMAIL ============
async function sendFinancialReport(email, transactions, userProfile, currency) {
  const monthlyIncome = userProfile?.monthlyIncome || 0;
  const rent = userProfile?.rent || 0;
  const services = userProfile?.services || 0;
  const groceries = userProfile?.groceries || 0;
  const transport = userProfile?.transport || 0;
  const fixedExpenses = rent + services + groceries + transport;
  
  const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
  const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0);
  const balance = totalIngresos - totalGastos;
  const totalAllExpenses = fixedExpenses + totalGastos;
  const realBalance = monthlyIncome - totalAllExpenses;
  const savingsRate = monthlyIncome > 0 ? ((realBalance / monthlyIncome) * 100).toFixed(1) : 0;
  
  // Calcular gastos por categoría
  const categorySummary = {};
  transactions.filter(t => t.type === 'gasto').forEach(t => {
    categorySummary[t.category] = (categorySummary[t.category] || 0) + t.amount;
  });
  
  const topCategory = Object.entries(categorySummary).sort((a, b) => b[1] - a[1])[0];
  
  const goalText = {
    'ahorro': 'Ahorrar para emergencias',
    'casa': 'Comprar casa',
    'auto': 'Comprar auto',
    'viaje': 'Hacer un viaje',
    'invertir': 'Invertir',
    'libertad': 'Libertad financiera',
    'deudas': 'Pagar deudas'
  };
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 25px; }
        .summary-card { background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #333; }
        .summary-amount { font-size: 28px; font-weight: bold; margin: 10px 0; }
        .income { color: #10b981; }
        .expense { color: #ef4444; }
        .balance { color: #667eea; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #667eea; color: white; }
        .progress-bar { background: #e0e0e0; border-radius: 10px; height: 20px; overflow: hidden; margin: 10px 0; }
        .progress-fill { background: linear-gradient(135deg, #10b981, #059669); height: 100%; border-radius: 10px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .btn { display: inline-block; background: #667eea; color: white; padding: 10px 20px; border-radius: 10px; text-decoration: none; margin-top: 15px; }
        .recommendation { background: #fef3c7; padding: 15px; border-radius: 10px; margin: 15px 0; border-left: 4px solid #f59e0b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💰 FinanceTracker AI</h1>
          <p>Tu Reporte Financiero Personalizado</p>
        </div>
        
        <div class="content">
          <div class="summary-card">
            <h3>📊 Resumen Financiero</h3>
            <div class="summary-amount income">💰 Ingresos: ${currency} ${totalIngresos.toLocaleString()}</div>
            <div class="summary-amount expense">💸 Gastos: ${currency} ${totalGastos.toLocaleString()}</div>
            <div class="summary-amount balance">⚖️ Balance: ${currency} ${balance.toLocaleString()}</div>
          </div>
          
          <div class="summary-card">
            <h3>📈 Tu Salud Financiera</h3>
            <div class="summary-amount">📅 Ingreso mensual: ${currency} ${monthlyIncome.toLocaleString()}</div>
            <div class="summary-amount">🏠 Gastos fijos: ${currency} ${fixedExpenses.toLocaleString()} (${((fixedExpenses/monthlyIncome)*100).toFixed(1)}%)</div>
            <div class="summary-amount">💾 Tasa de ahorro: ${savingsRate}%</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${Math.min(100, savingsRate)}%"></div>
            </div>
            <p>${savingsRate >= 20 ? '🎉 ¡Excelente tasa de ahorro!' : savingsRate >= 10 ? '⚠️ Vas por buen camino, sigue así' : '🔴 Necesitas aumentar tu ahorro'}</p>
          </div>
          
          ${topCategory ? `
          <h3>🔥 Mayor gasto</h3>
          <div class="summary-card">
            <p><strong>${topCategory[0]}</strong>: ${currency} ${topCategory[1].toLocaleString()}</p>
            <p>💡 ${topCategory[0] === 'Comida' ? 'Prueba a cocinar más en casa' : topCategory[0] === 'Transporte' ? 'Considera usar transporte público' : 'Revisa si puedes reducir este gasto'}</p>
          </div>
          ` : ''}
          
          <h3>🎯 Tu meta: ${goalText[userProfile?.goal] || 'Mejorar finanzas'}</h3>
          <div class="recommendation">
            <strong>💪 Recomendación de la semana</strong><br>
            ${savingsRate >= 20 ? 'Invierte tu excedente en CETES o fondos indexados' : savingsRate >= 10 ? 'Aumenta tu ahorro automático al 20%' : 'Reduce un 10% tus gastos variables este mes'}
          </div>
          
          <div style="text-align: center;">
            <a href="https://finance-tracker-ai.onrender.com" class="btn">📱 Ver mi dashboard</a>
          </div>
        </div>
        
        <div class="footer">
          <p>Este es tu reporte semanal de FinanceTracker AI</p>
          <p>© 2024 FinanceTracker AI - Tu asesor financiero personal</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  await transporter.sendMail({
    from: `"FinanceTracker AI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '📊 Tu Reporte Semanal FinanceTracker AI',
    html
  });
  
  console.log(`✅ Reporte enviado a ${email}`);
}

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
  
  return `🎯 **DIAGNÓSTICO FINANCIERO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Basado en tus datos, tu tasa de ahorro actual es del ${savingsRate}%. ${savingsRate >= 20 ? '¡Excelente! Estás por encima del promedio.' : savingsRate >= 10 ? 'Vas por buen camino, pero puedes llegar al 20%.' : 'Necesitas aumentar tu ahorro urgentemente.'}

📊 **RADIOGRAFÍA FINANCIERA**
| Indicador | Tu valor | Ideal | Estatus |
| Tasa ahorro | ${savingsRate}% | 20% | ${savingsRate >= 20 ? '✅' : savingsRate >= 10 ? '⚠️' : '🔴'} |
| Gastos fijos | ${((fixedExpenses/monthlyIncome)*100).toFixed(1)}% | <50% | ${fixedExpenses/monthlyIncome <= 0.5 ? '✅' : '🔴'} |

🔍 **3 RECOMENDACIONES PRIORITARIAS**
1. Automatiza un ahorro del ${Math.min(20, parseInt(savingsRate) + 10)}% de tu ingreso
2. Reduce tus gastos fijos en un 10% este mes
3. Registra todos tus gastos diariamente

💼 **ESTRATEGIA PARA ${userProfile?.projectionMonths || 12} MESES**
Meta: ${goalText[userProfile?.goal] || 'mejorar finanzas'}

💰 **PROYECCIÓN**
Ahorro actual: ${currency} ${(userProfile?.savings || 0).toLocaleString()}
Meta: ${currency} ${(((userProfile?.savings || 0) + (monthlyIncome * 0.2 * (userProfile?.projectionMonths || 12)))).toLocaleString()}

💪 **COMPROMISO**: "Ahorraré el ${Math.min(20, parseInt(savingsRate) + 5)}% de mi próximo ingreso"`;
}

// ============ MIDDLEWARE ============
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
const exchangeRates = { USD: 1, EUR: 0.92, MXN: 17.50, COP: 4000, ARS: 850, GBP: 0.79 };

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

// ============ ENDPOINTS DE PERFIL ============
app.get('/api/profile', (req, res) => {
  const profile = readJSON(PROFILE_FILE);
  res.json({ profile });
});

app.post('/api/profile', (req, res) => {
  writeJSON(PROFILE_FILE, req.body);
  res.json({ success: true });
});

// ============ ENDPOINT PARA ENVIAR REPORTE POR EMAIL ============
app.post('/api/send-report', async (req, res) => {
  try {
    const { transactions, userProfile, currency } = req.body;
    const userEmail = userProfile?.email;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'No hay correo registrado en tu perfil' });
    }
    
    await sendFinancialReport(userEmail, transactions, userProfile, currency);
    res.json({ success: true, message: 'Reporte enviado correctamente' });
  } catch (error) {
    console.error('Error enviando reporte:', error);
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
    const prompt = `Eres un ASESOR FINANCIERO EXPERTO con 10+ años. Datos: ingreso ${currency}${monthlyIncome}, gastos ${currency}${totalExpenses}, ahorro ${savingsRate}%. Da 3 recomendaciones específicas.`;
    
    const result = await model.generateContent(prompt);
    res.json({ recommendations: result.response.text() });
  } catch (error) {
    console.error('Error en IA:', error);
    res.json({ recommendations: generarAnalisisLocal(0, 0, 0, 0, 0, {}, '$') });
  }
});

app.get('/api/rates', (req, res) => {
  res.json({ rates: exchangeRates });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
  console.log(`🤖 IA: ${genAI ? 'ACTIVA' : 'LOCAL'}`);
  console.log(`📧 Email: ${process.env.EMAIL_USER ? 'CONFIGURADO' : 'NO CONFIGURADO'}`);
});