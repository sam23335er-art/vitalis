import { t } from '../i18n.jsx';
// Линейный график веса: одна серия (легенда не нужна — название в заголовке карточки),
// пунктир — цель, подсказка при наведении на ближайшую точку.
import { useMemo, useRef, useState } from 'react';
import { shortDate } from '../lib/format.js';

const W = 640;
const H = 220;
const PAD = { l: 40, r: 16, t: 16, b: 28 };

export default function WeightChart({ points, target }) {
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);

  const geo = useMemo(() => {
    const vals = points.map((p) => p.weight).concat(target ? [target] : []);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (max - min < 2) {
      min -= 1;
      max += 1;
    }
    const padY = (max - min) * 0.12;
    min = Math.floor(min - padY);
    max = Math.ceil(max + padY);
    const n = points.length;
    const x = (i) => PAD.l + (n === 1 ? (W - PAD.l - PAD.r) / 2 : (i / (n - 1)) * (W - PAD.l - PAD.r));
    const y = (v) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
    const step = Math.max(1, Math.ceil((max - min) / 4));
    const ticks = [];
    for (let v = min; v <= max; v += step) ticks.push(v);
    return { x, y, ticks };
  }, [points, target]);

  if (!points.length) return null;
  const { x, y, ticks } = geo;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.weight).toFixed(1)}`).join(' ');

  const onMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setHover(best);
  };

  const hp = hover !== null ? points[hover] : null;
  const labelIdx = new Set([0, points.length - 1]);

  return (
    <div className="chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t('График веса: от {a} до {b} кг', { a: points[0].weight, b: points[points.length - 1].weight })}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => onMove(e.touches[0])}
      >
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(tk)} y2={y(tk)} className="chart-grid" />
            <text x={PAD.l - 8} y={y(tk) + 4} className="chart-axis" textAnchor="end">
              {tk}
            </text>
          </g>
        ))}
        {target && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} className="chart-goal" />
            <text x={W - PAD.r} y={y(target) - 6} textAnchor="end" className="chart-axis">
              {t('цель {n} кг', { n: target })}
            </text>
          </g>
        )}
        <path d={d} className="chart-line" />
        {points.map((p, i) => (
          <circle key={p.id || p.date} cx={x(i)} cy={y(p.weight)} r={hover === i ? 6 : 4} className="chart-dot" />
        ))}
        {points.map((p, i) =>
          labelIdx.has(i) && hover === null ? (
            <text key={`l${i}`} x={x(i)} y={y(p.weight) - 12} textAnchor={i === 0 && points.length > 1 ? 'start' : 'end'} className="chart-value">
              {p.weight}
            </text>
          ) : null
        )}
        {points.length > 1 &&
          [0, points.length - 1].map((i) => (
            <text key={`d${i}`} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : 'end'} className="chart-axis">
              {shortDate(points[i].date)}
            </text>
          ))}
        {hp && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="chart-cross" />}
      </svg>
      {hp && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <strong>{hp.weight} {t('кг')}</strong>
          <span>{shortDate(hp.date)}</span>
        </div>
      )}
    </div>
  );
}
