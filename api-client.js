/**
 * NURE API Client v3.0
 */

const BACKEND_URL = window.BACKEND_URL || 'https://nure-backend-06sj.onrender.com';

const API = {
  // ── BACKEND WAKE-UP (Render free tier "спит" после простоя) ──
  // Пингуем сервер заранее, чтобы реальные действия (вход, создание товара)
  // не натыкались на 30-60 сек. "холодного старта" без объяснений и не зависали.
  _awake: false,
  async wake(onStatus) {
    if (this._awake) return true;
    const start = Date.now();
    const maxWaitMs = 60000;
    let attempt = 0;
    while (Date.now() - start < maxWaitMs) {
      attempt++;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(`${BACKEND_URL}/api`, { signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) { this._awake = true; if (onStatus) onStatus('ready'); return true; }
      } catch { /* сервер ещё не отвечает — пробуем снова */ }
      if (onStatus) onStatus('waking', attempt);
      await new Promise(r => setTimeout(r, 2500));
    }
    if (onStatus) onStatus('timeout');
    return false;
  },

  // ── AUTH ──
  async register(name, email, password) {
    const data = await this._post('/api/auth/register', { name, email, password });
    if (data.token) {
      localStorage.setItem('nure_token', data.token);
      localStorage.setItem('nure_user', JSON.stringify(data.user));
    }
    return data;
  },
  async login(email, password) {
    const data = await this._post('/api/auth/login', { email, password });
    if (data.token) {
      localStorage.setItem('nure_token', data.token);
      localStorage.setItem('nure_user', JSON.stringify(data.user));
    }
    return data;
  },
  logout() {
    localStorage.removeItem('nure_token');
    localStorage.removeItem('nure_user');
    window.location.href = '/';
  },
  getUser()  { try { return JSON.parse(localStorage.getItem('nure_user')); } catch { return null; } },
  getToken() { return localStorage.getItem('nure_token'); },
  isAdmin()  { const u = this.getUser(); return u && u.role === 'admin'; },

  // ── PRODUCTS ──
  async getProducts()  { return this._get('/api/products'); },
  async getProduct(id) { return this._get(`/api/products/${id}`); },
  async createOrder(cartItems, customer = {}) {
    return this._post('/api/order', { items: cartItems, ...customer }, true);
  },

  // ── ADMIN — PRODUCTS (из Paloma365, только обогащение) ──
  async adminGetProducts() {
    return this._get('/api/admin/products', true);
  },
  async adminUpdateProduct(id, data) {
    return this._put(`/api/admin/products/${id}`, data, true);
  },
  async adminForceSync() {
    return this._post('/api/admin/sync', {}, true);
  },
  async adminUploadImages(id, files, colorKey = 'default') {
    const fd = new FormData();
    files.forEach(f => fd.append('images', f));
    fd.append('colorKey', colorKey);
    return this._fetchJSON(`/api/admin/products/${id}/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.getToken()}` },
      body: fd
    }, 40000); // фото грузятся дольше — даём больше времени
  },
  async adminDeleteImage(id, url, colorKey = 'default') {
    return this._delete(`/api/admin/products/${id}/images`, { url, colorKey }, true);
  },
  async adminGetUsers()  { return this._get('/api/admin/users', true); },
  async adminGetOrders() { return this._get('/api/admin/orders', true); },

  // ── HELPERS ──
  // Единая обёртка над fetch: таймаут, один повтор (на случай "холодного старта"
  // Render — первый запрос будит сервер, но может не успеть/упасть с 502),
  // и НИКОГДА не выбрасывает необработанное исключение — всегда возвращает
  // { success:false, error: '...' } чтобы UI мог корректно показать ошибку
  // и разблокировать кнопки вместо вечного "зависания".
  async _fetchJSON(path, options, timeoutMs = 20000) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        const res = await fetch(`${BACKEND_URL}${path}`, { ...options, signal: ctrl.signal });
        clearTimeout(timer);
        let data = null;
        try { data = await res.json(); } catch { /* пустой/не-JSON ответ */ }
        if (!res.ok) {
          return { success: false, error: (data && data.error) || `Ошибка сервера (${res.status})` };
        }
        return data || { success: true };
      } catch (err) {
        if (attempt === 0) {
          // Скорее всего сервер ещё "просыпается" — ждём и пробуем ещё раз
          await new Promise(r => setTimeout(r, 4000));
          continue;
        }
        return {
          success: false,
          error: err.name === 'AbortError'
            ? 'Сервер не отвечает (возможно, ещё запускается). Подождите и попробуйте снова.'
            : 'Нет соединения с сервером. Проверьте интернет и попробуйте снова.'
        };
      }
    }
  },
  async _get(path, auth = false) {
    return this._fetchJSON(path, {
      headers: auth ? { Authorization: `Bearer ${this.getToken()}` } : {}
    });
  },
  async _post(path, body, auth = false) {
    return this._fetchJSON(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${this.getToken()}` } : {}) },
      body: JSON.stringify(body)
    });
  },
  async _put(path, body, auth = false) {
    return this._fetchJSON(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${this.getToken()}` } : {}) },
      body: JSON.stringify(body)
    });
  },
  async _delete(path, body, auth = false) {
    return this._fetchJSON(path, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${this.getToken()}` } : {}) },
      body: JSON.stringify(body)
    });
  }
};

function formatPrice(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const PLACEHOLDER_IMG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"%3E%3Crect width="400" height="500" fill="%23ede9e3"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="14" fill="%23aaa" font-family="sans-serif"%3ENURE%3C/text%3E%3C/svg%3E';
