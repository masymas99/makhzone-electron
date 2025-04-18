// auth.js: handles login/register tab switching and form submission
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const loginFormDiv = document.getElementById('loginForm');
const registerFormDiv = document.getElementById('registerForm');

loginTab.addEventListener('click', () => {
  loginTab.classList.add('text-blue-600','border-b-2','border-blue-600');
  registerTab.classList.remove('text-blue-600','border-b-2','border-blue-600');
  loginFormDiv.classList.remove('hidden');
  registerFormDiv.classList.add('hidden');
});

registerTab.addEventListener('click', () => {
  registerTab.classList.add('text-blue-600','border-b-2','border-blue-600');
  loginTab.classList.remove('text-blue-600','border-b-2','border-blue-600');
  registerFormDiv.classList.remove('hidden');
  loginFormDiv.classList.add('hidden');
});

document.querySelector('#loginForm form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('loginMsg'); msg.textContent = '';
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  try {
    const res = await fetch('http://localhost:3001/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('user', JSON.stringify(data));
      window.location.href = 'dashboard.html';
    } else {
      msg.innerHTML = `<p class="text-red-600">${data.error}</p>`;
    }
  } catch (err) {
    msg.innerHTML = '<p class="text-red-600">تعذر الاتصال بالخادم.</p>';
  }
});

document.querySelector('#registerForm form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgDiv = document.getElementById('registerMsg'); msgDiv.textContent = '';
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    const res = await fetch('http://localhost:3001/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok) {
      msgDiv.innerHTML = '<p class="text-green-600">تم إنشاء الحساب بنجاح</p>';
    } else {
      msgDiv.innerHTML = `<p class="text-red-600">${data.error}</p>`;
    }
  } catch (err) {
    msgDiv.innerHTML = '<p class="text-red-600">تعذر الاتصال بالخادم.</p>';
  }
});
