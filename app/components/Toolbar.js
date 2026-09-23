'use client';

import { useState, useRef, useEffect } from 'react';

export default function Toolbar({
  search,
  onSearchChange,
  activeFilter,
  onActiveFilterChange,
  provider,
  onProviderChange,
  providersList,
  status,
  onStatusChange,
  sortBy,
  sortOrder,
  onSortChange,
  onResetFilters,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const popoverRef = useRef(null);

  const extraFiltersCount = (provider !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0);
  const hasActiveFilters = Boolean(
    (search && search.trim() !== '') ||
    activeFilter !== 'active' ||
    provider !== 'all' ||
    status !== 'all'
  );

  useEffect(() => {
    if (!filtersOpen) return;
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setFiltersOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setFiltersOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [filtersOpen]);

  return (
    <div className="toolbar-bar">
      <div className="search-input-wrap">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, flexShrink: 0 }} aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          className="search-input"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter accounts by email or ID…"
          aria-label="Filter accounts"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '4px 8px' }}
            aria-label="Clear search"
          >
            Clear
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          className="filter-select"
          value={activeFilter}
          onChange={(e) => onActiveFilterChange(e.target.value)}
          aria-label="Filter by connection state"
          style={{ minWidth: 120 }}
        >
          <option value="active">Active Only</option>
          <option value="all">All Connections</option>
          <option value="inactive">Inactive Only</option>
        </select>

        <div style={{ position: 'relative' }} ref={popoverRef}>
          <button
            type="button"
            className="ios-button min-touch-target"
            onClick={() => setFiltersOpen((prev) => !prev)}
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
            aria-label="More filters and sorting options"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>Filters</span>
            {extraFiltersCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 18,
                  height: 18,
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent)',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '0 4px',
                }}
              >
                {extraFiltersCount}
              </span>
            )}
          </button>

          {filtersOpen && (
            <div
              role="dialog"
              aria-label="Filters and sorting"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-inner)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                padding: '12px',
                zIndex: 100,
                minWidth: 240,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                  Provider
                </label>
                <select
                  className="filter-select"
                  value={provider}
                  onChange={(e) => onProviderChange(e.target.value)}
                  aria-label="Filter by provider"
                  style={{ width: '100%' }}
                >
                  <option value="all">All Providers</option>
                  {providersList.map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                  Status
                </label>
                <select
                  className="filter-select"
                  value={status}
                  onChange={(e) => onStatusChange(e.target.value)}
                  aria-label="Filter by status"
                  style={{ width: '100%' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="healthy">Available</option>
                  <option value="low">Low Quota</option>
                  <option value="exhausted">Exhausted</option>
                  <option value="partial">Partial</option>
                  <option value="no-data">No Data</option>
                  <option value="inactive">Inactive</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                  Sort By
                </label>
                <select
                  className="filter-select"
                  value={`${sortBy}:${sortOrder}`}
                  onChange={(e) => {
                    const [by, order] = e.target.value.split(':');
                    onSortChange(by, order);
                  }}
                  aria-label="Sort accounts"
                  style={{ width: '100%' }}
                >
                  <option value="remainingPct:asc">Remaining % (Lowest First)</option>
                  <option value="remainingPct:desc">Remaining % (Highest First)</option>
                  <option value="label:asc">Account Name (A–Z)</option>
                  <option value="label:desc">Account Name (Z–A)</option>
                  <option value="status:asc">Status</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border-separator)' }}>
                {onResetFilters && (
                  <button
                    type="button"
                    onClick={onResetFilters}
                    style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  className="ios-button"
                  onClick={() => setFiltersOpen(false)}
                  style={{ fontSize: 12, padding: '4px 10px', height: 28 }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {hasActiveFilters && onResetFilters && (
          <button
            type="button"
            className="clear-filters-btn min-touch-target"
            onClick={onResetFilters}
            title="Reset filters to default"
            aria-label="Reset all filters"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
