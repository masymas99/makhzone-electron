// View for products page
export function renderProducts(data) {
  let html = '<div class="flex justify-between items-center mb-4">'
    + '<h2 class="text-2xl">المنتجات</h2>'
    + '<button id="addProductBtn" class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">+ إضافة منتج</button>'
  + '</div>';

  html += '<table class="min-w-full bg-white border">';
  html += '<thead><tr><th class="border px-2 py-1">ID</th><th class="border px-2 py-1">الاسم</th><th class="border px-2 py-1">الصنف</th><th class="border px-2 py-1">الكمية</th><th class="border px-2 py-1">سعر البيع</th><th class="border px-2 py-1">سعر التكلفة</th><th class="border px-2 py-1">الإجراءات</th></tr></thead>';
  html += '<tbody>';

  if (data && data.length) {
    data.forEach(p => {
      html += `<tr>
        <td class="border px-2 py-1">${p.ProductID}</td>
        <td class="border px-2 py-1">${p.ProductName}</td>
        <td class="border px-2 py-1">${p.Category}</td>
        <td class="border px-2 py-1">${p.StockQuantity}</td>
        <td class="border px-2 py-1">${p.UnitPrice.toFixed(2)}</td>
        <td class="border px-2 py-1">${p.UnitCost ? p.UnitCost.toFixed(2) : '-'}</td>
        <td class="border px-2 py-1">
          <button data-id="${p.ProductID}" class="edit-product bg-yellow-400 px-2 py-1 rounded mr-1">تعديل</button>
          <button data-id="${p.ProductID}" class="delete-product bg-red-500 text-white px-2 py-1 rounded">حذف</button>
        </td>
      </tr>`;
    });
  } else {
    html += '<tr><td colspan="7" class="text-center py-2">لا توجد بيانات</td></tr>';
  }

  html += '</tbody></table>';
  return html;
}
