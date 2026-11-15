/* ---------- Dati: caricati dai blocchi JSON incorporati (cartella dati/) ---------- */
const INT5=['Bassa','Medio-bassa','Media','Medio-elevata','Elevata'];
const ABBR={'Non percettibile':'NP','Bassa':'B','Medio-bassa':'MB','Media':'M','Medio-elevata':'ME','Elevata':'E'};
const DATA=k=>JSON.parse(document.getElementById('d-'+k).textContent);
const VOC=DATA('vocabolari');
const _lab=list=>list.map(x=>x.l);
const _grp=gs=>Object.fromEntries(gs.map(g=>[g.l,_lab(g.voci)]));
// Strutture di lavoro (etichette) ricostruite dai vocabolari codificati
const L={};
for(const [k,v] of Object.entries(VOC.liste)) L[k]=_lab(v);
for(const k of ['aspetto','occhiatura','erbor','strpasta']) L[k]=_grp(VOC.gruppi[k]);
L.persHint=VOC.liste.pers.map(x=>x.hint);
const TREE=Object.fromEntries(VOC.descrittori.map(f=>[f.l,Object.fromEntries(f.sub.map(s=>[s.l,_lab(s.voci)]))]));
const CAT=_grp(VOC.gruppi.categoria);
const PRES=_grp(VOC.gruppi.presentazione);
const PAIRING_CHIPS=_grp(VOC.gruppi.abbinamenti);

const _GL=DATA('glossario');
const GLOSSARY_AREAS=_GL.aree;
const ONAF_GLOSSARY=_GL.termini.map(t=>({...t,areaName:(_GL.aree.find(a=>a.id===t.area)||{}).label||''}));

const _AB=DATA('abbinamenti');
const TERRITORY_PAIRINGS=_AB.territorio;
const ICONIC_BY_ID=new Map(_AB.iconici.map(x=>[x.id,x]));

const ITALY_REGIONS=DATA('mappa-italia').regioni;

// Atlante: la chiave è l'ID ONAF (i nomi non sono univoci). La tassonomia è salvata per codice.
const _decTax=(k,arr)=>{
  const voci=k==='crosta'?VOC.liste.crosta_atlante:(VOC.gruppi.categoria.find(g=>g.c===k)||{voci:[]}).voci;
  return arr.map(c=>{const f=voci.find(x=>x.c===c);return f?f.l:c;});
};
const ONAF_ATLAS=DATA('atlante').formaggi.map(a=>{
  const tax={};
  for(const [k,v] of Object.entries(a.tax||{})) tax[k]=_decTax(k,v);
  const o={onafId:a.id,nome:a.nome,regioni:a.regioni,ric:a.ric,regione:a.regioni.join(' / '),latte:`Scheda ufficiale Atlante ONAF (ID ${a.id})`,tax,fonte:a.fonte||{}};
  if(a.profilo){const p=a.profilo;Object.assign(o,p,{persIdx:p.persistenza-1,persistenza:L.pers[p.persistenza-1],detailed:true});}
  return o;
});
const ATLAS_BY_ID=new Map(ONAF_ATLAS.map(a=>[a.onafId,a]));
const atlasById=id=>ATLAS_BY_ID.get(Number(id))||null;

// Indice piatto per la ricerca rapida nei descrittori
const FLAT_TREE=[];
for(const [f,subs] of Object.entries(TREE)){
  for(const [s,recs] of Object.entries(subs)){
    if(recs.length===0){
      FLAT_TREE.push({f,s,r:'',label:`${f} › ${s}`,search:`${f} ${s}`.toLowerCase()});
    }else{
      FLAT_TREE.push({f,s,r:'',label:`${f} › ${s} (generico)`,search:`${f} ${s}`.toLowerCase()});
      for(const r of recs){
        FLAT_TREE.push({f,s,r,label:`${r}`,sub:`${f} › ${s}`,search:`${r} ${s} ${f}`.toLowerCase()});
      }
    }
  }
}

/* ---------- Stato ---------- */
const KEY='scheda-degustazione-prototipo-v1';
const KEY2='scheda-degustazione-prototipo-v2';
const KEY3='scheda-degustazione-v3';
const SCHEMA=3;
const APP_ID='scheda-degustazione-formaggi';
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const newId=()=>'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const fresh=()=>({step:0,v:{data:today()},created:Date.now()});

/* ---------- Codifica di archiviazione (schema 3) ----------
   In memoria la scheda lavora con le etichette; su disco (localStorage, backup, export)
   si salvano codici stabili, così correggere una dicitura non rompe lo storico.
   Scala unica delle intensità: 0 = non percettibile, 1–5 = da bassa a elevata. */
const _mk=items=>({enc:new Map(items.map(x=>[x.l,x.c])),dec:new Map(items.map(x=>[x.c,x.l]))});
const VM={};
for(const [k,v] of Object.entries(VOC.liste)) VM[k]=_mk(v);
for(const [k,v] of Object.entries(VOC.gruppi)) if(k!=='categoria'&&k!=='presentazione') VM[k]=_mk(v.flatMap(g=>g.voci));
VM.presenza_pl=_mk([{c:'assente',l:'Assenti'},{c:'presente',l:'Presenti'}]);
const GRP={
  cat_:VOC.gruppi.categoria.map(g=>({c:g.c,l:g.l,m:_mk(g.voci)})),
  pres_:VOC.gruppi.presentazione.map(g=>({c:g.c,l:g.l,m:_mk(g.voci)}))
};
const FIELD={
  forma:{voc:'forma'},facce:{voc:'facce'},scalzo:{voc:'scalzo'},tipsup:{voc:'tipsup'},aspetto:{voc:'aspetto'},
  colsup:{voc:'colore'},colpasta:{voc:'colore'},sottocrosta:{voc:'sottocrosta'},occhiatura:{voc:'occhiatura'},erbor:{voc:'erbor'},
  discont:{voc:'discont'},discont_d:{voc:'dim'},discont_s:{voc:'distr'},strpasta:{voc:'strpasta'},strbocca_o:{voc:'strAltri'},abb_items:{voc:'abbinamenti'},
  forma_r:{voc:'regolarita'},facce_r:{voc:'regolarita'},scalzo_r:{voc:'regolarita'},
  colsup_u:{voc:'uniformita'},colpasta_u:{voc:'uniformita'},colsup_i:{voc:'carica'},colpasta_i:{voc:'carica'},
  sottocrosta_p:{voc:'presenza'},occhiatura_p:{voc:'presenza'},erbor_p:{voc:'presenza'},trig_p:{voc:'presenza'},discont_p:{voc:'presenza_pl'},
  trig_r:{voc:'trig',rate:true},strbocca_r:{voc:'strInt',rate:true},
  odori_int:{scale:true},aromi_int:{scale:true},pers:{scale:true},abb_armonia:{scale:true},
  odori_items:{tree:true},aromi_items:{tree:true}
};
const _mapVal=(val,fn)=>Array.isArray(val)?val.map(fn):fn(val);
function encTree(it){
  const F=VOC.descrittori.find(x=>x.l===it.f);
  const Sx=F&&F.sub.find(x=>x.l===it.s);
  if(!F||!Sx) return {testo:[it.f||'',it.s||'',it.r||'']};
  const o={f:F.c,s:Sx.c};
  const Rx=it.r?Sx.voci.find(x=>x.l===it.r):null;
  if(Rx) o.r=Rx.c; else if(it.r) o.testo=it.r;
  return o;
}
function decTree(o){
  if(!o||typeof o!=='object') return {f:'',s:'',r:''};
  if(Array.isArray(o.testo)) return {f:o.testo[0]||'',s:o.testo[1]||'',r:o.testo[2]||''};
  const F=VOC.descrittori.find(x=>x.c===o.f);
  const Sx=F&&F.sub.find(x=>x.c===o.s);
  if(!F||!Sx) return {f:String(o.f||''),s:String(o.s||''),r:String(o.r||o.testo||'')};
  const Rx=o.r?Sx.voci.find(x=>x.c===o.r):null;
  return {f:F.l,s:Sx.l,r:Rx?Rx.l:(typeof o.testo==='string'?o.testo:'')};
}
function codecValue(k,val,enc){
  const f=FIELD[k];
  if(!f) return val;
  const d=enc?1:-1;
  if(f.scale) return typeof val==='number'?val+d:val;
  if(f.tree) return Array.isArray(val)?val.map(enc?encTree:decTree):val;
  const m=VM[f.voc];
  const fn=enc?(x=>m.enc.has(x)?m.enc.get(x):x):(x=>m.dec.has(x)?m.dec.get(x):x);
  if(f.rate){
    if(!val||typeof val!=='object') return val;
    return Object.fromEntries(Object.entries(val).map(([o,i])=>[fn(o),typeof i==='number'?i+d:i]));
  }
  return _mapVal(val,fn);
}
function codecV(v,enc){
  const out={};
  for(const [k,val] of Object.entries(v||{})){
    if(val===undefined||val===null||k[0]==='_'||k.endsWith('_draft')) continue;
    if(k==='da_riconciliare'){ // gruppi di categoria precompilati dall'Atlante e non ancora confermati
      if(Array.isArray(val)&&val.length) out[k]=val.map(x=>{const g=GRP.cat_.find(g=>(enc?g.l:g.c)===x);return g?(enc?g.c:g.l):x;});
      continue;
    }
    let done=false;
    for(const pre of ['cat_','pres_']){
      if(!k.startsWith(pre)) continue;
      const rest=k.slice(pre.length);
      const g=GRP[pre].find(g=>(enc?g.l:g.c)===rest);
      if(g){
        const fn=enc?(x=>g.m.enc.has(x)?g.m.enc.get(x):x):(x=>g.m.dec.has(x)?g.m.dec.get(x):x);
        out[pre+(enc?g.c:g.l)]=_mapVal(val,fn);done=true;
      }
      break;
    }
    if(!done) out[k]=codecValue(k,val,enc);
  }
  return out;
}
const IMG_OK=/^(https?:\/\/|data:image\/)/i;
function sanitizeV(v){
  for(const k of ['marchio_url','foto_campione']) if(v[k]!==undefined&&(typeof v[k]!=='string'||!IMG_OK.test(v[k]))) delete v[k];
  return v;
}
const encodeSheet=sh=>({step:typeof sh.step==='number'?sh.step:0,updated:sh.updated||Date.now(),created:sh.created||sh.updated||Date.now(),v:codecV(sh.v,true)});
const decodeSheet=sh=>({step:typeof sh.step==='number'?sh.step:0,updated:sh.updated||Date.now(),created:sh.created||sh.updated||Date.now(),v:sanitizeV(codecV(sh&&sh.v,false))});
// Schede salvate dalle versioni precedenti (etichette in chiaro, stato dell'interfaccia mescolato ai dati)
function migrateLegacyV(v){
  if(!v||typeof v!=='object'||Array.isArray(v)) return {};
  if(v._atlas_sel&&!v.rif_onaf){const a=ONAF_ATLAS.find(x=>x.nome===v._atlas_sel);if(a)v.rif_onaf=a.onafId;}
  for(const k of Object.keys(v)) if(k[0]==='_'||k.endsWith('_draft')) delete v[k];
  return sanitizeV(v);
}
function rekeyCache(c){
  const out={};
  for(const [k,u] of Object.entries(c||{})){
    if(typeof u!=='string') continue;
    if(k.startsWith('onaf:')){out[k]=u;continue;}
    const m=ONAF_ATLAS.filter(a=>cleanCheeseName(a.nome).toLowerCase()===k);
    out[m.length===1?'onaf:'+m[0].onafId:k]=u;
  }
  return out;
}

let DB={cur:null,sheets:{},lastBackup:null};
let persistError=false;
(function loadDB(){
  let r3=null;
  try{
    r3=localStorage.getItem(KEY3);
    if(r3){
      const p=JSON.parse(r3);
      if(p&&typeof p==='object'&&p.sheets){
        DB={cur:p.cur||null,sheets:{},lastBackup:p.lastBackup||null,photoCache:p.photoCache||{},marchioCache:p.marchioCache||{}};
        for(const [id,sh] of Object.entries(p.sheets)) DB.sheets[id]=decodeSheet(sh);
      }
      return;
    }
    // Prima apertura dopo l'aggiornamento: migra l'archivio v2 (che resta intatto come copia di sicurezza)
    const r2=localStorage.getItem(KEY2);
    if(r2){
      const p=JSON.parse(r2);
      if(p&&typeof p==='object'&&p.sheets){
        DB={cur:p.cur||null,sheets:{},lastBackup:p.lastBackup||null,photoCache:rekeyCache(p.photoCache),marchioCache:rekeyCache(p.marchioCache)};
        for(const [id,sh] of Object.entries(p.sheets)){
          if(!sh||typeof sh!=='object') continue;
          DB.sheets[id]={step:typeof sh.step==='number'?sh.step:0,updated:sh.updated||Date.now(),created:sh.updated||Date.now(),v:migrateLegacyV(sh.v)};
        }
      }
      return;
    }
    const o=localStorage.getItem(KEY);
    if(o){const id=newId();DB={cur:id,sheets:{[id]:{...fresh(),...JSON.parse(o),updated:Date.now()}},lastBackup:null};}
  }catch(e){
    // Archivio illeggibile: se ne conserva una copia prima che venga sovrascritto
    try{if(r3)localStorage.setItem(KEY3+'-recupero',r3);}catch(e2){}
  }
})();
if(!DB||typeof DB!=='object')DB={cur:null,sheets:{},lastBackup:null};
if(!DB.sheets||typeof DB.sheets!=='object')DB.sheets={};
if(!DB.photoCache||typeof DB.photoCache!=='object')DB.photoCache={};
if(!DB.marchioCache||typeof DB.marchioCache!=='object')DB.marchioCache={};
if(DB.cur && !DB.sheets[DB.cur])DB.cur=null;
if(DB.cur && DB.sheets[DB.cur]){
  if(!DB.sheets[DB.cur].v||typeof DB.sheets[DB.cur].v!=='object')DB.sheets[DB.cur].v={data:today()};
  if(typeof DB.sheets[DB.cur].step!=='number')DB.sheets[DB.cur].step=0;
}
let S=DB.cur ? DB.sheets[DB.cur] : null;
// Vista corrente: 'atlas' | 'gloss' | 'list' | 'sheet'
let VIEW='atlas';
// Stato dell'interfaccia per scheda (ricerche, bozze, pannelli aperti): mai salvato né esportato
const UIST={};
const uiS=()=>{const id=DB.cur||'_';return UIST[id]||(UIST[id]={});};
const _encCache=new Map();
function serializeDB(){
  const sheets={};
  for(const [id,sh] of Object.entries(DB.sheets)){
    if(id===DB.cur||!_encCache.has(id)) _encCache.set(id,encodeSheet(sh));
    sheets[id]=_encCache.get(id);
  }
  for(const id of [..._encCache.keys()]) if(!DB.sheets[id]) _encCache.delete(id);
  return {schema:SCHEMA,cur:DB.cur,lastBackup:DB.lastBackup,sheets,photoCache:DB.photoCache,marchioCache:DB.marchioCache};
}
const persist=()=>{
  try{
    localStorage.setItem(KEY3,JSON.stringify(serializeDB()));
    persistError=false;
  }catch(e){
    const first=!persistError;
    persistError=true;
    if(first) showToast('ATTENZIONE: salvataggio non riuscito (memoria piena). Scarica subito un backup.');
  }
};
const save=()=>{if(!S)return;S.updated=Date.now();persist();};
function openSheet(id){
  if(!DB.sheets[id])return;
  DB.cur=id;
  S=DB.sheets[id];
  if(!S.v||typeof S.v!=='object')S.v={data:today()};
  if(typeof S.step!=='number')S.step=0;
  VIEW='sheet';
  persist();render();window.scrollTo(0,0);
}
function closeSheet(){
  DB.cur=null;
  S=null;
  VIEW='atlas';
  persist();render();window.scrollTo(0,0);
  showToast('Scheda chiusa (salvata in Archivio Schede)');
}
function newSheet(){const id=newId();DB.sheets[id]={...fresh(),updated:Date.now()};openSheet(id);}
function deleteSheet(id){
  if(!confirm('Eliminare questa scheda? Non si può annullare.'))return;
  delete DB.sheets[id];
  if(DB.cur===id){
    DB.cur=null;
    S=null;
    if(VIEW!=='list') VIEW='atlas';
  }
  persist();render();
}
const get=(k,d)=>(S&&S.v&&S.v[k]!==undefined)?S.v[k]:d;
const set=(k,val,rerender=true)=>{if(!S)return;if(!S.v)S.v={};S.v[k]=val;save();if(rerender)render();else updateProgressUI();};
const setUi=(k,val)=>{uiS()[k]=val;render();};
const hasAny=k=>{const x=S&&S.v?S.v[k]:undefined;return Array.isArray(x)?x.length>0:(x&&typeof x==='object'?Object.keys(x).length>0:(x!==undefined&&x!==''))};

/* ---------- Calcolo Avanzamento Fasi ---------- */
function phaseDone(id){
  switch(id){
    case 'id': return hasAny('denominazione') && catVal()!=='' && presVal()!=='' && !pendingCat().length;
    case 'vista': return ['forma','facce','scalzo','tipsup','aspetto','colsup'].some(hasAny);
    case 'pasta': return ['colpasta','sottocrosta_p','occhiatura_p','erbor_p','discont_p','strpasta'].some(hasAny);
    case 'olfatto': return hasAny('odori_int') || hasAny('odori_items');
    case 'gusto': return ['dolce','acido','salato','amaro','umami'].some(s=>hasAny('s_'+s)) || hasAny('aromi_int') || hasAny('aromi_items') || hasAny('trig_p') || hasAny('strbocca_r') || hasAny('strbocca_o');
    case 'bocca': return hasAny('pers');
    default: return false;
  }
}
function calcProgress(){
  const mainPhases=['id','vista','pasta','olfatto','gusto','bocca'];
  const doneCount=mainPhases.filter(phaseDone).length;
  return {doneCount, total:mainPhases.length, pct:Math.round((doneCount/mainPhases.length)*100)};
}
function updateProgressUI(){
  const p=calcProgress();
  const bar=document.getElementById('progbar');
  const txt=document.getElementById('progtxt');
  const hn=document.getElementById('hdrname');
  const hr=document.getElementById('hdrric');
  if(bar)bar.style.width=p.pct+'%';
  if(txt)txt.textContent=p.pct+'%';
  if(hn)hn.textContent=get('denominazione','')||'Nuova scheda di degustazione';
  if(hr){
    const ric=get('riconoscimento','');
    if(ric){hr.textContent=ric;hr.className='ric-pill ric-'+ric;hr.style.display='';}
    else{hr.style.display='none';}
  }
}

/* ---------- Elementi base ---------- */

/* ---------- Glossario Tecnico Ufficiale ONAF (5 Aree + Tecnologia/Biochimica) ---------- */

// Indice veloce per il riconoscimento automatico nei testi
const GLOSS_LOOKUP=(()=>{
  const map=new Map();
  const keys=[];
  ONAF_GLOSSARY.forEach(item=>{
    const allNames=[item.term, ...(item.aliases||[])];
    allNames.forEach(n=>{
      const clean=n.trim();
      if(clean.length>=2){
        map.set(clean.toLowerCase(), item);
        keys.push(clean.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
      }
    });
  });
  // Ordina per lunghezza decrescente per evitare match parziali prematuri (es. "Crosta lavata" prima di "Crosta")
  keys.sort((a,b)=>b.length-a.length);
  const re=new RegExp('\\b('+keys.join('|')+')\\b','gi');
  return {map,re};
})();

function openGlossaryModal(item){
  const existing=document.getElementById('gloss-modal-root');
  if(existing) existing.remove();
  const overlay=document.createElement('div');
  overlay.id='gloss-modal-root';
  overlay.className='gloss-modal-bg';
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove();};
  const closeBtn=h('button',{type:'button',class:'btn sm',onclick:()=>overlay.remove()},'Chiudi ✕');
  const openTabBtn=h('button',{type:'button',class:'btn sm primary',onclick:()=>{
    overlay.remove();
    VIEW='gloss';
    glossSearch=item.term;glossArea='all';glossLetter='ALL';
    render();window.scrollTo(0,0);
  }},'Apri nel Glossario completo ↗');
  overlay.append(
    h('div',{class:'gloss-modal',role:'dialog','aria-modal':'true'},
      h('div',{class:'gloss-modal-hdr'},
        h('div',{},
          h('span',{class:'gloss-area-pill'},item.areaName),
          h('h4',{},item.term)
        ),
        closeBtn
      ),
      h('p',{style:'margin:6px 0 12px;font-size:15px;line-height:1.45'},item.def),
      item.aliases&&item.aliases.length
        ? h('div',{class:'sub',style:'margin-bottom:10px'},h('b',{},'Voci correlate / sinonimi: '),item.aliases.join(', '))
        : null,
      h('div',{class:'row',style:'justify-content:flex-end;margin-top:8px'},openTabBtn)
    )
  );
  document.body.append(overlay);
}

// Trasforma una stringa arricchendo i termini del glossario cliccabili
function enrichTextWithGlossary(str,asInfo){
  if(typeof str!=='string' || str.length<4) return [str];
  const re=GLOSS_LOOKUP.re;
  re.lastIndex=0;
  const parts=[];
  let last=0, m;
  while((m=re.exec(str))!==null){
    if(m.index>last) parts.push(str.slice(last,m.index));
    const matchedTxt=m[0];
    const item=GLOSS_LOOKUP.map.get(matchedTxt.toLowerCase());
    if(item&&asInfo){
      parts.push(matchedTxt);
      const ic=document.createElement('span');
      ic.className='gloss-i';
      ic.setAttribute('role','button');
      ic.setAttribute('aria-label','Definizione di '+item.term);
      ic.title='Definizione ONAF: '+item.term;
      ic.textContent='i';
      ic.addEventListener('click',ev=>{ev.stopPropagation();ev.preventDefault();openGlossaryModal(item);});
      parts.push(ic);
    }else if(item){
      const sp=document.createElement('span');
      sp.className='gloss-term';
      sp.title='Definizione ONAF: '+item.term+' (tocca per leggere)';
      sp.textContent=matchedTxt;
      sp.addEventListener('click',ev=>{
        if(sp.closest('button,a')) return; // dentro un pulsante o un link vince l'azione principale
        ev.stopPropagation();
        ev.preventDefault();
        openGlossaryModal(item);
      });
      parts.push(sp);
    }else{
      parts.push(matchedTxt);
    }
    last=m.index+matchedTxt.length;
  }
  if(last===0) return [str];
  if(last<str.length) parts.push(str.slice(last));
  return parts;
}

let glossSearch='';
let glossArea='all';
let glossLetter='ALL';

function buildGlossaryPage(){
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘']/g,"'");
  const q=norm(glossSearch.trim());
  const sorted=[...ONAF_GLOSSARY].sort((a,b)=>a.term.localeCompare(b.term,'it'));
  const matchesQuery=it=>{
    if(!q) return true;
    const hay=norm(it.term+' '+it.def+' '+(it.aliases||[]).join(' ')+' '+it.areaName);
    return q.split(/\s+/).every(tok=>hay.includes(tok));
  };
  const allQueryMatches=sorted.filter(matchesQuery);
  const filtered=allQueryMatches.filter(it=>{
    if(glossArea!=='all' && it.area!==glossArea) return false;
    if(glossLetter!=='ALL' && !it.term.toUpperCase().startsWith(glossLetter)) return false;
    return true;
  });

  const letters=['ALL', ...new Set(sorted.filter(it=>glossArea==='all'||it.area===glossArea).map(it=>it.term[0].toUpperCase()))].sort((a,b)=>a==='ALL'?-1:(b==='ALL'?1:a.localeCompare(b,'it')));

  const searchInp=h('input',{
    type:'search',
    'data-fk':'gloss_q','aria-label':'Cerca nel glossario',
    placeholder:'Cerca nel glossario (es. enzima, tirosina, occhio di pernice, caglio, pH, umami...)',
    value:glossSearch,
    style:'flex:1',
    oninput:e=>{
      glossSearch=e.target.value;
      if(glossSearch.trim() && glossLetter!=='ALL') glossLetter='ALL';
      render();
    },
    onkeydown:e=>{
      if(e.key==='Escape' && glossSearch){glossSearch='';render();}
    }
  });

  const searchRow=h('div',{style:'display:flex;gap:6px;align-items:center'},
    searchInp,
    glossSearch ? h('button',{type:'button',class:'btn sm',title:'Cancella testo di ricerca',onclick:()=>{glossSearch='';render();}},'Cancella ✕') : null
  );

  const areaPills=h('div',{class:'chips no-gloss',style:'margin-top:8px'},
    GLOSSARY_AREAS.map(ar=>{
      const cnt=ar.id==='all' ? allQueryMatches.length : allQueryMatches.filter(it=>it.area===ar.id).length;
      const lbl=q ? `${ar.label} (${cnt})` : ar.label;
      return h('button',{
        type:'button',
        class:'chip no-gloss'+(glossArea===ar.id?' on':''),
        style:(q && cnt===0 && glossArea!==ar.id)?'opacity:.55':'',
        onclick:()=>{glossArea=ar.id;glossLetter='ALL';render();}
      },lbl);
    })
  );

  const alphaBar=h('div',{class:'gloss-alpha'},
    letters.map(lt=>h('button',{
      type:'button',
      class:glossLetter===lt?'on':'',
      onclick:()=>{glossLetter=lt;render();}
    },lt==='ALL'?'Tutte':lt))
  );

  // Raggruppa per area se glossArea==='all' e nessuna lettera selezionata, altrimenti lista alfabetica unica
  let listCards=[];
  if(!filtered.length){
    const inOtherAreas = (glossArea!=='all' || glossLetter!=='ALL') ? allQueryMatches.length : 0;
    listCards=[h('section',{class:'card wide'},
      h('h3',{},'Nessun risultato nell’area selezionata'),
      h('div',{class:'sub'},
        inOtherAreas>0
          ? `Il termine cercato non appartiene a questa area, ma ci sono ${inOtherAreas} corrispondenze in «Tutte le aree».`
          : 'Nessun termine trovato per i filtri selezionati. Prova a modificare o cancellare la ricerca.'
      ),
      h('div',{class:'row',style:'margin-top:10px;justify-content:flex-start'},
        inOtherAreas>0
          ? h('button',{type:'button',class:'btn sm primary',onclick:()=>{glossArea='all';glossLetter='ALL';render();}},`Mostra tutti i ${inOtherAreas} risultati in «Tutte le aree»`)
          : null,
        h('button',{type:'button',class:'btn sm',onclick:()=>{glossSearch='';glossArea='all';glossLetter='ALL';render();}},'Azzera ricerca e filtri')
      )
    )];
  }else if(glossArea==='all' && glossLetter==='ALL' && !q){
    GLOSSARY_AREAS.slice(1).forEach(ar=>{
      const items=filtered.filter(it=>it.area===ar.id);
      if(items.length){
        listCards.push(h('section',{class:'card wide'},
          h('h3',{},ar.label,h('span',{style:'font-weight:500;color:var(--muted)'},items.length+' termini')),
          items.map(it=>h('div',{class:'gloss-item'},
            h('div',{class:'gloss-item-head'},
              h('b',{},it.term),
              (()=>{const base=it.term.split(' (')[0].trim().toLowerCase();const extra=(it.aliases||[]).filter(a=>a.trim().toLowerCase()!==base);return extra.length?h('small',{style:'color:var(--muted)'},'Anche: '+extra.join(', ')):null;})()
            ),
            h('div',{style:'font-size:14px;line-height:1.45;color:var(--ink)'},it.def)
          ))
        ));
      }
    });
  }else{
    listCards=[h('section',{class:'card wide'},
      h('h3',{},`Risultati (${filtered.length} termini)`),
      filtered.map(it=>h('div',{class:'gloss-item'},
        h('div',{class:'gloss-item-head'},
          h('div',{},h('b',{},it.term),' ',h('span',{class:'gloss-area-pill',style:'margin:0 0 0 6px'},it.areaName)),
          (()=>{const base=it.term.split(' (')[0].trim().toLowerCase();const extra=(it.aliases||[]).filter(a=>a.trim().toLowerCase()!==base);return extra.length?h('small',{style:'color:var(--muted)'},'Anche: '+extra.join(', ')):null;})()
        ),
        h('div',{style:'font-size:14px;line-height:1.45;color:var(--ink)'},it.def)
      ))
    )];
  }

  return [
    h('section',{class:'card wide'},
      h('h3',{},'Ricerca e filtri per area terminologica ONAF',
        (glossSearch||glossArea!=='all'||glossLetter!=='ALL')
          ? h('button',{type:'button',class:'link',onclick:()=>{glossSearch='';glossArea='all';glossLetter='ALL';render();}},'Reimposta filtri')
          : null
      ),
      searchRow,
      areaPills,
      alphaBar
    ),
    ...listCards
  ];
}

function h(tag,props,...kids){
  const e=document.createElement(tag);
  for(const [k,v] of Object.entries(props||{})){
    if(k==='class')e.className=v;
    else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);
    else if(k==='value')e.value=v;
    else if(k.startsWith('aria-'))e.setAttribute(k,String(v));
    else if(v===true)e.setAttribute(k,'');
    else if(v!==false&&v!=null)e.setAttribute(k,v);
  }
  const noEnrichTags=new Set(['OPTION','TEXTAREA','INPUT','SELECT','SCRIPT','STYLE','TITLE','H4']);
  // Nei pulsanti il testo non intercetta il tocco: solo i chip mostrano una «i» dedicata al glossario
  const isBtn=e.tagName==='BUTTON';
  const isChip=isBtn && e.classList.contains('chip');
  const canEnrich=!noEnrichTags.has(e.tagName) && !(props&&props.class&&String(props.class).includes('no-gloss')) && (!isBtn||isChip);
  kids.flat(Infinity).forEach(c=>{
    if(c==null||c===false)return;
    if(c.nodeType){e.append(c);return;}
    const s=String(c);
    if(canEnrich && typeof GLOSS_LOOKUP!=='undefined'){
      enrichTextWithGlossary(s,isChip).forEach(node=>e.append(typeof node==='string'?document.createTextNode(node):node));
    }else{
      e.append(document.createTextNode(s));
    }
  });
  return e;
}
const split=s=>{const m=/^(.*?) \((.*)\)$/.exec(s);return m?[m[1],m[2]]:[s,''];};
function chips(opts,sel,onpick,multi){
  const arr=Array.isArray(sel)?sel:(sel?[sel]:[]);
  return h('div',{class:'chips'},opts.map(o=>{
    const [t,hint]=split(o);
    const on=multi?arr.includes(o):sel===o;
    return h('button',{type:'button',class:'chip'+(on?' on':''),'aria-pressed':on,onclick:()=>onpick(o)},t,hint?h('small',{},hint):null);
  }));
}
function seg(opts,sel,onpick){
  return h('div',{class:'seg',role:'group'},opts.map(o=>h('button',{type:'button',class:sel===o?'on':'','aria-pressed':sel===o,onclick:()=>onpick(o)},o)));
}
function scale(levels,val,onpick,hints,zero){
  const lbl=val===undefined?h('span',{},'Tocca per scegliere'):h('span',{},h('b',{},levels[val]),hints&&hints[val]?' · '+hints[val]:'');
  return h('div',{class:'scale'},
    h('div',{class:'btns'},levels.map((l,i)=>h('button',{type:'button','aria-label':l,'aria-pressed':val===i,class:(val===i?'on':(val!==undefined&&i<val&&!(zero&&i===0)?'fill':'')),onclick:()=>onpick(val===i?undefined:i)},ABBR[l]||(zero?String(i):String(i+1))))),
    h('div',{class:'lbl'},lbl));
}
function textInput(key,label,req,type='text'){
  return h('div',{},h('label',{class:'f',for:'f_'+key},label,req?h('i',{},' *'):null),
    h('input',{type,id:'f_'+key,'data-fk':key,value:get(key,''),autocomplete:'off',oninput:e=>set(key,e.target.value,false)}));
}
function noteBox(key,label='Note'){
  const open=uiS()['open_'+key]||get(key,'');
  if(!open) return h('button',{type:'button',class:'link notebtn',onclick:()=>{uiS()['open_'+key]=true;render();}},'+ Aggiungi nota');
  return h('div',{},h('label',{class:'f',for:'f_'+key},label),h('textarea',{id:'f_'+key,'data-fk':key,oninput:e=>set(key,e.target.value,false)},get(key,'')));
}
const card=(title,...kids)=>h('section',{class:'card'},h('h3',{},h('span',{},title)),...kids);
const sub=t=>h('div',{class:'sub'},t);
function toggleMulti(key,o){const cur=get(key,[]);const a=Array.isArray(cur)?cur:(cur?[cur]:[]);set(key,a.includes(o)?a.filter(x=>x!==o):[...a,o]);}
function pickOne(key,o){set(key,get(key)===o?undefined:o);}
function grouped(key,groups){
  const a=get(key,[]);
  return Object.entries(groups).map(([g,opts])=>[sub(g),chips(opts,a,o=>toggleMulti(key,o),true)]);
}
function ratingList(key,opts){
  const m=get(key,{});
  return [h('div',{class:'sub'},'Valuta solo ciò che percepisci (da B = bassa a E = elevata):'),
    opts.map(o=>{const [t,hint]=split(o);
      return h('div',{class:'sapore rate'},
        h('div',{},h('b',{},t),hint?h('small',{style:'display:block;color:var(--muted);font-size:11px'},hint):null),
        scale(INT5,m[o],i=>{const n={...m};if(i===undefined)delete n[o];else n[o]=i;set(key,n);}));})];
}
function presence(key,render_,opts=['Assente','Presente']){
  const st=get(key+'_p');
  const isPres=st===opts[1] || st==='Presente';
  return [h('div',{class:'row'},h('span',{class:'sub',style:'margin:0'},'Presenza'),seg(opts,st,o=>set(key+'_p',st===o?undefined:o))),
    isPres?render_():null];
}

/* ---------- Albero descrittori con Ricerca Rapida (Odori e Aromi) ---------- */
function treePicker(key){
  const items=get(key+'_items',[]);
  const dr=uiS()[key+'_draft']||{};
  const q=(uiS()['q_'+key]||'').trim().toLowerCase();

  const add=(f,s,r)=>{
    if(!items.some(it=>it.f===f&&it.s===s&&it.r===r)){
      set(key+'_items',[...items,{f,s,r}],false);
    }
    uiS()[key+'_draft']={};
    uiS()['q_'+key]='';
    save();render();
  };

  const tags=h('div',{class:'tags'},items.map((it,i)=>h('span',{class:'tag'},[it.f,it.s,it.r].filter(Boolean).join(' › '),
    h('button',{type:'button','aria-label':'Rimuovi',onclick:()=>set(key+'_items',items.filter((_,j)=>j!==i))},'×'))));

  const searchInput=h('input',{
    type:'search',
    'data-fk':'q_'+key,'aria-label':'Cerca descrittore',
    placeholder:'Cerca descrittore rapido (es. fieno, nocciola, burro, pepe...)',
    value:uiS()['q_'+key]||'',
    oninput:e=>{uiS()['q_'+key]=e.target.value;render();}
  });

  let searchResults=null;
  if(q.length>=2){
    const matches=FLAT_TREE.filter(x=>x.search.includes(q)).slice(0,14);
    searchResults=h('div',{class:'search-results'},
      matches.length
        ? matches.map(m=>h('button',{type:'button',class:'chip',onclick:()=>{
            if(m.s==='Crosta di formaggio'){
              uiS()['q_'+key]='';uiS()[key+'_draft']={f:m.f,s:m.s};render();
            }else{
              add(m.f,m.s,m.r);
            }
          }},m.label,m.sub?h('small',{},m.sub):null))
        : h('span',{class:'sub'},'Nessun descrittore trovato per «'+q+'»')
    );
  }

  let step;
  if(!q){
    if(!dr.f){
      step=[sub('Oppure sfoglia per Famiglia'),h('div',{class:'chips'},Object.keys(TREE).map(f=>h('button',{type:'button',class:'chip',onclick:()=>setUi(key+'_draft',{f})},f)))];
    }else if(!dr.s){
      const famNote=dr.f==='Altro'?h('div',{class:'sub',style:'font-style:italic;margin-top:2px'},'Nota ONAF: fanno riferimento alla tecnologia di produzione e a fermentazioni dovute al latte di partenza.'):null;
      step=[crumb(key,dr),famNote,sub('Sottofamiglia'),h('div',{class:'chips'},Object.keys(TREE[dr.f]).map(s=>h('button',{type:'button',class:'chip',onclick:()=>{
        setUi(key+'_draft',{f:dr.f,s});}},s)))];
    }else if(TREE[dr.f][dr.s].length===0){
      const inp=h('input',{type:'text',placeholder:'es. Taleggio',autocomplete:'off'});
      step=[crumb(key,dr),sub('Riconoscimento: completa'),h('div',{class:'row'},h('b',{},'Crosta di'),inp,
        h('button',{type:'button',class:'btn primary sm',onclick:()=>add(dr.f,dr.s,inp.value.trim()?'Crosta di '+inp.value.trim():'')},'Aggiungi'))];
    }else{
      step=[crumb(key,dr),sub('Riconoscimento'),h('div',{class:'chips'},[
        ...TREE[dr.f][dr.s].map(r=>h('button',{type:'button',class:'chip',onclick:()=>add(dr.f,dr.s,r)},r)),
        h('button',{type:'button',class:'chip',style:'border-style:dashed',onclick:()=>add(dr.f,dr.s,'')},'Solo «'+dr.s+'»')])];
    }
  }

  return [
    items.length?tags:h('div',{class:'sub'},'Nessun descrittore selezionato.'),
    h('div',{class:'search-box'},searchInput,searchResults),
    step
  ];
}
function crumb(key,dr){
  return h('div',{class:'crumb'},
    h('button',{type:'button',class:'link',onclick:()=>setUi(key+'_draft',{})},'Famiglie'),'›',
    dr.s?h('button',{type:'button',class:'link',onclick:()=>setUi(key+'_draft',{f:dr.f})},dr.f):h('b',{},dr.f),
    dr.s?['›',h('b',{},dr.s)]:null);
}

/* ---------- Categoria e presentazione ---------- */
function groupPick(prefix,groups,multi=[]){
  return Object.entries(groups).map(([g,opts])=>{const k=prefix+g;
    return [sub(g),multi.includes(g)?chips(opts,get(k,[]),o=>toggleMulti(k,o),true):chips(opts,get(k),o=>pickOne(k,o))];});
}
/* Riconciliazione con il campione: «Degusta» copia dall'Atlante tutte le varianti ammesse per la
   denominazione. I gruppi con più di una voce restano segnalati finché l'assaggiatore non li
   modifica o li conferma per il campione in esame. */
const pendingCat=()=>{const a=S&&S.v?S.v.da_riconciliare:null;return Array.isArray(a)?a.filter(g=>g in CAT):[];};
function resolveCat(g){
  const a=pendingCat().filter(x=>x!==g);
  if(a.length)S.v.da_riconciliare=a;else delete S.v.da_riconciliare;
}
function catPick(){
  const pend=pendingCat();
  return Object.entries(CAT).map(([g,opts])=>{
    const k='cat_'+g;
    const isP=pend.includes(g);
    return [
      h('div',{class:'sub'},g,
        isP?h('span',{class:'recon-badge no-gloss'},'da riconciliare'):null,
        isP?h('button',{type:'button',class:'link',onclick:()=>{resolveCat(g);save();render();}},'Confermo per questo campione'):null),
      chips(opts,get(k,[]),o=>{if(isP)resolveCat(g);toggleMulti(k,o);},true)
    ];
  });
}
function catValFrom(v){
  const a=Object.keys(CAT).map(g=>{
    const val=v['cat_'+g];
    const s=Array.isArray(val)?val.join(', '):val;
    return s?g+': '+s:'';
  }).filter(Boolean);
  if(v['categoria'])a.push(v['categoria']);
  return a.join(' · ');
}
function presValFrom(v){
  const a=Object.keys(PRES).map(g=>{const val=v['pres_'+g];const s=Array.isArray(val)?val.join(', '):val;return s?g+': '+s:'';}).filter(Boolean);
  if(v['pres_origine'])a.push(v['pres_origine']);
  if(v['notepres'])a.push(v['notepres']);
  return a.join(' · ');
}
const catVal=()=>catValFrom(S.v);
const presVal=()=>presValFrom(S.v);

/* ---------- Radar Chart SVG per i 5 Sapori ---------- */
function buildRadarChart(sapValues){
  const axes=[
    {k:'dolce',label:'Dolce'},
    {k:'acido',label:'Acido'},
    {k:'salato',label:'Salato'},
    {k:'amaro',label:'Amaro'},
    {k:'umami',label:'Umami'}
  ];
  const cx=115, cy=115, maxR=78;
  const angleStep=(Math.PI*2)/axes.length;
  const startAngle=-Math.PI/2;

  const pt=(val,idx)=>{
    const r=(val/5)*maxR;
    const a=startAngle+idx*angleStep;
    return [cx+r*Math.cos(a), cy+r*Math.sin(a)];
  };

  const webs=[1,2,3,4,5].map(lvl=>{
    const pts=axes.map((_,i)=>pt(lvl,i).map(n=>n.toFixed(1)).join(',')).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="var(--line)" stroke-width="${lvl===5?1.5:0.8}" stroke-dasharray="${lvl===5?'':'2,2'}"/>`;
  }).join('');

  const spokes=axes.map((ax,i)=>{
    const [x2,y2]=pt(5,i);
    const [lx,ly]=pt(6.15,i);
    const val=sapValues[ax.k];
    const abbr=val!==undefined?ABBR[['Non percettibile',...INT5][val]]:'–';
    return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
            <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="var(--ink)" font-size="11" font-weight="600">${ax.label} (${abbr})</text>`;
  }).join('');

  const dataPts=axes.map((ax,i)=>pt(sapValues[ax.k]||0,i));
  const polyStr=dataPts.map(p=>p.map(n=>n.toFixed(1)).join(',')).join(' ');
  const dots=dataPts.map((p,i)=>sapValues[axes[i].k]!==undefined
    ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="var(--accent)" stroke="var(--card)" stroke-width="1.5"/>`
    : '').join('');

  const svgWrap=document.createElement('div');
  svgWrap.className='radar-wrap';
  svgWrap.innerHTML=`
    <svg class="radar-svg" viewBox="0 0 230 230" role="img" aria-label="Grafico radar dei sapori">
      ${webs}
      ${spokes}
      <polygon points="${polyStr}" fill="var(--accent)" fill-opacity="0.28" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
      ${dots}
    </svg>
    <div class="radar-legend">
      ${axes.map(ax=>{
        const v=sapValues[ax.k];
        const txt=v===undefined?'Non valutato':['Non percettibile',...INT5][v];
        return `<div><span><b>${ax.label}</b></span><span style="color:var(--muted)">${txt}</span></div>`;
      }).join('')}
    </div>
  `;
  return svgWrap;
}

/* ---------- Fasi ---------- */
function makeCheeseFallbackSvg(ref){
  const title=ref?ref.nome:(get('denominazione','')||'Campione in degustazione');
  const sub=ref?`${ref.ric} · ${ref.regione}`:'Scheda Atlante Formaggi ONAF';
  const pasteCol=ref&&ref.pasta&&ref.pasta.toLowerCase().includes('bianco')?'#f7f3e8':'#f3d98b';
  const rindCol=ref&&ref.crosta&&ref.crosta.toLowerCase().includes('marrone')?'#7c5330':'#c89646';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 260" width="600" height="260">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f5efe4"/><stop offset="100%" stop-color="#e8dcc8"/></linearGradient>
    </defs>
    <rect width="600" height="260" fill="url(#bg)"/>
    <g transform="translate(85,48)">
      <path d="M20,95 L150,25 L235,80 L105,155 Z" fill="${rindCol}" opacity="0.85"/>
      <path d="M20,95 L105,155 L105,190 L20,130 Z" fill="${pasteCol}" stroke="${rindCol}" stroke-width="4"/>
      <path d="M105,155 L235,80 L235,115 L105,190 Z" fill="${pasteCol}" stroke="${rindCol}" stroke-width="4"/>
      <circle cx="62" cy="138" r="5" fill="${rindCol}" opacity="0.35"/>
      <circle cx="85" cy="158" r="3.5" fill="${rindCol}" opacity="0.35"/>
      <circle cx="148" cy="142" r="6" fill="${rindCol}" opacity="0.35"/>
      <circle cx="188" cy="116" r="4" fill="${rindCol}" opacity="0.35"/>
    </g>
    <text x="355" y="108" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#2b2622">${title.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>
    <text x="355" y="136" font-family="system-ui,sans-serif" font-size="14" font-weight="600" fill="#d9791a">${sub.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>
    <text x="355" y="164" font-family="system-ui,sans-serif" font-size="12" fill="#7a6f65">Riferimento visivo Atlante ONAF</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}

const AUTO_PHOTO_PENDING={};
function getCachedCheesePhoto(key){
  if(!key)return '';
  if(!DB.photoCache || typeof DB.photoCache!=='object') DB.photoCache={};
  return DB.photoCache[key] || '';
}

const ONAF_MARCHI_SEED={
  '236':'https://www.onaf.it/uploads/public/formaggi/1991_marchio-puzzone-di-moena-1-.jpg'
};
function getCachedMarchio(key,onafId){
  if(!DB.marchioCache || typeof DB.marchioCache!=='object') DB.marchioCache={};
  if(key && DB.marchioCache[key]) return DB.marchioCache[key];
  if(onafId && ONAF_MARCHI_SEED[String(onafId)]) return ONAF_MARCHI_SEED[String(onafId)];
  return '';
}
function setCachedMarchio(key,url){
  if(!key)return;
  if(!DB.marchioCache || typeof DB.marchioCache!=='object') DB.marchioCache={};
  if(url) DB.marchioCache[key]=url;
  else delete DB.marchioCache[key];
  persist();
}
function buildMarchioWidget(isSummary=false){
  const denom=get('denominazione','').trim();
  const ref=currentRef();
  const ric=get('riconoscimento','') || (ref?ref.ric:'');
  const lookupName=ref ? ref.nome : denom;
  const cacheKey=ref?('onaf:'+ref.onafId):cleanCheeseName(lookupName).toLowerCase();
  const customMarchio=get('marchio_url','');
  const resolvedUrl=customMarchio || getCachedMarchio(cacheKey, ref&&ref.onafId);

  if(isSummary && !resolvedUrl && !ric) return null;

  const fileInp=h('input',{type:'file',accept:'image/*',style:'display:none',onchange:e=>{
    const f=e.target.files[0];
    if(!f)return;
    const r=new FileReader();
    r.onload=()=>{
      const im=new Image();
      im.onload=()=>{
        const c=document.createElement('canvas');
        const maxH=360;
        const scale=Math.min(1,maxH/im.height);
        c.width=Math.round(im.width*scale);
        c.height=Math.round(im.height*scale);
        c.getContext('2d').drawImage(im,0,0,c.width,c.height);
        const dataUrl=c.toDataURL('image/png');
        set('marchio_url',dataUrl);
        if(cacheKey) setCachedMarchio(cacheKey,dataUrl);
      };
      im.src=r.result;
    };
    r.readAsDataURL(f);
  }});

  let visualEl;
  if(resolvedUrl){
    visualEl=h('img',{class:'marchio-img',src:resolvedUrl,alt:'Marchio '+(lookupName||ric)});
    visualEl.onerror=()=>{
      visualEl.replaceWith(h('div',{class:'marchio-seal'},ric||'MARCHIO',h('span',{style:'font-size:9px;font-weight:600'},'TUTELA')));
    };
  }else{
    visualEl=h('div',{class:'marchio-seal'},ric||'CONSORZIO',h('span',{style:'font-size:9px;font-weight:600'},ric==='DOP'||ric==='IGP'||ric==='STG'?'TUTELA UE':'MARCHIO'));
  }

  const titleTxt = resolvedUrl
    ? ('Marchio ufficiale · '+(lookupName||ric||'Consorzio'))
    : (ric ? ('Marchio / Consorzio di tutela ('+ric+')') : 'Marchio del Consorzio / Produttore');
  const subTxt = resolvedUrl
    ? (ref&&ref.regione ? ref.regione+' · Disciplinare '+ric : 'Emblema memorizzato per questo formaggio')
    : (ref&&ref.onafId ? 'Puoi incollare l’URL del marchio dalla scheda ONAF #'+ref.onafId : 'Incolla l’URL del marchio ONAF o carica il file immagine');

  return h('div',{class:'marchio-slot'},
    visualEl,
    h('div',{class:'marchio-info'},
      h('b',{},titleTxt),
      h('small',{},subTxt)
    ),
    !isSummary ? h('div',{class:'noprint',style:'display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end'},
      h('button',{type:'button',class:'btn sm',title:'Copia indirizzo immagine del marchio dalla pagina ONAF e incollalo qui',onclick:()=>{
        const u=prompt('Incolla l’URL del marchio copiato dalla scheda ONAF (es. https://www.onaf.it/uploads/public/formaggi/...):',resolvedUrl&&resolvedUrl.startsWith('http')?resolvedUrl:'');
        if(u!==null){
          const tr=u.trim();
          if(tr){
            set('marchio_url',tr);
            if(cacheKey) setCachedMarchio(cacheKey,tr);
            showToast('Marchio salvato e memorizzato per «'+(lookupName||'questo formaggio')+'»');
          }
        }
      }},resolvedUrl?'Cambia URL marchio':'+ URL marchio ONAF'),
      h('button',{type:'button',class:'btn sm',title:'Carica immagine marchio dal dispositivo',onclick:()=>fileInp.click()},'File'),
      (customMarchio || (cacheKey && DB.marchioCache && DB.marchioCache[cacheKey]))
        ? h('button',{type:'button',class:'btn sm danger',title:'Rimuovi marchio personalizzato',onclick:()=>{
            set('marchio_url',undefined,false);
            if(cacheKey) setCachedMarchio(cacheKey,'');
            render();
          }},'✕')
        : null,
      fileInp
    ) : null
  );
}

function setCachedCheesePhoto(key,url){
  if(!key)return;
  if(!DB.photoCache || typeof DB.photoCache!=='object') DB.photoCache={};
  DB.photoCache[key]=url;
  persist();
}
function isBadWikiThumb(url,pageimage){
  const s=((url||'')+' '+(pageimage||'')).toLowerCase();
  return !url || s.includes('.svg') || s.includes('map') || s.includes('mappa') || s.includes('flag') || s.includes('bandiera') || s.includes('coat_of_arms') || s.includes('stemma') || s.includes('logo') || s.includes('location') || s.includes('locator');
}
async function fetchAutoCheesePhoto(rawName,keyOverride){
  const clean=cleanCheeseName(rawName);
  if(!clean || clean.length<3)return;
  const key=keyOverride||clean.toLowerCase();
  if(AUTO_PHOTO_PENDING[key])return;
  if(getCachedCheesePhoto(key)!=='')return;
  AUTO_PHOTO_PENDING[key]=true;
  try{
    // 1. Ricerca su Wikipedia Italia (API pubblica con CORS origin=*)
    const wpUrl='https://it.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent(clean+' formaggio')+'&gsrlimit=4&prop=pageimages&piprop=thumbnail|name&pithumbsize=640&format=json&origin=*';
    const r1=await fetch(wpUrl);
    if(r1.ok){
      const d1=await r1.json();
      const pages=d1&&d1.query&&d1.query.pages ? Object.values(d1.query.pages).sort((a,b)=>(a.index||99)-(b.index||99)) : [];
      for(const p of pages){
        const src=p.thumbnail&&p.thumbnail.source;
        if(src && !isBadWikiThumb(src,p.pageimage)){
          setCachedCheesePhoto(key,src);
          render();
          return;
        }
      }
    }
    // 2. Fallback su Wikimedia Commons (immagini libere di formaggi italiani)
    const cmUrl='https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch='+encodeURIComponent(clean+' cheese OR formaggio')+'&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json&origin=*';
    const r2=await fetch(cmUrl);
    if(r2.ok){
      const d2=await r2.json();
      const pages=d2&&d2.query&&d2.query.pages ? Object.values(d2.query.pages).sort((a,b)=>(a.index||99)-(b.index||99)) : [];
      for(const p of pages){
        const ii=p.imageinfo&&p.imageinfo[0];
        const src=ii&&(ii.thumburl||ii.url);
        if(src && !isBadWikiThumb(src,p.title)){
          setCachedCheesePhoto(key,src);
          render();
          return;
        }
      }
    }
    // Segna 'NONE' per evitare richieste ripetute inutili nella stessa sessione
    setCachedCheesePhoto(key,'NONE');
  }catch(e){
    // Offline o rete non disponibile: mantiene silenziosamente l'illustrazione vettoriale
  }finally{
    delete AUTO_PHOTO_PENDING[key];
  }
}

function buildCheesePreviewCard(){
  const denom=get('denominazione','').trim();
  const ref=currentRef();
  const customImg=get('foto_campione','');
  const lookupName=ref ? ref.nome : denom;
  const cacheKey=ref?('onaf:'+ref.onafId):cleanCheeseName(lookupName).toLowerCase();
  const cachedUrl=getCachedCheesePhoto(cacheKey);
  const autoImg=(cachedUrl && cachedUrl!=='NONE') ? cachedUrl : '';

  if(!customImg && !autoImg && lookupName && cachedUrl!=='NONE'){
    fetchAutoCheesePhoto(lookupName,cacheKey);
  }

  const imgSrc=customImg || (ref && ref.img) || autoImg || makeCheeseFallbackSvg(ref);

  const fileInp=h('input',{type:'file',accept:'image/*',style:'display:none',onchange:e=>{
    const f=e.target.files[0];
    if(!f)return;
    const r=new FileReader();
    r.onload=()=>{
      // Ridimensiona leggermente per non appesantire localStorage
      const im=new Image();
      im.onload=()=>{
        const c=document.createElement('canvas');
        const maxW=640;
        const scale=Math.min(1,maxW/im.width);
        c.width=Math.round(im.width*scale);
        c.height=Math.round(im.height*scale);
        c.getContext('2d').drawImage(im,0,0,c.width,c.height);
        set('foto_campione',c.toDataURL('image/jpeg',0.82));
      };
      im.src=r.result;
    };
    r.readAsDataURL(f);
  }});

  const imgEl=h('img',{src:imgSrc,alt:ref?ref.nome:(denom||'Formaggio in degustazione')});
  imgEl.onerror=()=>{
    imgEl.onerror=null;
    if(!customImg && cacheKey) setCachedCheesePhoto(cacheKey,'NONE');
    imgEl.src=makeCheeseFallbackSvg(ref);
  };

  const capTitle=customImg
    ?(denom||'Foto del campione')
    :(ref?`${ref.nome} (${ref.ric})`:(denom||'Riferimento visivo Atlante ONAF'));
  const capSub=ref
    ?(ref.regione+' · '+ref.latte+(autoImg&&!customImg?' · Foto automatica':''))
    :(autoImg?'Foto automatica':'');
  const capLink=h('a',{href:'#',onclick:e=>{e.preventDefault();openOnafFor(ref||denom);}},ref&&ref.onafId?'Scheda ufficiale ONAF ↗':(ref?'Copia «'+cleanCheeseName(ref.nome)+'» e apri Atlante ↗':'Apri Atlante ONAF ↗'));

  return card('Immagine di riferimento (Atlante ONAF / Campione)',
    h('div',{class:'cheese-photo-box'},
      h('div',{class:'cheese-photo-frame'},
        imgEl,
        h('div',{class:'cheese-photo-cap'},
          h('div',{},h('b',{},capTitle),capSub?h('div',{style:'font-size:11px;opacity:.9'},capSub):null),
          capLink
        )
      ),
      ref&&ref.crosta?h('div',{class:'sub',style:'margin:0'},h('b',{},'Aspetto tipico ONAF: '),ref.crosta,' — ',ref.pasta):null,
      h('div',{class:'row noprint',style:'margin-top:2px;gap:6px;flex-wrap:wrap'},
        h('button',{type:'button',class:'btn sm',onclick:()=>fileInp.click()},customImg?'Cambia foto file':'+ Carica foto file'),
        h('button',{type:'button',class:'btn sm',title:'Copia indirizzo immagine dalla scheda ONAF e incollalo qui',onclick:()=>{
          const u=prompt('Incolla l’URL della foto copiata dalla pagina ONAF (tasto destro sulla foto → Copia indirizzo immagine):',customImg&&customImg.startsWith('http')?customImg:'');
          if(u!==null){
            const tr=u.trim();
            if(tr){
              set('foto_campione',tr);
              if(cacheKey) setCachedCheesePhoto(cacheKey,tr);
            }
          }
        }},'Incolla URL foto ONAF'),
        customImg?h('button',{type:'button',class:'btn sm danger',onclick:()=>set('foto_campione',undefined)},'Ripristina auto'):null,
        fileInp
      )
    )
  );
}


/* ---------- Motore Ibrido Abbinamenti Gastronomici & Birre ONAF ---------- */


function isIconicCheese(c){
  if(!c || !c.nome) return false;
  return ICONIC_BY_ID.has(c.onafId);
}

function computeCheesePairings(cheeseObj, liveV){
  const nome = (cheeseObj && cheeseObj.nome) || (liveV && liveV.denominazione) || '';
  const clean = cleanCheeseName(nome);
  const regList = (cheeseObj && cheeseObj.regioni) || [];
  const tax = (cheeseObj && cheeseObj.tax) || {};

  const tecArr = [...(tax.tecnologia||[]), ...((liveV && liveV['cat_Tecnologia lavorazione'])||[])];
  const pastaArr = [...(tax.pasta||[]), ...((liveV && liveV['cat_Consistenza pasta'])||[])];
  const stagArr = [...(tax.stagionatura||[]), ...((liveV && liveV['cat_Tempo stagionatura'])||[])];
  const crostaArr = [...(tax.crosta||[]), ...((liveV && liveV['aspetto'])||[])];
  const latteArr = [...(tax.latte||[]), ...((liveV && liveV['cat_Tipologia latte'])||[])];

  const isErborinato = tecArr.some(x=>/erborin/i.test(x)) || (liveV && liveV.erbor_p==='Presente');
  const isFilata = tecArr.some(x=>/filata/i.test(x));
  const isRicotta = tecArr.some(x=>/ricott/i.test(x));
  const isCrostaLavata = tecArr.some(x=>/lavata/i.test(x)) || crostaArr.some(x=>/lavata/i.test(x));
  const isFiorita = crostaArr.some(x=>/fiorita/i.test(x));
  const isAffumicato = tecArr.some(x=>/affumicat/i.test(x));

  const isDura = pastaArr.some(x=>/dura/i.test(x)) || stagArr.some(x=>/molto stagionato|stagionato/i.test(x));
  const isFreschissimo = pastaArr.some(x=>/cremosa|liquida|semiliquida/i.test(x)) || stagArr.some(x=>/freschissimo/i.test(x));
  const isMolle = pastaArr.some(x=>/molle/i.test(x)) || stagArr.some(x=>/^fresco$/i.test(x));
  const isPecoraCapra = latteArr.some(x=>/pecora|capra/i.test(x));

  const highSalato = liveV && liveV.s_salato !== undefined && liveV.s_salato >= 4;
  const highAcido = liveV && liveV.s_acido !== undefined && liveV.s_acido >= 3;
  const highPiccante = liveV && liveV.trig_p!=='Assente' && liveV.trig_r && Object.entries(liveV.trig_r).some(([k,v])=>/piccante/i.test(k) && v >= 2);
  const highPers = liveV && liveV.pers !== undefined && liveV.pers >= 3;

  const iconic = cheeseObj ? ICONIC_BY_ID.get(cheeseObj.onafId) : null;
  let base = iconic ? {...iconic, isIconic:true} : null;

  if(!base){
    if(isErborinato){
      base={
        categoria:'Erborinati (muffe interne)',
        principio:'Contrasto dolce e avvolgente alla sapidità, piccantezza e aromaticità delle muffe.',
        pane:'Pan brioche, pane alle noci e uvetta, pane di segale tostato.',
        dolce:'Miele di acacia o melata, confettura di fichi, cioccolato fondente ≥ 70%.',
        frutta:'Pere abate o Williams, fichi freschi, gherigli di noce.',
        verdure:'Sedano croccante, indivia belga, radicchio rosso o gnocchi.',
        vino:'Vino passito (es. Passito di Pantelleria, Recioto) o vino liquoroso / rosso evoluto.',
        birra:'Imperial Stout / Porter (note tostate e cacao) o Belgian Tripel / Quadrupel.'
      };
    }else if(isCrostaLavata){
      base={
        categoria:'Crosta lavata / aromatici intensi',
        principio:'Pulizia dell’untuosità e bilanciamento degli odori intensi e fermentati.',
        pane:'Pane di segale o ai cereali, polenta abbrustolita.',
        dolce:'Composta di cipolle rosse, mostarda di frutta, miele di melata.',
        frutta:'Mele acidule, pere, noci.',
        verdure:'Radicchio tardivo, patate lesse calde, crauti stufati.',
        vino:'Rosso di medio corpo e buona freschezza o bianco aromatico strutturato (es. Gewürztraminer).',
        birra:'Saison / Farmhouse Ale (secca e speziata, sgrassa il palato) o Bière de Garde.'
      };
    }else if(isFilata && (isFreschissimo || isMolle)){
      base={
        categoria:'Paste filate fresche',
        principio:'Esaltazione della succosità lattica e della dolcezza senza coprirne la finezza.',
        pane:'Pane casareccio a crosta croccante, focaccia neutra poco salata.',
        dolce:'Nessun miele intenso; ideale un filo di olio extravergine d’oliva fruttato leggero.',
        frutta:'Fichi fioroni, melone bianco.',
        verdure:'Pomodori maturi, basilico fresco, verdure grigliate.',
        vino:'Bianco fresco, sapido e non barricato o spumante Metodo Classico Brut.',
        birra:'Blanche / Witbier, Pilsner o Helles (fresche, pulite e poco amare).'
      };
    }else if(isRicotta){
      base={
        categoria:'Ricotte (fresche o stagionate)',
        principio: isDura ? 'Contrasto sapido-affumicato adatto a grattugia o scaglie.' : 'Delicatezza lattica e dolcezza naturale.',
        pane: isDura ? 'Pane casereccio tostato.' : 'Pane bianco morbido, fette biscottate artigianali.',
        dolce: isDura ? 'Miele di castagno o fichi caramellati.' : 'Miele millefiori o di agrumi, confettura di albicocche o amarene.',
        frutta: isDura ? 'Pere, noci.' : 'Frutti di bosco, fichi freschi, scorza d’arancia.',
        verdure: isDura ? 'Verdure amare, pasta al pomodoro o al forno.' : 'Zucchine, spinaci novelli, piselli.',
        vino: isDura ? 'Rosso territoriale di medio corpo.' : 'Bianco morbido o Moscato leggero (in versione dolce).',
        birra: isDura ? 'Amber Ale o Bock.' : 'Weizen / Weissbier o Blonde Ale delicata.'
      };
    }else if(isFiorita || isFreschissimo || (isMolle && !isDura)){
      base={
        categoria:'Freschi, cremosi e croste fiorite',
        principio:'Pulizia del palato dalla grassezza/acidità lattica con elementi croccanti e freschi.',
        pane:'Grissini stirati, pane bianco casereccio, crackers neutri.',
        dolce:'Miele di acacia, tiglio o agrumi; confetture delicate di albicocca o agrumi.',
        frutta:'Fragole, uva bianca, nocciole tostate.',
        verdure:'Ravanelli, sedano croccante, valeriana, asparagi.',
        vino:'Spumante Metodo Classico Brut o bianco giovane di buona acidità.',
        birra:'Blanche / Weizen o Berliner Weisse / Gose (acidità e bollicina pulente).'
      };
    }else if(isDura || highSalato || highPiccante){
      base={
        categoria:'Pasta dura / Stagionati e Piccanti',
        principio:'Contrasto dolce-fruttato alla sapidità, friabilità e piccantezza lipolitica.',
        pane: highSalato ? 'Pane sciapo (senza sale) o pane carasau croccante.' : 'Pane di campagna a lievitazione naturale, focaccia rustica.',
        dolce: isPecoraCapra ? 'Miele di castagno, corbezzolo o cardo; confettura di fichi.' : 'Mostarda di frutta, gocce di Aceto Balsamico Tradizionale, miele millefiori.',
        frutta:'Pere abate, fichi freschi, noci, mandorle tostate.',
        verdure:'Fave fresche, sedano bianco, carciofi crudi a lamelle.',
        vino:'Rosso strutturato e tannico (es. Barolo, Brunello, Cannonau Riserva) o vino passito.',
        birra:'Belgian Dubbel / Dark Strong Ale, Barley Wine o Doppelbock.'
      };
    }else{
      base={
        categoria:'Semiduri / Media stagionatura',
        principio:'Concordanza aromatica con le note di burro fuso, fieno e frutta secca.',
        pane:'Pane casereccio di grano duro o integrale, polenta.',
        dolce:'Miele di millefiori, tarassaco o castagno chiaro; composta di mele o pere.',
        frutta:'Mele renette, pere, noci, nocciole.',
        verdure:'Patate lesse, funghi trifolati, verdure grigliate.',
        vino:'Rosso di medio corpo (es. Barbera, Valpolicella, Chianti) o bianco strutturato.',
        birra:'Bock, Märzen / Festbier o Belgian Blond Ale.'
      };
    }
  }

  const liveNotes=[];
  if(highSalato) liveNotes.push('Sapidità elevata rilevata in scheda → privilegia pane senza sale, abbinamenti dolci (miele/fichi) e birre maltate poco luppolate (evita IPA troppo amare).');
  if(highPiccante) liveNotes.push('Piccantezza marcata rilevata → bilancia con miele di castagno/corbezzolo, frutta dolce o birre scure/avvolgenti (Stout, Quadrupel).');
  if(highAcido) liveNotes.push('Acidità spiccata rilevata → evita confetture troppo acidule; ottima concordanza con Blanche, Weizen o Sour/Gose.');
  if(isAffumicato) liveNotes.push('Nota affumicata → eccellente con Rauchbier, Porter o vini rossi morbidi e speziati.');
  if(highPers && !base.isIconic) liveNotes.push('Persistenza gusto-olfattiva elevata → richiede vini strutturati o birre ad alta gradazione/complessità.');

  const terrList = regList.map(r=>TERRITORY_PAIRINGS[r]?`${r}: ${TERRITORY_PAIRINGS[r]}`:'').filter(Boolean);

  return {
    ...base,
    liveNotes,
    territorio: terrList.join(' | ')
  };
}

function openPairingModal(cheeseObj){
  const existing=document.getElementById('pairing-modal-root');
  if(existing) existing.remove();
  const p=computeCheesePairings(cheeseObj, null);
  const overlay=document.createElement('div');
  overlay.id='pairing-modal-root';
  overlay.className='gloss-modal-bg';
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove();};
  const closeBtn=h('button',{type:'button',class:'btn sm',onclick:()=>overlay.remove()},'Chiudi ✕');
  const tasteBtn=h('button',{type:'button',class:'btn sm primary',onclick:()=>{
    overlay.remove();
    startTastingFromAtlas(cheeseObj);
  }},'Degusta e registra abbinamento');
  const box=(lbl,txt)=>h('div',{style:'background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:8px 10px'},
    h('b',{style:'color:var(--accent);display:block;font-size:11px;text-transform:uppercase;margin-bottom:2px'},lbl),
    txt
  );
  overlay.append(
    h('div',{class:'gloss-modal',role:'dialog','aria-modal':'true',style:'max-width:620px;max-height:90vh;overflow-y:auto'},
      h('div',{class:'gloss-modal-hdr'},
        h('div',{},
          h('span',{class:'gloss-area-pill'},p.isIconic ? '★ Abbinamento d’Autore ONAF' : ('Motore Abbinamenti · '+(p.categoria||'Profilo sensoriale'))),
          h('h4',{},cheeseObj.nome,' ',h('span',{class:'ric-pill ric-'+cheeseObj.ric,style:'vertical-align:middle'},cheeseObj.ric))
        ),
        closeBtn
      ),
      (()=>{
        const sel=h('select',{class:'sel-cmp',style:'min-height:34px;font-size:13px;margin-bottom:8px',onchange:e=>{
          const target=atlasById(e.target.value);
          if(target) openPairingModal(target);
        }},
          h('option',{value:''},'Esplora una delle '+ICONIC_BY_ID.size+' Schede d’Autore ONAF...'),
          ...[...ICONIC_BY_ID.keys()].map(id=>{
            const found=atlasById(id);
            return found ? h('option',{value:found.onafId},`★ ${found.nome} (${found.ric} · ${found.regione})`) : null;
          }).filter(Boolean)
        );
        if(p.isIconic) sel.value=String(cheeseObj.onafId);
        return sel;
      })(),
      h('div',{class:'sub',style:'margin-bottom:10px'},h('b',{},'Principio gastronomico: '),p.principio),
      h('div',{style:'display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13.5px'},
        box('Pane & Sostegno',p.pane),
        box('Mieli, Confetture & Salse',p.dolce),
        box('Frutta Fresca & Secca',p.frutta),
        box('Verdure & Uso in Cucina',p.verdure),
        box('Vino Consigliato',p.vino),
        box('Birra Artigianale',p.birra)
      ),
      p.territorio ? h('div',{style:'background:var(--accent-soft);border:1px solid var(--accent);border-radius:9px;padding:8px 10px;margin-top:8px;font-size:13.5px'},
        h('b',{style:'color:var(--accent);display:block;font-size:11px;text-transform:uppercase;margin-bottom:2px'},'Legame Territoriale ('+cheeseObj.regione+')'),
        p.territorio
      ) : null,
      h('div',{class:'row',style:'justify-content:flex-end;margin-top:12px'},tasteBtn)
    )
  );
  document.body.append(overlay);
}


function buildLivePairingCard(){
  const denom=get('denominazione','').trim();
  const ref=currentRef();
  const sugg=computeCheesePairings(ref, S.v);

  const selItems=get('abb_items',[]);
  const customInp=h('input',{type:'text',id:'f_abb_custom','data-fk':'abb_custom',placeholder:'Aggiungi abbinamento specifico (es. Barolo 2019, Belgian Dubbel, Miele di tarassaco...)',value:get('abb_custom',''),oninput:e=>set('abb_custom',e.target.value,false)});

  return card('5.2 Abbinamenti Gastronomici, Vini & Birre (Suggeriti & Provati)',
    h('div',{class:'atlas-box',style:'margin-top:0;margin-bottom:10px'},
      h('div',{class:'atlas-hdr'},
        h('b',{style:'font-size:13px'},sugg.isIconic ? `Suggerimenti d’Autore per ${ref.nome}` : 'Suggerimenti dal Profilo Sensoriale'),
        h('span',{class:'atlas-badge'},sugg.isIconic ? 'Disciplinare & Tradizione' : (sugg.categoria||'Dinamico'))
      ),
      h('div',{style:'font-size:13px;margin-bottom:6px'},h('b',{},'Logica: '),sugg.principio),
      h('div',{class:'atlas-grid'},
        h('div',{class:'atlas-item'},h('b',{},'Pane & Sostegno'),sugg.pane),
        h('div',{class:'atlas-item'},h('b',{},'Mieli, Confetture & Salse'),sugg.dolce),
        h('div',{class:'atlas-item'},h('b',{},'Frutta Fresca & Secca'),sugg.frutta),
        h('div',{class:'atlas-item'},h('b',{},'Verdure & Cucina'),sugg.verdure),
        h('div',{class:'atlas-item'},h('b',{},'Vino Consigliato'),sugg.vino),
        h('div',{class:'atlas-item'},h('b',{},'Birra Artigianale'),sugg.birra)
      ),
      sugg.liveNotes.length ? h('div',{class:'atlas-match'},
        sugg.liveNotes.map(n=>h('div',{style:'color:var(--accent);font-weight:600;margin-top:2px'},'• '+n))
      ) : null,
      sugg.territorio ? h('div',{class:'sub',style:'margin-top:6px;padding-top:6px;border-top:1px dashed var(--line)'},h('b',{},'Territorio: '),sugg.territorio) : null
    ),
    sub('Registra cosa hai abbinato in degustazione (facoltativo)'),
    Object.entries(PAIRING_CHIPS).map(([grp,opts])=>[
      sub(grp),
      chips(opts,selItems,o=>toggleMulti('abb_items',o),true)
    ]),
    h('div',{style:'margin-top:8px'},
      h('label',{class:'f',for:'f_abb_custom'},'Dettaglio abbinamento / vino / birra / piatto'),
      customInp
    ),
    (selItems.length || get('abb_custom','')) ? [
      sub('Armonia dell’abbinamento provato'),
      scale(INT5,get('abb_armonia'),i=>set('abb_armonia',i),['Squilibrato / coprente','Poco armonico','Buona corrispondenza','Molto armonico','Eccellente sinergia'])
    ] : null
  );
}

const PHASES=[
 {id:'id',nome:'Campione',build:()=>[
   h('div',{style:'display:grid;gap:12px'},
     card('Degustazione',h('div',{class:'grid2'},textInput('data','Data',true,'date'),textInput('luogo','Località / Luogo')),h('div',{class:'grid2',style:'margin-top:6px'},textInput('commissione','Commissione'),textInput('assaggiatore','Nome assaggiatore'))),
     buildCheesePreviewCard()
   ),
   card('Formaggio',
     h('div',{class:'grid2'},
       h('div',{},h('label',{class:'f',for:'f_denominazione'},'Denominazione',h('i',{},' *')),
         // Il ridisegno parte in differita e solo se il nome è cambiato: così non «mangia» il tocco successivo
         h('input',{type:'text',id:'f_denominazione','data-fk':'denominazione',value:get('denominazione',''),autocomplete:'off',
           onfocus:e=>{e.target._v0=e.target.value;},
           oninput:e=>set('denominazione',e.target.value,false),
           onblur:e=>{if(e.target.value!==e.target._v0)setTimeout(()=>{if(S&&VIEW==='sheet')render();},200);}})),
       textInput('campione','Campione (codice)')),
     h('div',{class:'grid2',style:'margin-top:6px'},
       h('div',{},sub('Riconoscimento'),chips(L.riconoscimento,get('riconoscimento'),o=>pickOne('riconoscimento',o))),
       textInput('variante','Variante / tipologia')),
     buildMarchioWidget(false),
     h('div',{class:'row',style:'margin-top:8px;padding-top:6px;border-top:1px solid var(--line)'},
       h('span',{class:'sub',style:'margin:0'},'Confronta con il disciplinare / scheda tecnica ufficiale:'),
       h('button',{type:'button',class:'btn sm',onclick:copyAndOpenOnaf},'Atlante Formaggi ONAF ↗'))),
   card('Categoria *',
     pendingCat().length?h('div',{class:'miss no-gloss',style:'margin-bottom:8px'},
       h('b',{},'Dati da riconciliare con il campione. '),
       'Le voci segnalate arrivano dall’Atlante e riportano tutte le varianti ammesse per la denominazione, non il campione in esame: togli quelle che non valgono oppure conferma.'):null,
     catPick(),
     h('label',{class:'f',for:'f_categoria'},'Altro / precisazioni'),h('input',{type:'text',id:'f_categoria','data-fk':'categoria',value:get('categoria',''),oninput:e=>set('categoria',e.target.value,false)})),
   card('Note di presentazione *',groupPick('pres_',PRES,['Accompagnamenti','Anomalie']),
     h('div',{class:'grid2',style:'margin-top:6px'},
       textInput('pres_origine','Produttore, lotto, stagionatura (mesi)'),
       textInput('notepres','Altre note')))]},
 {id:'vista',nome:'1 · Aspetto esterno',build:()=>[
   card('1.1 Forma',chips(L.forma,get('forma'),o=>pickOne('forma',o)),h('div',{class:'row',style:'margin-top:8px'},h('span',{class:'sub',style:'margin:0'},'Regolarità'),seg(['Regolare','Irregolare'],get('forma_r'),o=>pickOne('forma_r',o)))),
   card('1.2 Facce & 1.3 Scalzo',
     sub('1.2 Facce'),chips(L.facce,get('facce',[]),o=>toggleMulti('facce',o),true),
     h('div',{class:'row',style:'margin-top:6px'},h('span',{class:'sub',style:'margin:0'},'Regolarità facce'),seg(['Regolare','Irregolare'],get('facce_r'),o=>pickOne('facce_r',o))),
     sub('1.3 Scalzo'),chips(L.scalzo,get('scalzo',[]),o=>toggleMulti('scalzo',o),true),
     h('div',{class:'row',style:'margin-top:6px'},h('span',{class:'sub',style:'margin:0'},'Regolarità scalzo'),seg(['Regolare','Irregolare'],get('scalzo_r'),o=>pickOne('scalzo_r',o)))),
   card('1.4 Superficie · tipologia',chips(L.tipsup,get('tipsup'),o=>pickOne('tipsup',o))),
   card('1.5 Aspetto della superficie',grouped('aspetto',L.aspetto)),
   card('1.6 Colore della superficie',chips(L.colore,get('colsup',[]),o=>toggleMulti('colsup',o),true),
     h('div',{class:'row',style:'margin-top:8px'},seg(['Uniforme','Non uniforme'],get('colsup_u'),o=>pickOne('colsup_u',o)),seg(['Carico','Scarico'],get('colsup_i'),o=>pickOne('colsup_i',o)))),
   card('Note aspetto esterno',noteBox('note_vista'))]},
 {id:'pasta',nome:'2 · Aspetto interno',build:()=>[
   card('2.1 Colore della pasta',chips(L.colore,get('colpasta',[]),o=>toggleMulti('colpasta',o),true),
     h('div',{class:'row',style:'margin-top:8px'},seg(['Uniforme','Non uniforme'],get('colpasta_u'),o=>pickOne('colpasta_u',o)),seg(['Carico','Scarico'],get('colpasta_i'),o=>pickOne('colpasta_i',o)))),
   card('2.2 Sottocrosta',presence('sottocrosta',()=>chips(['Sottile','Medio','Spesso'],get('sottocrosta'),o=>pickOne('sottocrosta',o)))),
   card('2.3 Occhiatura (alveoli)',presence('occhiatura',()=>grouped('occhiatura',L.occhiatura))),
   card('2.4 Erborinatura',presence('erbor',()=>grouped('erbor',L.erbor))),
   card('2.5 Elementi di discontinuità',presence('discont',()=>[sub('Elementi'),chips(L.discont,get('discont',[]),o=>toggleMulti('discont',o),true),
     h('div',{class:'grid2'},
       h('div',{},sub('Dimensione'),chips(L.dim,get('discont_d'),o=>pickOne('discont_d',o))),
       h('div',{},sub('Distribuzione'),chips(L.distr,get('discont_s'),o=>pickOne('discont_s',o))))],['Assenti','Presenti'])),
   card('2.6 Struttura della pasta (vista/tatto)',grouped('strpasta',L.strpasta)),
   card('Note aspetto interno',noteBox('note_pasta'))]},
 {id:'olfatto',nome:'3 · Esame olfattivo',build:()=>[
   card('3.1 Odori (via diretta)',
     sub('Intensità complessiva'),scale(INT5,get('odori_int'),i=>set('odori_int',i)),
     sub('Descrittori olfattivi'),treePicker('odori')),
   card('Note sugli odori',noteBox('note_odori'))]},
 {id:'gusto',nome:'4 · Esame gustativo',build:()=>[
   card('4.1 Sapori',...['dolce','acido','salato','amaro','umami'].map(s=>h('div',{class:'sapore'},h('b',{},s[0].toUpperCase()+s.slice(1)),
     scale(['Non percettibile',...INT5],get('s_'+s),i=>set('s_'+s,i),null,true)))),
   card('4.2 Aromi (via retronasale)',
     get('odori_items',[]).length?h('div',{class:'row'},h('span',{class:'sub',style:'margin:0'},'Hai già selezionato '+get('odori_items',[]).length+' odori.'),
       h('button',{type:'button',class:'btn sm',onclick:()=>{
         const cur=get('aromi_items',[]);
         const merged=[...cur];
         get('odori_items',[]).forEach(o=>{if(!merged.some(m=>m.f===o.f&&m.s===o.s&&m.r===o.r))merged.push({...o});});
         set('aromi_items',merged);
       }},'Copia descrittori dagli odori')):null,
     sub('Intensità complessiva'),scale(INT5,get('aromi_int'),i=>set('aromi_int',i)),
     sub('Descrittori aromatici'),treePicker('aromi')),
   card('4.3 Sensazioni trigeminali',presence('trig',()=>ratingList('trig_r',L.trig))),
   card('4.4 Struttura in bocca',ratingList('strbocca_r',L.strInt),
     sub('Altri descrittori (senza intensità)'),
     chips(L.strAltri,get('strbocca_o',[]),o=>toggleMulti('strbocca_o',o),true)),
   card('Note esame gustativo',noteBox('note_gusto'))]},
 {id:'bocca',nome:'5 · Sensazioni finali',build:()=>[
   card('5.1 Persistenza gusto-olfattiva',
     h('div',{class:'sub'},'Permanenza delle percezioni dopo la deglutizione.'),
     scale(L.pers,get('pers'),i=>set('pers',i),L.persHint)),
   buildLivePairingCard(),
   card('Note finali',noteBox('note_bocca'))]},
 {id:'sintesi',nome:'Sintesi',build:()=>buildSummary()}
];

/* ---------- Sintesi ---------- */
const join=a=>Array.isArray(a)?a.join(', '):a;
function pres(k,vals){const p=get(k+'_p');if(p==='Assente'||p==='Assenti')return p;if(p==='Presente'||p==='Presenti')return vals.filter(Boolean).join(' · ')||p;return '';}
function rows(){
  const tree=k=>get(k+'_items',[]).map(it=>[it.f,it.s,it.r].filter(Boolean).join(' › ')).join('; ');
  const lv=(l,i)=>i===undefined?'':l[i];
  const rl=k=>Object.entries(get(k,{})).map(([o,i])=>split(o)[0]+': '+INT5[i]).join('; ');
  const reg=(k)=>[join(get(k)),get(k+'_r')].filter(Boolean).join(' · ');
  return [
   ['1 · Aspetto esterno',[
     ['1.1 Forma',reg('forma')],['1.2 Facce',reg('facce')],['1.3 Scalzo',reg('scalzo')],['1.4 Superficie',join([get('tipsup')].filter(Boolean))],
     ['1.5 Aspetto',join(get('aspetto',[]))],['1.6 Colore',[join(get('colsup',[])),get('colsup_u'),get('colsup_i')].filter(Boolean).join(' · ')]]],
   ['2 · Aspetto interno',[
     ['2.1 Colore',[join(get('colpasta',[])),get('colpasta_u'),get('colpasta_i')].filter(Boolean).join(' · ')],['2.2 Sottocrosta',pres('sottocrosta',[get('sottocrosta')])],
     ['2.3 Occhiatura',pres('occhiatura',[join(get('occhiatura',[]))])],['2.4 Erborinatura',pres('erbor',[join(get('erbor',[]))])],
     ['2.5 Discontinuità',pres('discont',[join(get('discont',[])),get('discont_d'),get('discont_s')])],
     ['2.6 Struttura',join(get('strpasta',[]))]]],
   ['3 · Esame olfattivo',[['3.1 Odori · intensità',lv(INT5,get('odori_int'))],['3.1 Odori · descrittori',tree('odori')]]],
   ['4 · Esame gustativo',[['4.2 Aromi',[lv(INT5,get('aromi_int')),tree('aromi')].filter(Boolean).join(' — ')],
     ['4.3 Trigeminali',pres('trig',[rl('trig_r')])],
     ['4.4 Struttura',[rl('strbocca_r'),join(get('strbocca_o',[]).map(o=>split(o)[0]))].filter(Boolean).join(' — ')]]],
   ['5 · Sensazioni finali',[
     ['5.1 Persistenza',get('pers')===undefined?'':L.pers[get('pers')]+' ('+L.persHint[get('pers')]+')'],
     ['5.2 Abbinamenti provati',[join(get('abb_items',[])),get('abb_custom','')].filter(Boolean).join(' · ')],
     ['5.2 Armonia abbinamento',get('abb_armonia')===undefined?'':INT5[get('abb_armonia')]]
   ]],
   ['Note',[['1 · Aspetto esterno',get('note_vista','')],['2 · Aspetto interno',get('note_pasta','')],['3 · Odori',get('note_odori','')],['4 · Esame gustativo',get('note_gusto','')],['5 · Sensazioni finali',get('note_bocca','')]]]
  ];
}
function getMissingEssential(){
  const miss=[];
  if(!get('denominazione'))miss.push({label:'Denominazione (Campione)',step:0});
  if(!catVal())miss.push({label:'Categoria (Campione)',step:0});
  if(pendingCat().length)miss.push({label:'Categoria da riconciliare con il campione ('+pendingCat().length+')',step:0});
  if(!presVal())miss.push({label:'Note di presentazione (Campione)',step:0});
  if(!['forma','facce','scalzo','tipsup','aspetto','colsup'].some(hasAny))miss.push({label:'1 · Aspetto esterno',step:1});
  if(!['colpasta','sottocrosta_p','occhiatura_p','erbor_p','discont_p','strpasta'].some(hasAny))miss.push({label:'2 · Aspetto interno',step:2});
  if(!hasAny('odori_int')&&!hasAny('odori_items'))miss.push({label:'3 · Esame olfattivo',step:3});
  if(!['dolce','acido','salato','amaro','umami'].some(s=>hasAny('s_'+s)))miss.push({label:'4.1 Sapori',step:4});
  if(!hasAny('aromi_int')&&!hasAny('aromi_items'))miss.push({label:'4.2 Aromi',step:4});
  if(!hasAny('strbocca_r')&&!hasAny('strbocca_o'))miss.push({label:'4.4 Struttura in bocca',step:4});
  if(get('pers')===undefined)miss.push({label:'5.1 Persistenza gusto-olfattiva',step:5});
  return miss;
}
function showToast(msg){
  const t=document.getElementById('toast');
  if(!t)return;
  t.textContent=msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm=setTimeout(()=>t.classList.remove('show'),3500);
}
function cleanCheeseName(raw){
  return (raw||'').split(' (')[0].trim();
}
function onafAtlasUrl(){
  return 'https://www.onaf.it/formaggi';
}
const _refOf=x=>(x&&typeof x==='object')?x:findAtlasMatch(x);
const _nameOf=x=>(x&&typeof x==='object')?x.nome:(x||'');
function onafDeepSearchUrl(rawName){
  const item=_refOf(rawName);
  if(item && item.onafId){
    return 'https://www.onaf.it/index.php?c=index&a=schedaformaggio&id='+item.onafId;
  }
  const clean=cleanCheeseName(_nameOf(rawName));
  if(!clean)return onafAtlasUrl();
  return 'https://www.google.com/search?q='+encodeURIComponent('site:onaf.it "'+clean+'" schedaformaggio');
}
function openOnafFor(rawName){
  const item=_refOf(rawName);
  if(item && item.onafId){
    window.open('https://www.onaf.it/index.php?c=index&a=schedaformaggio&id='+item.onafId,'onaf_atlante','noopener');
    return;
  }
  const clean=cleanCheeseName(_nameOf(rawName));
  if(clean){
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(clean).catch(()=>{});
    }
    showToast('«'+clean+'» copiato! Incollalo (Ctrl+V) nella ricerca Atlante ONAF');
  }
  window.open(onafAtlasUrl(),'onaf_atlante','noopener');
}
function copyAndOpenOnaf(){
  openOnafFor(get('denominazione',''));
}
/* ---------- Archivio Schede Tecniche Atlante ONAF (Profili Ufficiali DOP/IGP/STG) ---------- */
function getFullAtlas(){
  return ONAF_ATLAS;
}
// Formaggio di riferimento della scheda aperta: scelta esplicita (ID ONAF) oppure nome digitato
function currentRef(){
  const id=S&&S.v?S.v.rif_onaf:null;
  return (id&&atlasById(id))||findAtlasMatch(get('denominazione','').trim());
}

function findAtlasMatch(name){
  const q=(name||'').trim().toLowerCase();
  if(!q)return null;
  if(q.length<3)return null;
  const exact=ONAF_ATLAS.find(a=>a.nome.toLowerCase()===q) || ONAF_ATLAS.find(a=>cleanCheeseName(a.nome).toLowerCase()===q);
  if(exact)return exact;
  // Nome dell'Atlante seguito da precisazioni (es. «Gorgonzola piccante»): vince il nome più lungo.
  // Nessuna ricerca per sottostringa: «cabrales» non deve diventare «Bra».
  let best=null,bestLen=0;
  for(const a of ONAF_ATLAS){
    const n=cleanCheeseName(a.nome).toLowerCase();
    if(n.length>=3 && n.length>bestLen && q.startsWith(n+' ')){best=a;bestLen=n.length;}
  }
  return best;
}

function buildAtlasCompareCard(){
  const denom=get('denominazione','').trim();
  let ref=currentRef();

  const sel=h('select',{class:'sel-cmp',onchange:e=>{S.v.rif_onaf=e.target.value?Number(e.target.value):undefined;save();render();}},
    h('option',{value:''},'-- Seleziona una scheda dell\'Atlante ONAF --'),
    getFullAtlas().map(a=>h('option',{value:a.onafId,selected:ref===a},`${a.nome} (${a.ric}) · ${a.regione}`))
  );

  const out=[
    h('div',{class:'row noprint'},
      h('span',{class:'sub',style:'margin:0'},'Confronta tutta la tua scheda (Aspetto, Olfatto e Gusto-Olfatto) con l\'Atlante ONAF:'),
      h('button',{type:'button',class:'btn sm',onclick:copyAndOpenOnaf},'Apri Atlante completo ('+ONAF_ATLAS.length+' formaggi) ↗')
    ),
    sel
  ];

  if(ref && !ref.detailed){
    out.push(h('div',{class:'atlas-box'},
      h('div',{class:'atlas-hdr'},
        h('div',{},h('b',{style:'font-size:15px'},ref.nome),' ',h('span',{class:'atlas-badge'},ref.ric),' ',h('small',{style:'color:var(--muted)'},ref.regione,' · Scheda ufficiale ONAF #',ref.onafId)),
        h('div',{style:'display:flex;gap:10px;align-items:center'},
          h('button',{type:'button',class:'btn sm primary',onclick:()=>openOnafFor(ref)},'Apri scheda ufficiale su onaf.it ↗')
        )
      ),
      h('div',{class:'sub',style:'margin-top:4px'},'Questo formaggio fa parte del catalogo ufficiale ONAF (ID #'+ref.onafId+'). Clicca sul pulsante qui sopra per aprire direttamente la scheda tecnica originale sul portale ONAF senza dati ricostruiti.')
    ));
  }else if(ref){
    // 1. Raccolta descrittori visivi dell'utente (esterno + interno)
    const userVisTokens=[
      get('forma'), ...(get('facce',[])), ...(get('scalzo',[])),
      get('tipsup')?split(get('tipsup'))[0]:null,
      ...(get('aspetto',[])), ...(get('colsup',[])),
      ...(get('colpasta',[])), ...(get('erbor',[])), ...(get('discont',[])),
      ...(get('strpasta',[]).map(o=>split(o)[0]))
    ].filter(Boolean);
    const userVisUnique=[...new Set(userVisTokens)];
    const refVisAll=[...(ref.formaKeys||[]), ...(ref.crostaKeys||[]), ...(ref.pastaKeys||[])];
    const visMatched=userVisUnique.filter(u=>refVisAll.some(rk=>rk.toLowerCase()===u.toLowerCase() || rk.toLowerCase().includes(u.toLowerCase())));

    const userVisText=[
      get('forma')?`Forma: ${get('forma')}`:'',
      get('tipsup')?`Sup.: ${split(get('tipsup'))[0]}`:'',
      get('aspetto',[]).length?`Aspetto: ${get('aspetto',[]).join(', ')}`:'',
      get('colsup',[]).length?`Col. est.: ${get('colsup',[]).join(', ')}`:'',
      get('colpasta',[]).length?`Col. pasta: ${get('colpasta',[]).join(', ')}`:'',
      get('strpasta',[]).length?`Str. pasta: ${get('strpasta',[]).map(o=>split(o)[0]).join(', ')}`:'',
      get('note_vista')?`Note est.: «${get('note_vista')}»`:'',
      get('note_pasta')?`Note int.: «${get('note_pasta')}»`:''
    ].filter(Boolean).join(' · ') || 'Non ancora compilata';

    // 2. Raccolta annotazione OLFATTIVA dell'utente (3.1 Odori + note_odori)
    const userOdList=get('odori_items',[]).map(i=>i.r||i.s);
    const userOdUnique=[...new Set(userOdList)];
    const odMatched=userOdUnique.filter(u=>ref.odori.some(ro=>ro.toLowerCase().includes(u.toLowerCase())||u.toLowerCase().includes(ro.toLowerCase())));
    const odExtra=userOdUnique.filter(u=>!odMatched.includes(u));
    const userOdText=[
      get('odori_int')!==undefined?`Intensità ${INT5[get('odori_int')]}`:'',
      userOdUnique.length?userOdUnique.join(', '):'',
      get('note_odori')?`Note: «${get('note_odori')}»`:''
    ].filter(Boolean).join(' — ') || 'Non ancora compilata';

    // 3. Raccolta annotazione GUSTO-OLFATTIVA dell'utente (4.1 Sapori + 4.2 Aromi + 4.3/4.4 + 5.1 Persistenza + note)
    const userArList=get('aromi_items',[]).map(i=>i.r||i.s);
    const userArUnique=[...new Set(userArList)];
    const arMatched=userArUnique.filter(u=>ref.odori.some(ro=>ro.toLowerCase().includes(u.toLowerCase())||u.toLowerCase().includes(ro.toLowerCase())));
    const arExtra=userArUnique.filter(u=>!arMatched.includes(u));

    const sapNames=['dolce','acido','salato','amaro','umami'];
    const userSapPairs=sapNames
      .filter(s=>get('s_'+s)!==undefined)
      .map(s=>`${s[0].toUpperCase()+s.slice(1)}: ${ABBR[['Non percettibile',...INT5][get('s_'+s)]]}`);
    const refSapPairs=Object.entries(ref.sapori)
      .filter(([_,v])=>v>0)
      .map(([k,v])=>`${k[0].toUpperCase()+k.slice(1)}: ${ABBR[['Non percettibile',...INT5][v]]}`);

    // Confronto intensità sapori (differenza <= 1 livello = coerente)
    const sapCoherent=sapNames.filter(s=>{
      const uv=get('s_'+s);
      const rv=ref.sapori[s];
      return uv!==undefined && rv!==undefined && Math.abs(uv-rv)<=1;
    }).map(s=>s[0].toUpperCase()+s.slice(1));

    const userStrTokens=[
      ...Object.keys(get('strbocca_r',{})).map(k=>split(k)[0]),
      ...get('strbocca_o',[]).map(o=>split(o)[0]),
      ...Object.keys(get('trig_r',{})).map(k=>split(k)[0])
    ];
    const strMatched=[...new Set(userStrTokens)].filter(u=>(ref.strKeys||[]).some(rk=>rk.toLowerCase()===u.toLowerCase()));

    const userPers=get('pers')!==undefined ? `${L.pers[get('pers')]} (${L.persHint[get('pers')]})` : '';
    const persDiff=(get('pers')!==undefined && ref.persIdx!==undefined) ? Math.abs(get('pers')-ref.persIdx) : null;

    const userGustoNotes=[get('note_gusto'),get('note_bocca')].filter(Boolean).join(' / ');

    out.push(h('div',{class:'atlas-box'},
      h('div',{class:'atlas-hdr'},
        h('div',{},h('b',{style:'font-size:15px'},ref.nome),' ',h('span',{class:'atlas-badge'},ref.ric),' ',h('small',{style:'color:var(--muted)'},ref.regione,' · ',ref.latte)),
        h('div',{style:'display:flex;gap:10px;align-items:center'},
          h('button',{type:'button',class:'btn sm',onclick:()=>openOnafFor(ref)},'Copia «'+cleanCheeseName(ref.nome)+'» e apri Atlante ↗'),
          h('a',{href:onafDeepSearchUrl(ref),target:'_blank',rel:'noopener',class:'link noprint'},'Trova scheda diretta ↗')
        )
      ),
      (ref.fonte&&ref.fonte.profilo&&ref.fonte.profilo!=='ONAF')
        ? h('div',{class:'sub no-gloss',style:'margin:4px 0 0'},'Fonte del profilo sensoriale di riferimento: '+ref.fonte.profilo+'.')
        : null,
      h('table',{class:'cmp-table'},
        h('thead',{},h('tr',{},
          h('th',{style:'width:22%'},'Sezione'),
          h('th',{style:'width:39%'},'Descrizione ufficiale Atlante ONAF'),
          h('th',{style:'width:39%;color:var(--accent)'},'La tua descrizione / annotazione')
        )),
        h('tbody',{},
          // RIGA 1: DESCRIZIONE VISIVA (ESTERNO + INTERNO)
          h('tr',{},
            h('th',{},'1–2 · Descrizione visiva e strutturale'),
            h('td',{},
              h('div',{},h('b',{},'Forma: '),ref.forma),
              h('div',{style:'margin-top:3px'},h('b',{},'Crosta: '),ref.crosta),
              h('div',{style:'margin-top:3px'},h('b',{},'Pasta: '),ref.pasta)
            ),
            h('td',{},
              h('div',{},userVisText),
              visMatched.length
                ? h('div',{style:'margin-top:5px'},visMatched.map(d=>h('span',{class:'tag-ok'},'✓ '+d)))
                : null
            )
          ),
          // RIGA 2: ANNOTAZIONE OLFATTIVA
          h('tr',{},
            h('th',{},'3 · Annotazione olfattiva (via diretta)'),
            h('td',{},
              h('div',{},h('b',{},'Famiglie / Note tipiche: '),ref.odori.join(', '))
            ),
            h('td',{},
              h('div',{},userOdText),
              userOdUnique.length
                ? h('div',{style:'margin-top:5px'},
                    odMatched.map(d=>h('span',{class:'tag-ok'},'✓ '+d)),
                    odExtra.map(d=>h('span',{class:'tag-diff'},d))
                  )
                : null
            )
          ),
          // RIGA 3: ANNOTAZIONE GUSTO-OLFATTIVA (SAPORI + AROMI + STRUTTURA + PERSISTENZA)
          h('tr',{},
            h('th',{},'4–5 · Annotazione gusto-olfattiva'),
            h('td',{},
              h('div',{},h('b',{},'Sapori attesi: '),refSapPairs.join(', ')),
              h('div',{style:'margin-top:3px'},h('b',{},'Aromi retronasali: '),ref.odori.join(', ')),
              h('div',{style:'margin-top:3px'},h('b',{},'Struttura: '),ref.struttura),
              h('div',{style:'margin-top:3px'},h('b',{},'Persistenza: '),ref.persistenza)
            ),
            h('td',{},
              h('div',{},h('b',{},'Sapori: '),userSapPairs.length?userSapPairs.join(', '):'–',
                sapCoherent.length?h('span',{style:'color:var(--ok);font-size:12px'},' (in linea: '+sapCoherent.join(', ')+')'):null),
              h('div',{style:'margin-top:3px'},h('b',{},'Aromi: '),
                [get('aromi_int')!==undefined?`Int. ${INT5[get('aromi_int')]}`:'', userArUnique.join(', ')].filter(Boolean).join(' — ') || '–'),
              userArUnique.length
                ? h('div',{style:'margin-top:4px'},
                    arMatched.map(d=>h('span',{class:'tag-ok'},'✓ '+d)),
                    arExtra.map(d=>h('span',{class:'tag-diff'},d))
                  )
                : null,
              strMatched.length
                ? h('div',{style:'margin-top:4px'},h('b',{},'Struttura centrata: '),strMatched.map(d=>h('span',{class:'tag-ok'},'✓ '+d)))
                : null,
              userPers
                ? h('div',{style:'margin-top:4px'},h('b',{},'Persistenza: '),userPers,' ',
                    persDiff===0?h('span',{class:'tag-ok'},'✓ Identica ONAF'):(persDiff===1?h('span',{class:'tag-ok'},'≈ Vicina ONAF'):null))
                : null,
              userGustoNotes
                ? h('div',{style:'margin-top:4px;font-style:italic;color:var(--muted)'},'Note: «'+userGustoNotes+'»')
                : null
            )
          )
        )
      )
    ));
  }else{
    out.push(h('div',{class:'sub',style:'margin-top:6px'},'Seleziona uno dei formaggi DOP dall\'elenco qui sopra per affiancare punto per punto descrizione visiva, annotazione olfattiva e gusto-olfattiva con l\'Atlante ONAF.'));
  }

  return card('Raffronto completo con l\'Atlante dei Formaggi ONAF', ...out);
}


/* ---------- Confronto Rapido tra due schede ---------- */
function buildQuickCompare(){
  const otherIds=Object.keys(DB.sheets).filter(id=>id!==DB.cur).sort((a,b)=>(DB.sheets[b].updated||0)-(DB.sheets[a].updated||0));
  if(!otherIds.length){
    return card('Confronto rapido',h('div',{class:'sub'},'Salva almeno un\'altra scheda nell\'archivio per confrontare due formaggi affiancati.'));
  }
  let cmpId=uiS().cmp_id;
  if(!cmpId || !DB.sheets[cmpId]) cmpId=otherIds[0];

  const sel=h('select',{class:'sel-cmp',onchange:e=>{uiS().cmp_id=e.target.value;render();}},
    otherIds.map(id=>{
      const sv=DB.sheets[id].v||{};
      const lbl=(sv.denominazione||'Senza nome')+(sv.campione?' (Camp. '+sv.campione+')':'')+(sv.data?' · '+sv.data:'');
      return h('option',{value:id,selected:id===cmpId},lbl);
    })
  );

  const A=S.v;
  const B=DB.sheets[cmpId].v||{};

  const sapSummary=v=>['dolce','acido','salato','amaro','umami']
    .filter(s=>v['s_'+s]!==undefined)
    .map(s=>s[0].toUpperCase()+s.slice(1)+': '+ABBR[['Non percettibile',...INT5][v['s_'+s]]])
    .join(', ') || '–';
  const descSummary=(v,k)=>(v[k+'_items']||[]).map(it=>it.r||it.s).join(', ') || '–';

  const cmpRows=[
    ['Categoria', catValFrom(A)||'–', catValFrom(B)||'–', false],
    ['Aspetto / Struttura pasta', [A.forma, join(A.strpasta||[])].filter(Boolean).join(' · ')||'–', [B.forma, join(B.strpasta||[])].filter(Boolean).join(' · ')||'–', false],
    ['Odori (intensità & note)', [A.odori_int!==undefined?INT5[A.odori_int]:'', descSummary(A,'odori')].filter(x=>x&&x!=='–').join(' — ')||'–', [B.odori_int!==undefined?INT5[B.odori_int]:'', descSummary(B,'odori')].filter(x=>x&&x!=='–').join(' — ')||'–', false],
    ['Sapori', sapSummary(A), sapSummary(B), false],
    ['Aromi (intensità & note)', [A.aromi_int!==undefined?INT5[A.aromi_int]:'', descSummary(A,'aromi')].filter(x=>x&&x!=='–').join(' — ')||'–', [B.aromi_int!==undefined?INT5[B.aromi_int]:'', descSummary(B,'aromi')].filter(x=>x&&x!=='–').join(' — ')||'–', false],
    ['Persistenza', A.pers!==undefined?L.pers[A.pers]+' ('+L.persHint[A.pers]+')':'–', B.pers!==undefined?L.pers[B.pers]+' ('+L.persHint[B.pers]+')':'–', false]
  ];

  return card('Confronto rapido con un altro campione',
    h('div',{class:'row noprint'},h('span',{class:'sub',style:'margin:0'},'Confronta con:'),sel),
    h('table',{class:'cmp-table'},
      h('thead',{},h('tr',{},
        h('th',{},'Parametro'),
        h('th',{style:'color:var(--accent)'},A.denominazione||'Scheda attuale'),
        h('th',{},B.denominazione||'Campione 2')
      )),
      h('tbody',{},cmpRows.map(([k,va,vb])=>h('tr',{},
        h('th',{},k),
        h('td',{},va),
        h('td',{},vb)
      )))
    )
  );
}

function buildSummary(){
  const miss=getMissingEssential();
  const out=[];
  const prHdr=document.createElement('div');
  prHdr.className='print-hdr';
  prHdr.innerHTML=`<div style="display:flex;align-items:center;gap:10px"><svg class="onaf-logo" viewBox="0 0 185 52" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Logo ONAF">
  <path d="M4,15 A24,13 0 1,1 52,15 A24,13 0 1,1 4,15 Z" fill="none" stroke="#f39200" stroke-width="3.6"/>
  <path d="M4,15 L4,33 A24,13 0 0,0 52,33 L52,15 A24,13 0 0,1 4,15 Z" fill="#f39200"/>
  <text x="62" y="37" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" font-weight="800" font-size="33" letter-spacing="1.5" fill="#2b2622">ONAF</text>
</svg><div><b style="font-size:15px">SCHEDA DESCRITTIVA PER L&rsquo;ASSAGGIO DEI FORMAGGI</b><div style="font-size:10px;color:#666">Organizzazione Nazionale Assaggiatori Formaggi · 12060 Grinzane Cavour (CN) · Rev. Settembre 2025</div></div></div>`;
  // I campi liberi entrano come testo, mai come HTML
  prHdr.append(h('div',{class:'no-gloss',style:'text-align:right;font-size:11px;color:#444'},
    h('b',{class:'no-gloss'},[get('commissione',''),get('assaggiatore','')].filter(Boolean).join(' / ')),h('br',{}),
    [get('luogo',''),get('data','')].filter(Boolean).join(' · ')));
  out.push(prHdr);
  if(miss.length){
    out.push(h('div',{class:'miss'},
      h('b',{},'Allarme compilazione — mancano '+miss.length+' elementi essenziali '),
      h('span',{},'(tocca una voce per compilare subito):'),
      h('div',{class:'miss-list'},miss.map(m=>h('button',{type:'button',class:'miss-pill',onclick:()=>go(m.step)},'+ '+m.label)))
    ));
  }
  const denom=get('denominazione','').trim();
  out.push(card('Formaggio',
    buildMarchioWidget(true),
    h('div',{class:'sum',style:'margin-top:6px'},h('dl',{},
      ...[['Denominazione',denom],['Riconoscimento',get('riconoscimento','')],['Variante',get('variante','')],['Campione',get('campione','')],['Categoria',catVal()],['Presentazione',presVal()],['Data',get('data','')],['Località / Luogo',get('luogo','')],['Commissione',get('commissione','')],['Nome assaggiatore',get('assaggiatore','')]]
        .filter(r=>r[1]).flatMap(r=>[h('dt',{},r[0]),h('dd',{},r[1])]))),
    h('div',{class:'row noprint',style:'margin-top:8px;padding-top:8px;border-top:1px solid var(--line)'},
      h('span',{class:'sub',style:'margin:0'},denom?'Cerca «'+denom+'» nell\'Atlante ONAF ('+ONAF_ATLAS.length+' formaggi):':'Consulta l\'Atlante dei Formaggi ONAF:'),
      h('button',{type:'button',class:'btn sm',onclick:copyAndOpenOnaf,title:denom?'Copia il nome negli appunti e apre onaf.it/formaggi':'Apre onaf.it/formaggi'},denom?'Copia nome e apri Atlante ONAF ↗':'Apri Atlante ONAF ↗'))
  ));

  out.push(buildCheesePreviewCard());

  out.push(buildAtlasCompareCard());

  const sapKeys=['dolce','acido','salato','amaro','umami'];
  const sapVals={};
  sapKeys.forEach(s=>{if(get('s_'+s)!==undefined)sapVals[s]=get('s_'+s);});
  out.push(card('4.1 Profilo dei Sapori (Radar)',buildRadarChart(sapVals)));

  rows().forEach(([titolo,rs])=>{
    const f=rs.filter(r=>r[1]);
    if(f.length)out.push(card(titolo,h('div',{class:'sum'},h('dl',{},f.flatMap(r=>[h('dt',{},r[0]),h('dd',{},r[1])])))));
  });

  out.push(card('Giudizio complessivo',h('label',{class:'f',for:'f_note_gen'},'Note generali'),h('textarea',{id:'f_note_gen','data-fk':'note_gen',oninput:e=>set('note_gen',e.target.value,false)},get('note_gen',''))));
  out.push(buildQuickCompare());
  out.push(h('div',{class:'row noprint'},
    h('button',{type:'button',class:'btn primary',onclick:()=>window.print()},'Stampa / PDF'),
    h('button',{type:'button',class:'btn',onclick:exportJson},'Scarica dati (JSON)'),
    h('button',{type:'button',class:'btn',onclick:newSheet},'+ Nuova scheda'),
    h('button',{type:'button',class:'btn',onclick:closeSheet},'Chiudi scheda'),
    h('button',{type:'button',class:'btn danger',onclick:()=>deleteSheet(DB.cur)},'Elimina scheda')));
  return out;
}

/* ---------- Archivio, Backup e Esportazione CSV Excel ---------- */
function needsBackup(){
  const ids=Object.keys(DB.sheets);
  if(ids.length<2)return false;
  const last=DB.lastBackup||0;
  const daysSince=(Date.now()-last)/(1000*60*60*24);
  const unsavedSheets=ids.filter(id=>(DB.sheets[id].updated||0)>last).length;
  return unsavedSheets>=3 || (unsavedSheets>0 && daysSince>=7);
}
function markBackedUp(){
  DB.lastBackup=Date.now();
  persist();
}
/* ---------- Mappa Italia & Elenco Formaggi Atlante ONAF per Regione ---------- */

let selectedRegion='Tutte';
let selectedRic='Tutti';
let filterLatte='Tutti';
let filterPasta='Tutte';
let filterTec='Tutte';
let filterCrosta='Tutte';
let filterCaglio='Tutti';
let filterCoag='Tutte';
let filterIconicOnly=false;
let activePreset='';
let atlasCheeseQuery='';
let locatedId=null;
let atlasExpanded=new Set();
const ATLAS_PER_REGION=8;

const ATLAS_PRESETS=[
  {id:'abb_autore',label:'★ Abbinamenti d’Autore ('+ICONIC_BY_ID.size+')',apply:()=>{filterIconicOnly=true;}},
  {id:'filate_pecora',label:'Paste filate di pecora',apply:()=>{filterLatte='Pecora';filterTec='Pasta filata';}},
  {id:'filate_vacca_bufala',label:'Paste filate vacca e bufala',apply:()=>{filterLatte='Vacca/Bufala';filterTec='Pasta filata';}},
  {id:'freschi_capra',label:'Freschi e cremosi di capra',apply:()=>{filterLatte='Capra';filterPasta='Freschi/Molli/Cremosi';}},
  {id:'caglio_vegetale',label:'Caglio vegetale (cardo / fico)',apply:()=>{filterCaglio='Vegetale';}},
  {id:'caglio_agnello_capretto',label:'Caglio d’agnello o capretto',apply:()=>{filterCaglio='Agnello/Capretto';}},
  {id:'coag_acida_mista',label:'Coagulazione acida / acido-presamica',apply:()=>{filterCoag='Acida/Mista';}},
  {id:'erborinati',label:'Erborinati italiani',apply:()=>{filterTec='Erborinato';}},
  {id:'crosta_lavata',label:'Crosta lavata',apply:()=>{filterCrosta='Lavata';}}
];

function resetAtlasFilters(){
  selectedRegion='Tutte';
  selectedRic='Tutti';
  filterLatte='Tutti';
  filterPasta='Tutte';
  filterTec='Tutte';
  filterCrosta='Tutte';
  filterCaglio='Tutti';
  filterCoag='Tutte';
  filterIconicOnly=false;
  activePreset='';
  atlasCheeseQuery='';
  locatedId=null;
  atlasExpanded=new Set();
}

function normStr(s){
  return String(s||'').trim().toLowerCase();
}

function hasActiveTaxFilter(){
  return normStr(selectedRic)!=='tutti' ||
         normStr(filterLatte)!=='tutti' ||
         normStr(filterPasta)!=='tutte' ||
         normStr(filterTec)!=='tutte' ||
         normStr(filterCrosta)!=='tutte' ||
         normStr(filterCaglio)!=='tutti' ||
         normStr(filterCoag)!=='tutte' ||
         filterIconicOnly;
}

function matchesAtlasFilters(c){
  if(!c) return false;
  if(filterIconicOnly && !isIconicCheese(c)) return false;
  if(normStr(selectedRic)!=='tutti' && normStr(c.ric)!==normStr(selectedRic)) return false;
  const t=c.tax||{};
  const fLat=normStr(filterLatte);
  if(fLat!=='tutti'){
    const lats=(t.latte||[]).map(normStr);
    if(fLat==='vacca/bufala'){
      if(!lats.some(x=>x==='vacca'||x==='bufala'||x.includes('bufala'))) return false;
    }else if(fLat==='misto'){
      if(!lats.some(x=>x.startsWith('misto'))) return false;
    }else{
      if(!lats.includes(fLat)) return false;
    }
  }
  const fPas=normStr(filterPasta);
  if(fPas!=='tutte'){
    const ps=(t.pasta||[]).map(normStr);
    if(fPas==='freschi/molli/cremosi'){
      if(!ps.some(x=>x==='cremosa'||x==='pasta molle'||x==='semiliquida'||x==='liquida')) return false;
    }else{
      if(!ps.includes(fPas)) return false;
    }
  }
  const fTec=normStr(filterTec);
  if(fTec!=='tutte'){
    const ts=(t.tecnologia||[]).map(normStr);
    if(!ts.includes(fTec)) return false;
  }
  const fCro=normStr(filterCrosta);
  if(fCro!=='tutte'){
    const cs=(t.crosta||[]).map(normStr);
    if(!cs.includes(fCro)) return false;
  }
  const fCag=normStr(filterCaglio);
  if(fCag!=='tutti'){
    const cags=(t.caglio||[]).map(normStr);
    if(fCag==='agnello/capretto'){
      if(!cags.some(x=>x==='agnello'||x==='capretto')) return false;
    }else{
      if(!cags.includes(fCag)) return false;
    }
  }
  const fCoa=normStr(filterCoag);
  if(fCoa!=='tutte'){
    const coas=(t.coagulazione||[]).map(normStr);
    if(fCoa==='acida/mista'){
      if(!coas.some(x=>x==='acida'||x==='acido-presamica'||x==='presamico-acida')) return false;
    }else{
      if(!coas.includes(fCoa)) return false;
    }
  }
  return true;
}

function formatTaxSummary(c){
  const t=c.tax||{};
  if(c.forma){
    const extra=[
      t.caglio&&t.caglio.length?'Caglio: '+t.caglio.join('/'):'',
      t.coagulazione&&t.coagulazione.length?'Coag.: '+t.coagulazione.join('/'):''
    ].filter(Boolean);
    return `${c.latte} · ${c.forma.split(' (')[0]}${extra.length?' · '+extra.join(' · '):''}`;
  }
  const parts=[
    (t.latte||[]).join(', '),
    (t.pasta||[]).join(', '),
    (t.stagionatura||[]).join(', '),
    (t.tecnologia||[]).join(', '),
    t.caglio&&t.caglio.length?'Caglio: '+t.caglio.join('/'):'',
    t.coagulazione&&t.coagulazione.length?'Coag.: '+t.coagulazione.join('/'):'',
    t.crosta&&t.crosta.length?'Crosta: '+t.crosta.join(', '):''
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : c.latte;
}

function getCheesesByRegion(regName){
  return getFullAtlas().filter(c=>c.regioni && c.regioni.includes(regName) && matchesAtlasFilters(c));
}

function startTastingFromAtlas(c){
  const t=c.tax||{};
  const v={
    data:today(),
    denominazione:c.nome,
    riconoscimento:c.ric,
    rif_onaf:c.onafId
  };
  if(t.latte && t.latte.length) v['cat_Tipologia latte']=[...t.latte];
  if(t.stato_latte && t.stato_latte.length) v['cat_Stato del latte']=[...t.stato_latte];
  if(t.cagliata && t.cagliata.length) v['cat_Temperatura cagliata']=[...t.cagliata];
  if(t.pasta && t.pasta.length) v['cat_Consistenza pasta']=[...t.pasta];
  if(t.stagionatura && t.stagionatura.length) v['cat_Tempo stagionatura']=[...t.stagionatura];
  if(t.tecnologia && t.tecnologia.length) v['cat_Tecnologia lavorazione']=[...t.tecnologia];
  if(t.caglio && t.caglio.length) v['cat_Tipologia caglio']=[...t.caglio];
  if(t.coagulazione && t.coagulazione.length) v['cat_Tipologia coagulazione']=[...t.coagulazione];

  const daRic=Object.keys(CAT).filter(g=>Array.isArray(v['cat_'+g])&&v['cat_'+g].length>1);
  if(daRic.length) v.da_riconciliare=daRic;

  // Se c'è una scheda aperta completamente vuota, riutilizziamola; altrimenti ne creiamo una nuova
  const curHasData = !S || !DB.cur || (S.v && (S.v.denominazione || Object.keys(S.v).some(k=>k!=='data' && S.v[k])));
  const id = curHasData ? newId() : DB.cur;
  DB.sheets[id]={step:0,v,updated:Date.now()};
  openSheet(id);
  showToast('Scheda precompilata per «'+c.nome+'»'+(daRic.length?' · '+daRic.length+' voci da riconciliare con il campione':''));
}

function buildAtlasPage(){
  const counts={};
  let maxCount=1;
  ITALY_REGIONS.forEach(r=>{
    const n=getCheesesByRegion(r.id).length;
    counts[r.id]=n;
    if(n>maxCount)maxCount=n;
  });

  const allFiltered=getFullAtlas().filter(matchesAtlasFilters);
  const taxActive=hasActiveTaxFilter();

  const locatedCheese = locatedId ? atlasById(locatedId) : null;
  const locatedRegs = locatedCheese ? (locatedCheese.regioni||[]) : [];

  const fillFor=n=>{
    if(n===0)return 'var(--chip)';
    if(taxActive){
      const ratio=n/maxCount;
      if(ratio<=0.33)return '#a7dfb8';
      if(ratio<=0.66)return '#57b878';
      return '#2d7a47';
    }
    const ratio=n/maxCount;
    if(ratio<=0.25)return '#fde2be';
    if(ratio<=0.50)return '#f8bd74';
    if(ratio<=0.75)return '#eb9334';
    return '#d9791a';
  };

  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox','0 0 435 505');
  svg.setAttribute('class','italy-svg');
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label','Mappa cartografica Italia con numero di formaggi per regione');
  svg.innerHTML=`<defs>
    <filter id="italy-shadow" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="2" dy="4" stdDeviation="4" flood-color="#1a1714" flood-opacity="0.22"/>
    </filter>
  </defs>`;

  const gridG=document.createElementNS(svgNS,'g');
  gridG.setAttribute('stroke','rgba(100,130,155,0.16)');
  gridG.setAttribute('stroke-width','0.7');
  gridG.setAttribute('stroke-dasharray','3,3');
  [90,180,270,360].forEach(gx=>{
    const l=document.createElementNS(svgNS,'line');l.setAttribute('x1',gx);l.setAttribute('y1',0);l.setAttribute('x2',gx);l.setAttribute('y2',490);gridG.appendChild(l);
  });
  [100,200,300,400].forEach(gy=>{
    const l=document.createElementNS(svgNS,'line');l.setAttribute('x1',0);l.setAttribute('y1',gy);l.setAttribute('x2',425);l.setAttribute('y2',gy);gridG.appendChild(l);
  });
  svg.appendChild(gridG);

  const mapGroup=document.createElementNS(svgNS,'g');
  mapGroup.setAttribute('filter','url(#italy-shadow)');
  svg.appendChild(mapGroup);

  [
    {t:'MAR LIGURE',x:68,y:172},
    {t:'MAR TIRRENO',x:165,y:312},
    {t:'MAR ADRIATICO',x:295,y:185},
    {t:'MAR IONIO',x:385,y:375},
    {t:'MAR DI SARDEGNA',x:32,y:335}
  ].forEach(s=>{
    const st=document.createElementNS(svgNS,'text');
    st.setAttribute('x',s.x);st.setAttribute('y',s.y);
    st.setAttribute('font-family','system-ui,sans-serif');
    st.setAttribute('font-size','6.5');
    st.setAttribute('font-weight','700');
    st.setAttribute('letter-spacing','1.2');
    st.setAttribute('fill','rgba(75,110,138,0.55)');
    st.setAttribute('text-anchor','middle');
    st.textContent=s.t;
    svg.appendChild(st);
  });

  ITALY_REGIONS.forEach(r=>{
    const n=counts[r.id]||0;
    const isSel=selectedRegion===r.id;
    const isLoc=locatedRegs.includes(r.id);
    const path=document.createElementNS(svgNS,'path');
    path.setAttribute('d',r.d);
    path.setAttribute('fill',fillFor(n));
    path.setAttribute('class','reg-poly'+(isSel?' sel':'')+(isLoc?' loc':''));
    path.innerHTML=`<title>${r.id}: ${n} ${n===1?'formaggio':'formaggi'}</title>`;
    path.addEventListener('click',()=>{
      locatedId=null;
      selectedRegion=(selectedRegion===r.id)?'Tutte':r.id;
      render();
      if(selectedRegion!=='Tutte'){
        const el=document.getElementById('atlas-results');
        if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
      }
    });
    mapGroup.appendChild(path);
  });

  ITALY_REGIONS.forEach(r=>{
    const n=counts[r.id]||0;
    const isCompact=(r.short==='VDA'||r.short==='LIG'||r.short==='MOL');
    const lbl=document.createElementNS(svgNS,'text');
    lbl.setAttribute('x',r.cx);
    lbl.setAttribute('y',isCompact ? r.cy+2 : r.cy-1);
    lbl.setAttribute('class','reg-lbl');
    lbl.textContent=isCompact ? `${r.short} ${n}` : r.short;
    svg.appendChild(lbl);

    if(!isCompact){
      const cnt=document.createElementNS(svgNS,'text');
      cnt.setAttribute('x',r.cx);
      cnt.setAttribute('y',r.cy+9);
      cnt.setAttribute('class','reg-cnt');
      cnt.textContent=String(n);
      svg.appendChild(cnt);
    }
  });

  // Ricerca rapida formaggio sulla mappa (rispetta anche gli eventuali filtri attivi)
  const q=atlasCheeseQuery.trim().toLowerCase();
  const qMatches=q.length>=1
    ? allFiltered.filter(c=>c.nome.toLowerCase().includes(q) || c.regione.toLowerCase().includes(q)).slice(0,12)
    : [];

  const searchInput=h('input',{
    type:'search',
    'data-fk':'atlas_q','aria-label':'Cerca un formaggio',
    placeholder:'Cerca per nome o parola chiave (es. Castelmagno, Caglio, Scamorza...)',
    value:atlasCheeseQuery,
    style:'min-height:120px;height:120px;font-size:19px;padding:14px 18px;border-width:2px;border-radius:11px',
    oninput:e=>{
      atlasCheeseQuery=e.target.value;
      if(!atlasCheeseQuery.trim()) locatedId=null;
      render();
    }
  });

  const searchDrop=q.length>=1
    ? h('div',{class:'search-results'},
        qMatches.length
          ? qMatches.map(c=>h('button',{type:'button',class:'chip'+(locatedId===c.onafId?' on':''),onclick:()=>{
              locatedId=c.onafId;
              atlasCheeseQuery=c.nome;
              selectedRegion=(c.regioni && c.regioni.length===1) ? c.regioni[0] : 'Tutte';
              render();
            }},c.nome,h('small',{},`${c.ric} · ${(c.regioni||[]).join(', ')}`)))
          : h('span',{class:'sub'},'Nessun formaggio trovato per «'+atlasCheeseQuery+'»')
      )
    : null;

  const locatedBox=locatedCheese
    ? h('div',{class:'loc-banner'},
        h('div',{class:'row',style:'margin-bottom:4px'},
          h('div',{},
            h('span',{class:'ric-pill ric-'+locatedCheese.ric},locatedCheese.ric),
            h('b',{},locatedCheese.nome),' → ',
            h('b',{style:'color:var(--ok)'},locatedRegs.join(' · '))
          ),
          h('button',{type:'button',class:'btn sm',onclick:()=>{locatedId=null;atlasCheeseQuery='';selectedRegion='Tutte';render();}},'Azzera ✕')
        ),
        h('div',{style:'font-size:12px;color:var(--muted)'},formatTaxSummary(locatedCheese)),
        h('div',{style:'display:flex;gap:6px;margin-top:6px;flex-wrap:wrap'},
          h('button',{type:'button',class:'btn sm primary',onclick:()=>startTastingFromAtlas(locatedCheese)},'Degusta questo formaggio'),
          h('button',{type:'button',class:'btn sm',style:isIconicCheese(locatedCheese)?'border-color:var(--accent);color:var(--accent);font-weight:700':'',onclick:()=>openPairingModal(locatedCheese)},isIconicCheese(locatedCheese)?'Abbinamenti ★':'Abbinamenti 🍽'),
          h('button',{type:'button',class:'btn sm',onclick:()=>openOnafFor(locatedCheese)},'ONAF ↗'),
          h('a',{href:onafDeepSearchUrl(locatedCheese),target:'_blank',rel:'noopener',class:'btn sm'},'Scheda ↗')
        )
      )
    : null;

  // 4 selettori tassonomici ufficiali ONAF (con sincronizzazione esplicita del valore)
  const mkSel=(label,val,opts,onChg)=>{
    const selEl=h('select',{class:'sel-cmp',style:'min-height:34px;font-size:13px;padding:4px 8px',onchange:e=>{
      const chosen=e.target.value;
      if(activePreset){
        const keepReg=selectedRegion;
        const keepRic=selectedRic;
        resetAtlasFilters();
        selectedRegion=keepReg;
        selectedRic=keepRic;
      }
      locatedId=null;
      onChg(chosen);
      render();
    }},
      opts.map(([v,t])=>h('option',{value:v},t))
    );
    selEl.value=val;
    return h('div',{},h('label',{class:'f',style:'margin-top:0'},label),selEl);
  };

  const taxControls=h('div',{class:'grid3',style:'margin:8px 0'},
    mkSel('Specie del latte',filterLatte,[
      ['Tutti','Tutti i latti'],
      ['Vacca','Vacca'],
      ['Pecora','Pecora'],
      ['Capra','Capra'],
      ['Bufala','Bufala'],
      ['Misto','Misti (Vacca/Pecora/Capra)'],
      ['Vacca/Bufala','Vacca e Bufala']
    ],v=>{filterLatte=v;}),
    mkSel('Consistenza pasta',filterPasta,[
      ['Tutte','Tutte le paste'],
      ['Freschi/Molli/Cremosi','Freschi, molli e cremosi'],
      ['Cremosa','Cremosa'],
      ['Pasta molle','Pasta molle'],
      ['Pasta semidura','Pasta semidura'],
      ['Pasta dura','Pasta dura']
    ],v=>{filterPasta=v;}),
    mkSel('Tecnologia',filterTec,[
      ['Tutte','Tutte le tecnologie'],
      ['Pasta filata','Pasta filata'],
      ['Erborinato','Erborinato'],
      ['Pressato','Pressato'],
      ['Cacioricotta','Cacioricotta'],
      ['Affumicato','Affumicato'],
      ['Affinato','Affinato (fossa/vinacce/fieno)'],
      ['Aromatizzato','Aromatizzato'],
      ['Fermentato','Fermentato'],
      ['Ricotto','Ricotto / Ricotta']
    ],v=>{filterTec=v;}),
    mkSel('Caglio',filterCaglio,[
      ['Tutti','Tutti i cagli'],
      ['Vitello','Vitello'],
      ['Agnello','Agnello'],
      ['Capretto','Capretto'],
      ['Agnello/Capretto','Agnello o Capretto'],
      ['Bovino','Bovino'],
      ['Suino','Suino'],
      ['Animale','Animale (generico)'],
      ['Vegetale','Vegetale (cardo / fico)'],
      ['Microbico','Microbico'],
      ['Acidificante','Acidificante']
    ],v=>{filterCaglio=v;}),
    mkSel('Coagulazione',filterCoag,[
      ['Tutte','Tutte le coagulazioni'],
      ['Presamica','Presamica'],
      ['Acida','Acida'],
      ['Acido-Presamica','Acido-Presamica'],
      ['Presamico-Acida','Presamico-Acida'],
      ['Acida/Mista','Acida o Acido-Presamica'],
      ['Acido-Termica','Acido-Termica (ricotte)'],
      ['Termico-Presamica','Termico-Presamica (cacioricotte)']
    ],v=>{filterCoag=v;}),
    mkSel('Superficie / Crosta',filterCrosta,[
      ['Tutte','Tutte le croste'],
      ['Assente','Senza crosta (Assente)'],
      ['Pelle','Pelle (paste filate)'],
      ['Buccia','Buccia'],
      ['Fiorita','Fiorita'],
      ['Lavata','Lavata'],
      ['Ammuffita','Ammuffita / Con muffe'],
      ['Trattata','Trattata / Cappata'],
      ['Pulita','Pulita']
    ],v=>{filterCrosta=v;})
  );

  const mapCard=card('Mappa d\'Italia — Esplorazione Geografica e Tassonomica ONAF',
    h('div',{class:'italy-wrap'},
      h('div',{class:'italy-map-box'},
        svg,
        h('div',{class:'map-legend'},
          taxActive
            ? [
                h('span',{class:'map-swatch',style:'background:var(--chip)'}),'0',
                h('span',{class:'map-swatch',style:'background:#a7dfb8'}),'Bassa',
                h('span',{class:'map-swatch',style:'background:#57b878'}),'Media',
                h('span',{class:'map-swatch',style:'background:#2d7a47'}),'Alta presenza'
              ]
            : [
                h('span',{class:'map-swatch',style:'background:#fde2be'}),'1–15',
                h('span',{class:'map-swatch',style:'background:#f8bd74'}),'16–35',
                h('span',{class:'map-swatch',style:'background:#eb9334'}),'36–60',
                h('span',{class:'map-swatch',style:'background:#d9791a'}),'60+'
              ],
          locatedCheese?[h('span',{class:'map-swatch',style:'background:#2d7a47;margin-left:6px'}),'Formaggio ubicato']:null
        )
      ),
      h('div',{},
        h('div',{class:'row',style:'margin-bottom:4px'},
          h('span',{class:'sub',style:'margin:0'},'Ricerche guidate (1 clic per illuminare la mappa):'),
          (taxActive || selectedRegion!=='Tutte' || locatedCheese)
            ? h('button',{type:'button',class:'link',onclick:()=>{resetAtlasFilters();render();}},'Azzera tutti i filtri ✕')
            : null
        ),
        h('div',{class:'chips',style:'margin-bottom:10px'},ATLAS_PRESETS.map(pr=>
          h('button',{type:'button',class:'reg-badge'+(activePreset===pr.id?' on':''),onclick:()=>{
            if(activePreset===pr.id){resetAtlasFilters();}
            else{resetAtlasFilters();pr.apply();activePreset=pr.id;}
            render();
          }},pr.label)
        )),
        taxControls,
        h('div',{class:'sub'},selectedRegion!=='Tutte'?`Riconoscimento in ${selectedRegion}:`:'Riconoscimento (Italia):'),
        h('div',{class:'chips',style:'margin-bottom:10px'},['Tutti','DOP','IGP','STG','PAT'].map(ric=>{
          const prev=selectedRic;selectedRic='Tutti';
          const baseList=getFullAtlas().filter(c=>matchesAtlasFilters(c) && (selectedRegion==='Tutte' || (c.regioni && c.regioni.includes(selectedRegion))));
          selectedRic=prev;
          const cnt = ric==='Tutti' ? baseList.length : baseList.filter(c=>c.ric===ric).length;
          return h('button',{type:'button',class:'reg-badge'+(selectedRic===ric?' on':''),onclick:()=>{activePreset='';selectedRic=ric;render();}},
            `${ric} (${cnt})`);
        })),
        h('div',{class:'search-box'},searchInput,searchDrop),
        locatedBox,
        (()=>{
          const pills=[];
          if(selectedRic!=='Tutti') pills.push({lbl:'Riconoscimento: '+selectedRic,clr:()=>{selectedRic='Tutti';activePreset='';}});
          if(filterLatte!=='Tutti') pills.push({lbl:'Latte: '+filterLatte,clr:()=>{filterLatte='Tutti';activePreset='';}});
          if(filterPasta!=='Tutte') pills.push({lbl:'Pasta: '+filterPasta,clr:()=>{filterPasta='Tutte';activePreset='';}});
          if(filterTec!=='Tutte') pills.push({lbl:'Tecnologia: '+filterTec,clr:()=>{filterTec='Tutte';activePreset='';}});
          if(filterCaglio!=='Tutti') pills.push({lbl:'Caglio: '+filterCaglio,clr:()=>{filterCaglio='Tutti';activePreset='';}});
          if(filterCoag!=='Tutte') pills.push({lbl:'Coagulazione: '+filterCoag,clr:()=>{filterCoag='Tutte';activePreset='';}});
          if(filterCrosta!=='Tutte') pills.push({lbl:'Crosta: '+filterCrosta,clr:()=>{filterCrosta='Tutte';activePreset='';}});
          if(filterIconicOnly) pills.push({lbl:'★ Abbinamenti d’Autore',clr:()=>{filterIconicOnly=false;activePreset='';}});
          if(selectedRegion!=='Tutte') pills.push({lbl:'Regione: '+selectedRegion,clr:()=>{selectedRegion='Tutte';}});
          return pills.length ? h('div',{class:'tags',style:'margin:8px 0 4px'},
            pills.map(p=>h('span',{class:'tag'},p.lbl,h('button',{type:'button','aria-label':'Rimuovi filtro',onclick:()=>{p.clr();render();}},'×')))
          ) : null;
        })(),
        h('div',{class:'row',style:'margin-top:8px'},
          h('span',{class:'sub',style:'margin:0'},
            selectedRegion!=='Tutte'
              ? [
                  h('b',{style:'color:var(--ink)'},`${counts[selectedRegion]||0} ${(counts[selectedRegion]||0)===1?'formaggio':'formaggi'} in ${selectedRegion}`),
                  taxActive ? ` (su ${allFiltered.length} in Italia con questi filtri):` : ':'
                ]
              : [
                  h('b',{style:'color:var(--ink)'},`${allFiltered.length} formaggi`),
                  taxActive ? ' in Italia corrispondenti ai filtri selezionati (clicca una regione per filtrare):' : ' per regione:'
                ]
          )
        ),
        h('div',{class:'chips'},
          h('button',{type:'button',class:'reg-badge'+(selectedRegion==='Tutte'&&!locatedCheese?' on':''),onclick:()=>{selectedRegion='Tutte';locatedId=null;render();}},'Tutte le regioni'),
          ...ITALY_REGIONS.map(r=>{
            if(taxActive && counts[r.id]===0) return null;
            const active=(selectedRegion===r.id) || locatedRegs.includes(r.id);
            return h('button',{type:'button',class:'reg-badge'+(active?' on':''),onclick:()=>{
              locatedId=null;
              selectedRegion=(selectedRegion===r.id?'Tutte':r.id);
              render();
              if(selectedRegion!=='Tutte'){
                const el=document.getElementById('atlas-results');
                if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
              }
            }},
              `${r.id} `,h('b',{},`(${counts[r.id]})`));
          }).filter(Boolean)
        )
      )
    )
  );
  mapCard.classList.add('wide');

  const regionsToShow = locatedRegs.length
    ? ITALY_REGIONS.filter(r=>locatedRegs.includes(r.id))
    : (selectedRegion==='Tutte' ? ITALY_REGIONS : ITALY_REGIONS.filter(r=>r.id===selectedRegion));
  const regCards=[];

  regionsToShow.forEach(r=>{
    const list=getCheesesByRegion(r.id);
    if(!list.length)return;

    const subSections=[];
    // Con più regioni a video ogni regione mostra i primi ATLAS_PER_REGION formaggi; il resto a richiesta
    let left=(regionsToShow.length===1||locatedRegs.length||atlasExpanded.has(r.id))?Infinity:ATLAS_PER_REGION;
    ['DOP','IGP','STG','PAT'].forEach(cat=>{
      const fullList=list.filter(c=>c.ric===cat);
      const subList=fullList.slice(0,left);
      left-=subList.length;
      if(!subList.length)return;
      subSections.push(
        h('div',{style:'margin-top:8px'},
          h('div',{class:'sub',style:'font-weight:700;color:var(--ink);margin-bottom:4px'},
            h('span',{class:'ric-pill ric-'+cat},cat),` (${fullList.length})`
          ),
          ...subList.map(c=>{
            const isHighlighted=(locatedId===c.onafId);
            const locateOnMap=()=>{
              locatedId=c.onafId;
              atlasCheeseQuery=c.nome;
              render();
              window.scrollTo(0,0);
            };
            return h('div',{class:'cheese-dir-item',style:isHighlighted?'background:var(--accent-soft);padding:6px 8px;border-radius:8px':''},
              h('div',{},
                h('b',{style:'cursor:pointer',title:'Tocca il nome per ubicarlo sulla mappa in alto',onclick:locateOnMap},c.nome,' ',h('span',{style:'font-size:12px;opacity:.65;font-weight:500'},'📍')),
                h('div',{style:'font-size:12px;color:var(--muted)'},formatTaxSummary(c))
              ),
              h('div',{style:'display:flex;gap:5px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end'},
                h('button',{type:'button',class:'btn sm',style:isIconicCheese(c)?'border-color:var(--accent);color:var(--accent);font-weight:700':'',title:isIconicCheese(c)?'Scheda d’Autore ONAF disponibile':'Consigli di abbinamento gastronomico',onclick:()=>openPairingModal(c)},isIconicCheese(c)?'Abbinamenti ★':'Abbinamenti 🍽'),
                h('button',{type:'button',class:'btn sm primary',onclick:()=>startTastingFromAtlas(c)},'Degusta'),
                h('button',{type:'button',class:'btn sm',title:'Apre scheda ufficiale ONAF',onclick:()=>openOnafFor(c)},'ONAF ↗'),
                h('a',{href:onafDeepSearchUrl(c),target:'_blank',rel:'noopener',class:'btn sm',title:'Scheda diretta onaf.it'},'Scheda ↗')
              )
            );
          })
        )
      );
    });

    const hidden=isFinite(left)?list.length-(ATLAS_PER_REGION-left):0;
    if(hidden>0) subSections.push(h('button',{type:'button',class:'btn sm',style:'margin-top:8px;width:100%',
      onclick:()=>{atlasExpanded.add(r.id);render();}},`Mostra tutti i ${list.length} formaggi (altri ${hidden})`));
    const rc=card(`${r.id} · ${list.length} ${list.length===1?'formaggio':'formaggi'}`, ...subSections);
    if(regionsToShow.length===1){ rc.classList.add('wide'); rc.id='atlas-results'; }
    else if(regCards.length===0){ rc.id='atlas-results'; }
    regCards.push(rc);
  });

  if(!regCards.length){
    regCards.push(card('Nessun risultato',
      h('div',{class:'sub'},'Nessun formaggio trovato con questa combinazione di filtri.'),
      h('button',{type:'button',class:'btn sm primary',style:'margin-top:6px',onclick:()=>{resetAtlasFilters();render();}},'Ripristina tutti i filtri')
    ));
  }

  const topHighlightCards=[];
  if(taxActive && selectedRegion==='Tutte' && !locatedCheese){
    const tutelati=allFiltered.filter(c=>c.ric==='DOP'||c.ric==='IGP'||c.ric==='STG');
    if(tutelati.length){
      const hc=card(`In evidenza: ${tutelati.length} formaggi DOP · IGP · STG trovati (su ${allFiltered.length} totali)`,
        ...tutelati.map(c=>h('div',{class:'cheese-dir-item'},
          h('div',{},
            h('span',{class:'ric-pill ric-'+c.ric},c.ric),
            h('b',{},c.nome),' ',
            h('small',{style:'color:var(--accent);font-weight:600'},`(${c.regione})`),
            h('div',{style:'font-size:12px;color:var(--muted)'},formatTaxSummary(c))
          ),
          h('div',{style:'display:flex;gap:5px;flex-shrink:0'},
            h('button',{type:'button',class:'btn sm',title:'Evidenzia sulla mappa',onclick:()=>{
              locatedId=c.onafId;
              atlasCheeseQuery=c.nome;
              render();
              window.scrollTo(0,0);
            }},'Mappa'),
            h('button',{type:'button',class:'btn sm primary',onclick:()=>startTastingFromAtlas(c)},'Degusta'),
            h('button',{type:'button',class:'btn sm',title:'Apre scheda ufficiale ONAF',onclick:()=>openOnafFor(c)},'ONAF ↗'),
            h('a',{href:onafDeepSearchUrl(c),target:'_blank',rel:'noopener',class:'btn sm',title:'Scheda diretta onaf.it'},'Scheda ↗')
          )
        ))
      );
      hc.classList.add('wide');
      hc.id='atlas-results';
      topHighlightCards.push(hc);
    }
  }

  return [mapCard, ...topHighlightCards, ...regCards];
}

function buildList(){
  const ids=Object.keys(DB.sheets).sort((a,b)=>DB.sheets[b].updated-DB.sheets[a].updated);
  const file=h('input',{type:'file',accept:'.json,application/json',style:'display:none',onchange:e=>importJson(e.target.files[0])});
  const out=[];
  if(needsBackup()){
    const lastTxt=DB.lastBackup?'Ultimo backup: '+new Date(DB.lastBackup).toLocaleDateString('it-IT'):'Nessun backup effettuato finora';
    out.push(h('div',{class:'backup-banner'},
      h('div',{},h('b',{},'Promemoria backup: '),'hai '+ids.length+' schede salvate solo nella memoria di questo browser. ',h('small',{style:'color:var(--muted)'},'('+lastTxt+')')),
      h('button',{type:'button',class:'btn primary sm',onclick:exportAll},'Salva backup ora (JSON)')));
  }
  const top=h('div',{class:'row'},
    h('button',{type:'button',class:'btn primary',onclick:newSheet},'+ Nuova scheda'),
    h('button',{type:'button',class:'btn',onclick:exportAllCsv},'Esporta tutte (CSV Excel)'),
    h('button',{type:'button',class:'btn',onclick:exportAll},'Backup (JSON)'),
    h('button',{type:'button',class:'btn',onclick:()=>file.click()},'Importa (JSON)'),file);
  out.push(top);
  const items=ids.map(id=>{const sh=DB.sheets[id],v=sh.v||{};
    return h('section',{class:'card'},
      h('h3',{},(v.denominazione||'Senza nome')+(id===DB.cur?' · aperta':'')),
      h('div',{class:'sub'},[v.campione?'Campione '+v.campione:'',v.data||'','modificata '+new Date(sh.updated).toLocaleString('it-IT')].filter(Boolean).join(' · ')),
      h('div',{class:'row'},
        h('button',{type:'button',class:'btn primary sm',onclick:()=>openSheet(id)},'Apri'),
        id===DB.cur ? h('button',{type:'button',class:'btn sm',onclick:closeSheet},'Chiudi scheda') : null,
        h('button',{type:'button',class:'btn danger sm',onclick:()=>deleteSheet(id)},'Elimina')));});
  return [...out,...items];
}
function downloadBlob(name,blob){
  const a=h('a',{href:URL.createObjectURL(blob),download:name});
  document.body.append(a);a.click();a.remove();
}
function download(name,obj){
  downloadBlob(name,new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));
}
// Backup completo: schede (codificate), marchi e cache foto. Reimportabile senza duplicati.
function exportAll(){
  markBackedUp();
  const d=serializeDB();
  download('degustazioni-backup-'+today()+'.json',{app:APP_ID,schema:SCHEMA,esportato:new Date().toISOString(),sheets:d.sheets,marchioCache:d.marchioCache,photoCache:d.photoCache});
  render();
}
function exportJson(){
  download('degustazione-'+(get('denominazione','scheda').replace(/\W+/g,'_'))+'.json',{app:APP_ID,schema:SCHEMA,esportato:new Date().toISOString(),sheets:{[DB.cur]:encodeSheet(S)}});
}

/* ---------- Esportazione CSV compatibile con Excel (UTF-8 BOM + separatore ;) ---------- */
function csvCell(val){
  if(val===undefined||val===null)return '""';
  const s=String(val).replace(/\r?\n/g,' ').replace(/"/g,'""');
  return '"'+s+'"';
}
function exportAllCsv(){
  const headers=[
    'Data','Località / Luogo','Commissione','Nome Assaggiatore','Codice Campione','Denominazione','Riconoscimento','Variante',
    'Categoria','Tipologia Caglio','Tipologia Coagulazione','Presentazione','Categoria da riconciliare','1.1 Forma','1.2 Facce','1.3 Scalzo','1.4 Tipologia Superficie',
    '1.5 Aspetto Superficie','1.6 Colore Superficie','2.1 Colore Pasta','2.2 Sottocrosta',
    '2.3 Occhiatura','2.4 Erborinatura','2.5 Discontinuità','2.6 Struttura Pasta',
    '3.1 Odori Intensità','3.1 Odori Descrittori',
    '4.1 Dolce','4.1 Acido','4.1 Salato','4.1 Amaro','4.1 Umami',
    '4.2 Aromi Intensità','4.2 Aromi Descrittori','4.3 Trigeminali','4.4 Struttura Intensità','4.4 Struttura Altri',
    '5.1 Persistenza','Note Generali'
  ];
  const ids=Object.keys(DB.sheets).sort((a,b)=>(DB.sheets[b].updated||0)-(DB.sheets[a].updated||0));
  const lines=[headers.map(csvCell).join(';')];

  const sapLbl=val=>val===undefined?'':['Non percettibile',...INT5][val];
  const treeStr=(v,k)=>(v[k+'_items']||[]).map(it=>[it.f,it.s,it.r].filter(Boolean).join(' > ')).join(' | ');
  const presStr=(v,k,vals)=>{const p=v[k+'_p'];if(p==='Assente'||p==='Assenti')return p;if(p==='Presente'||p==='Presenti')return vals.filter(Boolean).join(' - ')||p;return '';};
  const rateStr=(v,k)=>Object.entries(v[k]||{}).map(([o,i])=>split(o)[0]+': '+INT5[i]).join(' | ');
  const regStr=(v,k)=>[join(v[k]),v[k+'_r']].filter(Boolean).join(' - ');

  for(const id of ids){
    const v=DB.sheets[id].v||{};
    const row=[
      v.data||'', v.luogo||'', v.commissione||'', v.assaggiatore||'', v.campione||'', v.denominazione||'', v.riconoscimento||'', v.variante||'',
      catValFrom(v), join(v['cat_Tipologia caglio']||''), join(v['cat_Tipologia coagulazione']||''), presValFrom(v), join(v.da_riconciliare||''),
      regStr(v,'forma'), regStr(v,'facce'), regStr(v,'scalzo'), v.tipsup||'',
      join(v.aspetto||[]), [join(v.colsup||[]),v.colsup_u,v.colsup_i].filter(Boolean).join(' - '),
      [join(v.colpasta||[]),v.colpasta_u,v.colpasta_i].filter(Boolean).join(' - '),
      presStr(v,'sottocrosta',[v.sottocrosta]),
      presStr(v,'occhiatura',[join(v.occhiatura||[])]),
      presStr(v,'erbor',[join(v.erbor||[])]),
      presStr(v,'discont',[join(v.discont||[]),v.discont_d,v.discont_s]),
      join(v.strpasta||[]),
      v.odori_int===undefined?'':INT5[v.odori_int],
      treeStr(v,'odori'),
      sapLbl(v.s_dolce), sapLbl(v.s_acido), sapLbl(v.s_salato), sapLbl(v.s_amaro), sapLbl(v.s_umami),
      v.aromi_int===undefined?'':INT5[v.aromi_int],
      treeStr(v,'aromi'),
      presStr(v,'trig',[rateStr(v,'trig_r')]),
      rateStr(v,'strbocca_r'),
      join((v.strbocca_o||[]).map(o=>split(o)[0])),
      v.pers===undefined?'':L.pers[v.pers]+' ('+L.persHint[v.pers]+')',
      [v.note_vista,v.note_pasta,v.note_odori,v.note_gusto,v.note_bocca,v.note_gen].filter(Boolean).join(' / ')
    ];
    lines.push(row.map(csvCell).join(';'));
  }

  // \uFEFF = UTF-8 BOM per aprire correttamente gli accenti italiani in Excel
  const csvContent='\uFEFF'+lines.join('\r\n');
  markBackedUp();
  downloadBlob('degustazioni-excel-'+today()+'.csv',new Blob([csvContent],{type:'text/csv;charset=utf-8;'}));
  render();
}

function importJson(f){
  if(!f)return;
  const r=new FileReader();
  r.onload=()=>{try{
    const o=JSON.parse(r.result);let n=0;
    if(o&&o.marchi&&typeof o.marchi==='object'){
      let mCnt=0;
      for(const [idOrName,url] of Object.entries(o.marchi)){
        const found=getFullAtlas().find(a=>String(a.onafId)===String(idOrName) || a.nome.toLowerCase()===String(idOrName).toLowerCase());
        const k=found ? 'onaf:'+found.onafId : cleanCheeseName(idOrName).toLowerCase();
        if(k && typeof url==='string' && url.startsWith('http')){ setCachedMarchio(k,url); mCnt++; }
      }
      render();alert('Importati '+mCnt+' marchi ufficiali ONAF.');return;
    }
    if(!o||typeof o!=='object'||Array.isArray(o)) throw new Error('formato');
    if(typeof o.schema==='number'&&o.schema>SCHEMA){alert('Questo file è stato creato da una versione più recente dell’app: aggiorna l’app prima di importarlo.');return;}
    let skip=0;
    // Stessa scheda (stesso ID): si tiene la versione più recente, senza creare doppioni
    const put=(id,sh)=>{
      if(!sh||typeof sh!=='object'||!sh.v||typeof sh.v!=='object'||Array.isArray(sh.v)) return;
      const ex=DB.sheets[id];
      if(ex&&(ex.updated||0)>=(sh.updated||0)){skip++;return;}
      DB.sheets[id]={step:typeof sh.step==='number'?sh.step:0,v:sh.v,updated:sh.updated||Date.now(),created:sh.created||sh.updated||Date.now()};
      n++;
    };
    _encCache.clear();
    if(o.schema===SCHEMA&&o.sheets&&typeof o.sheets==='object'){
      for(const [id,sh] of Object.entries(o.sheets)) if(sh&&typeof sh==='object') put(id,decodeSheet(sh));
      for(const ck of ['marchioCache','photoCache']){
        for(const [k,u] of Object.entries(o[ck]||{})) if(typeof u==='string'&&(u==='NONE'||IMG_OK.test(u))&&!DB[ck][k]) DB[ck][k]=u;
      }
    }else if(o.sheets&&typeof o.sheets==='object'){
      // Backup delle versioni precedenti (etichette in chiaro)
      for(const [id,sh] of Object.entries(o.sheets)) if(sh&&typeof sh==='object') put(id,{...sh,v:migrateLegacyV({...(sh.v||{})})});
    }else{
      // Singola scheda esportata dalle versioni precedenti
      put(newId(),{v:migrateLegacyV({...o}),updated:Date.now()});
    }
    if(DB.cur) S=DB.sheets[DB.cur]||null;
    persist();render();alert('Importate '+n+' schede.'+(skip?' '+skip+' erano già presenti in versione uguale o più recente e sono state saltate.':''));
  }catch(e){alert('File non valido.');}};
  r.readAsText(f);
}

/* ---------- Render ---------- */
function mount(...nodes){
  const warn=persistError ? h('div',{class:'miss no-gloss'},
    h('b',{},'Salvataggio non riuscito. '),
    'La memoria del browser è piena o non disponibile: le ultime modifiche esistono solo in questa finestra. Scarica subito un backup, poi libera spazio (le foto caricate sono la voce più pesante).',
    h('div',{style:'margin-top:6px'},h('button',{type:'button',class:'btn sm primary',onclick:exportAll},'Scarica backup ora (JSON)'))) : null;
  document.getElementById('main').replaceChildren(...[warn,...nodes].filter(Boolean));
}
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  const m=document.getElementById('gloss-modal-root')||document.getElementById('pairing-modal-root');
  if(m)m.remove();
});
function render(){
  const y=window.scrollY;
  // Il ridisegno ricrea i campi: si ricorda quale aveva il fuoco (data-fk) e glielo si restituisce
  const _ae=document.activeElement;
  let _fk=null,_pos=null;
  if(_ae&&_ae.dataset&&_ae.dataset.fk&&document.getElementById('main').contains(_ae)){
    _fk=_ae.dataset.fk;
    try{_pos=_ae.selectionStart;}catch(e){}
  }
  const restoreFocus=()=>{
    if(!_fk)return;
    const el=document.querySelector('#main [data-fk="'+_fk+'"]');
    if(!el||el===document.activeElement)return;
    el.focus({preventScroll:true});
    if(_pos!==null){try{el.setSelectionRange(_pos,_pos);}catch(e){}}
  };
  if(!S && VIEW==='sheet') VIEW='atlas';
  const P=S ? PHASES[S.step] : PHASES[0];
  if(S) updateProgressUI();

  const isSheetView = Boolean(S) && VIEW==='sheet';
  const sb=document.getElementById('samplebar');
  const hn=document.getElementById('hdrname');
  const pt=document.getElementById('progtxt');
  const pb=document.querySelector('.progress-track');
  const stBar=document.getElementById('steps');
  if(sb) sb.style.display = isSheetView ? 'flex' : 'none';
  if(hn && isSheetView) hn.textContent = get('denominazione','')||'Nuova scheda di degustazione';
  if(pt) pt.style.display = isSheetView ? '' : 'none';
  if(pb) pb.style.display = isSheetView ? '' : 'none';
  if(stBar) stBar.style.display = isSheetView ? '' : 'none';

  const ab=document.getElementById('atlasbtn');
  ab.textContent='Atlante Italia';
  ab.className='btn sm'+((VIEW==='atlas')?' primary':'');
  ab.onclick=()=>{VIEW='atlas';render();window.scrollTo(0,0);};

  const gb=document.getElementById('glossbtn');
  if(gb){
    gb.textContent='Glossario ONAF ('+ONAF_GLOSSARY.length+')';
    gb.className='btn sm'+((VIEW==='gloss')?' primary':'');
    gb.onclick=()=>{VIEW='gloss';render();window.scrollTo(0,0);};
  }

  const nb=document.getElementById('newsheetbtn');
  if(nb){
    const hasOpenSheet = Boolean(S);
    nb.textContent = isSheetView ? '+ Nuova scheda' : (hasOpenSheet ? ('Torna a: '+(get('denominazione','')||'Scheda aperta')+' ↗') : '+ Nuova scheda');
    nb.className='btn sm'+(isSheetView?' primary':'');
    nb.onclick=()=>{
      if(!isSheetView && hasOpenSheet){
        VIEW='sheet';render();window.scrollTo(0,0);
      }else{
        newSheet();
      }
    };
  }

  const cb=document.getElementById('closesheetbtn');
  if(cb){
    cb.style.display = S ? '' : 'none';
    cb.onclick=closeSheet;
  }

  const lb=document.getElementById('listbtn');
  const warnDot=(!(VIEW==='list') && needsBackup())?' •':'';
  lb.textContent='Schede ('+Object.keys(DB.sheets).length+')'+warnDot;
  lb.className='btn sm'+((VIEW==='list')?' primary':'');
  lb.onclick=()=>{VIEW='list';render();window.scrollTo(0,0);};

  document.querySelector('nav.bottom').style.display=isSheetView?'':'none';
  if((VIEW==='gloss')){
    mount(
      h('h2',{class:'phase',style:'font-size:23px'},'Glossario Tecnico per l’Assaggio dei Formaggi',h('small',{},'Definizioni ufficiali ONAF e scienza lattiero-casearia · tocca un termine sottolineato in scheda o nell’atlante per consultarlo al volo')),
      ...buildGlossaryPage()
    );
    restoreFocus();
    return;
  }
  if((VIEW==='atlas')){
    mount(
      h('h2',{class:'phase',style:'font-size:23px'},'Atlante & Degustazione Formaggi d’Italia',h('small',{},`${getFullAtlas().length} formaggi ufficiali ONAF · esplora la mappa e clicca «Degusta» per compilare la scheda`)),
      ...buildAtlasPage()
    );
    restoreFocus();
    return;
  }
  if((VIEW==='list')){
    mount(h('h2',{class:'phase'},'Le mie schede'),...buildList());
    return;
  }
  const missCount=getMissingEssential().length;
  const steps=document.getElementById('steps');steps.replaceChildren(...PHASES.map((p,i)=>{
    const isDone=phaseDone(p.id);
    const isSintesiWarn=p.id==='sintesi' && missCount>0;
    return h('button',{type:'button',class:'step'+(i===S.step?' on':(isDone?' done':'')),onclick:()=>go(i)},
      isDone?h('span',{class:'dot'}):null,
      isSintesiWarn?h('span',{class:'dot',style:'background:var(--warn)'}):null,
      p.nome);
  }));
  const prog=calcProgress();
  mount(
    h('h2',{class:'phase'},P.nome,h('small',{},`${prog.doneCount}/${prog.total} fasi compilate`)),
    ...P.build().flat()
  );
  document.getElementById('prev').disabled=S.step===0;
  document.getElementById('prev').style.opacity=S.step===0?.4:1;
  const nx=document.getElementById('next');
  nx.textContent=S.step===PHASES.length-1?'Fine':'Avanti: '+PHASES[S.step+1].nome;
  nx.style.display=S.step===PHASES.length-1?'none':'';
  window.scrollTo(0,y);
  restoreFocus();
  const on=steps.querySelector('.on'); if(on)on.scrollIntoView({block:'nearest',inline:'center'});
}
function go(i){if(!S)return;VIEW='sheet';S.step=Math.max(0,Math.min(PHASES.length-1,i));save();render();window.scrollTo(0,0);}
document.getElementById('prev').onclick=()=>{if(S)go(S.step-1);};
document.getElementById('next').onclick=()=>{if(S)go(S.step+1);};
try{
  if(S&&(typeof S.step!=='number'||S.step<0||S.step>=PHASES.length))S.step=0;
  render();
}catch(err){
  const box=document.createElement('div');box.className='miss';
  const b=document.createElement('b');b.textContent='Errore di avvio: ';
  const sm=document.createElement('small');sm.textContent=String(err&&err.stack||'');
  box.append(b,String(err&&err.message||err),document.createElement('br'),sm);
  document.getElementById('main').replaceChildren(box);
}
