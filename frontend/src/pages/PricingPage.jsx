import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { CheckCircle2, Zap, ArrowRight, Loader2, CreditCard, ShieldCheck } from 'lucide-react';
import { useUser, useAuth, useClerk } from '@clerk/clerk-react';

const API_URL = import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api';

export default function PricingPage() {
  const { user } = useUser();
  const { isSignedIn } = useAuth();
  const { getToken } = useAuth();
  const { openSignIn } = useClerk();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');

  const handleSubscribe = async (plan) => {
    if (!isSignedIn) {
      openSignIn({ afterSignInUrl: '/pricing' });
      return;
    }

    try {
      setLoading(plan);
      setError('');

      const token = await getToken();
      const response = await axios.post(
        `${API_URL}/api/v1/billing/create-checkout-session?plan=${plan}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred while redirecting to payment.');
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    try {
      setLoading('portal');
      const token = await getToken();
      const response = await axios.post(
        `${API_URL}/api/v1/billing/create-portal-session`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (err) {
      setError('Impossible to access the billing portal.');
      setLoading(null);
    }
  };

  const currentPlan = user?.subscription?.plan || 'free';

  return (
    <div className="app-wrapper">
      <header className="topbar">
        <div className="topbar__inner">
          <div className="logo" onClick={() => (window.location.href = '/dashboard')} style={{ cursor: 'pointer' }}>
            <div className="logo__icon">
              <Zap size={18} color="white" />
            </div>
            <span className="logo__text">Extract.io</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {isSignedIn && <button className="btn-premium btn-premium-secondary" style={{ height: '36px', fontSize: '0.85rem' }} onClick={() => (window.location.href = '/dashboard')}>Dashboard</button>}
          </div>
        </div>
      </header>

      <main>
        {/* Glow Effects */}
        <div style={{ position: 'fixed', top: '10%', right: '10%', width: '400px', height: '400px', background: 'radial-gradient(circle, var(--primary-dim) 0%, transparent 70%)', filter: 'blur(80px)', opacity: 0.3, zIndex: -1, pointerEvents: 'none' }} />
        <div style={{ position: 'fixed', bottom: '10%', left: '10%', width: '400px', height: '400px', background: 'radial-gradient(circle, var(--secondary-dim) 0%, transparent 70%)', filter: 'blur(80px)', opacity: 0.3, zIndex: -1, pointerEvents: 'none' }} />

        <section className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="hero__eyebrow" style={{ marginBottom: '1.5rem' }}>
              <div className="dot" style={{ background: 'var(--primary)' }} /> Secure Checkout Session
            </div>
            <h1 className="hero__title" style={{ fontSize: 'clamp(32px, 5vw, 48px)', marginBottom: '1rem' }}>
              Activate Your <span className="text-gradient-primary">Access</span>
            </h1>
            <p className="hero__subtitle" style={{ marginBottom: '3rem' }}>
              Unlock the power of Extract.io and start building your lead pipeline today.
            </p>
          </motion.div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {/* Pro Plan Card */}
            <motion.div
              className={`pricing-card pricing-card--popular`}
              style={{ maxWidth: '480px', width: '100%', padding: '3rem' }}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Full Access</h3>
                {currentPlan === 'premium' ? (
                  <div className="badge" style={{ background: 'var(--success-dim)', color: 'var(--success-light)', borderColor: 'var(--success-glow)' }}>
                    ACTIVE
                  </div>
                ) : (
                  <div className="badge">MOST POPULAR</div>
                )}
              </div>

              <div className="pricing-price" style={{ marginBottom: '0.5rem', fontSize: '3.5rem' }}>
                $4.90<span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', fontWeight: 400 }}>/month</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '1rem' }}>
                Total transparency. No hidden fees. Cancel anytime.
              </p>

              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', marginBottom: '2.5rem' }}>
                <ul className="pricing-features" style={{ margin: 0 }}>
                  {[
                    'Unlimited Extractions',
                    'Emails, Phones, Social Profiles',
                    'Advanced Anti-Bot Scraping Engine',
                    'Bulk CSV / Excel Export',
                    'Priority Support Access'
                  ].map((f, i) => (
                    <li key={i} style={{ marginBottom: i === 4 ? 0 : '1rem' }}>
                      <CheckCircle2 size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {error && (
                <div className="error-banner" style={{ marginBottom: '1.5rem' }}>
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              {currentPlan === 'premium' ? (
                <button
                  onClick={handlePortal}
                  className="btn-premium btn-premium-secondary"
                  style={{ width: '100%', height: '56px', fontSize: '1.1rem' }}
                  disabled={!!loading}
                >
                  {loading === 'portal' ? <Loader2 className="spinner" /> : <><CreditCard size={20} /> Manage Subscription</>}
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe('premium')}
                  className="btn-premium btn-premium-primary"
                  style={{ width: '100%', height: '56px', fontSize: '1.1rem' }}
                  disabled={!!loading}
                >
                  {loading === 'premium' ? <Loader2 className="spinner" /> : <>Pay Now <ArrowRight size={20} /></>}
                </button>
              )}

              <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <ShieldCheck size={14} /> Secured by Stripe Payments
              </p>
            </motion.div>
          </div>

          <div style={{ marginTop: '4rem' }}>
            <button
              onClick={() => (window.location.href = '/dashboard')}
              className="btn-ghost"
              style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}
            >
              Skip for now and return to dashboard
            </button>
          </div>
        </section>
      </main>

      <footer className="footer" style={{ borderTop: '1px solid var(--border)', padding: '2rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
        © 2026 Extract.io · Trusted by 1,000+ businesses globally
      </footer>
    </div>

  );
}
