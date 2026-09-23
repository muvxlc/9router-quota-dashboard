'use client';

import { useState } from 'react';

export default function LoginModal({ onLogin, loginMode, error, loading }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim() || loading) return;
    onLogin(password);
  };

  const isUnsupportedSso = loginMode === 'unsupported-sso';

  return (
    <div className="quota-modal-backdrop is-open" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <div className="quota-modal" style={{ maxWidth: 420 }}>
        <div className="quota-modal-header" style={{ justifyContent: 'center' }}>
          <h2 id="login-title" className="quota-modal-title" style={{ fontSize: 16 }}>
            9Router Quotas
          </h2>
        </div>

        <div className="quota-modal-body" style={{ padding: '24px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--theme-text-muted)', textAlign: 'center', marginBottom: 8 }}>
            Enter your 9Router dashboard password
          </p>

          {isUnsupportedSso ? (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--theme-amber-tint)',
                color: 'var(--theme-amber)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                lineHeight: 1.4,
              }}
            >
              <strong>Unsupported SSO Mode:</strong> This 9Router instance is configured with SSO. Direct password login is unavailable via this client.
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {error && (
                <div
                  style={{
                    padding: '10px 12px',
                    backgroundColor: 'var(--theme-red-tint)',
                    color: 'var(--theme-red)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="password-input"
                  style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--theme-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}
                >
                  Password
                </label>
                <input
                  id="password-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  autoFocus
                  disabled={loading}
                  style={{
                    width: '100%',
                    height: 42,
                    padding: '0 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--theme-border-strong)',
                    backgroundColor: 'var(--theme-canvas-subtle)',
                    color: 'var(--theme-text-main)',
                    fontSize: 15,
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !password.trim()}
                className="btn-orange-cta"
                style={{ width: '100%', height: 42, justifyContent: 'center' }}
              >
                {loading ? 'Authenticating...' : 'Unlock Dashboard'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
