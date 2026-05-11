let transactions = [];
let expenseChart = null;
let trendChart = null;
let currentCurrency = 'MXN';
let currentUser = null;
let userProfile = null;
let token = null;

// ============ FUNCIONES AUXILIARES ============
function getCurrencySymbol() {
    const symbols = { USD: '$', EUR: '€', MXN: '$', COP: '$', ARS: '$', GBP: '£' };
    return symbols[currentCurrency] || '$';
}

function formatCurrency(amount) {
    return `${getCurrencySymbol()}${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ AUTENTICACIÓN ============
async function register(email, password, name) {
    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
        });
        const data = await res.json();
        if (data.success) {
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(currentUser));
            return true;
        } else {
            alert(data.error);
            return false;
        }
    } catch (error) {
        alert('Error de conexión');
        return false;
    }
}

async function login(email, password) {
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(currentUser));
            return true;
        } else {
            alert(data.error);
            return false;
        }
    } catch (error) {
        alert('Error de conexión');
        return false;
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    token = null;
    currentUser = null;
    document.getElementById('authModal').style.display = 'flex';
    document.getElementById('profileModal').style.display = 'none';
    document.getElementById('appContainer').style.display = 'none';
}

// ============ PERFIL ============
async function loadProfile() {
    try {
        const res = await fetch('/api/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.profile) {
            userProfile = data.profile;
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

async function saveProfile(profile) {
    try {
        const res = await fetch('/api/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(profile)
        });
        const data = await res.json();
        return data.success;
    } catch (error) {
        return false;
    }
}

// ============ TRANSACCIONES ============
async function loadTransactions() {
    try {
        const res = await fetch('/api/transactions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        transactions = data.transactions || [];
        updateUI();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function saveTransaction(transaction) {
    try {
        const res = await fetch('/api/transactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(transaction)
        });
        const data = await res.json();
        if (data.success) await loadTransactions();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function deleteTransaction(id) {
    if (!confirm('¿Eliminar?')) return;
    try {
        await fetch(`/api/transactions/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        await loadTransactions();
    } catch (error) {
        console.error('Error:', error);
    }
}

// ============ CÁLCULOS ============
function calculateMonthlyIncome() {
    if (!userProfile) return 0;
    let monthly = userProfile.monthlyIncome || 0;
    if (userProfile.incomeFrequency === 'semanal') return monthly * 4.33;
    if (userProfile.incomeFrequency === 'quincenal') return monthly * 2;
    return monthly;
}

function calculateFixedExpenses() {
    if (!userProfile) return 0;
    return (userProfile.rent || 0) + (userProfile.services || 0) + (userProfile.groceries || 0) + (userProfile.transport || 0);
}

function calculateTotals() {
    const income = calculateMonthlyIncome();
    const variableExpenses = transactions.filter(t => t.type === 'gasto').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = calculateFixedExpenses() + variableExpenses;
    return { income, totalExpenses, balance: income - totalExpenses };
}

// ============ GRÁFICAS ============
function updateChart() {
    const canvas = document.getElementById('expenseChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const expensesByCategory = {};
    transactions.filter(t => t.type === 'gasto').forEach(t => {
        expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
    });
    if (expenseChart) expenseChart.destroy();
    if (Object.keys(expensesByCategory).length === 0) {
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
    }
    expenseChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(expensesByCategory),
            datasets: [{
                data: Object.values(expensesByCategory),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#66BB6A']
            }]
        },
        options: { responsive: true, maintainAspectRatio: true }
    });
}

function updateUI() {
    const { income, totalExpenses, balance } = calculateTotals();
    document.getElementById('totalIncome').textContent = formatCurrency(income);
    document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('balance').textContent = formatCurrency(balance);
    
    const monthlyIncome = calculateMonthlyIncome();
    document.getElementById('profileSummaryText').textContent = 
        `💰 Ingreso: ${formatCurrency(monthlyIncome)}/mes | 🎯 Meta: ${userProfile?.goal || 'Ahorro'} | 💰 Ahorros: ${formatCurrency(userProfile?.savings || 0)}`;
    
    updateChart();
    renderTransactions();
}

function renderTransactions() {
    const container = document.getElementById('transactionsList');
    if (transactions.length === 0) {
        container.innerHTML = '<p class="empty-message">📭 No hay transacciones</p>';
        return;
    }
    container.innerHTML = transactions.map(t => `
        <div class="transaction-item">
            <div>
                <div class="transaction-description">${escapeHtml(t.description)}</div>
                <div class="transaction-category">${t.category} • ${t.date}</div>
            </div>
            <div class="transaction-amount ${t.type === 'ingreso' ? 'income' : 'expense'}">
                ${t.type === 'ingreso' ? '+' : '-'} ${formatCurrency(t.amount)}
            </div>
            <button class="delete-btn" onclick="deleteTransaction('${t._id}')">🗑️</button>
        </div>
    `).join('');
}

// ============ IA Y REPORTES ============
async function getAIAnalysis() {
    const { income, totalExpenses, balance } = calculateTotals();
    try {
        const res = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                transactions: transactions.filter(t => t.type === 'gasto'),
                userProfile: userProfile,
                currency: getCurrencySymbol()
            })
        });
        const data = await res.json();
        return data.recommendations;
    } catch (error) {
        return '⚠️ Error al analizar. Intenta de nuevo.';
    }
}

async function sendEmailReport() {
    if (!userProfile?.email) {
        alert('📧 Primero registra tu correo en "Mi perfil"');
        return;
    }
    const btn = document.getElementById('emailReportBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    try {
        const res = await fetch('/api/send-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                transactions: transactions,
                userProfile: userProfile,
                currency: getCurrencySymbol()
            })
        });
        const data = await res.json();
        if (data.success) alert('✅ Reporte enviado a ' + userProfile.email);
        else alert('❌ Error: ' + data.error);
    } catch (error) {
        alert('Error de conexión');
    }
    btn.innerHTML = '<i class="fas fa-envelope"></i>';
    btn.disabled = false;
}

function exportToCSV() {
    if (transactions.length === 0) { alert('No hay transacciones'); return; }
    const headers = ['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Monto'];
    const rows = transactions.map(t => [t.date, `"${t.description}"`, t.category, t.type, t.amount]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transacciones_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    alert('✅ Exportado');
}

// ============ INICIALIZACIÓN ============
async function checkAuthAndStart() {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
        token = savedToken;
        currentUser = JSON.parse(savedUser);
        
        // Probar si el token es válido
        try {
            const testRes = await fetch('/api/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (testRes.status === 401 || testRes.status === 403) {
                // Token inválido, cerrar sesión
                console.log('Token inválido, cerrando sesión');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                document.getElementById('authModal').style.display = 'flex';
                document.getElementById('appContainer').style.display = 'none';
                return;
            }
            
            document.getElementById('authModal').style.display = 'none';
            
            const hasProfile = await loadProfile();
            if (!hasProfile || !userProfile || !userProfile.monthlyIncome) {
                document.getElementById('profileModal').style.display = 'flex';
                document.getElementById('appContainer').style.display = 'none';
            } else {
                document.getElementById('profileModal').style.display = 'none';
                document.getElementById('appContainer').style.display = 'block';
                document.getElementById('welcomeName').textContent = `Bienvenido, ${currentUser.name || currentUser.email?.split('@')[0]}`;
                document.getElementById('welcomeDate').textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                await loadTransactions();
            }
        } catch (error) {
            console.error('Error verificando token:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            document.getElementById('authModal').style.display = 'flex';
            document.getElementById('appContainer').style.display = 'none';
        }
    } else {
        document.getElementById('authModal').style.display = 'flex';
    }
}

// ============ EVENTOS ============
document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndStart();
    
    let isLoginMode = true;
    document.getElementById('toggleAuthMode').addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        const nameGroup = document.getElementById('authNameGroup');
        const btn = document.getElementById('authSubmitBtn');
        if (isLoginMode) {
            nameGroup.style.display = 'none';
            btn.innerHTML = '<i class="fas fa-arrow-right"></i> Ingresar';
            document.getElementById('toggleAuthMode').innerHTML = '¿No tienes cuenta? Regístrate';
        } else {
            nameGroup.style.display = 'block';
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Registrarse';
            document.getElementById('toggleAuthMode').innerHTML = '¿Ya tienes cuenta? Inicia sesión';
        }
    });
    
    document.getElementById('authForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;
        if (isLoginMode) {
            const success = await login(email, password);
            if (success) checkAuthAndStart();
        } else {
            const name = document.getElementById('authName').value;
            const success = await register(email, password, name);
            if (success) {
                document.getElementById('authModal').style.display = 'none';
                document.getElementById('profileModal').style.display = 'flex';
            }
        }
    });
    
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        userProfile = {
            monthlyIncome: parseFloat(document.getElementById('profileIncome').value) || 0,
            incomeFrequency: document.querySelector('input[name="incomeFrequency"]:checked').value,
            rent: parseFloat(document.getElementById('profileRent').value) || 0,
            services: parseFloat(document.getElementById('profileServices').value) || 0,
            groceries: parseFloat(document.getElementById('profileGroceries').value) || 0,
            transport: parseFloat(document.getElementById('profileTransport').value) || 0,
            hasDebt: document.querySelector('input[name="hasDebt"]:checked').value === 'si',
            debtAmount: parseFloat(document.getElementById('profileDebtAmount').value) || 0,
            debtInterest: parseFloat(document.getElementById('profileDebtInterest').value) || 0,
            savings: parseFloat(document.getElementById('profileSavings').value) || 0,
            goal: document.getElementById('profileGoal').value,
            projectionMonths: parseInt(document.getElementById('profileProjection').value),
            email: document.getElementById('profileEmail').value,
            receiveEmailReports: document.getElementById('receiveEmailToggle').checked
        };
        await saveProfile(userProfile);
        document.getElementById('profileModal').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        document.getElementById('welcomeName').textContent = `Bienvenido, ${currentUser?.name || currentUser?.email?.split('@')[0]}`;
        document.getElementById('welcomeDate').textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        await loadTransactions();
    });
    
    document.getElementById('transactionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const description = document.getElementById('descriptionInput').value;
        const amount = parseFloat(document.getElementById('amountInput').value);
        const category = document.getElementById('categorySelect').value;
        const type = document.getElementById('typeSelect').value;
        const date = document.getElementById('dateInput').value;
        const tags = document.getElementById('tagsInput').value.split(' ').filter(t => t.startsWith('#'));
        if (!description || isNaN(amount) || amount <= 0) { alert('Completa los campos'); return; }
        await saveTransaction({ description, amount, category, type, date, tags });
        document.getElementById('transactionForm').reset();
        document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];
    });
    
    document.getElementById('analyzeBtn').addEventListener('click', async () => {
        const btn = document.getElementById('analyzeBtn');
        const container = document.getElementById('aiRecommendations');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...';
        btn.disabled = true;
        container.innerHTML = '<div class="loading-spinner">🧠 Analizando...</div>';
        const analysis = await getAIAnalysis();
        container.innerHTML = `<div>${analysis.replace(/\n/g, '<br>')}</div>`;
        btn.innerHTML = '<i class="fas fa-brain"></i> Analizar';
        btn.disabled = false;
    });
    
    document.getElementById('emailReportBtn').addEventListener('click', sendEmailReport);
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('editProfileMenu').addEventListener('click', () => {
        document.getElementById('profileModal').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
    });
    document.getElementById('currencySelect').addEventListener('change', (e) => {
        currentCurrency = e.target.value;
        updateUI();
    });
    document.getElementById('themeToggle').addEventListener('click', () => {
        document.body.classList.toggle('dark');
    });
    document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];
    
    document.querySelectorAll('.radio-card').forEach(card => {
        card.addEventListener('click', function() {
            const radio = this.querySelector('input');
            radio.checked = true;
            this.parentElement.querySelectorAll('.radio-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
    
    const debtRadios = document.querySelectorAll('input[name="hasDebt"]');
    debtRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('debtFields').style.display = e.target.value === 'si' ? 'block' : 'none';
        });
    });
});

window.deleteTransaction = deleteTransaction;