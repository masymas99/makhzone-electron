// Logic for sales page
async function loadSales() {
  const res = await fetch('http://localhost:3001/api/sales');
  return await res.json();
}

export { loadSales };
