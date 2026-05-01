// ============ VARIABLES GLOBALES ============
let transactions = [];
let expenseChart = null;
let currentCurrency = 'MXN';
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
    const balance = income - totalExpenses;
    return { income, totalExpenses, balance };
}

// ============ API CALLS ============
async function loadData() {
    try {
        const res = await fetch('/api/transactions');
        const data = await res.json();
        transactions = data.transactions || [];
        
        // Actualizar categorías en el select
        const categorySelect = document.getElementById('categorySelect');
        if (categorySelect && data.categories) {
            categorySelect.innerHTML = data.categories.map(c => `<option value="${c}">${c}</option>`).join('');
        }
        
        updateUI();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function loadProfile() {
    try {
        const res = await fetch('/api/profile');
        const data = await res.json();
        if (data.profile) {
            userProfile = data.profile;
            updateProfileSummary();
        }
    } catch (error) {
        console.error('Error loading profile:', error);
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
        const res = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaction)
        });
        const data = await res.json();
        if (data.success) await loadData();
    } catch (error) {
        console.error('Error saving transaction:', error);
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

async function classifyWithAI(description, amount) {
    try {
        const res = await fetch('/api/ai/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description, amount })
        });
        const data = await res.json();
        return data.category;
    } catch (error) {
        console.error('AI classification error:', error);
        return 'Otros';
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
                totalIncome: income,
                totalExpenses: totalExpenses,
                balance: balance,
                currency: getCurrencySymbol(),
                userProfile: userProfile
            })
        });
        const data = await res.json();
        return data.recommendations;
    } catch (error) {
        console.error('AI analysis error:', error);
        return '⚠️ Error al conectar con IA. Intenta de nuevo.';
    }
}

// ============ UI ACTUALIZACIONES ============
function updateUI() {
    const { income, totalExpenses, balance } = calculateTotals();
    
    document.getElementById('totalIncome').textContent = formatCurrency(income);
    document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('balance').textContent = formatCurrency(balance);
    
    updateChart();
    renderTransactions();
    updateProfileSummary();
}

function updateChart() {
    const expensesByCategory = {};
    transactions.filter(t => t.type === 'gasto').forEach(t => {
        expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
    });
    
    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (expenseChart) expenseChart.destroy();
    
    if (Object.keys(expensesByCategory).length > 0) {
        expenseChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(expensesByCategory),
                datasets: [{ data: Object.values(expensesByCategory), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#66BB6A'] }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
}

function renderTransactions() {
    const container = document.getElementById('transactionsList');
    if (transactions.length === 0) {
        container.innerHTML = '<p class="empty-message">No hay transacciones</p>';
        return;
    }
    
    container.innerHTML = transactions.map(t => `
        <div class="transaction-item">
            <div>
                <strong>${t.description}</strong><br>
                <small>${t.category} • ${t.date}</small>
            </div>
            <div class="transaction-amount ${t.type === 'ingreso' ? 'income' : 'expense'}">
                ${t.type === 'ingreso' ? '+' : '-'} ${formatCurrency(t.amount)}
            </div>
            <button class="delete-btn" onclick="deleteTransaction('${t._id}')">🗑️</button>
        </div>
    `).join('');
}

function updateProfileSummary() {
    const monthly = calculateMonthlyIncome();
    const summary = `💰 Ingreso: $${monthly.toLocaleString()}/mes | 🎯 Meta: ${userProfile.goal} | 💰 Ahorros: $${userProfile.savings.toLocaleString()}`;
    const span = document.getElementById('profileSummaryText');
    if (span) span.textContent = summary;
}

// ============ MODAL Y PERFIL ============
function toggleDebtFields(show) {
    const debtFields = document.getElementById('debtFields');
    if (debtFields) debtFields.style.display = show ? 'block' : 'none';
}

async function initializeApp() {
    const modal = document.getElementById('profileModal');
    const appContainer = document.getElementById('appContainer');
    
    // Cargar perfil existente
    await loadProfile();
    
    // Si ya tiene perfil, mostrar app
    if (userProfile && userProfile.monthlyIncome > 0) {
        modal.style.display = 'none';
        appContainer.style.display = 'block';
        await loadData();
    } else {
        modal.style.display = 'flex';
        appContainer.style.display = 'none';
    }
    
    // Evento del formulario de perfil
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
        
        await saveProfile(userProfile);
        modal.style.display = 'none';
        appContainer.style.display = 'block';
        await loadData();
    });
    
    // Botón editar perfil
    document.getElementById('editProfileBtn').addEventListener('click', () => {
        // Rellenar modal con datos actuales
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
        
        modal.style.display = 'flex';
        appContainer.style.display = 'none';
    });
    
    // Mostrar/ocultar campos de deuda
    document.querySelectorAll('input[name="hasDebt"]').forEach(radio => {
        radio.addEventListener('change', (e) => toggleDebtFields(e.target.value === 'si'));
    });
}

// ============ EVENTOS ============
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    
    // Fecha por defecto
    document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];
    
    // Formulario de transacción
    document.getElementById('transactionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const description = document.getElementById('descriptionInput').value;
        const amount = parseFloat(document.getElementById('amountInput').value);
        let category = document.getElementById('categorySelect').value;
        const type = document.getElementById('typeSelect').value;
        const date = document.getElementById('dateInput').value;
        
        if (!description || isNaN(amount) || amount <= 0) {
            alert('Completa todos los campos');
            return;
        }
        
        // Clasificación automática para gastos
        if (type === 'gasto') {
            const btn = e.submitter;
            const originalText = btn.textContent;
            btn.textContent = '🤖 Clasificando...';
            btn.disabled = true;
            category = await classifyWithAI(description, amount);
            btn.textContent = originalText;
            btn.disabled = false;
        }
        
        await saveTransaction({ description, amount, category, type, date });
        
        document.getElementById('transactionForm').reset();
        document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];
    });
    
    // Botón de análisis
    document.getElementById('analyzeBtn').addEventListener('click', async () => {
        const btn = document.getElementById('analyzeBtn');
        const container = document.getElementById('aiRecommendations');
        
        btn.textContent = '🤔 Analizando...';
        btn.disabled = true;
        container.innerHTML = '<div class="loading-spinner">🧠 Analizando tus datos financieros...</div>';
        
        const analysis = await getAIAnalysis();
        container.innerHTML = `<div class="recommendations-content">${analysis.replace(/\n/g, '<br>')}</div>`;
        
        btn.textContent = '✨ Analizar con IA';
        btn.disabled = false;
    });
    
    // Cambio de moneda
    document.getElementById('currencySelect').addEventListener('change', (e) => {
        currentCurrency = e.target.value;
        updateUI();
    });
    
    // Sugerencia de IA en gastos
    document.getElementById('typeSelect').addEventListener('change', (e) => {
        const categoryGroup = document.querySelector('.form-group:has(#categorySelect)');
        if (e.target.value === 'gasto') {
            categoryGroup.style.opacity = '0.6';
            categoryGroup.title = 'La IA clasificará automáticamente';
        } else {
            categoryGroup.style.opacity = '1';
            categoryGroup.title = '';
        }
    });
});

// Exponer deleteTransaction globalmente
window.deleteTransaction = deleteTransaction;