"use client";
/* ============================================================================
   PurrfectCare — main client app (Output Layer)
   Tabs: Today (daily log) · Dashboard · Assistant · Knowledge · Profile · Settings
   Shares the exact same lib/ core (nlp, knowledge, reasoning, nudges) the
   server uses, so the dashboard reacts instantly while chat answers come from
   the server route /api/chat (which holds the API key).
   ============================================================================ */
import { useEffect, useRef, useState } from "react";
import { loadDb, saveDb, blankDb, uid, todayStr, activeCat, logsFor, chatFor } from "../lib/store.js";
import { matchTags, isRedFlag, label as tagLabel } from "../lib/nlp.js";
import { DOCS, retrieve } from "../lib/knowledge.js";
import { evaluate, weightTrend, ageInYears } from "../lib/reasoning.js";
import { overallAppetite } from "../lib/signals.js";
import { compute as computeNudges } from "../lib/nudges.js";
import { seedTasks, taskStatus, todayNum, dueCount } from "../lib/maintenance.js";

const TABS = [
  ["today","📋 Today"],["dashboard","📊 Dashboard"],["calendar","🗓️ Calendar"],["photos","📸 Photos"],
  ["chat","💬 Assistant"],["knowledge","📚 Knowledge"],["profile","🐱 Profile"],["settings","⚙️ Settings"],
];

export default function Page(){
  const [db, setDb] = useState(null);
  const [tab, setTab] = useState("today");
  const [toast, setToast] = useState("");

  useEffect(()=>{
    const loaded = loadDb();
    setDb(loaded);
    if(!activeCat(loaded)) setTab("profile");
  },[]);

  function update(mutator){
    setDb(prev=>{
      const next = structuredClone(prev);
      mutator(next);
      saveDb(next);
      return next;
    });
  }
  function flash(msg){ setToast(msg); setTimeout(()=>setToast(""),1800); }

  if(!db) return <div className="app"><div className="panel">Loading…</div></div>;

  const cat = activeCat(db);
  const needCat = !cat && tab !== "profile" && tab !== "settings";

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brandbox">
          <div className="logo"><CatMark/></div>
          <div className="brand">PurrfectCare<small>cat care companion</small></div>
        </div>
        <div className="catpill" onClick={()=>setTab("profile")} title="Switch / edit cat">
          {cat && cat.photo ? <img className="cat-avatar" src={cat.photo} alt="" /> : <span className="dot" />} {cat ? cat.name : "No cat yet"} <span className="muted">▾</span>
        </div>
        <nav className="snav">
          {TABS.map(([id,labelTxt])=>(
            <button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{labelTxt}</button>
          ))}
        </nav>
      </aside>

      <main className="content">
        {needCat ? <Welcome onAdd={()=>setTab("profile")} />
          : tab==="today" ? <TodayTab db={db} cat={cat} update={update} flash={flash} />
          : tab==="dashboard" ? <DashboardTab db={db} cat={cat} />
          : tab==="calendar" ? <CalendarTab db={db} cat={cat} update={update} flash={flash} />
          : tab==="photos" ? <PhotosTab db={db} cat={cat} update={update} flash={flash} />
          : tab==="chat" ? <ChatTab db={db} cat={cat} update={update} />
          : tab==="knowledge" ? <KnowledgeTab />
          : tab==="profile" ? <ProfileTab db={db} cat={cat} update={update} flash={flash} setTab={setTab} />
          : <SettingsTab db={db} update={update} flash={flash} setTab={setTab} />}

        <p className="disc">
          PurrfectCare offers general, educational guidance drawn from veterinary sources (AVMA, Cornell Feline
          Health Center, ASPCA) and community discussion. It is <b>not a veterinarian</b> and does not diagnose.
          For any urgent or worsening sign, contact a veterinarian or an emergency clinic.
        </p>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ---------- brand mascot ---------- */
function CatMark(){
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {/* whiskers (behind head) */}
      <g stroke="#2a2521" strokeWidth="0.9" strokeLinecap="round">
        <line x1="9.5" y1="18.6" x2="3.4" y2="17.6"/>
        <line x1="9.5" y1="20.4" x2="3.7" y2="21.6"/>
        <line x1="22.5" y1="18.6" x2="28.6" y2="17.6"/>
        <line x1="22.5" y1="20.4" x2="28.3" y2="21.6"/>
      </g>
      {/* ears */}
      <path d="M8 5.5 L6.7 15 L14 10.8 Z" fill="#2a2521"/>
      <path d="M24 5.5 L25.3 15 L18 10.8 Z" fill="#2a2521"/>
      {/* head */}
      <ellipse cx="16" cy="18" rx="9.6" ry="8.6" fill="#2a2521"/>
      {/* inner ears */}
      <path d="M9.2 8 L8.4 13 L12.6 10.6 Z" fill="#f5906f"/>
      <path d="M22.8 8 L23.6 13 L19.4 10.6 Z" fill="#f5906f"/>
      {/* eyes */}
      <ellipse cx="12.4" cy="17.2" rx="1.55" ry="2.15" fill="#7ee0c8"/>
      <ellipse cx="19.6" cy="17.2" rx="1.55" ry="2.15" fill="#7ee0c8"/>
      {/* nose */}
      <path d="M14.8 20 L17.2 20 L16 21.7 Z" fill="#f5906f"/>
      {/* mouth */}
      <path d="M16 21.6 C16 23 14.9 23.4 14 23.1 M16 21.6 C16 23 17.1 23.4 18 23.1"
        stroke="#f5906f" strokeWidth="0.8" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

/* ---------- small shared UI ---------- */
function Welcome({ onAdd }){
  return (
    <div className="panel">
      <h2>Welcome to PurrfectCare 🐾</h2>
      <p className="muted">Start by adding your cat. Then log a quick daily check-in, and the assistant builds
        health trends, food &amp; care guidance, and proactive nudges over time.</p>
      <button className="btn" onClick={onAdd}>➕ Add my cat</button>
    </div>
  );
}

function Seg({ value, options, onChange }){
  return (
    <div className="seg">
      {options.map(o=>(
        <button key={o.v} className={value===o.v?"on":""} onClick={()=>onChange(o.v)} type="button">{o.label}</button>
      ))}
    </div>
  );
}

function Alert({ rec }){
  const ic = rec.severity==="escalate" ? "🚑" : rec.severity==="monitor" ? "👀" : "💡";
  return (
    <div className={"alert "+rec.severity}>
      <span className="ic">{ic}</span>
      <div>
        <b>{rec.title}</b><br/>{rec.body}
        {rec.confidence ? <span className={"conf conf-"+rec.confidence.label}>📊 Confidence: {rec.confidence.label} · {rec.confidence.reason}</span> : null}
        {rec.sources?.length ? <span className="src">Source: {rec.sources.join(", ")}</span> : null}
      </div>
    </div>
  );
}

function Sparkline({ vals }){
  const v = vals.filter(x=>x!=null && !isNaN(x));
  if(!v.length) return null;
  const w=240,h=38,pad=3, mn=Math.min(...v), mx=Math.max(...v), rng=(mx-mn)||1;
  const xy = (val,i)=>[pad+(i*(w-2*pad)/Math.max(1,v.length-1)), h-pad-((val-mn)/rng)*(h-2*pad)];
  const pts = v.map((val,i)=>xy(val,i).map(n=>n.toFixed(1)).join(",")).join(" ");
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline fill="none" stroke="#3fae9b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts}/>
      {v.map((val,i)=>{ const [x,y]=xy(val,i); return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill="#f07a5a"/>; })}
    </svg>
  );
}

/* ---------- metric helpers (client) ---------- */
function deriveLogTags(l){
  const t=[];
  const ap = overallAppetite(l);
  if(ap==="low"||ap==="none") t.push("appetite_decline");
  if(l.energy==="low") t.push("lethargy");
  if(l.water==="high") t.push("excessive_thirst");
  const poop = l.poop || l.litter;              // back-compat with older "litter" field
  if(poop==="loose"||poop==="diarrhea") t.push("diarrhea");
  if(poop==="hard"||poop==="constipated") t.push("constipation");
  if(l.vomit==="once") t.push("vomiting");
  if(l.vomit==="multiple") t.push("repeated_vomiting");
  (l.tags||[]).forEach(x=>t.push(x));
  return t;
}
function aggregateTags(recent){
  const s=new Set();
  recent.forEach(l=>deriveLogTags(l).forEach(t=>s.add(t)));
  return [...s];
}
const scoreAppetite = a => ({none:0,low:1,normal:2,high:3}[a] ?? null);
const scoreEnergy = e => ({low:0,normal:1,playful:2}[e] ?? null);
function lifeStage(cat){ const y=ageInYears(cat); return y<1?"kitten":y>=11?"senior":"adult"; }
function idealCalories(cat){
  if(!cat?.weight) return null;
  let lb = parseFloat(cat.weight); if(isNaN(lb)) return null;
  if(cat.weightUnit==="kg") lb*=2.20462;
  const kcal = Math.round(lb*20);
  const ideal = cat.weightUnit==="kg" ? (lb/2.20462).toFixed(1) : lb.toFixed(1);
  return { kcal, ideal };
}

/* ---------- TODAY ---------- */
function TodayTab({ db, cat, update, flash }){
  const logs = logsFor(db, cat.id);
  const existing = logs.find(l=>l.date===todayStr());
  const DRAFT0 = { appetiteDry:"normal", appetiteWet:"normal", poop:"normal", vomit:"none", water:"normal", energy:"normal", weight:"", notes:"" };
  const [draft, setDraft] = useState(()=> existing ? {...DRAFT0, ...existing} : {...DRAFT0});
  useEffect(()=>{
    const ex = logsFor(db, cat.id).find(l=>l.date===todayStr());
    setDraft(ex ? {...DRAFT0, ...ex} : {...DRAFT0});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cat.id]);

  const set = (k,v)=>setDraft(d=>({...d,[k]:v}));
  const liveTags = matchTags(draft.notes||"");

  function save(){
    const log = {
      date: todayStr(),
      appetiteDry: draft.appetiteDry||"na", appetiteWet: draft.appetiteWet||"na",
      appetite: overallAppetite(draft) || "normal",   // derived overall, for trends + baseline model
      poop: draft.poop||"normal", vomit: draft.vomit||"none",
      water: draft.water||"normal", energy: draft.energy||"normal",
      weight: draft.weight||"", notes: draft.notes||"",
      tags: matchTags(draft.notes||"").map(t=>t.tag),
    };
    update(next=>{
      const arr = (next.logs[cat.id] = next.logs[cat.id] || []);
      const i = arr.findIndex(l=>l.date===log.date);
      if(i>=0) arr[i]=log; else arr.push(log);
      arr.sort((a,b)=>a.date.localeCompare(b.date));
      if(log.weight){ const c=next.cats.find(c=>c.id===cat.id); if(c) c.weight=log.weight; }
    });
    flash("Check-in saved");
  }

  // insights from this day's draft + recent history
  const recent = logs.slice(-7);
  const tags = matchTags(draft.notes||"").concat(deriveLogTags(draft).map(t=>({tag:t})));
  const evald = evaluate({ cat, recentLogs: recent, tags, allLogs: logs });

  // Tasks due/overdue today — surfaced here so you can check them off while logging.
  const todoTasks = ((db.maintenance && db.maintenance[cat.id]) || [])
    .map(t=>({ ...t, s: taskStatus(t, todayNum()) }))
    .filter(t=> t.s.state==="overdue" || t.s.state==="due")
    .sort((a,b)=> a.s.daysUntil - b.s.daysUntil);
  const markTaskDone = (id)=>{ update(next=>{ const t=(next.maintenance[cat.id]||[]).find(x=>x.id===id); if(t) t.lastDone = todayStr(); }); flash("Marked done ✓"); };

  return (
    <>
      <div className="panel">
        <h2>Today's check-in <span className="sub">· {todayStr()} · {cat.name}</span></h2>
        <p className="muted small">A 30-second log. The more days you record, the smarter the trends and nudges get.</p>
        <div className="grid g2">
          <div>
            <label className="f">🥣 Dry food appetite</label>
            <Seg value={draft.appetiteDry} onChange={v=>set("appetiteDry",v)} options={APP_OPTS}/>
            <label className="f">🐟 Wet food appetite</label>
            <Seg value={draft.appetiteWet} onChange={v=>set("appetiteWet",v)} options={APP_OPTS}/>
            <label className="f">💩 Poop</label>
            <Seg value={draft.poop} onChange={v=>set("poop",v)} options={[
              {v:"normal",label:"Normal"},{v:"loose",label:"Loose"},{v:"hard",label:"Hard/straining"},{v:"none",label:"None today"}]}/>
          </div>
          <div>
            <label className="f">💧 Water intake</label>
            <Seg value={draft.water} onChange={v=>set("water",v)} options={[
              {v:"normal",label:"Normal"},{v:"high",label:"A lot"},{v:"low",label:"Little"}]}/>
            <label className="f">⚡ Energy</label>
            <Seg value={draft.energy} onChange={v=>set("energy",v)} options={[
              {v:"playful",label:"Playful"},{v:"normal",label:"Normal"},{v:"low",label:"Lethargic"}]}/>
            <label className="f">🤮 Vomiting</label>
            <Seg value={draft.vomit} onChange={v=>set("vomit",v)} options={[
              {v:"none",label:"None"},{v:"once",label:"Once"},{v:"multiple",label:"2+ times"}]}/>
          </div>
        </div>
        <label className="f">⚖️ Weigh-in <span className="muted">— optional, only when you can (even weekly helps the trend)</span></label>
        <input type="number" step="0.1" placeholder={`e.g. ${cat.weight||"10"} ${cat.weightUnit}`} value={draft.weight}
          onChange={e=>set("weight",e.target.value)} style={{maxWidth:240}} />
        <label className="f">Anything else? (free text — I'll read it for signals)</label>
        <textarea placeholder="e.g. 'She didn't eat much today and seems a bit hidey'"
          value={draft.notes} onChange={e=>set("notes",e.target.value)} />
        {liveTags.length>0 &&
          <div className="pill-list">
            {liveTags.map(t=>(
              <span key={t.tag} className={"chip tag"+(t.redFlag?" red":"")}>{t.redFlag?"⚠️ ":""}{t.label}</span>
            ))}
          </div>}
        <div className="row" style={{marginTop:12}}>
          <button className="btn" onClick={save}>{existing?"Update":"Save"} check-in</button>
          <span className="muted small">{logs.length} day{logs.length===1?"":"s"} logged</span>
        </div>
      </div>

      <div className="panel">
        <h2>✅ To-do today <span className="sub">· {cat.name} · tasks due now</span></h2>
        {todoTasks.length
          ? todoTasks.map(t=>(
              <div key={t.id} className={"mrow "+t.s.state}>
                <span className="ic">{t.icon}</span>
                <div className="mrow-main"><div className="mrow-title">{t.label} <span className="badge">{t.s.label}</span></div></div>
                <div className="mrow-actions"><button className="btn sm" onClick={()=>markTaskDone(t.id)}>✓ Done</button></div>
              </div>))
          : <div className="alert info"><span className="ic">🙌</span><div>Nothing due today — you're all caught up. Check the Calendar for what's coming up.</div></div>}
      </div>

      <div className="panel">
        <h2>What this suggests <span className="sub">· guidance, not diagnosis</span></h2>
        {evald.recs.length
          ? evald.recs.map((r,i)=><Alert key={i} rec={r}/>)
          : <div className="alert info"><span className="ic">✅</span><div>Nothing concerning flagged today. Nice and steady.</div></div>}
      </div>
    </>
  );
}

/* ---------- dashboard triage: merge behavior signals + tasks, by priority ---------- */
function firstSentence(body){
  const m = String(body||"").match(/^.*?[.!?](\s|$)/);
  const s = m ? m[0].trim() : String(body||"");
  return s.length>120 ? s.slice(0,117)+"…" : s;
}
function buildTriage({ evald, tasks, today, careNudges }){
  const warnings=[], actions=[], upcoming=[];
  // cat behavior / health signals
  evald.recs.forEach(r=>{
    const conf = r.confidence ? ` · ${r.confidence.label} confidence` : "";
    const item = {
      icon: r.severity==="escalate" ? "🚑" : r.severity==="monitor" ? "👀" : "💡",
      title: r.title, detail: firstSentence(r.body) + conf,
      tone: r.severity==="escalate" ? "bad" : r.severity==="monitor" ? "warn" : "info",
    };
    if(r.severity==="info") upcoming.push(item); else warnings.push(item);
  });
  // maintenance tasks
  (tasks||[]).forEach(t=>{
    const s = taskStatus(t, today);
    if(s.state==="overdue") actions.push({ icon:t.icon, title:t.label, detail:s.label, tone:"warn" });
    else if(s.state==="due") actions.push({ icon:t.icon, title:t.label, detail:"Due today", tone:"warn" });
    else if(s.state==="upcoming" && s.daysUntil<=3) upcoming.push({ icon:t.icon, title:t.label, detail:s.label, tone:"info" });
    else if(s.state==="new") upcoming.push({ icon:t.icon, title:t.label, detail:"Set a schedule", tone:"info" });
  });
  // care reminders
  (careNudges||[]).forEach(n=>{
    if(n.key==="log") actions.push({ icon:n.icon, title:n.text, detail:"", tone:"warn" });
    else upcoming.push({ icon:n.icon, title:n.text, detail:n.cadence||"", tone:"info" });
  });
  return { warnings, actions, upcoming };
}
function TriageGroup({ label, items, empty, cap=6 }){
  const shown = items.slice(0, cap), more = items.length - shown.length;
  return (
    <div className="tgroup">
      <div className="tgroup-h">{label} <span className="tcount">{items.length}</span></div>
      {shown.length
        ? shown.map((it,i)=>(
            <div key={i} className={"titem "+it.tone}>
              <span className="ic">{it.icon}</span>
              <div><div className="tt">{it.title}</div>{it.detail && <div className="td">{it.detail}</div>}</div>
            </div>))
        : <div className="tempty">{empty}</div>}
      {more>0 && <div className="tmore">+{more} more</div>}
    </div>
  );
}

/* ---------- DASHBOARD ---------- */
function DashboardTab({ db, cat }){
  const logs = logsFor(db, cat.id);
  const recent = logs.slice(-14);
  const tags = aggregateTags(recent).map(t=>({tag:t}));
  const evald = evaluate({ cat, recentLogs: recent, tags, allLogs: logs });
  const wt = weightTrend(cat, logs);
  const ideal = idealCalories(cat);
  const tasks = (db.maintenance && db.maintenance[cat.id]) || [];
  const tri = buildTriage({ evald, tasks, today: todayNum(), careNudges: computeNudges(cat, logs) });
  const foodDocs = retrieve(["diet"], "feeding portion "+(cat.food||""), 2);
  const stage = lifeStage(cat);
  const longHair = /(persian|maine|ragdoll|long)/i.test(cat.breed||"");

  return (
    <>
      <div className="grid g3">
        <div className="kpi"><span className="v">{logs.length}</span><span className="l">days logged</span></div>
        <div className="kpi"><span className="v">{cat.weight||"—"} <span className="l" style={{display:"inline"}}>{cat.weightUnit}</span></span>
          <span className="l">current weight {wt?`(${wt.pct>=0?"+":""}${wt.pct.toFixed(0)}%)`:""}</span></div>
        <div className="kpi"><span className="v">{ideal?ideal.kcal:"—"}</span>
          <span className="l">{ideal?"kcal/day target":"set weight for target"}</span></div>
      </div>

      <div className="panel">
        <h2>What needs attention <span className="sub">· {cat.name} · health &amp; what's coming up</span></h2>
        <TriageGroup label="⚠️ Warnings" items={tri.warnings} empty={`No health warnings — ${cat.name} looks good ✅`}/>
        <TriageGroup label="🔜 Upcoming" items={tri.upcoming} empty="Nothing on the horizon"/>
      </div>

      <div className="grid g2">
        <div className="panel">
          <h2>Trends</h2>
          <Trend label="Appetite" vals={recent.map(l=>scoreAppetite(overallAppetite(l)))}/>
          <Trend label="Energy" vals={recent.map(l=>scoreEnergy(l.energy))}/>
          {wt
            ? <><div className="muted small" style={{marginTop:8}}>Weight: {wt.first} → {wt.last} {cat.weightUnit}</div>
                <Sparkline vals={logs.filter(l=>l.weight).map(l=>parseFloat(l.weight))}/></>
            : <div className="muted small" style={{marginTop:8}}>Log weight a few times to see a weight trend.</div>}
        </div>
        <div className="panel">
          <h2>🍽️ Food guidance</h2>
          <p className="small">Current food: <b>{cat.food||"not set"}</b> · schedule: <b>{cat.feeding||"not set"}</b></p>
          {ideal
            ? <div className="alert info"><span className="ic">📏</span><div>Target ≈ <b>{ideal.kcal} kcal/day</b> for an ideal weight of {ideal.ideal} {cat.weightUnit}. Split across {stage==="kitten"?"3–4":"2"} measured meals. Match this to the calorie chart on your food's label.</div></div>
            : <div className="alert monitor"><span className="ic">📏</span><div>Add your cat's weight in the profile to get a daily calorie target.</div></div>}
          <div className="row" style={{marginTop:6}}>
            {["Prioritize wet food for hydration","Measure portions, avoid free-feeding","Fresh water / fountain available"].map(t=>
              <span key={t} className="chip tag">✓ {t}</span>)}
          </div>
          <p className="small muted" style={{marginTop:8}}>From: {foodDocs.map(d=>d.source).join("; ")}</p>
        </div>
      </div>

      <div className="panel">
        <h2>🧶 Care routine <span className="sub">· general best practices</span></h2>
        <div className="grid g2">
          {[
            {i:"🪥",t:"Dental: brush with cat-safe enzymatic toothpaste; watch for bad breath/red gums."},
            {i:"🧴",t:`Coat: brush ${longHair?"daily (long-haired)":"weekly"}; check for mats and fleas.`},
            {i:"🐾",t:"Litter: N+1 boxes, scoop daily, unscented litter, quiet spot."},
            {i:"🧗",t:"Enrichment: vertical space, scratching posts, hiding spots, daily play."},
          ].map((x,i)=><div key={i} className="alert info"><span className="ic">{x.i}</span><div>{x.t}</div></div>)}
        </div>
      </div>
    </>
  );
}
function Trend({ label, vals }){
  const v = vals.filter(x=>x!=null);
  if(!v.length) return <div className="small muted">{label}: no data yet</div>;
  return <><div className="small" style={{marginTop:6}}>{label}</div><Sparkline vals={v}/></>;
}

/* ---------- lightweight markdown for assistant replies ---------- */
// inline: **bold**, *italic* / _italic_, `code`, [text](url)
function inlineFormat(str){
  const nodes = [];
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))|(?:\*([^*\n]+)\*)|(?:_([^_\n]+)_)/g;
  let last = 0, m, key = 0;
  while((m = re.exec(str))){
    if(m.index > last) nodes.push(str.slice(last, m.index));
    if(m[1]) nodes.push(<strong key={key++}>{m[2]}</strong>);
    else if(m[3]) nodes.push(<code key={key++}>{m[4]}</code>);
    else if(m[5]) nodes.push(<a key={key++} href={m[7]} target="_blank" rel="noreferrer">{m[6]}</a>);
    else if(m[8] != null) nodes.push(<em key={key++}>{m[8]}</em>);
    else if(m[9] != null) nodes.push(<em key={key++}>{m[9]}</em>);
    last = re.lastIndex;
  }
  if(last < str.length) nodes.push(str.slice(last));
  return nodes;
}
// block: paragraphs, blank-line spacing, and bullet lists
function renderRichText(text){
  const lines = String(text||"").split("\n");
  const blocks = []; let list = null; let key = 0;
  const flush = ()=>{ if(list){ blocks.push(<ul key={key++} className="msg-ul">{list}</ul>); list = null; } };
  lines.forEach((ln, idx)=>{
    const bullet = ln.match(/^\s*[-*•]\s+(.*)$/);
    if(bullet){
      list = list || [];
      list.push(<li key={idx}>{inlineFormat(bullet[1])}</li>);
    } else {
      flush();
      if(ln.trim() === "") blocks.push(<div key={key++} className="msg-sp"/>);
      else blocks.push(<div key={key++}>{inlineFormat(ln)}</div>);
    }
  });
  flush();
  return blocks;
}

/* ---------- CHAT ---------- */
const CHAT_MODELS = [
  { v:"", label:"Default (Opus 4.8)" },
  { v:"claude-opus-4-8", label:"Opus 4.8 — most capable" },
  { v:"claude-sonnet-4-6", label:"Sonnet 4.6 — balanced" },
  { v:"claude-haiku-4-5", label:"Haiku 4.5 — fast & cheap" },
];
function ChatTab({ db, cat, update }){
  const msgs = chatFor(db, cat.id);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);
  const modelChoice = (db.settings && db.settings.model) || "";
  const setModel = (v)=> update(next=>{ next.settings = next.settings || {}; next.settings.model = v; });

  useEffect(()=>{ if(boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight; },[msgs.length, busy]);

  async function submit(text){
    const q = (text ?? input).trim();
    if(!q || busy) return;
    setInput("");
    setBusy(true);
    update(next=>{ (next.chats[cat.id] = next.chats[cat.id] || []).push({role:"user",text:q,ts:Date.now()}); });

    const logs = logsFor(db, cat.id).slice(-7);
    let reply = { text:"", meta:"" };
    try {
      const res = await fetch("/api/chat", {
        method:"POST", headers:{"content-type":"application/json"},
        body: JSON.stringify({ question:q, cat, logs, model: modelChoice || undefined }),
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error);
      const engine = data.used==="claude"
        ? `✨ Claude${data.model ? ` (${data.model})` : ""}`
        : data.used==="rules-no-key"
          ? "⚙️ built-in engine — set ANTHROPIC_API_KEY to enable Claude"
          : "⚙️ built-in engine — Claude unavailable, retried";
      reply = { text:data.text, meta:`${engine} · sources: ${(data.sources||[]).join("; ")||"—"}` };
    } catch(e){
      reply = { text:`Sorry — I couldn't reach the assistant service. (${e.message})`, meta:"error" };
    }
    update(next=>{ (next.chats[cat.id] = next.chats[cat.id] || []).push({role:"bot",text:reply.text,meta:reply.meta,ts:Date.now()}); });
    setBusy(false);
  }

  const quick = ["He isn't eating much","How much should I feed her?","Drinking a lot lately","Bad breath and drooling"];

  return (
    <div className="panel chat">
      <div className="row" style={{justifyContent:"space-between", alignItems:"center", gap:10}}>
        <h2 style={{margin:0}}>Assistant <span className="sub">· knowledge-grounded · {cat.name}</span></h2>
        <select value={modelChoice} onChange={e=>setModel(e.target.value)} title="Model used when an API key is set"
          style={{width:"auto", minWidth:170, padding:"7px 10px"}}>
          {CHAT_MODELS.map(m=><option key={m.v} value={m.v}>{m.label}</option>)}
        </select>
      </div>
      <div className="msgs" ref={boxRef}>
        {msgs.length===0
          ? <div className="empty">Ask me anything about {cat.name} — feeding, a worrying sign, grooming, behavior…<br/>
              <span className="small">e.g. "She's been drinking a lot and eating less"</span></div>
          : msgs.map((m,i)=>(
              <div key={i} className={"msg "+(m.role==="user"?"user":"bot")}>
                {m.role==="user" ? m.text : <div className="msg-rich">{renderRichText(m.text)}</div>}
                {m.meta && <span className="meta">{m.meta}</span>}
              </div>))}
        {busy && <div className="msg bot">…</div>}
      </div>
      <div className="chatbar">
        <input placeholder="Type a question or describe what you're noticing…" value={input}
          onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") submit(); }} disabled={busy}/>
        <button className="btn" onClick={()=>submit()} disabled={busy}>Send</button>
      </div>
      <div className="row" style={{marginTop:8}}>
        {quick.map(q=><span key={q} className="chip" onClick={()=>submit(q)}>{q}</span>)}
      </div>
    </div>
  );
}

/* ---------- KNOWLEDGE ---------- */
function KnowledgeTab(){
  const [q, setQ] = useState("");
  const types = {vet:"🏥 Veterinary",breed:"🐈 Breed",community:"💬 Community",product:"🛒 Product"};
  const ql = q.toLowerCase();
  const shown = DOCS.filter(d => (d.title+" "+d.body+" "+d.tags.join(" ")).toLowerCase().includes(ql));
  return (
    <div className="panel">
      <h2>Knowledge base <span className="sub">· {DOCS.length} curated entries</span></h2>
      <p className="muted small">These are the sources the assistant retrieves from (RAG). Veterinary sources are weighted
        highest; community and product entries are clearly labeled as opinion.</p>
      <input placeholder="Search the knowledge base…" value={q} onChange={e=>setQ(e.target.value)} style={{margin:"10px 0"}}/>
      {shown.map(d=>(
        <div key={d.id} className="kb-card">
          <h3>{d.title} <span className="badge">{types[d.sourceType]||d.sourceType}</span></h3>
          <div className="small">{d.body}</div>
          <div className="small muted" style={{marginTop:6}}>Source: {d.source}</div>
        </div>
      ))}
      {shown.length===0 && <div className="empty">No entries match “{q}”.</div>}
    </div>
  );
}

/* ---------- CALENDAR (maintenance / upkeep) ---------- */
function CalendarTab({ db, cat, update, flash }){
  const tasks = db.maintenance && db.maintenance[cat.id];
  const [newLabel, setNewLabel] = useState("");
  const [newCad, setNewCad] = useState(7);

  useEffect(()=>{
    if(!tasks){
      update(next=>{ next.maintenance = next.maintenance || {}; next.maintenance[cat.id] = seedTasks(); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cat.id, !!tasks]);

  if(!tasks) return <div className="panel"><h2>🗓️ Maintenance calendar</h2><p className="muted">Setting up your upkeep list…</p></div>;

  const today = todayNum();
  const order = { overdue:0, due:1, new:2, upcoming:3 };
  const rows = tasks.map(t=>({ ...t, s: taskStatus(t, today) }))
    .sort((a,b)=> (order[a.s.state]-order[b.s.state]) || (a.s.daysUntil-b.s.daysUntil));

  const markDone = (id)=>{ update(next=>{ const t=next.maintenance[cat.id].find(x=>x.id===id); if(t) t.lastDone = todayStr(); }); flash("Marked done ✓"); };
  const setCad   = (id,v)=> update(next=>{ const t=next.maintenance[cat.id].find(x=>x.id===id); if(t) t.cadenceDays = Math.max(1, parseInt(v)||1); });
  const remove   = (id)=> update(next=>{ next.maintenance[cat.id] = next.maintenance[cat.id].filter(x=>x.id!==id); });
  const addTask  = ()=>{
    const label = newLabel.trim(); if(!label) return;
    update(next=>{ next.maintenance[cat.id].push({ id: uid(), label, icon:"🔔", cadenceDays: Math.max(1, parseInt(newCad)||7), category:"Custom", lastDone:null }); });
    setNewLabel(""); setNewCad(7); flash("Task added");
  };

  const Row = (t)=>(
    <div key={t.id} className={"mrow "+t.s.state}>
      <span className="ic">{t.icon}</span>
      <div className="mrow-main">
        <div className="mrow-title">{t.label} <span className="badge">{t.s.label}</span></div>
        <div className="small muted">Every <input className="cad" type="number" min="1" value={t.cadenceDays} onChange={e=>setCad(t.id, e.target.value)}/> days{t.lastDone ? ` · last done ${t.lastDone}` : ""}</div>
      </div>
      <div className="mrow-actions">
        <button className="btn sm" onClick={()=>markDone(t.id)}>✓ Done</button>
        <button className="icon-btn" title="Remove task" onClick={()=>remove(t.id)}>✕</button>
      </div>
    </div>
  );

  const groups = [["overdue","⏰ Overdue"],["due","📅 Due today"],["new","🆕 Set up"],["upcoming","🔜 Upcoming"]];

  return (
    <div className="panel">
      <h2>🗓️ Maintenance calendar <span className="sub">· {cat.name} · supplies, litter &amp; grooming on a schedule</span></h2>
      <p className="muted small">Tap <b>✓ Done</b> when you finish a task — it resets the timer and tells you when it's due again. Adjust how often any task recurs, or add your own.</p>
      {groups.map(([state,header])=>{
        const items = rows.filter(t=>t.s.state===state);
        if(!items.length) return null;
        return <div key={state}><div className="mgroup-h">{header} ({items.length})</div>{items.map(Row)}</div>;
      })}
      <div className="mgroup-h">➕ Add a task</div>
      <div className="row">
        <input placeholder="e.g. Order more pee pads" value={newLabel} onChange={e=>setNewLabel(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter") addTask(); }} style={{flex:2, minWidth:180}}/>
        <span className="small muted">every</span>
        <input type="number" min="1" value={newCad} onChange={e=>setNewCad(e.target.value)} style={{width:80}}/>
        <span className="small muted">days</span>
        <button className="btn" onClick={addTask}>Add</button>
      </div>
    </div>
  );
}

/* ---------- PHOTOS (visual log) ---------- */
// Downscale + re-encode to JPEG so base64 photos stay small in localStorage.
function resizeImage(file, maxDim, quality){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if(w >= h && w > maxDim){ h = Math.round(h*maxDim/w); w = maxDim; }
        else if(h > w && h > maxDim){ w = Math.round(w*maxDim/h); h = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const PHOTO_AREAS = ["General","Eyes","Ears","Mouth/Teeth","Skin/Coat","Paws/Nails","Litter/Stool","Wound/Lump","Other"];
const concernLabel = c => c==="vet" ? "See a vet" : c==="monitor" ? "Monitor" : "Looks OK";
function PhotosTab({ db, cat, update, flash }){
  const photos = (db.photos && db.photos[cat.id]) || [];
  const fileRef = useRef(null);
  const [area, setArea] = useState("General");
  const [caption, setCaption] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [trendArea, setTrendArea] = useState("");
  const [trend, setTrend] = useState(null);   // null | "loading" | {area,concern,summary,advice}
  const lite = { name:cat.name, age:cat.age, ageUnit:cat.ageUnit, breed:cat.breed, conditions:cat.conditions };

  async function onFile(e){
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if(!f) return;
    try{
      const dataUrl = await resizeImage(f, 1000, 0.72);
      update(next=>{
        next.photos = next.photos || {};
        (next.photos[cat.id] = next.photos[cat.id] || []).push({
          id: uid(), dataUrl, date: todayStr(),
          area, caption: caption.trim(), ts: Date.now(),
        });
      });
      setCaption(""); flash("Photo added 📸");
    }catch{ alert("Sorry — couldn't process that image."); }
  }
  const remove = (id)=> update(next=>{ next.photos[cat.id] = (next.photos[cat.id]||[]).filter(p=>p.id!==id); });

  async function analyzeOne(p){
    setBusyId(p.id);
    try{
      const res = await fetch("/api/analyze", { method:"POST", headers:{"content-type":"application/json"},
        body: JSON.stringify({ images:[{ base64:p.dataUrl.split(",")[1], mediaType:"image/jpeg", date:p.date, area:p.area }], cat:lite, context:p.caption }) });
      const data = await res.json();
      if(data.error){ alert(data.error); return; }
      update(next=>{ const ph=(next.photos[cat.id]||[]).find(x=>x.id===p.id); if(ph) ph.analysis = { summary:data.summary, advice:data.advice, concern:data.concern, ts:Date.now() }; });
      flash("Analyzed ✓");
    }catch(err){ alert("Analysis failed: "+err.message); }
    finally{ setBusyId(null); }
  }

  async function analyzeTrend(){
    if(!trendArea) return;
    const imgs = photos.filter(p=>p.area===trendArea).sort((a,b)=>a.ts-b.ts).slice(-4)
      .map(p=>({ base64:p.dataUrl.split(",")[1], mediaType:"image/jpeg", date:p.date, area:p.area }));
    if(imgs.length<2){ alert("Need at least 2 photos in this area to compare."); return; }
    setTrend("loading");
    try{
      const res = await fetch("/api/analyze", { method:"POST", headers:{"content-type":"application/json"},
        body: JSON.stringify({ images:imgs, cat:lite }) });
      const data = await res.json();
      if(data.error){ setTrend(null); alert(data.error); return; }
      setTrend({ area:trendArea, concern:data.concern, summary:data.summary, advice:data.advice });
    }catch(err){ setTrend(null); alert("Trend analysis failed: "+err.message); }
  }

  const sorted = [...photos].sort((a,b)=> b.ts - a.ts);
  const areaCounts = {}; photos.forEach(p=>{ areaCounts[p.area]=(areaCounts[p.area]||0)+1; });
  const multiAreas = Object.keys(areaCounts).filter(a=>areaCounts[a]>=2);

  return (
    <div className="panel">
      <h2>📸 Photos <span className="sub">· {cat.name} · for fun &amp; tracking visual cues</span></h2>
      <p className="muted small">Keep a visual record — coat, eyes, skin, a lump you're watching, even litter. Tag the
        area so you can compare over time. <b>🔍 Analyze</b> asks Claude to read a photo for visible concerns
        (needs your ANTHROPIC_API_KEY). Photos stay private in your browser. Guidance, not a diagnosis.</p>

      <div className="row" style={{margin:"12px 0"}}>
        <select value={area} onChange={e=>setArea(e.target.value)} style={{width:150}}>
          {PHOTO_AREAS.map(a=><option key={a}>{a}</option>)}
        </select>
        <input placeholder="Caption (optional) — e.g. “left eye watery”" value={caption}
          onChange={e=>setCaption(e.target.value)} style={{flex:2, minWidth:180}}/>
        <button className="btn" onClick={()=>fileRef.current && fileRef.current.click()}>📷 Upload</button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{display:"none"}}/>
      </div>

      {multiAreas.length>0 &&
        <div className="row" style={{margin:"0 0 12px"}}>
          <span className="small muted">📈 Trend:</span>
          <select value={trendArea} onChange={e=>setTrendArea(e.target.value)} style={{width:160}}>
            <option value="">Choose an area…</option>
            {multiAreas.map(a=><option key={a}>{a} ({areaCounts[a]})</option>)}
          </select>
          <button className="btn ghost sm" onClick={analyzeTrend} disabled={!trendArea || trend==="loading"}>
            {trend==="loading" ? "Analyzing…" : "Analyze over time"}</button>
        </div>}
      {trend && trend!=="loading" &&
        <div className={"alert "+(trend.concern==="vet"?"escalate":trend.concern==="monitor"?"monitor":"info")}>
          <span className="ic">📈</span>
          <div><b>{trend.area} — change over time</b><br/>{trend.summary}{trend.advice?` ${trend.advice}`:""}
            <span className="src">Visual guidance from Claude · not a diagnosis</span></div>
        </div>}

      {sorted.length===0
        ? <div className="empty">No photos yet — add your first one above. 🐱</div>
        : <div className="photo-grid">
            {sorted.map(p=>(
              <div key={p.id} className="photo-card">
                <img src={p.dataUrl} alt={p.caption || p.area}/>
                <button className="photo-del" title="Delete photo" onClick={()=>remove(p.id)}>✕</button>
                <div className="photo-meta">
                  <span className="badge">{p.area}</span> <span className="muted small">{p.date}</span>
                  {p.caption && <div className="small">{p.caption}</div>}
                  {p.analysis
                    ? <div className="photo-analysis">
                        <span className={"concern "+p.analysis.concern}>{concernLabel(p.analysis.concern)}</span>
                        <span className="small"> {p.analysis.summary}</span>
                        {p.analysis.advice && <div className="small muted">{p.analysis.advice}</div>}
                      </div>
                    : <button className="btn ghost sm" style={{marginTop:7}} disabled={busyId===p.id} onClick={()=>analyzeOne(p)}>
                        {busyId===p.id ? "Analyzing…" : "🔍 Analyze"}</button>}
                </div>
              </div>
            ))}
          </div>}
    </div>
  );
}

/* ---------- PROFILE ---------- */
const BREEDS = ["Domestic Shorthair","Domestic Longhair","Maine Coon","Persian","Siamese","Ragdoll","Bengal","British Shorthair","Sphynx","Russian Blue","Tabby","Abyssinian"];
// Per-food appetite: "Ate well"=normal, "Some"=low, "None"=none, "N/A"=not offered
const APP_OPTS = [{v:"normal",label:"Ate well"},{v:"low",label:"Some"},{v:"none",label:"None"},{v:"na",label:"N/A"}];
function ProfileTab({ db, cat, update, flash, setTab }){
  const blank = { name:"", age:"", ageUnit:"years", breed:"", sex:"female", weight:"", weightUnit:"lb", neutered:true, food:"", feeding:"", conditions:"", photo:"" };
  const [form, setForm] = useState(()=> cat ? {...blank, ...cat} : blank);
  const editingId = cat?.id || null;
  useEffect(()=>{ setForm(cat ? {...blank, ...cat} : blank); /* eslint-disable-next-line */ },[cat?.id]);
  const set = (k,v)=>setForm(f=>({...f,[k]:v}));
  const avatarRef = useRef(null);
  async function onAvatar(e){
    const f = e.target.files && e.target.files[0]; e.target.value="";
    if(!f) return;
    try{ set("photo", await resizeImage(f, 320, 0.82)); }catch{ alert("Sorry — couldn't process that image."); }
  }

  function save(){
    const data = { ...form, name: (form.name||"").trim()||"My cat", neutered: !!form.neutered };
    if(editingId){
      update(next=>{ const c=next.cats.find(c=>c.id===editingId); if(c) Object.assign(c,data); });
      flash("Profile saved");
    } else {
      const id = uid();
      update(next=>{ next.cats.push({id,createdAt:todayStr(),...data}); next.activeCatId=id; });
      flash("Cat created");
    }
    setTab("today");
  }
  function del(){
    if(!confirm("Delete "+cat.name+" and all their logs?")) return;
    update(next=>{
      next.cats = next.cats.filter(c=>c.id!==cat.id);
      delete next.logs[cat.id]; delete next.chats[cat.id];
      next.activeCatId = next.cats[0]?.id || null;
    });
    flash("Deleted");
  }

  return (
    <div className="panel">
      <h2>{cat?"Edit profile":"Add your cat"}</h2>
      {db.cats.length>1 &&
        <><label className="f">Switch cat</label>
        <select value={db.activeCatId} onChange={e=>update(next=>{next.activeCatId=e.target.value;})}>
          {db.cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select></>}
      <label className="f">Photo</label>
      <div className="row" style={{alignItems:"center"}}>
        {form.photo ? <img src={form.photo} className="avatar-lg" alt=""/> : <div className="avatar-lg ph"><CatMark/></div>}
        <button type="button" className="btn ghost sm" onClick={()=>avatarRef.current && avatarRef.current.click()}>{form.photo?"Change photo":"Upload photo"}</button>
        {form.photo && <button type="button" className="btn ghost sm" onClick={()=>set("photo","")}>Remove</button>}
        <input ref={avatarRef} type="file" accept="image/*" onChange={onAvatar} style={{display:"none"}}/>
      </div>
      <div className="grid g2">
        <div>
          <label className="f">Name</label>
          <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Mochi"/>
          <label className="f">Age</label>
          <div className="row">
            <input type="number" step="0.1" value={form.age} onChange={e=>set("age",e.target.value)} style={{flex:2}}/>
            <select value={form.ageUnit} onChange={e=>set("ageUnit",e.target.value)} style={{flex:1}}>
              <option value="years">years</option><option value="months">months</option></select>
          </div>
          <label className="f">Breed</label>
          <input list="breeds" value={form.breed} onChange={e=>set("breed",e.target.value)} placeholder="e.g. Domestic Shorthair"/>
          <datalist id="breeds">{BREEDS.map(b=><option key={b} value={b}/>)}</datalist>
          <label className="f">Sex</label>
          <select value={form.sex} onChange={e=>set("sex",e.target.value)}>
            <option value="female">female</option><option value="male">male</option></select>
        </div>
        <div>
          <label className="f">Weight</label>
          <div className="row">
            <input type="number" step="0.1" value={form.weight} onChange={e=>set("weight",e.target.value)} style={{flex:2}}/>
            <select value={form.weightUnit} onChange={e=>set("weightUnit",e.target.value)} style={{flex:1}}>
              <option value="lb">lb</option><option value="kg">kg</option></select>
          </div>
          <label className="f">Spayed / neutered?</label>
          <select value={form.neutered?"true":"false"} onChange={e=>set("neutered",e.target.value==="true")}>
            <option value="true">yes</option><option value="false">no</option></select>
          <label className="f">Current food (brand / type)</label>
          <input value={form.food} onChange={e=>set("food",e.target.value)} placeholder="e.g. Hill's Science Diet Adult, wet"/>
          <label className="f">Feeding schedule</label>
          <input value={form.feeding} onChange={e=>set("feeding",e.target.value)} placeholder="e.g. 2 meals/day, 1/4 cup each"/>
          <label className="f">Medical history / conditions</label>
          <textarea value={form.conditions} onChange={e=>set("conditions",e.target.value)} placeholder="e.g. early kidney disease, sensitive stomach"/>
        </div>
      </div>
      <div className="row" style={{marginTop:14}}>
        <button className="btn" onClick={save}>{cat?"Save changes":"Create profile"}</button>
        {cat && <button className="btn ghost" onClick={()=>update(next=>{next.activeCatId=null;})}>+ Add another cat</button>}
        {cat && <button className="btn ghost" onClick={del} style={{marginLeft:"auto",color:"var(--bad)"}}>Delete {cat.name}</button>}
      </div>
    </div>
  );
}

/* ---------- SETTINGS ---------- */
function SettingsTab({ db, update, flash, setTab }){
  const fileRef = useRef(null);
  function exportData(){
    const blob = new Blob([JSON.stringify(db,null,2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "purrfectcare-backup.json"; a.click();
  }
  function importData(e){
    const f = e.target.files?.[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ()=>{ try{ const parsed = JSON.parse(r.result); update(next=>{ Object.assign(next, blankDb(), parsed); }); flash("Imported"); }catch{ alert("Invalid file"); } };
    r.readAsText(f);
  }
  function reset(){
    if(!confirm("Erase ALL cats, logs and chats? This cannot be undone.")) return;
    update(next=>{ const b=blankDb(); Object.keys(next).forEach(k=>delete next[k]); Object.assign(next,b); });
    flash("Erased"); setTab("profile");
  }
  return (
    <div className="panel">
      <h2>Settings</h2>

      <h3 style={{margin:"8px 0 2px",fontSize:14}}>🤖 AI engine</h3>
      <p className="muted small">
        The assistant runs server-side at <code>/api/chat</code>. It uses the <b>ANTHROPIC_API_KEY</b> environment
        variable — set in your <code>.env.local</code> for local dev and in your Vercel project's Environment
        Variables for production. The key never reaches the browser. If no key is set, the app automatically falls
        back to the built-in, guardrailed rule engine, so it always works.
      </p>

      <h3 style={{margin:"18px 0 2px",fontSize:14}}>💾 Your data</h3>
      <p className="muted small">Stored locally in this browser. Export to back up, or import to restore.
        (Cross-device sync arrives when you add the Postgres layer — see the README.)</p>
      <div className="row">
        <button className="btn ghost" onClick={exportData}>⬇️ Export JSON</button>
        <button className="btn ghost" onClick={()=>fileRef.current?.click()}>⬆️ Import JSON</button>
        <input ref={fileRef} type="file" accept="application/json" onChange={importData} style={{display:"none"}}/>
        <button className="btn ghost" onClick={reset} style={{marginLeft:"auto",color:"var(--bad)"}}>Erase all data</button>
      </div>
    </div>
  );
}
