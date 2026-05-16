import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import {
  Key, Plus, Trash2, Copy, CheckCircle2,
  BarChart3, Eye, EyeOff, Activity
} from 'lucide-react';

const API_URL = import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState(null);
  const [copied, setCopied] = useState(null);
  const [showSecret, setShowSecret] = useState(false);
  const [stats, setStats] = useState([]);
  const [showStats, setShowStats] = useState(false);
  const { getToken } = useAuth();

  const fetchKeys = async () => {
    try {
      const token = await getToken();
      const res = await axios.get(`${API_URL}/api/v1/api-keys`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setKeys(res.data);
    } catch (err) {
      console.error('Failed to fetch API keys', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = await getToken();
      const res = await axios.get(`${API_URL}/api/v1/api-keys/stats/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const token = await getToken();
      const res = await axios.post(`${API_URL}/api/v1/api-keys`, {
        name: name.trim() || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewKeySecret(res.data);
      setName('');
      setShowForm(false);
      setShowSecret(true);
      fetchKeys();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create API key');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this API key? This cannot be undone.')) return;
    try {
      const token = await getToken();
      await axios.delete(`${API_URL}/api/v1/api-keys/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchKeys();
    } catch (err) {
      alert('Failed to delete API key');
    }
  };

  const handleToggle = async (id) => {
    try {
      const token = await getToken();
      await axios.post(`${API_URL}/api/v1/api-keys/${id}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchKeys();
    } catch (err) {
      alert('Failed to toggle API key');
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return <div className="panel" style={{ padding: '3rem', textAlign: 'center' }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>API Keys</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            Use these keys to authenticate API requests via <code style={{ background: 'var(--surface-high)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>X-API-Key</code> header
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-premium btn-premium-secondary" onClick={() => { setShowStats(!showStats); if (!showStats) fetchStats(); }} style={{ height: '38px', padding: '0 1rem', fontSize: '0.85rem' }}>
            <BarChart3 size={14} /> Stats
          </button>
          <button className="btn-premium btn-premium-primary" onClick={() => setShowForm(!showForm)} style={{ height: '38px', padding: '0 1.25rem', fontSize: '0.85rem' }}>
            <Plus size={14} /> {showForm ? 'Cancel' : 'New Key'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Key Name (optional)</label>
            <input className="field field--input" type="text" placeholder="e.g. Production, My App" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <button type="submit" className="btn-premium btn-premium-primary" style={{ padding: '0.6rem 1.5rem' }}>
            <Plus size={14} /> Generate API Key
          </button>
        </form>
      )}

      {newKeySecret && showSecret && (
        <div className="panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', border: '2px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <CheckCircle2 size={18} color="var(--success)" />
            <strong style={{ fontSize: '1rem' }}>Key Generated — Copy it now!</strong>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--error)', marginBottom: '0.75rem' }}>
            You won't be able to see the full key again.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--surface-high)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <code style={{ fontSize: '1rem', flex: 1, wordBreak: 'break-all' }}>{newKeySecret.secret_key}</code>
            <button className="btn-icon" onClick={() => copyToClipboard(newKeySecret.secret_key, 'new-key')} style={{ flexShrink: 0 }}>
              {copied === 'new-key' ? <CheckCircle2 size={16} color="var(--success)" /> : <Copy size={16} />}
            </button>
          </div>
          <button className="btn btn-secondary" onClick={() => { setNewKeySecret(null); setShowSecret(false); }} style={{ marginTop: '0.75rem', padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}>
            Dismiss
          </button>
        </div>
      )}

      {keys.length === 0 ? (
        <div className="panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
          <Key size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <p>No API keys yet. Generate one to use the public API.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {keys.map(key => (
            <div key={key.id} className="panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <code style={{ fontSize: '0.9rem', fontWeight: 600 }}>{key.key_prefix}...</code>
                    <span className={`status-badge status-badge--${key.is_active ? 'completed' : 'failed'}`} style={{ fontSize: '0.7rem' }}>
                      {key.is_active ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </div>
                  {key.name && <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>{key.name}</div>}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                    Created {new Date(key.created_at).toLocaleDateString()}
                    {key.last_used && <> · Last used {new Date(key.last_used).toLocaleString()}</>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn-icon" onClick={() => handleToggle(key.id)} title={key.is_active ? 'Disable' : 'Enable'} style={{ width: '34px', height: '34px' }}>
                    {key.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button className="btn-icon btn-danger" onClick={() => handleDelete(key.id)} title="Delete" style={{ width: '34px', height: '34px' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showStats && (
        <div className="panel" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={16} /> Usage Statistics
          </h3>
          {stats.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No usage data yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {stats.map(s => (
                <div key={s.id} style={{ padding: '1rem', background: 'var(--surface-high)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <code style={{ fontWeight: 600 }}>{s.key_prefix}...</code>
                      {s.name && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '0.5rem' }}>({s.name})</span>}
                    </div>
                    <span className={`status-badge status-badge--${s.is_active ? 'completed' : 'failed'}`} style={{ fontSize: '0.7rem' }}>
                      {s.is_active ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Total Calls</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{s.total_calls}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Errors</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: s.total_errors > 0 ? 'var(--error)' : 'inherit' }}>{s.total_errors}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Last Used</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s.last_used ? new Date(s.last_used).toLocaleDateString() : 'Never'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
