/**
 * NURE API Client v3.0
 */

const BACKEND_URL = window.BACKEND_URL || 'https://nure-backend-06sj.onrender.com';

const API = {
  // ── AUTH ──
  async register(name, email, password) {
    return this._post('/api/auth/register', { name, email, password });
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

  // ── ADMIN — PRODUCTS ──
  async adminGetProducts() {
    return this._get('/api/admin/products', true);
  },
  async adminCreateProduct(data) {
    return this._post('/api/admin/products', data, true);
  },
  async adminUpdateProduct(id, data) {
    return this._put(`/api/admin/products/${id}`, data, true);
  },
  async adminDeactivateProduct(id) {
    return this._post(`/api/admin/products/${id}/deactivate`, {}, true);
  },
  async adminActivateProduct(id) {
    return this._post(`/api/admin/products/${id}/activate`, {}, true);
  },
  async adminUploadImages(id, files, colorKey = 'default') {
    const fd = new FormData();
    files.forEach(f => fd.append('images', f));
    fd.append('colorKey', colorKey);
    const res = await fetch(`${BACKEND_URL}/api/admin/products/${id}/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.getToken()}` },
      body: fd
    });
    return res.json();
  },
  async adminDeleteImage(id, url, colorKey = 'default') {
    return this._delete(`/api/admin/products/${id}/images`, { url, colorKey }, true);
  },
  async adminGetUsers()  { return this._get('/api/admin/users', true); },
  async adminGetOrders() { return this._get('/api/admin/orders', true); },

  // ── HELPERS ──
  async _get(path, auth = false) {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      headers: auth ? { Authorization: `Bearer ${this.getToken()}` } : {}
    });
    return res.json();
  },
  async _post(path, body, auth = false) {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${this.getToken()}` } : {}) },
      body: JSON.stringify(body)
    });
    return res.json();
  },
  async _put(path, body, auth = false) {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${this.getToken()}` } : {}) },
      body: JSON.stringify(body)
    });
    return res.json();
  },
  async _delete(path, body, auth = false) {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${this.getToken()}` } : {}) },
      body: JSON.stringify(body)
    });
    return res.json();
  }
};

function formatPrice(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const PLACEHOLDER_IMG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"%3E%3Crect width="400" height="500" fill="%23ede9e3"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="14" fill="%23aaa" font-family="sans-serif"%3ENURE%3C/text%3E%3C/svg%3E';
