import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, PartyPopper, Loader2 } from 'lucide-react';

export default function SuccessPage() {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10;

    const tryReload = async () => {
      if (!isLoaded || !user) {
        setSyncing(false);
        return;
      }

      await user.reload();
      const plan = user.publicMetadata?.plan;
      if (plan && plan.startsWith('premium')) {
        setSyncing(false);
        return;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        setSyncing(false);
        return;
      }

      setTimeout(tryReload, 2000);
    };

    setTimeout(tryReload, 1000);
  }, [isLoaded, user]);

  return (
    <div className="success-page">
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '800px', height: '800px', background: 'radial-gradient(circle, var(--primary-dim) 0%, transparent 70%)', filter: 'blur(100px)', opacity: 0.4, zIndex: -1 }} />

      <motion.div
        className="success-card"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="success-icon"
          initial={{ rotate: -10 }}
          animate={{ rotate: 0 }}
          transition={{ type: 'spring', damping: 10 }}
        >
          <PartyPopper size={48} />
        </motion.div>

        <div className="hero__eyebrow" style={{ background: 'var(--success-dim)', color: 'var(--success-light)', borderColor: 'var(--success-glow)', marginBottom: '1.5rem' }}>
          <div className="dot" style={{ background: 'var(--success)' }} /> Payment successful
        </div>

        <h1 className="success-title">
          {syncing ? 'Synchronisation' : 'Welcome to'} <span className="text-gradient-primary">Premium</span>
        </h1>

        <p className="success-desc">
          {syncing
            ? 'Your subscription is being activated. Please wait a moment...'
            : 'Your account has been upgraded. You now have unlimited access to all professional extraction tools.'
          }
        </p>

        <button
          className="btn-premium btn-premium-primary"
          style={{ width: '100%', height: '60px', fontSize: '1.1rem' }}
          onClick={() => navigate('/dashboard')}
          disabled={syncing}
        >
          {syncing ? <><Loader2 className="spinner" /> Synchronisation</> : <>Launch Dashboard <ArrowRight size={20} /></>}
        </button>

        <div className="success-footer">
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
