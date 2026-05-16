import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { CheckCircle2, Zap, ArrowRight, Loader2, CreditCard, ShieldCheck, AlertCircle } from 'lucide-react';
import { useUser, useAuth, useClerk } from '@clerk/clerk-react';

const API_URL = '/api';

export default function PricingPage() {
  const { user } = useUser();
  const { isSignedIn } = useAuth();
  const { getToken } = useAuth();
  const { openSignIn } = useClerk();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [currentPlan, setCurrentPlan] = useState('free');

  useEffect(() => {
    async function fetchPlan() {
      if (!isSignedIn) return;
      try {
        const token = await getToken();
        const res = await axios.get(`${API_URL}/v1/users/me?t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        setCurrentPlan(res.data.subscription?.plan || 'free');
      } catch (e) {
        setCurrentPlan('free');
      }
    }
    fetchPlan();
  }, [isSignedIn, getToken]);

  const handleSubscribe = async (plan) => {
    if (!isSignedIn) {
      openSignIn({ afterSignInUrl: '/pricing' });
      return;
    }

    try {
      setLoading(plan);
      setError('');

      const token = await getToken();
      const params = new URLSearchParams({ plan: `premium_${billingCycle}` });
      if (couponCode.trim()) {
        params.append('coupon_code', couponCode.trim());
      }
      const response = await axios.post(
        `${API_URL}/v1/billing/create-checkout-session?${params}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (err) {
      const errorDetail = err.response?.data?.detail || err.message || 'An error occurred while redirecting to payment.';
      console.error("Checkout error:", err.response?.data || err);
      setError(errorDetail);
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    try {
      setLoading('portal');
      const token = await getToken();
      const response = await axios.post(
        `${API_URL}/v1/billing/create-portal-session`,
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

  const [billingCycle, setBillingCycle] = useState('monthly');

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
          <div className="topbar__actions">
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
            <div className="hero__eyebrow">
              <div className="dot" style={{ background: 'var(--primary)' }} /> Secure Checkout Session
            </div>
            <h1 className="hero__title">
              Activate Your <span className="text-gradient-primary">Access</span>
            </h1>
            <p className="hero__subtitle" style={{ marginBottom: '3rem' }}>
              Unlock the power of Extract.io and start building your lead pipeline today.
            </p>
          </motion.div>

          <div className="pricing-selector">
            <motion.div
              className={`pricing-card ${billingCycle === 'monthly' ? 'pricing-card--selected' : ''}`}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              onClick={() => setBillingCycle('monthly')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Mensuel</h3>
                {billingCycle === 'monthly' && <span className="badge">SELECTED</span>}
              </div>
              <div className="pricing-price">
                4,90€<span>/month</span>
              </div>
            </motion.div>

            <motion.div
              className={`pricing-card ${billingCycle === 'yearly' ? 'pricing-card--selected' : ''}`}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              onClick={() => setBillingCycle('yearly')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Annuel</h3>
                <span className="badge badge--saving">-10%</span>
              </div>
              <div className="pricing-price">
                44,90€<span>/year</span>
              </div>
            </motion.div>
          </div>

          {/* Features & CTA Card */}
          <motion.div
            className="pricing-card pricing-card--popular pricing-cta"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="pricing-features-box">
              <ul className="pricing-features">
                {[
                  'Unlimited Extractions',
                  'Emails, Phones, Social Profiles',
                  'Advanced Anti-Bot Scraping Engine',
                  'Bulk CSV / Excel Export',
                  'Priority Support Access'
                ].map((f, i) => (
                  <li key={i}>
                    <CheckCircle2 size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {error && (
              <div className="error-banner" style={{ marginBottom: '1.5rem' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <input
                type="text"
                className="pricing-coupon"
                placeholder="Code partenaire"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              />
            </div>

            {currentPlan === 'premium_monthly' || currentPlan === 'premium_yearly' ? (
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
                onClick={() => handleSubscribe(`premium_${billingCycle}`)}
                className="btn-premium btn-premium-primary"
                style={{ width: '100%', height: '56px', fontSize: '1.1rem' }}
                disabled={!!loading}
              >
                {loading ? <Loader2 className="spinner" /> : <>Pay Now <ArrowRight size={20} /></>}
              </button>
            )}

            <p className="pricing-secured">
              <ShieldCheck size={14} /> Secured by Stripe Payments
            </p>
          </motion.div>

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
