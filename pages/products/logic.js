// Logic for products page
async function loadProducts() {
  const res = await fetch('http://localhost:3001/api/products');
  return await res.json();
}

export { loadProducts };
