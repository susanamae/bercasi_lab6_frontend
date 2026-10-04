import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const SESSION_KEY = 'bercasi-stockroom-session';
const emptyForm = { product_name: '', description: '', price: '', quantity: '' };

function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  });
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [login, setLogin] = useState({ identifier: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function request(path, options = {}, token = session?.access_token) {
    const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || result.message || 'Request failed.');
    return result;
  }

  useEffect(() => {
    if (!session?.access_token) return;
    let active = true;
    request('/api/products')
      .then((result) => {
        if (active) {
          setProducts(result.data || []);
          setError('');
        }
      })
      .catch((reason) => {
        if (!active) return;
        if (reason.message === 'Unauthorized') clearSession();
        else setError(reason.message);
      });
    return () => { active = false; };
  }, [session?.access_token]);

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setProducts([]);
  }

  async function submitLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(login),
      }, null);
      const nextSession = { ...result.tokens, user: result.user };
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setNotice('');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitProduct(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const path = editingId ? `/api/products/${editingId}` : '/api/products';
      await request(path, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({ ...form, price: Number(form.price), quantity: Number(form.quantity) }),
      });
      const result = await request('/api/products');
      setProducts(result.data || []);
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setNotice(editingId ? 'Product updated.' : 'Product added.');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  function editProduct(product) {
    setEditingId(product.id);
    setForm({
      product_name: product.product_name,
      description: product.description || '',
      price: product.price,
      quantity: product.quantity,
    });
    setShowForm(true);
    setNotice('');
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete ${product.product_name}?`)) return;
    setError('');
    try {
      await request(`/api/products/${product.id}`, { method: 'DELETE' });
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setNotice('Product deleted.');
    } catch (reason) {
      setError(reason.message);
    }
  }

  async function logout() {
    try {
      await request('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: session?.refresh_token }),
      });
    } catch {
      // Clear the local session even if the API is temporarily unreachable.
    }
    clearSession();
    setNotice('');
  }

  function openNewProduct() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setNotice('');
    setError('');
  }

  if (!session?.access_token) {
    return (
      <main className="login-layout">
        <section className="login-story">
          <div className="story-topline"><span className="logo-mark" aria-hidden="true">B</span><span>Bercasi</span></div>
          <div className="story-copy"><p className="eyebrow">OPERATIONS CONTROL</p><h1>Keep every item<br /><em>within reach.</em></h1><p>One calm command center for the products that keep your work moving.</p></div>
          <div className="story-footer"><span>STOCKROOM / 01</span><span>EST. 2026</span></div>
        </section>
        <section className="login-panel">
          <p className="panel-kicker">Welcome back</p>
          <h2>Sign in to your<br />stockroom.</h2>
          <p className="intro">Access your product operations dashboard.</p>
          {error && <p className="message error" role="alert">{error}</p>}
          <form className="stack-form" onSubmit={submitLogin}>
            <label>Username or email<input autoComplete="username" placeholder="admin3" value={login.identifier} onChange={(event) => setLogin({ ...login, identifier: event.target.value })} required /></label>
            <label>Password<input type="password" autoComplete="current-password" placeholder="admin000" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} required /></label>
            <button className="button primary full" disabled={busy}>{busy ? 'Signing in...' : 'Enter workspace'}<span aria-hidden="true">-&gt;</span></button>
          </form>
          <p className="security-note"><span className="status-dot" /> Secure workspace access</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#products"><span className="logo-mark small" aria-hidden="true">B</span><span>Bercasi<span className="brand-light"> / Stockroom</span></span></a>
        <div className="account"><span className="avatar">{(session.user?.username || 'A').slice(0, 1).toUpperCase()}</span><span className="account-name">{session.user?.username || 'Account'}</span><button className="button quiet" onClick={logout}>Log out</button></div>
      </header>

      <section className="content" id="products">
        <div className="heading-row">
          <div><p className="eyebrow">OVERVIEW / STOCKROOM</p><h1>Product inventory</h1><p className="intro">A clear view of everything currently in your operation.</p></div>
          <button className="button primary" onClick={openNewProduct}><span aria-hidden="true">+</span> Add product</button>
        </div>

        <div className="metric-grid">
          <div className="metric-card accent"><span className="metric-label">Total products</span><strong>{products.length.toString().padStart(2, '0')}</strong><span className="metric-detail">Active catalog items</span></div>
          <div className="metric-card"><span className="metric-label">Units on hand</span><strong>{products.reduce((total, product) => total + Number(product.quantity || 0), 0).toLocaleString()}</strong><span className="metric-detail">Across all products</span></div>
          <div className="metric-card"><span className="metric-label">Catalog value</span><strong>${products.reduce((total, product) => total + Number(product.price || 0) * Number(product.quantity || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span className="metric-detail">Based on current price</span></div>
        </div>

        {notice && <p className="message success" role="status">{notice}</p>}
        {error && <p className="message error" role="alert">{error}</p>}

        {showForm && (
          <form className="product-form" onSubmit={submitProduct}>
            <div className="form-heading"><div><p className="eyebrow">PRODUCT DETAILS</p><h2>{editingId ? 'Edit product' : 'Add a product'}</h2></div><button className="button quiet" type="button" onClick={() => setShowForm(false)}>Cancel</button></div>
            <label>Product name<input maxLength="100" value={form.product_name} onChange={(event) => setForm({ ...form, product_name: event.target.value })} required /></label>
            <label>Description<textarea rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            <div className="form-grid">
              <label>Price<input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label>
              <label>Quantity<input type="number" min="0" step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required /></label>
            </div>
            <button className="button primary" disabled={busy}>{busy ? 'Saving...' : editingId ? 'Save changes' : 'Create product'}<span aria-hidden="true">-&gt;</span></button>
          </form>
        )}

        <div className="table-wrap">
          <table>
            <thead><tr><th>Product</th><th>Unit price</th><th>Quantity</th><th>Added</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td><strong>{product.product_name}</strong>{product.description && <span className="description">{product.description}</span>}</td>
                  <td>${Number(product.price).toFixed(2)}</td>
                  <td><span className={Number(product.quantity) === 0 ? 'quantity empty' : 'quantity'}>{product.quantity}</span></td>
                  <td>{product.created_at ? new Date(product.created_at).toLocaleDateString() : '—'}</td>
                  <td className="actions"><button className="button quiet" onClick={() => editProduct(product)}>Edit</button><button className="button danger" onClick={() => deleteProduct(product)}>Delete</button></td>
                </tr>
              ))}
              {products.length === 0 && <tr><td className="empty-state" colSpan="5">No products yet. Add one to get started.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
