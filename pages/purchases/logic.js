// Logic for purchases page
async function loadPurchases() {
  const res = await fetch('http://localhost:3001/api/purchases');
  return await res.json();
}

export { loadPurchases };
