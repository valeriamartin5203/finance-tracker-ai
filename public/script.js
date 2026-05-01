let transactions = [];
let expenseChart = null;
let currentCurrency = 'MXN';
let userProfile = {
    monthlyIncome: 0, incomeFrequency: 'mensual', rent: 0, services: 0,
    groceries: 0, transport: 0, hasDebt: false, debtAmount: 0,
    debtInterest: 0, savings: 0, goal: 'ahorro', projectionMonths: 12
};

function getCurrencySymbol() {
    const symbols = { USD: '$', EUR: '€', MXN: '$', COP: '$', ARS: '$', GBP: '£' };
    return symbols[currentCurrency] || '$';
}

function formatCurrency(amount) {
    return `${getCurrencySymbol()}${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

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
    const variableExpenses = transactions.filter(t => t.type === 'gasto').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = calculateFixedExpenses() + variableExpenses;
    return { income, totalExpenses, balance: income - totalExpenses };
}

async function loadData() {
    try {
        const res = await fetch('/api/transactions');
        const data = await res.json();
        transactions = data.transactions || [];
        updateUI();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function loadProfile() {
    try {
        const res = await fetch('/api/profile');
        const data = await res.json();
        if (data.profile) userProfile = data.profile;
    } catch (error) {
        console.error('Error:', error);
    }
}

async function saveTransaction(transaction) {
    try {
        await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaction)
        });
        await loadData();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function deleteTransaction(id) {
    if (!confirm('¿Eliminar esta transacción?')) return;
    try {
        await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
        await loadData();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function getAIAnalysis() {
    const { income, totalExpenses, balance } = calculateTotals();
    
    try {
        const res = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactions: transactions.filter(t => t.type === 'gasto'),
                userProfile: userProfile,
                currency: getCurrencySymbol()
            })
        });
        const data = await res.json();
        return data.recommendations;
    } catch (error) {
        console.error('Error:', error);
        return '⚠️ Error al conectar con el análisis. Intenta de nuevo.';
    }
}

function updateUI() {
    const { income, totalExpenses, balance } = calculateTotals();
    document.getElementById('totalIncome').textContent = formatCurrency(income);
    document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('balance').textContent = formatCurrency(balance);
    
    const monthlyIncome = calculateMonthlyIncome();
    const goalText = {
        'ahorro': 'Ahorrar para emergencias',
        'casa': 'Comprar casa',
        'auto': 'Comprar auto',
        'viaje': 'Hacer un viaje',
        'invertir': 'Invertir',
        'libertad': 'Libertad financiera',
        'deudas': 'Pagar deudas'
    };
    document.getElementById('profileSummaryText').textContent = 
        `💰 Ingreso: ${formatCurrency(monthlyIncome)}/mes | 🎯 Meta: ${goalText[userProfile.goal] || userProfile.goal} | 💰 Ahorros: ${formatCurrency(userProfile.savings)}`;
    
    updateChart();
    renderTransactions();
}

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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#999';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No hay datos de gastos', canvas.width / 2, canvas.height / 2);
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
                legend: { position: 'bottom', labels: { font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
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
                <strong>${escapeHtml(t.description)}</strong><br>
                <small>${t.category} • ${t.date}</small>
            </div>
            <div class="transaction-amount ${t.type === 'ingreso' ? 'income' : 'expense'}">
                ${t.type === 'ingreso' ? '+' : '-'} ${formatCurrency(t.amount)}
            </div>
            <button class="delete-btn" onclick="deleteTransaction('${t._id}')">🗑️</button>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleDebtFields(show) {
    document.getElementById('debtFields').style.display = show ? 'block' : 'none';
}

async function initializeApp() {
    await loadProfile();
    
    if (userProfile.monthlyIncome > 0) {
        document.getElementById('profileModal').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        await loadData();
    } else {
        document.getElementById('profileModal').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
    }
    
    document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];
}

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    
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
            projectionMonths: parseInt(document.getElementById('profileProjection').value)
        };
        
        await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userProfile)
        });
        
        document.getElementById('profileModal').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        await loadData();
    });
    
    document.getElementById('editProfileBtn').addEventListener('click', () => {
        document.getElementById('profileIncome').value = userProfile.monthlyIncome;
        document.querySelector(`input[name="incomeFrequency"][value="${userProfile.incomeFrequency}"]`).checked = true;
        document.getElementById('profileRent').value = userProfile.rent;
        document.getElementById('profileServices').value = userProfile.services;
        document.getElementById('profileGroceries').value = userProfile.groceries;
        document.getElementById('profileTransport').value = userProfile.transport;
        document.querySelector(`input[name="hasDebt"][value="${userProfile.hasDebt ? 'si' : 'no'}"]`).checked = true;
        document.getElementById('profileDebtAmount').value = userProfile.debtAmount;
        document.getElementById('profileDebtInterest').value = userProfile.debtInterest;
        document.getElementById('profileSavings').value = userProfile.savings;
        document.getElementById('profileGoal').value = userProfile.goal;
        document.getElementById('profileProjection').value = userProfile.projectionMonths;
        toggleDebtFields(userProfile.hasDebt);
        
        document.getElementById('profileModal').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
    });
    
    document.querySelectorAll('input[name="hasDebt"]').forEach(radio => {
        radio.addEventListener('change', (e) => toggleDebtFields(e.target.value === 'si'));
    });
    
    document.getElementById('transactionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const description = document.getElementById('descriptionInput').value;
        const amount = parseFloat(document.getElementById('amountInput').value);
        const category = document.getElementById('categorySelect').value;
        const type = document.getElementById('typeSelect').value;
        const date = document.getElementById('dateInput').value;
        
        if (!description || isNaN(amount) || amount <= 0) {
            alert('Completa todos los campos');
            return;
        }
        
        await saveTransaction({ description, amount, category, type, date });
        document.getElementById('transactionForm').reset();
        document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];
        document.getElementById('typeSelect').value = 'ingreso';
    });
    
    document.getElementById('analyzeBtn').addEventListener('click', async () => {
        const btn = document.getElementById('analyzeBtn');
        const container = document.getElementById('aiRecommendations');
        
        btn.textContent = '🤔 Analizando...';
        btn.disabled = true;
        container.innerHTML = '<div class="loading-spinner">🧠 Asesor financiero experto analizando tus datos...</div>';
        
        const analysis = await getAIAnalysis();
        container.innerHTML = `<div class="recommendations-content">${analysis.replace(/\n/g, '<br>')}</div>`;
        
        btn.textContent = '✨ Analizar con IA';
        btn.disabled = false;
    });
    
    document.getElementById('currencySelect').addEventListener('change', (e) => {
        currentCurrency = e.target.value;
        updateUI();
    });
});

window.deleteTransaction = deleteTransaction;