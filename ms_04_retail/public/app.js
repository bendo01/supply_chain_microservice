function getUser() {
  try { return JSON.parse(localStorage.getItem('retail_user') || 'null'); } catch { return null; }
}
function requireAuth(roles) {
  const user = getUser();
  if (!user) { window.location.href = 'login.html'; return null; }
  if (roles && !roles.includes(user.role)) {
    alert('Anda tidak memiliki akses ke halaman ini.');
    window.location.href = 'index.html';
    return null;
  }
  return user;
}
function logout() {
  localStorage.removeItem('retail_user');
  localStorage.removeItem('isLoggedIn');
  window.location.href = 'login.html';
}
function fmtRp(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n || 0));
}
function fmtDate(s) {
  if (!s) return '-';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleString('id-ID');
}
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!res.ok) {
    const err = new Error(data.message || 'Permintaan gagal');
    err.status = res.status; err.data = data; throw err;
  }
  return data;
}
function qs(id) { return document.getElementById(id); }
function renderNav(active) {
  const user = getUser();
  const links = [
    { href: 'index.html', label: 'Dashboard', key: 'dashboard', roles: ['OWNER','RETAIL_MANAGER','CASHIER'] },
    { href: 'kasir.html', label: 'Kasir (POS)', key: 'kasir', roles: ['OWNER','RETAIL_MANAGER','CASHIER'] },
    { href: 'stok.html', label: 'Stok Retail', key: 'stok', roles: ['OWNER','RETAIL_MANAGER','CASHIER'] },
    { href: 'restock.html', label: 'Permintaan Restock', key: 'restock', roles: ['OWNER','RETAIL_MANAGER'] },
  ];
  const nav = document.getElementById('app-nav');
  if (!nav) return;
  const visible = links.filter(l => !user || l.roles.includes(user.role));
  nav.innerHTML = `
    <div class="brand">ms-04 Retail</div>
    <div class="links">${visible.map(l => `<a href="${l.href}" class="${active===l.key?'active':''}">${l.label}</a>`).join('')}</div>
    <div class="userbox">${user ? `<span>${user.name} (${user.role})</span><button onclick="logout()" class="secondary small">Logout</button>` : ''}</div>
  `;
}
async function loadRetailOptions(selectId, { includeAll = false, allLabel = 'Semua Retail' } = {}) {
  const sel = qs(selectId);
  if (!sel) return [];
  const { data } = await api('/api/retails');
  const retails = (data || []).filter(r => r.is_active);
  sel.innerHTML = `${includeAll ? `<option value="">${allLabel}</option>` : ''}` +
    retails.map(r => `<option value="${r.id}">${r.name} (${r.code})</option>`).join('');
  const user = getUser();
  if (user && user.retail_id && retails.some(r => r.id === user.retail_id)) sel.value = user.retail_id;
  return retails;
}
async function loadCommodityOptions(selectId) {
  const sel = qs(selectId); if (!sel) return [];
  const { data } = await api('/api/commodities');
  const items = (data || []).filter(c => c.is_active);
  sel.innerHTML = items.map(c => `<option value="${c.id}" data-price="${c.selling_price}" data-cost="${c.cost_price}" data-name="${c.name}">${c.name} - ${fmtRp(c.selling_price)}</option>`).join('');
  return items;
}
function setStatus(id, msg, ok) {
  const el = qs(id); if (!el) return;
  el.textContent = msg;
  el.className = 'status ' + (ok === true ? 'ok' : ok === false ? 'err' : '');
}
