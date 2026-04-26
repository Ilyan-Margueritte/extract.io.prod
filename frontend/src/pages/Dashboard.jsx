import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Zap, LayoutDashboard, History, Settings,
  CreditCard, LogOut, Key, Globe
} from 'lucide-react';
import { useUser, useClerk, useAuth } from '@clerk/clerk-react';
import axios from 'axios';
import ScraperTool from '../components/ScraperTool';

const API_URL = import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api';

const HistoryView = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = await getToken();
        const res = await axios.get(`${API_URL}/api/v1/scrape/history?page_size=20`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setJobs(res.data.jobs || []);
      } catch (err) {
        console.error("Fetch history error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [getToken]);

  if (loading) return <div className="panel" style={{ padding: '3rem', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;

  if (jobs.length === 0) return <div className="panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>No history available yet. Start scraping to see results.</div>;

  return (
    <div className="history-list">
      {jobs.map(job => (
        <div key={job.id} className="history-item">
          <div className="history-item__icon">
            <div className="logo__icon" style={{ width: '32px', height: '32px', background: 'var(--surface-high)' }}>
              <Globe size={14} color="var(--text-dim)" />
            </div>
          </div>
          <div className="history-item__content">
            <div className="history-item__url">{job.url}</div>
            <div className="history-item__meta">
              <span className={`status-badge status-badge--${job.status}`}>
                {job.status}
              </span>
              <span className="history-item__date">
                {new Date(job.created_at).toLocaleDateString()} at {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {job.processing_time_ms && (
                <span className="history-item__date">
                  • {Math.round(job.processing_time_ms / 1000)}s
                </span>
              )}
            </div>
          </div>
          <div className="history-item__link">
            <History size={16} />
          </div>
        </div>
      ))}
    </div>
  );
};

const SidebarLink = ({ to, icon, label, active }) => (
  <Link to={to} className={`nav-link ${active ? 'nav-link--active' : ''}`}>
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px' }}>{icon}</span>
    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{label}</span>
  </Link>
);

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const path = location.pathname;

  const handleLogout = () => {
    signOut();
    navigate('/');
  };

  const handlePortal = async () => {
    try {
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
      console.error("Portal error", err);
      alert('Impossible to access the billing portal. Check that you have an active subscription.');
    }
  };

  // Handle Stripe Success redirection
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('session_id')) {
      // Clear the URL and maybe show a toast
      window.history.replaceState({}, document.title, "/dashboard");
    }
  }, [location]);

  // Note: We'll fetch plan data from our backend using the Clerk ID
  const plan = user?.publicMetadata?.plan?.toUpperCase() || 'FREE';
  const scrapesLimit = plan === 'PREMIUM' ? 'Unlimited' : 0;
  const scrapesUsed = user?.publicMetadata?.scrapes_used || 0;
  const scrapesRemaining = plan === 'PREMIUM' ? 'Unlimited' : 0;

  return (
    <div className="dash-layout">
      {/* Sidebar */}
      <aside className="dash-sidebar" style={{ background: 'var(--surface-glass)', backdropFilter: 'blur(30px)', borderRight: '1px solid var(--border)' }}>
        <div className="logo" style={{ marginBottom: '3rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div className="logo__icon" style={{ width: '36px', height: '36px', background: 'var(--gradient-primary)' }}>
            <Zap size={18} color="white" />
          </div>
          <span className="logo__text" style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Extract.io</span>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ padding: '0 0.75rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Menu</div>
          <SidebarLink
            to="/dashboard"
            icon={<LayoutDashboard size={18} />}
            label="Workspace"
            active={path === '/dashboard' || path === '/dashboard/'}
          />
          <SidebarLink
            to="/dashboard/history"
            icon={<History size={18} />}
            label="History"
            active={path === '/dashboard/history'}
          />
          <SidebarLink
            to="/dashboard/billing"
            icon={<CreditCard size={18} />}
            label="Billing"
            active={path === '/dashboard/billing'}
          />

          <div style={{ marginTop: '2rem', padding: '0 0.75rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Account</div>
          <SidebarLink
            to="/dashboard/settings"
            icon={<Settings size={18} />}
            label="Settings"
            active={path === '/dashboard/settings'}
          />
        </nav>

        <div style={{ paddingTop: '1.5rem', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
          <div style={{
            padding: '1rem',
            background: 'var(--primary-dim)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-primary)',
            marginBottom: '1rem'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-pale)', marginBottom: '0.25rem' }}>CURRENT PLAN</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>{plan}</div>
          </div>
          <button
            onClick={handleLogout}
            className="nav-link"
            style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', transition: 'var(--transition)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.color = 'var(--error)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <LogOut size={18} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Log Out</span>
          </button>
        </div>
      </aside>


      {/* Main Content */}
      <main className="dash-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>
              {path.includes('history') ? 'History' :
                path.includes('billing') ? 'Billing' :
                  path.includes('settings') ? 'Settings' : 'Workspace'}
            </h1>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              Welcome back, <strong>{user?.fullName || 'User'}</strong>.
              {plan === 'PREMIUM'
                ? <span> Enjoy your <strong>Unlimited</strong> access.</span>
                : <span> <Link to="/pricing" style={{ color: 'var(--primary)', fontWeight: 600 }}>Pay for Premium</Link> to start extracting leads.</span>
              }
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            {plan === 'PREMIUM' && (
              <div className="glass" style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>FULL ACCESS</span>
              </div>
            )}
          </div>
        </header>

        <Routes>
          <Route path="/" element={
            // UX-only gating: hides scraper tool for non-premium users
            // Authorization is enforced server-side - backend rejects unauthorized requests
            plan !== 'PREMIUM' ? (
              <div className="glass reveal" style={{ padding: '3rem 2rem', textAlign: 'center', borderRadius: 'var(--radius-lg)', marginTop: '2rem', border: '1px solid var(--primary-dim)', maxWidth: '600px', margin: '2rem auto' }}>
                <div style={{ background: 'var(--primary-dim)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                  <Zap size={28} color="var(--primary)" />
                </div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.75rem' }}>Activation Required</h2>
                <p style={{ color: 'var(--text-dim)', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 1.75rem', fontSize: '1rem', lineHeight: '1.6' }}>
                  Access to the Extract.io tool is restricted to members only. Activate your access now to get started.
                </p>
                <Link to="/pricing" className="btn-premium btn-premium-primary" style={{ padding: '1rem 2.5rem', fontSize: '1rem', textDecoration: 'none' }}>
                  Activate My Access ($4.90 / month)
                </Link>
              </div>
            ) : (
              <ScraperTool />
            )
          } />
          <Route path="/history" element={<HistoryView />} />
          <Route path="/billing" element={
            <div className="panel" style={{ padding: '4rem', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Subscription Management</h2>
              <p style={{ color: 'var(--text-dim)', marginBottom: '2rem' }}>
                You are currently on the <strong>{plan}</strong> plan.
              </p>
              {plan === 'PREMIUM' ? (
                <button onClick={handlePortal} className="btn-premium btn-premium-primary" style={{ padding: '0.8rem 2rem' }}>
                  Manage or Cancel on Stripe
                </button>
              ) : (
                <Link to="/pricing" className="btn-premium btn-premium-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
                  Pay for Premium
                </Link>
              )}
            </div>
          } />
          <Route path="/settings" element={
            <div className="panel" style={{ padding: '4rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem' }}>Account Settings</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem', background: 'var(--surface-high)', borderRadius: 'var(--radius)' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700 }}>
                    {user?.firstName?.charAt(0) || user?.emailAddress?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{user?.fullName}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>{user?.primaryEmailAddress?.emailAddress}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Subscription Plan</span>
                      <span style={{ fontWeight: 600, color: plan === 'PREMIUM' ? 'var(--primary)' : 'inherit' }}>{plan}</span>
                    </div>
                    {plan === 'PREMIUM' && (
                      <button onClick={handlePortal} className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
                        Manage / Cancel
                      </button>
                    )}
                  </div>
                  <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-dim)' }}>User ID</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{user?.id}</span>
                  </div>
                  <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Member Since</span>
                    <span>{new Date(user?.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                </div>
              </div>
            </div>
          } />
        </Routes>
      </main>
    </div>
  );
}
