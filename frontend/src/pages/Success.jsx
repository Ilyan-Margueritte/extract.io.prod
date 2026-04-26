import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Zap, ArrowRight, PartyPopper } from 'lucide-react';

export default function SuccessPage() {
  const navigate = useNavigate();

  return (
    <div className="app-wrapper" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative', overflow: 'hidden' }}>
      {/* Background Glow */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '800px', height: '800px', background: 'radial-gradient(circle, var(--primary-dim) 0%, transparent 70%)', filter: 'blur(100px)', opacity: 0.4, zIndex: -1 }} />
      
      <motion.div 
        className="pricing-card"
        style={{ maxWidth: '540px', width: '100%', padding: '4rem', textAlign: 'center', border: '1px solid var(--border-primary)', boxShadow: 'var(--shadow-glow-lg)' }}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem' }}>
          <motion.div 
            style={{ 
              width: '100px', 
              height: '100px', 
              borderRadius: '30px', 
              background: 'var(--gradient-primary)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'white',
              boxShadow: 'var(--shadow-glow)'
            }}
            initial={{ rotate: -10 }}
            animate={{ rotate: 0 }}
            transition={{ type: 'spring', damping: 10 }}
          >
            <PartyPopper size={48} />
          </motion.div>
        </div>

        <div className="hero__eyebrow" style={{ background: 'var(--success-dim)', color: 'var(--success-light)', borderColor: 'var(--success-glow)', marginBottom: '1.5rem' }}>
          <div className="dot" style={{ background: 'var(--success)' }} /> Payment successful
        </div>

        <h1 className="hero__title" style={{ fontSize: 'clamp(32px, 5vw, 42px)', marginBottom: '1.25rem' }}>
          Welcome to <span className="text-gradient-primary">Premium</span>
        </h1>
        
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', lineHeight: '1.7', marginBottom: '3rem', maxWidth: '420px', margin: '0 auto 3rem' }}>
          Your account has been upgraded. You now have unlimited access to all professional extraction tools.
        </p>

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <button 
            className="btn-premium btn-premium-primary" 
            style={{ width: '100%', height: '60px', fontSize: '1.1rem' }}
            onClick={() => navigate('/dashboard')}
          >
            Launch Dashboard <ArrowRight size={20} />
          </button>
        </div>

        <div style={{ marginTop: '4rem', display: 'flex', justifyContent: 'center', gap: '2rem' }}>
           <div className="logo" style={{ opacity: 0.4 }}>
            <div className="logo__icon" style={{ background: 'var(--primary-dark)', width: '24px', height: '24px' }}>
              <Zap size={12} color="white" />
            </div>
            <span className="logo__text" style={{ fontSize: '0.9rem' }}>Extract.io</span>
          </div>
        </div>
      </motion.div>
    </div>

  );
}
