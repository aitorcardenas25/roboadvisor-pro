'use client';

import { memo } from 'react';
import { getDataSourceDef } from '@/lib/dataSourceRegistry';

interface Props {
  source: string;
  updatedAt?: string;
  variant?: 'chip' | 'inline' | 'dot';
  className?: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)   return 'ara mateix';
  if (min < 60)  return `fa ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)    return `fa ${h}h`;
  const d = Math.floor(h / 24);
  return `fa ${d}d`;
}

const PENDING_BADGE = {
  text:  'Pendent',
  color: 'rgba(255,255,255,0.2)',
  bg:    'rgba(255,255,255,0.04)',
  border:'rgba(255,255,255,0.08)',
};

export const DataSourceBadge = memo(function DataSourceBadge({
  source, updatedAt, variant = 'chip', className = '',
}: Props) {
  const def = getDataSourceDef(source);

  if (source === 'pending' || source === 'simulated') {
    if (variant === 'dot') {
      return (
        <span className={`inline-flex items-center gap-1 text-xs text-white/25 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
          {PENDING_BADGE.text}
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${className}`}
        style={{ color: PENDING_BADGE.color, borderColor: PENDING_BADGE.border, backgroundColor: PENDING_BADGE.bg }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
        {PENDING_BADGE.text}
      </span>
    );
  }

  if (!def) return null;

  if (variant === 'dot') {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs text-white/40 ${className}`}
        title={def.name}
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: def.accentColor }}
        />
        {def.shortName}
      </span>
    );
  }

  if (variant === 'inline') {
    return (
      <span className={`text-xs text-white/30 ${className}`}>
        {def.shortName}
        {updatedAt ? ` · ${timeAgo(updatedAt)}` : ''}
      </span>
    );
  }

  // chip (default)
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${className}`}
      style={{
        color:           def.accentColor,
        borderColor:     `${def.accentColor}30`,
        backgroundColor: `${def.accentColor}10`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: def.accentColor }}
      />
      {def.shortName}
      {updatedAt && (
        <span style={{ color: `${def.accentColor}70` }}>
          · {timeAgo(updatedAt)}
        </span>
      )}
    </span>
  );
});
