// src/modules/storage.js
const NS = 'cc_';

export function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function set(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch {}
}

export function remove(key) {
  try {
    localStorage.removeItem(NS + key);
  } catch {}
}

export default { get, set, remove };
