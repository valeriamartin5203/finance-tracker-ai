// ============ VARIABLES GLOBALES ============
let transactions = [];
let expenseChart = null;
let trendChart = null;
let currentCurrency = 'MXN';
let currentUser = null;
let reminders = [];
let currentMonthFilter = 'all';
let currentTagFilter = '';

let userProfile = {
    monthlyIncome: 0,
    incomeFrequency: 'mensual',
    rent: 0,
    services: 0,
    groceries: 0,
    transport: 0,
    hasDebt: false,
    debtAmount: 0,
    debtInterest: 0,
    savings: 0,
    goal: 'ahorro',
    projectionMonths: 12
};

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

function getGoalText() {
    const goals = {
        'ahorro': 'Ahorrar para emergencias',
        'casa': 'Comprar casa',
        'auto': 'Comprar auto',
        'viaje': 'Hacer un viaje',
        'invertir': 'Invertir',
        'libertad': 'Libertad financiera',
        'deudas': 'Pagar deudas'
    };
    return goals[userProfile.goal] || userProfile.goal;
}

function toggleDebtFields(show) {
    const debtFields = document.getElementById('debtFields');
    if (debtFields) debtFields.style.display = show ? 'block' : 'none';
}

function parseTags(tagsString) {
    if (!tagsString) return [];
    return tagsString.split(/\s+/).filter(t => t.startsWith('#'));
}

// ============ CÁLCULOS FINANCIEROS ============
function calculateMonthlyIncome() {
    let monthly = userProfile.monthlyIncome;
    if (userProfile.incomeFrequency === 'semanal') return monthly * 4.33;
    if (userProfile.incomeFrequency === 'quincenal') return monthly * 2;
    return monthly;
}

function calculateFixedExpenses() {
    return userProfile.rent + userProfile.services + userProfile.groceries + userProfile.transport;
}

function calculateTotals() {
    const income = calculateMonthlyIncome();
    const filteredTransactions = filterTransactions();
    const variableExpenses = filteredTransactions
        .filter(t => t.type === 'gasto')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalExpenses = calculateFixedExpenses() + variableExpenses;
    const balance = income - totalExpenses;
    return { income, totalExpenses, balance, filteredTransactions };
}

function filterTransactions() {
    let filtered = [...transactions];
    
    // Filtrar por mes
    if (currentMonthFilter !== 'all') {
        filtered = filtered.filter(t => t.date.startsWith(currentMonthFilter));
    }
    
    // Filtrar por etiqueta
    if (currentTagFilter) {
        filtered = filtered.filter(t => t.tags && t.tags.includes(currentTagFilter));
    }
    
    return filtered;
}

// ============ DATOS MENSUALES PARA GRÁFICA ============
function getMonthlyData() {
    const monthlyData = {};
    
    transactions.forEach(t => {
        const month = t.date.substring(0, 7);
        if (!monthlyData[month]) {
            monthlyData[month] = { ingresos: 0, gastos: 0 };
        }
        if (t.type === 'ingreso') {
            monthlyData[month].ingresos += t.amount;
        } else {
            monthlyData[month].gastos += t.amount;
        }
    });
    
    const months = Object.keys(monthlyData).sort();
    const ingresos = months.map(m => monthlyData[m].ingresos);
    const gastos = months.map(m => monthlyData[m].gastos);
    
    return { months, ingresos, gastos };
}

// ============ API CALLS ============
async function loadData() {
    try {
        const response = await fetch('/api/transactions');
        const data = await response.json();
        transactions = data.transactions || [];
        updateMonthFilter();
        updateUI();
        checkReminders();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function loadProfile() {
    try {
        const response = await fetch('/api/profile');
        const data = await response.json();
        if (data.profile) userProfile = data.profile;
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function loadReminders() {
    try {
        const response = await fetch('/api/reminders');
        const data = await response.json();
        reminders = data.reminders || [];
        renderReminders();
    } catch (error) {
        console.error('Error loading reminders:', error);
    }
}

async function saveProfile(profile) {
    try {
        await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
        });
    } catch (error) {
        console.error('Error saving profile:', error);
    }
}

async function saveTransaction(transaction) {
    try {
        const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaction)
        });
        const data = await response.json();
        if (data.success) await loadData();
        return data.success;
    } catch (error) {
        console.error('Error saving transaction:', error);
        return false;
    }
}

async function deleteTransaction(id) {
    if (!confirm('¿Eliminar esta transacción?')) return;
    try {
        await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
        await loadData();
    } catch (error) {
        console.error('Error deleting transaction:', error);
    }
}

async function saveReminder(reminder) {
    try {
        const response = await fetch('/api/reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reminder)
        });
        const data = await response.json();
        if (data.success) await loadReminders();
    } catch (error) {
        console.error('Error saving reminder:', error);
    }
}

async function deleteReminder(id) {
    try {
        await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
        await loadReminders();
    } catch (error) {
        console.error('Error deleting reminder:', error);
    }
}

async function sendEmailReport() {
    const email = prompt('📧 Ingresa tu correo electrónico para recibir el reporte:');
    if (!email || !email.includes('@')) {
        alert('Correo inválido');
        return;
    }
    
    const { income, totalExpenses, balance, filteredTransactions } = calculateTotals();
    
    try {
        const response = await fetch('/api/send-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                transactions: filteredTransactions,
                userProfile,
                currency: getCurrencySymbol()
            })
        });
        const data = await response.json();
        if (data.success) {
            alert('✅ Reporte enviado a tu correo');
        } else {
            alert('❌ Error al enviar el reporte');
        }
    } catch (error) {
        console.error('Error sending report:', error);
        alert('Error al enviar el reporte');
    }
}

function exportToCSV() {
    const filtered = filterTransactions();
    if (filtered.length === 0) {
        alert('No hay transacciones para exportar');
        return;
    }
    
    const headers = ['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Monto', 'Etiquetas'];
    const rows = filtered.map(t => [
        t.date,
        `"${t.description}"`,
        t.category,
        t.type === 'ingreso' ? 'Ingreso' : 'Gasto',
        t.amount,
        (t.tags || []).join(' ')
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `transacciones_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert('✅ Reporte exportado exitosamente');
}

async function syncData() {
    alert('🔄 Sincronizando datos en la nube...\nTus datos ya están guardados en el servidor.');
}

function checkReminders() {
    const today = new Date().toISOString().split('T')[0];
    const upcomingReminders = reminders.filter(r => r.date === today);
    if (upcomingReminders.length > 0) {
        const message = upcomingReminders.map(r => `📢 ${r.name}: ${formatCurrency(r.amount)}`).join('\n');
        alert(`🔔 Recordatorios para hoy:\n${message}`);
    }
}

function renderReminders() {
    const container = document.getElementById('remindersList');
    if (!reminders.length) {
        container.innerHTML = '<p class="empty-message">No hay recordatorios</p>';
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    container.innerHTML = reminders.map(r => {
        let statusClass = '';
        if (r.date === today) statusClass = 'danger';
        else if (r.date < today) statusClass = 'warning';
        
        return `
            <div class="reminder-item ${statusClass}">
                <div class="reminder-info">
                    <div class="reminder-name">${escapeHtml(r.name)}</div>
                    <div class="reminder-amount">${formatCurrency(r.amount)}</div>
                    <div class="reminder-date">📅 ${r.date}</div>
                </div>
                <div class="reminder-actions">
                    <button class="delete-reminder" onclick="deleteReminder('${r._id}')">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateMonthFilter() {
    const months = [...new Set(transactions.map(t => t.date.substring(0, 7)))].sort();
    const select = document.getElementById('monthFilter');
    if (select) {
        select.innerHTML = '<option value="all">📅 Todos los meses</option>' +
            months.map(m => `<option value="${m}">${m}</option>`).join('');
    }
}

// ============ GRÁFICAS ============
function updateTrendChart() {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    
    const { months, ingresos, gastos } = getMonthlyData();
    const ctx = canvas.getContext('2d');
    
    if (trendChart) trendChart.destroy();
    
    if (months.length === 0) {
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#999';
        ctx.font = '16px Arial';
        ctx.fillText('No hay datos suficientes', canvas.width/2 - 100, canvas.height/2);
        return;
    }
    
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Ingresos',
                    data: ingresos,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Gastos',
                    data: gastos,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            }
        }
    });
}

function updateChart() {
    const canvas = document.getElementById('expenseChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const filtered = filterTransactions();
    const expensesByCategory = {};
    
    filtered.filter(t => t.type === 'gasto').forEach(t => {
        const cat = t.category || 'Otros';
        expensesByCategory[cat] = (expensesByCategory[cat] || 0) + t.amount;
    });
    
    if (expenseChart) expenseChart.destroy();
    
    if (Object.keys(expensesByCategory).length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#999';
        ctx.font = '16px Arial';
        ctx.fillText('No hay datos de gastos', canvas.width/2 - 100, canvas.height/2);
        return;
    }
    
    expenseChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(expensesByCategory),
            datasets: [{
                data: Object.values(expensesByCategory),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#66BB6A'],
                borderWidth: 2,
                borderColor: 'white'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a,b) => a + b, 0);
                            const percentage = total > 0 ? ((value/total)*100).toFixed(1) : 0;
                            return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function updateUI() {
    const { income, totalExpenses, balance, filteredTransactions } = calculateTotals();
    
    document.getElementById('totalIncome').textContent = formatCurrency(income);
    document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('balance').textContent = formatCurrency(balance);
    
    const monthlyIncome = calculateMonthlyIncome();
    document.getElementById('profileSummaryText').textContent = 
        `💰 Ingreso: ${formatCurrency(monthlyIncome)}/mes | 🎯 Meta: ${getGoalText()} | 💰 Ahorros: ${formatCurrency(userProfile.savings)}`;
    
    updateTrendChart();
    updateChart();
    renderTransactions(filteredTransactions);
}

function renderTransactions(transactionsToRender) {
    const container = document.getElementById('transactionsList');
    
    if (!transactionsToRender || transactionsToRender.length === 0) {
        container.innerHTML = '<p class="empty-message">📭 No hay transacciones</p>';
        return;
    }
    
    container.innerHTML = transactionsToRender.map(t => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-description">${escapeHtml(t.description)}</div>
                <div class="transaction-category">
                    ${t.category}
                    ${t.tags ? t.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('') : ''}
                </div>
                <div class="transaction-date">📅 ${t.date}</div>
            </div>
            <div class="transaction-amount ${t.type === 'ingreso' ? 'income' : 'expense'}">
                ${t.type === 'ingreso' ? '+' : '-'} ${formatCurrency(t.amount)}
            </div>
            <button class="delete-btn" onclick="deleteTransaction('${t._id}')">🗑️</button>
        </div>
    `).join('');
}

async function getAIAnalysis() {
    const { income, totalExpenses, balance, filteredTransactions } = calculateTotals();
    const savingsRate = income > 0 ? ((balance / income) * 100).toFixed(1) : 0;
    
    try {
        const response = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactions: filteredTransactions.filter(t => t.type === 'gasto'),
                userProfile: userProfile,
                currency: getCurrencySymbol(),
                totalIncome: income,
                totalExpenses: totalExpenses,
                balance: balance,
                savingsRate: savingsRate
            })
        });
        const data = await response.json();
        return data.recommendations;
    } catch (error) {
        console.error('Error en análisis IA:', error);
        return '⚠️ Error al conectar con el análisis. Intenta de nuevo.';
    }
}

// ============ INICIALIZACIÓN ============
async function initializeApp() {
    await loadProfile();
    await loadData();
    await loadReminders();
    updateMonthFilter();
    
    document.getElementById('appContainer').style.display = 'block';
    
    document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];
    
    // Éxito de sincronización
    document.getElementById('syncBtn').addEventListener('click', syncData);
    document.getElementById('emailReportBtn').addEventListener('click', sendEmailReport);
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    
    // Filtros
    document.getElementById('monthFilter').addEventListener('change', (e) => {
        currentMonthFilter = e.target.value;
        updateUI();
    });
    
    document.getElementById('tagFilter').addEventListener('input', (e) => {
        currentTagFilter = e.target.value;
        updateUI();
    });
    
    document.getElementById('clearFiltersBtn').addEventListener('click', () => {
        currentMonthFilter = 'all';
        currentTagFilter = '';
        document.getElementById('monthFilter').value = 'all';
        document.getElementById('tagFilter').value = '';
        updateUI();
    });
}

// ============ EVENTOS ============
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    
    // Formulario de transacción
    document.getElementById('transactionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const description = document.getElementById('descriptionInput').value;
        const amount = parseFloat(document.getElementById('amountInput').value);
        const category = document.getElementById('categorySelect').value;
        const type = document.getElementById('typeSelect').value;
        const date = document.getElementById('dateInput').value;
        const tagsString = document.getElementById('tagsInput').value;
        const tags = parseTags(tagsString);
        
        if (!description || isNaN(amount) || amount <= 0) {
            alert('Completa todos los campos correctamente');
            return;
        }
        
        await saveTransaction({ description, amount, category, type, date, tags });
        
        document.getElementById('transactionForm').reset();
        document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];
        document.getElementById('typeSelect').value = 'ingreso';
        document.getElementById('tagsInput').value = '';
    });
    
    // Formulario de recordatorios
    document.getElementById('reminderForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('reminderName').value;
        const amount = parseFloat(document.getElementById('reminderAmount').value);
        const date = document.getElementById('reminderDate').value;
        
        if (!name || isNaN(amount) || !date) {
            alert('Completa todos los campos');
            return;
        }
        
        await saveReminder({ name, amount, date });
        
        document.getElementById('reminderForm').reset();
    });
    
    // Botón de análisis IA
    document.getElementById('analyzeBtn').addEventListener('click', async () => {
        const btn = document.getElementById('analyzeBtn');
        const container = document.getElementById('aiRecommendations');
        
        btn.textContent = '🤔 Analizando...';
        btn.disabled = true;
        container.innerHTML = '<div class="loading-spinner">🧠 Analizando tus datos...</div>';
        
        const analysis = await getAIAnalysis();
        container.innerHTML = `<div class="recommendations-content">${analysis.replace(/\n/g, '<br>')}</div>`;
        
        btn.textContent = '✨ Analizar';
        btn.disabled = false;
    });
    
    // Cambio de moneda
    document.getElementById('currencySelect').addEventListener('change', (e) => {
        currentCurrency = e.target.value;
        updateUI();
    });
});

window.deleteTransaction = deleteTransaction;
window.deleteReminder = deleteReminder;