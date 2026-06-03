/* ============================================================================
   Maintenance — recurring cat-care upkeep tasks (supplies, litter, grooming)
   ----------------------------------------------------------------------------
   Each task has a cadence (in days) and a lastDone date. We compute due/overdue
   status from those. This is the "full maintenance" layer on top of the health
   signals — pee pads, food restock, nail trims, scratch pads, etc.

   GRADUATION: a Vercel Cron job can compute due tasks server-side and send a
   push/email reminder instead of only showing them when the app is open.
   ============================================================================ */

// Seeded when a cat is first set up. cadenceDays = how often it recurs.
export const DEFAULT_TASKS = [
  { key:"pee_pad",      label:"Replace pee pad",                 icon:"🟦", cadenceDays:2,  category:"Litter" },
  { key:"poop_bag",     label:"Replace litter / poop bag",       icon:"🛍️", cadenceDays:7,  category:"Litter" },
  { key:"scoop",        label:"Scoop litter box",                icon:"🧹", cadenceDays:1,  category:"Litter" },
  { key:"litter_change",label:"Full litter change",              icon:"♻️", cadenceDays:7,  category:"Litter" },
  { key:"dry_food",     label:"Refill dry food",                 icon:"🥣", cadenceDays:14, category:"Food" },
  { key:"wet_food",     label:"Buy more wet food",               icon:"🐟", cadenceDays:10, category:"Food" },
  { key:"water_filter", label:"Clean water fountain / filter",   icon:"💧", cadenceDays:30, category:"Hygiene" },
  { key:"nails",        label:"Trim nails",                      icon:"✂️", cadenceDays:21, category:"Grooming" },
  { key:"brush",        label:"Brush coat",                      icon:"🧴", cadenceDays:7,  category:"Grooming" },
  { key:"scratch_pad",  label:"Switch out scratch pads",         icon:"🪵", cadenceDays:30, category:"Enrichment" },
  { key:"flea",         label:"Flea / parasite prevention",      icon:"🐛", cadenceDays:30, category:"Health" },
];

export function todayStr(){ return new Date().toISOString().slice(0,10); }
export function dayNum(dateStr){ return Math.floor(new Date(dateStr+"T00:00:00").getTime()/86400000); }
export function todayNum(){ return dayNum(todayStr()); }

// Build the initial per-cat task list from the defaults.
export function seedTasks(){
  return DEFAULT_TASKS.map((t,i)=>({
    id: `m${i}_${t.key}`,
    label: t.label, icon: t.icon, cadenceDays: t.cadenceDays, category: t.category,
    lastDone: null,
  }));
}

// state: "overdue" | "due" | "upcoming" | "new"
export function taskStatus(task, today){
  if(!task.lastDone) return { state:"new", daysUntil:0, label:"Not done yet — tap Done to start" };
  const due = dayNum(task.lastDone) + Number(task.cadenceDays || 1);
  const daysUntil = due - today;
  if(daysUntil < 0)  return { state:"overdue",  daysUntil, label:`${-daysUntil} day${-daysUntil===1?"":"s"} overdue` };
  if(daysUntil === 0) return { state:"due",      daysUntil, label:"Due today" };
  return { state:"upcoming", daysUntil, label:`in ${daysUntil} day${daysUntil===1?"":"s"}` };
}

// count of tasks that need attention now (for the dashboard heads-up)
export function dueCount(tasks, today){
  return (tasks||[]).reduce((n,t)=>{
    const s = taskStatus(t, today).state;
    return n + (s==="overdue" || s==="due" ? 1 : 0);
  }, 0);
}
