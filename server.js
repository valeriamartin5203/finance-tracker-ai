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

// ============ EMAIL (configuración) ============
let transporter = null;
try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
            timeout: 5000
        });
        console.log('✅ Email configurado');
    }
} catch (error) {
    console.log('⚠️ Error configurando email:', error.message);
}

// ============ GEMINI AI (modelo correcto) ============
let genAI = null;
try {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10 && process.env.GEMINI_API_KEY !== 'tu_api_key_aqui') {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log('✅ Gemini IA inicializada');
    } else {
        console.log('⚠️ No hay API Key de Gemini, usando modo local');
    }
} catch (error) {
    console.log('⚠️ Error Gemini:', error.message);
}

app.use(express.json());
app.use(express.static('public'));

// ============ MIDDLEWARE AUTH ============
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token requerido', code: 'NO_TOKEN' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.log('❌ Error verificando token:', err.message);
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
            }
            return res.status(403).json({ error: 'Token inválido', code: 'INVALID_TOKEN' });
        }
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
            name: name || email.split('@')[0],
            password: hashedPassword,
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        writeJSON(USERS_FILE, users);
        const token = jwt.sign({ id: newUser.id, email }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.json({ success: true, token, user: { id: newUser.id, email, name: newUser.name } });
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

// ============ ENVIAR REPORTE (optimizado - no bloquea) ============
app.post('/api/send-report', authenticateToken, async (req, res) => {
    try {
        const { transactions, userProfile, currency } = req.body;
        const userEmail = userProfile?.email;
        
        if (!userEmail) {
            return res.status(400).json({ error: 'No hay correo registrado' });
        }
        
        if (!transporter) {
            return res.status(400).json({ error: 'Email no configurado' });
        }

        const monthlyIncome = userProfile?.monthlyIncome || 0;
        const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
        const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0);
        const balance = totalIngresos - totalGastos;
        const savingsRate = monthlyIncome > 0 ? ((balance / monthlyIncome) * 100).toFixed(1) : 0;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; text-align: center; color: white;">
                    <h1>💰 FinanceTracker AI</h1>
                    <p>Tu Reporte Financiero</p>
                </div>
                <div style="padding: 20px;">
                    <h2>📊 Resumen</h2>
                    <p><strong>💰 Ingresos:</strong> ${currency} ${totalIngresos.toLocaleString()}</p>
                    <p><strong>💸 Gastos:</strong> ${currency} ${totalGastos.toLocaleString()}</p>
                    <p><strong>⚖️ Balance:</strong> ${currency} ${balance.toLocaleString()}</p>
                    <p><strong>📈 Tasa de ahorro:</strong> ${savingsRate}%</p>
                    <hr>
                    <p><strong>🎯 Meta:</strong> ${userProfile?.goal || 'Mejorar finanzas'}</p>
                    <p><strong>💰 Ahorros actuales:</strong> ${currency} ${(userProfile?.savings || 0).toLocaleString()}</p>
                </div>
                <div style="background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px;">
                    <p>📱 Revisa tu progreso en la app</p>
                    <p>© FinanceTracker AI</p>
                </div>
            </div>
        `;

        // Enviar email sin esperar respuesta (fire and forget)
        transporter.sendMail({
            from: `"FinanceTracker AI" <${process.env.EMAIL_USER}>`,
            to: userEmail,
            subject: '📊 Tu Reporte FinanceTracker AI',
            html
        }).catch(err => console.error('Error email:', err));

        // Responder inmediatamente
        res.json({ success: true, message: 'Reporte enviado' });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ ANÁLISIS IA (CORREGIDO - modelo correcto) ============
app.post('/api/ai/analyze', authenticateToken, async (req, res) => {
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

        // Si no hay IA, usar respuesta local
        if (!genAI) {
            const localResponse = generarRespuestaLocal(monthlyIncome, totalExpenses, balance, savingsRate, fixedExpenses, userProfile, currency);
            return res.json({ recommendations: localResponse });
        }

        // Usar el modelo correcto de Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        const prompt = `Eres un asesor financiero experto. Basado en estos datos, da 3 recomendaciones prácticas y específicas:

- Ingreso mensual: ${currency} ${monthlyIncome}
- Gastos fijos: ${currency} ${fixedExpenses} (${((fixedExpenses/monthlyIncome)*100).toFixed(1)}% del ingreso)
- Gastos variables: ${currency} ${variableExpenses}
- Balance: ${currency} ${balance}
- Tasa de ahorro: ${savingsRate}%

Responde con 3 recomendaciones cortas, numeradas y en español.`;

        const result = await model.generateContent(prompt);
        let recommendations = result.response.text();
        
        // Si la respuesta está vacía o es muy corta, usar respuesta local
        if (!recommendations || recommendations.length < 20) {
            recommendations = generarRespuestaLocal(monthlyIncome, totalExpenses, balance, savingsRate, fixedExpenses, userProfile, currency);
        }
        
        res.json({ recommendations });
        
    } catch (error) {
        console.error('Error en IA:', error.message);
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
        const localResponse = generarRespuestaLocal(monthlyIncome, totalExpenses, balance, savingsRate, fixedExpenses, userProfile, currency);
        res.json({ recommendations: localResponse });
    }
});

function generarRespuestaLocal(monthlyIncome, totalExpenses, balance, savingsRate, fixedExpenses, userProfile, currency) {
    const targetSavings = Math.min(20, parseInt(savingsRate) + 10);
    return `📊 **ANÁLISIS FINANCIERO**

💰 **Resumen**
• Ingreso mensual: ${currency} ${monthlyIncome.toLocaleString()}
• Gastos totales: ${currency} ${totalExpenses.toLocaleString()}
• Balance: ${currency} ${balance.toLocaleString()}
• Tasa de ahorro: ${savingsRate}%

🎯 **3 RECOMENDACIONES**

1️⃣ Automatiza un ahorro del ${targetSavings}% de tu ingreso el día que te pagan.

2️⃣ Reduce tus gastos fijos en un 10% este mes (revisa suscripciones, negocia servicios).

3️⃣ Registra todos tus gastos diariamente durante 30 días para identificar patrones.

💪 **Compromiso**: "Esta semana ahorraré el ${targetSavings}% de mi próximo ingreso antes de gastar."`;
}

app.get('/api/rates', (req, res) => {
    res.json({ rates: { USD: 1, EUR: 0.92, MXN: 17.50, COP: 4000, ARS: 850, GBP: 0.79 } });
});
// ============ ARCHIVO PARA PAGOS PROGRAMADOS ============
const SCHEDULED_PAYMENTS_FILE = path.join(DATA_DIR, 'scheduled_payments.json');

if (!fs.existsSync(SCHEDULED_PAYMENTS_FILE)) {
    fs.writeFileSync(SCHEDULED_PAYMENTS_FILE, JSON.stringify({}, null, 2));
}

// Obtener pagos programados del usuario
app.get('/api/scheduled-payments', authenticateToken, (req, res) => {
    const payments = readJSON(SCHEDULED_PAYMENTS_FILE);
    const userPayments = payments[req.user.id] || [];
    res.json({ payments: userPayments });
});

// Agregar pago programado
app.post('/api/scheduled-payments', authenticateToken, (req, res) => {
    const payments = readJSON(SCHEDULED_PAYMENTS_FILE);
    if (!payments[req.user.id]) payments[req.user.id] = [];
    
    const newPayment = {
        _id: Date.now().toString(),
        ...req.body,
        paid: false,
        createdAt: new Date().toISOString()
    };
    payments[req.user.id].push(newPayment);
    writeJSON(SCHEDULED_PAYMENTS_FILE, payments);
    res.json({ success: true, payment: newPayment });
});

// Actualizar pago (marcar como pagado)
app.put('/api/scheduled-payments/:id', authenticateToken, (req, res) => {
    const payments = readJSON(SCHEDULED_PAYMENTS_FILE);
    if (payments[req.user.id]) {
        const index = payments[req.user.id].findIndex(p => p._id === req.params.id);
        if (index !== -1) {
            payments[req.user.id][index] = { ...payments[req.user.id][index], ...req.body };
            writeJSON(SCHEDULED_PAYMENTS_FILE, payments);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Pago no encontrado' });
        }
    } else {
        res.status(404).json({ error: 'No hay pagos' });
    }
});

// Eliminar pago programado
app.delete('/api/scheduled-payments/:id', authenticateToken, (req, res) => {
    const payments = readJSON(SCHEDULED_PAYMENTS_FILE);
    if (payments[req.user.id]) {
        payments[req.user.id] = payments[req.user.id].filter(p => p._id !== req.params.id);
        writeJSON(SCHEDULED_PAYMENTS_FILE, payments);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Pago no encontrado' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}`);
    console.log(`🤖 IA: ${genAI ? 'ACTIVA (Gemini 1.5 Flash)' : 'MODO LOCAL'}`);
    console.log(`📧 Email: ${transporter ? 'CONFIGURADO' : 'NO CONFIGURADO'}`);
});