require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ CONEXIÓN A MONGODB ============
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error MongoDB:', err.message));

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

// ============ INICIALIZAR GEMINI ============
let genAI = null;
try {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'tu_api_key_aqui') {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('✅ Gemini IA inicializada (Experto financiero)');
  } else {
    console.log('⚠️ No se encontró API Key de Gemini');
  }
} catch (error) {
  console.log('⚠️ Error inicializando Gemini:', error.message);
}

app.use(express.json());
app.use(express.static('public'));

// Tasas de cambio
const exchangeRates = { USD: 1, EUR: 0.92, MXN: 17.50, COP: 4000, ARS: 850, GBP: 0.79 };

// ============ ENDPOINTS ============

// Análisis financiero con IA - EXPERTO CON 10+ AÑOS
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { transactions, userProfile, currency } = req.body;
    
    // Calcular métricas financieras
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
    const hasEmergencyFund = userProfile?.savings > totalExpenses * 3;
    
    // Gastos por categoría
    const categorySummary = {};
    (transactions || []).filter(t => t.type === 'gasto').forEach(t => {
      categorySummary[t.category] = (categorySummary[t.category] || 0) + t.amount;
    });
    const topCategory = Object.entries(categorySummary).sort((a, b) => b[1] - a[1])[0];
    
    const hasDebt = userProfile?.hasDebt && userProfile?.debtAmount > 0;
    
    // Si no hay IA, usar análisis local
    if (!genAI) {
      return res.json({ recommendations: generarAnalisisLocal(monthlyIncome, totalExpenses, balance, savingsRate, fixedExpenses, userProfile, currency) });
    }
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    const prompt = `ACTÚA COMO UN ASESOR FINANCIERO SENIOR CON 10+ AÑOS DE EXPERIENCIA EN BANCA PRIVADA.

Eres directo, honesto y práctico. Nada de consejos genéricos. Usa los números reales del cliente.

DATOS DEL CLIENTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Ingreso mensual: ${currency} ${monthlyIncome.toLocaleString()}
📅 Frecuencia: ${userProfile?.incomeFrequency || 'mensual'}
🏠 Gastos fijos mensuales:
   • Renta/Hipoteca: ${currency} ${(rent || 0).toLocaleString()}
   • Servicios: ${currency} ${(services || 0).toLocaleString()}
   • Supermercado: ${currency} ${(groceries || 0).toLocaleString()}
   • Transporte: ${currency} ${(transport || 0).toLocaleString()}
   • TOTAL FIJOS: ${currency} ${fixedExpenses.toLocaleString()} (${((fixedExpenses/monthlyIncome)*100).toFixed(1)}% del ingreso)

💸 Gastos variables: ${currency} ${variableExpenses.toLocaleString()}
📊 TOTAL GASTOS: ${currency} ${totalExpenses.toLocaleString()}
⚖️ BALANCE MENSUAL: ${currency} ${balance.toLocaleString()}
📈 TASA DE AHORRO: ${savingsRate}%
🎯 META FINANCIERA: ${userProfile?.goal || 'ahorro'}
💰 AHORROS ACTUALES: ${currency} ${(userProfile?.savings || 0).toLocaleString()}
📅 PROYECCIÓN: ${userProfile?.projectionMonths || 12} meses

${hasDebt ? `⚠️ DEUDAS: ${currency} ${(userProfile?.debtAmount || 0).toLocaleString()} al ${userProfile?.debtInterest || 0}% anual` : '✅ SIN DEUDAS'}
${hasEmergencyFund ? '✅ FONDO DE EMERGENCIA: Adecuado (3+ meses)' : '🔴 FONDO DE EMERGENCIA: Insuficiente'}

📊 TOP CATEGORÍA DE GASTO: ${topCategory ? `${topCategory[0]} (${currency} ${topCategory[1].toLocaleString()})` : 'Sin datos suficientes'}

INSTRUCCIONES: Genera un análisis FINANCIERO PROFESIONAL siguiendo EXACTAMENTE este formato. Sé específico con los números del cliente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE RESPUESTA OBLIGATORIO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 **DIAGNÓSTICO EJECUTIVO**
(2-3 oraciones directas usando los números reales del cliente)

📊 **RADIOGRAFÍA FINANCIERA**
| Indicador | Tu valor | Ideal | Estatus |
| Tasa de ahorro | ${savingsRate}% | 20-30% | ${savingsRate >= 20 ? '✅ Excelente' : savingsRate >= 10 ? '⚠️ Mejorable' : '🔴 Crítico'} |
| Gastos fijos | ${((fixedExpenses/monthlyIncome)*100).toFixed(1)}% | <50% | ${fixedExpenses/monthlyIncome <= 0.5 ? '✅ Controlado' : '🔴 Excesivo'} |

🔍 **TOP 3 ÁREAS DE OPORTUNIDAD**
1. [Basado en la categoría de mayor gasto]
2. [Basado en gastos fijos o variables]
3. [Basado en deudas o ahorro]

💼 **ESTRATEGIA PERSONALIZADA**

Basado en tu meta de ${userProfile?.goal === 'ahorro' ? 'ahorrar para emergencias' : userProfile?.goal === 'casa' ? 'comprar casa' : userProfile?.goal === 'deudas' ? 'pagar deudas' : 'mejorar finanzas'}:

**Primer mes:**
• [Acción específica con números reales]
• [Segunda acción con fecha límite]

**Próximos meses:**
• [Acciones a mediano plazo]

💰 **PROYECCIÓN REALISTA**
- Ahorro actual: ${currency} ${(userProfile?.savings || 0).toLocaleString()}
- Meta a ${userProfile?.projectionMonths || 12} meses: ${currency} ${((userProfile?.savings || 0) + (monthlyIncome * 0.2 * (userProfile?.projectionMonths || 12))).toLocaleString()}

${hasDebt ? `💳 **ESTRATEGIA DE DEUDAS**
• Método recomendado: ${(userProfile?.debtInterest || 0) > 15 ? 'Avalancha (pagar mayor interés primero)' : 'Bola de nieve (pagar deuda más pequeña primero)'}
• Acción inmediata: Destina el 30% de tu balance mensual a reducir deuda
` : ''}

🎓 **CONSEJO DE EXPERTO**
(Una estrategia financiera avanzada que usan los ricos)

💪 **COMPROMISO SEMANAL**
"Esta semana voy a [acción específica y medible]"

¡COMIENZA TU ANÁLISIS!`;

    const result = await model.generateContent(prompt);
    let recommendations = result.response.text();
    res.json({ recommendations });
    
  } catch (error) {
    console.error('Error en análisis IA:', error);
    const { userProfile, currency = '$' } = req.body;
    res.json({ recommendations: generarAnalisisLocal(
      userProfile?.monthlyIncome || 0,
      (userProfile?.rent || 0) + (userProfile?.services || 0) + (userProfile?.groceries || 0) + (userProfile?.transport || 0),
      0, 0, 0, userProfile, currency
    ) });
  }
});

// Función de respaldo sin IA
function generarAnalisisLocal(monthlyIncome, totalExpenses, balance, savingsRate, fixedExpenses, userProfile, currency) {
  const hasDebt = userProfile?.hasDebt && userProfile?.debtAmount > 0;
  const emergencyMonths = userProfile?.savings > 0 ? ((userProfile.savings / totalExpenses) * 12).toFixed(0) : 0;
  
  return `🎯 **DIAGNÓSTICO EJECUTIVO**
Basado en tus datos, tu tasa de ahorro actual es del ${savingsRate}%. ${savingsRate >= 20 ? '¡Excelente! Sigue así.' : savingsRate >= 10 ? 'Vas por buen camino, pero puedes mejorar.' : 'Necesitas aumentar tu ahorro urgentemente.'}

📊 **RADIOGRAFÍA FINANCIERA**
| Indicador | Tu valor | Ideal | Estatus |
| Tasa ahorro | ${savingsRate}% | 20% | ${savingsRate >= 20 ? '✅' : savingsRate >= 10 ? '⚠️' : '🔴'} |
| Gastos fijos | ${((fixedExpenses/monthlyIncome)*100).toFixed(1)}% | <50% | ${fixedExpenses/monthlyIncome <= 0.5 ? '✅' : '🔴'} |

🔍 **TOP 3 RECOMENDACIONES**
1. 🎯 Automatiza un ahorro del ${Math.min(20, parseInt(savingsRate) + 10)}% de tu ingreso el día que te pagan
2. 💡 Reduce tus gastos fijos en un 10% este mes
3. 📊 Registra todos tus gastos durante 30 días para identificar patrones

💼 **ESTRATEGIA DE 30 DÍAS**
• Semana 1: Abre una cuenta separada para ahorro
• Semana 2: Reduce 20% tu categoría de mayor gasto
• Semana 3-4: Construye fondo de emergencia

💰 **PROYECCIÓN**
Ahorro actual: ${currency} ${userProfile?.savings?.toLocaleString() || 0}
Meta a 12 meses: ${currency} ${(((userProfile?.savings || 0) + (monthlyIncome * 0.2 * 12))).toLocaleString()}

${hasDebt ? `💳 **ESTRATEGIA DE DEUDAS**
• Destina el 30% de tu balance mensual a pagar deudas
` : ''}

🎓 **CONSEJO DE EXPERTO**
"El dinero que no gastas hoy y lo inviertes, se multiplica solo."

💪 **COMPROMISO SEMANAL**
"Esta semana ahorraré el ${Math.min(20, parseInt(savingsRate) + 5)}% de mi próximo ingreso."`;
}

// ============ CRUD TRANSACCIONES (CORREGIDO) ============

app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: 'default' }).sort({ date: -1 });
    console.log(`📡 Enviando ${transactions.length} transacciones`);
    res.json({ 
      transactions, 
      categories: ['Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Educacion', 'Otros'] 
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    console.log('📥 Recibiendo transacción:', req.body);
    
    const { description, amount, category, type, date } = req.body;
    
    // Validaciones
    if (!description || !amount || !category || !type) {
      console.error('❌ Faltan campos:', { description, amount, category, type });
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan campos requeridos' 
      });
    }
    
    if (isNaN(amount) || amount <= 0) {
      console.error('❌ Monto inválido:', amount);
      return res.status(400).json({ 
        success: false, 
        error: 'Monto inválido' 
      });
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
    console.log('✅ Transacción guardada:', saved);
    
    res.json({ 
      success: true, 
      transaction: saved 
    });
    
  } catch (error) {
    console.error('❌ Error en POST /api/transactions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);
    console.log('✅ Transacción eliminada:', req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PERFIL DE USUARIO ============
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
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/profile', async (req, res) => {
  try {
    console.log('📥 Guardando perfil:', req.body);
    const profile = await Profile.findOneAndUpdate(
      { userId: 'default' },
      req.body,
      { upsert: true, new: true }
    );
    console.log('✅ Perfil guardado');
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ TASAS DE CAMBIO ============
app.get('/api/rates', (req, res) => res.json({ rates: exchangeRates }));

app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
  console.log(`🤖 IA: ${genAI ? 'ACTIVA' : 'DESACTIVADA'}`);
});