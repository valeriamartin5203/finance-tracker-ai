// ============ PERFIL DE USUARIO ============
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
const transactionCountEl = document.getElementById('transactionCount');

// ============ FUNCIONES AUXILIARES ============

function getCurrencySymbol(currency) {
    const symbols = {
        USD: '$',
        EUR: '€',
        MXN: '$',
        COP: '$',
        ARS: '$',
        GBP: '£'
    };
    return symbols[currency] || '$';
}

function formatCurrency(amount) {
    const symbol = getCurrencySymbol(currentCurrency);
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getCategoryEmoji(category) {
    const emojis = {
        'Comida': '🍔',
        'Transporte': '🚗',
        'Entretenimiento': '🎬',
        'Servicios': '💡',
        'Salud': '🏥',
        'Educación': '📚',
        'Otros': '📦'
    };
    return emojis[category] || '📊';
}

// ============ FUNCIONES DE PERFIL ============

function calculateMonthlyIncomeFromProfile() {
    let monthly = userProfile.monthlyIncome;
    switch(userProfile.incomeFrequency) {
        case 'semanal':
            return monthly * 4.33;
        case 'quincenal':
            return monthly * 2;
        case 'mensual':
        default:
            return monthly;
    }
}

function calculateFixedExpenses() {
    return userProfile.rent + userProfile.services + userProfile.groceries + userProfile.transport;
}

function getIncomeFrequencyText() {
    const texts = {
        'semanal': `semanal ($${userProfile.monthlyIncome.toLocaleString()})`,
        'quincenal': `quincenal ($${userProfile.monthlyIncome.toLocaleString()})`,
        'mensual': `mensual ($${userProfile.monthlyIncome.toLocaleString()})`
    };
    return texts[userProfile.incomeFrequency] || 'mensual';
}

function getGoalText() {
    const goals = {
        'ahorro': 'Ahorrar para emergencias',
        'casa': 'Comprar casa/departamento',
        'auto': 'Comprar auto',
        'viaje': 'Hacer un viaje',
        'invertir': 'Invertir',
        'libertad': 'Libertad financiera',
        'deudas': 'Pagar deudas'
    };
    return goals[userProfile.goal] || userProfile.goal;
}

function updateProfileSummary() {
    const monthlyIncomeCalc = calculateMonthlyIncomeFromProfile();
    const summaryText = `💰 Ingreso ${getIncomeFrequencyText()} → $${monthlyIncomeCalc.toLocaleString()}/mes | 🎯 Meta: ${getGoalText()} | 💰 Ahorros: $${userProfile.savings.toLocaleString()}`;
    const summarySpan = document.getElementById('profileSummaryText');
    if (summarySpan) summarySpan.textContent = summaryText;
}

function saveProfileToLocalStorage() {
    localStorage.setItem('userProfile', JSON.stringify(userProfile));
}

function loadProfileFromLocalStorage() {
    const saved = localStorage.getItem('userProfile');
    if (saved) {
        userProfile = JSON.parse(saved);
        return true;
    }
    return false;
}

function showProfileModal() {
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
    
    const modal = document.getElementById('profileModal');
    modal.style.display = 'flex';
}

function toggleDebtFields(show) {
    const debtFields = document.getElementById('debtFields');
    if (debtFields) {
        debtFields.style.display = show ? 'block' : 'none';
    }
}

// ============ FUNCIONES DE CÁLCULO ============

function calculateTotalByType(type) {
    let total = transactions
        .filter(t => t.type === type)
        .reduce((sum, t) => sum + t.amount, 0);
    
    if (type === 'gasto') {
        total += userProfile.rent + userProfile.services + userProfile.groceries + userProfile.transport;
    }
    
    return total;
}

function calculateTotals() {
    const income = calculateMonthlyIncomeFromProfile();
    const expenses = calculateTotalByType('gasto');
    const balance = income - expenses;
    const savingsRate = income > 0 ? ((balance / income) * 100).toFixed(1) : 0;
    return { income, expenses, balance, savingsRate };
}

function generateFullFinancialProfile() {
    const monthlyIncome = calculateMonthlyIncomeFromProfile();
    const fixedExpenses = calculateFixedExpenses();
    const variableExpenses = transactions
        .filter(t => t.type === 'gasto')
        .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = fixedExpenses + variableExpenses;
    const balance = monthlyIncome - totalExpenses;
    const savingsRate = monthlyIncome > 0 ? ((balance / monthlyIncome) * 100).toFixed(1) : 0;
    const emergencyFundMonths = totalExpenses > 0 ? (userProfile.savings / totalExpenses).toFixed(1) : 0;
    
    return {
        monthlyIncome,
        fixedExpenses,
        variableExpenses,
        totalExpenses,
        balance,
        savingsRate,
        emergencyFundMonths,
        hasDebt: userProfile.hasDebt,
        debtAmount: userProfile.debtAmount,
        goal: userProfile.goal,
        projectionMonths: userProfile.projectionMonths,
        savings: userProfile.savings
    };
}

// ============ ACTUALIZAR UI ============

function updateSummary() {
    const { income, expenses, balance, savingsRate } = calculateTotals();
    
    totalIncomeEl.textContent = formatCurrency(income);
    totalExpensesEl.textContent = formatCurrency(expenses);
    balanceEl.textContent = formatCurrency(balance);
    
    const balanceTrend = document.getElementById('balanceTrend');
    
    if (balance > 0) {
        balanceTrend.innerHTML = `✅ Ahorro: ${savingsRate}%`;
        balanceTrend.style.color = '#10b981';
    } else if (balance < 0) {
        balanceTrend.innerHTML = '⚠️ En negativo';
        balanceTrend.style.color = '#ef4444';
    } else {
        balanceTrend.innerHTML = '📊 Equilibrado';
        balanceTrend.style.color = '#667eea';
    }
}

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
                    },
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
    } else {
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = '#999';
        ctx.font = '16px Arial';
        ctx.fillText('No hay datos de gastos', ctx.canvas.width / 2 - 100, ctx.canvas.height / 2);
    }
}

function renderTransactions() {
    if (transactions.length === 0) {
        transactionsListEl.innerHTML = '<p class="empty-message">📭 No hay transacciones registradas</p>';
        transactionCountEl.textContent = '0 transacciones';
        return;
    }
    
    transactionCountEl.textContent = `${transactions.length} transacciones`;
    
    transactionsListEl.innerHTML = transactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(t => `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-description">${escapeHtml(t.description)}</div>
                    <div class="transaction-category">${getCategoryEmoji(t.category)} ${t.category} • ${t.type === 'ingreso' ? 'Ingreso' : 'Gasto'}</div>
                    <div class="transaction-date">📅 ${t.date}</div>
                </div>
                <div class="transaction-amount ${t.type === 'ingreso' ? 'income' : 'expense'}">
                    ${formatCurrency(t.amount)}
                </div>
                <button class="delete-btn" onclick="deleteTransaction(${t.id})">🗑️</button>
            </div>
        `).join('');
}

function updateUI() {
    updateSummary();
    updateChart();
    renderTransactions();
    updateProfileSummary();
}

// ============ API CALLS ============

async function loadData() {
    try {
        const response = await fetch('/api/transactions');
        const data = await response.json();
        transactions = data.transactions;
        categories = data.categories;
        
        if (categories.length > 0 && categorySelect) {
            categorySelect.innerHTML = categories.map(cat => 
                `<option value="${cat}">${getCategoryEmoji(cat)} ${cat}</option>`
            ).join('');
        }
        
        updateUI();
    } catch (error) {
        console.error('Error loading data:', error);
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
        if (data.success) {
            await loadData();
        }
        return data;
    } catch (error) {
        console.error('Error saving transaction:', error);
    }
}

async function deleteTransaction(id) {
    if (!confirm('¿Eliminar esta transacción?')) return;
    
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

async function getAIAnalysis() {
    const { income, expenses, balance } = calculateTotals();
    const profile = generateFullFinancialProfile();
    
    const recommendationsDiv = document.getElementById('aiRecommendations');
    recommendationsDiv.innerHTML = '<div class="loading-spinner">🤖 Analizando tus datos financieros con IA Experta...<br><small>Asesor con 10+ años de experiencia simulada</small></div>';
    
    try {
        const response = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactions: transactions.map(t => ({
                    description: t.description,
                    amount: t.amount,
                    category: t.category,
                    type: t.type,
                    date: t.date
                })),
                totalIncome: income,
                totalExpenses: expenses,
                balance: balance,
                currency: getCurrencySymbol(currentCurrency),
                userProfile: {
                    monthlyIncome: userProfile.monthlyIncome,
                    incomeFrequency: userProfile.incomeFrequency,
                    rent: userProfile.rent,
                    services: userProfile.services,
                    groceries: userProfile.groceries,
                    transport: userProfile.transport,
                    hasDebt: userProfile.hasDebt,
                    debtAmount: userProfile.debtAmount,
                    debtInterest: userProfile.debtInterest,
                    savings: userProfile.savings,
                    goal: userProfile.goal,
                    projectionMonths: userProfile.projectionMonths,
                    fixedExpenses: calculateFixedExpenses(),
                    emergencyFundMonths: profile.emergencyFundMonths
                }
            })
        });
        const data = await response.json();
        return data.recommendations;
    } catch (error) {
        console.error('Error getting AI analysis:', error);
        return generateLocalAnalysis();
    }
}

function generateLocalAnalysis() {
    const profile = generateFullFinancialProfile();
    const currencySymbol = getCurrencySymbol(currentCurrency);
    
    let analysis = `🎯 **DIAGNÓSTICO EJECUTIVO**\n\n`;
    
    if (profile.balance < 0) {
        analysis += `🔴 CRÍTICO: Tus gastos mensuales totales (${currencySymbol}${profile.totalExpenses.toLocaleString()}) superan tus ingresos (${currencySymbol}${profile.monthlyIncome.toLocaleString()}) en ${currencySymbol}${Math.abs(profile.balance).toLocaleString()}. NECESITAS ACCIÓN INMEDIATA.\n\n`;
    } else if (profile.savingsRate < 10) {
        analysis += `⚠️ Tu tasa de ahorro es del ${profile.savingsRate}%. Aunque no estás en números rojos, estás LEJOS del ideal (20%).\n\n`;
    } else {
        analysis += `✅ Ahorras el ${profile.savingsRate}% de tus ingresos. ¡Bien! Pero puedes llegar al 20%.\n\n`;
    }
    
    analysis += `📊 **RADIOGRAFÍA FINANCIERA COMPLETA**\n\n`;
    analysis += `| Indicador | Tu valor | Benchmark | Estatus |\n`;
    analysis += `|-----------|----------|-----------|---------|\n`;
    analysis += `| Ingreso mensual | ${currencySymbol}${profile.monthlyIncome.toLocaleString()} | - | - |\n`;
    analysis += `| Gastos fijos | ${((profile.fixedExpenses / profile.monthlyIncome) * 100).toFixed(1)}% | <50% | ${profile.fixedExpenses / profile.monthlyIncome > 0.5 ? '🔴 Excesivo' : '✅ Controlado'} |\n`;
    analysis += `| Tasa de ahorro | ${profile.savingsRate}% | 20% | ${profile.savingsRate >= 20 ? '✅ Excelente' : profile.savingsRate >= 10 ? '⚠️ Mejorable' : '🔴 Crítico'} |\n`;
    analysis += `| Fondo emergencia | ${profile.emergencyFundMonths} meses | 3-6 meses | ${profile.emergencyFundMonths >= 3 ? '✅ Adecuado' : '🔴 Insuficiente'} |\n`;
    
    analysis += `\n🔍 **TOP 3 OPORTUNIDADES DE MEJORA**\n\n`;
    
    if (userProfile.rent > profile.monthlyIncome * 0.3) {
        analysis += `1. 🏠 Tu renta/hipoteca (${currencySymbol}${userProfile.rent.toLocaleString()}) es el ${((userProfile.rent / profile.monthlyIncome) * 100).toFixed(1)}% de tu ingreso. Ideal: max 30%. Considera renegociar o compartir gastos.\n`;
    }
    
    if (userProfile.services > profile.monthlyIncome * 0.1) {
        analysis += `2. 💡 Tus servicios (${currencySymbol}${userProfile.services.toLocaleString()}) superan el 10% recomendado. Revisa suscripciones y cancela las que no uses.\n`;
    }
    
    if (userProfile.groceries > profile.monthlyIncome * 0.15) {
        analysis += `3. 🛒 Tu gasto en supermercado (${currencySymbol}${userProfile.groceries.toLocaleString()}) supera el 15% ideal. Planifica tus comidas y reduce desperdicio.\n`;
    }
    
    if (userProfile.transport > profile.monthlyIncome * 0.1) {
        analysis += `3. 🚗 Tu gasto en transporte (${currencySymbol}${userProfile.transport.toLocaleString()}) supera el 10% ideal. Considera transporte público o compartir viajes.\n`;
    }
    
    if (analysis.indexOf('1.') === -1) {
        analysis += `1. Registra TODOS tus gastos durante 30 días para identificar patrones\n`;
        analysis += `2. Reduce gastos hormiga (cafés, antojos, suscripciones)\n`;
        analysis += `3. Automatiza el ahorro el día que recibes ingreso\n`;
    }
    
    analysis += `\n💼 **ESTRATEGIA PERSONALIZADA PARA ${userProfile.projectionMonths} MESES**\n\n`;
    analysis += `🎯 META: ${getGoalText()}\n\n`;
    
    analysis += `SEMANA 1:\n`;
    analysis += `• Abre una cuenta separada para ahorro (sin tarjeta de débito)\n`;
    analysis += `• Configura transferencia automática del ${Math.min(20, parseInt(profile.savingsRate) + 10)}% de tu ingreso\n\n`;
    
    analysis += `SEMANA 2:\n`;
    analysis += `• Revisa tus gastos fijos y negocia los que puedas (internet, teléfono, seguro)\n`;
    analysis += `• Cancela 2 suscripciones que no uses esta semana\n\n`;
    
    analysis += `SEMANA 3-4:\n`;
    analysis += `• Reduce 15% tu categoría de mayor gasto variable\n`;
    analysis += `• Cocina en casa 3 veces más por semana\n\n`;
    
    if (userProfile.projectionMonths > 1) {
        analysis += `MESES 2-${userProfile.projectionMonths}:\n`;
        analysis += `• Aumenta tu ahorro automático al 20-25%\n`;
        analysis += `• Invierte el excedente en CETES o fondo de emergencia\n`;
        analysis += `• Revisa tu progreso cada 15 días y ajusta\n\n`;
    }
    
    analysis += `💰 **PROYECCIÓN DE AHORRO**\n\n`;
    const monthlySavingsTarget = profile.monthlyIncome * 0.2;
    const projectedTotal = userProfile.savings + (monthlySavingsTarget * userProfile.projectionMonths);
    analysis += `• Ahorro actual: ${currencySymbol}${userProfile.savings.toLocaleString()}\n`;
    analysis += `• Meta mensual: ${currencySymbol}${monthlySavingsTarget.toLocaleString()}\n`;
    analysis += `• Proyección en ${userProfile.projectionMonths} meses: ${currencySymbol}${projectedTotal.toLocaleString()}\n`;
    
    if (userProfile.hasDebt && userProfile.debtAmount > 0) {
        analysis += `\n💳 **ESTRATEGIA DE DEUDAS**\n\n`;
        analysis += `• Destina el 30% de tu balance mensual a pagar deudas\n`;
        const payoffMonths = Math.ceil(userProfile.debtAmount / (profile.balance * 0.3));
        if (payoffMonths > 0 && payoffMonths < 60) {
            analysis += `• Tiempo estimado libre de deudas: ${payoffMonths} meses\n`;
        }
        analysis += `• Método recomendado: Paga primero la deuda con mayor interés\n`;
    }
    
    if (profile.emergencyFundMonths < 3) {
        analysis += `\n🚨 **PRIORIDAD #1: FONDO DE EMERGENCIA**\n\n`;
        analysis += `• Necesitas ${currencySymbol}${(profile.totalExpenses * 3).toLocaleString()} para 3 meses de gastos\n`;
        analysis += `• Congela tus gastos no esenciales hasta tener este fondo\n`;
    }
    
    analysis += `\n🎓 **CONSEJO DE EXPERTO**\n\n`;
    analysis += `"El dinero que no gastas hoy y lo inviertes, se multiplica solo. Cada peso que ahorras es un empleado que trabaja 24/7 para ti. Empieza HOY."\n`;
    
    analysis += `\n💪 **COMPROMISO SEMANAL**\n\n`;
    analysis += `"Esta semana revisaré mi estado de cuenta, identificaré 3 gastos que puedo eliminar y ahorraré el ${Math.min(20, parseInt(profile.savingsRate) + 5)}% de mi próximo ingreso."\n`;
    
    return analysis;
}

// ============ EVENT HANDLERS ============

function initializeApp() {
    const modal = document.getElementById('profileModal');
    const appContainer = document.getElementById('appContainer');
    
    // Escuchar cambios en deuda
    const debtRadios = document.querySelectorAll('input[name="hasDebt"]');
    debtRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            toggleDebtFields(e.target.value === 'si');
        });
    });
    
    // Manejar envío del formulario de perfil
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', (e) => {
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
                projectionMonths: parseInt(document.getElementById('profileProjection').value) || 12
            };
            
            saveProfileToLocalStorage();
            updateProfileSummary();
            
            modal.style.display = 'none';
            appContainer.style.display = 'block';
            
            loadData();
        });
    }
    
    // Botón para editar perfil
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            showProfileModal();
        });
    }
    
    // Verificar si ya existe perfil guardado
    if (loadProfileFromLocalStorage() && userProfile.monthlyIncome > 0) {
        modal.style.display = 'none';
        appContainer.style.display = 'block';
        updateProfileSummary();
        loadData();
    } else {
        modal.style.display = 'flex';
        appContainer.style.display = 'none';
    }
}

// ============ FUNCIONES PARA PERFIL EN MONGODB ============

async function loadProfileFromServer() {
    try {
        const response = await fetch('/api/profile');
        const data = await response.json();
        if (data.profile) {
            userProfile = {
                monthlyIncome: data.profile.monthlyIncome || 0,
                incomeFrequency: data.profile.incomeFrequency || 'mensual',
                rent: data.profile.rent || 0,
                services: data.profile.services || 0,
                groceries: data.profile.groceries || 0,
                transport: data.profile.transport || 0,
                hasDebt: data.profile.hasDebt || false,
                debtAmount: data.profile.debtAmount || 0,
                debtInterest: data.profile.debtInterest || 0,
                savings: data.profile.savings || 0,
                goal: data.profile.goal || 'ahorro',
                projectionMonths: data.profile.projectionMonths || 12
            };
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error loading profile from server:', error);
        return false;
    }
}

async function saveProfileToServer(profile) {
    try {
        const response = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Error saving profile to server:', error);
        return false;
    }
}

// Modificar initializeProfile para usar server
async function initializeProfile() {
    const modal = document.getElementById('profileModal');
    const appContainer = document.getElementById('appContainer');
    
    // Escuchar cambios en deuda
    const debtRadios = document.querySelectorAll('input[name="hasDebt"]');
    debtRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            toggleDebtFields(e.target.value === 'si');
        });
    });
    
    // Manejar envío del formulario de perfil
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newProfile = {
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
                projectionMonths: parseInt(document.getElementById('profileProjection').value) || 12
            };
            
            userProfile = newProfile;
            await saveProfileToServer(userProfile);
            updateProfileSummary();
            
            modal.style.display = 'none';
            appContainer.style.display = 'block';
            
            loadData();
        });
    }
    
    // Botón para editar perfil
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            showProfileModal();
        });
    }
    
    // Intentar cargar perfil del servidor primero
    const hasProfile = await loadProfileFromServer();
    
    if (hasProfile && userProfile.monthlyIncome > 0) {
        modal.style.display = 'none';
        appContainer.style.display = 'block';
        updateProfileSummary();
        loadData();
    } else {
        // Si no hay perfil en servidor, intentar localStorage como respaldo
        if (loadProfileFromLocalStorage() && userProfile.monthlyIncome > 0) {
            await saveProfileToServer(userProfile);
            modal.style.display = 'none';
            appContainer.style.display = 'block';
            updateProfileSummary();
            loadData();
        } else {
            modal.style.display = 'flex';
            appContainer.style.display = 'none';
        }
    }
}

// Configurar eventos después de que el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    
    // Configurar fecha por defecto
    const dateInput = document.getElementById('dateInput');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    // Evento del formulario de transacciones
    if (transactionForm) {
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
            
            if (isNaN(amount) || amount <= 0) {
                alert('Por favor, ingresa un monto válido');
                return;
            }
            
            if (type === 'gasto') {
                const btn = e.submitter;
                const originalText = btn.textContent;
                btn.textContent = '🤖 Clasificando con IA...';
                btn.disabled = true;
                
                category = await classifyWithAI(description, amount);
                if (categorySelect) categorySelect.value = category;
                
                btn.textContent = originalText;
                btn.disabled = false;
            }
            
            const transaction = { description, amount, category, type, date };
            await saveTransaction(transaction);
            
            transactionForm.reset();
            if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
            if (typeSelect) typeSelect.value = 'ingreso';
        });
    }
    
    // Evento del botón de análisis
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            const hasTransactions = transactions.length > 0;
            const hasFixedExpenses = calculateFixedExpenses() > 0;
            
            if (!hasTransactions && !hasFixedExpenses) {
                const recommendationsDiv = document.getElementById('aiRecommendations');
                if (recommendationsDiv) {
                    recommendationsDiv.innerHTML = '<p class="placeholder">📊 Registra al menos 3-5 transacciones o completa tu perfil financiero para un diagnóstico preciso</p>';
                }
                return;
            }
            
            analyzeBtn.textContent = '🤔 Analizando con IA Experta...';
            analyzeBtn.disabled = true;
            
            const recommendations = await getAIAnalysis();
            
            const recommendationsDiv = document.getElementById('aiRecommendations');
            if (recommendationsDiv) {
                recommendationsDiv.innerHTML = `
                    <div class="recommendations-content">
                        ${recommendations.replace(/\n/g, '<br>').replace(/\|/g, '|')}
                    </div>
                `;
            }
            
            analyzeBtn.textContent = '✨ Analizar con IA Experta';
            analyzeBtn.disabled = false;
        });
    }
    
    // Evento de cambio de moneda
    if (currencySelect) {
        currencySelect.addEventListener('change', (e) => {
            currentCurrency = e.target.value;
            updateUI();
        });
    }
    
    // Evento de cambio de tipo (para sugerir IA)
    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            const categoryGroup = document.querySelector('.form-group:has(#categorySelect)');
            if (categoryGroup) {
                if (e.target.value === 'gasto') {
                    categoryGroup.style.opacity = '0.7';
                    categoryGroup.title = 'La IA clasificará automáticamente este gasto';
                } else {
                    categoryGroup.style.opacity = '1';
                    categoryGroup.title = '';
                }
            }
        });
    }
    
    // Exponer deleteTransaction globalmente
    window.deleteTransaction = deleteTransaction;
});