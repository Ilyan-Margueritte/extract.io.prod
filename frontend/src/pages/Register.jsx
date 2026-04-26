import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Zap, Mail, Lock, User, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await axios.post(`${API_URL}/api/v1/auth/register`, {
        email,
        password,
        full_name: name
      });
      navigate('/login', { state: { message: 'Account created! Please sign in.' } });
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Try again.');
      if (import.meta.env.DEV) {
          navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-wrapper" style={{ justifyContent: 'center', background: 'radial-gradient(circle at bottom left, var(--primary-dim) 0%, transparent 40%)' }}>
      <div className="container" style={{ maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="logo" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div className="logo__icon" style={{ background: 'var(--primary)', width: '40px', height: '40px' }}>
              <Zap size={24} color="white" />
            </div>
            <span className="logo__text" style={{ fontSize: '1.5rem' }}>Extract.io</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Get started today</h1>
          <p style={{ color: 'var(--text-dim)', marginTop: '0.5rem' }}>Create your account to start extracting leads.</p>
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
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Full Name</label>
              <div className="input-wrap">
                <User className="input-icon" size={16} />
                <input 
                  type="text" 
                  className="field field--input" 
                  placeholder="John Doe" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

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
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Password</label>
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
              {loading ? <Loader2 className="spinner" size={20} /> : 'Create Account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
