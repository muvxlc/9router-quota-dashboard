'use client';

export default function StatusPill({ statusObj, suppressAvailable = true }) {
  const status = statusObj?.status || 'no-data';
  const label = statusObj?.label || 'No Data';

  if (suppressAvailable && (status === 'healthy' || label === 'Available')) {
    return null;
  }

  if (status === 'healthy') {
    return (
      <span className="pp-tag-active" title={statusObj?.reason || label}>
        {label}
      </span>
    );
  }

  if (status === 'low' || status === 'stale' || status === 'partial') {
    return (
      <span className="pp-tag-low" title={statusObj?.reason || label}>
        {label}
      </span>
    );
  }

  if (status === 'exhausted') {
    return (
      <span className="pp-tag-depleted" title={statusObj?.reason || label}>
        {label}
      </span>
    );
  }

  return (
    <span className="pp-tag-disabled" title={statusObj?.reason || label}>
      {label}
    </span>
  );
}
