/* ============================================================================
   Store — client persistence (localStorage)
   GRADUATION: replace loadDb/saveDb with fetch() to authenticated API routes
   backed by Vercel Postgres / Neon. The db shape is already row-friendly
   (entities + arrays keyed by id), so the swap is mechanical.
   ============================================================================ */
const KEY = "purrfectcare.v2";

export function blankDb(){
  return {
    cats: [],            // [{id,name,age,ageUnit,breed,sex,neutered,weight,weightUnit,conditions,food,feeding,createdAt}]
    activeCatId: null,
    logs: {},            // { catId: [ {date, appetite, energy, water, litter, grooming, weight, notes, tags[]} ] }
    chats: {},           // { catId: [ {role, text, meta, ts} ] }
    photos: {},          // { catId: [ {id, dataUrl, date, area, caption, ts} ] }
    maintenance: {},     // { catId: [ {id, label, icon, cadenceDays, category, lastDone} ] }
    settings: {},        // reserved (API key now lives server-side as an env var)
  };
}

export function loadDb(){
  if(typeof window === "undefined") return blankDb();
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : blankDb();
  } catch { return blankDb(); }
}

export function saveDb(db){
  if(typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(db));
}

export function uid(){ return "c" + Math.random().toString(36).slice(2,9); }
export const todayStr = () => new Date().toISOString().slice(0,10);

export function activeCat(db){ return db.cats.find(c=>c.id===db.activeCatId) || null; }
export function logsFor(db, id){ return (db.logs[id] = db.logs[id] || []); }
export function chatFor(db, id){ return (db.chats[id] = db.chats[id] || []); }
