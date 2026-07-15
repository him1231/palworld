import { useEffect, useRef } from 'react';

/**
 * Global hover tooltip: any element with a `data-tip` attribute gets a styled
 * fixed-position bubble (never clipped by scroll containers, unlike CSS-only
 * tooltips). Use "|" in data-tip for line breaks.
 */
export default function TooltipLayer() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    let target: HTMLElement | null = null;

    const move = (x: number, y: number) => {
      const pad = 12;
      const r = el.getBoundingClientRect();
      let left = x + 14;
      let top = y + 16;
      if (left + r.width + pad > window.innerWidth) left = x - r.width - 10;
      if (top + r.height + pad > window.innerHeight) top = y - r.height - 10;
      el.style.left = `${Math.max(4, left)}px`;
      el.style.top = `${Math.max(4, top)}px`;
    };

    const over = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest('[data-tip]') as HTMLElement | null;
      if (t !== target) {
        target = t;
        if (t) {
          const tip = t.getAttribute('data-tip') ?? '';
          el.innerHTML = tip.split('|').map((line) => `<div>${line
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`).join('');
          el.style.display = 'block';
        } else {
          el.style.display = 'none';
        }
      }
      if (target) move(e.clientX, e.clientY);
    };
    const out = () => { target = null; el.style.display = 'none'; };

    document.addEventListener('mousemove', over, { passive: true });
    document.addEventListener('mouseleave', out);
    return () => {
      document.removeEventListener('mousemove', over);
      document.removeEventListener('mouseleave', out);
    };
  }, []);

  return <div ref={ref} className="tooltip-layer" style={{ display: 'none' }} />;
}
