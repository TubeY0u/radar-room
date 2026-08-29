/* Radar Room — CS2 Stratbook. Reines Frontend, Daten liegen in Supabase. */
"use strict";

/* ===================== Konstanten ===================== */
const SIDES = ["T","CT"];
const COLORS = ["#E6EDF4","#D8A24A","#5B96C6","#DB5A4B","#6FBF73","#A98CD6"];
const UTIL = {
  smoke:{label:"Smoke", short:"S", color:"#C3CDD6"},
  flash:{label:"Flash", short:"F", color:"#EFD75B"},
  molo :{label:"Molo",  short:"M", color:"#E4603A"},
  he   :{label:"HE",    short:"HE",color:"#7FB069"},
  decoy:{label:"Decoy", short:"D", color:"#A98CD6"}
};
const TOOLS = [
  {id:"select",tip:"Auswählen & verschieben (V)",key:"v",svg:'<path d="M5 3l14 8-6 1.6L10 19z"/>'},
  {id:"pen",   tip:"Freihand (P)",key:"p",svg:'<path d="M4 20l3.5-.8L19 7.7a2 2 0 0 0-2.8-2.8L4.8 16.5z"/>'},
  {id:"arrow", tip:"Pfeil (A)",key:"a",svg:'<path d="M4 20L20 4M20 4h-7M20 4v7"/>'},
  {id:"line",  tip:"Linie (L)",key:"l",svg:'<path d="M4 20L20 4"/>'},
  {id:"rect",  tip:"Zone (R)",key:"r",svg:'<rect x="4" y="6" width="16" height="12" rx="1"/>'},
  {id:"mark",  tip:"Spieler-Marker (M)",key:"m",svg:'<circle cx="12" cy="12" r="7"/><path d="M12 9v6M9.5 12h5"/>'},
  {id:"util",  tip:"Utility setzen (U) – ziehen für Wurflinie",key:"u",svg:'<circle cx="12" cy="14" r="5"/><path d="M12 3v4M9 5l3-2 3 2"/>'},
  {id:"text",  tip:"Text / Callout (T)",key:"t",svg:'<path d="M5 6h14M12 6v13M9 19h6"/>'},
  {id:"erase", tip:"Löschen (E)",key:"e",svg:'<path d="M4 16l8-8 6 6-4 4H7zM9 21h11"/>'},
  {id:"pan",   tip:"Verschieben / Zoom bewegen (H)",key:"h",svg:'<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V12m0-1a1.5 1.5 0 0 1 3 0v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5v-5.5a1.5 1.5 0 0 1 3 0"/>'}
];
const ZOOMS = [1,1.35,1.8,2.4,3.2];

/* ===================== State ===================== */
const S = {
  strats:new Map(), meta:{team:"Team",roster:["","","","",""]},
  mapId:MAPS[0].id, side:"T", stratId:null, layer:"main",
  tool:"pen", color:COLORS[1], util:"smoke", phase:1, filter:0,
  markNum:1, zoom:0, tx:0, ty:0, mode:"local",
  clientId: (localStorage.getItem("rr.cid") || (function(){ const c="c"+Math.random().toString(36).slice(2,10); localStorage.setItem("rr.cid",c); return c })())
};
const $ = s => document.querySelector(s);
const el = (t,c,txt) => { const n=document.createElement(t); if(c)n.className=c; if(txt!=null)n.textContent=txt; return n; };
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const now = () => Date.now();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "s"+now()+Math.random().toString(36).slice(2,8));
const curMap = () => MAPS.find(m=>m.id===S.mapId) || MAPS[0];
const curLayer = () => curMap().layers.find(l=>l.id===S.layer) || curMap().layers[0];
const curStrat = () => S.stratId ? S.strats.get(S.stratId) : null;

let ME = localStorage.getItem("rr.me") || "";


/* ===================== Speicher ===================== */
const CFG = window.RR_CONFIG || {};
const HAS_SB = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
let sb = null, pending = new Set(), store = null;

const LS = {
  get(k,f){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):f }catch(e){ return f } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)) }catch(e){} }
};

function toast(msg, bad){
  const t = $("#toast"); t.textContent = msg;
  t.className = "toast show" + (bad?" bad":"");
  clearTimeout(toast._t); toast._t = setTimeout(()=>{ t.className="toast"+(bad?" bad":"") }, 4200);
}

const rowToStrat = r => ({
  id:r.id, map:r.map, side:r.side, name:r.name||"", tags:r.tags||[],
  players:r.players||[], steps:r.steps||[""], util:r.util||[], draw:r.draw||[],
  notes:r.notes||"", createdAt:r.created_at||0, updatedAt:r.updated_at||0, updatedBy:r.updated_by||""
});
const stratToRow = s => ({
  id:s.id, map:s.map, side:s.side, name:s.name||"", tags:s.tags||[],
  players:s.players||[], steps:s.steps||[], util:s.util||[], draw:s.draw||[],
  notes:s.notes||"", created_at:s.createdAt||now(), updated_at:s.updatedAt||now(), updated_by:s.updatedBy||""
});

/* ---- Nur dieses Gerät ---- */
function localStore(){
  let sc=null;
  const push = ()=> sc && sc(Object.values(LS.get("rr.strats",{})));
  return {
    mode:"local",
    onStrats(cb){ sc=cb; push() },
    onMeta(cb){ cb(LS.get("rr.meta", S.meta)) },
    saveStrat(s){ const a=LS.get("rr.strats",{}); a[s.id]=s; LS.set("rr.strats",a); return Promise.resolve() },
    delStrat(id){ const a=LS.get("rr.strats",{}); delete a[id]; LS.set("rr.strats",a); return Promise.resolve() },
    saveMeta(m){ LS.set("rr.meta",m); return Promise.resolve() }
  };
}

/* ---- Gemeinsame Datenbank ---- */
function remoteStore(){
  let sc=null, mc=null, refetchTimer=null;

  async function pullStrats(){
    const { data, error } = await sb.from("strats").select("*");
    if(error){ setSync("bad", error.message); return }
    LS.set("rr.cache", data);
    sc && sc(data.map(rowToStrat));
    setSync("ok");
  }
  async function pullMeta(){
    const { data } = await sb.from("meta").select("*").eq("id",1).maybeSingle();
    if(data) mc && mc({team:data.team, roster:data.roster});
  }
  const refetch = ()=>{ clearTimeout(refetchTimer); refetchTimer = setTimeout(pullStrats, 250) };

  sb.channel("radarroom-strats")
    .on("postgres_changes",{event:"*",schema:"public",table:"strats"}, refetch)
    .on("postgres_changes",{event:"*",schema:"public",table:"meta"}, pullMeta)
    .subscribe();

  return {
    mode:"db",
    onStrats(cb){
      sc=cb;
      const cached = LS.get("rr.cache",null);
      if(cached && cached.length) cb(cached.map(rowToStrat));
      pullStrats();
    },
    onMeta(cb){ mc=cb; pullMeta() },
    async saveStrat(s){
      const { error } = await sb.from("strats").upsert(stratToRow(s));
      if(error) throw error;
    },
    async delStrat(id){
      const { error } = await sb.from("strats").delete().eq("id",id);
      if(error) throw error;
    },
    async saveMeta(m){
      const { error } = await sb.from("meta").upsert({id:1, team:m.team, roster:m.roster});
      if(error) throw error;
    }
  };
}

/* ---- Warteschlange für Schreibvorgänge ohne Verbindung ---- */
const Outbox = {
  all(){ return LS.get("rr.outbox",{}) },
  put(id, entry){ const o=this.all(); o[id]=entry; LS.set("rr.outbox",o); markOutbox() },
  drop(id){ const o=this.all(); delete o[id]; LS.set("rr.outbox",o); markOutbox() },
  count(){ return Object.keys(this.all()).length },
  async flush(){
    if(S.mode!=="db" || !navigator.onLine) return;
    const o = this.all();
    for(const id of Object.keys(o)){
      const e = o[id];
      try{
        if(e.op==="del") await store.delStrat(id);
        else if(e.op==="meta") await store.saveMeta(e.data);
        else await store.saveStrat(e.data);
        this.drop(id);
      }catch(err){ return }
    }
    if(this.count()===0) setSync("ok");
  }
};
function markOutbox(){
  const n = Outbox.count();
  if(n) setSync("warn", n+" Änderung(en) warten auf Verbindung");
}

const saveTimers = new Map();
function queueSave(id){
  const s = S.strats.get(id); if(!s) return;
  s.updatedAt = now(); s.updatedBy = ME || "";
  pending.add(id);
  setSync("warn","speichert…");
  clearTimeout(saveTimers.get(id));
  saveTimers.set(id, setTimeout(()=>{
    const snap = JSON.parse(JSON.stringify(s));
    store.saveStrat(snap)
      .then(()=>{ Outbox.drop(id); setSync("ok"); setTimeout(()=>pending.delete(id),1500) })
      .catch(err=>{
        Outbox.put(id,{op:"save",data:snap});
        pending.delete(id);
        setSync("warn", (err && err.message) || "offline");
      });
  }, 450));
  paintMeta();
}
let metaTimer;
function queueMeta(){
  clearTimeout(metaTimer);
  metaTimer = setTimeout(()=>{
    const m = JSON.parse(JSON.stringify(S.meta));
    store.saveMeta(m).catch(()=>Outbox.put("__meta__",{op:"meta",data:m}));
  }, 450);
}
function deleteStrat(id){
  S.strats.delete(id);
  store.delStrat(id).catch(()=>Outbox.put(id,{op:"del"}));
}
function setSync(kind,msg){
  const d = $("#syncDot"); if(!d) return;
  d.className = "dot" + (kind==="ok" ? "" : kind==="bad" ? " off" : " warn");
  d.title = kind==="ok"
    ? (S.mode==="db" ? "Live synchron mit dem Team" : "Nur auf diesem Gerät gespeichert")
    : (msg||"");
  S.syncMsg = d.title;
}

/* ===================== Strat-Model ===================== */
function newStrat(over){
  const s = {
    id:uid(), map:S.mapId, side:S.side, name:"Neue Strat", tags:[],
    players:S.meta.roster.map(n=>({name:n||"",role:""})),
    steps:[""], util:[], draw:[], notes:"",
    createdAt:now(), updatedAt:now(), updatedBy:ME||"?"
  };
  return Object.assign(s, over||{});
}
function stratsFor(map,side){
  return [...S.strats.values()].filter(s=>s.map===map && s.side===side)
    .sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}

/* ===================== Zeichnen ===================== */
const undoStack = [];
function pushUndo(){
  const s=curStrat(); if(!s) return;
  undoStack.push({id:s.id, draw:JSON.stringify(s.draw)});
  if(undoStack.length>40) undoStack.shift();
}
function undo(){
  const u = undoStack.pop(); if(!u) return;
  const s = S.strats.get(u.id); if(!s) return;
  s.draw = JSON.parse(u.draw);
  if(S.stratId!==u.id){ S.stratId=u.id; S.mapId=s.map; S.side=s.side; renderAll(); } else renderBoard();
  queueSave(s.id);
}

function baseW(){ return Math.max(2.2, curLayer().w/320); }
function markR(){ return curLayer().w/58; }
function utilR(){ return curLayer().w/62; }
function fontS(){ return curLayer().w/42; }

function pathD(pts){ return pts.map((p,i)=>(i?"L":"M")+p[0]+" "+p[1]).join(" "); }

function drawEl(e, idx, ghost){
  const L = curLayer(), w = e.w || baseW(), c = e.c || "#E6EDF4";
  const g = ['<g data-i="',idx,'" class="hit',(ghost?" ghost":""),'">'];
  const hitStroke = (d)=>'<path d="'+d+'" stroke="transparent" stroke-width="'+(w*7)+'" fill="none"/>';
  if(e.t==="pen"||e.t==="line"){
    const d = pathD(e.pts);
    g.push(hitStroke(d),'<path d="',d,'" stroke="',c,'" stroke-width="',w,'" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
  } else if(e.t==="arrow"){
    const [a,b]=e.pts, dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy)||1;
    const hl=Math.max(w*4.2, L.w/70), ux=dx/len, uy=dy/len;
    const bx=b[0]-ux*hl*0.85, by=b[1]-uy*hl*0.85, px=-uy, py=ux;
    const d="M"+a[0]+" "+a[1]+" L"+bx+" "+by;
    g.push(hitStroke(d),'<path d="',d,'" stroke="',c,'" stroke-width="',w,'" fill="none" stroke-linecap="round"/>',
      '<path d="M',b[0],' ',b[1],' L',(bx+px*hl*0.45),' ',(by+py*hl*0.45),' L',(bx-px*hl*0.45),' ',(by-py*hl*0.45),' Z" fill="',c,'"/>');
  } else if(e.t==="rect"){
    const [a,b]=e.pts, x=Math.min(a[0],b[0]), y=Math.min(a[1],b[1]);
    g.push('<rect x="',x,'" y="',y,'" width="',Math.abs(b[0]-a[0]),'" height="',Math.abs(b[1]-a[1]),
      '" fill="',c,'" fill-opacity="0.13" stroke="',c,'" stroke-width="',w,'" stroke-dasharray="',w*3,' ',w*2.2,'" rx="',w,'"/>');
  } else if(e.t==="mark"){
    const [p]=e.pts, r=markR();
    g.push('<circle cx="',p[0],'" cy="',p[1],'" r="',r,'" fill="#0C1015" fill-opacity=".85" stroke="',c,'" stroke-width="',w*0.9,'"/>',
      '<text x="',p[0],'" y="',(p[1]+r*0.36),'" font-family="IBM Plex Mono, monospace" font-size="',r*1.15,
      '" fill="',c,'" text-anchor="middle">',e.n||1,'</text>');
  } else if(e.t==="util"){
    const u=UTIL[e.u]||UTIL.smoke, p=e.pts[e.pts.length-1], r=utilR();
    if(e.pts.length>1){
      const a=e.pts[0];
      g.push('<path d="M',a[0],' ',a[1],' Q',((a[0]+p[0])/2 + (p[1]-a[1])*0.16),' ',((a[1]+p[1])/2 - (p[0]-a[0])*0.16),' ',p[0],' ',p[1],
        '" stroke="',u.color,'" stroke-width="',w*0.8,'" stroke-dasharray="',w*2.4,' ',w*2,'" fill="none" opacity=".85"/>',
        '<circle cx="',a[0],'" cy="',a[1],'" r="',w*1.3,'" fill="',u.color,'"/>');
    }
    g.push('<circle cx="',p[0],'" cy="',p[1],'" r="',r,'" fill="',u.color,'" fill-opacity=".9" stroke="#0C1015" stroke-width="',w*0.7,'"/>',
      '<text x="',p[0],'" y="',(p[1]+r*0.34),'" font-family="IBM Plex Mono, monospace" font-weight="500" font-size="',r*0.95,
      '" fill="#0C1015" text-anchor="middle">',esc(u.short),'</text>');
    if(e.label) g.push('<text x="',p[0],'" y="',(p[1]-r*1.5),'" font-family="IBM Plex Sans, sans-serif" font-size="',fontS()*0.72,
      '" fill="',u.color,'" text-anchor="middle" stroke="#0C1015" stroke-width="',fontS()*0.22,'" paint-order="stroke">',esc(e.label),'</text>');
  } else if(e.t==="text"){
    const [p]=e.pts;
    g.push('<text x="',p[0],'" y="',p[1],'" font-family="Saira Condensed, sans-serif" font-weight="600" font-size="',fontS(),
      '" fill="',c,'" stroke="#0C1015" stroke-width="',fontS()*0.26,'" paint-order="stroke" text-anchor="middle">',esc(e.text),'</text>');
  }
  g.push("</g>");
  return g.join("");
}

let live = null;
function renderBoard(){
  const L = curLayer();
  const img = $("#radarImg");
  if(img.getAttribute("src") !== L.img){ img.src = L.img; img.alt = curMap().label + " Radar"; }
  const svg = $("#svg");
  svg.setAttribute("viewBox","0 0 "+L.w+" "+L.h);
  fitBoard();
  const s = curStrat();
  let out = "";
  if(s){
    const items = s.draw.filter(e=>!e.l || e.l===S.layer);
    out = items.map((e,i)=>drawEl(e, s.draw.indexOf(e), S.filter && (e.p||1)!==S.filter)).join("");
  }
  if(live) out += drawEl(live,-1,false);
  svg.innerHTML = out;
  document.body.classList.toggle("picking", S.tool==="select" || S.tool==="erase");
  applyZoom();
  $("#hint").textContent = s ? hintFor() : "Links eine Strat wählen oder + Neu drücken";
  $("#hint").style.display = (s && S.tool!=="select") || !s ? "" : "none";
}
function hintFor(){
  switch(S.tool){
    case "util": return "Klick setzt den Landepunkt · Ziehen: von deiner Position zum Landepunkt";
    case "mark": return "Klick setzt Spieler "+S.markNum+" · Nummer links wählen";
    case "erase": return "Element anklicken zum Löschen";
    case "select": return "Element ziehen zum Verschieben";
    case "pan": return "Ziehen zum Verschieben · +/– zum Zoomen";
    case "text": return "Klick, dann tippen, Enter bestätigt";
    default: return "Ziehen zum Zeichnen · Phase "+S.phase+" aktiv";
  }
}
function fitBoard(){
  const b = $("#board"), L = curLayer();
  const aw = b.clientWidth - 16, ah = b.clientHeight - 16;
  if(aw<40 || ah<40) return;
  const sc = Math.min(aw/L.w, ah/L.h);
  const w = $("#canvasWrap");
  w.style.width  = Math.round(L.w*sc)+"px";
  w.style.height = Math.round(L.h*sc)+"px";
}
function applyZoom(){
  const z = ZOOMS[S.zoom];
  $("#canvasWrap").style.transform = "scale("+z+") translate("+S.tx+"px,"+S.ty+"px)";
}

/* ---- Pointer ---- */
let drag = null;
function toImg(ev){
  const svg=$("#svg"), r=svg.getBoundingClientRect(), L=curLayer();
  return [ Math.round((ev.clientX-r.left)/r.width*L.w), Math.round((ev.clientY-r.top)/r.height*L.h) ];
}
function setupPointer(){
  const svg = $("#svg");
  svg.addEventListener("pointerdown", ev=>{
    if(ev.button!==0 && ev.pointerType==="mouse") return;
    const s = curStrat();
    if(S.tool==="pan"){ drag={mode:"pan",x:ev.clientX,y:ev.clientY,tx:S.tx,ty:S.ty}; svg.setPointerCapture(ev.pointerId); return; }
    if(!s) return;
    const p = toImg(ev);
    if(S.tool==="erase"){
      const g = ev.target.closest("g[data-i]"); if(!g) return;
      pushUndo(); s.draw.splice(+g.dataset.i,1); renderBoard(); queueSave(s.id); return;
    }
    if(S.tool==="select"){
      const g = ev.target.closest("g[data-i]"); if(!g) return;
      pushUndo();
      drag={mode:"move",i:+g.dataset.i,start:p,orig:JSON.parse(JSON.stringify(s.draw[+g.dataset.i].pts))};
      svg.setPointerCapture(ev.pointerId); return;
    }
    if(S.tool==="text"){ ev.preventDefault(); openTextInput(ev,p); return; }
    if(S.tool==="mark"){
      pushUndo();
      s.draw.push({t:"mark",pts:[p],c:S.color,w:baseW(),p:S.phase,l:S.layer,n:S.markNum});
      S.markNum = S.markNum>=5 ? 1 : S.markNum+1;
      renderBoard(); renderToolbar(); queueSave(s.id); return;
    }
    svg.setPointerCapture(ev.pointerId);
    if(S.tool==="pen") live={t:"pen",pts:[p],c:S.color,w:baseW(),p:S.phase,l:S.layer};
    else if(S.tool==="util") live={t:"util",pts:[p],c:S.color,w:baseW(),p:S.phase,l:S.layer,u:S.util,label:""};
    else live={t:S.tool,pts:[p,p],c:S.color,w:baseW(),p:S.phase,l:S.layer};
    drag={mode:"draw",start:p};
    renderBoard();
  });
  svg.addEventListener("pointermove", ev=>{
    if(!drag) return;
    if(drag.mode==="pan"){
      const z=ZOOMS[S.zoom];
      S.tx = drag.tx + (ev.clientX-drag.x)/z; S.ty = drag.ty + (ev.clientY-drag.y)/z;
      applyZoom(); return;
    }
    const p = toImg(ev);
    if(drag.mode==="move"){
      const s=curStrat(); const e=s.draw[drag.i]; if(!e) return;
      const dx=p[0]-drag.start[0], dy=p[1]-drag.start[1];
      e.pts = drag.orig.map(q=>[q[0]+dx,q[1]+dy]);
      renderBoard(); return;
    }
    if(!live) return;
    if(live.t==="pen"){
      const last=live.pts[live.pts.length-1];
      if(Math.hypot(p[0]-last[0],p[1]-last[1]) > curLayer().w/220) live.pts.push(p);
    } else if(live.t==="util"){
      if(Math.hypot(p[0]-drag.start[0],p[1]-drag.start[1]) > curLayer().w/45) live.pts=[drag.start,p];
      else live.pts=[drag.start];
    } else live.pts[1]=p;
    renderBoard();
  });
  const end = ev=>{
    if(!drag) return;
    const s=curStrat();
    if(drag.mode==="draw" && live && s){
      const ok = live.t==="pen" ? live.pts.length>1
        : live.t==="util" ? true
        : Math.hypot(live.pts[1][0]-live.pts[0][0], live.pts[1][1]-live.pts[0][1]) > curLayer().w/80;
      if(ok){ pushUndo(); s.draw.push(live); queueSave(s.id); }
    }
    if(drag.mode==="move" && s) queueSave(s.id);
    live=null; drag=null; renderBoard();
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
}

function openTextInput(ev, p){
  const board=$("#board"), r=board.getBoundingClientRect();
  const inp = el("input","textedit field");
  inp.placeholder = "Callout…";
  inp.style.left = (ev.clientX-r.left-60)+"px";
  inp.style.top  = (ev.clientY-r.top-14)+"px";
  board.appendChild(inp); try{ inp.focus() }catch(e){}
  let closed = false;
  const done = commit=>{
    if(closed) return; closed = true;
    const v = inp.value.trim(); if(inp.isConnected) inp.remove();
    if(commit && v){
      const s=curStrat(); if(!s) return;
      pushUndo();
      s.draw.push({t:"text",pts:[p],c:S.color,w:baseW(),p:S.phase,l:S.layer,text:v});
      renderBoard(); queueSave(s.id);
    }
  };
  inp.addEventListener("keydown",e=>{
    e.stopPropagation();
    if(e.key==="Enter"){ e.preventDefault(); done(true) }
    if(e.key==="Escape"){ e.preventDefault(); done(false) }
  });
  requestAnimationFrame(()=>{
    inp.focus();
    setTimeout(()=>inp.addEventListener("blur",()=>done(true)), 60);
  });
}

/* ===================== Toolbar ===================== */
function renderToolbar(){
  const tb = $("#toolbar"); tb.innerHTML = "";
  TOOLS.forEach(t=>{
    const b = el("button","tool"); b.setAttribute("data-tip",t.tip);
    b.setAttribute("aria-pressed", S.tool===t.id); b.setAttribute("aria-label",t.tip);
    b.innerHTML = '<svg viewBox="0 0 24 24">'+t.svg+'</svg>';
    b.onclick = ()=>{ S.tool=t.id; renderToolbar(); renderBoard(); };
    tb.appendChild(b);
  });
  tb.appendChild(el("div","tsep"));
  if(S.tool==="util"){
    const wrap = el("div","utilpick");
    Object.keys(UTIL).forEach(k=>{
      const b=el("button","up",UTIL[k].label); b.setAttribute("aria-pressed",S.util===k);
      b.style.color = S.util===k ? UTIL[k].color : "";
      b.onclick=()=>{ S.util=k; renderToolbar(); }; wrap.appendChild(b);
    });
    tb.appendChild(wrap);
  } else if(S.tool==="mark"){
    const wrap = el("div","utilpick");
    for(let i=1;i<=5;i++){
      const b=el("button","up",String(i)); b.setAttribute("aria-pressed",S.markNum===i);
      b.onclick=()=>{ S.markNum=i; renderToolbar(); }; wrap.appendChild(b);
    }
    tb.appendChild(wrap);
  }
  const sw = el("div","swatches");
  COLORS.forEach(c=>{
    const b=el("button","sw"); b.style.background=c; b.setAttribute("aria-pressed",S.color===c);
    b.setAttribute("aria-label","Farbe "+c);
    b.onclick=()=>{ S.color=c; renderToolbar(); }; sw.appendChild(b);
  });
  tb.appendChild(sw);
}

/* ===================== Rail ===================== */
function renderRail(){
  document.documentElement.setAttribute("data-side",S.side);
  $("#sideT").setAttribute("aria-pressed",S.side==="T");
  $("#sideCT").setAttribute("aria-pressed",S.side==="CT");

  const ml = $("#mapList"); ml.innerHTML="";
  MAPS.forEach(m=>{
    const n = stratsFor(m.id,S.side).length;
    const b = el("button","mapbtn"); b.setAttribute("aria-pressed", m.id===S.mapId);
    b.innerHTML = '<span class="mapthumb"><img src="'+m.layers[0].img+'" alt=""></span>'+
      '<span class="mapname">'+esc(m.label)+'</span>'+
      '<span class="count'+(n?" has":"")+'">'+(n||"–")+'</span>';
    b.onclick = ()=>{ S.mapId=m.id; S.layer=m.layers[0].id; S.stratId=null; pickFirst(); renderAll(); };
    ml.appendChild(b);
  });

  const list = stratsFor(S.mapId,S.side);
  $("#stratHead").textContent = curMap().label+" · "+S.side+"-Side";
  const sl = $("#stratList"); sl.innerHTML="";
  if(!list.length){
    const e = el("div","empty");
    e.innerHTML = "Noch keine "+S.side+"-Strat auf "+esc(curMap().label)+".<br>Leg eine an oder hol dir einen <b>Vorschlag</b>.";
    sl.appendChild(e);
  }
  list.forEach(s=>{
    const b = el("button","stratitem"); b.setAttribute("aria-current", s.id===S.stratId);
    const marks = s.draw.filter(d=>d.t==="mark").length, ut = s.util.length + s.draw.filter(d=>d.t==="util").length;
    b.innerHTML = '<span class="sn">'+esc(s.name||"Ohne Namen")+'</span><span class="sm">'+
      s.tags.slice(0,3).map(t=>'<span class="tag">'+esc(t)+'</span>').join("")+
      (ut?'<span class="tag">'+ut+' Util</span>':"")+(marks?'<span class="tag">'+marks+' Pos</span>':"")+'</span>';
    b.onclick = ()=>{ S.stratId=s.id; S.layer=curMap().layers[0].id; renderAll(); if(innerWidth<=900) setPane("stage"); };
    sl.appendChild(b);
  });

  const lc = $("#layerChips"); lc.innerHTML=""; lc.style.display = curMap().layers.length>1?"":"none";
  curMap().layers.forEach(l=>{
    const b=el("button",null,l.label.toUpperCase()); b.setAttribute("aria-pressed",S.layer===l.id);
    b.onclick=()=>{ S.layer=l.id; renderRail(); renderBoard(); }; lc.appendChild(b);
  });
}
function pickFirst(){
  const list = stratsFor(S.mapId,S.side);
  S.stratId = list.length ? list[0].id : null;
}

/* ===================== Inspector ===================== */
function renderInspector(){
  const box = $("#insp"); box.innerHTML="";
  const s = curStrat();
  if(!s){
    const e = el("div","empty");
    e.innerHTML = "Keine Strat ausgewählt.<br><br>";
    const b = el("button","btn primary","+ Strat anlegen"); b.onclick = createStrat;
    e.appendChild(b); box.appendChild(e);
    $("#metaSaved").textContent = "–"; $("#metaId").textContent = "";
    return;
  }

  /* Kopf */
  const head = el("div","isec");
  const name = el("input","field nameinput"); name.value = s.name; name.placeholder="Name der Strat";
  name.oninput = ()=>{ s.name=name.value; renderRail(); queueSave(s.id) };
  head.appendChild(name);
  const row = el("div"); row.style.cssText="display:flex;gap:6px;margin-top:8px;align-items:center";
  SIDES.forEach(sd=>{
    const b=el("button","btn sm"+(s.side===sd?" primary":""),sd);
    b.onclick=()=>{ s.side=sd; S.side=sd; queueSave(s.id); renderAll() }; row.appendChild(b);
  });
  const tags = el("input","field"); tags.value=s.tags.join(", "); tags.placeholder="Tags: Execute, A, Anti-Eco";
  tags.style.fontSize="12.5px";
  tags.oninput=()=>{ s.tags=tags.value.split(",").map(x=>x.trim()).filter(Boolean); renderRail(); queueSave(s.id) };
  row.appendChild(tags);
  head.appendChild(row);
  box.appendChild(head);

  /* Roster */
  const ro = el("div","isec");
  ro.innerHTML = '<h3><span class="eyebrow">Aufstellung</span><button class="linkbtn" id="rosterSave">Roster sichern</button></h3>';
  const list = el("div","roster");
  s.players.forEach((p,i)=>{
    const r = el("div","slot");
    r.innerHTML = '<span class="slotnum">'+(i+1)+'</span>';
    const n1=el("input"); n1.value=p.name; n1.placeholder="Spieler";
    n1.oninput=()=>{ p.name=n1.value; queueSave(s.id) };
    const n2=el("input","role"); n2.value=p.role; n2.placeholder="Rolle / Aufgabe";
    n2.oninput=()=>{ p.role=n2.value; queueSave(s.id) };
    r.append(n1,n2); list.appendChild(r);
  });
  ro.appendChild(list); box.appendChild(ro);
  ro.querySelector("#rosterSave").onclick=()=>{
    S.meta.roster = s.players.map(p=>p.name||""); queueMeta();
    ro.querySelector("#rosterSave").textContent = "gesichert";
    setTimeout(()=>{ const x=ro.querySelector("#rosterSave"); if(x) x.textContent="Roster sichern" },1600);
  };

  /* Ablauf */
  const st = el("div","isec");
  st.innerHTML = '<h3><span class="eyebrow">Ablauf</span></h3>';
  const steps = el("div","steps");
  s.steps.forEach((txt,i)=>{
    const r = el("div","step");
    r.innerHTML = '<span class="stepn">'+(i+1)+'</span>';
    const ta = el("textarea","field"); ta.value=txt; ta.rows=1; ta.placeholder="Was passiert in diesem Schritt?";
    ta.dataset.auto="1";
    ta.oninput=()=>{ s.steps[i]=ta.value; autosize(ta); queueSave(s.id) };
    const x = el("button","xbtn","×"); x.title="Schritt löschen";
    x.onclick=()=>{ s.steps.splice(i,1); queueSave(s.id); renderInspector() };
    r.append(ta,x); steps.appendChild(r);
  });
  st.appendChild(steps);
  const add = el("button","btn ghost sm","+ Schritt"); add.style.marginTop="8px";
  add.onclick=()=>{ s.steps.push(""); queueSave(s.id); renderInspector() };
  st.appendChild(add); box.appendChild(st);

  /* Utility */
  const ut = el("div","isec");
  ut.innerHTML = '<h3><span class="eyebrow">Utility</span><span class="eyebrow">'+(s.util.length||"0")+'</span></h3>';
  s.util.forEach((u,i)=>{
    const r = el("div","utilrow");
    const ic = el("span","uticon",UTIL[u.type].short); ic.style.background=UTIL[u.type].color;
    const t1 = el("input"); t1.value=u.label; t1.placeholder="Wohin / welcher Spot";
    t1.oninput=()=>{ u.label=t1.value; queueSave(s.id) };
    const x = el("button","xbtn","×");
    x.onclick=()=>{ s.util.splice(i,1); queueSave(s.id); renderInspector() };
    r.append(ic,t1,x); ut.appendChild(r);
  });
  const addu = el("div","addutil");
  Object.keys(UTIL).forEach(k=>{
    const b = el("button",null,"+ "+UTIL[k].label);
    b.onclick=()=>{ s.util.push({type:k,label:""}); queueSave(s.id); renderInspector() };
    addu.appendChild(b);
  });
  ut.appendChild(addu); box.appendChild(ut);

  /* Notizen */
  const no = el("div","isec");
  no.innerHTML = '<h3><span class="eyebrow">Notizen</span></h3>';
  const ta = el("textarea","field"); ta.value=s.notes; ta.placeholder="Anti-Strats, Timings, was letztes Mal schiefging…";
  ta.oninput=()=>{ s.notes=ta.value; queueSave(s.id) };
  no.appendChild(ta); box.appendChild(no);

  /* Aktionen */
  const ac = el("div","isec"); ac.style.cssText="display:flex;gap:6px;flex-wrap:wrap;border-bottom:0";
  const dup = el("button","btn sm","Duplizieren");
  dup.onclick=()=>{
    const c = JSON.parse(JSON.stringify(s));
    c.id=uid(); c.name=s.name+" (Kopie)"; c.createdAt=now();
    S.strats.set(c.id,c); S.stratId=c.id; queueSave(c.id); renderAll();
  };
  const cp = el("button","btn sm","Als Text kopieren");
  cp.onclick=()=>copyStrat(s,cp);
  const del = el("button","btn sm danger","Löschen");
  del.onclick=()=>{
    if(del.dataset.armed){ deleteStrat(s.id); pickFirst(); renderAll(); return }
    del.dataset.armed="1"; del.textContent="Wirklich?";
    setTimeout(()=>{ if(del.isConnected){ delete del.dataset.armed; del.textContent="Löschen" } },2600);
  };
  ac.append(dup,cp,del); box.appendChild(ac);
  paintMeta(); autosizeAll();
}
function autosize(ta){ ta.style.height="auto"; ta.style.height=(ta.scrollHeight+2)+"px" }
function autosizeAll(){
  requestAnimationFrame(()=>document.querySelectorAll('#insp textarea[data-auto]').forEach(autosize));
}
function paintMeta(){
  const s = curStrat(); if(!s) return;
  const d = new Date(s.updatedAt||now());
  $("#metaSaved").textContent = "zuletzt "+d.toLocaleString("de-DE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})+
    (s.updatedBy && s.updatedBy!=="?" ? " · "+s.updatedBy : "");
  $("#metaId").textContent = S.mode==="db" ? "live" : "lokal";
}
function copyStrat(s,btn){
  const lines = [];
  lines.push("["+s.side+"] "+curMap().label+" – "+s.name);
  if(s.tags.length) lines.push(s.tags.join(" / "));
  lines.push("");
  s.players.forEach((p,i)=>{ if(p.name||p.role) lines.push((i+1)+". "+(p.name||"–")+(p.role?" — "+p.role:"")) });
  if(s.steps.filter(Boolean).length){ lines.push(""); s.steps.filter(Boolean).forEach((t,i)=>lines.push((i+1)+") "+t)) }
  if(s.util.length){ lines.push(""); lines.push("Util: "+s.util.map(u=>UTIL[u.type].label+(u.label?" "+u.label:"")).join(", ")) }
  if(s.notes) { lines.push(""); lines.push(s.notes) }
  const txt = lines.join("\n");
  const done = ()=>{ btn.textContent="Kopiert"; setTimeout(()=>btn.textContent="Als Text kopieren",1600) };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done,()=>fallback());
  else fallback();
  function fallback(){
    const t=el("textarea"); t.value=txt; t.style.cssText="position:fixed;opacity:0";
    document.body.appendChild(t); t.select();
    try{ document.execCommand("copy"); done() }catch(e){ btn.textContent="Ging nicht" }
    t.remove();
  }
}

/* ===================== Vorschläge ===================== */
function renderPresets(){
  $("#presetMap").textContent = curMap().label;
  const body = $("#presetBody"); body.innerHTML="";
  const list = (PRESETS[S.mapId]||[]);
  if(!list.length){ body.appendChild(el("div","empty","Für diese Map sind keine Vorschläge hinterlegt.")); return }
  const intro = el("div","empty");
  intro.style.cssText="text-align:left;padding:0 0 6px;color:var(--faint);font-size:12.5px";
  intro.textContent = "Standard-Executes als Startpunkt. Übernehmen legt eine editierbare Kopie in eurem Buch an, Zeichnung und Spots macht ihr selbst.";
  body.appendChild(intro);
  list.forEach(p=>{
    const c = el("div","pcard");
    c.innerHTML = '<header><div><h4>'+esc(p.name)+'</h4>'+
      '<div style="display:flex;gap:5px;margin-top:5px;flex-wrap:wrap"><span class="sidechip '+p.side+'">'+p.side+'</span>'+
      p.tags.map(t=>'<span class="tag">'+esc(t)+'</span>').join("")+'</div></div></header>'+
      '<ol>'+p.steps.map(s=>"<li>"+esc(s)+"</li>").join("")+'</ol>'+
      '<div class="ut">'+p.util.map(u=>'<span class="tag" style="color:'+UTIL[u[0]].color+'">'+UTIL[u[0]].short+' '+esc(u[1])+'</span>').join("")+'</div>';
    const b = el("button","btn primary sm","Übernehmen"); b.style.marginTop="10px";
    b.onclick=()=>{
      const s = newStrat({
        name:p.name, side:p.side, tags:p.tags.slice(),
        steps:p.steps.slice(),
        util:p.util.map(u=>({type:u[0],label:u[1]})),
        players:S.meta.roster.map((n,i)=>({name:n||"",role:p.roles[i]||""}))
      });
      S.strats.set(s.id,s); S.side=p.side; S.stratId=s.id; queueSave(s.id);
      $("#drawer").removeAttribute("open"); renderAll();
      if(innerWidth<=900) setPane("stage");
    };
    c.appendChild(b); body.appendChild(c);
  });
}


/* ===================== Events / Init ===================== */
function setPane(p){
  $("#mainGrid").dataset.pane = p;
  $("#mobTabs").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.pane===p));
  if(p==="insp") autosizeAll();
  if(p==="stage"){ fitBoard(); applyZoom() }
}
function createStrat(){
  const s = newStrat(); S.strats.set(s.id,s); S.stratId=s.id;
  queueSave(s.id); renderAll();
  const n = $("#insp .nameinput"); if(n){ n.focus(); n.select() }
}
function renderAll(){ renderRail(); renderBoard(); renderToolbar(); renderInspector(); }

function bind(){
  $("#sideT").onclick=()=>{ S.side="T"; pickFirst(); renderAll() };
  $("#sideCT").onclick=()=>{ S.side="CT"; pickFirst(); renderAll() };
  $("#newStrat").onclick=createStrat;
  $("#undoBtn").onclick=undo;
  $("#clearBtn").onclick=()=>{
    const s=curStrat(); if(!s||!s.draw.length) return;
    const b=$("#clearBtn");
    if(b.dataset.armed){ pushUndo(); s.draw=s.draw.filter(e=>e.l && e.l!==S.layer); delete b.dataset.armed; b.textContent="Leeren"; renderBoard(); queueSave(s.id); return }
    b.dataset.armed="1"; b.textContent="Sicher?";
    setTimeout(()=>{ delete b.dataset.armed; b.textContent="Leeren" },2600);
  };
  $("#phaseChips").onclick=e=>{
    const b=e.target.closest("button"); if(!b) return;
    const ph=+b.dataset.ph; S.filter=ph; if(ph) S.phase=ph;
    $("#phaseChips").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",+x.dataset.ph===ph));
    renderBoard();
  };
  $("#zoomChips").onclick=e=>{
    const b=e.target.closest("button"); if(!b) return;
    if(b.dataset.z==="in") S.zoom=Math.min(ZOOMS.length-1,S.zoom+1);
    else if(b.dataset.z==="out") S.zoom=Math.max(0,S.zoom-1);
    else { S.zoom=0; S.tx=0; S.ty=0 }
    if(S.zoom===0){ S.tx=0; S.ty=0 }
    applyZoom();
  };
  $("#presetBtn").onclick=()=>{ renderPresets(); $("#drawer").setAttribute("open","") };
  $("#drawer").addEventListener("click",e=>{ if(e.target.closest("[data-close]")) $("#drawer").removeAttribute("open") });
  $("#mobTabs").onclick=e=>{ const b=e.target.closest("button"); if(b) setPane(b.dataset.pane) };
  $("#teamName").oninput=e=>{ S.meta.team=e.target.value; queueMeta() };
  $("#meBtn").onclick = openMeMenu;
  $("#installBtn").onclick = async ()=>{
    if(!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null; $("#installBtn").hidden = true;
  };
  addEventListener("keydown",e=>{
    const t=e.target.tagName;
    if(t==="INPUT"||t==="TEXTAREA") return;
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="z"){ e.preventDefault(); undo(); return }
    const tool = TOOLS.find(x=>x.key===e.key.toLowerCase());
    if(tool){ S.tool=tool.id; renderToolbar(); renderBoard() }
  });
  addEventListener("resize",()=>{ if(innerWidth>900) $("#mainGrid").dataset.pane="stage"; fitBoard(); applyZoom(); autosizeAll() });
  if(window.ResizeObserver){
    const ro = new ResizeObserver(()=>{ fitBoard(); });
    ro.observe($("#board"));
  }
}

function ingest(arr){
  let changed=false;
  const seen=new Set();
  arr.forEach(s=>{
    if(!s || !s.id) return; seen.add(s.id);
    if(pending.has(s.id)) return;
    const cur=S.strats.get(s.id);
    if(!cur || (s.updatedAt||0)>=(cur.updatedAt||0)){
      s.tags=s.tags||[]; s.draw=s.draw||[]; s.util=s.util||[]; s.steps=s.steps||[""];
      s.players=s.players||[{},{},{},{},{}].map(()=>({name:"",role:""}));
      S.strats.set(s.id,s); changed=true;
    }
  });
  [...S.strats.keys()].forEach(id=>{ if(!seen.has(id) && !pending.has(id)){ S.strats.delete(id); changed=true } });
  if(changed){
    if(S.stratId && !S.strats.has(S.stratId)) pickFirst();
    if(!S.stratId) pickFirst();
    renderAll();
  }
}


/* ===================== Präsenz ===================== */
let presenceCh = null;
function initPresence(){
  if(S.mode!=="db" || !sb) return;
  presenceCh = sb.channel("radarroom-presence", { config:{ presence:{ key: S.clientId } } });
  presenceCh.on("presence",{event:"sync"},()=>{
    const st = presenceCh.presenceState();
    const names = Object.keys(st).filter(k=>k!==S.clientId)
      .map(k=>(st[k][0]||{}).name).filter(Boolean);
    const w = $("#whoList"); if(w){ w.innerHTML="";
      names.slice(0,4).forEach(n=>{ const i=el("i",null,n.slice(0,2).toUpperCase()); i.title=n; w.appendChild(i) });
    }
    const t = $("#whoText"); if(t) t.textContent = names.length ? names.length+" online" : "nur du";
  });
  presenceCh.subscribe(async st=>{ if(st==="SUBSCRIBED") await presenceCh.track({ name: ME || "Gast" }) });
}
function updatePresence(){ if(presenceCh) presenceCh.track({ name: ME || "Gast" }).catch(()=>{}) }

/* ===================== Anmeldung ===================== */
function showGate(msg){
  $("#app").hidden = true;
  $("#gate").hidden = false;
  if(msg) $("#gateErr").textContent = msg;
  $("#gateMail").focus();
}
function startApp(){
  $("#gate").hidden = true;
  $("#app").hidden = false;
  boot();
}
function bindGate(){
  $("#gateForm").addEventListener("submit", async e=>{
    e.preventDefault();
    const btn = $("#gateBtn"); btn.disabled = true; btn.textContent = "Moment…";
    $("#gateErr").textContent = "";
    const { error } = await sb.auth.signInWithPassword({
      email: $("#gateMail").value.trim(), password: $("#gatePass").value
    });
    btn.disabled = false; btn.textContent = "Anmelden";
    if(error){
      const m = error.message || "";
      $("#gateErr").textContent =
        /invalid|credential/i.test(m) ? "E-Mail oder Passwort stimmt nicht." :
        /fetch|network|failed to fetch/i.test(m) ? "Keine Verbindung zur Datenbank. Internet prüfen, sonst stimmen die Werte in config.js nicht." :
        /confirm/i.test(m) ? "Der Account ist noch nicht bestätigt. Im Supabase-Dashboard unter Authentication bestätigen." :
        "Anmeldung fehlgeschlagen: " + m;
      return;
    }
    S.mode = "db"; store = remoteStore(); startApp(); initPresence();
  });
  $("#offlineBtn").onclick = ()=>{
    S.mode = "local"; store = localStore(); startApp();
    toast("Nur-lokal-Modus: Änderungen bleiben auf diesem Gerät.");
  };
}
async function logout(){
  try{ await sb.auth.signOut() }catch(e){}
  localStorage.removeItem("rr.cache");
  location.reload();
}

/* ===================== Ich-Menü ===================== */
function openMeMenu(){
  const old = $("#meMenu"); if(old){ old.remove(); return }
  const box = el("div"); box.id = "meMenu";
  box.style.cssText = "position:fixed;z-index:80;top:52px;right:12px;width:250px;background:var(--panel-lo);"+
    "border:1px solid var(--line);border-radius:var(--r);padding:12px;display:flex;flex-direction:column;gap:9px";
  const lab = el("span","eyebrow","Anzeigename");
  const inp = el("input","field"); inp.value = ME; inp.placeholder = "z. B. Lukas"; inp.maxLength = 18;
  const status = el("div"); status.style.cssText = "font-size:12px;color:var(--faint);line-height:1.5";
  status.textContent = (S.mode==="db" ? "Live mit dem Team verbunden." : "Nur auf diesem Gerät gespeichert.")
    + (Outbox.count() ? " " + Outbox.count() + " Änderung(en) warten auf Verbindung." : "");
  const row = el("div"); row.style.cssText = "display:flex;gap:6px";
  const ok = el("button","btn primary sm","Speichern");
  ok.onclick = ()=>{
    ME = inp.value.trim().slice(0,18);
    localStorage.setItem("rr.me", ME);
    $("#meLabel").textContent = ME || "Ich";
    updatePresence(); box.remove();
  };
  row.appendChild(ok);
  if(S.mode==="db"){
    const out = el("button","btn sm danger","Abmelden"); out.onclick = logout; row.appendChild(out);
  }
  box.append(lab, inp, status, row);
  document.body.appendChild(box);
  inp.focus(); inp.select();
  setTimeout(()=>{
    const close = e=>{ if(!box.contains(e.target) && e.target.id!=="meBtn"){ box.remove(); removeEventListener("pointerdown",close) } };
    addEventListener("pointerdown", close);
  },0);
}

/* ===================== Start ===================== */
function boot(){
  $("#meLabel").textContent = ME || "Ich";
  bind(); setupPointer();
  store.onStrats(ingest);
  store.onMeta(m=>{
    S.meta = Object.assign({team:"Team",roster:["","","","",""]}, m||{});
    if(document.activeElement !== $("#teamName")) $("#teamName").value = S.meta.team;
  });
  const pres = $("#presence"); if(pres) pres.hidden = (S.mode !== "db");
  pickFirst(); renderAll(); setSync("ok"); markOutbox();
  addEventListener("online", ()=>Outbox.flush());
  setInterval(()=>Outbox.flush(), 15000);
  Outbox.flush();
}

async function main(){
  bindGate();
  if(!HAS_SB){
    S.mode = "local"; store = localStore();
    $("#gate").hidden = true; $("#app").hidden = false;
    boot();
    toast(window.supabase
      ? "Noch keine Datenbank in config.js eingetragen – die App läuft nur auf diesem Gerät."
      : "Die Datenbank-Bibliothek konnte nicht geladen werden – die App läuft nur auf diesem Gerät.");
    return;
  }
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth:{ persistSession:true, autoRefreshToken:true }
  });
  const { data } = await sb.auth.getSession();
  if(data && data.session){
    S.mode = "db"; store = remoteStore(); startApp(); initPresence();
  } else {
    showGate();
  }
}

/* Service Worker + Installieren */
if("serviceWorker" in navigator){
  addEventListener("load", ()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
let deferredInstall = null;
addEventListener("beforeinstallprompt", e=>{
  e.preventDefault(); deferredInstall = e;
  const b = $("#installBtn"); if(b) b.hidden = false;
});

main();
