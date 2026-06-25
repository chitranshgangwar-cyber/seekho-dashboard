import React, { useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Line } from "recharts";
import { F, ROWS, CAMPS, ADSETS, PC, PERIODS, META } from "./data_ncad.js";
import { MERGE } from "./mergedata.js";

/* ---------- reconstruct rows (attach per-period stage funnel) ---------- */
const ALL = ROWS.map((r, i) => { const o = {}; F.forEach((f, j) => (o[f] = r[j])); o._pc = PC[i] || []; o.adsetName = ADSETS[o.as] || "—"; o.campName = CAMPS[o.cp] || "—"; return o; });

/* ---------- palette ---------- */
const C = { bg: "#F7F7FB", card: "#FFFFFF", line: "#ECECF3", ink: "#15161D", sub: "#6B7280", muted: "#9AA1AC", primary: "#6D28D9", primarySoft: "#EDE6FB", sky: "#0EA5E9" };
const GREEN = [22, 163, 74], RED = [220, 38, 38];
const GREEN_VL = [220, 252, 231], GREEN_D = [21, 128, 61];
const RED_VL = [254, 226, 226], RED_D = [185, 28, 28];

/* ---------- formatters ---------- */
const inr = (v) => (v == null ? "—" : "₹" + Math.round(v).toLocaleString("en-IN"));
const inrK = (v) => { if (v == null) return "—"; const a = Math.abs(v); if (a >= 1e7) return "₹" + (v / 1e7).toFixed(2) + "Cr"; if (a >= 1e5) return "₹" + (v / 1e5).toFixed(2) + "L"; if (a >= 1e3) return "₹" + Math.round(v / 1e3) + "k"; return "₹" + Math.round(v); };
const p1 = (v) => (v == null ? "—" : v.toFixed(1) + "%");
const p2 = (v) => (v == null ? "—" : v.toFixed(2) + "%");
const intf = (v) => (v == null ? "—" : Math.round(v).toLocaleString("en-IN"));
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtD = (iso) => { const p = String(iso).split("-"); return +p[2] + " " + MON[+p[1] - 1]; };
const FWIN = `${fmtD(META.funnel_span[0])} – ${fmtD(META.funnel_span[1])}`;
const wkRange = (key) => {
  const m = String(key).match(/(\d{4})-W(\d{1,2})/);
  if (!m) return key;
  const year = +m[1], week = +m[2];
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = (jan4.getUTCDay() + 6) % 7;
  const mon = new Date(jan4); mon.setUTCDate(jan4.getUTCDate() - dow + (week - 1) * 7);
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
  const D = (d) => d.getUTCDate(), Mo = (d) => MON[d.getUTCMonth()];
  return Mo(mon) === Mo(sun) ? `${D(mon)}\u2013${D(sun)} ${Mo(mon)}` : `${D(mon)} ${Mo(mon)}\u2013${D(sun)} ${Mo(sun)}`;
};

/* ---------- metrics ---------- */
const M = {
  sp:  { label: "Spend",       f: inrK, dir: "high", num: "sp" },
  cpr: { label: "CPR",         f: inr,  dir: "low",  num: "sp",  den: "res" },
  ctr: { label: "CTR %",       f: p2,   dir: "high", num: "cl",  den: "im",  sc: 100 },
  hk:  { label: "Hook rate %", f: p1,   dir: "high", num: "p3",  den: "im",  sc: 100 },
  hd:  { label: "Hold rate %", f: p1,   dir: "high", num: "tp",  den: "im",  sc: 100 },
  cac: { label: "CAC",         f: inr,  dir: "low",  num: "fc",  den: "pd",  recent: true },
  un:  { label: "Uninstall %", f: p1,   dir: "low",  num: "nun", den: "pd",  sc: 100, recent: true },
  cx:  { label: "Cancel %",    f: p1,   dir: "low",  num: "ncx", den: "pd",  sc: 100, recent: true },
  ex:  { label: "Exit %",      f: p1,   dir: "low",  num: "nex", den: "pd",  sc: 100, recent: true },
};
const DIMS = [["cat", "Category"], ["fmt", "Format"], ["vis", "Visual"], ["ai", "AI / Human"], ["face", "Face / Faceless"], ["strat", "New / Expansion"], ["hook", "Hook"], ["script", "Script / angle"], ["stage", "Scaling / Testing"], ["creator", "Creator"], ["campName", "Campaign"], ["adsetName", "Adset"]];

/* ---------- math ---------- */
const sum = (a) => a.reduce((s, x) => s + (x || 0), 0);
const median = (a) => { const v = a.filter((x) => x != null && !isNaN(x)).sort((x, y) => x - y); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const metricVal = (rows, key) => {
  const m = M[key];
  const n = sum(rows.map((r) => r[m.num] || 0));
  if (!m.den) return n;
  const d = sum(rows.map((r) => r[m.den] || 0));
  return d ? (m.sc || 1) * n / d : null;
};
const rowVal = (r, key) => metricVal([r], key);
// aggregate unified per-period cells [pidx,stc,sp,pd,nun,ncx,im,cl,res,p3,tp] over a set of period indices
const aggPC = (rows, idxSet) => {
  let sp = 0, pd = 0, nun = 0, ncx = 0, im = 0, cl = 0, res = 0, p3 = 0, tp = 0;
  for (const r of rows) { const pc = r._pc; for (let i = 0; i < pc.length; i++) { const c = pc[i]; if (!idxSet.has(c[0])) continue; sp += c[2]; pd += c[3]; nun += c[4]; ncx += c[5]; im += c[6]; cl += c[7]; res += c[8]; p3 += c[9]; tp += c[10]; } }
  return { sp, pd, nun, ncx, im, cl, res, p3, tp };
};
const lerp = (a, b, t) => Math.round(a + (b - a) * t);

/* ---------- heat: near-median stays light, extremes saturate hard (broad spectrum) ---------- */
function heat(v, lo, hi, dir) {
  if (v == null) return "transparent";
  if (hi === lo) return "rgba(100,116,139,0.06)";
  let p = (v - lo) / (hi - lo); if (dir === "low") p = 1 - p;
  const col = p >= 0.5 ? GREEN : RED;
  const a = 0.04 + Math.pow(Math.abs(p - 0.5) * 2, 1.35) * 0.6;
  return `rgba(${col[0]},${col[1]},${col[2]},${a.toFixed(3)})`;
}
function barColor(p) {
  const t = Math.pow(Math.abs(p - 0.5) * 2, 1.2);
  const a = p >= 0.5 ? GREEN_VL : RED_VL, b = p >= 0.5 ? GREEN_D : RED_D;
  return `rgb(${lerp(a[0], b[0], t)},${lerp(a[1], b[1], t)},${lerp(a[2], b[2], t)})`;
}

/* ---------- icons ---------- */
const Ic = ({ d, s = 16 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const iGrid = <Ic d={<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>} />;
const iSpark = <Ic d={<><path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5z" /></>} />;
const iTrend = <Ic d={<><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></>} />;
const iTable = <Ic d={<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /></>} />;
const iArrow = <Ic s={12} d={<><path d="M7 17 17 7M7 7h10v10" /></>} />;
const iLayers = <Ic d={<><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></>} />;

/* ---------- small UI ---------- */
const iTree = <Ic d={<><path d="M4 5h16M8 12h12M12 19h8" /><path d="M4 5v14" /></>} />;
const Seg = ({ options, value, onChange }) => (
  <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
    {options.map((o) => <button key={o} onClick={() => onChange(o)} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${value === o ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{o}</button>)}
  </div>
);
const Drop = ({ label, value, onChange, options }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[10px] font-semibold tracking-wide uppercase text-slate-400">{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 min-w-[120px]">
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  </label>
);
const Card = ({ title, sub, right, icon, children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl p-5 ${className}`}>
    {(title || right) && (
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-violet-600">{icon}</span>}
          <div className="min-w-0"><div className="font-semibold text-slate-800 text-[15px] leading-tight">{title}</div>{sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}</div>
        </div>
        {right}
      </div>
    )}
    {children}
  </div>
);
const Badge = ({ children, tone = "slate" }) => {
  const t = { slate: "bg-slate-100 text-slate-500", recent: "bg-amber-50 text-amber-700 border border-amber-200" }[tone];
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${t}`}>{children}</span>;
};

/* ---------- KPI ---------- */
function Kpi({ label, value, sub, accent, onClick, idx = 0 }) {
  return (
    <div onClick={onClick} style={{ animationDelay: idx * 40 + "ms" }} className={`fade-up bg-white border border-slate-200 rounded-2xl px-4 py-3.5 ${onClick ? "cursor-pointer hover:border-violet-300 hover:shadow-md transition-all" : ""}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-semibold tracking-wide uppercase text-slate-400 leading-tight">{label}</span>
        {onClick && <span className="text-slate-300">{iArrow}</span>}
      </div>
      <div className="mt-1.5 text-[26px] font-bold tracking-tight" style={{ color: accent || C.ink, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ---------- ranked board (signature) ---------- */
function Ranked({ rows, dim, metricKey, minN }) {
  const groups = useMemo(() => {
    const g = {};
    rows.forEach((r) => { const k = (r[dim] && String(r[dim]).trim()) || "—"; (g[k] ||= []).push(r); });
    let arr = Object.entries(g).map(([k, rs]) => ({ key: k, n: rs.length, spend: sum(rs.map((r) => r.sp)), cov: M[metricKey].den ? rs.filter((r) => (r[M[metricKey].den] || 0) > 0).length : rs.length, val: metricVal(rs, metricKey) }));
    arr = arr.filter((x) => x.n >= minN && x.val != null);
    arr.sort((a, b) => (M[metricKey].dir === "low" ? a.val - b.val : b.val - a.val));
    return arr;
  }, [rows, dim, metricKey, minN]);
  const top = groups.slice(0, 16);
  const vals = top.map((g) => g.val);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const norm = (v) => (hi === lo ? 0.5 : (M[metricKey].dir === "low" ? 1 - (v - lo) / (hi - lo) : (v - lo) / (hi - lo)));
  const data = top.map((g) => ({ name: g.key.length > 22 ? g.key.slice(0, 21) + "…" : g.key, full: g.key, v: g.val, n: g.n }));
  if (!top.length) return <div className="text-sm text-slate-400 py-8 text-center">No groups with ≥{minN} creatives for the current filters.</div>;
  return (
    <div>
      <div style={{ height: Math.max(200, data.length * 30 + 16) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 2, right: 60, left: 6, bottom: 2 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} tickFormatter={(v) => M[metricKey].f(v)} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: C.ink }} />
            <Tooltip cursor={{ fill: "rgba(109,40,217,0.05)" }} contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid " + C.line }} formatter={(v, _n, p) => [M[metricKey].f(v) + "  ·  " + p.payload.n + " ads", M[metricKey].label]} labelFormatter={(l, p) => (p && p[0] ? p[0].payload.full : l)} />
            <Bar dataKey="v" radius={[0, 5, 5, 0]} animationDuration={650} label={{ position: "right", fontSize: 10, fill: C.sub, formatter: (v) => M[metricKey].f(v) }}>
              {data.map((d, i) => <Cell key={i} fill={barColor(norm(d.v))} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <RankTable groups={groups} metricKey={metricKey} dimLabel={(DIMS.find((d) => d[0] === dim) || [, dim])[1]} />
    </div>
  );
}
function RankTable({ groups, metricKey, dimLabel }) {
  const vals = groups.map((g) => g.val); const lo = Math.min(...vals), hi = Math.max(...vals);
  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-xs">
        <thead className="text-slate-400 border-b border-slate-200">
          <tr><th className="text-left px-2 py-1.5 font-semibold">{dimLabel}</th><th className="text-right px-2 py-1.5 font-semibold">Ads</th><th className="text-right px-2 py-1.5 font-semibold">Spend</th><th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">{M[metricKey].label}</th></tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} className="border-b border-slate-50 hover:bg-slate-50/60">
              <td className="px-2 py-1.5 font-medium text-slate-700"><div className="truncate max-w-[280px]" title={g.key}>{g.key}</div></td>
              <td className="px-2 py-1.5 text-right font-mono text-slate-500">{g.n}{M[metricKey].recent && <span className="text-slate-300"> · {g.cov}</span>}</td>
              <td className="px-2 py-1.5 text-right font-mono text-slate-500">{inrK(g.spend)}</td>
              <td className="px-2 py-1.5 text-right font-mono text-slate-800" style={{ background: heat(g.val, lo, hi, M[metricKey].dir) }}>{M[metricKey].f(g.val)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {M[metricKey].recent && <div className="text-[11px] text-slate-400 mt-1">Second count = ads with funnel data in the {FWIN} window.</div>}
    </div>
  );
}

/* ---------- stage-split funnel (uninstall/cancel · scaling vs testing · period selector) ---------- */
function FunnelStat({ label, v, n, better, fmt }) {
  const f = fmt || ((x) => x.toFixed(1) + "%");
  const tint = better === true ? "rgba(22,163,74,0.10)" : better === false ? "rgba(220,38,38,0.10)" : "rgba(100,116,139,0.05)";
  const bar = better === true ? "#16A34A" : better === false ? "#DC2626" : "#CBD5E1";
  const num = better === true ? "#15803D" : better === false ? "#B91C1C" : "#334155";
  return (
    <div className="relative rounded-xl border border-slate-200 pl-3.5 pr-3 py-2.5 overflow-hidden" style={{ background: tint }}>
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: bar }} />
      <div className="text-[10px] font-semibold tracking-wide uppercase text-slate-500 leading-tight">{label}</div>
      <div className="text-[23px] font-bold tracking-tight mt-0.5" style={{ color: num, fontVariantNumeric: "tabular-nums" }}>{v == null ? "—" : f(v)}</div>
      <div className="text-[11px] text-slate-500">{n} creatives</div>
    </div>
  );
}
function StageFunnel({ rows, idxSet, pLabel, emptyHint }) {
  const fmtSpend = (v) => (!v ? "\u2014" : v >= 1e7 ? "\u20b9" + (v / 1e7).toFixed(2) + "Cr" : v >= 1e5 ? "\u20b9" + (v / 1e5).toFixed(1) + "L" : v >= 1e3 ? "\u20b9" + Math.round(v / 1e3) + "k" : "\u20b9" + Math.round(v));
  const hl = useMemo(() => {
    const A = { s: { sp: 0, pd: 0, nun: 0, ncx: 0, n: 0 }, t: { sp: 0, pd: 0, nun: 0, ncx: 0, n: 0 } };
    rows.forEach((r) => { const a = r.stage === "Scaling" ? A.s : A.t; let hit = false; const pc = r._pc; for (let i = 0; i < pc.length; i++) { const c = pc[i]; if (!idxSet.has(c[0])) continue; a.sp += c[2]; a.pd += c[3]; a.nun += c[4]; a.ncx += c[5]; hit = true; } if (hit) a.n++; });
    const cac = (x) => (x.pd ? x.sp / x.pd : null), un = (x) => (x.pd ? 100 * x.nun / x.pd : null), cx = (x) => (x.pd ? 100 * x.ncx / x.pd : null);
    return { sCac: cac(A.s), tCac: cac(A.t), sUn: un(A.s), tUn: un(A.t), sCx: cx(A.s), tCx: cx(A.t), nS: A.s.n, nT: A.t.n, sSp: A.s.sp, tSp: A.t.sp };
  }, [rows, idxSet]);

  const catRows = useMemo(() => {
    const g = {};
    rows.forEach((r) => {
      const e = (g[r.cat] ||= { s: { sp: 0, pd: 0, nun: 0, ncx: 0, n: 0 }, t: { sp: 0, pd: 0, nun: 0, ncx: 0, n: 0 } });
      const a = r.stage === "Scaling" ? e.s : e.t; let hit = false; const pc = r._pc;
      for (let i = 0; i < pc.length; i++) { const c = pc[i]; if (!idxSet.has(c[0])) continue; a.sp += c[2]; a.pd += c[3]; a.nun += c[4]; a.ncx += c[5]; hit = true; } if (hit) a.n++;
    });
    const cac = (x) => (x.pd ? x.sp / x.pd : null), un = (x) => (x.pd ? 100 * x.nun / x.pd : null), cx = (x) => (x.pd ? 100 * x.ncx / x.pd : null);
    return Object.entries(g).map(([name, v]) => ({ name, sCac: cac(v.s), tCac: cac(v.t), sUn: un(v.s), tUn: un(v.t), sCx: cx(v.s), tCx: cx(v.t), sSpend: v.s.sp, tSpend: v.t.sp, nS: v.s.n, nT: v.t.n, tot: v.s.n + v.t.n }))
      .filter((x) => x.tot >= 5).sort((a, b) => b.tot - a.tot);
  }, [rows, idxSet]);
  const unV = catRows.flatMap((r) => [r.sUn, r.tUn]).filter((x) => x != null); const unLo = Math.min(...unV), unHi = Math.max(...unV);
  const cxV = catRows.flatMap((r) => [r.sCx, r.tCx]).filter((x) => x != null); const cxLo = Math.min(...cxV), cxHi = Math.max(...cxV);
  const ccV = catRows.flatMap((r) => [r.sCac, r.tCac]).filter((x) => x != null); const ccLo = Math.min(...ccV), ccHi = Math.max(...ccV);
  const cmp = (a, b) => (a == null || b == null ? null : (a === b ? null : a < b));

  return (
    <Card icon={iSpark} title="CAC, uninstall & cancellation — scaling vs testing" sub={"Spend/volume-weighted · lower is better · " + pLabel}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <FunnelStat label="Scaling CAC" v={hl.sCac} n={hl.nS} better={cmp(hl.sCac, hl.tCac)} fmt={inr} />
        <FunnelStat label="Testing CAC" v={hl.tCac} n={hl.nT} better={cmp(hl.tCac, hl.sCac)} fmt={inr} />
        <FunnelStat label="Scaling uninstall %" v={hl.sUn} n={hl.nS} better={cmp(hl.sUn, hl.tUn)} />
        <FunnelStat label="Testing uninstall %" v={hl.tUn} n={hl.nT} better={cmp(hl.tUn, hl.sUn)} />
        <FunnelStat label="Scaling cancel %" v={hl.sCx} n={hl.nS} better={cmp(hl.sCx, hl.tCx)} />
        <FunnelStat label="Testing cancel %" v={hl.tCx} n={hl.nT} better={cmp(hl.tCx, hl.sCx)} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mb-2">
        <span className="font-semibold text-slate-500">Spend · {pLabel}:</span>
        <span className="text-slate-700">Scaling <span className="font-mono font-semibold">{fmtSpend(hl.sSp)}</span></span>
        <span className="text-slate-700">Testing <span className="font-mono font-semibold">{fmtSpend(hl.tSp)}</span></span>
        <span className="text-slate-500">Total <span className="font-mono font-semibold text-slate-700">{fmtSpend(hl.sSp + hl.tSp)}</span></span>
      </div>
      <div className="text-xs font-semibold text-slate-500 mb-1.5">By category · {pLabel} <span className="font-normal text-slate-400">· spend = actual Meta spend; CAC/churn shaded low (good) → high</span></div>
      {catRows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-400 border-b border-slate-200">
              <tr>
                <th className="text-left px-2 py-1.5 font-semibold">Category</th>
                <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Ads S/T</th>
                <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Scaling spend</th>
                <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Testing spend</th>
                <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Scaling CAC</th>
                <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Testing CAC</th>
                <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Scaling unin %</th>
                <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Testing unin %</th>
                <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Scaling cancel %</th>
                <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Testing cancel %</th>
              </tr>
            </thead>
            <tbody>
              {catRows.map((r) => (
                <tr key={r.name} className="border-b border-slate-50">
                  <td className="px-2 py-1.5 font-medium text-slate-700">{r.name}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-400">{r.nS}/{r.nT}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-semibold text-slate-700">{fmtSpend(r.sSpend)}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-semibold text-slate-700">{fmtSpend(r.tSpend)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-800" style={{ background: heat(r.sCac, ccLo, ccHi, "low") }}>{r.sCac == null ? "—" : inr(r.sCac)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-800" style={{ background: heat(r.tCac, ccLo, ccHi, "low") }}>{r.tCac == null ? "—" : inr(r.tCac)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-800" style={{ background: heat(r.sUn, unLo, unHi, "low") }}>{r.sUn == null ? "—" : r.sUn.toFixed(1)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-800" style={{ background: heat(r.tUn, unLo, unHi, "low") }}>{r.tUn == null ? "—" : r.tUn.toFixed(1)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-800" style={{ background: heat(r.sCx, cxLo, cxHi, "low") }}>{r.sCx == null ? "—" : r.sCx.toFixed(1)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-800" style={{ background: heat(r.tCx, cxLo, cxHi, "low") }}>{r.tCx == null ? "—" : r.tCx.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="text-sm text-slate-400 py-6 text-center">{emptyHint}</div>}
    </Card>
  );
}

/* ---------- overview (timeframe selector drives every metric) ---------- */
function useTimeframe() {
  const months = useMemo(() => PERIODS.filter((p) => p.kind === "month"), []);
  const weeks = useMemo(() => PERIODS.filter((p) => p.kind === "week"), []);
  const days = useMemo(() => PERIODS.filter((p) => p.kind === "day"), []);
  const periodsOf = (m) => (m === "Monthly" ? months : m === "Weekly" ? weeks : m === "Daily" ? days : []);
  const [mode, setMode] = useState("Lifetime");
  const [sel, setSel] = useState([]);
  const changeMode = (m) => { setMode(m); const ps = periodsOf(m); setSel(ps.length ? [ps[ps.length - 1].k] : []); };
  const idxSet = useMemo(() => { if (mode === "Lifetime") return new Set([0]); const ks = new Set(sel); const out = new Set(); PERIODS.forEach((p, i) => { if (ks.has(p.k)) out.add(i); }); return out; }, [mode, sel]);
  const selUnit = mode === "Monthly" ? "months" : mode === "Weekly" ? "weeks" : "days";
  const pLabel = mode === "Lifetime" ? "Lifetime" : sel.length === 0 ? "none selected" : sel.length === 1 ? (periodsOf(mode).find((p) => p.k === sel[0]) || { label: "" }).label : sel.length + " " + selUnit;
  return { months, weeks, days, periodsOf, mode, setMode, sel, setSel, changeMode, idxSet, selUnit, pLabel };
}
function TimeframeBar({ tf, verb = "combine", note }) {
  const { periodsOf, mode, sel, setSel, changeMode, selUnit, pLabel } = tf;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Timeframe</span>
        <Seg options={["Lifetime", "Monthly", "Weekly", "Daily"]} value={mode} onChange={changeMode} />
        <span className="ml-auto text-xs text-slate-500">{note || <>Showing <span className="font-semibold text-violet-700">{pLabel}</span> · everything below recalculates</>}</span>
      </div>
      {mode !== "Lifetime" && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mr-1">Tick {selUnit} to {verb}</span>
          {periodsOf(mode).map((p) => { const on = sel.includes(p.k); return <button key={p.k} onClick={() => setSel((x) => (x.includes(p.k) ? x.filter((y) => y !== p.k) : [...x, p.k]))} className={`text-[11px] rounded-md border px-2 py-0.5 transition-colors ${on ? "bg-violet-600 border-violet-600 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-violet-300"}`}>{p.label}</button>; })}
          <button onClick={() => setSel(periodsOf(mode).map((p) => p.k))} className="text-[11px] text-slate-500 hover:text-violet-600 px-1.5">All</button>
          {sel.length > 0 && <button onClick={() => setSel([])} className="text-[11px] text-slate-400 hover:text-violet-600 px-1.5">Clear</button>}
        </div>
      )}
    </div>
  );
}
const FILTERS = [["stage", "Stage", ["All", "Scaling", "Testing"]], ["strat", "New / Expansion", ["All", "New", "Expansion", "Other"]], ["ai", "AI / Human", ["All", "AI", "Human", "Unknown"]], ["face", "Face", ["All", "Face", "Faceless", "Unknown"]], ["cat", "Category", null], ["fmt", "Format", null], ["vis", "Visual", null], ["hook", "Hook", ["All", "Hook 1", "Hook 2", "Hook 3", "None"]], ["minSp", "Min spend", ["All", "≥₹10k", "≥₹50k", "≥₹1L"]]];
const MINSP = { All: 0, "≥₹10k": 1e4, "≥₹50k": 5e4, "≥₹1L": 1e5 };
const applyFilters = (f) => ALL.filter((r) => (f.stage === "All" || r.stage === f.stage) && (f.strat === "All" || r.strat === f.strat) && (f.ai === "All" || r.ai === f.ai) && (f.face === "All" || r.face === f.face) && (f.cat === "All" || r.cat === f.cat) && (f.fmt === "All" || r.fmt === f.fmt) && (f.vis === "All" || r.vis === f.vis) && (f.hook === "All" || r.hook === f.hook) && r.sp >= MINSP[f.minSp]);
function FilterBar({ f, setF }) {
  const dirty = Object.entries(f).some(([k, v]) => v !== "All");
  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-wrap items-end gap-x-4 gap-y-3">
      {FILTERS.map(([key, label, opts]) => <Drop key={key} label={label} value={f[key]} onChange={(v) => setF((s) => ({ ...s, [key]: v }))} options={opts || ["All", ...uniq(key)]} />)}
      {dirty && <button onClick={() => setF(Object.fromEntries(FILTERS.map(([k]) => [k, "All"])))} className="text-xs text-slate-500 hover:text-violet-600 border border-slate-200 rounded-lg px-2.5 py-1.5 self-end">Reset filters</button>}
    </div>
  );
}

function Overview({ rows, goTab, tf }) {
  const { idxSet, pLabel, mode, sel, selUnit } = tf;
  const emptyHint = mode !== "Lifetime" && sel.length === 0 ? `Tick one or more ${selUnit} above.` : `No funnel data in ${pLabel}.`;
  const tot = useMemo(() => aggPC(rows, idxSet), [rows, idxSet]);
  const k = { sp: tot.sp, cpr: tot.res ? tot.sp / tot.res : null, cac: tot.pd ? tot.sp / tot.pd : null, ctr: tot.im ? 100 * tot.cl / tot.im : null, hk: tot.im ? 100 * tot.p3 / tot.im : null, hd: tot.im ? 100 * tot.tp / tot.im : null };
  const nCre = useMemo(() => rows.reduce((a, r) => a + (r._pc.some((c) => idxSet.has(c[0])) ? 1 : 0), 0), [rows, idxSet]);
  const catBars = useMemo(() => {
    const g = {}; rows.forEach((r) => { const e = (g[r.cat] ||= { sp: 0, res: 0 }); const pc = r._pc; for (let i = 0; i < pc.length; i++) { const c = pc[i]; if (!idxSet.has(c[0])) continue; e.sp += c[2]; e.res += c[8]; } });
    return Object.entries(g).map(([name, v]) => ({ name, spend: v.sp, cpr: v.res ? v.sp / v.res : null })).filter((x) => x.spend > 0).sort((a, b) => b.spend - a.spend).slice(0, 10);
  }, [rows, idxSet]);
  const cprVals = catBars.map((c) => c.cpr).filter((x) => x != null); const clo = Math.min(...cprVals), chi = Math.max(...cprVals);

  return (
    <div className="space-y-4">
      {nCre === 0 ? <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">No creatives match these filters{mode !== "Lifetime" ? ` in ${pLabel}` : ""}.</div> : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi idx={0} label="Total spend" value={inrK(k.sp)} sub={nCre.toLocaleString("en-IN") + " creatives"} />
        <Kpi idx={1} label="CAC" value={inr(k.cac)} sub="spend ÷ D0 paid" accent={C.primary} onClick={() => goTab("What's working")} />
        <Kpi idx={2} label="CPR" value={inr(k.cpr)} sub="cost per result" onClick={() => goTab("What's working")} />
        <Kpi idx={3} label="CTR" value={p2(k.ctr)} onClick={() => goTab("What's working")} />
        <Kpi idx={4} label="Hook rate" value={p1(k.hk)} sub="3-sec ÷ impr" onClick={() => goTab("What's working")} />
        <Kpi idx={5} label="Hold rate" value={p1(k.hd)} sub="thruplay ÷ impr" onClick={() => goTab("What's working")} />
      </div>
      <StageFunnel rows={rows} idxSet={idxSet} pLabel={pLabel} emptyHint={emptyHint} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Spend by category" sub={pLabel} icon={iGrid}>
          <div style={{ height: Math.max(200, catBars.length * 26 + 16) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={catBars} margin={{ top: 2, right: 50, left: 6, bottom: 2 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} tickFormatter={inrK} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: C.ink }} />
                <Tooltip cursor={{ fill: "rgba(109,40,217,0.05)" }} contentStyle={{ fontSize: 12, borderRadius: 10 }} formatter={(v) => inrK(v)} />
                <Bar dataKey="spend" radius={[0, 5, 5, 0]} fill={C.primary} animationDuration={650} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="CPR by category" sub={"lower is better · " + pLabel} icon={iGrid}>
          <div style={{ height: Math.max(200, catBars.length * 26 + 16) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={catBars} margin={{ top: 2, right: 56, left: 6, bottom: 2 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} tickFormatter={(v) => "₹" + v} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: C.ink }} />
                <Tooltip cursor={{ fill: "rgba(109,40,217,0.05)" }} contentStyle={{ fontSize: 12, borderRadius: 10 }} formatter={(v) => inr(v)} />
                <Bar dataKey="cpr" radius={[0, 5, 5, 0]} animationDuration={650} label={{ position: "right", fontSize: 10, fill: C.sub, formatter: (v) => inr(v) }}>
                  {catBars.map((c, i) => <Cell key={i} fill={c.cpr == null ? "#ddd" : barColor(chi === clo ? 0.5 : 1 - (c.cpr - clo) / (chi - clo))} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- what's working ---------- */
function MultiTable({ rows, dim, metricKeys, minN }) {
  const groups = useMemo(() => {
    const g = {};
    rows.forEach((r) => { const k = (r[dim] && String(r[dim]).trim()) || "—"; (g[k] ||= []).push(r); });
    let arr = Object.entries(g).map(([k, rs]) => { const o = { key: k, n: rs.length, spend: sum(rs.map((r) => r.sp)) }; metricKeys.forEach((mk) => (o[mk] = metricVal(rs, mk))); return o; });
    return arr.filter((x) => x.n >= minN).sort((a, b) => b.spend - a.spend);
  }, [rows, dim, metricKeys, minN]);
  const ranges = {}; metricKeys.forEach((mk) => { const v = groups.map((g) => g[mk]).filter((x) => x != null); ranges[mk] = v.length ? [Math.min(...v), Math.max(...v)] : [0, 0]; });
  const dimLabel = (DIMS.find((d) => d[0] === dim) || [, dim])[1];
  if (!groups.length) return <div className="text-sm text-slate-400 py-8 text-center">No groups with ≥{minN} creatives for the current filters.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-slate-400 border-b border-slate-200">
          <tr>
            <th className="text-left px-2 py-1.5 font-semibold">{dimLabel}</th>
            <th className="text-right px-2 py-1.5 font-semibold">Ads</th>
            <th className="text-right px-2 py-1.5 font-semibold">Spend</th>
            {metricKeys.map((mk) => <th key={mk} className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">{M[mk].label}</th>)}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} className="border-b border-slate-50 hover:bg-slate-50/60">
              <td className="px-2 py-1.5 font-medium text-slate-700"><div className="truncate max-w-[240px]" title={g.key}>{g.key}</div></td>
              <td className="px-2 py-1.5 text-right font-mono text-slate-500">{g.n}</td>
              <td className="px-2 py-1.5 text-right font-mono text-slate-500">{inrK(g.spend)}</td>
              {metricKeys.map((mk) => <td key={mk} className="px-2 py-1.5 text-right font-mono text-slate-800" style={{ background: heat(g[mk], ranges[mk][0], ranges[mk][1], M[mk].dir) }}>{M[mk].f(g[mk])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Working({ rows }) {
  const allK = Object.keys(M);
  const [metricKeys, setMetricKeys] = useState(["cpr"]);
  const [dim, setDim] = useState("cat");
  const minN = 5;
  const allOn = metricKeys.length === allK.length;
  const toggle = (k) => setMetricKeys((p) => (p.includes(k) ? (p.length > 1 ? p.filter((x) => x !== k) : p) : [...p, k]));
  const chip = (on) => `px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${on ? "bg-violet-600 border-violet-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-violet-300"}`;
  const anyRecent = metricKeys.some((k) => M[k].recent);
  const multi = metricKeys.length > 1;
  return (
    <div className="space-y-4">
      <Card icon={iSpark} title="What's working" sub="Pick one metric for a ranked chart, or several (tap more, or All) to compare side-by-side. Weighted (totals ÷ totals), shaded green (good) → red.">
        <div className="flex flex-col gap-3">
          <div>
            <span className="text-[10px] font-semibold tracking-wide uppercase text-slate-400">Metrics — tap to combine</span>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <button onClick={() => setMetricKeys(allOn ? ["cpr"] : allK)} className={chip(allOn)}>All</button>
              {allK.map((k) => <button key={k} onClick={() => toggle(k)} className={chip(metricKeys.includes(k))}>{M[k].label}</button>)}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <Drop label="Break down by" value={(DIMS.find((d) => d[0] === dim) || [, ""])[1]} onChange={(l) => setDim((DIMS.find((d) => d[1] === l) || ["cat"])[0])} options={DIMS.map((d) => d[1])} />
            {anyRecent && <Badge tone="recent">funnel metrics · {FWIN}</Badge>}
          </div>
        </div>
      </Card>
      <Card>
        {multi ? <MultiTable rows={rows} dim={dim} metricKeys={metricKeys} minN={minN} /> : <Ranked rows={rows} dim={dim} metricKey={metricKeys[0]} minN={minN} />}
      </Card>
    </div>
  );
}

/* ---------- trends (by launch week) ---------- */
function Trends({ rows, tf }) {
  const [metricKey, setMetricKey] = useState("cac");
  const gran = tf.mode === "Lifetime" ? "Weekly" : tf.mode; // a trend needs multiple periods; Lifetime falls back to weekly
  const data = useMemo(() => {
    const pidxByK = {}; PERIODS.forEach((p, i) => (pidxByK[p.k] = i));
    const periods = PERIODS.filter((p) => p.kind === (gran === "Monthly" ? "month" : gran === "Daily" ? "day" : "week"));
    const selSet = new Set(tf.sel);
    const shown = (tf.mode !== "Lifetime" && tf.sel.length) ? periods.filter((p) => selSet.has(p.k)) : periods;
    return shown.map((p) => {
      const a = aggPC(rows, new Set([pidxByK[p.k]]));
      const mv = { sp: a.sp, cpr: a.res ? a.sp / a.res : null, ctr: a.im ? 100 * a.cl / a.im : null, hk: a.im ? 100 * a.p3 / a.im : null, hd: a.im ? 100 * a.tp / a.im : null, cac: a.pd ? a.sp / a.pd : null, un: a.pd ? 100 * a.nun / a.pd : null, cx: a.pd ? 100 * a.ncx / a.pd : null };
      return { label: p.label, spend: a.sp, val: mv[metricKey] };
    });
  }, [rows, gran, tf.mode, tf.sel, metricKey]);
  const compareNote = tf.mode !== "Lifetime" && tf.sel.length ? `comparing ${tf.sel.length} ${tf.selUnit}` : `all ${gran.toLowerCase()} periods`;
  return (
    <Card icon={iTrend} title="Trend over time" sub={`Calendar ${gran.toLowerCase()} · bars = spend, line = chosen metric (weighted) · ${compareNote} · set granularity in the timeframe above, tick periods to compare specific dates`}
      right={<Drop label="Line metric" value={M[metricKey].label} onChange={(l) => setMetricKey(Object.keys(M).find((k) => M[k].label === l))} options={["CAC", "CPR", "CTR %", "Hook rate %", "Hold rate %", "Uninstall %", "Cancel %"]} />}>
      <div style={{ height: 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 44 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.muted }} angle={-35} textAnchor="end" height={64} interval={0} />
            <YAxis yAxisId="l" tick={{ fontSize: 10, fill: C.muted }} tickFormatter={inrK} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: C.primary }} tickFormatter={(v) => M[metricKey].f(v)} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} formatter={(v, n) => (n === "spend" ? [inrK(v), "Spend"] : [M[metricKey].f(v), M[metricKey].label])} />
            <Bar yAxisId="l" dataKey="spend" radius={[4, 4, 0, 0]} fill={C.primarySoft} stroke={C.primary} strokeWidth={1} animationDuration={650} />
            <Line yAxisId="r" type="monotone" dataKey="val" stroke={C.primary} strokeWidth={2.5} dot={{ r: 2.5 }} animationDuration={800} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ---------- explorer ---------- */
const COLS = [["n", "Creative", "l"], ["campName", "Campaign", "l"], ["adsetName", "Adset", "l"], ["cat", "Category", "l"], ["fmt", "Format", "l"], ["vis", "Visual", "l"], ["sp", "Spend", "sp"], ["cpr", "CPR", "cpr"], ["ctr", "CTR %", "ctr"], ["hk", "Hook %", "hk"], ["hd", "Hold %", "hd"], ["cac", "CAC", "cac"], ["un", "Unin %", "un"], ["cx", "Cancel %", "cx"]];
function Explorer() {
  const [app, setApp] = useState("seekho");
  const [camp, setCamp] = useState("All");
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ k: "sp", dir: "desc" });
  const inApp = (r) => app === "All" || r.app === app;
  const campOptions = useMemo(() => ["All", ...[...new Set(ALL.filter(inApp).map((r) => r.campName).filter(Boolean))].sort()], [app]);
  const catOptions = useMemo(() => ["All", ...[...new Set(ALL.filter(inApp).map((r) => r.cat).filter(Boolean))].sort()], [app]);
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return ALL.filter((r) => inApp(r) && (camp === "All" || r.campName === camp) && (cat === "All" || r.cat === cat) &&
      (!ql || r.n.toLowerCase().includes(ql) || (r.adsetName || "").toLowerCase().includes(ql) || (r.campName || "").toLowerCase().includes(ql)));
  }, [app, camp, cat, q]);
  const sorted = useMemo(() => {
    const lt = (COLS.find((c) => c[0] === sort.k) || [])[2] === "l";
    const sv = (x) => (lt ? x[sort.k] : rowVal(x, sort.k));
    const a = [...rows].sort((x, y) => { const xv = sv(x), yv = sv(y); if (xv == null) return 1; if (yv == null) return -1; if (typeof xv === "string") return sort.dir === "asc" ? xv.localeCompare(yv) : yv.localeCompare(xv); return sort.dir === "asc" ? xv - yv : yv - xv; });
    return q.trim() ? a : a.slice(0, 400); // searching → show every match; otherwise top 400 by sort
  }, [rows, sort, q]);
  const ranges = useMemo(() => { const r = {}; ["cpr", "ctr", "hk", "hd", "cac", "un", "cx"].forEach((k) => { const v = rows.map((x) => rowVal(x, k)).filter((x) => x != null); r[k] = v.length ? [Math.min(...v), Math.max(...v)] : [0, 0]; }); return r; }, [rows]);
  const click = (k) => setSort((s) => ({ k, dir: s.k === k && s.dir === "desc" ? "asc" : "desc" }));
  const dirty = app !== "seekho" || camp !== "All" || cat !== "All" || q;
  const reset = () => { setApp("seekho"); setCamp("All"); setCat("All"); setQ(""); };
  const showing = q.trim() ? rows.length : Math.min(400, rows.length);
  return (
    <Card icon={iTable} title="Creative explorer" sub={`${rows.length.toLocaleString("en-IN")} creatives · ${q.trim() ? "all matches" : "top 400"} ranked by ${(COLS.find((c) => c[0] === sort.k) || [, "spend"])[1]} · scroll the list · click a column to sort`}>
      <div className="flex flex-wrap items-end gap-3 mb-3 pb-3 border-b border-slate-100">
        <Drop label="Campaign" value={camp} onChange={setCamp} options={campOptions} />
        <Drop label="Category" value={cat} onChange={setCat} options={catOptions} />
        <label className="flex flex-col gap-1 flex-1 min-w-[220px]"><span className="text-[10px] font-semibold tracking-wide uppercase text-slate-400">Search — creative · adset · campaign (shows every match)</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. cartoonedit, sharemarket, top sub campaign…" className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-400" /></label>
        {dirty && <button onClick={reset} className="text-xs text-slate-500 hover:text-violet-600 border border-slate-200 rounded-lg px-2.5 py-1.5 whitespace-nowrap">Reset</button>}
      </div>
      <div className="overflow-auto -mx-2 max-h-[68vh]">
        <table className="w-full text-xs">
          <thead className="text-slate-400 border-b border-slate-200 sticky top-0 bg-white z-10">
            <tr>{COLS.map(([k, lab, t]) => <th key={k} onClick={() => click(k)} className={`px-2 py-1.5 font-semibold cursor-pointer hover:text-violet-600 whitespace-nowrap ${t === "l" ? "text-left" : "text-right"}`}>{lab}{sort.k === k ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}</th>)}</tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? <tr><td colSpan={COLS.length} className="px-2 py-10 text-center text-slate-400">No creatives match these filters.</td></tr> : sorted.map((r, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                {COLS.map(([k, , t]) => {
                  if (t === "l") return <td key={k} className="px-2 py-1.5 text-slate-700"><div className="truncate max-w-[200px]" title={r[k]}>{r[k] || "—"}</div></td>;
                  const val = rowVal(r, k); const rng = ranges[k]; const bg = rng ? heat(val, rng[0], rng[1], (M[k] ? M[k].dir : "low")) : "transparent";
                  return <td key={k} className="px-2 py-1.5 text-right font-mono text-slate-800 whitespace-nowrap" style={{ background: bg }}>{M[k] ? M[k].f(val) : val}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!q.trim() && rows.length > 400 && <div className="text-[11px] text-slate-400 mt-2">Showing top 400 of {rows.length.toLocaleString("en-IN")} by {(COLS.find((c) => c[0] === sort.k) || [, "spend"])[1]} — type in search to surface any creative (search returns all matches).</div>}
    </Card>
  );
}

/* ---------- campaign → adset → ad drill-down ---------- */
const TREE_COLS = ["sp", "cpr", "ctr", "hk", "cac", "un", "cx"];
function CampaignTree() {
  const [app, setApp] = useState("seekho");
  const [q, setQ] = useState("");
  const [openC, setOpenC] = useState({});
  const [openA, setOpenA] = useState({});
  const [sortK, setSortK] = useState("sp");

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return ALL.filter((r) => (app === "All" || r.app === app) && (!ql || r.n.toLowerCase().includes(ql) || (r.adsetName || "").toLowerCase().includes(ql) || (r.campName || "").toLowerCase().includes(ql)));
  }, [app, q]);

  const tree = useMemo(() => {
    const camps = {};
    rows.forEach((r) => {
      const ck = r.campName || "—";
      const cc = (camps[ck] ||= { key: ck, rows: [], adsets: {} });
      cc.rows.push(r);
      const ak = r.adsetName || "—";
      (cc.adsets[ak] ||= { key: ak, rows: [] }).rows.push(r);
    });
    const list = Object.values(camps).map((c) => ({ ...c, adsetList: Object.values(c.adsets).sort((a, b) => metricVal(b.rows, "sp") - metricVal(a.rows, "sp")) }));
    const dir = sortK === "sp" ? -1 : M[sortK].dir === "low" ? 1 : -1;
    list.sort((a, b) => { const av = metricVal(a.rows, sortK), bv = metricVal(b.rows, sortK); if (av == null) return 1; if (bv == null) return -1; return (av - bv) * dir; });
    return list;
  }, [rows, sortK]);

  const ranges = useMemo(() => {
    const r = {};
    TREE_COLS.forEach((k) => { if (k === "sp") return; const v = tree.map((c) => metricVal(c.rows, k)).filter((x) => x != null); r[k] = v.length ? [Math.min(...v), Math.max(...v)] : null; });
    return r;
  }, [tree]);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const cellBg = (v, k) => { if (k === "sp" || v == null) return "transparent"; const rng = ranges[k]; if (!rng || rng[0] === rng[1]) return "transparent"; return heat(clamp(v, rng[0], rng[1]), rng[0], rng[1], M[k].dir); };
  const mCells = (src, isRow) => TREE_COLS.map((k) => { const v = isRow ? rowVal(src, k) : metricVal(src, k); return <td key={k} className="px-2 py-1.5 text-right font-mono text-slate-800 whitespace-nowrap" style={{ background: cellBg(v, k) }}>{M[k].f(v)}</td>; });
  const chev = (o) => <span className="inline-block w-3 text-slate-400">{o ? "▾" : "▸"}</span>;
  const toggleC = (k) => setOpenC((s) => ({ ...s, [k]: !s[k] }));
  const toggleA = (k) => setOpenA((s) => ({ ...s, [k]: !s[k] }));
  const fundedC = tree.filter((c) => metricVal(c.rows, "cac") != null).length;

  return (
    <Card icon={iTree} title="Campaigns → adsets → ads"
      sub={`${tree.length} campaigns · click any row to drill into its adsets, then ads · weighted metrics · CAC & churn from ${FWIN}`}
      right={<Drop label="Sort campaigns by" value={M[sortK].label} onChange={(l) => setSortK(TREE_COLS.find((k) => M[k].label === l) || "sp")} options={TREE_COLS.map((k) => M[k].label)} />}>
      <div className="flex flex-wrap items-end gap-3 mb-3 pb-3 border-b border-slate-100">
        <label className="flex flex-col gap-1 flex-1 min-w-[220px]"><span className="text-[10px] font-semibold tracking-wide uppercase text-slate-400">Search — campaign · adset · ad</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. scaling, sharemarket, top sub campaign, AAA…" className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-400" /></label>
        {(app !== "seekho" || q) && <button onClick={() => { setApp("seekho"); setQ(""); }} className="text-xs text-slate-500 hover:text-violet-600 border border-slate-200 rounded-lg px-2.5 py-1.5 whitespace-nowrap">Reset</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-slate-400 border-b border-slate-200">
            <tr>
              <th className="text-left px-2 py-1.5 font-semibold">Campaign / adset / ad</th>
              <th className="text-right px-2 py-1.5 font-semibold">Ads</th>
              {TREE_COLS.map((k) => <th key={k} className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">{M[k].label}</th>)}
            </tr>
          </thead>
          <tbody>
            {tree.map((c) => {
              const cOpen = !!openC[c.key];
              return (
                <React.Fragment key={c.key}>
                  <tr className="border-b border-slate-100 bg-slate-50/40 hover:bg-slate-100/70 cursor-pointer" onClick={() => toggleC(c.key)}>
                    <td className="px-2 py-1.5 font-semibold text-slate-800"><div className="flex items-center gap-1.5 truncate max-w-[360px]" title={c.key}>{chev(cOpen)}{c.key}</div></td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-500">{c.rows.length}</td>
                    {mCells(c.rows, false)}
                  </tr>
                  {cOpen && c.adsetList.map((a) => {
                    const aKey = c.key + "▸" + a.key, aOpen = !!openA[aKey];
                    return (
                      <React.Fragment key={aKey}>
                        <tr className="border-b border-slate-50 hover:bg-slate-50/70 cursor-pointer" onClick={() => toggleA(aKey)}>
                          <td className="px-2 py-1.5 text-slate-700"><div className="flex items-center gap-1.5 truncate max-w-[360px] pl-5" title={a.key}>{chev(aOpen)}{a.key}</div></td>
                          <td className="px-2 py-1.5 text-right font-mono text-slate-400">{a.rows.length}</td>
                          {mCells(a.rows, false)}
                        </tr>
                        {aOpen && [...a.rows].sort((x, y) => y.sp - x.sp).slice(0, 60).map((r, i) => (
                          <tr key={aKey + "#" + i} className="border-b border-slate-50/70 hover:bg-violet-50/40">
                            <td className="px-2 py-1.5 text-slate-500"><div className="truncate max-w-[360px] pl-11" title={r.n}>{r.n}</div></td>
                            <td className="px-2 py-1.5" />
                            {mCells(r, true)}
                          </tr>
                        ))}
                        {aOpen && a.rows.length > 60 && <tr><td colSpan={2 + TREE_COLS.length} className="px-2 py-1 pl-11 text-[11px] text-slate-400">+{a.rows.length - 60} more ads (showing top 60 by spend)</td></tr>}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-slate-400 mt-2">Campaign &amp; adset rows are weighted roll-ups of their ads (totals ÷ totals). Cell shading compares campaigns within each column; {fundedC} of {tree.length} campaigns have funnel (CAC/churn) data in the {FWIN} window — ad rows without it show “—”.</div>
    </Card>
  );
}

/* ---------- merges / creative ops (static snapshot) ---------- */
const iMerge = <Ic d={<><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 0 0 9 9" /></>} />;
const VIOLET = [109, 40, 217];
const vTint = (v, max) => (!v || !max ? "transparent" : `rgba(${VIOLET[0]},${VIOLET[1]},${VIOLET[2]},${(0.06 + 0.5 * (v / max)).toFixed(3)})`);
function MiniBar({ data, dataKey, fill }) {
  return (
    <div style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEE" vertical={false} />
          <XAxis dataKey="k" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={40} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} cursor={{ fill: "rgba(109,40,217,0.06)" }} />
          <Bar dataKey={dataKey} fill={fill || C.primary} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
function Merges() {
  const [view, setView] = useState("Merges");
  const [pmode, setPmode] = useState("Weekly");
  const catAgg = useMemo(() => { const m = {}; MERGE.weeks.forEach((w) => w.agencies.forEach((a) => a.cats.forEach(([c, n]) => (m[c] = (m[c] || 0) + n)))); return Object.entries(m).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value); }, []);
  const agencyNames = useMemo(() => { const s = new Set(); MERGE.weeks.forEach((w) => w.agencies.forEach((a) => s.add(a.name))); return [...s]; }, []);
  const agencyRows = useMemo(() => agencyNames.map((name) => { const weeks = MERGE.weeks.map((w) => ((w.agencies.find((a) => a.name === name) || {}).total) || 0); return { name, weeks, total: sum(weeks) }; }).sort((a, b) => b.total - a.total), [agencyNames]);
  const agencyMax = Math.max(...agencyRows.flatMap((a) => a.weeks), 1);
  const totalMerged = sum(MERGE.weeks.map((w) => w.total));
  const catMax = Math.max(...catAgg.map((c) => c.value), 1);
  const liveTot = MERGE.live.map(([c, d]) => ({ cat: c, days: d, total: sum(d) })).sort((a, b) => b.total - a.total);
  const liveDayTot = MERGE.liveDays.map((d, i) => sum(MERGE.live.map(([, arr]) => arr[i])));
  const liveMax = Math.max(...MERGE.live.flatMap(([, d]) => d), 1);
  const rate = MERGE.mergeRate.map(([cat, live, merged]) => ({ cat, live, merged, pct: live ? 100 * merged / live : 0 })).sort((a, b) => b.pct - a.pct);
  const rateLive = sum(MERGE.mergeRate.map((r) => r[1])), rateMerged = sum(MERGE.mergeRate.map((r) => r[2]));
  const P = pmode === "Weekly" ? { cols: MERGE.weekCols, totals: MERGE.weekTotals, people: MERGE.byPersonWeekly, span: "1\u201328 Jun" } : { cols: MERGE.dayCols, totals: MERGE.dayTotals, people: MERGE.byPersonDaily, span: "17\u201323 Jun" };
  const pMax = Math.max(...P.people.flatMap((x) => x.series), 1);
  const V = ["Merges", "Ads live", "Merge rate", "Production"];
  return (
    <div className="space-y-4">
      <Card icon={iMerge} title="Creative ops \u2014 production \u2192 live \u2192 merges" sub={`Static snapshot from the Merges sheet \u00b7 as of ${MERGE.asOf} \u00b7 counts (not performance) \u00b7 re-paste the sheet to refresh`} right={<Seg options={V} value={view} onChange={setView} />} />
      {view === "Merges" && <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{MERGE.weeks.map((w, i) => <Kpi key={w.label} idx={i} label={w.label + (w.inProgress ? " *" : "")} value={w.total} sub={w.inProgress ? "in progress" : "merged"} />)}</div>
        <Card title="Merges by week" sub={`creatives merged & shipped \u00b7 ${totalMerged} across weeks shown \u00b7 * week in progress`}><MiniBar data={MERGE.weeks.map((w) => ({ k: w.label, Merges: w.total }))} dataKey="Merges" /></Card>
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="By agency" sub="merges per agency per week">
            <div className="overflow-x-auto"><table className="w-full text-xs">
              <thead className="text-slate-400 border-b border-slate-200"><tr><th className="text-left px-2 py-1.5 font-semibold">Agency</th>{MERGE.weeks.map((w) => <th key={w.label} className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">{w.label}</th>)}<th className="text-right px-2 py-1.5 font-semibold">Total</th></tr></thead>
              <tbody>{agencyRows.map((a) => <tr key={a.name} className="border-b border-slate-50"><td className="px-2 py-1.5 font-medium text-slate-700">{a.name}</td>{a.weeks.map((v, i) => <td key={i} className="px-2 py-1.5 text-right font-mono text-slate-700" style={{ background: vTint(v, agencyMax) }}>{v || "\u00b7"}</td>)}<td className="px-2 py-1.5 text-right font-mono font-semibold text-slate-800">{a.total}</td></tr>)}</tbody>
            </table></div>
          </Card>
          <Card title="By category" sub="total merges by category, all weeks">
            <div className="space-y-1.5">{catAgg.map((r) => <div key={r.label} className="flex items-center gap-2 text-xs"><div className="w-28 shrink-0 truncate text-slate-600" title={r.label}>{r.label}</div><div className="flex-1 bg-slate-100 rounded h-5 relative overflow-hidden"><div className="absolute inset-y-0 left-0 rounded" style={{ width: (100 * r.value / catMax) + "%", background: C.primary, opacity: 0.85 }} /></div><div className="w-8 shrink-0 text-right font-mono text-slate-700">{r.value}</div></div>)}</div>
          </Card>
        </div>
      </>}
      {view === "Ads live" && <>
        <Card title="Ads live \u2014 last 7 days" sub={`17\u201323 Jun \u00b7 ${sum(liveDayTot)} ads launched`}><MiniBar data={MERGE.liveDays.map((d, i) => ({ k: d, Live: liveDayTot[i] }))} dataKey="Live" fill={C.sky} /></Card>
        <Card title="By category \u00d7 day" sub="darker = more ads live that day">
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead className="text-slate-400 border-b border-slate-200"><tr><th className="text-left px-2 py-1.5 font-semibold">Category</th>{MERGE.liveDays.map((d) => <th key={d} className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">{d}</th>)}<th className="text-right px-2 py-1.5 font-semibold">Total</th></tr></thead>
            <tbody>{liveTot.map((r) => <tr key={r.cat} className="border-b border-slate-50"><td className="px-2 py-1.5 font-medium text-slate-700">{r.cat}</td>{r.days.map((v, i) => <td key={i} className="px-2 py-1.5 text-right font-mono text-slate-700" style={{ background: vTint(v, liveMax) }}>{v || "\u00b7"}</td>)}<td className="px-2 py-1.5 text-right font-mono font-semibold text-slate-800">{r.total}</td></tr>)}</tbody>
          </table></div>
        </Card>
      </>}
      {view === "Merge rate" && <Card title="Live \u2192 merge rate by category" sub={`live dates ${MERGE.mergeRateWindow} \u00b7 ${rateLive} live \u00b7 ${rateMerged} merged \u00b7 ${(100 * rateMerged / rateLive).toFixed(1)}% overall`}>
        <div className="space-y-1.5">{rate.map((r) => <div key={r.cat} className="flex items-center gap-2 text-xs"><div className="w-28 shrink-0 truncate text-slate-600" title={r.cat}>{r.cat}</div><div className="flex-1 bg-slate-100 rounded h-5 relative overflow-hidden"><div className="absolute inset-y-0 left-0 rounded" style={{ width: Math.min(100, r.pct * 2.5) + "%", background: C.primary, opacity: 0.85 }} /></div><div className="w-24 shrink-0 text-right font-mono text-slate-700">{r.pct.toFixed(1)}% <span className="text-slate-400">({r.merged}/{r.live})</span></div></div>)}</div>
        <div className="text-[11px] text-slate-400 mt-2">Merge % = merged \u00f7 live. Bars scaled \u00d72.5 for readability.</div>
      </Card>}
      {view === "Production" && <Card title="Creative production by person" sub={`creatives produced \u00b7 ${P.span} \u00b7 ${sum(P.totals)} total`} right={<Seg options={["Weekly", "Daily"]} value={pmode} onChange={setPmode} />}>
        <MiniBar data={P.cols.map((c, i) => ({ k: c, Produced: P.totals[i] }))} dataKey="Produced" />
        <div className="overflow-x-auto mt-3"><table className="w-full text-xs">
          <thead className="text-slate-400 border-b border-slate-200"><tr><th className="text-left px-2 py-1.5 font-semibold">Person / team</th>{P.cols.map((c) => <th key={c} className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">{c}</th>)}<th className="text-right px-2 py-1.5 font-semibold">Total</th></tr></thead>
          <tbody>{P.people.map((p) => <tr key={p.name} className="border-b border-slate-50"><td className="px-2 py-1.5 font-medium text-slate-700">{p.name}</td>{p.series.map((v, i) => <td key={i} className="px-2 py-1.5 text-right font-mono text-slate-700" style={{ background: vTint(v, pMax) }}>{v || "\u00b7"}</td>)}<td className="px-2 py-1.5 text-right font-mono font-semibold text-slate-800">{p.total}</td></tr>)}</tbody>
        </table></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">{P.people.map((p) => <div key={p.name} className="border border-slate-200 rounded-xl p-3"><div className="text-xs font-semibold text-slate-700 mb-1.5">{p.name} <span className="text-slate-400 font-normal">\u00b7 {p.total}</span></div><div className="space-y-1">{p.cats.slice(0, 6).map(([c, n]) => <div key={c} className="flex justify-between text-[11px] text-slate-500"><span className="truncate pr-2">{c}</span><span className="font-mono">{n}</span></div>)}</div></div>)}</div>
      </Card>}
    </div>
  );
}

/* ---------- app ---------- */
const uniq = (key) => { const s = new Set(ALL.map((r) => r[key]).filter(Boolean)); return [...s].sort(); };
function RefreshButton() {
  const [st, setSt] = useState("idle");
  if (typeof window === "undefined" || !/^https?:$/.test(window.location.protocol)) return null;
  const go = async () => {
    setSt("running");
    try { const r = await fetch("/refresh", { method: "POST" }); if (!r.ok) throw 0; window.location.reload(); }
    catch (e) { setSt("err"); }
  };
  return (
    <button onClick={go} disabled={st === "running"}
      className={`text-[11px] rounded-md border px-2.5 py-1 font-medium transition-colors ${st === "running" ? "bg-slate-100 border-slate-200 text-slate-400" : st === "err" ? "bg-red-50 border-red-200 text-red-600" : "bg-white border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-600"}`}>
      {st === "running" ? "Refreshing\u2026 (~1 min)" : st === "err" ? "Refresh failed \u2014 retry" : "\u21bb Refresh data"}
    </button>
  );
}

function App() {
  const [tab, setTab] = useState("Overview");
  const [f, setF] = useState(Object.fromEntries(FILTERS.map(([k]) => [k, "All"])));
  const tf = useTimeframe();
  const filtered = useMemo(() => applyFilters(f), [f]);
  const TABS = [["Overview", iGrid], ["What's working", iSpark], ["Campaigns", iTree], ["Trends", iTrend], ["Explorer", iTable], ["Merges", iMerge]];
  const showBars = tab === "Overview" || tab === "Trends";
  const gran = tf.mode === "Lifetime" ? "Weekly" : tf.mode;
  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.ink }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.fade-up{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) both}@media (prefers-reduced-motion:reduce){.fade-up{animation:none}}`}</style>
      <div className="max-w-[1320px] mx-auto px-5 py-6">
        {/* header */}
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Creative Intelligence</h1>
            <div className="text-xs text-slate-500 mt-0.5">Seekho · Meta performance creative · <span className="font-medium text-slate-600">{META.span[0]} → {META.span[1]}</span> · {ALL.length.toLocaleString("en-IN")} creatives ≥ ₹2k</div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <RefreshButton />
            <div className="text-[11px] text-slate-400">Cost = actual Meta spend · acquisition adsets only (retargeting & add-to-cart excluded) · CAC &amp; churn {FWIN}</div>
          </div>
        </div>

        {/* tabs */}
        <div className="flex gap-1 mb-4 border-b border-slate-200 overflow-x-auto">
          {TABS.map(([t, ic]) => <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px whitespace-nowrap transition-all ${tab === t ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{ic}{t}</button>)}
        </div>

        {/* shared filters + timeframe — Overview & Trends (persist across both) */}
        {showBars && (
          <div className="space-y-3 mb-4">
            <FilterBar f={f} setF={setF} />
            <TimeframeBar tf={tf} verb={tab === "Trends" ? "compare" : "combine"} note={tab === "Trends" ? <>Sets trend granularity · <span className="font-semibold text-violet-700">{gran}</span>{tf.mode !== "Lifetime" ? " · tick periods to compare specific dates" : ""}</> : null} />
          </div>
        )}

        {/* content */}
        <div key={tab}>
          {tab === "Explorer" ? <Explorer />
            : tab === "Merges" ? <Merges />
            : tab === "Campaigns" ? <CampaignTree />
            : tab === "Overview" ? <Overview rows={filtered} goTab={setTab} tf={tf} />
            : tab === "What's working" ? <Working rows={ALL} />
            : <Trends rows={filtered} tf={tf} />}
        </div>
        <div className="text-[11px] text-slate-400 mt-6 text-center">Weighted averages (group totals ÷ totals) · cost = actual Meta ad spend · CPR = spend ÷ results · CAC = spend ÷ D0 paid · uninstall/cancel = ÷ D0 paid · Hook = 3s plays ÷ impr · Hold = 15s thruplays ÷ impr</div>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
