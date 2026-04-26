import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, Shield, Globe, ArrowRight, CheckCircle2, 
  Layers, Search, Download, BarChart3, Users
} from 'lucide-react';

import { useAuth, UserButton, useClerk, useUser } from '@clerk/clerk-react';

const Nav = () => {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { openSignIn } = useClerk();

  const handleSignIn = () => {
    openSignIn({ afterSignInUrl: '/pricing' });
  };

  const handleGetStarted = () => {
    if (isSignedIn) {
      navigate('/pricing');
    } else {
      openSignIn({ afterSignInUrl: '/pricing' });
    }
  };

  return (
    <nav className="topbar">
      <div className="topbar__inner">
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="logo__icon">
            <Zap size={18} color="white" />
          </div>
          <span className="logo__text" style={{ fontSize: '1.25rem', fontWeight: 700 }}>Extract.io</span>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <a href="#features" className="nav-link" style={{ margin: 0, padding: '0.5rem', fontSize: '0.9rem' }}>Features</a>
          <a href="#pricing" className="nav-link" style={{ margin: 0, padding: '0.5rem', fontSize: '0.9rem' }}>Pricing</a>

          {isSignedIn ? (
            <>
              <button
                className="btn-premium btn-premium-secondary"
                style={{ fontSize: '0.9rem', padding: '0.5rem 1.25rem' }}
                onClick={() => {
                  const plan = user?.publicMetadata?.plan;
                  if (plan === 'premium' || plan === 'PREMIUM') {
                    navigate('/dashboard');
                  } else {
                    navigate('/pricing');
                  }
                }}
              >
                {user?.publicMetadata?.plan === 'premium' || user?.publicMetadata?.plan === 'PREMIUM' ? 'Dashboard' : 'Upgrade Now'}
              </button>
              <UserButton afterSignOutUrl="/" />
            </>
          ) : (
            <>
              <button
                className="btn-premium btn-premium-secondary"
                style={{ fontSize: '0.9rem', padding: '0.5rem 1.25rem' }}
                onClick={handleSignIn}
              >
                Sign In
              </button>
              <button
                className="btn-premium btn-premium-primary"
                style={{ fontSize: '0.9rem', padding: '0.5rem 1.25rem' }}
                onClick={handleGetStarted}
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

const FeatureCard = ({ icon, title, desc, delay }) => (
  <motion.div
    className="feature-card"
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    whileHover={{ y: -6, boxShadow: '0 12px 40px rgba(99, 102, 241, 0.15)' }}
  >
    <div className="feature-icon" style={{ background: 'var(--gradient-subtle)', color: 'var(--primary)', border: '1px solid var(--border-primary)' }}>
      {icon}
    </div>
    <h3 className="feature-title" style={{ fontSize: '1.1rem', fontWeight: 600 }}>{title}</h3>
    <p className="feature-desc" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{desc}</p>
  </motion.div>
);

const PricingCard = ({ title, price, features, popular, delay }) => (
  <motion.div
    className={`pricing-card ${popular ? 'pricing-card--popular' : ''}`}
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6, delay }}
  >
    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>{title}</h3>
    <div className="pricing-price" style={{ marginBottom: '1.5rem' }}>
      ${price}<span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '1rem' }}>/month</span>
    </div>
    <ul className="pricing-features" style={{ marginBottom: '2rem' }}>
      {features.map((f, i) => (
        <li key={i} style={{ marginBottom: '0.875rem' }}>
          <CheckCircle2 size={18} color={popular ? 'var(--primary)' : 'var(--success)'} style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{f}</span>
        </li>
      ))}
    </ul>
    <button className={`btn-premium ${popular ? 'btn-premium-primary' : 'btn-premium-secondary'}`} style={{ marginTop: 'auto' }}>
      Choose Plan
    </button>
  </motion.div>
);

export default function LandingPage() {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { openSignIn } = useClerk();

  React.useEffect(() => {
    // Si l'utilisateur est chargé et connecté
    if (isLoaded && isSignedIn && user) {
      const plan = user.publicMetadata?.plan;
      // Redirection immédiate vers pricing s'il n'est pas PREMIUM
      if (plan !== 'premium' && plan !== 'PREMIUM') {
        navigate('/pricing');
      } else {
        navigate('/dashboard');
      }
    }
  }, [isLoaded, isSignedIn, user, navigate]);

  const handleCTA = () => {
    if (isSignedIn) {
      navigate('/pricing');
    } else {
      openSignIn({ afterSignInUrl: '/pricing' });
    }
  };

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sign-in') === 'true' && !isSignedIn) {
      openSignIn({ afterSignInUrl: '/pricing' });
    }
  }, [isSignedIn, openSignIn]);

  return (
    <div className="app-wrapper">
      <Nav />
      
      <main>
        {/* Hero Section */}
        <section className="hero container" style={{ minHeight: '85vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="hero__eyebrow">
              <div className="dot" style={{ background: 'var(--success)', boxShadow: '0 0 12px var(--success-glow)' }} />
              V2.0 is now live — Experience the power
            </div>
            <h1 className="heading-hero">
              Scale your lead gen with <br />
              <span className="text-gradient-primary">Hybrid Extraction</span>
            </h1>
            <p className="hero__subtitle" style={{ fontSize: '1.25rem', maxWidth: '650px', marginBottom: '2.5rem', color: 'var(--text-secondary)' }}>
              The most advanced e-commerce contact scraper. Extract emails, phone numbers, and social profiles in seconds from any Shopify, WooCommerce, or custom store.
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              {!isSignedIn ? (
                <>
                  <button
                    className="btn-premium btn-premium-primary"
                    style={{ padding: '1rem 2.5rem', fontSize: '1.1rem' }}
                    onClick={() => navigate('/register')}
                  >
                    Get Started <ArrowRight size={20} />
                  </button>
                  <button
                    className="btn-premium btn-premium-secondary"
                    style={{ padding: '1rem 2.5rem', fontSize: '1.1rem' }}
                  >
                    View Demo
                  </button>
                </>
              ) : (
                <button
                  className="btn-premium btn-premium-primary"
                  style={{ padding: '1rem 2.5rem', fontSize: '1.1rem' }}
                  onClick={() => navigate('/dashboard')}
                >
                  Go to Dashboard <ArrowRight size={20} />
                </button>
              )}
            </div>
          </motion.div>

          {/* Dashboard Preview Mockup */}
          <motion.div
            style={{ marginTop: '6rem', position: 'relative' }}
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div style={{
              background: 'var(--surface-glass-heavy)',
              backdropFilter: 'blur(20px)',
              borderRadius: '24px 24px 0 0',
              padding: '1.25rem',
              border: '1px solid var(--border)',
              boxShadow: '0 -30px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)'
            }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#ff5f56', boxShadow: '0 0 8px rgba(255,95,86,0.4)' }} />
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#ffbd2e', boxShadow: '0 0 8px rgba(255,189,46,0.4)' }} />
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#27c93f', boxShadow: '0 0 8px rgba(39,201,63,0.4)' }} />
              </div>
              <div style={{ height: '320px', background: 'var(--bg)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ textAlign: 'center' }}>
                  <div className="logo__icon" style={{ width: '64px', height: '64px', margin: '0 auto 1rem', background: 'var(--gradient-primary)', boxShadow: '0 0 40px var(--primary-glow)' }}>
                    <Zap size={32} color="white" />
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Dashboard Preview</p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features Grid */}
        <section id="features" className="container" style={{ padding: '120px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-1px' }}>Engineered for Results</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem', lineHeight: 1.7 }}>Everything you need to build high-quality lead lists without the manual work.</p>
          </div>

          <div className="features">
            <FeatureCard 
              icon={<Globe size={24} />} 
              title="Global Domain Scan" 
              desc="Scan any URL, from niche boutiques to massive marketplaces." 
              delay={0.1}
            />
            <FeatureCard 
              icon={<Layers size={24} />} 
              title="Bulk Processing" 
              desc="Upload thousands of URLs and let our engine process them in parallel." 
              delay={0.2}
            />
            <FeatureCard 
              icon={<Search size={24} />} 
              title="Deep Crawl" 
              desc="Our engine clicks, scrolls, and navigates as a real user would." 
              delay={0.3}
            />
            <FeatureCard 
              icon={<Download size={24} />} 
              title="CSV & Lead Export" 
              desc="One-click export to clean CSV, ready for your CRM or outreach tool." 
              delay={0.4}
            />
            <FeatureCard 
              icon={<Shield size={24} />} 
              title="Anti-Bot Bypass" 
              desc="Smart headers and rotating proxies ensure you never get blocked." 
              delay={0.5}
            />
            <FeatureCard 
              icon={<Zap size={24} />} 
              title="Ultra Fast Fallback" 
              desc="Fast requests first, Playwright only when absolutely necessary." 
              delay={0.6}
            />
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="container" style={{ padding: '120px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-1px' }}>Activate Your Access</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.7 }}>Instant one-time access for unlimited extraction power.</p>
          </div>

          <div className="pricing-grid" style={{ display: 'flex', justifyContent: 'center' }}>
            <PricingCard 
              title="Full Access" 
              price="4.90" 
              features={[
                'Unlimited Extractions', 
                'Emails & Phone Numbers', 
                'Social Profiles', 
                'Bulk Scan (CSV Import)', 
                'Premium Anti-Bot Engine'
              ]} 
              popular={true} 
              delay={0.1}
            />
          </div>
        </section>

        {/* CTA Section */}
        <section className="container" style={{ padding: '120px 24px' }}>
          <motion.div
            className="glass"
            style={{ borderRadius: '28px', padding: '4rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div style={{ position: 'absolute', top: '-40%', left: '-30%', width: '160%', height: '160%', background: 'radial-gradient(circle, var(--primary-surface-strong) 0%, transparent 50%)', zIndex: -1, filter: 'blur(60px)' }} />
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1.5rem', letterSpacing: '-1px' }}>Ready to skyrocket your sales?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', maxWidth: '500px', margin: '0 auto 2.5rem', fontSize: '1.1rem', lineHeight: 1.7 }}>Join 1,000+ companies using Extract.io to find their next big clients.</p>
            {!isSignedIn ? (
              <button
                className="btn-premium btn-premium-primary"
                style={{ padding: '1rem 3rem', fontSize: '1.05rem' }}
                onClick={handleCTA}
              >
                Create Your Account Now
              </button>
            ) : (
              <button
                className="btn-premium btn-premium-primary"
                style={{ padding: '1rem 3rem', fontSize: '1.05rem' }}
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </button>
            )}
          </motion.div>
        </section>
      </main>

      <footer className="footer" style={{ background: 'var(--surface-low)', padding: '4rem 2rem', borderTop: '1px solid var(--border)' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '4rem' }}>
          <div>
            <div className="logo" style={{ marginBottom: '1.25rem' }}>
              <div className="logo__icon" style={{ width: '32px', height: '32px' }}>
                <Zap size={16} color="white" />
              </div>
              <span className="logo__text" style={{ fontSize: '1.1rem', fontWeight: 700 }}>Extract.io</span>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', lineHeight: 1.6 }}>The ultimate tool for e-commerce lead generation. Built for modern sales teams.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2.5rem' }}>
            <div>
              <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Product</h4>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <a href="#features" className="nav-link" style={{ fontSize: '0.85rem', padding: 0, color: 'var(--text-muted)' }}>Features</a>
                <a href="/pricing" className="nav-link" style={{ fontSize: '0.85rem', padding: 0, color: 'var(--text-muted)' }}>Pricing</a>
              </nav>
            </div>
            <div>
              <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Company</h4>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <a href="#" className="nav-link" style={{ fontSize: '0.85rem', padding: 0, color: 'var(--text-muted)' }}>About</a>
              </nav>
            </div>
            <div>
              <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Connect</h4>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <a href="#" className="nav-link" style={{ fontSize: '0.85rem', padding: 0, color: 'var(--text-muted)' }}>Twitter</a>
              </nav>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
          © 2026 Extract.io. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
