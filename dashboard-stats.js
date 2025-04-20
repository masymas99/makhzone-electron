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

    let html = `<h2 class=\"text-2xl font-bold mb-8 flex items-center gap-2\"><span>لوحة التحكم</span></h2>`;
    html += `<div class=\"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10\">`;
    html += `  <div class=\"bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-xl shadow-md text-white\">\n      <div class=\"text-3xl mb-3\">📦</div>\n      <h3 class=\"text-sm font-medium opacity-80\">إجمالي المنتجات</h3>\n      <p class=\"text-2xl font-bold\">${totalProducts.toLocaleString('ar-EG')} منتج</p>\n    </div>`;
    html += `  <div class=\"bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl shadow-md text-white\">\n      <div class=\"text-3xl mb-3\">🛒</div>\n      <h3 class=\"text-sm font-medium opacity-80\">إجمالي المبيعات</h3>\n      <p class=\"text-2xl font-bold\">${totalSales.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</p>\n    </div>`;
    html += `  <div class=\"bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl shadow-md text-white\">\n      <div class=\"text-3xl mb-3\">💵</div>\n      <h3 class=\"text-sm font-medium opacity-80\">إجمالي المشتريات</h3>\n      <p class=\"text-2xl font-bold\">${totalPurchases.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</p>\n    </div>`;
    html += `  <div class=\"bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-xl shadow-md text-white\">\n      <div class=\"text-3xl mb-3\">💰</div>\n      <h3 class=\"text-sm font-medium opacity-80\">إجمالي المصروفات</h3>\n      <p class=\"text-2xl font-bold\">${totalExpenses.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</p>\n    </div>`;
    html += `  <div class=\"bg-gradient-to-br from-teal-500 to-teal-600 p-6 rounded-xl shadow-md text-white\">\n      <div class=\"text-3xl mb-3\">📊</div>\n      <h3 class=\"text-sm font-medium opacity-80\">صافي الربح</h3>\n      <p class=\"text-2xl font-bold\">${totalProfit.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</p>\n    </div>`;
    html += `  <div class=\"bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl shadow-md text-white\">\n      <div class=\"text-3xl mb-3\">👥</div>\n      <h3 class=\"text-sm font-medium opacity-80\">إجمالي العملاء</h3>\n      <p class=\"text-2xl font-bold\">${totalTraders.toLocaleString('ar-EG')} عميل</p>\n    </div>`;
    html += `  <div class=\"bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-xl shadow-md text-white\">\n      <div class=\"text-3xl mb-3\">💳</div>\n      <h3 class=\"text-sm font-medium opacity-80\">إجمالي الديون</h3>\n      <p class=\"text-2xl font-bold\">${totalDebts.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</p>\n    </div>`;
    html += `</div>`;

    document.getElementById('content').innerHTML = html;
  } catch (error) {
    document.getElementById('content').innerHTML = `<p class=\"text-red-600 p-4\">خطأ في تحميل الإحصائيات: ${error.message}</p>`;
    console.error("Error loading dashboard stats:", error);
  }
}
