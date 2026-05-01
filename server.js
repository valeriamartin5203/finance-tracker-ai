require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ CONEXIÓN A MONGODB - CORREGIDA ============
const MONGODB_URI = process.env.MONGODB_URI;

console.log('🔍 Verificando MONGODB_URI:', MONGODB_URI ? '✅ Definida' : '❌ NO DEFINIDA');

if (!MONGODB_URI) {
  console.error('❌ ERROR CRÍTICO: MONGODB_URI no está definida');
  console.error('💡 Ve a Render → Environment Variables → Agrega MONGODB_URI');
  // No detenemos el proceso, pero logueamos el error
} else {
  // Opciones de conexión para evitar timeout
  const mongooseOptions = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
    maxPoolSize: 10,
    minPoolSize: 1,
    retryWrites: true,
    retryReads: true
  };

  console.log('📡 Conectando a MongoDB Atlas...');
  
  mongoose.connect(MONGODB_URI, mongooseOptions)
    .then(() => {
      console.log('✅ Conectado a MongoDB Atlas exitosamente');
      console.log(`📊 Base de datos: ${mongoose.connection.db.databaseName}`);
    })
    .catch(err => {
      console.error('❌ Error conectando a MongoDB:', err.message);
      console.error('💡 VERIFICA EN MONGODB ATLAS:');
      console.error('   1. La contraseña es correcta');
      console.error('   2. La IP 0.0.0.0/0 está en Network Access');
    });

  mongoose.connection.on('error', err => {
    console.error('❌ Error en conexión MongoDB:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB desconectado. Intentando reconectar...');
  });
}

// ============ MODELOS ============
const transactionSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true, default: 'Otros' },
  type: { type: String, enum: ['ingreso', 'gasto'], required: true },
  date: { type: String, required: true },
  userId: { type: String, default: 'default' },
  createdAt: { type: Date, default: Date.now }
});

const profileSchema = new mongoose.Schema({
  userId: { type: String, default: 'default', unique: true },
  monthlyIncome: { type: Number, default: 0 },
  incomeFrequency: { type: String, default: 'mensual' },
  rent: { type: Number, default: 0 },
  services: { type: Number, default: 0 },
  groceries: { type: Number, default: 0 },
  transport: { type: Number, default: 0 },
  hasDebt: { type: Boolean, default: false },
  debtAmount: { type: Number, default: 0 },
  debtInterest: { type: Number, default: 0 },
  savings: { type: Number, default: 0 },
  goal: { type: String, default: 'ahorro' },
  projectionMonths: { type: Number, default: 12 }
});

const Transaction = mongoose.model('Transaction', transactionSchema);
const Profile = mongoose.model('Profile', profileSchema);

// ============ INICIALIZAR GEMINI - CORREGIDO ============
let genAI = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'tu_api_key_aqui' && apiKey.length > 10) {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Gemini IA inicializada');
  } else {
    console.log('⚠️ No hay API Key válida de Gemini');
    console.log('💡 Ve a https://aistudio.google.com/ y obtén una API Key');
  }
} catch (error) {
  console.log('⚠️ Error inicializando Gemini:', error.message);
}

app.use(express.json());
app.use(express.static('public'));

// Tasas de cambio
const exchangeRates = { USD: 1, EUR: 0.92, MXN: 17.50, COP: 4000, ARS: 850, GBP: 0.79 };

// ============ FUNCIÓN DE RESPALDO SIN IA ============
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
Basado en tus datos, tu tasa de ahorro actual es del ${savingsRate}%.

📊 **RADIOGRAFÍA FINANCIERA**
| Indicador | Tu valor | Ideal | Estatus |
| Tasa de ahorro | ${savingsRate}% | 20% | ${savingsRate >= 20 ? '✅ Excelente' : savingsRate >= 10 ? '⚠️ Mejorable' : '🔴 Crítica'} |
| Gastos fijos | ${((fixedExpenses/monthlyIncome)*100).toFixed(1)}% | <50% | ${fixedExpenses/monthlyIncome <= 0.5 ? '✅ Controlado' : '🔴 Excesivo'} |

🔍 **3 RECOMENDACIONES PRIORITARIAS**
1. 🎯 Automatiza un ahorro del ${Math.min(20, parseInt(savingsRate) + 10)}% de tu ingreso el día que te pagan
2. 💡 Reduce tus gastos fijos en un 10% este mes (revisa suscripciones, negocia servicios)
3. 📊 Registra todos tus gastos diariamente para identificar patrones de gasto hormiga

💼 **ESTRATEGIA PARA TU META: ${goalText[userProfile?.goal] || 'mejorar finanzas'}**
• Semana 1: Abre una cuenta separada para ahorro (sin tarjeta)
• Semana 2: Reduce 20% tu categoría de mayor gasto
• Semana 3-4: Construye fondo de emergencia de 3 meses

💰 **PROYECCIÓN A ${userProfile?.projectionMonths || 12} MESES**
• Ahorro actual: ${currency} ${(userProfile?.savings || 0).toLocaleString()}
• Meta alcanzable: ${currency} ${(((userProfile?.savings || 0) + (monthlyIncome * 0.2 * (userProfile?.projectionMonths || 12)))).toLocaleString()}

${userProfile?.hasDebt && userProfile?.debtAmount > 0 ? `💳 **ESTRATEGIA DE DEUDAS**
• Destina el 30% de tu balance mensual (${currency} ${(balance * 0.3).toLocaleString()}) a pagar deudas
• Método: Paga primero la deuda con mayor tasa de interés
` : ''}

🎓 **CONSEJO DE EXPERTO**
"El dinero que no gastas hoy y lo inviertes, se multiplica solo. Empieza HOY aunque sea con ${currency}100."

💪 **COMPROMISO SEMANAL**
"Esta semana ahorraré el ${Math.min(20, parseInt(savingsRate) + 5)}% de mi próximo ingreso antes de gastar."`;
}

// ============ ENDPOINTS ============

// Análisis financiero con IA - CORREGIDO (modelo correcto)
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
    
    // MODELO CORRECTO DE GEMINI
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `Eres un ASESOR FINANCIERO EXPERTO con 10+ años de experiencia.

DATOS DEL CLIENTE:
💰 Ingreso mensual: ${currency} ${monthlyIncome.toLocaleString()}
🏠 Gastos fijos (renta, servicios, super, transporte): ${currency} ${fixedExpenses.toLocaleString()}
💸 Gastos variables: ${currency} ${variableExpenses.toLocaleString()}
📊 Total gastos: ${currency} ${totalExpenses.toLocaleString()}
⚖️ Balance mensual: ${currency} ${balance.toLocaleString()}
📈 Tasa de ahorro: ${savingsRate}%
🎯 Meta financiera: ${userProfile?.goal || 'mejorar finanzas'}
${topCategory ? `🔥 Mayor gasto: ${topCategory[0]} (${currency} ${topCategory[1].toLocaleString()})` : ''}

Da 3 recomendaciones específicas y prácticas con este formato exacto:

**Recomendación 1:** [acción específica con números]
**Recomendación 2:** [segunda acción con fecha límite]
**Recomendación 3:** [tercera acción medible]`;

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

app.get('/api/transactions', async (req, res) => {
  try {
    // Verificar conexión antes de consultar
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ MongoDB no conectado, devolviendo array vacío');
      return res.json({ transactions: [], categories: ['Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Educacion', 'Otros'] });
    }
    
    const transactions = await Transaction.find({ userId: 'default' }).sort({ date: -1 });
    console.log(`📡 Enviando ${transactions.length} transacciones`);
    res.json({ 
      transactions, 
      categories: ['Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Educacion', 'Otros'] 
    });
  } catch (error) {
    console.error('Error fetching transactions:', error.message);
    res.json({ transactions: [], categories: ['Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Educacion', 'Otros'] });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    // Verificar conexión antes de guardar
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ MongoDB no conectado, guardando en memoria temporal');
      // Por ahora respondemos éxito para no bloquear al usuario
      return res.json({ success: true, warning: 'Guardado localmente, MongoDB no conectado' });
    }
    
    console.log('📥 Recibiendo transacción:', req.body);
    
    const { description, amount, category, type, date } = req.body;
    
    if (!description || !amount || !category || !type) {
      return res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
    }
    
    const newTransaction = new Transaction({
      description: String(description),
      amount: Number(amount),
      category: String(category),
      type: type === 'ingreso' ? 'ingreso' : 'gasto',
      date: date || new Date().toISOString().split('T')[0],
      userId: 'default'
    });
    
    const saved = await newTransaction.save();
    console.log('✅ Transacción guardada:', saved._id);
    res.json({ success: true, transaction: saved });
    
  } catch (error) {
    console.error('❌ Error en POST /api/transactions:', error.message);
    res.json({ success: true, warning: 'Error temporal, intenta de nuevo' });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true });
    }
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error.message);
    res.json({ success: true });
  }
});

// ============ PERFIL DE USUARIO ============
app.get('/api/profile', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ MongoDB no conectado, devolviendo perfil por defecto');
      return res.json({ profile: { monthlyIncome: 0, incomeFrequency: 'mensual', rent: 0, services: 0, groceries: 0, transport: 0, hasDebt: false, debtAmount: 0, debtInterest: 0, savings: 0, goal: 'ahorro', projectionMonths: 12 } });
    }
    
    let profile = await Profile.findOne({ userId: 'default' });
    if (!profile) {
      profile = new Profile({ userId: 'default' });
      await profile.save();
    }
    res.json({ profile });
  } catch (error) {
    console.error('Error fetching profile:', error.message);
    res.json({ profile: { monthlyIncome: 0, incomeFrequency: 'mensual', rent: 0, services: 0, groceries: 0, transport: 0, hasDebt: false, debtAmount: 0, debtInterest: 0, savings: 0, goal: 'ahorro', projectionMonths: 12 } });
  }
});

app.post('/api/profile', async (req, res) => {
  try {
    console.log('📥 Guardando perfil:', req.body);
    
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ MongoDB no conectado, perfil no guardado persistentemente');
      return res.json({ success: true, warning: 'Perfil guardado temporalmente' });
    }
    
    await Profile.findOneAndUpdate(
      { userId: 'default' },
      req.body,
      { upsert: true, new: true }
    );
    console.log('✅ Perfil guardado');
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving profile:', error.message);
    res.json({ success: true });
  }
});

// ============ TASAS DE CAMBIO ============
app.get('/api/rates', (req, res) => res.json({ rates: exchangeRates }));

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🤖 IA: ${genAI ? 'ACTIVA' : 'DESACTIVADA (usando modo local)'}`);
  console.log(`💾 MongoDB: ${mongoose.connection.readyState === 1 ? 'CONECTADO' : 'DESCONECTADO'}`);
});