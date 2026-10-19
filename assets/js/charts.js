/* Dependency-free SVG chart renderer (line / step / area). */
window.Charts = (() => {
  "use strict";

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function render(host, cfg) {
    const W = 600;
    const H = cfg.height || 210;
    const m = { l: 54, r: 18, t: 14, b: 30 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const n = Math.max(cfg.labels.length, 2);
    const xs = (i) => m.l + (pw * i) / (n - 1);

    const vals = cfg.series.flatMap((s) => s.values.filter((v) => v !== null && v !== undefined));
    let lo, hi;
    if (cfg.log) {
      const lg = vals.map((v) => Math.log10(Math.max(v, 1e-9)));
      lo = Math.min(...lg, -7);
      hi = Math.max(...lg, -3);
    } else if (cfg.range) {
      [lo, hi] = cfg.range;
    } else {
      lo = Math.min(...vals);
      hi = Math.max(...vals);
      const pad = (hi - lo || 0.1) * 0.12;
      lo -= pad;
      hi += pad;
    }
    const ys = (v) => {
      const t = cfg.log ? Math.log10(Math.max(v, 1e-9)) : v;
      return m.t + ph - ((t - lo) / (hi - lo || 1)) * ph;
    };

    const parts = [];
    parts.push(`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cfg.title || "chart")}">`);
    parts.push(`<defs><linearGradient id="g${cfg.uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${cfg.series[0].color}" stop-opacity=".28"/>
      <stop offset="100%" stop-color="${cfg.series[0].color}" stop-opacity="0"/>
    </linearGradient></defs>`);

    for (let k = 0; k <= 4; k++) {
      const y = m.t + (ph * k) / 4;
      const raw = cfg.log ? Math.pow(10, hi - ((hi - lo) * k) / 4) : hi - ((hi - lo) * k) / 4;
      const label = cfg.log ? raw.toExponential(0) : raw.toFixed(cfg.decimals ?? 2);
      parts.push(`<line x1="${m.l}" y1="${y}" x2="${W - m.r}" y2="${y}" stroke="var(--line)" stroke-width="1"/>`);
      parts.push(`<text x="${m.l - 10}" y="${y + 4}" fill="var(--muted)" font-size="10.5" text-anchor="end" font-family="ui-monospace, monospace">${label}</text>`);
    }

    const step = Math.max(1, Math.ceil(cfg.labels.length / 8));
    cfg.labels.forEach((lab, i) => {
      if (i % step && i !== cfg.labels.length - 1) return;
      parts.push(`<text x="${xs(i)}" y="${H - 8}" fill="var(--muted)" font-size="10.5" text-anchor="middle" font-family="ui-monospace, monospace">${esc(lab)}</text>`);
    });

    cfg.series.forEach((s, si) => {
      const pts = s.values.map((v, i) => (v === null || v === undefined ? null : [xs(i), ys(v)])).filter(Boolean);
      if (pts.length < 2) return;
      let d;
      if (s.step) {
        d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
        for (let i = 1; i < pts.length; i++) d += ` H${pts[i][0].toFixed(1)} V${pts[i][1].toFixed(1)}`;
      } else {
        d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
      }
      if (si === 0 && cfg.area !== false) {
        parts.push(`<path d="${d} L${pts[pts.length - 1][0].toFixed(1)},${m.t + ph} L${pts[0][0].toFixed(1)},${m.t + ph} Z" fill="url(#g${cfg.uid})"/>`);
      }
      parts.push(`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="5 4"' : ""}/>`);
      const last = pts[pts.length - 1];
      parts.push(`<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.2" fill="${s.color}"/>`);
    });

    let lx = m.l;
    cfg.series.forEach((s) => {
      parts.push(`<rect x="${lx}" y="${m.t - 8}" width="9" height="3" rx="1.5" fill="${s.color}"/>`);
      parts.push(`<text x="${lx + 14}" y="${m.t - 3}" fill="var(--muted)" font-size="10.5">${esc(s.label)}</text>`);
      lx += 22 + s.label.length * 7;
    });

    parts.push("</svg>");
    host.innerHTML = parts.join("");
  }

  return { render, esc };
})();
