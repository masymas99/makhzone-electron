// View for purchases page
export function renderPurchases(data) {
  let html = '<div class="flex justify-between items-center mb-4">'
    + '<h2 class="text-2xl">المشتريات</h2>'
    + '<div class="space-x-2">'
    + '<button id="addPurchaseBtn" class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">+ إنشاء مشتريات</button>'
    + '<button id="addProductFromPurchaseBtn" class="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">+ إضافة منتج جديد</button>'
    + '</div>'
  + '</div>';

  if (!data || data.length === 0) {
    html += '<p>لا توجد مشتريات.</p>';
  } else {
    html += '<table class="min-w-full bg-white border">';
    html += '<thead><tr><th class="border px-2 py-1">ID</th><th class="border px-2 py-1">التاريخ</th><th class="border px-2 py-1">المنتجات</th><th class="border px-2 py-1">المورد</th><th class="border px-2 py-1">الكميات</th><th class="border px-2 py-1">التكاليف</th></tr></thead><tbody>';

    const groupedPurchases = {};
    data.forEach(p => {
      if (!groupedPurchases[p.PurchaseID]) {
        groupedPurchases[p.PurchaseID] = {
          PurchaseID: p.PurchaseID,
          PurchaseDate: p.PurchaseDate,
          SupplierName: p.SupplierName || '',
          Products: [],
          Quantities: [],
          Costs: []
        };
      }
      groupedPurchases[p.PurchaseID].Products.push(p.ProductName || '-')
      groupedPurchases[p.PurchaseID].Quantities.push(p.detail_quantity || '')
      groupedPurchases[p.PurchaseID].Costs.push(p.detail_unit_cost || '')
    });

    Object.values(groupedPurchases).forEach(p => {
      html += `
        <tr>
          <td class="border px-2 py-1">${p.PurchaseID}</td>
          <td class="border px-2 py-1">${formatDate(p.PurchaseDate)}</td>
          <td class="border px-2 py-1">${p.Products.join('<br>')}</td>
          <td class="border px-2 py-1">${p.SupplierName}</td>
          <td class="border px-2 py-1">${p.Quantities.join('<br>')}</td>
          <td class="border px-2 py-1">${p.Costs.join('<br>')}</td>
        </tr>`;
    });
    html += '</tbody></table>';
  }
  return html;
}
