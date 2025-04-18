// View for sales page
export function renderSales(data) {
  let html = '<div class="flex justify-between items-center mb-4">'
    + '<h2 class="text-2xl">قائمة الفواتير</h2>'
    + '<button id="addSaleBtn" class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">+ إنشاء فاتورة</button>'
  + '</div>';

  if (!data || data.length === 0) {
    html += '<p>لا توجد فواتير.</p>';
  } else {
    html += '<table class="min-w-full bg-white border">';
    html += '<thead><tr><th class="border px-2 py-1">ID</th><th class="border px-2 py-1">التاجر</th><th class="border px-2 py-1">التاريخ</th><th class="border px-2 py-1">الإجمالي</th><th class="border px-2 py-1">الإجراءات</th></tr></thead>';
    html += '<tbody>';
    data.forEach(s => {
      html += `<tr>
        <td class="border px-2 py-1">${s.SaleID}</td>
        <td class="border px-2 py-1">${s.trader?.TraderName || '-'}</td>
        <td class="border px-2 py-1">${formatDate(s.SaleDate)}</td>
        <td class="border px-2 py-1">${s.TotalAmount}</td>
        <td class="border px-2 py-1 space-x-2">
          <button class="view-sale text-blue-600" data-id="${s.SaleID}">عرض</button>
          <button class="edit-sale text-green-600" data-id="${s.SaleID}">تعديل</button>
          <button class="delete-sale text-red-600" data-id="${s.SaleID}">حذف</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
  }
  return html;
}
