'use client';

import { useState, useRef, useEffect } from 'react';
import FiltersPopover from './FiltersPopover.js';

export default function Header({
  activeTab,
  onTabChange,
  theme,
  onToggleTheme,
  onRefresh,
  onLogout,
  refreshing,
  lastSyncAt,
  search = '',
  onSearchChange,
  activeFilter = 'active',
  onActiveFilterChange,
  provider = 'all',
  onProviderChange,
  providersList = [],
  status = 'all',
  onStatusChange,
  sortBy = 'remainingPct',
  sortOrder = 'asc',
  onSortChange,
  onResetFilters,
  accountsCount = 0,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const menuRef = useRef(null);
  const filtersRef = useRef(null);

  const syncLabel = lastSyncAt
    ? `Updated ${new Date(lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
    : 'Connecting…';

  const extraFiltersCount = (provider !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (filtersRef.current && !filtersRef.current.contains(e.target)) {
        setFiltersOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setFiltersOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <>
      {/* Top Meta Banner */}
      <div className="top-meta-banner">
        <div className="badge">
          <span className="badge-dot"></span>
          <span>9ROUTER · {accountsCount} ACCOUNTS</span>
        </div>
        <div>
          <span>{syncLabel.toUpperCase()}</span>
        </div>
      </div>

      {/* Floating Island Navbar */}
      <nav className="app-navbar" aria-label="Dashboard navigation">
        {/* Brand Section */}
        <div className="brand-section">
          <div className="brand-logo-mark" aria-hidden="true" title="9Router Quotas">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <div className="brand-title-wrap">
            <div className="brand-title">
              9Router <span>Quotas</span>
            </div>
            <div className="brand-subtitle">QUOTA & TRAFFIC MONITOR</div>
          </div>
        </div>

        {/* View Switcher */}
        <div className="nav-links" role="tablist">
          <button
            type="button"
            className={`nav-link-btn ${activeTab === 'quotas' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'quotas'}
            onClick={() => onTabChange('quotas')}
          >
            Quotas
          </button>
          <button
            type="button"
            className={`nav-link-btn ${activeTab === 'usage' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'usage'}
            onClick={() => onTabChange('usage')}
          >
            Usage
          </button>
        </div>

        {/* Action Tools */}
        <div className="nav-actions">
          {activeTab === 'quotas' && (
            <>
              {/* Search Filter */}
              <div className="search-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder="FILTER ALIAS..."
                  autoComplete="off"
                  aria-label="Filter accounts by alias or email"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => onSearchChange?.('')}
                    className="search-clear-btn"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Active Only Filter */}
              <button
                type="button"
                className={`active-filter-btn ${activeFilter === 'active' ? 'is-active' : ''}`}
                onClick={() => onActiveFilterChange?.(activeFilter === 'active' ? 'all' : 'active')}
                title="Filter active accounts"
                aria-pressed={activeFilter === 'active'}
              >
                <span className="dot-indicator"></span>
                <span>Active Only</span>
              </button>

              {/* More Filters Popover */}
              <div style={{ position: 'relative' }} ref={filtersRef}>
                <button
                  type="button"
                  className={`filter-toggle-btn ${extraFiltersCount > 0 ? 'is-active' : ''}`}
                  onClick={() => setFiltersOpen((prev) => !prev)}
                  aria-haspopup="dialog"
                  aria-expanded={filtersOpen}
                  title="More filters and sorting options"
                >
                  <span>Filters</span>
                  {extraFiltersCount > 0 && (
                    <span className="filter-count-badge">{extraFiltersCount}</span>
                  )}
                </button>

                {filtersOpen && (
                  <FiltersPopover
                    provider={provider}
                    onProviderChange={onProviderChange}
                    providersList={providersList}
                    status={status}
                    onStatusChange={onStatusChange}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortChange={onSortChange}
                    onResetFilters={onResetFilters}
                    onClose={() => setFiltersOpen(false)}
                  />
                )}
              </div>
            </>
          )}

          {/* Primary Refresh CTA */}
          <button
            type="button"
            className="btn-orange-cta"
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh quotas"
            aria-label="Refresh quotas"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{refreshing ? 'Updating…' : 'Refresh'}</span>
          </button>

          {/* Settings / Menu */}
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              type="button"
              className="nav-menu-btn"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account and settings menu"
              title="Settings"
            >
              •••
            </button>

            {menuOpen && (
              <div role="menu" className="app-popover-menu" style={{ minWidth: 160 }}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleTheme?.();
                  }}
                  className="app-menu-item"
                >
                  <span>Theme</span>
                  <span style={{ fontSize: 12, color: 'var(--theme-text-muted)' }}>
                    {theme === 'dark' ? 'Dark' : 'Light'}
                  </span>
                </button>

                <div style={{ height: 1, backgroundColor: 'var(--theme-border)', margin: '2px 0' }} />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout?.();
                  }}
                  className="app-menu-item"
                  style={{ color: 'var(--theme-red)' }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
