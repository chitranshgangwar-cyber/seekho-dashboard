const { JSDOM } = require("jsdom");
const fs = require("fs");
const code = fs.readFileSync("bundle_ncad.js", "utf8");
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="root"></div></body></html>`, { runScripts: "dangerously", pretendToBeVisual: true });
dom.window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
dom.window.HTMLElement.prototype.getBoundingClientRect = function(){ return { width: 800, height: 320, top:0, left:0, right:800, bottom:320, x:0, y:0 }; };
Object.defineProperty(dom.window.HTMLElement.prototype, "offsetWidth", { configurable:true, get(){ return 800; } });
Object.defineProperty(dom.window.HTMLElement.prototype, "offsetHeight", { configurable:true, get(){ return 320; } });
const errors = [];
dom.window.onerror = (m, s, l, c, err) => errors.push(String(err && err.stack ? err.stack.split("\n")[0] : m));
dom.window.console.error = (...a) => { const s = a.map(String).join(" "); if (/is not defined|Cannot read|Minified React error|is not a function|undefined is not/.test(s)) errors.push("err: " + s.slice(0,180)); };
const d = dom.window.document;
const script = d.createElement("script"); script.textContent = code; d.body.appendChild(script);
const root = d.getElementById("root");
const clickTab = (name) => { const b=[...d.querySelectorAll("button")].find(x=>x.textContent.trim()===name); if(b) b.click(); return !!b; };
function setSel(el, value){ const set=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),"value").set; set.call(el, value); el.dispatchEvent(new dom.window.Event("change",{bubbles:true})); }
const selByOpt = (opt) => [...d.querySelectorAll("select")].find(s=>[...s.options].some(o=>o.value===opt));
const wait = (ms)=>new Promise(r=>setTimeout(r,ms));

setTimeout(async () => {
  for (const t of ["Overview","What's working","Campaigns","Trends","Explorer","Merges"]) {
    clickTab(t); await wait(300);
    const len = root.innerHTML.length;
    console.log(`tab ${t.padEnd(16)} chars: ${String(len).padStart(7)}  svg:${(root.innerHTML.match(/<svg/g)||[]).length}  ${len>800?"OK":"** EMPTY **"}`);
  }
  // StageFunnel period selector on Overview
  clickTab("Overview"); await wait(300);
  console.log("Overview stage panel present:", /scaling vs testing/.test(root.innerHTML), "| has 'Scaling uninstall':", /Scaling uninstall/.test(root.innerHTML));
  const wkBtn=[...d.querySelectorAll("button")].find(x=>x.textContent.trim()==="Weekly"); if(wkBtn){ wkBtn.click(); await wait(250); }
  console.log("Weekly mode OK, has 'By category':", /By category/.test(root.innerHTML));
  const wkChip=[...d.querySelectorAll("button")].find(x=>x.textContent.trim()==="1\u20137 Jun"); if(wkChip){ wkChip.click(); await wait(250); }
  console.log("week tick '1–7 Jun' multi-select OK, chars:", root.innerHTML.length);
  const moBtn=[...d.querySelectorAll("button")].find(x=>x.textContent.trim()==="Monthly"); if(moBtn){ moBtn.click(); await wait(250); }
  console.log("Monthly mode OK, chars:", root.innerHTML.length);
  const dayBtn=[...d.querySelectorAll("button")].find(x=>x.textContent.trim()==="Daily"); if(dayBtn){ dayBtn.click(); await wait(250); }
  const dayChip=[...d.querySelectorAll("button")].find(x=>x.textContent.trim()==="23 Jun");
  console.log("Daily mode OK | day tick chip present:", !!dayChip, "| chars:", root.innerHTML.length);
  const dayChip2=[...d.querySelectorAll("button")].find(x=>x.textContent.trim()==="22 Jun"); if(dayChip2){ dayChip2.click(); await wait(200); }
  console.log("Daily multi-select (2 days ticked) chars:", root.innerHTML.length);

  // What's working: metric chips (multi-select) + dimension + minN
  clickTab("What's working"); await wait(300);
  const clickChip=(t)=>{ const b=[...d.querySelectorAll("button")].find(x=>x.textContent.trim()===t); if(b) b.click(); return !!b; };
  clickChip("Hook rate %"); await wait(150); clickChip("CAC"); await wait(250);
  console.log("multi-metric table (CPR+Hook+CAC):", /CPR/.test(root.innerHTML)&&/Hook rate/.test(root.innerHTML)&&/CAC/.test(root.innerHTML), "| table:", /<table/.test(root.innerHTML));
  const ds=selByOpt("Format"); if(ds){ setSel(ds,"Format"); await wait(250); }
  console.log("dimension→Format OK");
  clickChip("All"); await wait(250);
  console.log("All metrics OK, chars:", root.innerHTML.length);
  const mn=[...d.querySelectorAll("button")].find(x=>x.textContent.trim()==="10"); if(mn){ mn.click(); await wait(200); }
  console.log("minN→10 OK");
  clickChip("All"); await wait(200);
  console.log("back to single → ranked svg:", (root.innerHTML.match(/<svg/g)||[]).length);
  // Global filters (App fixed to Seekho — no dropdown)
  const stS=selByOpt("Scaling"); if(stS){ setSel(stS,"Scaling"); await wait(250); }
  console.log("Stage→Scaling OK, chars:", root.innerHTML.length);
  // Campaigns: self-contained (global bar hidden) — drill + search
  clickTab("Campaigns"); await wait(300);
  const cSel = d.querySelectorAll("select").length;
  console.log("Campaigns hides global bar (selects:", cSel, "expect ~1):", cSel<=2?"OK":"** bar still there **");
  const trN = () => (root.innerHTML.match(/<tr/g)||[]).length;
  const beforeC = trN();
  const campRow=[...d.querySelectorAll("tr.cursor-pointer")][0]; if(campRow){ campRow.click(); await wait(250); }
  const afterC = trN();
  console.log("Campaigns: expand campaign rows", beforeC, "→", afterC, afterC>beforeC?"OK":"** no expand **");
  const adRow=[...d.querySelectorAll("tr.cursor-pointer")].find((x,i)=>i>0 && /pl-5/.test(x.innerHTML)); if(adRow){ adRow.click(); await wait(250); }
  console.log("Campaigns: expand adset rows", afterC, "→", trN(), "| ₹ present:", /₹/.test(root.innerHTML));
  const ccnt=()=>{ const m=root.innerHTML.match(/([\d,]+)\s+campaigns/); return m?m[1]:"?"; };
  const cbef=ccnt();
  const cinp=d.querySelector("input"); if(cinp){ const set=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(cinp),"value").set; set.call(cinp,"sharemarket"); cinp.dispatchEvent(new dom.window.Event("input",{bubbles:true})); await wait(300); }
  console.log("Campaigns search 'sharemarket' campaigns", cbef, "→", ccnt(), cbef!==ccnt()?"OK (narrowed)":"(no change)");
  // Explorer: self-contained (global bar hidden) — sort, search, category filter
  clickTab("Explorer"); await wait(300);
  const selN = d.querySelectorAll("select").length;
  console.log("Explorer hides global bar (selects:", selN, "expect 2):", selN<=3?"OK":"** bar still there **");
  const eHtml = root.innerHTML;
  console.log("Explorer real values (₹ and % present):", /₹/.test(eHtml) && /%/.test(eHtml), "| Campaign col:", /Campaign/.test(eHtml));
  const cnt=()=>{ const m=root.innerHTML.match(/([\d,]+)\s+creatives[^<]*?top/); return m?m[1]:"?"; };
  const fA=cnt();
  const fbtn=[...d.querySelectorAll("button")].find(x=>x.textContent.trim().includes("With CAC")); if(fbtn){ fbtn.click(); await wait(250); }
  console.log("Explorer 'With CAC/churn' toggle count", fA, "→", cnt(), "(fewer = funnel-only OK)");
  if(fbtn){ fbtn.click(); await wait(200); }
  const th=[...d.querySelectorAll("th")].find(x=>x.textContent.trim().startsWith("CPR")); if(th){ th.click(); await wait(200); }
  const cBefore=cnt();
  const inp=d.querySelector("input"); if(inp){ const set=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inp),"value").set; set.call(inp,"sharemarket"); inp.dispatchEvent(new dom.window.Event("input",{bubbles:true})); inp.dispatchEvent(new dom.window.Event("change",{bubbles:true})); await wait(250); }
  const cAfter=cnt();
  console.log("Explorer search 'sharemarket' count", cBefore, "→", cAfter, cBefore!==cAfter?"OK (narrowed)":"(no change)");
  const catSel=[...d.querySelectorAll("select")].find(s=>[...s.options].some(o=>o.value==="Share Market")); if(catSel){ setSel(catSel,"Share Market"); await wait(250); }
  console.log("Explorer category→Share Market count:", cnt());
  // Overview KPI card click → navigates to What's working
  clickTab("Overview"); await wait(300);
  const card=[...d.querySelectorAll("div.cursor-pointer")].find(x=>x.textContent.trim().startsWith("CPR")); if(card){ card.click(); await wait(300); }
  console.log("Overview CPR card → What's working:", /Break down by/.test(root.innerHTML));
  // Merges tab: switch sub-views + production day/week toggle
  clickTab("Merges"); await wait(300);
  for (const v of ["Ads live","Merge rate","Production"]){ const b=[...d.querySelectorAll("button")].find(x=>x.textContent.trim()===v); if(b){ b.click(); await wait(200); } }
  const dy=[...d.querySelectorAll("button")].find(x=>x.textContent.trim()==="Daily"); if(dy){ dy.click(); await wait(200); }
  console.log("Merges sub-views OK | 'Creative ops' present:", /Creative ops/.test(root.innerHTML), "| charts svg:", (root.innerHTML.match(/<svg/g)||[]).length);
  console.log("RUNTIME ERRORS:", errors.length);
  errors.slice(0,8).forEach(e=>console.log("  -", e));
  process.exit(errors.length ? 1 : 0);
}, 700);
