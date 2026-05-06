'use client';

import { useMemo, useState } from 'react';
import { getCorrelationData } from '@/lib/portfolioAdapter';
import type { InvestorProfile } from '@/lib/products';

interface Props {
  profile: InvestorProfile;
}

/** Maps correlation [-1, 1] to a CSS color: blue → white → red */
function corrToColor(value: number): string {
  const v = Math.max(-1, Math.min(1, value));
  if (v >= 0) {
    // white → red
    const r = 255;
    const g = Math.round(255 * (1 - v));
    const b = Math.round(255 * (1 - v));
    return `rgb(${r},${g},${b})`;
  } else {
    // white → blue
    const abs = -v;
    const r = Math.round(255 * (1 - abs));
    const g = Math.round(255 * (1 - abs));
    const b = 255;
    return `rgb(${r},${g},${b})`;
  }
}

function textColor(value: number): string {
  return Math.abs(value) > 0.5 ? 'text-white' : 'text-gray-700';
}

export default function CorrelationHeatmap({ profile }: Props) {
  const { labels, matrix } = useMemo(() => getCorrelationData(profile), [profile]);
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null);

  const n = labels.length;

  return (
    <div className="overflow-x-auto">
      <div
        className="inline-grid gap-0.5"
        style={{ gridTemplateColumns: `80px repeat(${n}, minmax(56px, 1fr))` }}
      >
        {/* Top-left empty cell */}
        <div />

        {/* Column headers */}
        {labels.map((label, j) => (
          <div
            key={j}
            className="text-center text-xs font-medium text-gray-500 pb-1 truncate px-1"
            title={label}
          >
            {label}
          </div>
        ))}

        {/* Rows */}
        {matrix.map((row, i) => (
          <>
            {/* Row label */}
            <div
              key={`label-${i}`}
              className="text-right text-xs font-medium text-gray-500 pr-2 flex items-center justify-end truncate"
              title={labels[i]}
            >
              {labels[i]}
            </div>

            {/* Cells */}
            {row.map((value, j) => {
              const isHovered = hovered?.row === i || hovered?.col === j;
              const isSelected = hovered?.row === i && hovered?.col === j;
              return (
                <div
                  key={`${i}-${j}`}
                  className={`
                    relative flex items-center justify-center rounded
                    text-xs font-semibold cursor-default transition-all duration-150
                    ${textColor(value)}
                    ${isSelected ? 'ring-2 ring-gray-400 ring-offset-1 z-10' : ''}
                    ${isHovered && !isSelected ? 'brightness-90' : ''}
                  `}
                  style={{
                    backgroundColor: corrToColor(value),
                    height: '44px',
                    minWidth: '44px',
                  }}
                  onMouseEnter={() => setHovered({ row: i, col: j })}
                  onMouseLeave={() => setHovered(null)}
                  title={`${labels[i]} / ${labels[j]}: ${value.toFixed(2)}`}
                >
                  {value.toFixed(2)}
                </div>
              );
            })}
          </>
        ))}
      </div>

      {/* Scale */}
      <div className="flex items-center gap-2 mt-4 text-xs text-gray-400">
        <span>−1</span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{
            background: 'linear-gradient(to right, rgb(59,130,246), rgb(255,255,255), rgb(239,68,68))',
          }}
        />
        <span>+1</span>
        <span className="ml-2 text-gray-400">Correlació</span>
      </div>

      {/* Hover info */}
      {hovered && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          <span className="font-medium text-gray-700">{labels[hovered.row]}</span>
          {' '}↔{' '}
          <span className="font-medium text-gray-700">{labels[hovered.col]}</span>
          {': '}
          <span className="font-bold text-gray-800">
            {matrix[hovered.row][hovered.col].toFixed(2)}
          </span>
          {Math.abs(matrix[hovered.row][hovered.col]) > 0.7
            ? ' — correlació alta'
            : Math.abs(matrix[hovered.row][hovered.col]) < 0.2
            ? ' — correlació baixa / diversificació bona'
            : ' — correlació moderada'}
        </p>
      )}
    </div>
  );
}
