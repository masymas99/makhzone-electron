// dashboard.js: handles UI interactions, data loading and routing for dashboard page
// Auth guard and logout
function checkAuth() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user) {
    window.location.href = 'index.html';
    return false;
  }
  // Check expiration
  const expiresAt = new Date(user.expiresAt);
  if (expiresAt < new Date()) {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
    return false;
  }
  document.getElementById('userName').innerText = user.name;
  return true;
}

// Check auth on page load
checkAuth();

document.getElementById('logout').addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
});

// Loader functions
async function loadSales() {
    const res = await fetch('http://localhost:3001/api/sales');
    const data = await res.json();
    let html = '<h2 class="text-2xl mb-4">قائمة الفواتير</h2>';
    if (!res.ok) html += `<p class="text-red-600">${data.error}</p>`;
    else if (data.length === 0) html += '<p>لا توجد فواتير.</p>';
    else {
        html += '<table class="min-w-full bg-white border"><thead><tr><th class="border px-2 py-1">ID</th><th class="border px-2 py-1">العميل</th><th class="border px-2 py-1">التاريخ</th><th class="border px-2 py-1">الإجمالي</th></tr></thead><tbody>';
        data.forEach(s => {
            html += `<tr><td class="border px-2 py-1">${s.SaleID}</td><td class="border px-2 py-1">${s.trader?.TraderName || '-'}<\/td><td class="border px-2 py-1">${s.SaleDate}</td><td class="border px-2 py-1">${s.TotalAmount}</td><\/tr>`;
        });
        html += '<\/tbody><\/table>';
    }
    document.getElementById('content').innerHTML = html;
}

async function loadProducts() {
    const res = await fetch('http://localhost:3001/api/products');
    const data = await res.json();
    let html = '<div class="flex justify-between items-center mb-4">'
        + '<h2 class="text-2xl">المنتجات</h2>'
        + '<button id="addProductBtn" class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">+ إضافة منتج</button>'
        + '</div>';
    html += '<table class="min-w-full bg-white border">';
    html += '<thead><tr><th class="border px-2 py-1">ID</th><th class="border px-2 py-1">الاسم</th><th class="border px-2 py-1">الصنف</th><th class="border px-2 py-1">الكمية</th><th class="border px-2 py-1">السعر</th><th class="border px-2 py-1">الإجراءات</th></tr></thead>';
    html += '<tbody>';
    if (res.ok && data.length) {
        data.forEach(p => {
            html += '<tr>' +
                `<td class="border px-2 py-1">${p.ProductID}</td>` +
                `<td class="border px-2 py-1">${p.ProductName}</td>` +
                `<td class="border px-2 py-1">${p.Category}</td>` +
                `<td class="border px-2 py-1">${p.StockQuantity}</td>` +
                `<td class="border px-2 py-1">${p.UnitPrice}</td>` +
                '<td class="border px-2 py-1">' +
                `<button data-id="${p.ProductID}" class="edit-product bg-yellow-400 px-2 py-1 rounded mr-1">تعديل</button>` +
                `<button data-id="${p.ProductID}" class="delete-product bg-red-500 text-white px-2 py-1 rounded">حذف</button>` +
                '</td></tr>';
        });
    } else html += '<tr><td colspan="6" class="text-center py-2">لا توجد بيانات</td></tr>';
    html += '</tbody></table>';
    document.getElementById('content').innerHTML = html;
    document.getElementById('addProductBtn').addEventListener('click', showAddProductForm);
    document.querySelectorAll('.edit-product').forEach(btn => btn.addEventListener('click', () => showEditProductForm(btn.dataset.id)));
    document.querySelectorAll('.delete-product').forEach(btn => btn.addEventListener('click', () => deleteProduct(btn.dataset.id)));
}

async function loadTraders() {
    const res = await fetch('http://localhost:3001/api/traders');
    const data = await res.json();
    let html = '<div class="flex justify-between items-center mb-4">'
        + '<h2 class="text-2xl">العملاء</h2>'
        + '<button id="addTraderBtn" class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">+ إضافة عميل</button>'
        + '</div>';
    html += '<table class="min-w-full bg-white border"><thead><tr><th class="border px-2 py-1">ID</th><th class="border px-2 py-1">الاسم</th><th class="border px-2 py-1">الرصيد</th></tr></thead><tbody>';
    if (res.ok && data.length) {
        data.forEach(t => {
            html += `<tr><td class="border px-2 py-1">${t.TraderID}</td><td class="border px-2 py-1">${t.TraderName}</td><td class="border px-2 py-1">${t.Balance}</td><\/tr>`;
        });
    } else html += '<tr><td colspan="3" class="text-center py-2">لا توجد بيانات</td></tr>';
    html += '<\/tbody><\/table>';
    document.getElementById('content').innerHTML = html;
    document.getElementById('addTraderBtn').addEventListener('click', showAddTraderForm);
}

async function loadPurchases() {
    try {
        const res = await fetch('http://localhost:3001/api/purchases');
        if (!res.ok) {
            const error = await res.text();
            throw new Error(`HTTP error! status: ${res.status}, message: ${error}`);
        }
        const data = await res.json();
        
        // Create table structure
        let html = `
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl">المشتريات</h2>
                <button id="addPurchaseBtn" class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">+ إنشاء مشتريات</button>
            </div>
            <table class="min-w-full bg-white border">
                <thead>
                    <tr>
                        <th class="border px-2 py-1">ID</th>
                        <th class="border px-2 py-1">التاريخ</th>
                        <th class="border px-2 py-1">المورد</th>
                        <th class="border px-2 py-1">الإجمالي</th>
                        <th class="border px-2 py-1">الإجراءات</th>
                    </tr>
                </thead>
                <tbody id="purchasesTableBody">
                </tbody>
            </table>
        `;
        
        document.getElementById('content').innerHTML = html;
        
        // Add event listener for add button
        document.getElementById('addPurchaseBtn').addEventListener('click', showAddPurchaseForm);
        
        if (Array.isArray(data) && data.length > 0) {
            // Group purchases by PurchaseID
            const groupedPurchases = {};
            data.forEach(purchase => {
                if (!groupedPurchases[purchase.PurchaseID]) {
                    groupedPurchases[purchase.PurchaseID] = {
                        PurchaseID: purchase.PurchaseID,
                        PurchaseDate: purchase.PurchaseDate,
                        SupplierName: purchase.SupplierName,
                        TotalAmount: purchase.TotalAmount,
                        Products: [],
                        Quantities: [],
                        Costs: []
                    };
                }
                
                // Add product details
                groupedPurchases[purchase.PurchaseID].Products.push(
                    `${purchase.ProductName} (${purchase.Quantity} × ${purchase.UnitCost})`
                );
            });

            // Add rows to table
            const tbody = document.getElementById('purchasesTableBody');
            Object.values(groupedPurchases).forEach(purchase => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="border px-2 py-1">${purchase.PurchaseID}</td>
                    <td class="border px-2 py-1">${new Date(purchase.PurchaseDate).toLocaleDateString()}</td>
                    <td class="border px-2 py-1">${purchase.SupplierName}</td>
                    <td class="border px-2 py-1">${purchase.TotalAmount}</td>
                    <td class="border px-2 py-1">
                        <button data-id="${purchase.PurchaseID}" class="edit-purchase bg-yellow-400 px-2 py-1 rounded mr-1">تعديل</button>
                        <button data-id="${purchase.PurchaseID}" class="delete-purchase bg-red-500 text-white px-2 py-1 rounded">حذف</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            // Add event listeners for edit and delete buttons
            document.querySelectorAll('.edit-purchase').forEach(btn => {
                btn.addEventListener('click', async () => {
                    try {
                        const id = btn.dataset.id;
                        const res = await fetch(`http://localhost:3001/api/purchases/${id}`);
                        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                        const purchase = await res.json();
                        showEditPurchaseForm(purchase);
                    } catch (error) {
                        Swal.fire({
  title: 'خطأ',
  text: error.message,
  icon: 'error',
  confirmButtonText: 'موافق',
  cancelButtonText: 'إلغاء',
  showCancelButton: true
});
                        console.error('Error loading purchase:', error);
                    }
                });
            });

            document.querySelectorAll('.delete-purchase').forEach(btn => {
                btn.addEventListener('click', async () => {
                    try {
                        const id = btn.dataset.id;
                        const { value: confirmed } = await Swal.fire({
  title: 'هل أنت متأكد؟',
  text: 'هل أنت متأكد من حذف هذه المشتريات؟',
  icon: 'warning',
  showCancelButton: true,
  confirmButtonText: 'نعم، احذف',
  cancelButtonText: 'إلغاء',
  confirmButtonColor: '#d33',
  cancelButtonColor: '#3085d6'
});
if (!confirmed) return;
                        
                        const res = await fetch(`http://localhost:3001/api/purchases/${id}`, {
                            method: 'DELETE'
                        });
                        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                        
                        const result = await res.json();
                        if (res.ok) {
                            await loadPurchases(); // Reload purchases after deletion
                        } else {
                            throw new Error(result.error || 'خطأ في حذف المشتريات');
                        }
                    } catch (error) {
                        Swal.fire({
  title: 'خطأ',
  text: error.message,
  icon: 'error',
  confirmButtonText: 'موافق',
  cancelButtonText: 'إلغاء',
  showCancelButton: true
});
                        console.error('Error deleting purchase:', error);
                    }
                });
            });
        } else {
            document.getElementById('purchasesTableBody').innerHTML = 
                '<tr><td colspan="5" class="text-center py-2">لا توجد بيانات</td></tr>';
        }
    } catch (error) {
        console.error('Error loading purchases:', error);
        document.getElementById('content').innerHTML = 
            `<p class="text-red-600">حدث خطأ أثناء تحميل المشتريات: ${error.message}</p>`;
    }
}

async function loadExpenses() {
    const res = await fetch('http://localhost:3001/api/expenses');
    const data = await res.json();
    let html = '<div class="flex justify-between items-center mb-4">'
        + '<h2 class="text-2xl">المصروفات</h2>'
        + '<button id="addExpenseBtn" class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">+ إضافة مصروف</button>'
        + '</div>';
    html += '<table class="min-w-full bg-white border">';
    html += '<thead><tr><th class="border px-2 py-1">ID</th><th class="border px-2 py-1">الوصف</th><th class="border px-2 py-1">المبلغ</th><th class="border px-2 py-1">التاريخ</th><th class="border px-2 py-1">الإجراءات</th></tr></thead>';
    html += '<tbody>';
    if (res.ok && data.length) {
        data.forEach(e => {
            html += `<tr>
        <td class="border px-2 py-1">${e.ExpenseID}</td>
        <td class="border px-2 py-1">${e.Description}</td>
        <td class="border px-2 py-1">${e.Amount}</td>
        <td class="border px-2 py-1">${e.ExpenseDate}</td>
        <td class="border px-2 py-1">
          <button data-id="${e.ExpenseID}" class="edit-expense bg-yellow-400 px-2 py-1 rounded mr-1">تعديل</button>
          <button data-id="${e.ExpenseID}" class="delete-expense bg-red-500 text-white px-2 py-1 rounded">حذف</button>
        </td>
      </tr>`;
        });
    } else html += '<tr><td colspan="5" class="text-center py-2">لا توجد بيانات</td></tr>';
    html += '</tbody></table>';
    document.getElementById('content').innerHTML = html;

    document.getElementById('addExpenseBtn').addEventListener('click', showAddExpenseForm);
    document.querySelectorAll('.edit-expense').forEach(btn =>
        btn.addEventListener('click', () => showEditExpenseForm(btn.dataset.id))
    );
    document.querySelectorAll('.delete-expense').forEach(btn =>
        btn.addEventListener('click', () => deleteExpense(btn.dataset.id))
    );
}

function showAddPaymentForm() {
    const html = `
    <div class="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h3 class="text-xl mb-4">إضافة دفعة</h3>
      <div id="paymentMsg"></div>
      <form id="paymentForm" class="space-y-4">
        <input type="number" id="pTraderID" placeholder="ID العميل" class="w-full border px-3 py-2 rounded" required />
        <input type="number" step="0.01" id="pAmount" placeholder="المبلغ" class="w-full border px-3 py-2 rounded" required />
        <input type="date" id="pDate" placeholder="التاريخ" class="w-full border px-3 py-2 rounded" required />
        <button type="submit" class="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600">حفظ</button>
      </form>
    </div>
  `;
    document.getElementById('content').innerHTML = html;
    document.getElementById('paymentForm').addEventListener('submit', async e => {
        e.preventDefault();
        const payload = {
            TraderID: +document.getElementById('pTraderID').value,
            Amount: +document.getElementById('pAmount').value,
            PaymentDate: document.getElementById('pDate').value
        };
        try {
            const res = await fetch('http://localhost:3001/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) loadPayments();
            else document.getElementById('paymentMsg').innerHTML = `<p class="text-red-600">${data.error}</p>`;
        } catch {
            document.getElementById('paymentMsg').innerHTML = '<p class="text-red-600">خطأ في الاتصال</p>';
        }
    });
}

function showEditPaymentForm(id) {
    fetch(`http://localhost:3001/api/payments/${id}`)
        .then(res => res.json())
        .then(p => {
            const html = `
        <div class="max-w-md mx-auto bg-white p-6 rounded shadow">
          <h3 class="text-xl mb-4">تعديل دفعة</h3>
          <div id="paymentMsg"></div>
          <form id="editPaymentForm" class="space-y-4">
            <input type="number" id="epTraderID" value="${p.TraderID}" class="w-full border px-3 py-2 rounded" required />
            <input type="number" step="0.01" id="epAmount" value="${p.Amount}" class="w-full border px-3 py-2 rounded" required />
            <input type="date" id="epDate" value="${p.PaymentDate}" class="w-full border px-3 py-2 rounded" required />
            <button type="submit" class="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600">حفظ التعديلات</button>
          </form>
        </div>
      `;
            document.getElementById('content').innerHTML = html;
            document.getElementById('editPaymentForm').addEventListener('submit', async e => {
                e.preventDefault();
                const payload = {
                    TraderID: +document.getElementById('epTraderID').value,
                    Amount: +document.getElementById('epAmount').value,
                    PaymentDate: document.getElementById('epDate').value
                };
                try {
                    const res = await fetch(`http://localhost:3001/api/payments/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (res.ok) loadPayments();
                    else document.getElementById('paymentMsg').innerHTML = `<p class="text-red-600">${data.error}</p>`;
                } catch {
                    document.getElementById('paymentMsg').innerHTML = '<p class="text-red-600">خطأ في الاتصال</p>';
                }
            });
        });
}

function deletePayment(id) {
    if (!confirm('هل أنت متأكد من حذف الدفعة؟')) return;
    fetch(`http://localhost:3001/api/payments/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(() => loadPayments());
}

async function loadPayments() {
    const res = await fetch('http://localhost:3001/api/payments');
    const data = await res.json();
    let html = '<div class="flex justify-between items-center mb-4">'
        + '<h2 class="text-2xl">الدفعات</h2>'
        + '<button id="addPaymentBtn" class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">+ إضافة دفعة</button>'
        + '</div>';
    html += '<table class="min-w-full bg-white border"><thead><tr><th class="border px-2 py-1">ID</th><th class="border px-2 py-1">ID العميل</th><th class="border px-2 py-1">المبلغ</th><th class="border px-2 py-1">التاريخ</th><th class="border px-2 py-1">الإجراءات</th></tr></thead><tbody>';
    if (res.ok && data.length) {
        data.forEach(p => {
            html += `<tr>
        <td class="border px-2 py-1">${p.PaymentID}</td>
        <td class="border px-2 py-1">${p.TraderID}</td>
        <td class="border px-2 py-1">${p.Amount}</td>
        <td class="border px-2 py-1">${p.PaymentDate}</td>
        <td class="border px-2 py-1">
          <button data-id="${p.PaymentID}" class="edit-payment bg-yellow-400 px-2 py-1 rounded mr-1">تعديل</button>
          <button data-id="${p.PaymentID}" class="delete-payment bg-red-500 text-white px-2 py-1 rounded">حذف</button>
        </td>
      </tr>`;
        });
    } else html += '<tr><td colspan="5" class="text-center py-2">لا توجد بيانات</td></tr>';
    html += '</tbody></table>';
    document.getElementById('content').innerHTML = html;

    document.getElementById('addPaymentBtn').addEventListener('click', showAddPaymentForm);
    document.querySelectorAll('.edit-payment').forEach(btn =>
        btn.addEventListener('click', () => showEditPaymentForm(btn.dataset.id))
    );
    document.querySelectorAll('.delete-payment').forEach(btn =>
        btn.addEventListener('click', () => deletePayment(btn.dataset.id))
    );
}

function showAddProductForm() {
    const html = `
    <div class="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h3 class="text-xl mb-4">إضافة منتج</h3>
      <div id="productMsg"></div>
      <form id="productForm" class="space-y-4">
        <input type="text" id="pName" placeholder="الاسم" class="w-full border px-3 py-2 rounded" required />
        <input type="text" id="pCategory" placeholder="الصنف" class="w-full border px-3 py-2 rounded" required />
        <input type="number" id="pStock" placeholder="الكمية" class="w-full border px-3 py-2 rounded" required />
        <input type="number" step="0.01" id="pPrice" placeholder="سعر الوحدة" class="w-full border px-3 py-2 rounded" required />
        <input type="number" step="0.01" id="pCost" placeholder="تكلفة الوحدة" class="w-full border px-3 py-2 rounded" required />
        <button type="submit" class="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600">حفظ</button>
      </form>
    </div>
  `;
    document.getElementById('content').innerHTML = html;
    document.getElementById('productForm').addEventListener('submit', async e => {
        e.preventDefault();
        const payload = { ProductName: document.getElementById('pName').value, Category: document.getElementById('pCategory').value, StockQuantity: +document.getElementById('pStock').value, UnitPrice: +document.getElementById('pPrice').value, UnitCost: +document.getElementById('pCost').value, IsActive: true };
        try {
            const res = await fetch('http://localhost:3001/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (res.ok) loadProducts(); else document.getElementById('productMsg').innerHTML = `<p class="text-red-600">${data.error}</p>`;
        } catch {
            document.getElementById('productMsg').innerHTML = '<p class="text-red-600">خطأ في الاتصال</p>';
        }
    });
}

function showAddTraderForm() {
    const html = `
    <div class="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h3 class="text-xl mb-4">إضافة عميل</h3>
      <div id="traderMsg"></div>
      <form id="traderForm" class="space-y-4">
        <input type="text" id="tName" placeholder="الاسم" class="w-full border px-3 py-2 rounded" required />
        <input type="text" id="tPhone" placeholder="الهاتف" class="w-full border px-3 py-2 rounded" required />
        <input type="text" id="tAddress" placeholder="العنوان" class="w-full border px-3 py-2 rounded" required />
        <button type="submit" class="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600">حفظ</button>
      </form>
    </div>
  `;
    document.getElementById('content').innerHTML = html;
    document.getElementById('traderForm').addEventListener('submit', async e => {
        e.preventDefault();
        const payload = { TraderName: document.getElementById('tName').value, Phone: document.getElementById('tPhone').value, Address: document.getElementById('tAddress').value, IsActive: true };
        try {
            const res = await fetch('http://localhost:3001/api/traders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (res.ok) loadTraders(); else document.getElementById('traderMsg').innerHTML = `<p class="text-red-600">${data.error}</p>`;
        } catch {
            document.getElementById('traderMsg').innerHTML = '<p class="text-red-600">خطأ في الاتصال</p>';
        }
    });
}

// edit product
function showEditProductForm(id) {
    fetch(`http://localhost:3001/api/products/${id}`)
        .then(res => res.json())
        .then(p => {
            const html = `
        <div class="max-w-md mx-auto bg-white p-6 rounded shadow">
          <h3 class="text-xl mb-4">تعديل منتج</h3>
          <div id="productMsg"></div>
          <form id="editProductForm" class="space-y-4">
            <input type="text" id="eName" value="${p.ProductName}" class="w-full border px-3 py-2 rounded" required />
            <input type="text" id="eCategory" value="${p.Category}" class="w-full border px-3 py-2 rounded" required />
            <input type="number" id="eStock" value="${p.StockQuantity}" class="w-full border px-3 py-2 rounded" required />
            <input type="number" step="0.01" id="ePrice" value="${p.UnitPrice}" class="w-full border px-3 py-2 rounded" required />
            <input type="number" step="0.01" id="eCost" value="${p.UnitCost}" class="w-full border px-3 py-2 rounded" required />
            <button type="submit" class="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600">حفظ التعديلات</button>
          </form>
        </div>
      `;
            document.getElementById('content').innerHTML = html;
            document.getElementById('editProductForm').addEventListener('submit', async e => {
                e.preventDefault();
                const payload = {
                    ProductName: document.getElementById('eName').value,
                    Category: document.getElementById('eCategory').value,
                    StockQuantity: +document.getElementById('eStock').value,
                    UnitPrice: +document.getElementById('ePrice').value,
                    UnitCost: +document.getElementById('eCost').value,
                    IsActive: true
                };
                try {
                    const res = await fetch(`http://localhost:3001/api/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    const data = await res.json();
                    if (res.ok) loadProducts(); else document.getElementById('productMsg').innerHTML = `<p class="text-red-600">${data.error}</p>`;
                } catch { document.getElementById('productMsg').innerHTML = '<p class="text-red-600">خطأ في الاتصال</p>'; }
            });
        });
}

// delete product
async function deleteProduct(id) {
    const { value: confirmed } = await Swal.fire({
  title: 'هل أنت متأكد؟',
  text: 'هل أنت متأكد من حذف هذا المنتج؟',
  icon: 'warning',
  showCancelButton: true,
  confirmButtonText: 'نعم، احذف',
  cancelButtonText: 'إلغاء',
  confirmButtonColor: '#d33',
  cancelButtonColor: '#3085d6'
});
if (!confirmed) return;
    fetch(`http://localhost:3001/api/products/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(() => loadProducts());
}

// Navigation handler
document.querySelectorAll('nav a').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const page = a.getAttribute('data-page');
    if (page === 'sales') loadSales();
    else if (page === 'products') loadProducts();
    else if (page === 'traders') loadTraders();
    else if (page === 'purchases') loadPurchases();
    else if (page === 'expenses') loadExpenses();
    else if (page === 'payments') loadPayments();
}));

// Initial load
loadSales();

async function showEditPurchaseForm(id) {
    fetch(`http://localhost:3001/api/purchases/${id}`)
        .then(res => res.json())
        .then(purchase => {
            const html = `
                <div class="max-w-md mx-auto bg-white p-6 rounded shadow">
                    <h3 class="text-xl mb-4">تعديل مشتريات</h3>
                    <div id="purchaseMsg"></div>
                    <form id="editPurchaseForm" class="space-y-4">
                        <input type="text" id="supplierName" value="${purchase.SupplierName}" placeholder="اسم المورد" class="w-full border px-3 py-2 rounded" required />
                        <textarea id="notes" placeholder="ملاحظات" class="w-full border px-3 py-2 rounded">${purchase.Notes || ''}</textarea>
                        <div id="productsContainer"></div>
                        <button type="button" id="addProduct" class="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 mb-4">إضافة منتج</button>
                        <button type="submit" class="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600">حفظ التعديلات</button>
                    </form>
                </div>
            `;
            document.getElementById('content').innerHTML = html;

            // Load existing products
            fetch(`http://localhost:3001/api/purchase-details/${id}`)
                .then(res => res.json())
                .then(details => {
                    const container = document.getElementById('productsContainer');
                    details.forEach(detail => {
                        addProductRow(detail.ProductID, detail.ProductName, detail.Category, detail.Quantity, detail.UnitCost, detail.UnitPrice);
                    });
                });

            document.getElementById('addProduct').addEventListener('click', addProductRow);
            document.getElementById('editPurchaseForm').addEventListener('submit', async e => {
                e.preventDefault();
                const products = [];
                document.querySelectorAll('.product-row').forEach(row => {
                    const product = {
                        product_id: row.querySelector('.product-id').value,
                        product_name: row.querySelector('.product-name').value,
                        category: row.querySelector('.category').value,
                        quantity: +row.querySelector('.quantity').value,
                        unit_cost: +row.querySelector('.unit-cost').value,
                        unit_price: +row.querySelector('.unit-price').value
                    };
                    products.push(product);
                });

                try {
                    const res = await fetch(`http://localhost:3001/api/purchases/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            supplier_name: document.getElementById('supplierName').value,
                            notes: document.getElementById('notes').value,
                            products: products
                        })
                    });
                    const data = await res.json();
                    if (res.ok) loadPurchases();
                    else document.getElementById('purchaseMsg').innerHTML = `<p class="text-red-600">${data.error}</p>`;
                } catch {
                    document.getElementById('purchaseMsg').innerHTML = '<p class="text-red-600">خطأ في الاتصال</p>';
                }
            });
        });
}

async function deletePurchase(id) {
    const { value: confirmed } = await Swal.fire({
  title: 'هل أنت متأكد؟',
  text: 'هل أنت متأكد من حذف هذه المشتريات؟',
  icon: 'warning',
  showCancelButton: true,
  confirmButtonText: 'نعم، احذف',
  cancelButtonText: 'إلغاء',
  confirmButtonColor: '#d33',
  cancelButtonColor: '#3085d6'
});
if (!confirmed) return;
    try {
        // First get purchase details to know which products to update
        const res = await fetch(`http://localhost:3001/api/purchases/${id}`);
        if (!res.ok) throw new Error('Failed to fetch purchase details');
        const purchase = await res.json();

        // Delete the purchase
        const deleteRes = await fetch(`http://localhost:3001/api/purchases/${id}`, {
            method: 'DELETE'
        });
        
        if (!deleteRes.ok) throw new Error('Failed to delete purchase');
        
        // Update costs for each product in this purchase
        for (const item of purchase.Items) {
            await updateProductCostAfterDeletion(item.ProductID, item.Quantity, item.UnitCost);
        }

        // Reload purchases after deletion
        await loadPurchases();
        
    } catch (error) {
        Swal.fire({
  title: 'خطأ',
  text: error.message,
  icon: 'error',
  confirmButtonText: 'موافق',
  cancelButtonText: 'إلغاء',
  showCancelButton: true
});
        console.error('Error deleting purchase:', error);
    }
};

function addProductRow(product_id = '', product_name = '', category = '', quantity = '', unit_cost = '', unit_price = '') {
    const container = document.getElementById('productsContainer');
    const row = document.createElement('div');
    row.className = 'product-row flex flex-col space-y-2 mb-4';
    row.innerHTML = `
        <div class="flex space-x-2">
            <input type="text" class="product-id w-24 border px-3 py-1 rounded" value="${product_id}" placeholder="ID المنتج" />
            <input type="text" class="product-name w-48 border px-3 py-1 rounded" value="${product_name}" placeholder="اسم المنتج" />
            <input type="text" class="category w-32 border px-3 py-1 rounded" value="${category}" placeholder="الصنف" />
            <input type="number" class="quantity w-24 border px-3 py-1 rounded" value="${quantity}" placeholder="الكمية" />
            <input type="number" step="0.01" class="unit-cost w-24 border px-3 py-1 rounded" value="${unit_cost}" placeholder="تكلفة الوحدة" />
            <input type="number" step="0.01" class="unit-price w-24 border px-3 py-1 rounded" value="${unit_price}" placeholder="سعر البيع" />
            <button type="button" class="remove-product bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">حذف</button>
        </div>
    `;
    container.appendChild(row);
    row.querySelector('.remove-product').addEventListener('click', () => row.remove());
}

// Function to calculate weighted average cost
async function calculateWeightedAverageCost(productId) {
    try {
        // Get all purchases for this product
        const res = await fetch(`http://localhost:3001/api/purchases?productId=${productId}`);
        if (!res.ok) throw new Error('Failed to fetch purchase history');
        const purchases = await res.json();

        let totalQuantity = 0;
        let totalCost = 0;

        // Calculate total quantity and total cost
        purchases.forEach(purchase => {
            totalQuantity += purchase.Quantity;
            totalCost += purchase.Quantity * purchase.UnitCost;
        });

        // Calculate weighted average cost
        const weightedAverageCost = totalQuantity > 0 ? (totalCost / totalQuantity).toFixed(2) : 0;

        return weightedAverageCost;
    } catch (error) {
        console.error('Error calculating weighted average cost:', error);
        return 0;
    }
}

// Function to update product cost after purchase deletion
async function updateProductCostAfterDeletion(productId, deletedQuantity, deletedCost) {
    try {
        // Get current product details
        const res = await fetch(`http://localhost:3001/api/products/${productId}`);
        if (!res.ok) throw new Error('Failed to fetch product details');
        const product = await res.json();

        // Calculate new quantity
        const newQuantity = product.StockQuantity - deletedQuantity;

        // If there's still quantity left, recalculate weighted average cost
        if (newQuantity > 0) {
            const newCost = await calculateWeightedAverageCost(productId);
            await fetch(`http://localhost:3001/api/products/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    StockQuantity: newQuantity,
                    UnitCost: newCost
                })
            });
        } else {
            // If quantity becomes zero, set cost to 0
            await fetch(`http://localhost:3001/api/products/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    StockQuantity: 0,
                    UnitCost: 0
                })
            });
        }
    } catch (error) {
        console.error('Error updating product cost:', error);
    }
}
