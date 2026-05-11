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

// ============ CONFIGURACIÓN DE ARCHIVOS ============
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
} else {
    console.log('⚠️ Email no configurado');
}

// ============ GEMINI AI ============
let genAI = null;
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10 && process.env.GEMINI_API_KEY !== 'tu_api_key_aqui') {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('✅ Gemini IA inicializada');
} else {
    console.log('⚠️ Modo local (sin IA)');
}

app.use(express.json());
app.use(express.static('public'));

// ============ MIDDLEWARE ============
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

// ============ AUTH ============
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

// ============ ENVÍO DE REPORTE ============
app.post('/api/send-report', authenticateToken, async (req, res) => {
    try {
        const { transactions, userProfile, currency } = req.body;
        const email = userProfile?.email;
        if (!email) return res.status(400).json({ error: 'Correo no registrado' });
        if (!transporter) return res.status(400).json({ error: 'Email no configurado' });

        const ingresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
        const gastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0);
        const balance = ingresos - gastos;
        const savingsRate = userProfile.monthlyIncome > 0 ? ((balance / userProfile.monthlyIncome) * 100).toFixed(1) : 0;

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
                <p><strong>Tasa ahorro:</strong> ${savingsRate}%</p>
                <hr>
                <p><strong>Meta:</strong> ${userProfile.goal || 'Mejorar finanzas'}</p>
                <p><strong>Ahorros:</strong> ${currency} ${userProfile.savings || 0}</p>
            </div>
            <div style="background:#f0f0f0; padding:15px; text-align:center; font-size:12px">
                <p>© FinanceTracker AI</p>
            </div>
        </div>`;

        transporter.sendMail({
            from: `"FinanceTracker AI" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '📊 Tu Reporte FinanceTracker AI',
            html
        }).catch(e => console.error(e));
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ============ ANÁLISIS IA ============
app.post('/api/ai/analyze', authenticateToken, async (req, res) => {
    try {
        const { transactions, userProfile, currency } = req.body;
        const income = userProfile?.monthlyIncome || 0;
        const fixed = (userProfile?.rent||0)+(userProfile?.services||0)+(userProfile?.groceries||0)+(userProfile?.transport||0);
        const variable = transactions.filter(t => t.type === 'gasto').reduce((s,t)=>s+t.amount,0);
        const total = fixed + variable;
        const balance = income - total;
        const savings = income > 0 ? ((balance/income)*100).toFixed(1) : 0;

        if (!genAI) {
            return res.json({ recommendations: generarRespuestaLocal(income, total, balance, savings, currency) });
        }
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `Eres asesor financiero. Datos: ingreso ${currency}${income}, gastos ${currency}${total}, ahorro ${savings}%. Da 3 consejos prácticos.`;
        const result = await model.generateContent(prompt);
        res.json({ recommendations: result.response.text() });
    } catch (error) { res.json({ recommendations: generarRespuestaLocal(0,0,0,0,'$') }); }
});

function generarRespuestaLocal(income, total, balance, savings, currency) {
    return `📊 **Análisis Financiero**

💰 Ingreso: ${currency}${income}
💸 Gastos: ${currency}${total}
⚖️ Balance: ${currency}${balance}
📈 Ahorro: ${savings}%

1️⃣ Automatiza un ahorro del 15% de tu ingreso.
2️⃣ Reduce gastos fijos en un 10% este mes.
3️⃣ Registra todos tus gastos diariamente.`;
}

app.get('/api/rates', (req, res) => {
    res.json({ rates: { USD:1, EUR:0.92, MXN:17.50, COP:4000, ARS:850, GBP:0.79 } });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}`);
    console.log(`🤖 IA: ${genAI ? 'ACTIVA' : 'LOCAL'}`);
    console.log(`📧 Email: ${transporter ? 'CONFIGURADO' : 'NO'}`);
});