// 账号与订阅 → 图 (#accounts/graph): identities as hubs, accounts sized by priority, coloured by the shared 2FA state.
// Edges: login (email_id) · OAuth (login_via → provider account) · recovery (dashed, incl. identity → identity).
// Dependency-free: a small force layout + SVG. Deep-link params: ?focus=<identity id>  ?risky=1  ?q=<search>  ?cluster=1
import { M, accHref, catOf, catPages } from "../data.js";
import { twoFaState, weak2fa, isLiveAccount } from "../core.js";
import { buildModel, missingOf, mask, prank, prio } from "../identity.js";
import { esc } from "../ui.js";
const FA = { on: "已确认", unknown: "待确认 / 不确定", off: "未开启", na: "不适用" };
const R = a => [11, 8, 5.5][Math.min(prank(a), 2)] ?? 5.5;

export function graphModel() {
  const all = M.accounts?.items || [], m = buildModel(all, M.identities?.items || []);
  const accs = m.accs.filter(isLiveAccount), weak = new Set(weak2fa(accs).map(a => a._k));
  const spofI = new Set(m.spof.filter(s => s.kind === "identity").map(s => s.id)), spofA = new Set(m.spof.filter(s => s.kind === "account").map(s => s.key));
  const cats = Object.fromEntries(catPages().map(p => [p.slug, p.label]));
  const nodes = [
    ...m.ids.map(i => ({ id: `i:${i.id}`, kind: "id", label: i.label, sub: mask(String(i.address ?? "").replace(/[（(].*$/, "")), fa: i.na2fa ? "na" : twoFaState(i.two_fa), r: 18, spof: spofI.has(i.id), href: `#accounts/identities?id=${encodeURIComponent(i.id)}`, ref: i })),
    ...accs.map(a => { const c = catOf(a).slug; return { id: `a:${a._k}`, kind: "acc", label: a.service, cat: c, catLabel: cats[c] ?? c, p: prank(a), prio: prio(a) ?? "—", fa: twoFaState(a.two_fa), noRec: missingOf(a).includes("recovery"), weak: weak.has(a._k), spof: spofA.has(a._k), r: R(a), href: accHref(a), ref: a }; })];
  const has = new Set(nodes.map(n => n.id)), edges = [], seen = new Set();
  const add = (s, t, type, inferred) => { const k = `${s}|${t}|${type}`; if (s !== t && has.has(s) && has.has(t) && !seen.has(k)) { seen.add(k); edges.push({ s, t, type, inferred: !!inferred }); } };
  for (const a of accs) for (const e of a._edges) if (e.type !== "notify") add(`a:${a._k}`, e.id ? `i:${e.id}` : `a:${e.acc}`, e.type, e.inferred);
  for (const i of m.ids) { for (const r of i.recoveryIds || []) add(`i:${i.id}`, `i:${r}`, "recovery");
    if (i.anchor && isLiveAccount(i.anchor)) add(`i:${i.id}`, `a:${i.anchor._k}`, "anchor"); }
  for (const n of nodes) n.risky = n.kind === "acc" && (n.weak || n.spof || n.fa === "off");
  return { nodes, edges, ids: m.ids };
}
// everything that falls if `start` falls: follow edges backwards (X logs in / OAuths / recovers via Y ⇒ Y down ⇒ X exposed), plus the anchor account
export function blast(g, start) {
  const inc = {}; for (const e of g.edges) { if (e.type === "anchor") { (inc[e.s] ||= []).push(e.t); continue; } (inc[e.t] ||= []).push(e.s); }
  const out = new Set([start]), q = [start]; while (q.length) for (const x of inc[q.shift()] || []) if (!out.has(x)) { out.add(x); q.push(x); }
  return out;
}
function layout(g, W, H, cluster) {
  const N = g.nodes, ix = Object.fromEntries(N.map((n, i) => [n.id, i])), hubs = N.filter(n => n.kind === "id");
  const slugs = [...new Set(N.filter(n => n.cat).map(n => n.cat))], cc = Object.fromEntries(slugs.map((s, k) => [s, [W / 2 + Math.cos(k / slugs.length * 6.283) * W * .36, H / 2 + Math.sin(k / slugs.length * 6.283) * H * .36]]));
  hubs.forEach((n, k) => { n.x = W / 2 + Math.cos(k / hubs.length * 6.283 + .6) * W * .16; n.y = H / 2 + Math.sin(k / hubs.length * 6.283 + .6) * H * .16; });
  let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (const n of N) if (n.x == null) { const e = g.edges.find(e => e.s === n.id && e.t.startsWith("i:")), h = e && N[ix[e.t]]; n.x = (h?.x ?? W / 2) + (rnd() - .5) * 160; n.y = (h?.y ?? H / 2) + (rnd() - .5) * 160; }
  for (const n of N) { n.vx = 0; n.vy = 0; }
  for (let it = 0, a = 1; it < 360; it++, a *= .992) {
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) { const p = N[i], q = N[j]; let dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy || .01; if (d2 > 90000) continue;
      const f = (p.r + q.r + 10) * 30 / d2 * a; p.vx -= dx * f; p.vy -= dy * f; q.vx += dx * f; q.vy += dy * f; }
    for (const e of g.edges) { const p = N[ix[e.s]], q = N[ix[e.t]], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, L = e.type === "login" ? 70 : e.type === "anchor" ? 34 : 110, k = e.type === "recovery" ? .012 : .03;
      const f = (d - L) / d * k * a; p.vx += dx * f; p.vy += dy * f; q.vx -= dx * f; q.vy -= dy * f; }
    for (const n of N) { const [cx, cy] = cluster && n.cat ? cc[n.cat] : [W / 2, H / 2], gk = cluster && n.cat ? .03 : n.kind === "id" ? .01 : .022;
      n.vx += (cx - n.x) * gk * a; n.vy += (cy - n.y) * gk * a; n.vx *= .6; n.vy *= .6; n.x += n.vx; n.y += n.vy; }
  }
}
export function render(P) {
  const g = graphModel(), acc = g.nodes.filter(n => n.kind === "acc"), w = acc.filter(n => n.weak).length;
  const opt = (v, t) => `<option value="${esc(v)}">${esc(t)}</option>`;
  const cats = [...new Map(acc.map(n => [n.cat, n.catLabel]))];
  return `<div class="gx" data-focus="${esc(P.get("focus") ?? "")}">
    <div class="gx-bar">
      <input class="gx-q" type="search" placeholder="搜索账号…" value="${esc(P.get("q") ?? "")}">
      <select data-f="p">${opt("", "全部优先级")}${opt("0", "P0")}${opt("1", "P1")}${opt("2", "P2+")}</select>
      <select data-f="id">${opt("", "全部身份")}${g.ids.map(i => opt(`i:${i.id}`, i.label)).join("")}</select>
      <select data-f="cat">${opt("", "全部分类")}${cats.map(([s, l]) => opt(s, l)).join("")}</select>
      <select data-f="fa">${opt("", "全部 2FA")}${opt("on", "已确认")}${opt("unknown", "待确认")}${opt("off", "未开启")}</select>
      <label class="gx-ck"><input type="checkbox" data-f="risky" ${P.get("risky") ? "checked" : ""}> 只看有风险（2FA 未确认 · 单点）</label>
      <label class="gx-ck"><input type="checkbox" data-f="cluster" ${P.get("cluster") ? "checked" : ""}> 按分类聚类</label>
      <span class="gx-n">${g.nodes.length} 节点 · ${g.edges.length} 连线 · <b class="w">${w}</b> 个重要账号 2FA 未确认</span>
    </div>
    <div class="gx-stage"><svg class="gx-svg"><g class="gx-vp"><g class="gx-e"></g><g class="gx-v"></g></g></svg>
      <div class="gx-tip" hidden></div><div class="gx-info" hidden></div>
      <div class="gx-leg">
        <div><i class="d on"></i>2FA 已确认</div><div><i class="d unknown"></i>P0/P1 待确认 / 不确定</div><div><i class="d lo"></i>其他 待确认</div><div><i class="d off"></i>未开启</div><div><i class="d na"></i>不适用</div>
        <div><i class="d ring"></i>缺恢复方式</div><div><i class="d spof"></i>单点故障</div><div><i class="d hub"></i>身份（点击看影响范围）</div>
        <div><i class="l"></i>绑定邮箱 / 手机</div><div><i class="l oauth"></i>OAuth 登录</div><div><i class="l rec"></i>恢复链</div>
        <div class="s">大小 = 优先级 P0 › P1 › P2+ · 滚轮缩放 · 拖动平移 / 节点</div></div>
      <div class="gx-zoom"><button data-z="1.25">+</button><button data-z="0.8">−</button><button data-z="0">⟲</button></div>
    </div></div>`;
}
export function mount(root) {
  const el = root.querySelector(".gx"); if (!el) return;
  const g = graphModel(), svg = el.querySelector(".gx-svg"), vp = el.querySelector(".gx-vp"), tip = el.querySelector(".gx-tip"), info = el.querySelector(".gx-info");
  const NS = "http://www.w3.org/2000/svg", mk = (t, a) => { const x = document.createElementNS(NS, t); for (const k in a) x.setAttribute(k, a[k]); return x; };
  const byId = Object.fromEntries(g.nodes.map(n => [n.id, n]));
  let W = svg.clientWidth || 1000, H = svg.clientHeight || 640, view = { x: 0, y: 0, k: 1 }, focus = el.dataset.focus ? (el.dataset.focus.startsWith("i:") ? el.dataset.focus : `i:${el.dataset.focus}`) : null, radius = null;
  const setView = () => vp.setAttribute("transform", `translate(${view.x},${view.y}) scale(${view.k})`);
  const draw = () => {
    const E = el.querySelector(".gx-e"), V = el.querySelector(".gx-v"); E.textContent = ""; V.textContent = "";
    for (const e of g.edges) { e.el = mk("line", { class: `ge ${e.type}${e.inferred ? " inf" : ""}` }); E.append(e.el); }
    for (const n of g.nodes) { const G = mk("g", { class: `gn ${n.kind} fa-${n.fa}${n.kind === "acc" && n.fa === "unknown" && !n.weak ? " lo" : ""}${n.noRec ? " norec" : ""}${n.spof ? " spof" : ""}`, tabindex: 0 });
      if (n.spof) G.append(mk("circle", { r: n.r + 5, class: "halo" }));
      G.append(mk("circle", { r: n.r, class: "dot" }));
      if (n.kind === "id" || n.p <= 1) { const t = mk("text", { y: n.r + 12, class: n.kind === "id" ? "lb hub" : "lb" }); t.textContent = n.label.length > 16 ? n.label.slice(0, 15) + "…" : n.label; G.append(t); }
      n.el = G; G.__n = n; V.append(G); }
    pos();
  };
  const pos = () => { for (const e of g.edges) { const a = byId[e.s], b = byId[e.t]; e.el.setAttribute("x1", a.x); e.el.setAttribute("y1", a.y); e.el.setAttribute("x2", b.x); e.el.setAttribute("y2", b.y); }
    for (const n of g.nodes) n.el.setAttribute("transform", `translate(${n.x},${n.y})`); };
  const val = f => el.querySelector(`[data-f="${f}"]`)?.[f === "risky" || f === "cluster" ? "checked" : "value"];
  const apply = () => {
    const p = val("p"), idf = val("id"), cat = val("cat"), fa = val("fa"), risky = val("risky"), q = el.querySelector(".gx-q").value.trim().toLowerCase();
    const near = idf ? blast(g, idf) : null;
    for (const n of g.nodes) { let show = true;
      if (n.kind === "acc") { if (p !== "" && Math.min(n.p, 2) !== +p) show = false; if (cat && n.cat !== cat) show = false; if (fa && n.fa !== fa) show = false; if (risky && !n.risky) show = false; if (near && !near.has(n.id)) show = false; }
      n.show = show; n.el.style.display = show ? "" : "none";
      const hit = q && (n.label.toLowerCase().includes(q) || String(n.ref?.provider ?? "").toLowerCase().includes(q));
      n.el.classList.toggle("hit", !!hit); n.el.classList.toggle("dim", !!(q && !hit) || !!(radius && !radius.has(n.id))); n.el.classList.toggle("blast", !!(radius && radius.has(n.id))); }
    for (const e of g.edges) { const ok = byId[e.s].show && byId[e.t].show; e.el.style.display = ok ? "" : "none";
      e.el.classList.toggle("dim", !!(radius && !(radius.has(e.s) && radius.has(e.t))) || !!q); e.el.classList.toggle("blast", !!(radius && radius.has(e.s) && radius.has(e.t))); }
  };
  const showInfo = n => { if (!n) { info.hidden = true; return; } const xs = [...radius].map(k => byId[k]).filter(x => x.kind === "acc"), wk = xs.filter(x => x.weak).length, ids = [...radius].filter(k => k.startsWith("i:") && k !== n.id).map(k => byId[k].label);
    info.innerHTML = `<b>${esc(n.label)}</b> <span class="s">${esc(n.sub || "")}</span><div>失守会波及 <b>${xs.length}</b> 个账号（P0/P1 ${xs.filter(x => x.p <= 1).length}，其中 <span class="w">${wk}</span> 个 2FA 未确认）${ids.length ? `，以及身份 ${ids.map(esc).join("、")}` : ""}</div><a href="${n.href}">打开身份视图 →</a> · <a href="#" data-clear>清除</a>`; info.hidden = false; };
  const setFocus = id => { focus = id; radius = id ? blast(g, id) : null; showInfo(id && byId[id]); apply(); };
  const relayout = () => { for (const n of g.nodes) n.x = n.y = null; layout(g, W, H, val("cluster")); pos(); fit(); };
  const fit = () => { const xs = g.nodes.map(n => n.x), ys = g.nodes.map(n => n.y), x0 = Math.min(...xs) - 40, x1 = Math.max(...xs) + 40, y0 = Math.min(...ys) - 40, y1 = Math.max(...ys) + 50;
    view.k = Math.min(W / (x1 - x0), H / (y1 - y0), 1.6); view.x = (W - (x1 + x0) * view.k) / 2; view.y = (H - (y1 + y0) * view.k) / 2; setView(); };
  layout(g, W, H, val("cluster")); draw(); fit(); setFocus(focus);
  // interaction: wheel zoom, background pan, node drag, hover tooltip, click → detail / blast radius
  svg.addEventListener("wheel", ev => { ev.preventDefault(); const r = svg.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, f = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    view.x = mx - (mx - view.x) * f; view.y = my - (my - view.y) * f; view.k *= f; setView(); }, { passive: false });
  let drag = null;
  svg.addEventListener("pointerdown", ev => { const G = ev.target.closest(".gn"); drag = { n: G?.__n, sx: ev.clientX, sy: ev.clientY, vx: view.x, vy: view.y, moved: false }; svg.setPointerCapture(ev.pointerId); });
  svg.addEventListener("pointermove", ev => {
    if (drag) { const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (drag.n) { const r = svg.getBoundingClientRect(); drag.n.x = (ev.clientX - r.left - view.x) / view.k; drag.n.y = (ev.clientY - r.top - view.y) / view.k; pos(); } else { view.x = drag.vx + dx; view.y = drag.vy + dy; setView(); } tip.hidden = true; return; }
    const G = ev.target.closest(".gn"); if (!G) { tip.hidden = true; return; } const n = G.__n, r = el.querySelector(".gx-stage").getBoundingClientRect();
    tip.innerHTML = n.kind === "id" ? `<b>${esc(n.label)}</b><div class="s">${esc(n.sub || "身份")}</div><div>2FA ${FA[n.fa]}${n.spof ? " · <span class='w'>单点故障</span>" : ""}</div><div class="s">点击查看影响范围</div>`
      : `<b>${esc(n.label)}</b><div class="s">${esc(n.catLabel)} · ${esc(n.prio)}</div><div>2FA ${FA[n.fa]}${n.noRec ? " · <span class='w'>缺恢复方式</span>" : ""}${n.spof ? " · <span class='w'>单点故障</span>" : ""}</div><div class="s">${esc([...(n.ref._via || [])].map(mask).join(" / ") || "未绑定身份")}</div><div class="s">点击打开详情</div>`;
    tip.hidden = false; tip.style.left = `${ev.clientX - r.left + 14}px`; tip.style.top = `${ev.clientY - r.top + 10}px`; });
  svg.addEventListener("pointerup", () => { const d = drag; drag = null; if (!d || d.moved) return; if (!d.n) { if (focus) setFocus(null); return; }
    if (d.n.kind === "id") setFocus(focus === d.n.id ? null : d.n.id); else location.hash = d.n.href; });
  svg.addEventListener("pointerleave", () => { tip.hidden = true; });
  info.addEventListener("click", ev => { if (ev.target.matches("[data-clear]")) { ev.preventDefault(); setFocus(null); } });
  el.querySelectorAll("[data-f]").forEach(x => x.addEventListener("change", () => x.dataset.f === "cluster" ? (relayout(), apply()) : apply()));
  el.querySelector(".gx-q").addEventListener("input", apply);
  el.querySelectorAll("[data-z]").forEach(b => b.addEventListener("click", () => { const f = +b.dataset.z; if (!f) return fit(); view.x = W / 2 - (W / 2 - view.x) * f; view.y = H / 2 - (H / 2 - view.y) * f; view.k *= f; setView(); }));
}
