const API_BASE = '/api';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  // Auth
  register: (email, password) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),

  login: (email, password) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  getMe: () => apiFetch('/auth/me'),

  // Subscription
  getPlans: () => apiFetch('/subscription/plans'),

  getStatus: () => apiFetch('/subscription/status'),

  createCheckout: (planId) =>
    apiFetch('/subscription/create-checkout', { method: 'POST', body: JSON.stringify({ planId }) }),

  openPortal: () =>
    apiFetch('/subscription/portal', { method: 'POST' }),

  cancelSubscription: () =>
    apiFetch('/subscription/cancel', { method: 'POST' }),
};
