import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Currency, Package, Search, ArrowRight,
  AlertCircle, Loader2, Download, Trash2,
  Copy, CheckCircle2, X, MapPin, Zap
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

const API_URL = '/api';

function PriceProductRow({ product, prices }) {
  const matchedPrice = prices.find(p => {
    if (typeof p === 'object' && product.price && typeof product.price === 'object') {
      return p.amount === product.price.amount && p.currency === product.price.currency;
    }
    return false;
  }) || product.price;

  const formatPrice = (p) => {
    if (typeof p === 'object') return `${p.amount} ${p.currency || 'EUR'}`;
    return p;
  };

  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="price-product-row"
    >
      <td className="pp-cell pp-name">
        <div className="pp-name-inner">
          {product.image_url && (
            <img src={product.image_url} alt="" className="pp-thumb" onError={(e) => e.target.style.display = 'none'} />
          )}
          <span>{product.name || '—'}</span>
        </div>
      </td>
      <td className="pp-cell">
        <code className="pp-sku">{product.sku || '—'}</code>
      </td>
      <td className="pp-cell">
        {matchedPrice ? (
          <span className="pp-price">{formatPrice(matchedPrice)}</span>
        ) : (
          <span className="pp-price unmatched">—</span>
        )}
      </td>
      <td className="pp-cell">
        {prices.map((p, i) => (
          <span key={i} className="pp-all-price">
            {formatPrice(p)}
            {matchedPrice && matchedPrice.amount === p.amount && matchedPrice.currency === p.currency && (
              <CheckCircle2 size={12} style={{ color: 'var(--success)', marginLeft: 4 }} />
            )}
          </span>
        ))}
        {prices.length === 0 && <span className="pp-no-price">Aucun prix</span>}
      </td>
      <td className="pp-cell">
        {product.url ? (
          <a href={product.url} target="_blank" rel="noreferrer" className="pp-link" title={product.url}>
            <MapPin size={14} />
          </a>
        ) : '—'}
      </td>
    </motion.tr>
  );
}

function PriceProductPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(null);
  const { getToken } = useAuth();

  const handleScrape = async (e) => {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError('');
    setResults(null);

    try {
      const token = await getToken();
      const res = await axios.post(`${API_URL}/v1/public/scrape`, { url: url.trim() }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResults(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Extraction échouée.');
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
    if (!results) return;
    const prices = results.prices || [];
    const products = results.products || [];

    const headers = ['Produit', 'SKU', 'Prix associé', 'Tous les prix', 'URL', 'Prix brut (amount)', 'Devise'];
    const rows = products.map(prod => {
      const matchedPrice = prices.find(p =>
        prod.price && typeof prod.price === 'object' &&
        p.amount === prod.price.amount && p.currency === prod.price.currency
      );
      return [
        prod.name || '',
        prod.sku || '',
        matchedPrice ? `${matchedPrice.amount} ${matchedPrice.currency}` : '',
        prices.map(p => `${p.amount} ${p.currency}`).join('; '),
        prod.url || '',
        prod.price && typeof prod.price === 'object' ? prod.price.amount : '',
        prod.price && typeof prod.price === 'object' ? prod.price.currency : '',
      ];
    });

    const csv = 'data:text/csv;charset=utf-8,' +
      headers.join(',') + '\n' +
      rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = 'prices_products.csv';
    a.click();
  };

  const prices = results?.prices || [];
  const products = results?.products || [];

  // Products with matched prices highlighted
  const enrichedProducts = products.map(prod => ({
    ...prod,
    _matchedPrice: prices.find(p =>
      prod.price && typeof prod.price === 'object' &&
      p.amount === prod.price.amount && p.currency === prod.price.currency
    )
  }));

  const formatPrice = (p) => {
    if (typeof p === 'object') return `${p.amount} ${p.currency || 'EUR'}`;
    return p;
  };

  return (
    <div className="price-product-page">
      {/* URL Input */}
      <div className="glass reveal" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <form onSubmit={handleScrape} style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              className="field field--input"
              placeholder="https://www.example.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn-premium btn-premium-primary"
            disabled={loading || !url.trim()}
            style={{ whiteSpace: 'nowrap' }}
          >
            {loading ? <><Loader2 className="spinner" /> Scraping...</> : <>Scraper les prix & produits <ArrowRight size={16} /></>}
          </button>
        </form>
        {error && (
          <motion.div className="error-banner" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <AlertCircle size={14} /> {error}
          </motion.div>
        )}
      </div>

      {results && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="glass reveal" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>PRODUITS TROUVÉS</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary-light)' }}>{products.length}</div>
            </div>
            <div className="glass reveal" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>PRIX TROUVÉS</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success-light)' }}>{prices.length}</div>
            </div>
            <div className="glass reveal" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>ASSOCIÉS</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {enrichedProducts.filter(p => p._matchedPrice).length}/{products.length}
              </div>
            </div>
            <div className="glass reveal" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>EMAILS</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent)' }}>{results.emails?.length || 0}</div>
            </div>
          </div>

          {/* Results Grid: Products + Prices side-by-side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Products Panel */}
            <div className="glass reveal" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Package size={18} /> Produits ({products.length})
                </h3>
                <button onClick={exportCSV} className="btn-premium btn-premium-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
                  <Download size={14} /> CSV
                </button>
              </div>

              {enrichedProducts.length > 0 ? (
                <div className="pp-table-wrapper">
                  <table className="pp-table">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>SKU</th>
                        <th>Prix associé</th>
                        <th>Tous les prix</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrichedProducts.map((prod, i) => (
                        <PriceProductRow
                          key={i}
                          product={prod}
                          prices={prices}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>Aucun produit trouvé</p>
              )}
            </div>

            {/* Prices Panel */}
            <div className="glass reveal" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Currency size={18} /> Prix détectés ({prices.length})
              </h3>

              {prices.length > 0 ? (
                <div className="price-list">
                  {prices.map((price, i) => (
                    <motion.div
                      key={i}
                      className="price-item"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <span className="price-amount">
                        {typeof price === 'object' ? `${price.amount} ${price.currency || 'EUR'}` : price}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <CopyButton
                          text={typeof price === 'object' ? `${price.amount} ${price.currency || 'EUR'}` : String(price)}
                          id={`pp-${i}`}
                          copied={copied}
                          onCopy={copyToClipboard}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>Aucun prix trouvé</p>
              )}

              {/* Matched / Unmatched Summary */}
              {products.length > 0 && prices.length > 0 && (
                <div className="pp-summary">
                  <div className="pp-summary-item">
                    <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                    <span>{enrichedProducts.filter(p => p._matchedPrice).length} produit(s) associé(s)</span>
                  </div>
                  <div className="pp-summary-item">
                    <X size={14} style={{ color: 'var(--error)' }} />
                    <span>{enrichedProducts.filter(p => !p._matchedPrice).length} produit(s) sans prix</span>
                  </div>
                </div>
              )}

              {/* Emails Section */}
              {results.emails && results.emails.length > 0 && (
                <>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '1.5rem 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Zap size={16} /> Emails ({results.emails.length})
                  </h3>
                  <div className="price-list">
                    {results.emails.map((email, i) => (
                      <motion.div key={i} className="price-item" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                        <span className="price-amount">{email}</span>
                        <CopyButton text={email} id={`pe-${i}`} copied={copied} onCopy={copyToClipboard} />
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Addresses */}
          {results.addresses && results.addresses.length > 0 && (
            <div className="glass reveal" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={16} /> Adresses ({results.addresses.length})
              </h3>
              <div className="price-list">
                {results.addresses.map((addr, i) => (
                  <motion.div key={i} className="price-item" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                    <span className="price-amount">{addr}</span>
                    <CopyButton text={addr} id={`pa-${i}`} copied={copied} onCopy={copyToClipboard} />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Social Links */}
          {results.social_links && Object.keys(results.social_links).length > 0 && (
            <div className="glass reveal" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={16} /> Liens sociaux
              </h3>
              <div className="price-list" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {Object.entries(results.social_links).map(([platform, href], i) => (
                  <motion.a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="price-item"
                    style={{ textDecoration: 'none', cursor: 'pointer' }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <span className="price-amount" style={{ textTransform: 'capitalize' }}>
                      {platform}: {href}
                    </span>
                  </motion.a>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {!results && !loading && !error && (
        <div className="glass reveal" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
          <Currency size={48} style={{ marginBottom: '1rem', color: 'var(--text-muted)' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
            Prix & Produits
          </h3>
          <p>Entrez une URL pour extraire les prix et produits associés.</p>
        </div>
      )}
    </div>
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

export default PriceProductPage;