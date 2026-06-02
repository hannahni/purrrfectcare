/* ============================================================================
   Knowledge — curated KB + retrieval (RAG-lite, Knowledge Layer)
   GRADUATION: move DOCS into a vector store (e.g. pgvector / Pinecone) and
   replace retrieve() with embedding search + reranking. The function signature
   can stay the same so callers don't change.
   ============================================================================ */

// sourceType: vet | breed | community | product
export const DOCS = [
  {id:"feed-portion",title:"How much to feed an adult cat",tags:["diet","appetite_increase","weight_gain","weight_loss"],source:"AVMA / Cornell Feline Health Center",sourceType:"vet",
   body:"Most adult cats need roughly 20 kcal per pound of ideal body weight per day (≈45 kcal/kg). A typical 10 lb (4.5 kg) cat needs ~200–250 kcal/day. Always feed to *ideal* weight, not current weight, and follow the calorie chart on the food label. Measure portions; free-feeding dry food is a leading cause of feline obesity."},
  {id:"wet-vs-dry",title:"Wet vs dry food & hydration",tags:["diet","excessive_thirst","urinary","urination_changes"],source:"Cornell Feline Health Center",sourceType:"vet",
   body:"Cats have a low thirst drive and evolved to get water from prey. Wet food (70–80% moisture) supports urinary and kidney health, especially for cats prone to urinary issues. If feeding dry, ensure ample fresh water; many cats prefer a wide bowl or a pet fountain."},
  {id:"obesity",title:"Feline obesity & weight management",tags:["weight_gain","diet"],source:"AVMA",sourceType:"vet",
   body:"Over half of pet cats are overweight. Excess weight raises risk of diabetes, arthritis and urinary disease. Aim for slow loss (~0.5–2% body weight/week) under vet guidance — rapid weight loss in cats can cause hepatic lipidosis (fatty liver), which is dangerous. Use measured meals, puzzle feeders, and play."},
  {id:"appetite-loss",title:"When a cat stops eating",tags:["appetite_decline","lethargy","weight_loss"],source:"Cornell Feline Health Center",sourceType:"vet",
   body:"A cat that eats little or nothing for more than 24–48 hours is a medical concern: cats can develop hepatic lipidosis (fatty liver) when they don't eat, which can become life-threatening. Causes range from stress and dental pain to nausea and illness. Tempt with warmed wet food, but if a cat refuses food for ~24h+ (sooner if also lethargic or vomiting), contact a vet."},
  {id:"hydration-thirst",title:"Increased thirst & urination",tags:["excessive_thirst","urination_changes","weight_loss"],source:"AVMA",sourceType:"vet",
   body:"Markedly increased drinking and urination can be associated with conditions like kidney disease, diabetes or hyperthyroidism, particularly in older cats. This is not an emergency but warrants a vet visit with possible bloodwork/urinalysis. Track water intake and litter clump count to share with your vet."},
  {id:"urinary-block",title:"Urinary blockage — EMERGENCY",tags:["not_urinating","urination_changes","urinary"],source:"AVMA emergency guidance",sourceType:"vet",
   body:"A cat (especially a male) straining in the litter box, producing little/no urine, crying, or repeatedly visiting the box may have a urethral blockage. This is a life-threatening emergency — without urination, toxins build up within hours. Seek emergency veterinary care immediately."},
  {id:"vomiting",title:"Vomiting in cats",tags:["vomiting","repeated_vomiting","appetite_decline","diarrhea"],source:"Cornell Feline Health Center",sourceType:"vet",
   body:"Occasional vomiting (e.g., an isolated hairball) is common. Concerning patterns: repeated vomiting in a day, inability to keep water down, blood, or vomiting plus lethargy/not eating. Frequent vomiting is not 'normal' for cats and deserves a vet visit. Withhold food briefly then offer small bland meals only on vet advice."},
  {id:"dental",title:"Dental health & home care",tags:["dental"],source:"AVMA",sourceType:"vet",
   body:"By age 3, most cats show some dental disease. Signs: bad breath, drooling, red gums, pawing at the mouth, dropping food. Daily brushing with cat-safe enzymatic toothpaste (never human toothpaste) is the gold standard; dental treats/VOHC-accepted products help. Professional cleanings under anesthesia may be needed."},
  {id:"grooming",title:"Grooming & coat condition",tags:["grooming_decline","overgrooming","grooming"],source:"ASPCA",sourceType:"vet",
   body:"A sudden drop in self-grooming (greasy, matted, dandruffy coat) can signal pain, obesity, or illness — older/overweight cats may struggle to reach. Overgrooming (bald patches, barbering) often reflects stress, allergies, or skin irritation. Brush long-haired cats daily and short-haired weekly; investigate sudden changes."},
  {id:"enrichment",title:"Play & environmental enrichment",tags:["behavior","hiding","aggression","lethargy","overgrooming"],source:"AAFP/ISFM Environmental Needs Guidelines",sourceType:"vet",
   body:"Cats need daily predatory play (wand toys, 2× ~10–15 min), vertical space (cat trees/shelves), scratching posts, hiding spots, and routine. Enrichment reduces stress-driven behaviors like hiding, aggression and overgrooming. One litter box per cat plus one extra, in quiet separate locations."},
  {id:"litterbox",title:"Litter box best practices",tags:["urination_changes","behavior"],source:"AAFP/ISFM",sourceType:"vet",
   body:"Rule of thumb: N+1 boxes for N cats. Scoop daily, full change weekly, avoid scented litters many cats dislike, and keep boxes away from noisy appliances. Sudden litter-box avoidance can be behavioral OR medical (e.g., urinary pain) — rule out medical causes first."},
  {id:"senior",title:"Senior cat care (11+ years)",tags:["weight_loss","excessive_thirst","lethargy","dental"],source:"AAFP Senior Care Guidelines",sourceType:"vet",
   body:"Cats are 'senior' around 11+. Recommend twice-yearly vet checks with bloodwork to catch kidney disease, hyperthyroidism, diabetes and arthritis early. Watch for weight loss, increased thirst, reduced jumping/grooming, and litter changes. Provide easy-access litter boxes (low sides), warmth, and softer food if dental disease is present."},
  {id:"kitten",title:"Kitten feeding & milestones",tags:["diet","kitten"],source:"AVMA",sourceType:"vet",
   body:"Kittens need calorie-dense kitten food, fed 3–4× daily up to ~6 months, then transition toward adult portions. Core vaccines start ~6–8 weeks. Spay/neuter is typically recommended; discuss timing with your vet. Rapid growth means weight should steadily increase — log it."},
  // community + product perspectives (clearly labeled, lower trust)
  {id:"reddit-picky",title:"Community tips: picky eaters",tags:["appetite_decline","diet"],source:"r/cats, r/CatAdvice (community discussion)",sourceType:"community",
   body:"Common owner-reported tactics for mild pickiness: gently warming wet food, adding a low-sodium broth or a lick-able treat topper, switching textures (pâté vs chunks), and keeping food away from the litter box. Community anecdotes are not medical advice — persistent refusal still needs a vet."},
  {id:"chewy-fountain",title:"Product perspective: water fountains",tags:["excessive_thirst","urinary","diet"],source:"Chewy / Amazon reviews (aggregated)",sourceType:"product",
   body:"Highly-reviewed pet water fountains (ceramic or stainless steel, replaceable carbon filters) are frequently credited by owners with increasing water intake in cats that ignore still bowls. Look for quiet pumps, easy disassembly for cleaning, and BPA-free materials. Product reviews reflect opinion, not clinical evidence."},
  {id:"chewy-puzzle",title:"Product perspective: puzzle feeders",tags:["weight_gain","behavior","lethargy"],source:"Chewy / Amazon reviews (aggregated)",sourceType:"product",
   body:"Food puzzles and slow feeders are popular for weight control and mental stimulation; owners report slower eating and reduced begging. Start easy (visible holes) and increase difficulty. A DIY version: kibble in a clean egg carton or toilet-roll tubes."},
];

// simple keyword + tag scoring retrieval
export function retrieve(tags, query, k=4){
  const q = String(query||"").toLowerCase();
  const qWords = q.split(/[^a-z]+/).filter(w=>w.length>3);
  const tagSet = new Set(tags||[]);
  const scored = DOCS.map(d=>{
    let s=0;
    d.tags.forEach(t=>{ if(tagSet.has(t)) s+=5; });
    qWords.forEach(w=>{ if((d.title+" "+d.body).toLowerCase().includes(w)) s+=1; });
    if(d.sourceType==="vet") s+=0.5; // gentle trust prior
    return {d,s};
  }).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,k);
  return scored.map(x=>x.d);
}
