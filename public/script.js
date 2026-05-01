let transactions = [];
let categories = [];
let expenseChart = null;
let currentCurrency = 'USD';

// DOM Elements
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpensesEl = document.getElementById('totalExpenses');
const balanceEl = document.getElementById('balance');
const transactionsListEl = document.getElementById('transactionsList');
const transactionForm = document.getElementById('transactionForm');
const analyzeBtn = document.getElementById('analyzeBtn');
const currencySelect = document.getElementById('currencySelect');
const categorySelect = document.getElementById('categorySelect');
const typeSelect = document.getElementById('typeSelect');

// Load data from server
async function loadData() {
    try {
        const response = await fetch('/api/transactions');
        const data = await response.json();
        transactions = data.transactions;
        categories = data.categories;
        
        // Update category select options
        if (categories.length > 0 && categorySelect) {
            categorySelect.innerHTML = categories.map(cat => 
                `<option value="${cat}">${cat}</option>`
            ).join('');
        }
        
        updateUI();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Save transaction
async function saveTransaction(transaction) {
    try {
        const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaction)
        });
        const data = await response.json();
        if (data.success) {
            await loadData();
        }
        return data;
    } catch (error) {
        console.error('Error saving transaction:', error);
    }
}

// Delete transaction
async function deleteTransaction(id) {
    try {
        const response = await fetch(`/api/transactions/${id}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) {
            await loadData();
        }
    } catch (error) {
        console.error('Error deleting transaction:', error);
    }
}

// AI Classification
async function classifyWithAI(description, amount) {
    try {
        const response = await fetch('/api/ai/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description, amount })
        });
        const data = await response.json();
        return data.category;
    } catch (error) {
        console.error('AI Classification error:', error);
        return 'Otros';
    }
}

// AI Analysis
async function getAIAnalysis() {
    const income = calculateTotalByType('ingreso');
    const expenses = calculateTotalByType('gasto');
    const balance = income - expenses;
    
    const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            transactions,
            totalIncome: income,
            totalExpenses: expenses,
            balance
        })
    });
    const data = await response.json();
    return data.recommendations;
}

// Calculate totals by type
function calculateTotalByType(type) {
    return transactions
        .filter(t => t.type === type)
        .reduce((sum, t) => sum + t.amount, 0);
}

// Format currency
function formatCurrency(amount) {
    const symbols = {
        USD: '$',
        EUR: '€',
        MXN: 'MX$',
        COP: 'COL$',
        ARS: 'ARS$',
        GBP: '£'
    };
    const symbol = symbols[currentCurrency] || '$';
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Update summary cards
function updateSummary() {
    const totalIncome = calculateTotalByType('ingreso');
    const totalExpenses = calculateTotalByType('gasto');
    const balance = totalIncome - totalExpenses;
    
    totalIncomeEl.textContent = formatCurrency(totalIncome);
    totalExpensesEl.textContent = formatCurrency(totalExpenses);
    balanceEl.textContent = formatCurrency(balance);
    
    // Update trend indicator
    const balanceTrend = document.getElementById('balanceTrend');
    if (balance > 0) {
        balanceTrend.innerHTML = '✅ Saludable';
        balanceTrend.style.color = '#10b981';
    } else if (balance < 0) {
        balanceTrend.innerHTML = '⚠️ En negativo';
        balanceTrend.style.color = '#ef4444';
    } else {
        balanceTrend.innerHTML = '📊 Equilibrado';
        balanceTrend.style.color = '#667eea';
    }
}

// Update chart
function updateChart() {
    const expensesByCategory = {};
    transactions.forEach(t => {
        if (t.type === 'gasto') {
            expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
        }
    });
    
    const categories_labels = Object.keys(expensesByCategory);
    const expenses_data = Object.values(expensesByCategory);
    
    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    if (expenseChart) {
        expenseChart.destroy();
    }
    
    if (categories_labels.length > 0) {
        expenseChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: categories_labels,
                datasets: [{
                    data: expenses_data,
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
                        '#9966FF', '#FF9F40', '#66BB6A'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: 'Distribución de Gastos por Categoría'
                    }
                }
            }
        });
    } else {
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = '#999';
        ctx.font = '16px Arial';
        ctx.fillText('No hay datos de gastos', ctx.canvas.width/2 - 100, ctx.canvas.height/2);
    }
}

// Render transactions list
function renderTransactions() {
    if (transactions.length === 0) {
        transactionsListEl.innerHTML = '<p class="empty-message">No hay transacciones registradas</p>';
        return;
    }
    
    transactionsListEl.innerHTML = transactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(t => `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-description">${escapeHtml(t.description)}</div>
                    <div class="transaction-category">${t.category} • ${t.type === 'ingreso' ? 'Ingreso' : 'Gasto'}</div>
                    <div class="transaction-date">${t.date}</div>
                </div>
                <div class="transaction-amount ${t.type === 'ingreso' ? 'income' : 'expense'}">
                    ${formatCurrency(t.amount)}
                </div>
                <button class="delete-btn" onclick="deleteTransaction(${t.id})">🗑️</button>
            </div>
        `).join('');
}

// Update all UI components
function updateUI() {
    updateSummary();
    updateChart();
    renderTransactions();
}

// Handle form submission with AI classification
transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const description = document.getElementById('descriptionInput').value;
    const amount = parseFloat(document.getElementById('amountInput').value);
    let category = document.getElementById('categorySelect').value;
    const type = document.getElementById('typeSelect').value;
    let date = document.getElementById('dateInput').value;
    
    if (!date) {
        date = new Date().toISOString().split('T')[0];
    }
    
    // Use AI to classify expenses automatically
    if (type === 'gasto') {
        const btn = e.submitter;
        const originalText = btn.textContent;
        btn.textContent = '🤖 Clasificando con IA...';
        btn.disabled = true;
        
        category = await classifyWithAI(description, amount);
        document.getElementById('categorySelect').value = category;
        
        btn.textContent = originalText;
        btn.disabled = false;
    }
    
    const transaction = { description, amount, category, type, date };
    await saveTransaction(transaction);
    
    transactionForm.reset();
    document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];
});

// Generate AI recommendations
analyzeBtn.addEventListener('click', async () => {
    if (transactions.length === 0) {
        const recommendationsDiv = document.getElementById('aiRecommendations');
        recommendationsDiv.innerHTML = '<p class="placeholder">📊 Registra al menos una transacción para recibir recomendaciones personalizadas</p>';
        return;
    }
    
    analyzeBtn.textContent = '🤔 Analizando...';
    analyzeBtn.disabled = true;
    
    const recommendations = await getAIAnalysis();
    
    const recommendationsDiv = document.getElementById('aiRecommendations');
    recommendationsDiv.innerHTML = `
        <div class="recommendations-content">
            ${recommendations.replace(/\n/g, '<br>').replace(/\d+\./g, '<br>$&')}
        </div>
    `;
    
    analyzeBtn.textContent = '✨ Generar Recomendaciones';
    analyzeBtn.disabled = false;
});

// Currency change handler
currencySelect.addEventListener('change', (e) => {
    currentCurrency = e.target.value;
    updateUI();
});

// Type change handler for dynamic category AI hint
typeSelect.addEventListener('change', (e) => {
    const categoryGroup = document.querySelector('.form-group:has(#categorySelect)');
    if (e.target.value === 'gasto') {
        categoryGroup.style.opacity = '0.7';
        categoryGroup.title = 'La IA clasificará automáticamente este gasto';
    } else {
        categoryGroup.style.opacity = '1';
        categoryGroup.title = '';
    }
});

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Set default date to today
document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];

// Initial load
loadData();