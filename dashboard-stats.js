// --- Dashboard Stats Page ---
async function loadDashboardStats() {
  try {
    const [productsRes, salesRes, purchasesRes, expensesRes, tradersRes, sale_detailsRes] = await Promise.all([
      fetch('http://localhost:3001/api/products'),
      fetch('http://localhost:3001/api/sales'),
      fetch('http://localhost:3001/api/purchases'),
      fetch('http://localhost:3001/api/expenses'),
      fetch('http://localhost:3001/api/traders'),
      fetch('http://localhost:3001/api/sale_details')
    ]);
    const products = await productsRes.json();
    const sales = await salesRes.json();
    const sale_details = await sale_detailsRes.json();
    const purchases = await purchasesRes.json();
    const expenses = await expensesRes.json();
    const traders = await tradersRes.json();

    // Stats calculations
    const totalProducts = products.length;
    const sumProfit = sale_details.reduce((sum, s) => sum + (s.Profit || 0), 0);
    const totalSales = sales.reduce((sum, s) => sum + (s.TotalAmount || 0), 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.TotalAmount || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.Amount || 0), 0);
    const totalProfit = sumProfit - ( totalExpenses);
    const totalTraders = traders.length;
    const totalDebts = traders.reduce((sum, t) => sum + (t.Balance > 0 ? t.Balance : 0), 0);

    let html = `<h2 class="text-2xl font-bold mb-8 flex items-center gap-2">
      <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <span>لوحة التحكم</span>
    </h2>`;
    
    html += `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">`;
    
    html += `<div class="transform transition-all duration-300 hover:scale-105">
      <div class="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-xl shadow-md text-white">
        <div class="text-3xl mb-3">📦</div>
        <h3 class="text-sm font-medium opacity-80">إجمالي المنتجات</h3>
        <p class="text-2xl font-bold">${totalProducts.toLocaleString('ar-EG')} منتج</p>
      </div>
    </div>`;

    html += `<div class="transform transition-all duration-300 hover:scale-105">
      <div class="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl shadow-md text-white">
        <div class="text-3xl mb-3">🛒</div>
        <h3 class="text-sm font-medium opacity-80">إجمالي المبيعات</h3>
        <p class="text-2xl font-bold">${totalSales.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</p>
      </div>
    </div>`;

    html += `<div class="transform transition-all duration-300 hover:scale-105">
      <div class="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl shadow-md text-white">
        <div class="text-3xl mb-3">💵</div>
        <h3 class="text-sm font-medium opacity-80">إجمالي المشتريات</h3>
        <p class="text-2xl font-bold">${totalPurchases.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</p>
      </div>
    </div>`;

    html += `<div class="transform transition-all duration-300 hover:scale-105">
      <div class="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-xl shadow-md text-white">
        <div class="text-3xl mb-3">💰</div>
        <h3 class="text-sm font-medium opacity-80">إجمالي المصروفات</h3>
        <p class="text-2xl font-bold">${totalExpenses.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</p>
      </div>
    </div>`;

    html += `<div class="transform transition-all duration-300 hover:scale-105">
      <div class="bg-gradient-to-br from-teal-500 to-teal-600 p-6 rounded-xl shadow-md text-white">
        <div class="text-3xl mb-3">📊</div>
        <h3 class="text-sm font-medium opacity-80">صافي الربح</h3>
        <p class="text-2xl font-bold">${totalProfit.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</p>
      </div>
    </div>`;

    html += `<div class="transform transition-all duration-300 hover:scale-105">
      <div class="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl shadow-md text-white">
        <div class="text-3xl mb-3">👥</div>
        <h3 class="text-sm font-medium opacity-80">إجمالي العملاء</h3>
        <p class="text-2xl font-bold">${totalTraders.toLocaleString('ar-EG')} عميل</p>
      </div>
    </div>`;

    html += `<div class="transform transition-all duration-300 hover:scale-105">
      <div class="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-xl shadow-md text-white">
        <div class="text-3xl mb-3">💳</div>
        <h3 class="text-sm font-medium opacity-80">إجمالي الديون</h3>
        <p class="text-2xl font-bold">${totalDebts.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</p>
      </div>
    </div>`;
    
    html += `</div>`;

    document.getElementById('content').innerHTML = html;
  } catch (error) {
    document.getElementById('content').innerHTML = `
      <div class="p-6 bg-red-50 rounded-xl border border-red-200">
        <div class="flex items-center gap-3 text-red-600">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>خطأ في تحميل الإحصائيات: ${error.message}</span>
        </div>
      </div>`;
    console.error("Error loading dashboard stats:", error);
  }
}
