// Dependency-free SVG charts. Colors come from CSS vars (L-* classes) so they follow the theme.
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const PALETTE = ["agent", "coding", "ai", "modes", "tui", "ext", "infra", "err"];
const col = c => `var(--${c})`;
const legend = segs => `<div class="legend">${segs.map(s => `<span class="L-${s.c}"><i></i>${esc(s.label)} <b class="mono">${s.v}</b></span>`).join("")}</div>`;

export function donut(segs, { title = "", size = 168, stroke = 22 } = {}) {
  const tot = segs.reduce((a, s) => a + s.v, 0) || 1, r = (size - stroke) / 2, C = 2 * Math.PI * r, cx = size / 2;
  let off = 0;
  const arcs = segs.filter(s => s.v > 0).map(s => { const len = (s.v / tot) * C;
    const a = `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${col(s.c)}" stroke-width="${stroke}" stroke-dasharray="${Math.max(len - 2, 0.1)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cx})"><title>${esc(s.label)}: ${s.v}</title></circle>`;
    off += len; return a; }).join("");
  return `<div class="chart"><svg viewBox="0 0 ${size} ${size}" style="max-width:${size}px;margin:0 auto">
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--bg-2)" stroke-width="${stroke}"/>${arcs}
    <text x="${cx}" y="${cx + 4}" text-anchor="middle" class="big">${segs.reduce((a, s) => a + s.v, 0)}</text>
    <text x="${cx}" y="${cx + 22}" text-anchor="middle">${esc(title)}</text></svg>${legend(segs)}</div>`;
}

// Vertical stacked bars: cats = [{label, parts:[{c, v, label}]}]
export function stackedBars(cats, { h = 190, unit = "", series = [], W = 640 } = {}) {
  const pad = { l: 44, r: 8, t: 10, b: 26 }, iw = W - pad.l - pad.r, ih = h - pad.t - pad.b;
  const max = Math.max(1, ...cats.map(c => c.parts.reduce((a, p) => a + p.v, 0)));
  const e = Math.pow(10, Math.floor(Math.log10(max))), nice = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(k => k * e).find(n => n >= max);
  const bw = iw / cats.length, y = v => pad.t + ih - (v / nice) * ih;
  let g = [0, .5, 1].map(f => `<line class="grid-l" x1="${pad.l}" x2="${W - pad.r}" y1="${y(nice * f)}" y2="${y(nice * f)}"/><text x="${pad.l - 6}" y="${y(nice * f) + 3}" text-anchor="end">${Math.round(nice * f)}</text>`).join("");
  g += cats.map((c, i) => { let acc = 0; const x = pad.l + i * bw + bw * .18, w = bw * .64;
    const rects = c.parts.filter(p => p.v > 0).map(p => { const r = `<rect x="${x}" y="${y(acc + p.v)}" width="${w}" height="${Math.max(y(acc) - y(acc + p.v), 0)}" rx="3" fill="${col(p.c)}"><title>${esc(c.label)} · ${esc(p.label)}: ${p.v.toFixed ? p.v.toFixed(0) : p.v}${unit}</title></rect>`; acc += p.v; return r; }).join("");
    return rects + `<text x="${x + w / 2}" y="${h - 8}" text-anchor="middle">${esc(c.label)}</text>`; }).join("");
  return `<div class="chart"><svg viewBox="0 0 ${W} ${h}">${g}</svg>${series.length ? legend(series) : ""}</div>`;
}

// Horizontal bars list (Pi .bars style): rows = [{label, v, c}]
export function hbars(rows, { unit = "" } = {}) {
  const max = Math.max(1, ...rows.map(r => r.v));
  return `<div class="prog">${rows.map(r => `<div class="pr L-${r.c || "accent"}"><span class="nm" title="${esc(r.label)}">${esc(r.label)}</span><span class="tr"><span class="s" style="width:${(r.v / max) * 100}%;display:block"></span></span><span class="v">${Math.round(r.v)}${unit}</span></div>`).join("")}</div>`;
}

export function progress(rows) { // rows: [{label, done, total, c}]
  return `<div class="prog">${rows.map(r => { const p = r.total ? Math.round(r.done / r.total * 100) : 0;
    const c = r.c || (p >= 80 ? "ai" : p >= 50 ? "modes" : "err");
    return `<div class="pr L-${c}" title="${r.done}/${r.total}"><span class="nm">${esc(r.label)}</span><span class="tr"><span class="s" style="width:${p}%;display:block"></span></span><span class="v">${p}%</span></div>`; }).join("")}</div>`;
}

// Timeline: one lane per item so labels never collide. items [{label, days, c}]
export function timeline(items, { past = 30, future = 120 } = {}) {
  const W = 760, lane = 22, top = 10, H = top + Math.max(1, items.length) * lane + 34, padL = 170, padR = 20;
  const x = d => padL + ((Math.max(-past, Math.min(future, d)) + past) / (past + future)) * (W - padL - padR), axis = H - 28;
  const ticks = [-past, 0, 30, 60, 90, future].filter((v, i, a) => a.indexOf(v) === i && v <= future);
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">
   <rect x="${x(0)}" y="${top - 4}" width="${x(14) - x(0)}" height="${axis - top + 4}" fill="var(--modes)" opacity=".09" rx="4"/>
   ${ticks.map(t => `<line class="grid-l" x1="${x(t)}" x2="${x(t)}" y1="${top - 4}" y2="${axis}"/><text x="${x(t)}" y="${axis + 16}" text-anchor="middle">${t === 0 ? "今天" : (t > 0 ? "+" : "") + t + "d"}</text>`).join("")}
   <line x1="${padL}" x2="${W - padR}" y1="${axis}" y2="${axis}" stroke="var(--border-2)"/>
   <line x1="${x(0)}" x2="${x(0)}" y1="${top - 4}" y2="${axis}" stroke="var(--accent)" stroke-width="1.5"/>
   ${items.map((r, i) => { const cy = top + i * lane + lane / 2, cx = x(r.days);
     return `<text x="${padL - 10}" y="${cy + 4}" text-anchor="end" class="lbl">${esc(String(r.label).slice(0, 16))}</text>
     <line x1="${x(0)}" x2="${cx}" y1="${cy}" y2="${cy}" stroke="${col(r.c)}" stroke-width="3" opacity=".28" stroke-linecap="round"/>
     <circle cx="${cx}" cy="${cy}" r="6" fill="${col(r.c)}" stroke="var(--surface)" stroke-width="2"><title>${esc(r.label)} (${r.days}d)</title></circle>
     <text x="${cx + (r.days > future - 25 ? -10 : 10)}" y="${cy + 4}" text-anchor="${r.days > future - 25 ? "end" : "start"}">${r.days < 0 ? r.days + "d" : r.days === 0 ? "今天" : "+" + r.days + "d"}</text>`; }).join("")}
  </svg></div>`;
}

// Bipartite flow diagram: left nodes -> right nodes with weighted curves.
export function flow(left, right, edges, { leftC = "coding", h } = {}) {
  const W = 560, rowH = 30, H = h || Math.max(left.length, right.length) * rowH + 20;
  const ly = i => 10 + (i + .5) * ((H - 20) / left.length), ry = i => 10 + (i + .5) * ((H - 20) / right.length);
  const lx = 130, rx = W - 150, maxW = Math.max(1, ...edges.map(e => e.v));
  const paths = edges.map(e => { const i = left.findIndex(n => n.id === e.from), j = right.findIndex(n => n.id === e.to); if (i < 0 || j < 0) return "";
    const y1 = ly(i), y2 = ry(j), sw = 1.5 + (e.v / maxW) * 7;
    return `<path d="M${lx} ${y1} C ${(lx + rx) / 2} ${y1}, ${(lx + rx) / 2} ${y2}, ${rx} ${y2}" fill="none" stroke="${col(right[j].c)}" stroke-width="${sw}" opacity=".5" stroke-linecap="round"><title>${esc(e.from)} → ${esc(right[j].label)}: ${e.v}</title></path>`; }).join("");
  const nodeL = left.map((n, i) => `<g opacity="${n.active ? 1 : .45}"><rect x="10" y="${ly(i) - 13}" width="${lx - 10}" height="26" rx="8" fill="var(--${leftC}-bg)" stroke="var(--${leftC})" stroke-opacity=".4"/><text x="22" y="${ly(i) + 4}" class="lbl">${esc(n.label)}</text><text x="${lx - 10}" y="${ly(i) + 4}" text-anchor="end">${n.n ?? ""}</text></g>`).join("");
  const nodeR = right.map((n, i) => `<g><rect x="${rx}" y="${ry(i) - 13}" width="140" height="24" rx="8" fill="var(--${n.c}-bg)" stroke="var(--${n.c})" stroke-opacity=".5"/><text x="${rx + 12}" y="${ry(i) + 4}" class="lbl">${esc(n.label)}</text><text x="${rx + 130}" y="${ry(i) + 4}" text-anchor="end">${n.n ?? ""}</text></g>`).join("");
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">${paths}${nodeL}${nodeR}</svg></div>`;
}
