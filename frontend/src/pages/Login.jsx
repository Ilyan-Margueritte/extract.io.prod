import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Zap, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // In a real MVP, we'd hit /api/v1/auth/login
      // For this demonstration, we'll simulate or use the real endpoint if it exists
      const res = await axios.post(`${API_URL}/api/v1/auth/login`, {
        username: email, // FastAPI often uses username/password for OAuth2
        password: password
      });
      
      localStorage.setItem('token', res.data.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid credentials. Please try again.');
      // Simulate login for demo if backend not running
      if (import.meta.env.DEV) {
        localStorage.setItem('token', 'fake-dev-token');
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-wrapper" style={{ justifyContent: 'center', background: 'radial-gradient(circle at top right, var(--primary-dim) 0%, transparent 40%)' }}>
      <div className="container" style={{ maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="logo" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div className="logo__icon" style={{ background: 'var(--primary)', width: '40px', height: '40px' }}>
              <Zap size={24} color="white" />
            </div>
            <span className="logo__text" style={{ fontSize: '1.5rem' }}>Extract.io</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Welcome back</h1>
          <p style={{ color: 'var(--text-dim)', marginTop: '0.5rem' }}>Sign in to manage your lead lists.</p>
        </div>

        <div className="panel animate-in" style={{ padding: '2rem' }}>
          {error && (
            <div className="error-banner" style={{ marginBottom: '1.5rem' }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Email Address</label>
              <div className="input-wrap">
                <Mail className="input-icon" size={16} />
                <input 
                  type="email" 
                  className="field field--input" 
                  placeholder="name@company.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Password</label>
                <a href="#" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none' }}>Forgot?</a>
              </div>
              <div className="input-wrap">
                <Lock className="input-icon" size={16} />
                <input 
                  type="password" 
                  className="field field--input" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-premium btn-premium-primary" 
              style={{ width: '100%', padding: '0.75rem' }}
              disabled={loading}
            >
              {loading ? <Loader2 className="spinner" size={20} /> : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}
