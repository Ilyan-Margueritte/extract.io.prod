import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, SignIn, SignUp } from '@clerk/clerk-react';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import PricingPage from './pages/PricingPage';
import './index.css';
import './styles/dashboard.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

import { dark } from '@clerk/themes';
import { Zap } from 'lucide-react';

const AuthLayout = ({ children }) => (
  <div style={{ 
    display: 'flex', 
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh', 
    background: '#020408',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: 'var(--font-sans)',
    padding: '2rem'
  }}>
    {/* Background Texture & Effects */}
    <div style={{
      position: 'absolute',
      inset: 0,
      backgroundImage: 'radial-gradient(#ffffff05 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      zIndex: 0
    }} />
    
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '600px',
      height: '600px',
      background: 'radial-gradient(circle, var(--primary-glow) 0%, transparent 70%)',
      opacity: 0.4,
      filter: 'blur(100px)',
      zIndex: 0,
      pointerEvents: 'none'
    }} />

    {/* Content */}
    <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '400px' }}>
      <div className="logo" style={{ marginBottom: '2.5rem', transform: 'scale(1.2)' }}>
        <div className="logo__icon" style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--primary), #818cf8)' }}>
          <Zap size={20} color="white" />
        </div>
        <span className="logo__text" style={{ fontSize: '1.5rem', letterSpacing: '-1px' }}>Extract.io</span>
      </div>

      <div style={{
        width: '100%',
        position: 'relative',
        animation: 'fadeInUp 0.6s ease-out'
      }}>
        {children}
      </div>

      <div style={{ marginTop: '3rem', display: 'flex', gap: '2rem', opacity: 0.5 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>+10k</div>
          <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Leads</div>
        </div>
        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>99.9%</div>
          <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Uptime</div>
        </div>
      </div>
    </div>

    <style>{`
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .cl-rootBox {
        box-shadow: 0 20px 50px rgba(0,0,0,0.5) !important;
      }
    `}</style>
  </div>
);

import SuccessPage from './pages/Success';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/success" element={<SuccessPage />} />
      
      <Route
        path="/login/*"
        element={
          <AuthLayout>
            <SignIn routing="path" path="/login" signUpUrl="/register" afterSignInUrl="/pricing" appearance={{ baseTheme: dark }} />
          </AuthLayout>
        }
      />
      
      <Route
        path="/register/*"
        element={
          <AuthLayout>
            <SignUp routing="path" path="/register" signInUrl="/login" afterSignUpUrl="/pricing" appearance={{ baseTheme: dark }} />
          </AuthLayout>
        }
      />

      <Route
        path="/dashboard/*"
        element={
          <>
            <SignedIn>
              <Dashboard />
            </SignedIn>
            <SignedOut>
              <Navigate to="/?sign-in=true" replace />
            </SignedOut>
          </>
        }
      />

      <Route
        path="/pricing"
        element={
          <>
            <SignedIn>
              <PricingPage />
            </SignedIn>
            <SignedOut>
              <Navigate to="/?sign-in=true" replace />
            </SignedOut>
          </>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider 
      publishableKey={PUBLISHABLE_KEY}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#6366f1',
          colorBackground: '#0f172a',
          colorText: '#f8fafc',
          borderRadius: '12px'
        }
      }}
    >
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>
);
