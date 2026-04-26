import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Search, Layers, Download, Trash2,
  Copy, CheckCircle2, ExternalLink, AlertCircle,
  Zap, FileText, ArrowRight
} from 'lucide-react';

import { useAuth } from '@clerk/clerk-react';

const API_URL = import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api';

function SocialLink({ platform, href }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="social-btn" title={platform}>
      <Globe size={12} />
    </a>
  );
}

function CopyButton({ text, id, copied, onCopy }) {
  const isCopied = copied === id;
  return (
    <button className="data-item__copy" onClick={() => onCopy(text, id)}>
      {isCopied
        ? <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
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
  // Backwards compatibility: check if result is nested within the job object
  const data = result.result || result;
  const domain = (() => {
    try { return new URL(result.url.startsWith('http') ? result.url : `https://${result.url}`).hostname; }
    catch { return result.url; }
  })();

  const initial = (result.name || domain).charAt(0).toUpperCase();
  const isError = result.status?.startsWith('error');

  return (
    <motion.div
      className={`result-card shadow-md animate-in`}
      style={{ borderLeft: isError ? '4px solid var(--error)' : 'none' }}
    >
      <div className="result-card__header">
        <div className="store-info">
          <div className="store-favicon">{initial}</div>
          <div>
            <div className="store-name">{result.name || data.name || domain}</div>
            <a href={result.url} target="_blank" rel="noreferrer" className="store-url">
              {domain} <ExternalLink size={10} />
            </a>
          </div>
        </div>
        <div className="card-socials">
          {Object.entries(data.social_links || {}).slice(0, 4).map(([platform, href]) => (
            <SocialLink key={platform} platform={platform} href={href} />
          ))}
        </div>
      </div>
      <div className="result-card__body">
        <DataSection
          label="Emails" icon={<FileText size={12} />}
          items={data.emails || []} emptyText="No email found"
          idx={idx} type="email" copied={copied} onCopy={onCopy}
        />
        <DataSection
          label="Phones" icon={<Zap size={12} />}
          items={data.phones || []} emptyText="No phone found"
          idx={idx} type="phone" copied={copied} onCopy={onCopy}
        />
      </div>
    </motion.div>
  );
}

export default function ScraperTool() {
  const [mode, setMode] = useState('single');
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);
  const { getToken } = useAuth();

  // Fetch history on mount to persist results between tab changes
  React.useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = await getToken();
        const res = await axios.get(`${API_URL}/api/v1/scrape/history?page_size=10`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data && res.data.jobs) {
          setResults(res.data.jobs);
        }
      } catch (err) {
        console.error("Failed to fetch history:", err);
      }
    };
    fetchHistory();
  }, [getToken]);

  const handleScrape = async (e) => {
    e.preventDefault();
    if (!urlInput.trim() || loading) return;
    setLoading(true);
    setError('');
    
    try {
      const token = await getToken();
      if (mode === 'single') {
        const res = await axios.post(`${API_URL}/api/v1/scrape`, { url: urlInput.trim() }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setResults(prev => [res.data, ...prev]);
        setUrlInput('');
      } else {
        const urls = urlInput.split('\n').map(u => u.trim()).filter(Boolean);
        const res = await axios.post(`${API_URL}/api/v1/scrape-bulk`, { urls }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setResults(prev => [...res.data, ...prev]);
        setUrlInput('');
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errorMsg = Array.isArray(detail) 
        ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ')
        : (typeof detail === 'string' ? detail : 'Extraction failed.');
      setError(errorMsg);
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

  return (
    <div className="section">
      <div className="panel animate-in">
        <div className="panel__header">
          <button
            className={`tab-btn ${mode === 'single' ? 'tab-btn--active' : ''}`}
            onClick={() => setMode('single')}
          >
            <Globe size={14} /> Single URL
          </button>
          <button
            className={`tab-btn ${mode === 'bulk' ? 'tab-btn--active' : ''}`}
            onClick={() => setMode('bulk')}
          >
            <Layers size={14} /> Bulk Scan
          </button>
        </div>

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
                className="btn-premium btn-premium-primary"
                disabled={loading || !urlInput.trim()}
                style={{ height: '44px' }}
              >
                {loading ? 'Scanning...' : 'Extract'} <ArrowRight size={15} />
              </button>
            </div>
          </form>

          <AnimatePresence>
            {loading && (
              <motion.div
                className="scan-indicator animate-in"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="spinner" />
                Processing domains — analyzing structure and contact points...
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.div className="error-banner animate-in">
                <AlertCircle size={15} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div className="section" style={{ marginTop: 40 }}>
            <div className="results-header">
              <div className="results-title">
                Results <span className="badge">{results.length}</span>
              </div>
              <div className="results-actions">
                <button className="btn-premium btn-premium-secondary" onClick={exportCSV} style={{ padding: '0 1rem', height: '36px', fontSize: '0.85rem' }}>
                  <Download size={14} /> Export CSV
                </button>
                <button className="btn-icon btn-danger" onClick={() => setResults([])}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
    </div>
  );
}
