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
  category: { type: String, required: true },
  type: { type: String, enum: ['ingreso', 'gasto'], required: true },
  date: { type: String, required: true },
  userId: { type: String, default: 'default' }
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
    const monthlyIncome = userProfile.monthlyIncome;
    const rent = userProfile.rent || 0;
    const services = userProfile.services || 0;
    const groceries = userProfile.groceries || 0;
    const transport = userProfile.transport || 0;
    const fixedExpenses = rent + services + groceries + transport;
    const variableExpenses = transactions.filter(t => t.type === 'gasto').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = fixedExpenses + variableExpenses;
    const balance = monthlyIncome - totalExpenses;
    const savingsRate = monthlyIncome > 0 ? ((balance / monthlyIncome) * 100).toFixed(1) : 0;
    const hasEmergencyFund = userProfile.savings > totalExpenses * 3;
    
    // Gastos por categoría (el usuario las elige)
    const categorySummary = {};
    transactions.filter(t => t.type === 'gasto').forEach(t => {
      categorySummary[t.category] = (categorySummary[t.category] || 0) + t.amount;
    });
    const topCategory = Object.entries(categorySummary).sort((a, b) => b[1] - a[1])[0];
    
    // Análisis de deudas
    const hasDebt = userProfile.hasDebt && userProfile.debtAmount > 0;
    const debtBurden = hasDebt ? (userProfile.debtAmount / monthlyIncome).toFixed(1) : 0;
    
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
📅 Frecuencia: ${userProfile.incomeFrequency}
🏠 Gastos fijos mensuales:
   • Renta/Hipoteca: ${currency} ${rent.toLocaleString()}
   • Servicios: ${currency} ${services.toLocaleString()}
   • Supermercado: ${currency} ${groceries.toLocaleString()}
   • Transporte: ${currency} ${transport.toLocaleString()}
   • TOTAL FIJOS: ${currency} ${fixedExpenses.toLocaleString()} (${((fixedExpenses/monthlyIncome)*100).toFixed(1)}% del ingreso)

💸 Gastos variables: ${currency} ${variableExpenses.toLocaleString()}
📊 TOTAL GASTOS: ${currency} ${totalExpenses.toLocaleString()}
⚖️ BALANCE MENSUAL: ${currency} ${balance.toLocaleString()}
📈 TASA DE AHORRO: ${savingsRate}%
🎯 META FINANCIERA: ${userProfile.goal}
💰 AHORROS ACTUALES: ${currency} ${userProfile.savings.toLocaleString()}
📅 PROYECCIÓN: ${userProfile.projectionMonths} meses

${hasDebt ? `⚠️ DEUDAS: ${currency} ${userProfile.debtAmount.toLocaleString()} al ${userProfile.debtInterest}% anual` : '✅ SIN DEUDAS'}
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
|-----------|----------|-------|---------|
| Tasa de ahorro | ${savingsRate}% | 20-30% | ${savingsRate >= 20 ? '✅ Excelente' : savingsRate >= 10 ? '⚠️ Mejorable' : '🔴 Crítico'} |
| Gastos fijos | ${((fixedExpenses/monthlyIncome)*100).toFixed(1)}% | <50% | ${fixedExpenses/monthlyIncome <= 0.5 ? '✅ Controlado' : '🔴 Excesivo'} |
| Fondo emergencia | ${userProfile.savings > 0 ? ((userProfile.savings/totalExpenses)*12).toFixed(0) : 0} meses | 3-6 meses | ${hasEmergencyFund ? '✅ Adecuado' : '🔴 Insuficiente'} |

🔍 **TOP 3 ÁREAS DE OPORTUNIDAD**
1. [Basado en la categoría de mayor gasto]
2. [Basado en gastos fijos o variables]
3. [Basado en deudas o ahorro]

💼 **ESTRATEGIA PERSONALIZADA PARA ${userProfile.projectionMonths} MESES**

Basado en tu meta de ${userProfile.goal === 'ahorro' ? 'ahorrar para emergencias' : userProfile.goal === 'casa' ? 'comprar casa' : userProfile.goal === 'deudas' ? 'pagar deudas' : 'mejorar finanzas'}:

**Primer mes (Días 1-30):**
• [Acción específica con números reales]
• [Segunda acción con fecha límite]

**Mes 2-${Math.min(3, userProfile.projectionMonths)}:**
• [Acciones a mediano plazo]

${userProfile.projectionMonths > 3 ? `**Mes 4-${userProfile.projectionMonths}:**
• [Estrategia a largo plazo]` : ''}

💰 **PROYECCIÓN REALISTA**
- Ahorro actual: ${currency} ${userProfile.savings.toLocaleString()}
- Meta a ${userProfile.projectionMonths} meses: ${currency} ${(userProfile.savings + (monthlyIncome * 0.2 * userProfile.projectionMonths)).toLocaleString()}
- ${userProfile.goal === 'deudas' && hasDebt ? `Tiempo estimado libre de deudas: ${Math.ceil(userProfile.debtAmount / (balance * 0.5))} meses` : ''}

${hasDebt ? `💳 **ESTRATEGIA DE DEUDAS**
• Método recomendado: ${userProfile.debtInterest > 15 ? 'Avalancha (pagar mayor interés primero)' : 'Bola de nieve (pagar deuda más pequeña primero)'}
• Acción inmediata: Destina el 30% de tu balance mensual (${currency} ${(balance * 0.3).toLocaleString()}) a reducir deuda
` : ''}

🎓 **CONSEJO DE EXPERTO**
(Una estrategia financiera avanzada que usan los ricos, específica para su situación)

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
| Fondo emergencia | ${emergencyMonths} meses | 3-6 meses | ${emergencyMonths >= 3 ? '✅' : '🔴'} |

🔍 **TOP 3 RECOMENDACIONES**
1. 🎯 Automatiza un ahorro del ${Math.min(20, parseInt(savingsRate) + 10)}% de tu ingreso el día que te pagan
2. 💡 Reduce tus gastos fijos en un 10% este mes (negocia servicios, cancela suscripciones)
3. 📊 Registra todos tus gastos durante 30 días para identificar patrones

💼 **ESTRATEGIA DE 30 DÍAS**
• Semana 1: Abre una cuenta separada para ahorro
• Semana 2: Reduce 20% tu categoría de mayor gasto
• Semana 3-4: Construye fondo de emergencia de 3 meses

💰 **PROYECCIÓN**
Ahorro actual: ${currency} ${userProfile?.savings?.toLocaleString() || 0}
Meta a 12 meses: ${currency} ${(((userProfile?.savings || 0) + (monthlyIncome * 0.2 * 12))).toLocaleString()}

${hasDebt ? `💳 **ESTRATEGIA DE DEUDAS**
• Destina el 30% de tu balance mensual a pagar deudas
• Tiempo estimado: ${Math.ceil(userProfile.debtAmount / (balance * 0.3))} meses
` : ''}

🎓 **CONSEJO DE EXPERTO**
"El dinero que no gastas hoy y lo inviertes, se multiplica solo. Empieza HOY aunque sea con ${currency}100."

💪 **COMPROMISO SEMANAL**
"Esta semana revisaré mi estado de cuenta, identificaré 3 gastos que puedo eliminar y ahorraré el ${Math.min(20, parseInt(savingsRate) + 5)}% de mi próximo ingreso."`;
}

// ============ CRUD TRANSACCIONES ============
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: 'default' }).sort({ date: -1 });
    res.json({ transactions, categories: ['Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Educacion', 'Otros'] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const transaction = new Transaction(req.body);
    await transaction.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
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
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/profile', async (req, res) => {
  try {
    const profile = await Profile.findOneAndUpdate(
      { userId: 'default' },
      req.body,
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ TASAS DE CAMBIO ============
app.get('/api/rates', (req, res) => res.json({ rates: exchangeRates }));

app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});