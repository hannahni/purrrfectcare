/* ============================================================================
   Signals — temporal modeling of behavioral signals (MVP: appetite + weight)
   ----------------------------------------------------------------------------
   Instead of absolute thresholds, we model each cat against ITS OWN baseline:

     • Ordinal signals (appetite/energy/water): robust rolling baseline
       (median + MAD) -> modified z-score of the latest day. This answers
       "is this cat eating less THAN ITS NORMAL?", not "below a global cutoff".

     • Weight: ordinary least-squares regression over time -> slope with a
       ~95% confidence interval, expressed as %/week. The CI is the uncertainty:
       we only call it "losing/gaining" when the whole interval is on one side
       of zero; otherwise it's "stable" (change is within noise).

   Every result carries a `confidence` derived from data sufficiency (how many
   days logged) AND effect size (how far from baseline). This is what turns a
   single-answer recommender into one that knows how sure it is.

   GRADUATION: swap OLS for a rolling/￼state-space estimate, add change-point
   detection, and calibrate confidence against labeled outcomes.
   ============================================================================ */

const ENC = {
  appetite: { none:0, low:1, normal:2, high:3 },
  energy:   { low:0, normal:1, playful:2 },
  water:    { low:0, normal:1, high:2 },
};

const MIN_BASELINE = 4;     // need at least this many prior points to compare
const FULL_CONF_DAYS = 14;  // data-sufficiency saturates here

/* ---------- stats helpers ---------- */
function median(arr){
  if(!arr.length) return null;
  const s=[...arr].sort((a,b)=>a-b), m=Math.floor(s.length/2);
  return s.length%2 ? s[m] : (s[m-1]+s[m])/2;
}
function mad(arr, med){
  if(!arr.length) return 0;
  const m = med==null ? median(arr) : med;
  return median(arr.map(x=>Math.abs(x-m)));
}
function mean(arr){ return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function std(arr){
  if(arr.length<2) return 0;
  const m=mean(arr);
  return Math.sqrt(arr.reduce((s,x)=>s+(x-m)**2,0)/(arr.length-1));
}
function round(x,d){ const f=10**d; return Math.round(x*f)/f; }
function dayNum(dateStr){ return Math.floor(new Date(dateStr+"T00:00:00").getTime()/86400000); }

/* ---------- confidence: data sufficiency × effect size ---------- */
function confidenceFrom(nPoints, effect){
  const dataF = clamp01((nPoints - (MIN_BASELINE-1)) / (FULL_CONF_DAYS - (MIN_BASELINE-1)));
  const effF  = clamp01(effect / 3);          // |z| or t≈3 counts as a strong effect
  const score = round(0.6*dataF + 0.4*effF, 2);
  const label = score>=0.7 ? "high" : score>=0.4 ? "moderate" : "low";
  const reason = nPoints < FULL_CONF_DAYS
    ? `based on ${nPoints} day${nPoints===1?"":"s"} of data — still building a baseline`
    : `based on ${nPoints} days of data`;
  return { score, label, dataPoints:nPoints, reason };
}
function clamp01(x){ return Math.max(0, Math.min(1, x)); }

/* ---------- overall appetite (combine dry + wet food) ----------
   Shared by signals, reasoning and the UI so everyone agrees on "is the cat
   eating?". Per-food encoding none=0/low=1/normal=2; "na" (not offered) skipped.
   Falls back to a legacy single `appetite` field for older logs. */
export function overallAppetite(l){
  const enc = { none:0, low:1, normal:2 };
  const vals = [l.appetiteDry, l.appetiteWet].map(v=>enc[v]).filter(v=>v!=null);
  if(vals.length){
    const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
    return avg < 0.5 ? "none" : avg < 1.5 ? "low" : "normal";
  }
  return l.appetite != null ? l.appetite : null;
}
function appetiteNum(l){
  const c = overallAppetite(l);
  return c == null ? null : ({ none:0, low:1, normal:2, high:3 })[c];
}

/* ---------- ordinal baseline-deviation ----------
   `extractor` maps a log -> numeric value (or null to skip the day). */
function ordinalDeviation(logs, extractor, signalName){
  const vals = logs.map(extractor).filter(v=>v!=null);
  if(vals.length < MIN_BASELINE + 1) return null;   // not enough history to judge

  const latest = vals[vals.length-1];
  const baseline = vals.slice(0, -1);
  const med = median(baseline);
  const scale = mad(baseline);

  let z;
  if(scale > 0){
    z = 0.6745 * (latest - med) / scale;            // robust modified z-score
  } else {
    const sd = std(baseline);                        // MAD==0 fallback
    z = sd > 0 ? (latest - med)/sd : (latest===med ? 0 : (latest<med ? -2 : 2));
  }
  return {
    signal: signalName,
    latest, baselineMedian: med, z: round(z,2),
    direction: z <= -1 ? "below" : z >= 1 ? "above" : "normal",
    nDays: vals.length,
    confidence: confidenceFrom(vals.length, Math.abs(z)),
  };
}

/* ---------- weight regression with confidence interval ---------- */
function weightRegression(logs){
  const pts = [];
  logs.forEach(l=>{
    const w = parseFloat(l.weight);
    if(l.weight !== "" && !isNaN(w)) pts.push({ t: dayNum(l.date), w });
  });
  if(pts.length < 3) return null;

  const t0 = pts[0].t;
  const xs = pts.map(p=>p.t - t0), ys = pts.map(p=>p.w);
  const n = xs.length, mx = mean(xs), my = mean(ys);

  let sxx=0, sxy=0;
  for(let i=0;i<n;i++){ sxx += (xs[i]-mx)**2; sxy += (xs[i]-mx)*(ys[i]-my); }
  if(sxx === 0) return null;

  const slope = sxy/sxx;                 // weight units per day
  const intercept = my - slope*mx;

  let sse=0;
  for(let i=0;i<n;i++){ const pred = intercept + slope*xs[i]; sse += (ys[i]-pred)**2; }
  const df = n - 2;
  const resSE  = df>0 ? Math.sqrt(sse/df) : 0;
  const slopeSE = resSE>0 ? resSE/Math.sqrt(sxx) : 0;
  const tCrit = 2;                        // ~95% CI approximation
  const meanW = my || 1;
  const toPctWk = s => round((s*7/meanW)*100, 2);

  const pct   = toPctWk(slope);
  const ciLow = toPctWk(slope - tCrit*slopeSE);
  const ciHigh= toPctWk(slope + tCrit*slopeSE);
  const tStat = slopeSE>0 ? Math.abs(slope/slopeSE) : (slope!==0 ? 3 : 0);

  return {
    signal: "weight", nPoints: n, current: ys[ys.length-1],
    pctPerWeek: pct, pctCILow: ciLow, pctCIHigh: ciHigh,
    direction: ciHigh < 0 ? "losing" : ciLow > 0 ? "gaining" : "stable",
    confidence: confidenceFrom(n, tStat),
  };
}

/* ---------- vomiting: frequency / clustering over time ---------- */
const VOMIT_LEVEL = { none:0, once:1, multiple:2 };
function vomitFrequency(logs){
  if(!logs.length) return null;
  const ref = dayNum(logs[logs.length-1].date);   // anchor on the most recent log
  let episodes7 = 0, days7 = 0, days30 = 0;
  logs.forEach(l=>{
    const lvl = VOMIT_LEVEL[l.vomit] || 0;
    if(lvl <= 0) return;
    const age = ref - dayNum(l.date);
    if(age >= 0 && age < 7){ episodes7 += lvl; days7 += 1; }
    if(age >= 0 && age < 30){ days30 += 1; }
  });
  // Occasional vomiting is common; a cluster is not. Flag >=2 episodes in 7 days.
  const elevated = episodes7 >= 2;
  return {
    signal: "vomit", episodes7, days7, days30, nObs: logs.length, elevated,
    confidence: confidenceFrom(logs.length, episodes7 >= 3 ? 3 : episodes7),
  };
}

/* ---------- public API ---------- */
export function analyzeSignals(cat, logs){
  const sorted = [...(logs||[])].sort((a,b)=>a.date.localeCompare(b.date));
  return {
    appetite: ordinalDeviation(sorted, appetiteNum, "appetite"),
    energy:   ordinalDeviation(sorted, l=>ENC.energy[l.energy], "energy"),
    water:    ordinalDeviation(sorted, l=>ENC.water[l.water], "water"),
    weight:   weightRegression(sorted),
    vomit:    vomitFrequency(sorted),
    nLogs: sorted.length,
  };
}
