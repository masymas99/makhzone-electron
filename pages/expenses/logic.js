// Logic for expenses page
async function loadExpenses() {
  const res = await fetch('http://localhost:3001/api/expenses');
  return await res.json();
}

export { loadExpenses };
