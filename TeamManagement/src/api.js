const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Thin fetch wrapper.
 * - always sends the session cookie (HTTP-only, set by the backend)
 * - returns parsed JSON
 * - throws a structured Error on non-2xx: { status, message, errors }
 */
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    });
  } catch {
    throw Object.assign(new Error('Cannot reach the server. Is the backend running?'), {
      status: 0,
    });
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body (204) */
  }

  if (!res.ok) {
    const err = new Error(json?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.errors = json?.errors;
    throw err;
  }
  return json;
}

export default api;
