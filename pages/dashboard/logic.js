// dashboard/logic.js: handles UI interactions, data loading and routing for dashboard page
// Auth guard and logout
const user = JSON.parse(localStorage.getItem('user') || 'null');
if (!user) window.location.href = '../../index.html';
document.getElementById('userName').innerText = user.name;
document.getElementById('logout').addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.href = '../../index.html';
});

// Loader functions
async function loadSales() {
    const res = await fetch('http://localhost:3001/api/sales');
    const data = await res.json();
    let html = '<h2 class="text-2xl mb-4">قائمة الفواتير</h2>';
    if (!res.ok) html += `<p class="text-red-600">${data.error}</p>`;
    else if (data.length === 0) html += '<p>لا توجد فواتير.</p>';
    else {
        html += '<table class="min-w-full bg-white border"><thead><tr><th class="border px-2 py-1">ID</th><th class="border px-2 py-1">التاجر</th><th class="border px-2 py-1">التاريخ</th><th class="border px-2 py-1">الإجمالي</th></tr></thead><tbody>';
        data.forEach(s => {
            html += `<tr><td class="border px-2 py-1">${s.SaleID}</td><td class="border px-2 py-1">${s.trader?.TraderName || '-'}<\/td><td class="border px-2 py-1">${s.SaleDate}</td><td class="border px-2 py-1">${s.TotalAmount}</td><\/tr>`;
        });
        html += '<\/tbody><\/table>';
    }
    document.getElementById('content').innerHTML = html;
}

// ... (rest of the dashboard.js code)
