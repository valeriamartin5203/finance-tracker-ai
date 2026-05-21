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
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10 && process.env.GEMINI_API_KEY !== 'tu_api_key_aqui') {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('✅ Gemini IA inicializada');
} else {
    console.log('⚠️ Modo local (sin IA)');
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
        const html = `<div>... reporte ...</div>`;
        await transporter.sendMail({
            from: `"FinanceTracker AI" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '📊 Tu Reporte FinanceTracker AI',
            html
        });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ============ ANÁLISIS IA (CORREGIDO) ============
app.post('/api/ai/analyze', authenticateToken, async (req, res) => {
    try {
        const { transactions, userProfile, currency } = req.body;
        // Validar que los datos llegaron
        if (!userProfile) {
            return res.json({ recommendations: '⚠️ No se encontró tu perfil financiero. Ve a "Mi perfil" y completa tus datos.' });
        }
        const monthlyIncome = userProfile.monthlyIncome || 0;
        const rent = userProfile.rent || 0;
        const services = userProfile.services || 0;
        const groceries = userProfile.groceries || 0;
        const transport = userProfile.transport || 0;
        const fixedExpenses = rent + services + groceries + transport;
        const variableExpenses = (transactions || []).filter(t => t.type === 'gasto').reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = fixedExpenses + variableExpenses;
        const balance = monthlyIncome - totalExpenses;
        const savingsRate = monthlyIncome > 0 ? ((balance / monthlyIncome) * 100).toFixed(1) : 0;

        // Respuesta local (modo seguro)
        const localResponse = generarRespuestaLocal(monthlyIncome, totalExpenses, balance, savingsRate, fixedExpenses, userProfile, currency);
        
        if (!genAI) {
            return res.json({ recommendations: localResponse });
        }

        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const prompt = `Eres un asesor financiero experto. Basado en estos datos reales del cliente, genera 3 recomendaciones prácticas y personalizadas en español:

- Ingreso mensual: ${currency} ${monthlyIncome}
- Gastos fijos: ${currency} ${fixedExpenses} (${((fixedExpenses/monthlyIncome)*100).toFixed(1)}% del ingreso)
- Gastos variables: ${currency} ${variableExpenses}
- Balance: ${currency} ${balance}
- Tasa de ahorro: ${savingsRate}%
- Meta: ${userProfile.goal || 'mejorar finanzas'}

Responde con 3 recomendaciones numeradas y breves.`;
            const result = await model.generateContent(prompt);
            const aiResponse = result.response.text();
            if (aiResponse && aiResponse.length > 20) {
                return res.json({ recommendations: aiResponse });
            } else {
                return res.json({ recommendations: localResponse });
            }
        } catch (aiError) {
            console.error('Error llamando a Gemini:', aiError.message);
            return res.json({ recommendations: localResponse });
        }
    } catch (error) {
        console.error('Error en análisis IA:', error);
        res.json({ recommendations: '⚠️ Error temporal. Intenta de nuevo más tarde.' });
    }
});

function generarRespuestaLocal(monthlyIncome, totalExpenses, balance, savingsRate, fixedExpenses, userProfile, currency) {
    const target = Math.min(20, parseInt(savingsRate) + 10);
    const goalText = {
        'ahorro': 'ahorrar para emergencias',
        'casa': 'comprar casa',
        'auto': 'comprar auto',
        'viaje': 'hacer un viaje',
        'invertir': 'invertir',
        'libertad': 'libertad financiera',
        'deudas': 'pagar deudas'
    };
    return `📊 **ANÁLISIS FINANCIERO PERSONALIZADO**

💰 **Ingreso mensual:** ${currency} ${monthlyIncome.toLocaleString()}
🏠 **Gastos fijos:** ${currency} ${fixedExpenses.toLocaleString()} (${((fixedExpenses/monthlyIncome)*100).toFixed(1)}% del ingreso)
💸 **Gastos variables:** ${currency} ${(totalExpenses - fixedExpenses).toLocaleString()}
⚖️ **Balance mensual:** ${currency} ${balance.toLocaleString()}
📈 **Tasa de ahorro:** ${savingsRate}%

🎯 **Meta seleccionada:** ${goalText[userProfile?.goal] || 'mejorar finanzas'}

🔍 **3 RECOMENDACIONES ACCIONABLES**

1️⃣ **Automatiza tu ahorro**  
   Configura una transferencia automática del ${target}% de tu ingreso el día que te pagan.  
   *Ejemplo:* si ganas ${currency} ${monthlyIncome.toLocaleString()}, ahorra ${currency} ${(monthlyIncome * target / 100).toLocaleString()} cada mes.

2️⃣ **Reduce gastos fijos**  
   Revisa tus suscripciones y servicios. Intenta negociar o cancelar lo que no usas.  
   *Potencial de ahorro:* 10% = ${currency} ${(fixedExpenses * 0.1).toLocaleString()} mensuales.

3️⃣ **Controla los gastos hormiga**  
   Durante 30 días, anota CADA pequeño gasto (café, antojos, etc.). Al final del mes, sorprenderás cuánto puedes ahorrar.  
   *Meta:* Reducir un 20% esos gastos.

💪 **Compromiso semanal**  
"Esta semana ahorraré el ${target}% de mi próximo ingreso antes de gastar."`;
}

app.get('/api/rates', (req, res) => {
    res.json({ rates: { USD:1, EUR:0.92, MXN:17.50, COP:4000, ARS:850, GBP:0.79 } });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}`);
    console.log(`🤖 IA: ${genAI ? 'ACTIVA' : 'LOCAL'}`);
});