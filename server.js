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

// ============ CONFIGURACIÓN ARCHIVOS JSON ============
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const PAYMENTS_FILE = path.join(DATA_DIR, 'scheduled_payments.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const initFile = (file, defaultData) => {
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
};
initFile(USERS_FILE, []);
initFile(PROFILES_FILE, {});
initFile(TRANSACTIONS_FILE, {});
initFile(PAYMENTS_FILE, {});

const readJSON = (file) => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { return {}; }
};
const writeJSON = (file, data) => {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); return true; }
    catch (error) { return false; }
};

// ============ EMAIL ============
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        timeout: 5000
    });
    console.log('✅ Email configurado');
}

// ============ GEMINI IA ============
let genAI = null;
let useGemini = false;
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10 && process.env.GEMINI_API_KEY !== 'tu_api_key_aqui') {
    try {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        useGemini = true;
        console.log('✅ Gemini IA inicializada (modo real)');
    } catch (err) {
        console.log('⚠️ Error inicializando Gemini:', err.message);
    }
} else {
    console.log('⚠️ Modo local (sin API key de Gemini)');
}

app.use(express.json());
app.use(express.static('public'));

// ============ MIDDLEWARE AUTH ============
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.user = user;
        next();
    });
};

// ============ AUTH ENDPOINTS ============
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        const users = readJSON(USERS_FILE);
        if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email ya registrado' });
        const hashed = await bcrypt.hash(password, 10);
        const newUser = { id: Date.now().toString(), email, name: name || email.split('@')[0], password: hashed, createdAt: new Date().toISOString() };
        users.push(newUser);
        writeJSON(USERS_FILE, users);
        const token = jwt.sign({ id: newUser.id, email }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.json({ success: true, token, user: { id: newUser.id, email, name: newUser.name } });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = readJSON(USERS_FILE);
        const user = users.find(u => u.email === email);
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Credenciales inválidas' });
        const token = jwt.sign({ id: user.id, email }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.json({ success: true, token, user: { id: user.id, email, name: user.name } });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ============ PERFIL ============
app.get('/api/profile', authenticateToken, (req, res) => {
    const profiles = readJSON(PROFILES_FILE);
    res.json({ profile: profiles[req.user.id] || null });
});

app.post('/api/profile', authenticateToken, (req, res) => {
    const profiles = readJSON(PROFILES_FILE);
    profiles[req.user.id] = { ...req.body, userId: req.user.id, updatedAt: new Date().toISOString() };
    writeJSON(PROFILES_FILE, profiles);
    res.json({ success: true });
});

// ============ TRANSACCIONES ============
app.get('/api/transactions', authenticateToken, (req, res) => {
    const transactions = readJSON(TRANSACTIONS_FILE);
    res.json({ transactions: transactions[req.user.id] || [], categories: ['Comida','Transporte','Entretenimiento','Servicios','Salud','Educacion','Otros'] });
});

app.post('/api/transactions', authenticateToken, (req, res) => {
    const transactions = readJSON(TRANSACTIONS_FILE);
    if (!transactions[req.user.id]) transactions[req.user.id] = [];
    const newT = { _id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
    transactions[req.user.id].unshift(newT);
    writeJSON(TRANSACTIONS_FILE, transactions);
    res.json({ success: true, transaction: newT });
});

app.delete('/api/transactions/:id', authenticateToken, (req, res) => {
    const transactions = readJSON(TRANSACTIONS_FILE);
    if (transactions[req.user.id]) {
        transactions[req.user.id] = transactions[req.user.id].filter(t => t._id !== req.params.id);
        writeJSON(TRANSACTIONS_FILE, transactions);
    }
    res.json({ success: true });
});

// ============ PAGOS PROGRAMADOS ============
app.get('/api/scheduled-payments', authenticateToken, (req, res) => {
    const payments = readJSON(PAYMENTS_FILE);
    res.json({ payments: payments[req.user.id] || [] });
});

app.post('/api/scheduled-payments', authenticateToken, (req, res) => {
    const payments = readJSON(PAYMENTS_FILE);
    if (!payments[req.user.id]) payments[req.user.id] = [];
    const newP = { _id: Date.now().toString(), ...req.body, paid: false, createdAt: new Date().toISOString() };
    payments[req.user.id].push(newP);
    writeJSON(PAYMENTS_FILE, payments);
    res.json({ success: true, payment: newP });
});

app.put('/api/scheduled-payments/:id', authenticateToken, (req, res) => {
    const payments = readJSON(PAYMENTS_FILE);
    if (payments[req.user.id]) {
        const idx = payments[req.user.id].findIndex(p => p._id === req.params.id);
        if (idx !== -1) {
            payments[req.user.id][idx] = { ...payments[req.user.id][idx], ...req.body };
            writeJSON(PAYMENTS_FILE, payments);
            res.json({ success: true });
        } else res.status(404).json({ error: 'No encontrado' });
    } else res.status(404).json({ error: 'No encontrado' });
});

app.delete('/api/scheduled-payments/:id', authenticateToken, (req, res) => {
    const payments = readJSON(PAYMENTS_FILE);
    if (payments[req.user.id]) {
        payments[req.user.id] = payments[req.user.id].filter(p => p._id !== req.params.id);
        writeJSON(PAYMENTS_FILE, payments);
        res.json({ success: true });
    } else res.status(404).json({ error: 'No encontrado' });
});

// ============ REPORTE EMAIL ============
app.post('/api/send-report', authenticateToken, async (req, res) => {
    try {
        const { transactions, userProfile, currency } = req.body;
        const email = userProfile?.email;
        if (!email) return res.status(400).json({ error: 'Correo no registrado' });
        if (!transporter) return res.status(400).json({ error: 'Email no configurado' });
        const ingresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
        const gastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0);
        const balance = ingresos - gastos;
        const html = `<div style="font-family: Arial; max-width:600px; margin:auto">
            <div style="background:linear-gradient(135deg,#667eea,#764ba2); padding:30px; text-align:center; color:white">
                <h1>💰 FinanceTracker AI</h1>
                <p>Tu Reporte Financiero</p>
            </div>
            <div style="padding:20px">
                <h2>📊 Resumen</h2>
                <p><strong>Ingresos:</strong> ${currency} ${ingresos}</p>
                <p><strong>Gastos:</strong> ${currency} ${gastos}</p>
                <p><strong>Balance:</strong> ${currency} ${balance}</p>
                <hr>
                <p><strong>Meta:</strong> ${userProfile.goal || 'Mejorar finanzas'}</p>
                <p><strong>Ahorros:</strong> ${currency} ${userProfile.savings || 0}</p>
            </div>
            <div style="background:#f0f0f0; padding:15px; text-align:center; font-size:12px">
                <p>© FinanceTracker AI</p>
            </div>
        </div>`;
        await transporter.sendMail({
            from: `"FinanceTracker AI" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '📊 Tu Reporte FinanceTracker AI',
            html
        });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ============ FUNCIÓN LOCAL REALISTA (siempre funciona) ============
function generarRespuestaLocalRealista(monthlyIncome, fixedExpenses, categoryTotals, totalExpenses, balance, savingsRate, userProfile, currency, debtInfo, userGoal) {
    let recomendaciones = [];
    const targetSavings = Math.min(25, parseInt(savingsRate) + 10);

    let topCategory = null;
    let topAmount = 0;
    for (const [cat, amt] of Object.entries(categoryTotals)) {
        if (amt > topAmount) {
            topAmount = amt;
            topCategory = cat;
        }
    }

    if (topCategory && topAmount > 0) {
        let reductionPercent = 0.15;
        let saving = topAmount * reductionPercent;
        if (topCategory === 'Comida') {
            recomendaciones.push(`**Recomendación 1:** Reduce tus gastos en **${topCategory}** (${currency} ${topAmount.toLocaleString()}/mes). Cocina en casa 4 veces más por semana y planea tus comidas. → Ahorro estimado: ${currency} ${saving.toLocaleString()}/mes.`);
        } else if (topCategory === 'Transporte') {
            recomendaciones.push(`**Recomendación 1:** Tu mayor gasto es **${topCategory}** (${currency} ${topAmount.toLocaleString()}/mes). Usa transporte público 3 días a la semana o comparte viajes. → Ahorro estimado: ${currency} ${saving.toLocaleString()}/mes.`);
        } else if (topCategory === 'Entretenimiento') {
            recomendaciones.push(`**Recomendación 1:** Estás gastando ${currency} ${topAmount.toLocaleString()} en **${topCategory}**. Sustituye 2 salidas al mes por actividades gratis. → Ahorro estimado: ${currency} ${saving.toLocaleString()}/mes.`);
        } else {
            recomendaciones.push(`**Recomendación 1:** Tu mayor gasto es **${topCategory}** (${currency} ${topAmount.toLocaleString()}/mes). Revisa si realmente necesitas ese nivel de gasto y reduce en un 15%. → Ahorro estimado: ${currency} ${saving.toLocaleString()}/mes.`);
        }
    } else {
        recomendaciones.push(`**Recomendación 1:** Automatiza un ahorro del ${targetSavings}% de tu ingreso el día que te pagan. Si ganas ${currency} ${monthlyIncome.toLocaleString()}, serían ${currency} ${(monthlyIncome * targetSavings / 100).toLocaleString()} mensuales.`);
    }

    if (fixedExpenses > monthlyIncome * 0.5) {
        let savingFixed = fixedExpenses * 0.1;
        recomendaciones.push(`**Recomendación 2:** Tus gastos fijos representan el ${((fixedExpenses/monthlyIncome)*100).toFixed(1)}% de tus ingresos (ideal <50%). Negocia tu renta, cambia de plan de internet o reduce suscripciones. → Ahorro potencial: ${currency} ${savingFixed.toLocaleString()}/mes.`);
    } else {
        let savingVariable = totalExpenses * 0.1;
        recomendaciones.push(`**Recomendación 2:** Revisa tus gastos variables. Identifica 3 gastos hormiga (cafés, antojos, apps) y elimínalos. → Ahorro estimado: ${currency} ${savingVariable.toLocaleString()}/mes.`);
    }

    if (userProfile.hasDebt && userProfile.debtAmount > 0) {
        let extraPayment = balance > 0 ? balance * 0.3 : 500;
        recomendaciones.push(`**Recomendación 3:** Destina al menos ${currency} ${extraPayment.toLocaleString()} adicionales cada mes a pagar tu deuda (${currency} ${userProfile.debtAmount.toLocaleString()}). Pagarás más rápido y ahorrarás en intereses.`);
    } else if (userProfile.savings < totalExpenses * 3) {
        let needed = (totalExpenses * 3) - userProfile.savings;
        recomendaciones.push(`**Recomendación 3:** Prioriza crear un fondo de emergencia de 3 meses de gastos (${currency} ${(totalExpenses*3).toLocaleString()}). Actualmente tienes ${currency} ${userProfile.savings.toLocaleString()}. Aporta ${currency} ${Math.ceil(needed/6).toLocaleString()} cada mes durante 6 meses.`);
    } else {
        recomendaciones.push(`**Recomendación 3:** Invierte tu excedente mensual (${currency} ${balance.toLocaleString()}) en CETES o una cuenta de alto rendimiento. Así tu dinero crece sin riesgo.`);
    }

    let motivacion = '';
    if (balance < 0) {
        motivacion = '💪 El primer paso para salir del déficit es conocer tus números. ¡Tú puedes cambiarlo!';
    } else if (savingsRate < 10) {
        motivacion = '💪 Cada pequeño ahorro suma. Empieza hoy con un 5% y ve aumentando.';
    } else {
        motivacion = `💪 ¡Vas por buen camino! Aplica estas estrategias y alcanzarás tu meta de ${userGoal} más rápido.`;
    }

    return recomendaciones.join('\n\n') + '\n\n' + motivacion;
}

// ============ ANÁLISIS IA (con manejo robusto de errores) ============
app.post('/api/ai/analyze', authenticateToken, async (req, res) => {
    try {
        const { transactions, userProfile, currency } = req.body;

        if (!userProfile || !userProfile.monthlyIncome) {
            return res.json({ recommendations: '⚠️ Completa tu perfil financiero (ingresos, gastos fijos) antes de analizar.' });
        }

        const monthlyIncome = userProfile.monthlyIncome;
        const rent = userProfile.rent || 0;
        const services = userProfile.services || 0;
        const groceries = userProfile.groceries || 0;
        const transport = userProfile.transport || 0;
        const fixedExpenses = rent + services + groceries + transport;

        const categoryTotals = {};
        (transactions || []).filter(t => t.type === 'gasto').forEach(t => {
            categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
        });
        const variableExpenses = Object.values(categoryTotals).reduce((a,b) => a+b, 0);
        const totalExpenses = fixedExpenses + variableExpenses;
        const balance = monthlyIncome - totalExpenses;
        const savingsRate = monthlyIncome > 0 ? ((balance / monthlyIncome) * 100).toFixed(1) : 0;

        let categoryBreakdown = '';
        for (const [cat, amount] of Object.entries(categoryTotals)) {
            const percent = ((amount / totalExpenses) * 100).toFixed(1);
            categoryBreakdown += `- ${cat}: ${currency} ${amount.toLocaleString()} (${percent}% del gasto total)\n`;
        }
        if (!categoryBreakdown) categoryBreakdown = 'No hay gastos variables registrados aún.\n';

        let debtInfo = '';
        if (userProfile.hasDebt && userProfile.debtAmount > 0) {
            const monthlyInterest = (userProfile.debtAmount * (userProfile.debtInterest / 100)) / 12;
            debtInfo = `Deuda total: ${currency} ${userProfile.debtAmount.toLocaleString()} a ${userProfile.debtInterest}% anual (interés mensual ~${currency} ${monthlyInterest.toFixed(2)}).`;
        } else {
            debtInfo = 'No tienes deudas reportadas. ¡Excelente!';
        }

        const goalMap = {
            'ahorro': 'ahorrar para emergencias',
            'casa': 'comprar una casa',
            'auto': 'comprar un auto',
            'viaje': 'hacer un viaje',
            'invertir': 'invertir y hacer crecer tu dinero',
            'libertad': 'alcanzar libertad financiera',
            'deudas': 'pagar tus deudas'
        };
        const userGoal = goalMap[userProfile.goal] || 'mejorar tu salud financiera';

        // Si no hay Gemini, usar modo local
        if (!useGemini) {
            const localResponse = generarRespuestaLocalRealista(
                monthlyIncome, fixedExpenses, categoryTotals, totalExpenses, balance,
                savingsRate, userProfile, currency, debtInfo, userGoal
            );
            return res.json({ recommendations: localResponse });
        }

        // Intentar llamar a Gemini
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const prompt = `Actúa como un ASESOR FINANCIERO experto. Datos reales del usuario:
- Ingreso mensual: ${currency} ${monthlyIncome.toLocaleString()}
- Gastos fijos: ${currency} ${fixedExpenses.toLocaleString()} (${((fixedExpenses/monthlyIncome)*100).toFixed(1)}% del ingreso)
- Gastos variables: ${categoryBreakdown}
- Balance: ${currency} ${balance.toLocaleString()}
- Tasa ahorro: ${savingsRate}%
- Deudas: ${debtInfo}
- Meta: ${userGoal}

Genera 3 recomendaciones específicas con números. Cada una debe incluir una acción y un ahorro estimado. Formato: **Recomendación X:** [acción] → Ahorro estimado: ${currency} [cantidad]/mes. Al final una frase motivacional.`;

            const result = await model.generateContent(prompt);
            let aiResponse = result.response.text();
            if (!aiResponse || aiResponse.length < 50) {
                throw new Error('Respuesta muy corta o vacía');
            }
            return res.json({ recommendations: aiResponse });
        } catch (geminiError) {
            console.error('Error llamando a Gemini:', geminiError.message);
            // Fallback a modo local
            const localResponse = generarRespuestaLocalRealista(
                monthlyIncome, fixedExpenses, categoryTotals, totalExpenses, balance,
                savingsRate, userProfile, currency, debtInfo, userGoal
            );
            return res.json({ recommendations: localResponse });
        }

    } catch (error) {
        console.error('Error en /api/ai/analyze:', error);
        res.json({ recommendations: '⚠️ No se pudo generar el análisis. Intenta de nuevo más tarde.' });
    }
});

app.get('/api/rates', (req, res) => {
    res.json({ rates: { USD:1, EUR:0.92, MXN:17.50, COP:4000, ARS:850, GBP:0.79 } });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}`);
    console.log(`🤖 IA: ${useGemini ? 'ACTIVA (Gemini)' : 'MODO LOCAL'}`);
});