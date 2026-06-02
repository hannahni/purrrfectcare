/* ============================================================================
   Nudges — proactive care reminders (part of Output Layer)
   GRADUATION: a Vercel Cron job can compute these server-side and send push
   / email notifications instead of rendering them on dashboard load.
   ============================================================================ */
import { ageInYears } from "./reasoning.js";

export function compute(cat, logs){
  if(!cat) return [];
  const out=[];
  const age = ageInYears(cat);
  const haveRecentLog = logs.length && daysAgo(logs[logs.length-1].date) <= 1;
  if(!haveRecentLog) out.push({key:"log",icon:"📝",text:"Log today's check-in so trends stay accurate."});
  out.push({key:"dental",icon:"🦷",text:"Monthly: check teeth/gums for tartar or redness and brush if you can.",cadence:"monthly"});
  if(age>=11) out.push({key:"senior",icon:"🩺",text:"Senior cat: vets recommend a check-up with bloodwork every 6 months.",cadence:"biannual"});
  else out.push({key:"vet",icon:"🩺",text:"Annual wellness exam keeps vaccines and weight on track.",cadence:"annual"});
  if(age<1) out.push({key:"kitten",icon:"💉",text:"Kitten: stay on the vaccine schedule and discuss spay/neuter timing.",cadence:"weekly"});
  out.push({key:"weigh",icon:"⚖️",text:"Weigh monthly — early weight shifts are the best early-warning sign.",cadence:"monthly"});
  out.push({key:"play",icon:"🧶",text:"Today: two short predatory play sessions (wand toy, ~10–15 min each).",cadence:"daily"});
  return out;
}

function daysAgo(dateStr){
  const d=new Date(dateStr+"T00:00:00");
  const now=new Date();
  return Math.floor((now - d)/86400000);
}
