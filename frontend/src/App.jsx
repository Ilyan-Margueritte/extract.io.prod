import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Search, Layers, Download, Trash2,
  Copy, CheckCircle2, ExternalLink, AlertCircle,
  Zap, ShieldCheck, FileText,
  Share2, MessageSquare, Send, User2, Play, Link as LinkIcon,
  ArrowRight
} from 'lucide-react';

// Use /api for Docker/Nginx proxy, or localhost for local dev/Electron
const API_URL = import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api';

function SocialLink({ platform, href }) {
  const icons = {
    instagram: <Share2 size={12} />,
    facebook: <MessageSquare size={12} />,
    twitter: <Send size={12} />,
    linkedin: <User2 size={12} />,
    youtube: <Play size={12} />,
    tiktok: <LinkIcon size={12} />,
    pinterest: <LinkIcon size={12} />,
  };
  return (
    <a href={href} target="_blank" rel="noreferrer" className="social-btn" title={platform}>
      {icons[platform] || <LinkIcon size={12} />}
    </a>
  );
}

function CopyButton({ text, id, copied, onCopy }) {
  const isCopied = copied === id;
  return (
    <button className="data-item__copy" onClick={() => onCopy(text, id)}>
      {isCopied
        ? <CheckCircle2 size={13} style={{ color: '#10b981' }} />
        : <Copy size={13} />}
    </button>
  );
}

function DataSection({ label, icon, items, emptyText, idx, type, copied, onCopy }) {
  return (
    <div className="data-section">
      <div className="data-label">
        {icon} {label}
        {items.length > 0 && <span>({items.length})</span>}
      </div>
      {items.length > 0 ? items.map((item, i) => (
        <div key={i} className="data-item">
          <span className="data-item__text">{item}</span>
          <CopyButton text={item} id={`${type}-${idx}-${i}`} copied={copied} onCopy={onCopy} />
        </div>
      )) : <p className="data-empty">{emptyText}</p>}
    </div>
  );
}

function ResultCard({ result, idx, copied, onCopy }) {
  const domain = (() => {
    try { return new URL(result.url.startsWith('http') ? result.url : `https://${result.url}`).hostname; }
    catch { return result.url; }
  })();

  const initial = (result.name || domain).charAt(0).toUpperCase();
  const isError = result.status?.startsWith('error');

  return (
    <motion.div
      className={`result-card${isError ? ' result-card--error' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: idx * 0.04 }}
    >
      <div className="result-card__header">
        <div className="store-info">
          <div className="store-favicon">{initial}</div>
          <div>
            <div className="store-name">{result.name || domain}</div>
            <a href={result.url} target="_blank" rel="noreferrer" className="store-url">
              {domain} <ExternalLink size={10} />
            </a>
          </div>
        </div>
        <div className="card-socials">
          {Object.entries(result.social_links || {}).slice(0, 4).map(([platform, href]) => (
            <SocialLink key={platform} platform={platform} href={href} />
          ))}
        </div>
      </div>
      <div className="result-card__body">
        <DataSection
          label="Emails" icon={<svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>}
          items={result.emails} emptyText="Aucun email trouvé"
          idx={idx} type="email" copied={copied} onCopy={onCopy}
        />
        <DataSection
          label="Téléphones" icon={<svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3-8.63A2 2 0 0 1 3.72 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8 9a16 16 0 0 0 6 6l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
          items={result.phones} emptyText="Aucun numéro trouvé"
          idx={idx} type="phone" copied={copied} onCopy={onCopy}
        />
      </div>
    </motion.div>
  );
}

export default function App() {
  const [mode, setMode] = useState('single');
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);

  const handleScrape = async (e) => {
    e.preventDefault();
    if (!urlInput.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'single') {
        const res = await axios.post(`${API_URL}/scrape`, { url: urlInput.trim() });
        setResults(prev => [res.data, ...prev]);
        setUrlInput('');
      } else {
        const urls = urlInput.split('\n').map(u => u.trim()).filter(Boolean);
        const res = await axios.post(`${API_URL}/scrape-bulk`, { urls });
        setResults(prev => [...res.data, ...prev]);
        setUrlInput('');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de l\'extraction.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const exportCSV = () => {
    const headers = ['Name', 'URL', 'Emails', 'Phones', 'Socials'];
    const rows = results.map(r => [
      r.name, r.url,
      r.emails.join('; '),
      r.phones.join('; '),
      Object.entries(r.social_links || {}).map(([k, v]) => `${k}: ${v}`).join('; ')
    ]);
    const csv = 'data:text/csv;charset=utf-8,' +
      headers.join(',') + '\n' +
      rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = 'extract.csv';
    a.click();
  };

  const totalEmails = results.reduce((s, r) => s + r.emails.length, 0);
  const totalPhones = results.reduce((s, r) => s + r.phones.length, 0);

  return (
    <div className="app-wrapper">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar__inner">
          <a href="/" className="logo">
            <div className="logo__icon">
              <Zap size={16} color="white" />
            </div>
            <span className="logo__text">Extract.io</span>
          </a>
          <span className="topbar__badge">v2.0 · Moteur Hybride</span>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        {/* Hero */}
        <div className="hero container">
          <div className="hero__eyebrow">
            <div className="dot" /> Actif & Opérationnel
          </div>
          <h1 className="hero__title">
            Extraction de contacts<br/>
            pour le <em>e-commerce</em>
          </h1>
          <p className="hero__subtitle">
            Récupérez automatiquement emails, téléphones et réseaux sociaux depuis n'importe quel site web.
          </p>
        </div>

        {/* Tool */}
        <div className="container">
          <div className="panel">
            {/* Tabs */}
            <div className="panel__header">
              <button
                className={`tab-btn ${mode === 'single' ? 'tab-btn--active' : ''}`}
                onClick={() => setMode('single')}
              >
                <Globe size={14} /> URL unique
              </button>
              <button
                className={`tab-btn ${mode === 'bulk' ? 'tab-btn--active' : ''}`}
                onClick={() => setMode('bulk')}
              >
                <Layers size={14} /> Bulk scan
              </button>
            </div>

            {/* Form */}
            <div className="panel__body">
              <form onSubmit={handleScrape}>
                <div className="input-group">
                  <div className="input-wrap">
                    <span className="input-icon">
                      {mode === 'single' ? <Globe size={16} /> : <Layers size={16} />}
                    </span>
                    {mode === 'single' ? (
                      <input
                        className="field field--input"
                        type="text"
                        placeholder="Ex: boutique.shopify.com"
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      <textarea
                        className="field field--textarea"
                        placeholder={'https://site1.com\nhttps://site2.com\nhttps://site3.com'}
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                      />
                    )}
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading || !urlInput.trim()}
                    style={{ alignSelf: mode === 'bulk' ? 'flex-end' : 'auto', height: mode === 'bulk' ? '44px' : '44px' }}
                  >
                    {loading ? 'Scan...' : 'Extraire'} <ArrowRight size={15} />
                  </button>
                </div>
              </form>

              {/* Loading indicator */}
              <AnimatePresence>
                {loading && (
                  <motion.div
                    className="scan-indicator"
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  >
                    <div className="spinner" />
                    Extraction en cours — analyse des pages du site...
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    className="error-banner"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Results */}
          <AnimatePresence>
            {results.length > 0 && (
              <motion.div
                className="section"
                style={{ marginTop: 32 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {/* Results header */}
                <div className="results-header">
                  <div className="results-title">
                    Résultats <span className="badge">{results.length}</span>
                    {totalEmails > 0 && (
                      <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                        · {totalEmails} email{totalEmails > 1 ? 's' : ''}, {totalPhones} tél
                      </span>
                    )}
                  </div>
                  <div className="results-actions">
                    <button className="btn btn-secondary" onClick={exportCSV} style={{ height: 32, fontSize: 12, padding: '0 12px' }}>
                      <Download size={13} /> CSV
                    </button>
                    <button className="btn-icon btn-danger" onClick={() => setResults([])} title="Vider les résultats">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {results.map((result, idx) => (
                    <ResultCard
                      key={`${result.url}-${idx}`}
                      result={result}
                      idx={idx}
                      copied={copied}
                      onCopy={copyToClipboard}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Features */}
          {results.length === 0 && !loading && (
            <div className="features">
              {[
                {
                  icon: <Zap size={18} color="#60a5fa" />,
                  bg: 'rgba(59,130,246,0.1)',
                  title: 'Moteur Hybride',
                  desc: 'Extraction rapide via requests, Playwright en fallback pour les sites JS.'
                },
                {
                  icon: <Search size={18} color="#a78bfa" />,
                  bg: 'rgba(167,139,250,0.1)',
                  title: 'Crawl Multi-pages',
                  desc: 'Analyse automatique de toutes les pages internes (contact, mentions, etc.).'
                },
                {
                  icon: <FileText size={18} color="#34d399" />,
                  bg: 'rgba(52,211,153,0.1)',
                  title: 'Export CSV',
                  desc: 'Téléchargez tous vos leads en un clic, prêt pour votre CRM.'
                }
              ].map((f, i) => (
                <div key={i} className="feature-card">
                  <div className="feature-icon" style={{ background: f.bg }}>{f.icon}</div>
                  <div className="feature-title">{f.title}</div>
                  <div className="feature-desc">{f.desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        Extract.io © 2026 · Moteur d'extraction de contacts pour professionnels
      </footer>
    </div>
  );
}
