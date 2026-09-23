'use client';

export default function FiltersPopover({
  provider,
  onProviderChange,
  providersList = [],
  status,
  onStatusChange,
  sortBy,
  sortOrder,
  onSortChange,
  onResetFilters,
  onClose,
}) {
  return (
    <div role="dialog" aria-label="Filters and sorting" className="app-popover-menu">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-text-muted)', textTransform: 'uppercase' }}>
          Provider
        </label>
        <select
          className="filter-select"
          value={provider}
          onChange={(e) => onProviderChange?.(e.target.value)}
          aria-label="Filter by provider"
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
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-text-muted)', textTransform: 'uppercase' }}>
          Status
        </label>
        <select
          className="filter-select"
          value={status}
          onChange={(e) => onStatusChange?.(e.target.value)}
          aria-label="Filter by status"
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
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-text-muted)', textTransform: 'uppercase' }}>
          Sort By
        </label>
        <select
          className="filter-select"
          value={`${sortBy}:${sortOrder}`}
          onChange={(e) => {
            const [by, order] = e.target.value.split(':');
            onSortChange?.(by, order);
          }}
          aria-label="Sort accounts"
        >
          <option value="remainingPct:asc">Remaining % (Lowest First)</option>
          <option value="remainingPct:desc">Remaining % (Highest First)</option>
          <option value="label:asc">Account Name (A–Z)</option>
          <option value="label:desc">Account Name (Z–A)</option>
          <option value="status:asc">Status</option>
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--theme-border)' }}>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            style={{ fontSize: 12, color: 'var(--theme-text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            Reset
          </button>
        )}
        <button
          type="button"
          className="btn-orange-cta"
          onClick={onClose}
          style={{ height: 28, padding: '0 10px', fontSize: 12 }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
