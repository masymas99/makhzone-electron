// View for expenses page
export function renderExpenses(data) {
  let html = '<h2 class="text-2xl mb-4">المصروفات</h2>';
  html += '<table class="min-w-full bg-white border"><thead><tr><th class="border px-2 py-1">ID</th><th class="border px-2 py-1">الوصف</th><th class="border px-2 py-1">المبلغ</th><th class="border px-2 py-1">التاريخ</th></tr></thead><tbody>';

  if (data && data.length) {
    data.forEach(e => {
      html += `<tr>
        <td class="border px-2 py-1">${e.id}</td>
        <td class="border px-2 py-1">${e.description}</td>
        <td class="border px-2 py-1">${e.Amount}</td>
        <td class="border px-2 py-1">${e.ExpenseDate}</td>
      </tr>`;
    });
  } else {
    html += '<tr><td colspan="4" class="text-center py-2">لا توجد بيانات</td></tr>';
  }

  html += '</tbody></table>';
  return html;
}
