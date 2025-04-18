// Logic for traders page
async function loadTraders() {
  const res = await fetch('http://localhost:3001/api/traders');
  return await res.json();
}

export { loadTraders };
