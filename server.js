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
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
if (!fs.existsSync(PROFILES_FILE)) fs.writeFileSync(PROFILES_FILE, JSON.stringify({}, null, 2));
if (!fs.existsSync(TRANSACTIONS_FILE)) fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify({}, null, 2));

const readJSON = (file) => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { return []; }
};
const writeJSON = (file, data) => {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); return true; }
    catch (error) { return false; }
};

// ============ EMAIL ============
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// ============ GEMINI AI ============
let genAI = null;
try {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log('✅ Gemini IA inicializada');
    }
} catch (error) { console.log('⚠️ Error Gemini:', error.message); }

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

// ============ ENDPOINTS DE AUTENTICACIÓN ============
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        const users = readJSON(USERS_FILE);
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'El correo ya está registrado' });
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

// ============ ENDPOINTS DE PERFIL ============
app.get('/api/profile', authenticateToken, (req, res) => {
    const profiles = readJSON(PROFILES_FILE);
    const profile = profiles[req.user.id] || null;
    res.json({ profile });
});

app.post('/api/profile', authenticateToken, (req, res) => {
    const profiles = readJSON(PROFILES_FILE);
    profiles[req.user.id] = { ...req.body, userId: req.user.id, updatedAt: new Date().toISOString() };
    writeJSON(PROFILES_FILE, profiles);
    res.json({ success: true });
});

// ============ ENDPOINTS DE TRANSACCIONES ============
app.get('/api/transactions', authenticateToken, (req, res) => {
    const transactions = readJSON(TRANSACTIONS_FILE);
    const userTransactions = transactions[req.user.id] || [];
    res.json({ transactions: userTransactions, categories: ['Comida', 'Transporte', 'Entretenimiento', 'Servicios', 'Salud', 'Educacion', 'Otros'] });
});

app.post('/api/transactions', authenticateToken, (req, res) => {
    const transactions = readJSON(TRANSACTIONS_FILE);
    if (!transactions[req.user.id]) transactions[req.user.id] = [];
    const newTransaction = {
        _id: Date.now().toString(),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    transactions[req.user.id].unshift(newTransaction);
    writeJSON(TRANSACTIONS_FILE, transactions);
    res.json({ success: true, transaction: newTransaction });
});

app.delete('/api/transactions/:id', authenticateToken, (req, res) => {
    const transactions = readJSON(TRANSACTIONS_FILE);
    if (transactions[req.user.id]) {
        transactions[req.user.id] = transactions[req.user.id].filter(t => t._id !== req.params.id);
        writeJSON(TRANSACTIONS_FILE, transactions);
    }
    res.json({ success: true });
});

// ============ ENVIAR REPORTE ============
app.post('/api/send-report', authenticateToken, async (req, res) => {
    try {
        const { transactions, userProfile, currency } = req.body;
        const userEmail = userProfile?.email;
        if (!userEmail) return res.status(400).json({ error: 'No hay correo registrado' });

        const monthlyIncome = userProfile?.monthlyIncome || 0;
        const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
        const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0);
        const balance = totalIngresos - totalGastos;

        const html = `
            <h1>📊 Reporte Financiero</h1>
            <p>💰 Ingresos: ${currency} ${totalIngresos}</p>
            <p>💸 Gastos: ${currency} ${totalGastos}</p>
            <p>⚖️ Balance: ${currency} ${balance}</p>
            <p>📅 Ingreso mensual: ${currency} ${monthlyIncome}</p>
            <hr>
            <p>💪 Sigue así! Revisa tu progreso en la app.</p>
        `;

        await transporter.sendMail({
            from: `"FinanceTracker AI" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: '📊 Tu Reporte Semanal FinanceTracker AI',
            html
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ ANÁLISIS IA ============
app.post('/api/ai/analyze', authenticateToken, async (req, res) => {
    try {
        const { transactions, userProfile, currency } = req.body;
        const monthlyIncome = userProfile?.monthlyIncome || 0;
        const fixedExpenses = (userProfile?.rent || 0) + (userProfile?.services || 0) + (userProfile?.groceries || 0) + (userProfile?.transport || 0);
        const variableExpenses = (transactions || []).filter(t => t.type === 'gasto').reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = fixedExpenses + variableExpenses;
        const balance = monthlyIncome - totalExpenses;
        const savingsRate = monthlyIncome > 0 ? ((balance / monthlyIncome) * 100).toFixed(1) : 0;

        if (!genAI) {
            return res.json({ recommendations: `📊 Diagnóstico:\n💰 Ingreso: ${currency}${monthlyIncome}\n💸 Gastos: ${currency}${totalExpenses}\n📈 Ahorro: ${savingsRate}%\n\n1️⃣ Automatiza el ${Math.min(20, parseInt(savingsRate) + 10)}% de tu ingreso\n2️⃣ Reduce gastos fijos en 10%\n3️⃣ Registra todos tus gastos diariamente` });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `Eres un asesor financiero. Datos: ingreso ${currency}${monthlyIncome}, gastos ${currency}${totalExpenses}, ahorro ${savingsRate}%. Da 3 recomendaciones específicas.`;
        const result = await model.generateContent(prompt);
        res.json({ recommendations: result.response.text() });
    } catch (error) {
        res.json({ recommendations: '⚠️ Error. Intenta de nuevo.' });
    }
});

app.get('/api/rates', (req, res) => {
    res.json({ rates: { USD: 1, EUR: 0.92, MXN: 17.50, COP: 4000, ARS: 850, GBP: 0.79 } });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}`);
    console.log(`🤖 IA: ${genAI ? 'ACTIVA' : 'LOCAL'}`);
    console.log(`📧 Email: ${process.env.EMAIL_USER ? 'CONFIGURADO' : 'NO'}`);
});