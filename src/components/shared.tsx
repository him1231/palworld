import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ElementName, Pal } from '../lib/types';
import { elementIconUrl, palIconUrl, workIconUrl } from '../lib/data';
import { ELEMENT_ZH, WORK_ZH, palDisplayName } from '../lib/i18n';
import type { WorkName } from '../lib/types';

export function PalIcon({ pal, size = 32 }: { pal: Pal; size?: number }) {
  const url = palIconUrl(pal);
  return url
    ? <img src={url} width={size} height={size} alt={palDisplayName(pal)} loading="lazy" style={{ borderRadius: '50%' }} />
    : <span style={{ width: size, height: size, display: 'inline-block', borderRadius: '50%', background: 'var(--surface-3)' }} />;
}

export function ElementBadge({ el }: { el: ElementName }) {
  return (
    <span className="elem-badge">
      <img src={elementIconUrl(el)} alt="" />
      {ELEMENT_ZH[el]}
    </span>
  );
}

export function WorkBadge({ work, level }: { work: WorkName; level: number }) {
  return (
    <span className="workitem" title={WORK_ZH[work]}>
      <img src={workIconUrl(work)} alt={WORK_ZH[work]} />
      {level}
    </span>
  );
}

export function PalNameCell({ pal }: { pal: Pal }) {
  return (
    <Link to={`/pal/${pal.id}`} style={{ color: 'inherit' }}>
      <span className="pal-cell">
        <PalIcon pal={pal} />
        <span className="names">
          <div>{pal.nameZh ?? pal.name}</div>
          <div className="en">{pal.nameZh ? pal.name : pal.id}</div>
        </span>
      </span>
    </Link>
  );
}

export function StatBar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span className="statbar">
      <span className="track"><span className="fill" style={{ width: `${pct}%` }} /></span>
      <span className="val">{value}</span>
    </span>
  );
}

/** searchable pal picker (zh / en / id) */
export function PalPicker({ pals, onPick, placeholder = '搜尋帕魯（中/英文名）…', clearOnPick = true }: {
  pals: Pal[];
  onPick: (pal: Pal) => void;
  placeholder?: string;
  clearOnPick?: boolean;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return pals
      .filter((p) =>
        (p.nameZh ?? '').toLowerCase().includes(s)
        || p.name.toLowerCase().includes(s)
        || p.id.toLowerCase().includes(s)
        || String(p.paldexNumber) === s)
      .slice(0, 30);
  }, [pals, q]);

  return (
    <div className="pal-select" ref={boxRef}>
      <input
        type="search"
        value={q}
        placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <div className="menu">
          {results.map((p) => (
            <button key={p.id} className="opt" onMouseDown={(e) => e.preventDefault()} onClick={() => {
              onPick(p);
              if (clearOnPick) setQ('');
              setOpen(false);
            }}>
              <PalIcon pal={p} size={24} />
              <span>#{p.paldexNumber} {palDisplayName(p)}</span>
              <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{p.nameZh ? p.name : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
