/* ============================================================================
   Reasoning — guardrailed rule engine (AI Reasoning Engine)
   Inputs: cat profile + recent logs + symptom tags.
   Output: prioritized recommendations + escalate flag.
   Guardrails: red flags -> escalate; never diagnose; cite sources.

   On the server this wraps the LLM: Claude drafts the prose, but this engine
   independently decides escalation so a model can never DOWNGRADE an emergency.
   ============================================================================ */
import { isRedFlag } from "./nlp.js";
import { analyzeSignals, overallAppetite } from "./signals.js";

const SEV = { info:0, monitor:1, escalate:2 };

export function evaluate({cat, recentLogs, tags, allLogs}){
  const recs = [];
  const tagList = (tags||[]).map(t => (typeof t === "string" ? t : t.tag));
  const tagSet = new Set(tagList);
  const has = (t) => tagSet.has(t);
  const logs = recentLogs || [];
  // Temporal modeling runs over the FULL history (baseline needs more than the recent window).
  const history = (allLogs && allLogs.length) ? allLogs : logs;
  const signals = analyzeSignals(cat, history);
  const add = (severity,title,body,sources,confidence)=>recs.push({severity,title,body,sources:sources||[],confidence:confidence||null});

  // ---- GUARDRAIL: red flags -> immediate escalation ----
  const reds = tagList.filter(isRedFlag);
  if(reds.length){
    const map = {
      not_urinating:"Straining to urinate or producing little/no urine can indicate a urethral blockage — a life-threatening emergency, especially in male cats.",
      breathing:"Labored or open-mouth breathing in a cat is always urgent — cats rarely pant.",
      repeated_vomiting:"Repeated vomiting or inability to keep water down risks rapid dehydration.",
      collapse:"Collapse, weakness, seizures or unresponsiveness require emergency care.",
      toxin:"Possible ingestion of a toxin (lily, chocolate, onion, antifreeze, medication, or string/thread) can be rapidly dangerous.",
      pain:"Signs of severe pain, a swollen abdomen, or pale gums need urgent evaluation.",
      jaundice:"Yellowing of the gums, eyes or skin (jaundice) signals a serious liver problem.",
    };
    const why = reds.map(r=>map[r]).filter(Boolean);
    add("escalate","🚑 See a vet now — urgent signs detected",
      why.join(" ") + " Please contact your veterinarian or an emergency clinic immediately. If a poison was ingested, you can also reach the ASPCA Animal Poison Control Center (888-426-4435).",
      ["AVMA emergency guidance"]);
  }

  // ---- Appetite / not eating (modeled vs. the cat's own baseline) ----
  const ap = signals.appetite;
  const name = (cat && cat.name) ? cat.name : "Your cat";
  const baselineNote = (ap && ap.direction === "below")
    ? ` Relative to ${name}'s own recent baseline, this is a real dip (deviation z = ${ap.z}).`
    : "";
  if(has("appetite_decline")){
    const days = consecutiveLowAppetite(logs);
    const sev = days>=2 ? "escalate" : "monitor";
    add(sev, days>=2 ? "Appetite down 2+ days — call your vet" : "Reduced appetite — monitor closely",
      "Cats that eat little for more than ~24–48h can develop hepatic lipidosis (fatty liver), which is dangerous. "+
      "Tempt with gently warmed wet food and remove stressors. "+(days>=2
        ? "Since intake has been low for multiple days, book a vet visit now — sooner if there's also lethargy or vomiting."
        : "If your cat skips most food for another day, or seems lethargic, contact your vet.")+baselineNote,
      ["Cornell Feline Health Center"], ap ? ap.confidence : null);
  } else if(ap && ap.direction === "below" && ap.z <= -1.5){
    add("monitor","Appetite trending below baseline",
      `${name}'s recent intake is running below ${name}'s own normal (deviation z = ${ap.z}). `+
      "It isn't an emergency yet, but keep logging daily — if eating stays low or pairs with lethargy, contact your vet.",
      ["Cornell Feline Health Center"], ap.confidence);
  }
  if(has("appetite_increase") && older(cat,7)){
    add("monitor","Increased appetite in an older cat",
      "Eating more but not gaining (or losing) weight in an older cat can be associated with conditions like hyperthyroidism or diabetes. Not an emergency — schedule a vet check with bloodwork.",
      ["AVMA"]);
  }

  // ---- Weight (modeled: regression slope + 95% confidence interval) ----
  const w = signals.weight;
  if(w && w.direction === "losing"){
    add("monitor","Weight trending down",
      `Weight is declining about ${Math.abs(w.pctPerWeek)}%/week (95% CI ${w.pctCILow}% to ${w.pctCIHigh}%) — the whole range is below zero, so this looks like a real downward trend. `+
      "Unintentional loss warrants a vet visit, especially alongside appetite or thirst changes.",
      ["AAFP Senior Care Guidelines"], w.confidence);
  } else if(w && w.direction === "gaining"){
    add("info","Weight trending up",
      `Weight is rising about ${w.pctPerWeek}%/week (95% CI ${w.pctCILow}% to ${w.pctCIHigh}%). `+
      "Review portions against the food's calorie chart, use measured meals, and add play/puzzle feeders.",
      ["AVMA"], w.confidence);
  } else if(w && Math.abs(w.pctPerWeek) >= 1){
    add("info","Possible weight change — not yet conclusive",
      `The estimate is ${w.pctPerWeek}%/week, but the range (95% CI ${w.pctCILow}% to ${w.pctCIHigh}%) still includes "no change," so it may be normal fluctuation. Keep weighing to confirm.`,
      ["AAFP Senior Care Guidelines"], w.confidence);
  }
  if(has("excessive_thirst")){
    add("monitor","Increased thirst — worth a vet check",
      "Sustained increased drinking/urination can be linked to kidney disease, diabetes or hyperthyroidism, particularly in older cats. Track water intake and litter clumps and book a non-urgent vet visit.",
      ["AVMA"]);
  }

  // ---- GI: vomiting (same-day "multiple" -> red-flag guardrail above; here we
  //          model frequency/clustering across days) ----
  const vf = signals.vomit;
  if(!has("repeated_vomiting")){
    if(vf && vf.elevated){
      add("monitor","Frequent vomiting this week",
        `${vf.episodes7} vomiting episode${vf.episodes7===1?"":"s"} logged in the last 7 days. Occasional vomiting can be normal, but a cluster like this is not — if it keeps up, includes blood, or comes with not eating or lethargy, see a vet.`,
        ["Cornell Feline Health Center"], vf.confidence);
    } else if(has("vomiting")){
      add("monitor","Vomiting — watch the pattern",
        "An isolated hairball is usually minor. But frequent vomiting is not normal for cats. If it happens again within 24h, includes blood, or comes with not eating/lethargy, see a vet.",
        ["Cornell Feline Health Center"], vf ? vf.confidence : null);
    }
  }
  if(has("constipation")){
    add("monitor","Possible constipation",
      "Straining with little stool, or no stool for >48h, deserves attention. Ensure hydration (wet food, fountain) and mention to your vet; ongoing straining can also be urinary — if straining in the box, treat as urgent.",
      ["Cornell Feline Health Center"]);
  }

  // ---- Behavior / grooming ----
  if(has("lethargy")){
    add(reds.length ? "escalate" : "monitor","Lethargy noted",
      "Low energy is a non-specific but meaningful sign. Combined with not eating, vomiting, or hiding it raises concern. If it persists more than a day or two, or pairs with any urgent sign above, contact your vet.",
      ["Cornell Feline Health Center"]);
  }
  if(has("grooming_decline")){
    add("info","Coat/grooming change",
      "Reduced grooming can come from pain, obesity or illness (older/heavier cats can't reach well). Help by brushing, and flag a sudden change to your vet.",
      ["ASPCA"]);
  }
  if(has("overgrooming")){
    add("monitor","Overgrooming / bald patches",
      "Overgrooming often reflects stress, allergies or skin irritation. Boost enrichment and routine; if there are bald patches or skin sores, see a vet to rule out fleas/allergies/pain.",
      ["AAFP/ISFM Environmental Needs Guidelines"]);
  }
  if(has("hiding") || has("aggression")){
    add("info","Behavior change",
      "New hiding or irritability can be stress- or pain-related. Keep routine consistent, provide hiding spots and vertical space, and rule out pain if it persists.",
      ["AAFP/ISFM Environmental Needs Guidelines"]);
  }
  if(has("dental")){
    add("monitor","Dental concern",
      "Bad breath, drooling or red gums suggest dental disease (very common by age 3). Start cat-safe toothpaste brushing and ask your vet about an oral exam / cleaning.",
      ["AVMA"]);
  }

  // de-dupe by title, sort by severity desc
  const seen=new Set(); const out=[];
  recs.sort((a,b)=>SEV[b.severity]-SEV[a.severity]).forEach(r=>{ if(!seen.has(r.title)){seen.add(r.title);out.push(r);} });
  return { recs: out, escalate: out.some(r=>r.severity==="escalate") };
}

// --- metric helpers ---
function consecutiveLowAppetite(logs){
  let n=0;
  for(let i=logs.length-1;i>=0;i--){
    const a = overallAppetite(logs[i]);
    if(a==="low"||a==="none") n++; else break;
  }
  return n;
}
export function weightTrend(cat, logs){
  const ws = (logs||[]).filter(l=>l.weight).map(l=>parseFloat(l.weight)).filter(n=>!isNaN(n));
  if(ws.length<2) return null;
  const first=ws[0], last=ws[ws.length-1];
  if(!first) return null;
  return { pct: ((last-first)/first)*100, first, last };
}
function older(cat,years){ return ageInYears(cat)>=years; }
export function ageInYears(cat){
  if(!cat) return 0;
  const a=parseFloat(cat.age)||0;
  return cat.ageUnit==="months" ? a/12 : a;
}
