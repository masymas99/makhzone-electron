// View for traders page
export function renderTraders(data) {
  let html = '<div class="flex justify-between items-center mb-4">'
    + '<h2 class="text-2xl">التجار</h2>'
    + '<button id="addTraderBtn" class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">+ إضافة تاجر</button>'
  + '</div>';

  html += '<table class="min-w-full bg-white border">';
  html += '<thead><tr><th class="border px-2 py-1">ID</th><th class="border px-2 py-1">الاسم</th><th class="border px-2 py-1">الرصيد الحالي</th><th class="border px-2 py-1">الإجراءات</th></tr></thead><tbody>';

  if (data && data.length) {
    data.forEach(t => {
      const balanceClass = t.balance < 0 ? 'text-red-600' : 'text-green-600';
      const balanceSign = t.balance < 0 ? '-' : '+';
      const balanceValue = Math.abs(t.balance);

      html += `<tr>
        <td class="border px-2 py-1">${t.TraderID}</td>
        <td class="border px-2 py-1">${t.TraderName}</td>
        <td class="border px-2 py-1 ${balanceClass}">${balanceSign}${balanceValue}</td>
        <td class="border px-2 py-1">
          <button data-id="${t.TraderID}" class="view-trader bg-blue-500 text-white px-2 py-1 rounded mr-1">عرض</button>
          <button data-id="${t.TraderID}" class="manual-payment bg-purple-500 text-white px-2 py-1 rounded mr-1">إضافة دفعة</button>
          <button data-id="${t.TraderID}" class="edit-trader bg-yellow-400 px-2 py-1 rounded mr-1">تعديل</button>
          <button data-id="${t.TraderID}" class="delete-trader bg-red-500 text-white px-2 py-1 rounded">حذف</button>
        </td>
      </tr>`;
    });
  } else {
    html += '<tr><td colspan="4" class="text-center py-2">لا توجد بيانات</td></tr>';
  }

  html += '</tbody></table>';
  return html;
}
