let transactions = [];
let expenseChart = null;
let trendChart = null;
let currentCurrency = 'MXN';
let currentUser = null;
let userProfile = null;
let token = null;

// Calendario
let scheduledPayments = [];
let currentDate = new Date();
let currentYear = currentDate.getFullYear();
let currentMonth = currentDate.getMonth();

// Funciones auxiliares
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

// Autenticación
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
        } else { alert(data.error); return false; }
    } catch (error) { alert('Error de conexión'); return false; }
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
        } else { alert(data.error); return false; }
    } catch (error) { alert('Error de conexión'); return false; }
}
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    token = null;
    currentUser = null;
    document.getElementById('authModal').style.display = 'flex';
    document.getElementById('profileModal').style.display = 'none';
    document.getElementById('appContainer').style.display = 'none';
    const floatBtn = document.querySelector('.add-payment-btn');
    if (floatBtn) floatBtn.remove();
}

// Perfil
async function loadProfile() {
    try {
        const res = await fetch('/api/profile', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.profile) { userProfile = data.profile; return true; }
        return false;
    } catch (error) { return false; }
}
async function saveProfile(profile) {
    try {
        const res = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(profile)
        });
        const data = await res.json();
        return data.success;
    } catch (error) { return false; }
}

// Transacciones
async function loadTransactions() {
    try {
        const res = await fetch('/api/transactions', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        transactions = data.transactions || [];
        updateUI();
        updateTrendChart();
    } catch (error) { console.error(error); }
}
async function saveTransaction(transaction) {
    try {
        const res = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(transaction)
        });
        const data = await res.json();
        if (data.success) await loadTransactions();
    } catch (error) { console.error(error); }
}
async function deleteTransaction(id) {
    if (!confirm('¿Eliminar?')) return;
    try {
        await fetch(`/api/transactions/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        await loadTransactions();
    } catch (error) { console.error(error); }
}

// Cálculos
function calculateMonthlyIncome() {
    if (!userProfile) return 0;
    let monthly = userProfile.monthlyIncome || 0;
    if (userProfile.incomeFrequency === 'semanal') return monthly * 4.33;
    if (userProfile.incomeFrequency === 'quincenal') return monthly * 2;
    return monthly;
}
function calculateFixedExpenses() {
    if (!userProfile) return 0;
    return (userProfile.rent||0)+(userProfile.services||0)+(userProfile.groceries||0)+(userProfile.transport||0);
}
function calculateTotals() {
    const income = calculateMonthlyIncome();
    const variable = transactions.filter(t=>t.type==='gasto').reduce((s,t)=>s+t.amount,0);
    const total = calculateFixedExpenses() + variable;
    return { income, totalExpenses: total, balance: income - total };
}

// Gráficas
function updateChart() {
    const canvas = document.getElementById('expenseChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const byCat = {};
    transactions.filter(t=>t.type==='gasto').forEach(t=>{ byCat[t.category]=(byCat[t.category]||0)+t.amount; });
    if (expenseChart) expenseChart.destroy();
    if (Object.keys(byCat).length===0) {
        ctx.fillStyle='#f0f0f0'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#999'; ctx.fillText('No hay datos', canvas.width/2-50, canvas.height/2);
        return;
    }
    expenseChart = new Chart(ctx, {
        type: 'pie',
        data: { labels: Object.keys(byCat), datasets: [{ data: Object.values(byCat), backgroundColor: ['#FF6384','#36A2EB','#FFCE56','#4BC0C0','#9966FF','#FF9F40','#66BB6A'] }] },
        options: { responsive: true, maintainAspectRatio: true }
    });
}
function updateTrendChart() {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    const monthly = {};
    transactions.forEach(t=>{
        const m = t.date.substring(0,7);
        if(!monthly[m]) monthly[m]={ingresos:0,gastos:0};
        if(t.type==='ingreso') monthly[m].ingresos+=t.amount;
        else monthly[m].gastos+=t.amount;
    });
    const months = Object.keys(monthly).sort();
    const ingresos = months.map(m=>monthly[m].ingresos);
    const gastos = months.map(m=>monthly[m].gastos);
    const ctx = canvas.getContext('2d');
    if(trendChart) trendChart.destroy();
    if(months.length===0){
        ctx.fillStyle='#f0f0f0'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#999'; ctx.fillText('No hay datos', canvas.width/2-50, canvas.height/2);
        return;
    }
    trendChart = new Chart(ctx,{
        type:'line',
        data:{ labels:months, datasets:[
            { label:'Ingresos', data:ingresos, borderColor:'#10b981', backgroundColor:'rgba(16,185,129,0.1)', tension:0.4, fill:true },
            { label:'Gastos', data:gastos, borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,0.1)', tension:0.4, fill:true }
        ]},
        options:{ responsive:true, maintainAspectRatio:true }
    });
}
function updateUI() {
    const { income, totalExpenses, balance } = calculateTotals();
    document.getElementById('totalIncome').textContent = formatCurrency(income);
    document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('balance').textContent = formatCurrency(balance);
    const monthlyIncome = calculateMonthlyIncome();
    document.getElementById('profileSummaryText').innerHTML = `💰 Ingreso: ${formatCurrency(monthlyIncome)}/mes | 🎯 Meta: ${userProfile?.goal||'Ahorro'} | 💰 Ahorros: ${formatCurrency(userProfile?.savings||0)}`;
    updateChart();
    renderTransactions();
}
function renderTransactions() {
    const container = document.getElementById('transactionsList');
    if(transactions.length===0){ container.innerHTML='<p class="empty-message">📭 No hay transacciones</p>'; return; }
    container.innerHTML = transactions.map(t=>`
        <div class="transaction-item">
            <div><div class="transaction-description">${escapeHtml(t.description)}</div><div class="transaction-category">${t.category} • ${t.date}</div></div>
            <div class="transaction-amount ${t.type==='ingreso'?'income':'expense'}">${t.type==='ingreso'?'+':'-'} ${formatCurrency(t.amount)}</div>
            <button class="delete-btn" onclick="deleteTransaction('${t._id}')">🗑️</button>
        </div>
    `).join('');
}

// IA
async function getAIAnalysis() {
    const { income, totalExpenses, balance } = calculateTotals();
    const savings = income>0?((balance/income)*100).toFixed(1):0;
    try{
        const res = await fetch('/api/ai/analyze',{
            method:'POST',
            headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
            body:JSON.stringify({ transactions:transactions.filter(t=>t.type==='gasto'), userProfile, currency:getCurrencySymbol(), totalIncome:income, totalExpenses, balance, savingsRate:savings })
        });
        const data = await res.json();
        return data.recommendations;
    }catch(e){ return generarRespuestaLocal(income,totalExpenses,balance,savings); }
}
function generarRespuestaLocal(income,total,balance,savings){
    const target = Math.min(20, parseInt(savings)+10);
    return `📊 **Análisis Financiero**\n\n💰 Ingreso: ${formatCurrency(income)}\n💸 Gastos: ${formatCurrency(total)}\n⚖️ Balance: ${formatCurrency(balance)}\n📈 Ahorro: ${savings}%\n\n1️⃣ Automatiza el ${target}% de tu ingreso.\n2️⃣ Reduce gastos fijos 10%.\n3️⃣ Registra todos los gastos.`;
}
async function sendEmailReport() {
    if(!userProfile?.email){ alert('📧 Primero registra tu correo en "Mi perfil"'); return; }
    const btn = document.getElementById('emailReportBtn');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    try{
        const res = await fetch('/api/send-report',{
            method:'POST',
            headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
            body:JSON.stringify({ transactions, userProfile, currency:getCurrencySymbol() })
        });
        const data = await res.json();
        if(data.success) alert('✅ Reporte enviado a '+userProfile.email);
        else alert('❌ Error: '+data.error);
    }catch(e){ alert('Error de conexión'); }
    btn.innerHTML = original;
    btn.disabled = false;
}
function exportToCSV(){
    if(transactions.length===0){ alert('No hay transacciones'); return; }
    const headers = ['Fecha','Descripción','Categoría','Tipo','Monto'];
    const rows = transactions.map(t=>[t.date,`"${t.description}"`,t.category,t.type,t.amount]);
    const csv = [headers,...rows].map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transacciones_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    alert('✅ Exportado');
}

// Calendario de pagos
async function loadScheduledPayments() {
    try{
        const res = await fetch('/api/scheduled-payments',{ headers:{'Authorization':`Bearer ${token}`} });
        const data = await res.json();
        scheduledPayments = data.payments || [];
        checkUpcomingPayments();
        updatePendingBadge();
        if(document.getElementById('calendarPage').style.display !== 'none'){
            renderCalendar();
            renderPaymentsList();
        }
    }catch(e){ console.error(e); }
}
async function saveScheduledPayment(payment) {
    try{
        const res = await fetch('/api/scheduled-payments',{
            method:'POST',
            headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
            body:JSON.stringify(payment)
        });
        const data = await res.json();
        if(data.success) await loadScheduledPayments();
    }catch(e){ console.error(e); }
}
async function updateScheduledPayment(id, updates) {
    try{
        const res = await fetch(`/api/scheduled-payments/${id}`,{
            method:'PUT',
            headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
            body:JSON.stringify(updates)
        });
        if((await res.json()).success) await loadScheduledPayments();
    }catch(e){ console.error(e); }
}
async function deleteScheduledPayment(id) {
    if(!confirm('¿Eliminar este pago?')) return;
    try{
        await fetch(`/api/scheduled-payments/${id}`,{ method:'DELETE', headers:{'Authorization':`Bearer ${token}`} });
        await loadScheduledPayments();
    }catch(e){ console.error(e); }
}
function checkUpcomingPayments() {
    const today = new Date(); today.setHours(0,0,0,0);
    const threeDays = new Date(today); threeDays.setDate(today.getDate()+3);
    const upcoming = scheduledPayments.filter(p=>{
        if(p.paid) return false;
        const due = new Date(p.dueDate); due.setHours(0,0,0,0);
        return due >= today && due <= threeDays;
    });
    upcoming.forEach(p=>{
        const due = new Date(p.dueDate);
        const days = Math.ceil((due - today)/(1000*60*60*24));
        let msg = '';
        if(days===0) msg = `⚠️ ¡HOY vence ${p.name} por ${formatCurrency(p.amount)}!`;
        else if(days===1) msg = `⏰ MAÑANA vence ${p.name} por ${formatCurrency(p.amount)}`;
        else msg = `📢 En ${days} días vence ${p.name} por ${formatCurrency(p.amount)}`;
        showNotification(msg);
    });
}
function showNotification(msg) {
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.innerHTML = `<i class="fas fa-bell"></i><div style="flex:1">${msg}</div><button class="close-toast" onclick="this.parentElement.remove()">✕</button>`;
    document.body.appendChild(toast);
    setTimeout(()=>toast.remove(),8000);
}
function updatePendingBadge() {
    const today = new Date(); today.setHours(0,0,0,0);
    const pending = scheduledPayments.filter(p=>{
        if(p.paid) return false;
        const due = new Date(p.dueDate); due.setHours(0,0,0,0);
        return due >= today;
    }).length;
    const badge = document.getElementById('pendingBadge');
    if(badge){
        if(pending>0){ badge.textContent=pending; badge.style.display='inline-block'; }
        else badge.style.display='none';
    }
}
function renderCalendar() {
    const container = document.getElementById('calendarGrid');
    if(!container) return;
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startDay = firstDay.getDay();
    const daysInMonth = new Date(currentYear, currentMonth+1, 0).getDate();
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    document.getElementById('currentMonthYear').textContent = `${monthNames[currentMonth]} ${currentYear}`;
    let html = '';
    for(let i=0;i<startDay;i++) html += `<div class="calendar-day"></div>`;
    const today = new Date(); today.setHours(0,0,0,0);
    for(let d=1;d<=daysInMonth;d++){
        const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isToday = today.toDateString() === new Date(currentYear,currentMonth,d).toDateString();
        const dayPayments = scheduledPayments.filter(p=>p.dueDate===dateStr);
        html += `<div class="calendar-day ${isToday?'today':''}" data-date="${dateStr}">
            <div class="calendar-day-number">${d}</div>
            <div class="calendar-day-payments">`;
        dayPayments.forEach(p=>{
            html += `<div class="calendar-payment ${p.paid?'paid':''}" style="background:${p.color||'#ef4444'}" onclick="event.stopPropagation(); showPaymentDetails('${p._id}')">
                ${p.name}: ${formatCurrency(p.amount)}
            </div>`;
        });
        html += `</div></div>`;
    }
    container.innerHTML = html;
}
function showPaymentDetails(id) {
    const p = scheduledPayments.find(p=>p._id===id);
    if(!p) return;
    if(!p.paid && confirm(`${p.name}\nMonto: ${formatCurrency(p.amount)}\nFecha: ${p.dueDate}\n¿Marcar como pagado?`)){
        updateScheduledPayment(id,{paid:true});
    }
}
function renderPaymentsList() {
    const container = document.getElementById('paymentsListContainer');
    if(!container) return;
    if(scheduledPayments.length===0){ container.innerHTML='<p class="empty-message">No hay pagos programados</p>'; return; }
    const sorted = [...scheduledPayments].sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
    container.innerHTML = sorted.map(p=>`
        <div class="payment-item" style="border-left: 4px solid ${p.color||'#ef4444'}">
            <div class="payment-info">
                <div class="payment-name">${escapeHtml(p.name)}</div>
                <div class="payment-amount">${formatCurrency(p.amount)}</div>
                <div class="payment-date">📅 ${p.dueDate} • ${p.recurrence==='monthly'?'Mensual':p.recurrence==='yearly'?'Anual':'Única vez'}</div>
            </div>
            <div class="payment-actions">
                <button class="pay-btn ${p.paid?'paid':''}" onclick="togglePaymentStatus('${p._id}',${!p.paid})">${p.paid?'✅ Pagado':'💰 Pagar'}</button>
                <button class="edit-payment" onclick="editPayment('${p._id}')">✏️</button>
                <button class="delete-payment" onclick="deleteScheduledPayment('${p._id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}
async function togglePaymentStatus(id, paid) { await updateScheduledPayment(id,{paid}); }
function editPayment(id){
    const p = scheduledPayments.find(p=>p._id===id);
    if(!p) return;
    document.getElementById('paymentName').value = p.name;
    document.getElementById('paymentAmount').value = p.amount;
    document.getElementById('paymentDueDate').value = p.dueDate;
    document.getElementById('paymentRecurrence').value = p.recurrence||'once';
    document.getElementById('paymentColor').value = p.color||'#ef4444';
    window.editingPaymentId = id;
    document.getElementById('calendarModal').style.display = 'flex';
}
function prevMonth(){ currentMonth--; if(currentMonth<0){ currentMonth=11; currentYear--; } renderCalendar(); }
function nextMonth(){ currentMonth++; if(currentMonth>11){ currentMonth=0; currentYear++; } renderCalendar(); }
function goToToday(){ currentDate=new Date(); currentYear=currentDate.getFullYear(); currentMonth=currentDate.getMonth(); renderCalendar(); }

function initNavigation(){
    const dashboard = document.getElementById('dashboardPage');
    const calendar = document.getElementById('calendarPage');
    document.querySelectorAll('.nav-item[data-page]').forEach(item=>{
        item.addEventListener('click',(e)=>{
            e.preventDefault();
            const page = item.dataset.page;
            document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
            item.classList.add('active');
            dashboard.classList.remove('active');
            calendar.classList.remove('active');
            if(page==='dashboard') dashboard.classList.add('active');
            if(page==='calendar'){ calendar.classList.add('active'); renderCalendar(); renderPaymentsList(); }
        });
    });
}

// Inicialización principal
async function checkAuthAndStart() {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if(savedToken && savedUser){
        token = savedToken;
        currentUser = JSON.parse(savedUser);
        try{
            const test = await fetch('/api/profile',{ headers:{'Authorization':`Bearer ${token}`} });
            if(test.status===401||test.status===403) throw new Error();
            document.getElementById('authModal').style.display='none';
            const hasProfile = await loadProfile();
            if(!hasProfile || !userProfile || !userProfile.monthlyIncome){
                document.getElementById('profileModal').style.display='flex';
                document.getElementById('appContainer').style.display='none';
            } else {
                document.getElementById('profileModal').style.display='none';
                document.getElementById('appContainer').style.display='block';
                document.getElementById('welcomeName').innerHTML = `Bienvenido, ${currentUser.name || currentUser.email.split('@')[0]}`;
                document.getElementById('welcomeDate').innerHTML = new Date().toLocaleDateString('es-ES',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
                await loadTransactions();
                await loadScheduledPayments();
            }
        }catch(e){ logout(); }
    } else {
        document.getElementById('authModal').style.display='flex';
    }
}

document.addEventListener('DOMContentLoaded',()=>{
    checkAuthAndStart();

    let isLoginMode = true;
    document.getElementById('toggleAuthMode').addEventListener('click',(e)=>{
        e.preventDefault();
        isLoginMode = !isLoginMode;
        const nameGroup = document.getElementById('authNameGroup');
        const btn = document.getElementById('authSubmitBtn');
        if(isLoginMode){
            nameGroup.style.display='none';
            btn.innerHTML='<i class="fas fa-arrow-right"></i> Ingresar';
            document.getElementById('toggleAuthMode').innerHTML='¿No tienes cuenta? Regístrate';
        } else {
            nameGroup.style.display='block';
            btn.innerHTML='<i class="fas fa-user-plus"></i> Registrarse';
            document.getElementById('toggleAuthMode').innerHTML='¿Ya tienes cuenta? Inicia sesión';
        }
    });

    document.getElementById('authForm').addEventListener('submit', async (e)=>{
        e.preventDefault();
        const email = document.getElementById('authEmail').value;
        const pwd = document.getElementById('authPassword').value;
        if(isLoginMode){
            if(await login(email,pwd)) checkAuthAndStart();
        } else {
            const name = document.getElementById('authName').value;
            if(await register(email,pwd,name)){
                document.getElementById('authModal').style.display='none';
                document.getElementById('profileModal').style.display='flex';
            }
        }
    });

    document.getElementById('profileForm').addEventListener('submit', async (e)=>{
        e.preventDefault();
        userProfile = {
            monthlyIncome: parseFloat(document.getElementById('profileIncome').value)||0,
            incomeFrequency: document.querySelector('input[name="incomeFrequency"]:checked').value,
            rent: parseFloat(document.getElementById('profileRent').value)||0,
            services: parseFloat(document.getElementById('profileServices').value)||0,
            groceries: parseFloat(document.getElementById('profileGroceries').value)||0,
            transport: parseFloat(document.getElementById('profileTransport').value)||0,
            hasDebt: document.querySelector('input[name="hasDebt"]:checked').value==='si',
            debtAmount: parseFloat(document.getElementById('profileDebtAmount').value)||0,
            debtInterest: parseFloat(document.getElementById('profileDebtInterest').value)||0,
            savings: parseFloat(document.getElementById('profileSavings').value)||0,
            goal: document.getElementById('profileGoal').value,
            projectionMonths: parseInt(document.getElementById('profileProjection').value),
            email: document.getElementById('profileEmail').value,
            receiveEmailReports: document.getElementById('receiveEmailToggle').checked
        };
        await saveProfile(userProfile);
        document.getElementById('profileModal').style.display='none';
        document.getElementById('appContainer').style.display='block';
        document.getElementById('welcomeName').innerHTML = `Bienvenido, ${currentUser.name || currentUser.email.split('@')[0]}`;
        document.getElementById('welcomeDate').innerHTML = new Date().toLocaleDateString('es-ES',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
        await loadTransactions();
        await loadScheduledPayments();
    });

    document.getElementById('transactionForm').addEventListener('submit', async (e)=>{
        e.preventDefault();
        const desc = document.getElementById('descriptionInput').value;
        const amount = parseFloat(document.getElementById('amountInput').value);
        const cat = document.getElementById('categorySelect').value;
        const type = document.getElementById('typeSelect').value;
        const date = document.getElementById('dateInput').value;
        const tags = document.getElementById('tagsInput').value.split(' ').filter(t=>t.startsWith('#'));
        if(!desc || isNaN(amount) || amount<=0){ alert('Completa los campos'); return; }
        await saveTransaction({ description:desc, amount, category:cat, type, date, tags });
        document.getElementById('transactionForm').reset();
        document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];
    });

    document.getElementById('analyzeBtn').addEventListener('click', async ()=>{
        const btn = document.getElementById('analyzeBtn');
        const container = document.getElementById('aiRecommendations');
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...';
        btn.disabled = true;
        container.innerHTML = '<div class="loading-spinner">🧠 Analizando tus finanzas...</div>';
        const analysis = await getAIAnalysis();
        container.innerHTML = `<div>${analysis.replace(/\n/g,'<br>')}</div>`;
        btn.innerHTML = original;
        btn.disabled = false;
    });

    document.getElementById('emailReportBtn').addEventListener('click', sendEmailReport);
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('editProfileMenu').addEventListener('click',()=>{
        document.getElementById('profileModal').style.display='flex';
        document.getElementById('appContainer').style.display='none';
    });
    document.getElementById('currencySelect').addEventListener('change',(e)=>{
        currentCurrency=e.target.value;
        updateUI();
        updateTrendChart();
        if(document.getElementById('calendarPage').style.display!=='none'){ renderCalendar(); renderPaymentsList(); }
    });
    document.getElementById('themeToggle').addEventListener('click',()=> document.body.classList.toggle('dark'));
    document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];

    document.querySelectorAll('.radio-card').forEach(card=>{
        card.addEventListener('click',function(){
            const radio = this.querySelector('input');
            radio.checked=true;
            this.parentElement.querySelectorAll('.radio-card').forEach(c=>c.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
    document.querySelectorAll('input[name="hasDebt"]').forEach(radio=>{
        radio.addEventListener('change',(e)=> document.getElementById('debtFields').style.display = e.target.value==='si'?'block':'none');
    });

    initNavigation();
    // Botón flotante
    const addFloatBtn = ()=>{
        if(document.getElementById('appContainer').style.display==='block' && token){
            if(!document.querySelector('.add-payment-btn')){
                const btn = document.createElement('button');
                btn.className = 'add-payment-btn';
                btn.innerHTML = '<i class="fas fa-plus"></i>';
                btn.onclick = ()=>{
                    document.getElementById('paymentName').value='';
                    document.getElementById('paymentAmount').value='';
                    document.getElementById('paymentDueDate').value=new Date().toISOString().split('T')[0];
                    document.getElementById('paymentRecurrence').value='once';
                    document.getElementById('paymentColor').value='#ef4444';
                    window.editingPaymentId=null;
                    document.getElementById('calendarModal').style.display='flex';
                };
                document.body.appendChild(btn);
            }
        } else {
            const existing = document.querySelector('.add-payment-btn');
            if(existing) existing.remove();
        }
    };
    addFloatBtn();
    new MutationObserver(addFloatBtn).observe(document.getElementById('appContainer'),{attributes:true,attributeFilter:['style']});

    document.getElementById('scheduledPaymentForm').addEventListener('submit', async (e)=>{
        e.preventDefault();
        const payment = {
            name: document.getElementById('paymentName').value,
            amount: parseFloat(document.getElementById('paymentAmount').value),
            dueDate: document.getElementById('paymentDueDate').value,
            recurrence: document.getElementById('paymentRecurrence').value,
            color: document.getElementById('paymentColor').value
        };
        if(window.editingPaymentId) await updateScheduledPayment(window.editingPaymentId, payment);
        else await saveScheduledPayment(payment);
        document.getElementById('calendarModal').style.display='none';
        renderCalendar();
        renderPaymentsList();
    });

    ['authModal','profileModal','calendarModal'].forEach(id=>{
        const modal = document.getElementById(id);
        if(modal) modal.addEventListener('click',(e)=>{ if(e.target===modal) modal.style.display='none'; });
    });
});

window.deleteTransaction = deleteTransaction;
window.deleteScheduledPayment = deleteScheduledPayment;
window.togglePaymentStatus = togglePaymentStatus;
window.editPayment = editPayment;
window.prevMonth = prevMonth;
window.nextMonth = nextMonth;
window.goToToday = goToToday;
window.showPaymentDetails = showPaymentDetails;