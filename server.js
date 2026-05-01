require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.json());
app.use(express.static('public'));

// Almacenamiento en memoria
let transactions = [];
let categories = ['Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Educación', 'Otros'];

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

// Análisis financiero con IA - VERSIÓN EXPERTO CON PERFIL
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { transactions, totalIncome, totalExpenses, balance, currency, userProfile } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    // Datos del perfil del usuario
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
    
    // Calcular estadísticas detalladas de transacciones
    const categorySummary = {};
    const dailyAverage = {};
    let totalExpensesCount = 0;
    
    transactions.forEach(t => {
      if (t.type === 'gasto') {
        totalExpensesCount++;
        categorySummary[t.category] = (categorySummary[t.category] || 0) + t.amount;
        
        const date = new Date(t.date);
        const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
        dailyAverage[dayName] = (dailyAverage[dayName] || 0) + t.amount;
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
    
    // Determinar frecuencia de ingreso en texto
    const frequencyText = {
      'semanal': 'semanal',
      'quincenal': 'quincenal',
      'mensual': 'mensual'
    };
    
    // Mapeo de metas
    const goalMap = {
      'ahorro': 'Ahorrar para emergencias',
      'casa': 'Comprar casa/departamento',
      'auto': 'Comprar auto',
      'viaje': 'Hacer un viaje',
      'invertir': 'Invertir y hacer crecer mi dinero',
      'libertad': 'Libertad financiera',
      'deudas': 'Pagar deudas'
    };
    
    const prompt = `ACTO 1: Eres un ASESOR FINANCIERO SENIOR con más de 10 AÑOS DE EXPERIENCIA en banca privada y finanzas personales.

INSTRUCCIÓN: Eres un profesional serio, directo y práctico. Nada de consejos genéricos como "ahorra más" o "reduce gastos". Tus recomendaciones deben ser QUIRÚRGICAS, CON NÚMEROS EXACTOS y ESTRATEGIAS REALES.

PERFIL DEL ASESOR:
- Trabajaste en Goldman Sachs y BBVA
- Asesoraste a más de 500 clientes
- Tienes reputación de ser honesto, aunque duela
- Usas analogías financieras poderosas
- Tu objetivo: que el cliente TOME ACCIÓN INMEDIATA

DATOS REALES DEL CLIENTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 FRECUENCIA DE INGRESO: ${frequencyText[incomeFrequency] || 'mensual'}
💰 INGRESO POR PERIODO: ${currency} ${userProfile?.monthlyIncome?.toLocaleString() || 0}
💵 INGRESO MENSUAL EQUIVALENTE: ${currency} ${monthlyIncome.toLocaleString()}

📋 GASTOS FIJOS MENSUALES:
• Renta/Hipoteca: ${currency} ${rent.toLocaleString()}
• Servicios (luz, agua, internet, teléfono): ${currency} ${services.toLocaleString()}
• Supermercado: ${currency} ${groceries.toLocaleString()}
• Transporte: ${currency} ${transport.toLocaleString()}
• TOTAL GASTOS FIJOS: ${currency} ${fixedExpenses.toLocaleString()}

💸 GASTOS VARIABLES (registrados): ${currency} ${totalVariableExpenses.toLocaleString()}
💰 TOTAL GASTOS MENSUALES: ${currency} ${totalAllExpenses.toLocaleString()}
⚖️ BALANCE MENSUAL REAL: ${currency} ${realBalance.toLocaleString()} (${realBalance >= 0 ? 'superávit' : 'déficit'})
📈 TASA DE AHORRO REAL: ${savingsRate}% (objetivo ideal 20-30%)

🎯 META FINANCIERA PRINCIPAL: ${goalMap[goal] || goal}
💰 AHORROS ACTUALES: ${currency} ${savings.toLocaleString()}
📅 PROYECCIÓN SOLICITADA: ${projectionMonths} meses

${hasDebt && debtAmount > 0 ? `⚠️ DEUDAS DETECTADAS:
• Monto total: ${currency} ${debtAmount.toLocaleString()}
• Tasa de interés anual: ${debtInterest}%
• Carga mensual de intereses: ~${currency} ${((debtAmount * (debtInterest / 100)) / 12).toLocaleString()}
` : '✅ Sin deudas reportadas'}

${emergencyFundMonths > 0 ? `🚨 FONDO DE EMERGENCIA: ${emergencyFundMonths} meses de gastos cubiertos (ideal: 3-6 meses)` : '🚨 SIN FONDO DE EMERGENCIA - PRIORIDAD #1'}

📊 DISTRIBUCIÓN DE GASTOS VARIABLES POR CATEGORÍA:
${Object.entries(categorySummary).map(([cat, amt]) => {
  const percentage = totalVariableExpenses > 0 ? ((amt / totalVariableExpenses) * 100).toFixed(1) : 0;
  const benchmark = getBenchmarkByCategory(cat);
  const status = percentage > benchmark ? '⚠️ EXCESO' : percentage < benchmark * 0.7 ? '✅ CONTROLADO' : '⚖️ NORMAL';
  return `• ${cat}: ${currency} ${amt.toFixed(2)} (${percentage}%) - Benchmark: ${benchmark}% - ${status}`;
}).join('\n')}

${topCategory ? `🔥 CATEGORÍA DOMINANTE: ${topCategory[0]} (${topPercentage}% del gasto variable)` : ''}

${largeExpenses.length > 0 ? `⚠️ GASTOS EXTRAORDINARIOS (>10% de ingreso):
${largeExpenses.slice(0, 3).map(e => `• ${e.description}: ${currency} ${e.amount.toFixed(2)}`).join('\n')}` : ''}

${Object.keys(smallFrequentExpenses).length > 0 ? `🐜 GASTOS HORMIGA DETECTADOS:
${Object.entries(smallFrequentExpenses).slice(0, 3).map(([desc, count]) => `• "${desc}": ${count} veces en el período`).join('\n')}` : ''}

ANÁLISIS DE SALUD FINANCIERA:
• Ratio de gastos fijos vs ingreso: ${((fixedExpenses / monthlyIncome) * 100).toFixed(1)}% (ideal <50%)
• ${fixedExpenses / monthlyIncome > 0.5 ? '🔴 ALERTA: Tus gastos fijos superan el 50% de tus ingresos' : '✅ Tus gastos fijos están controlados'}
• ${savingsRate < 10 ? '🔴 ALERTA CRÍTICA: Tu ahorro es muy bajo' : savingsRate < 20 ? '⚠️ Tu ahorro es mejorable' : '✅ Excelente tasa de ahorro'}

INSTRUCCIÓN CRÍTICA: Genera un análisis FINANCIERO PROFESIONAL siguiendo EXACTAMENTE este formato. Usa los números REALES del cliente. Sé específico, directo y accionable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE RESPUESTA OBLIGATORIO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 **DIAGNÓSTICO EJECUTIVO**
(2-3 oraciones directas con el dato clave)

📊 **RADIOGRAFÍA FINANCIERA COMPLETA**
| Indicador | Tu valor | Benchmark | Estatus |
|-----------|----------|-----------|---------|
| Ingreso mensual | ${currency} ${monthlyIncome.toLocaleString()} | - | - |
| Gastos fijos | ${((fixedExpenses / monthlyIncome) * 100).toFixed(1)}% | <50% | ${fixedExpenses / monthlyIncome > 0.5 ? '🔴 Excesivo' : '✅ Controlado'} |
| Gastos variables | ${((totalVariableExpenses / monthlyIncome) * 100).toFixed(1)}% | 20-30% | ${totalVariableExpenses / monthlyIncome > 0.3 ? '⚠️ Alto' : '✅ OK'} |
| Tasa de ahorro | ${savingsRate}% | 20% | ${savingsRate >= 20 ? '✅ Excelente' : savingsRate >= 10 ? '⚠️ Mejorable' : '🔴 Crítico'} |
| Fondo emergencia | ${emergencyFundMonths} meses | 3-6 meses | ${emergencyFundMonths >= 3 ? '✅ Adecuado' : '🔴 Insuficiente'} |

🔍 **TOP 3 FILTRACIONES DE DINERO**
1. [Basado en los datos reales del cliente]
2. [Segunda filtración]
3. [Tercera filtración]

💼 **ESTRATEGIA PERSONALIZADA PARA ${projectionMonths} MESES**

Basado en tu meta de ${goalMap[goal] || goal}:

SEMANA 1 (Días 1-7):
• [Acción específica con números]

SEMANA 2 (Días 8-14):
• [Segunda acción]

SEMANA 3-4 (Días 15-30):
• [Acciones finales del primer mes]

MESES 2-${projectionMonths}:
• [Estrategia a mediano plazo]

💰 **PROYECCIÓN DE AHORRO**
- Ahorro actual: ${currency} ${savings.toLocaleString()}
- Ahorro potencial en ${projectionMonths} meses: ${currency} ${(savings + (monthlyIncome * 0.2 * projectionMonths)).toLocaleString()}
- ${hasDebt && debtAmount > 0 ? `Tiempo estimado para pagar deuda: ${Math.ceil(debtAmount / (realBalance * 0.7))} meses` : ''}

${hasDebt && debtAmount > 0 ? `💳 **ESTRATEGIA DE DEUDAS**
• Método recomendado: ${debtInterest > 15 ? 'Avalancha (pagar la de mayor interés primero)' : 'Bola de nieve (pagar la más pequeña primero)'}
• Acción inmediata: Destina el 30% de tu balance mensual a reducir deuda
` : ''}

🎓 **CONSEJO DE EXPERTO**
(Una estrategia avanzada que usan los ricos, específica para su situación)

💪 **COMPROMISO SEMANAL**
(Frase que rete al cliente a tomar acción esta misma semana)

¡COMIENZA TU ANÁLISIS!`;

    const result = await model.generateContent(prompt);
    let recommendations = result.response.text();
    
    recommendations = recommendations
      .replace(/\*\*/g, '')
      .replace(/\\boxed\{/g, '')
      .replace(/\}/g, '');
    
    res.json({ recommendations });
    
  } catch (error) {
    console.error('AI Analysis error:', error);
    const fallbackResponse = generateExpertFallbackAnalysis(req.body);
    res.json({ recommendations: fallbackResponse });
  }
});

// Función de respaldo de experto
function generateExpertFallbackAnalysis(data) {
  const { totalIncome, totalExpenses, balance, currency = '$', userProfile } = data;
  const monthlyIncome = userProfile?.monthlyIncome || totalIncome;
  const rent = userProfile?.rent || 0;
  const services = userProfile?.services || 0;
  const groceries = userProfile?.groceries || 0;
  const transport = userProfile?.transport || 0;
  const fixedExpenses = rent + services + groceries + transport;
  const totalAllExpenses = fixedExpenses + totalExpenses;
  const realBalance = monthlyIncome - totalAllExpenses;
  const savingsRate = monthlyIncome > 0 ? ((realBalance / monthlyIncome) * 100).toFixed(1) : 0;
  const hasDebt = userProfile?.hasDebt || false;
  const debtAmount = userProfile?.debtAmount || 0;
  const savings = userProfile?.savings || 0;
  const goal = userProfile?.goal || 'ahorro';
  const projectionMonths = userProfile?.projectionMonths || 12;
  
  const goalMap = {
    'ahorro': 'Ahorrar para emergencias',
    'casa': 'Comprar casa',
    'auto': 'Comprar auto',
    'viaje': 'Hacer un viaje',
    'invertir': 'Invertir',
    'libertad': 'Libertad financiera',
    'deudas': 'Pagar deudas'
  };
  
  let analysis = `🎯 **DIAGNÓSTICO EJECUTIVO**\n\n`;
  
  if (realBalance < 0) {
    analysis += `🔴 CRÍTICO: Tus gastos mensuales totales (${currency}${totalAllExpenses.toLocaleString()}) superan tus ingresos (${currency}${monthlyIncome.toLocaleString()}) en ${currency}${Math.abs(realBalance).toLocaleString()}. NECESITAS ACCIÓN INMEDIATA.\n\n`;
  } else if (savingsRate < 10) {
    analysis += `⚠️ Tu tasa de ahorro es del ${savingsRate}%. Aunque no estás en números rojos, estás LEJOS del ideal (20%).\n\n`;
  } else {
    analysis += `✅ Ahorras el ${savingsRate}% de tus ingresos. ¡Bien! Pero puedes llegar al 20%.\n\n`;
  }
  
  analysis += `📊 **RADIOGRAFÍA FINANCIERA COMPLETA**\n\n`;
  analysis += `| Indicador | Tu valor | Benchmark | Estatus |\n`;
  analysis += `|-----------|----------|-----------|---------|\n`;
  analysis += `| Ingreso mensual | ${currency}${monthlyIncome.toLocaleString()} | - | - |\n`;
  analysis += `| Gastos fijos | ${((fixedExpenses / monthlyIncome) * 100).toFixed(1)}% | <50% | ${fixedExpenses / monthlyIncome > 0.5 ? '🔴 Excesivo' : '✅ Controlado'} |\n`;
  analysis += `| Tasa de ahorro | ${savingsRate}% | 20% | ${savingsRate >= 20 ? '✅ Excelente' : savingsRate >= 10 ? '⚠️ Mejorable' : '🔴 Crítico'} |\n`;
  
  analysis += `\n🔍 **TOP 3 OPORTUNIDADES DE MEJORA**\n\n`;
  
  if (rent > monthlyIncome * 0.3) {
    analysis += `1. 🏠 Tu renta/hipoteca (${currency}${rent.toLocaleString()}) es el ${((rent / monthlyIncome) * 100).toFixed(1)}% de tu ingreso. Ideal: max 30%. Considera renegociar o mudarte.\n`;
  }
  
  if (services > monthlyIncome * 0.1) {
    analysis += `2. 💡 Tus servicios (${currency}${services.toLocaleString()}) superan el 10% recomendado. Revisa suscripciones y cancela las que no uses.\n`;
  }
  
  if (groceries > monthlyIncome * 0.15) {
    analysis += `3. 🛒 Tu gasto en supermercado (${currency}${groceries.toLocaleString()}) supera el 15% ideal. Planifica tus comidas y reduce desperdicio.\n`;
  }
  
  if (Object.keys(analysis).length < 200) {
    analysis += `1. Registra TODOS tus gastos durante 30 días para identificar patrones\n`;
    analysis += `2. Reduce gastos hormiga (cafés, antojos, suscripciones)\n`;
    analysis += `3. Automatiza el ahorro el día que recibes ingreso\n`;
  }
  
  analysis += `\n💼 **ESTRATEGIA PERSONALIZADA PARA ${projectionMonths} MESES**\n\n`;
  analysis += `🎯 META: ${goalMap[goal] || goal}\n\n`;
  
  analysis += `SEMANA 1:\n`;
  analysis += `• Abre una cuenta separada para ahorro (sin tarjeta de débito)\n`;
  analysis += `• Configura transferencia automática del ${Math.min(20, parseInt(savingsRate) + 10)}% de tu ingreso\n\n`;
  
  analysis += `SEMANA 2:\n`;
  analysis += `• Revisa tus gastos fijos y negocia los que puedas (internet, teléfono, seguro)\n`;
  analysis += `• Cancela 2 suscripciones que no uses esta semana\n\n`;
  
  analysis += `SEMANA 3-4:\n`;
  analysis += `• Reduce 15% tu categoría de mayor gasto variable\n`;
  analysis += `• Cocina en casa 3 veces más por semana\n\n`;
  
  if (projectionMonths > 1) {
    analysis += `MESES 2-${projectionMonths}:\n`;
    analysis += `• Aumenta tu ahorro automático al 20-25%\n`;
    analysis += `• Invierte el excedente en CETES o fondo de emergencia\n`;
    analysis += `• Revisa tu progreso cada 15 días y ajusta\n\n`;
  }
  
  analysis += `💰 **PROYECCIÓN DE AHORRO**\n\n`;
  const monthlySavingsTarget = monthlyIncome * 0.2;
  const projectedTotal = savings + (monthlySavingsTarget * projectionMonths);
  analysis += `• Ahorro actual: ${currency}${savings.toLocaleString()}\n`;
  analysis += `• Meta mensual: ${currency}${monthlySavingsTarget.toLocaleString()}\n`;
  analysis += `• Proyección en ${projectionMonths} meses: ${currency}${projectedTotal.toLocaleString()}\n`;
  
  if (hasDebt && debtAmount > 0) {
    analysis += `\n💳 **ESTRATEGIA DE DEUDAS**\n\n`;
    analysis += `• Destina el 30% de tu balance mensual a pagar deudas\n`;
    const payoffMonths = Math.ceil(debtAmount / (realBalance * 0.3));
    if (payoffMonths > 0 && payoffMonths < 60) {
      analysis += `• Tiempo estimado libre de deudas: ${payoffMonths} meses\n`;
    }
    analysis += `• Método recomendado: Paga primero la deuda con mayor interés\n`;
  }
  
  if (savings < totalAllExpenses * 3) {
    analysis += `\n🚨 **PRIORIDAD #1: FONDO DE EMERGENCIA**\n\n`;
    analysis += `• Necesitas ${currency}${(totalAllExpenses * 3).toLocaleString()} para 3 meses de gastos\n`;
    analysis += `• Congela tus gastos no esenciales hasta tener este fondo\n`;
  }
  
  analysis += `\n🎓 **CONSEJO DE EXPERTO**\n\n`;
  analysis += `"El dinero que no gastas hoy y lo inviertes, se multiplica solo. Cada peso que ahorras es un empleado que trabaja 24/7 para ti. Empieza HOY."\n`;
  
  analysis += `\n💪 **COMPROMISO SEMANAL**\n\n`;
  analysis += `"Esta semana revisaré mi estado de cuenta, identificaré 3 gastos que puedo eliminar y ahorraré el ${Math.min(20, parseInt(savingsRate) + 5)}% de mi próximo ingreso."\n`;
  
  return analysis;
}

// Obtener todas las transacciones
app.get('/api/transactions', (req, res) => {
  res.json({ transactions, categories });
});

// Agregar transacción
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

// Eliminar transacción
app.delete('/api/transactions/:id', (req, res) => {
  const id = parseInt(req.params.id);
  transactions = transactions.filter(t => t.id !== id);
  res.json({ success: true });
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

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 FinanceTracker AI - Asesor Financiero con IA`);
  console.log(`📊 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`💼 Modo: Experto financiero con 10+ años de experiencia`);
});