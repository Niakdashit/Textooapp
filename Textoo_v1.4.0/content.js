
(function(){
  const QUICK_INTERVAL = 45;
  const FULL_DEBOUNCE  = 150;
  const TYPING_DELAY = 2000; // 2 secondes avant d'activer le soulignement
  // Limiter le nombre d'éléments DOM de soulignement affichés simultanément (modifiable via options)
  // (ne change PAS la détection ni le comptage)
  let MAX_VISIBLE_MARKERS = 800;

  function debounce(fn, delay){ let t; return function(...args){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args), delay); } }
  function throttle(fn, delay){ let last=0, pending=null; return function(...args){ const now=Date.now(); const run=()=>{ last=now; pending=null; fn.apply(this,args); }; if(now-last>=delay){ run(); } else { pending&&clearTimeout(pending); pending=setTimeout(run, delay-(now-last)); } } }
  function esc(s){ return s.replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  // Decode sequences like \u202F or \xA0 into their actual characters for display/apply
  function decodeEscapes(str){
    if (typeof str !== 'string') return str;
    return str
      .replace(/\\u([0-9a-fA-F]{4})/g, (_,h)=>String.fromCharCode(parseInt(h,16)))
      .replace(/\\x([0-9a-fA-F]{2})/g, (_,h)=>String.fromCharCode(parseInt(h,16)));
  }

  // Read CSS variable with fallback
  function getCssVar(name, fallback){
    try{
      const cs = getComputedStyle(document.documentElement);
      const v = (cs.getPropertyValue(name) || '').trim();
      return v || fallback;
    }catch(_){ return fallback; }
  }
  function getErrorColor(){ return getCssVar('--textoo-error', '#d81b60'); }
  
  // Avoir + infinitif -> participe passé (doublon de la logique overlay, mais local à Assist)
  function a_toPP_A(inf){
    const base = (inf||'').toLowerCase();
    // Utiliser la table IRREG_PP2 (définie plus bas)
    if(typeof IRREG_PP2!== 'undefined' && IRREG_PP2[base]) return IRREG_PP2[base];
    if(base.endsWith('er')) return base.slice(0,-2)+'é';
    if(base.endsWith('ir')) return base.slice(0,-2)+'i';
    if(base.endsWith('re')) return base.slice(0,-2)+'u';
    return null;
  }
  // Éditeur actif pour sites génériques (hors Gmail/Outlook)
  function findActiveGenericEditableForFab(){
    const genericSel = 'textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input:not([type]), [contenteditable=""], [contenteditable="true"]';
    // Priorité 0: dernier champ actif connu
    try{
      if(typeof __activeEditable !== 'undefined' && __activeEditable && __activeEditable.isConnected){
        const ae = document.activeElement;
        if(ae && (__activeEditable===ae || (__activeEditable.contains && __activeEditable.contains(ae)))){
          const r0 = __activeEditable.getBoundingClientRect();
          if(r0 && r0.width>0 && r0.height>0) return __activeEditable;
        }
      }
    }catch(_){ }
    // Cas spécifique Google: privilégier la barre de recherche principale uniquement si elle a le focus
    try{
      const hn = (location.hostname||'');
      if(/\.google\./.test(hn)){
        const g = document.querySelector('input[name="q"], textarea[name="q"]');
        if(g && document.activeElement === g && isTopEditable(g)) return g;
      }
    }catch(_){ }
    // Cas spécifique lovable.dev: ne retourner que l'éditeur principal quand il a le focus
    try{
      const hn = (location.hostname||'');
      if(/(^|\.)lovable\.dev$/.test(hn)){
        const ae = document.activeElement;
        // Chercher le conteneur contenteditable le plus proche autour de l'élément actif
        let cont = null;
        if(ae){
          cont = (ae.matches && ae.matches('[contenteditable=""],[contenteditable="true"],[role="textbox"]')) ? ae : (ae.closest && ae.closest('[contenteditable=""],[contenteditable="true"],[role="textbox"]'));
        }
        // Si non trouvé, essayer depuis la sélection courante (utile pour éditeurs riches)
        if(!cont){
          try{
            const sel = window.getSelection && window.getSelection();
            if(sel && sel.rangeCount){
              const anchor = sel.anchorNode;
              if(anchor){
                const el = (anchor.nodeType===1 ? anchor : anchor.parentElement);
                if(el){
                  cont = (el.matches && el.matches('[contenteditable=""],[contenteditable="true"],[role="textbox"]')) ? el : (el.closest && el.closest('[contenteditable=""],[contenteditable="true"],[role="textbox"]'));
                }
                // Dernier essai: composedPath() si dispo
                if(!cont && sel.getRangeAt){
                  const r = sel.getRangeAt(0);
                  const n = r.commonAncestorContainer;
                  const el2 = (n.nodeType===1 ? n : n.parentElement);
                  if(el2){
                    cont = (el2.matches && el2.matches('[contenteditable=""],[contenteditable="true"],[role="textbox"]')) ? el2 : (el2.closest && el2.closest('[contenteditable=""],[contenteditable="true"],[role="textbox"]'));
                  }
                }
              }
            }
          }catch(_){ }
        }
        if(cont && isTopEditable(cont)){
          const r = cont.getBoundingClientRect();
          if(r && r.width>0 && r.height>0) return cont;
        }
      }
    }catch(_){ }
    // Priorité 1: élément actif top-level
    const ae = document.activeElement;
    if(ae && (ae.matches?.(genericSel) || ae.closest?.(genericSel))){
      const top = ae.matches?.(genericSel) ? ae : ae.closest?.(genericSel);
      if(top && isTopEditable(top)) return top;
    }
    // Priorité 2: sélection courante
    try{
      const sel = window.getSelection();
      if(sel && sel.rangeCount){
        const node = sel.getRangeAt(0).commonAncestorContainer;
        const el = (node.nodeType===1?node:node.parentNode);
        const cont = el && el.closest ? el.closest(genericSel) : null;
        // Ne retourner le conteneur que s'il est aussi l'élément actif (on veut n'afficher que là où on saisit)
        if(cont && isTopEditable(cont) && document.activeElement && (document.activeElement===cont || cont.contains(document.activeElement))) return cont;
      }
    }catch(_){ }
    // Priorité 3: premier champ éditable visible
    // Ne rien retourner ici pour éviter d'afficher le FAB hors saisie active
    return null;
  }
  function a_buildAvoirInfMatches2(idx){
    const t = idx.text || '';
    const out = [];
    const re = /(j['’]ai|tu\s+as|il\s+a|elle\s+a|on\s+a|nous\s+avons|vous\s+avez|ils\s+ont|elles\s+ont)\s+([A-Za-zÀ-ÖØ-öø-ÿ']{2,})\b/gi;
    let m; while((m=re.exec(t))){
      const inf = m[2]; if(!/(er|ir|re)$/i.test(inf)) continue; const pp=a_toPP_A(inf); if(!pp) continue;
      const start = m.index + m[0].lastIndexOf(inf);
      out.push({ offset:start, length:inf.length, value:pp, alts:[pp] });
    }
    return out;
  }
  // Heuristique sûre pour "être + infinitif" -> participe passé (passé composé / passif simple)
  const ETRE_FORMS = [
    "je suis","tu es","il est","elle est","on est","nous sommes","vous êtes","ils sont","elles sont",
    "j'étais","tu étais","il était","elle était","on était","nous étions","vous étiez","ils étaient","elles étaient"
  ];
  const IRREG_PP2 = {
    'prendre':'pris','apprendre':'appris','comprendre':'compris','surprendre':'surpris',
    'faire':'fait','défaire':'défait','satisfaire':'satisfait',
    'dire':'dit','redire':'re-dit',
    'voir':'vu','revoir':'revu','entrevoir':'entrevu',
    'pouvoir':'pu','vouloir':'voulu','devoir':'dû','savoir':'su',
    'mettre':'mis','permettre':'permis','admettre':'admis','promettre':'promis','soumettre':'soumis',
    'écrire':'écrit','décrire':'décrit','inscrire':'inscrit',
    'lire':'lu','relire':'relu','élire':'élu',
    'ouvrir':'ouvert','offrir':'offert','souffrir':'souffert','découvrir':'découvert',
    'tenir':'tenu','obtenir':'obtenu','retenir':'retenu',
    'venir':'venu','devenir':'devenu','revenir':'revenu',
    'recevoir':'reçu','apercevoir':'aperçu','concevoir':'conçu','percevoir':'perçu',
    'suivre':'suivi','vivre':'vécu','naître':'né','mourir':'mort','rire':'ri','sourire':'souri',
    'aller':'allé','rester':'resté','arriver':'arrivé','partir':'parti','sortir':'sorti','entrer':'entré','retourner':'retourné'
  };
  function a_toPP2(inf){
    const base = (inf||'').toLowerCase();
    if(IRREG_PP2[base]) return IRREG_PP2[base];
    if(base.endsWith('er')) return base.slice(0,-2)+'é';
    if(base.endsWith('ir')) return base.slice(0,-2)+'i';
    if(base.endsWith('re')) return base.slice(0,-2)+'u';
    return null;
  }
  function a_buildEtreInfMatches(idx){
    const t = idx.text || '';
    const out = [];
    const re = /(je\s+suis|tu\s+es|il\s+est|elle\s+est|on\s+est|nous\s+sommes|vous\s+êtes|ils\s+sont|elles\s+sont|j['’]étais|tu\s+étais|il\s+était|elle\s+était|on\s+était|nous\s+étions|vous\s+étiez|ils\s+étaient|elles\s+étaient)\s+([A-Za-zÀ-ÖØ-öø-ÿ']{2,})\b/gi;
    let m; while((m=re.exec(t))){
      const inf = m[2]; if(!/(er|ir|re)$/i.test(inf)) continue; const pp=a_toPP2(inf); if(!pp) continue;
      const start = m.index + m[0].lastIndexOf(inf);
      out.push({ offset:start, length:inf.length, value:pp, alts:[pp] });
    }
    return out;
  }
  function a_buildCTetaitMatches(idx){
    const t = idx.text || '';
    const out = [];
    // variantes fautives courantes: c'etais, cetais, c etais
    const re = /\b(c['’]?\s?etais)\b/gi;
    let m; while((m=re.exec(t))){
      out.push({ offset:m.index, length:m[1].length, value:"c'était", alts:["c'était"] });
    }
    return out;
  }
  // Heuristique sûre: auxiliaire "avoir" + infinitif -> participe passé
  const AVOIR_FORMS = [
    "j'ai","tu as","il a","elle a","on a","nous avons","vous avez","ils ont","elles ont"
  ];
  const IRREG_PP = {
    'prendre':'pris','apprendre':'appris','comprendre':'compris','surprendre':'surpris',
    'faire':'fait','défaire':'défait','satisfaire':'satisfait',
    'dire':'dit','redire':'re-dit',
    'voir':'vu','revoir':'revu','entrevoir':'entrevu',
    'pouvoir':'pu','vouloir':'voulu','devoir':'dû','savoir':'su',
    'mettre':'mis','permettre':'permis','admettre':'admis','promettre':'promis','soumettre':'soumis',
    'écrire':'écrit','décrire':'décrit','inscrire':'inscrit',
    'lire':'lu','relire':'relu','élire':'élu',
    'ouvrir':'ouvert','offrir':'offert','souffrir':'souffert','découvrir':'découvert',
    'tenir':'tenu','obtenir':'obtenu','retenir':'retenu',
    'venir':'venu','devenir':'devenu','revenir':'revenu',
    'recevoir':'reçu','apercevoir':'aperçu','concevoir':'conçu','percevoir':'perçu',
    'suivre':'suivi','vivre':'vécu','naître':'né','mourir':'mort','rire':'ri','sourire':'souri'
  };
  function a_toParticipePasse(inf){
    const base = inf.toLowerCase();
    if(IRREG_PP[base]){
      const pp = IRREG_PP[base];
      // respecter la casse initiale de l'infinitif
      return inf[0]===inf[0].toUpperCase() ? pp.charAt(0).toUpperCase()+pp.slice(1) : pp;
    }
    if(base.endsWith('er')) return inf.slice(0,-2) + 'é';
    if(base.endsWith('ir')) return inf.slice(0,-2) + 'i';
    if(base.endsWith('re')) return inf.slice(0,-2) + 'u';
    return null;
  }
  function a_buildAvoirInfMatches(idx){
    const t = idx.text;
    const results = [];
    // Autoriser un espace simple entre auxiliaire et verbe, pas de saut de ligne
    // Capturer la position exacte de l'infinitif (groupe 2)
    const re = /(j'ai|tu\s+as|il\s+a|elle\s+a|on\s+a|nous\s+avons|vous\s+avez|ils\s+ont|elles\s+ont)\s+([A-Za-zÀ-ÖØ-öø-ÿ']{2,})\b/g;
    let m;
    while((m = re.exec(t))){
      const inf = m[2];
      // s'assurer que c'est bien un infinitif courant
      if(!/(er|ir|re)$/i.test(inf)) continue;
      const pp = a_toParticipePasse(inf);
      if(!pp) continue;
      const infStart = m.index + m[0].lastIndexOf(inf);
      results.push({ offset: infStart, length: inf.length, value: pp, alts:[pp] });
    }
    return results;
  }

  const FR_WORDS = new Set(["le","la","les","des","un","une","et","ou","de","du","que","qui","pas","ne","je","tu","il","elle","on","nous","vous","ils","elles","est","sont","à","au","aux","dans","pour","avec","ce","cet","cette","ces"]);
  const EN_WORDS = new Set(["the","a","an","and","or","of","to","in","for","with","is","are","i","you","he","she","we","they","it","this","that","these","those","on","at","as","be","have","has","do","does"]);
  const ES_WORDS = new Set(["el","la","los","las","un","una","y","o","de","del","que","quien","no","yo","tu","él","ella","nosotros","vosotros","ellos","ellas","es","son","en","para","con","este","esta","estos","estas","a"]);
  const IS_GMAIL = typeof location !== 'undefined' && /mail\.google\.com$/.test(location.hostname);
  const IS_OUTLOOK = typeof location !== 'undefined' && /outlook\.(live|office)\.com$/.test(location.hostname);
  // Preference: disable thin non-breaking space suggestions before ?!;:
  let DISABLE_THIN_SPACE = false;
  // New prefs (overridable via options)
  let PREF_FORCE_LANG = 'auto'; // 'auto' | 'fr' | 'en' | 'es'
  let PREF_MULTI_BY_SENTENCE = true;
  let PREF_LONG_SENTENCE = 33;
  let PREF_DEBUG = false;
  function loadUserPrefs(){
    try{
      // chrome.storage (sync then local)
      chrome.storage?.sync?.get?.(['disableThinSpace','forceLang','multiBySentence','maxMarkers','longSentence','debugLogs'], (res)=>{
        if (res && typeof res.disableThinSpace === 'boolean') DISABLE_THIN_SPACE = !!res.disableThinSpace;
        if (res && typeof res.forceLang === 'string') PREF_FORCE_LANG = res.forceLang || 'auto';
        if (res && typeof res.multiBySentence === 'boolean') PREF_MULTI_BY_SENTENCE = !!res.multiBySentence;
        if (res && typeof res.maxMarkers === 'number') MAX_VISIBLE_MARKERS = Math.max(200, Math.min(5000, res.maxMarkers|0));
        if (res && typeof res.longSentence === 'number') PREF_LONG_SENTENCE = Math.max(20, Math.min(60, res.longSentence|0));
        if (res && typeof res.debugLogs === 'boolean') PREF_DEBUG = !!res.debugLogs;
        try{
          chrome.storage?.local?.get?.(['disableThinSpace','forceLang','multiBySentence','maxMarkers','longSentence','debugLogs'], (loc)=>{
            if (loc && typeof loc.disableThinSpace === 'boolean') DISABLE_THIN_SPACE = !!loc.disableThinSpace;
            if (loc && typeof loc.forceLang === 'string') PREF_FORCE_LANG = loc.forceLang || PREF_FORCE_LANG;
            if (loc && typeof loc.multiBySentence === 'boolean') PREF_MULTI_BY_SENTENCE = !!loc.multiBySentence;
            if (loc && typeof loc.maxMarkers === 'number') MAX_VISIBLE_MARKERS = Math.max(200, Math.min(5000, loc.maxMarkers|0));
            if (loc && typeof loc.longSentence === 'number') PREF_LONG_SENTENCE = Math.max(20, Math.min(60, loc.longSentence|0));
            if (loc && typeof loc.debugLogs === 'boolean') PREF_DEBUG = !!loc.debugLogs;
          });
        }catch(_){ /* no-op */ }
      });
    }catch(_){ /* no-op */ }
    // Fallback localStorage
    try{
      const ds = localStorage.getItem('Textoo_DisableThinSpace');
      if (ds != null) DISABLE_THIN_SPACE = (ds === '1');
    }catch(_){ /* no-op */ }
    // Expose thresholds for offline rules (initial exposure; will be updated on storage changes too)
    try{ window.TextooPrefs = Object.assign({}, window.TextooPrefs||{}, { longSentence: PREF_LONG_SENTENCE }); }catch(_){ }
    // Listen for runtime changes
    try{
      chrome.storage?.onChanged?.addListener?.((changes, area)=>{
        if ((area==='sync' || area==='local') && changes){
          if (changes.disableThinSpace) DISABLE_THIN_SPACE = !!changes.disableThinSpace.newValue;
          if (changes.forceLang && typeof changes.forceLang.newValue === 'string') PREF_FORCE_LANG = changes.forceLang.newValue || 'auto';
          if (changes.multiBySentence) PREF_MULTI_BY_SENTENCE = !!changes.multiBySentence.newValue;
          if (changes.maxMarkers && typeof changes.maxMarkers.newValue === 'number') MAX_VISIBLE_MARKERS = Math.max(200, Math.min(5000, changes.maxMarkers.newValue|0));
          if (changes.longSentence && typeof changes.longSentence.newValue === 'number') { PREF_LONG_SENTENCE = Math.max(20, Math.min(60, changes.longSentence.newValue|0)); try{ window.TextooPrefs = Object.assign({}, window.TextooPrefs||{}, { longSentence: PREF_LONG_SENTENCE }); }catch(_){ } }
          if (changes.debugLogs) PREF_DEBUG = !!changes.debugLogs.newValue;
        }
      });
    }catch(_){ /* no-op */ }
  }
  loadUserPrefs();
  function isProbablyFrench(text){ const words=text.toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿœ'-]+/i).filter(Boolean); if(words.length<3) return true; let hits=0; for(const w of words) if(FR_WORDS.has(w)) hits++; return (hits/words.length)>=0.12; }

function detectLanguageSimple(text){
  try{
    const words = text.toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿœ'-]+/i).filter(Boolean);
    if(words.length < 3) return 'fr';
    let fr=0,en=0,es=0;
    for(const w of words){ if(FR_WORDS.has(w)) fr++; if(EN_WORDS.has(w)) en++; if(ES_WORDS.has(w)) es++; }
    const total = Math.max(1, words.length);
    const rf = fr/total, re=en/total, rs=es/total;
    let lang='fr', score=rf;
    if(re>score){ lang='en'; score=re; }
    if(rs>score){ lang='es'; score=rs; }
    // seuil minimal pour accepter autre que FR
    if(lang!=='fr' && score < 0.08) return 'fr';
    return lang;
  }catch(_){ return 'fr'; }
}

// Découpage simple en phrases avec positions (local à l'IIFE overlay)
function splitSentencesSimple(text){
  const out=[]; const rx=/([.!?…]+)(\s+|$)/g; let m; let start=0;
  while((m=rx.exec(text))){ const end = m.index + (m[1]?.length||0); const slice=text.slice(start,end); if(slice.trim().length){ out.push({start, end, text:slice}); } start = m.index + m[0].length; }
  if(start<text.length){ const slice=text.slice(start); if(slice.trim().length){ out.push({start, end:text.length, text:slice}); } }
  return out;
}

  function isBlock(el){ if (!el || el.nodeType!==1) return false; return /^(DIV|P|LI|UL|OL|TABLE|TBODY|TR|TD|SECTION|ARTICLE|HEADER|FOOTER|H[1-6]|BLOCKQUOTE)$/.test(el.tagName); }
  function childIndex(node){ return Array.prototype.indexOf.call(node.parentNode ? node.parentNode.childNodes : [], node); }

  function buildIndexer(root){
    let text = ""; const segments = []; let lastTextNode=null;
    function walk(node){
      for (let child = node.firstChild; child; child = child.nextSibling){
        if (child.nodeType === 3){
          const t = child.nodeValue || "";
          if (t.length){ segments.push({ type:'text', node: child, start: text.length, length: t.length }); text += t; lastTextNode=child; }
        } else if (child.nodeType === 1){
          if (child.tagName === 'BR'){ const parent=child.parentNode; segments.push({ type:'br', node: child, parent, afterIndex: childIndex(child)+1, start: text.length, length: 1 }); text += "\n"; }
          else { const before=text.length; walk(child); const contributed=text.length-before; if (isBlock(child) && contributed>0 && text.slice(-1)!=="\n"){ segments.push({ type:'blocksep', node: child, ref:lastTextNode, start: text.length, length: 1 }); text += "\n"; } }
        }
      }
    }
    walk(root);
    return { text, segments };
  }
  function posFromIndex(root, index, indexer){
    const segs=indexer.segments; if(index>=indexer.text.length){ const last=segs[segs.length-1]; if(last&&last.type==='text') return {node:last.node, offset:last.node.nodeValue.length}; return {node:root, offset:(root.childNodes?root.childNodes.length:0)}; }
    for(const s of segs){ if(index < s.start + s.length){ if(s.type==='text') return {node:s.node, offset:index - s.start}; if(s.type==='br') return {node:s.parent, offset:s.afterIndex}; if(s.type==='blocksep'){ if(s.ref) return {node:s.ref, offset:s.ref.nodeValue.length}; return {node:root, offset:(root.childNodes?root.childNodes.length:0)}; } } }
    return {node:root, offset:(root.childNodes?root.childNodes.length:0)};
  }
  function indexFromSelection(root, indexer){
    const sel=window.getSelection(); if(!sel || sel.rangeCount===0) return indexer.text.length;
    const r=sel.getRangeAt(0); const {startContainer, startOffset}=r;
    let idx=0;
    for(const s of indexer.segments){
      if(s.type==='text'){
        if(s.node===startContainer){ idx = s.start + Math.min(startOffset, s.length); return idx; }
        idx = s.start + s.length;
      } else {
        idx = s.start + s.length;
      }
    }
    return idx;
  }

  let popover;
  function ensurePopover(){ if(!popover){ popover=document.createElement("div"); popover.className="textoo-popover"; popover.style.display="none"; document.documentElement.appendChild(popover);
    document.addEventListener("click",(e)=>{ if(!popover.contains(e.target)) hidePopover(); },true); window.addEventListener("scroll",()=>hidePopover(),true); window.addEventListener("resize",()=>hidePopover(),true);} }
  function hidePopover(){ if(popover) popover.style.display="none"; }
  function showPopover(x,y,data,applyCb,ignoreCb){
    ensurePopover(); const { message, replacements, rule } = data; const title = rule?.description || "Suggestion"; const suggs = (replacements||[]).slice(0,6);
    popover.innerHTML = `<div class="textoo-popover-header">${esc(title)}</div><div>${esc(message||"Amélioration proposée")}</div>${suggs.length?`<div style="margin-top:6px;">${suggs.map(s=>{ const dec = decodeEscapes(String(s.value)); return `<span class=\"textoo-suggest\" data-v=\"${esc(dec)}\">${esc(dec)}</span>`; }).join("")}</div>`:""}<div class="textoo-actions"><button class="textoo-btn" data-act="ignore">Ignorer</button><button class="textoo-btn" data-act="recheck">Vérifier à nouveau</button></div>`;
    // Afficher d'abord pour mesurer
    popover.style.display = "block";
    // Largeur max responsive (au cas où la CSS n'est pas chargée)
    try{ popover.style.maxWidth = Math.min(360, window.innerWidth - 16) + 'px'; }catch(_){ }
    // Position initiale souhaitée
    let left = x;
    let top  = y;
    // Mesurer puis borner aux limites du viewport
    const rect = popover.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth || 1024;
    const vh = window.innerHeight || document.documentElement.clientHeight || 768;
    const pad = 8;
    // Clamp horizontal
    left = Math.min(Math.max(pad, left), vw - rect.width - pad);
    // Si dépasse en bas, remonter; sinon s'assurer marge haute
    top = Math.min(Math.max(pad, top), vh - rect.height - pad);
    popover.style.left = left + 'px';
    popover.style.top  = top + 'px';
    popover.querySelectorAll(".textoo-suggest").forEach(el=>el.addEventListener("click",()=>{ applyCb(el.getAttribute("data-v")); hidePopover(); }));
    popover.querySelector('[data-act="ignore"]').addEventListener("click",()=>{ ignoreCb(); hidePopover(); });
    popover.querySelector('[data-act="recheck"]').addEventListener("click",()=>{ ignoreCb(false); hidePopover(); });
  }

  class FieldWatcher {
    constructor(el){
      this.el=el; this.overlay=document.createElement("div"); this.overlay.className="textoo-overlay";
      // S'assurer que l'overlay est présent dans le DOM pour afficher les soulignements
      try{ (document.body||document.documentElement).appendChild(this.overlay); }catch(_){ }
      // Le badge rouge original est remplacé par le FAB, donc on ne le crée pas
      this.results=[]; this.ignoredOffsets=new Set(); this.indexer={text:"",segments:[]}; this.isProgrammatic=false;
      // Important: activer le watcher par défaut pour conserver le soulignement/compteur
      this.isEnabled = true;
      this.scanRID=0; this.lastQuickText=""; this.lastText="";
      this.quickScanThrottled = throttle(()=>this.quickScan(), QUICK_INTERVAL);
      this.fullScanDebounced  = debounce(()=>this.fullScan(), FULL_DEBOUNCE);
      this.destroyed=false;
      // Variables pour gérer le délai de frappe
      this.typingTimeout = null;
      this.isTyping = false;
      this.lastTypingTime = 0;
      // Variables pour gérer les corrections
      this.isCorrecting = false;
      this.correctionTimeout = null;
      this.repositionHandler=null;
      this.boundSyncScroll=null;
      // Watchdog: certains sites remplacent des nœuds (Gmail/Outlook). Ré-attacher l'overlay si nécessaire.
      this._overlayGuard = setInterval(()=>{
        try{
          if(this.destroyed || !this.overlay) return;
          // Si le noeud surveillé est détaché, auto-récupération: détruire ce watcher et relancer un scan global
          if(!this.el || !this.el.isConnected){
            try{ this.destroy(); }catch(_){ }
            try{ if(typeof scanForFields === 'function') scanForFields(); }catch(_){ }
            return;
          }
          const root = document.body || document.documentElement;
          if(this.overlay && !root.contains(this.overlay)){
            root.appendChild(this.overlay);
            // Repositionner immédiatement et conserver l'état visible
            this.positionOverlay();
            // Ne pas forcer de re-scan ici; l'affichage est suffisant
          }
          
          // Ne plus nettoyer automatiquement les soulignements
          // Ils doivent rester visibles même quand l'utilisateur arrête de taper
        }catch(_){ /* no-op */ }
      }, 2000);
      // Observer local du DOM du composeur pour r e9agir imm e9diatement aux mutations Gmail/Outlook
      try{
        this.domObserver = new MutationObserver(()=>{
          if(this.destroyed) return;
          this.positionOverlay();
          if(this.isEnabled){ this.quickScanThrottled(); this.fullScanDebounced(); }
        });
        this.domObserver.observe(this.el, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['style','dir','lang','spellcheck','contenteditable'] });
      }catch(_){ this.domObserver=null; }
      // Observer de redimensionnement du composeur
      try{
        if(window.ResizeObserver){
          this.resizeObs = new ResizeObserver(()=>{ if(this.destroyed) return; this.positionOverlay(); });
          this.resizeObs.observe(this.el);
        }
      }catch(_){ this.resizeObs=null; }
      this.handleEvents(); this.positionOverlay(); this.syncOverlayScroll(); this.quickScan(); this.fullScan();
    }
    handleEvents(){
      try{ this.el.spellcheck=false; }catch(e){}
      this.el.addEventListener("input", ()=>{
        if (!this.isProgrammatic) this.optimisticClearNearCaret();
        this.handleTyping();
        // Ne pas scanner pendant les corrections pour éviter le scintillement
        if(!this.isCorrecting) {
          this.quickScanThrottled();
          this.fullScanDebounced();
        }
      }, {passive:true});
      ["keyup","change","paste","cut"].forEach(e=>this.el.addEventListener(e, ()=>{ 
        this.handleTyping(); 
        // Ne pas scanner pendant les corrections pour éviter le scintillement
        if(!this.isCorrecting) {
          this.quickScanThrottled(); 
          this.fullScanDebounced(); 
        }
      }, {passive:true}));
      
      // Gérer la perte de focus - arrêter la détection mais garder les soulignements
      this.el.addEventListener("blur", ()=>{
        if(this.destroyed) return;
        // Arrêter la détection de frappe mais garder les soulignements visibles
        this.isTyping = false;
        if(this.typingTimeout) {
          clearTimeout(this.typingTimeout);
          this.typingTimeout = null;
        }
      }, {passive:true});
      this.boundSyncScroll = ()=>this.syncOverlayScroll();
      this.el.addEventListener("scroll", this.boundSyncScroll, {passive:true});
      this.repositionHandler = ()=>this.positionOverlay();
      window.addEventListener("scroll", this.repositionHandler, true);
      window.addEventListener("resize", this.repositionHandler, true);
      this.overlay.addEventListener("click",(e)=>{
        if(!this.isEnabled) return;
        const marker=e.target.closest(".textoo-marker, .textoo-highlight"); 
        if(!marker) return;
        
        // S'assurer que c'est bien un clic direct sur le marqueur, pas un survol
        e.preventDefault();
        e.stopPropagation();
        
        const idx=Number(marker.getAttribute("data-idx")); 
        const m=this.results[idx]; 
        if(!m) return;
        
        const r=marker.getBoundingClientRect();
        const apply=(val)=>this.applyReplacement(m.offset,m.length,val,m.rule?.id);
        const ignore=(persist=true)=>{
          if(persist!==false) this.ignoredOffsets.add(m.offset);
          this.results = this.results.filter(res => !(res.offset===m.offset && res.length===m.length));
          this.render();
        };
        showPopover(r.left, r.bottom+6, m, apply, ignore);
      });

      // Click directly on the underlying word (contenteditable) to open the popover
      if (this.el.isContentEditable){
        this.el.addEventListener("click", (ev)=>{
          if(!this.isEnabled){ hidePopover(); return; }
          // compute caret index, find match containing caret
          try{
            // rebuild indexer to be safe with latest DOM
            this.indexer = buildIndexer(this.el);
            const caret = indexFromSelection(this.el, this.indexer);
            const m = this.results.find(mm => caret >= mm.offset && caret <= mm.offset + mm.length);
            if(m){
              // place popover at range end
              const startPos = posFromIndex(this.el, m.offset, this.indexer);
              const endPos   = posFromIndex(this.el, m.offset+m.length, this.indexer);
              const rr = document.createRange(); rr.setStart(startPos.node, startPos.offset); rr.setEnd(endPos.node, endPos.offset);
              const rects = rr.getClientRects(); const rect = rects[rects.length-1] || rr.getBoundingClientRect();
              const apply=(val)=>this.applyReplacement(m.offset,m.length,val,m.rule?.id);
              const ignore=(persist=true)=>{
                if(persist!==false) this.ignoredOffsets.add(m.offset);
                this.results = this.results.filter(res => !(res.offset===m.offset && res.length===m.length));
                this.render();
              };
              showPopover(rect.left, rect.bottom+6, m, apply, ignore);
            }
          }catch(e){}
        }, {passive:true});
      }
    }
    
    handleTyping(){
      if(this.destroyed) return;
      
      // Marquer que l'utilisateur est en train de taper
      this.isTyping = true;
      this.lastTypingTime = Date.now();
      
      // Annuler le timeout précédent s'il existe
      if(this.typingTimeout) {
        clearTimeout(this.typingTimeout);
        this.typingTimeout = null;
      }
      
      // Programmer l'arrêt de la détection de frappe après 2 secondes
      // Mais NE PAS nettoyer les soulignements - ils doivent rester visibles
      this.typingTimeout = setTimeout(() => {
        this.isTyping = false;
        this.typingTimeout = null;
        // Les soulignements restent visibles même après l'arrêt de frappe
      }, TYPING_DELAY);
    }
    
    clearUnderlinesIfNotTyping(){
      // Cette méthode n'est plus utilisée car les soulignements doivent persister
      // même quand l'utilisateur arrête de taper
      return;
    }
    
    // Méthode pour vérifier si l'utilisateur est vraiment en train de taper
    isUserActuallyTyping(){
      if(this.destroyed) return false;
      
      // Vérifier que l'élément a le focus
      if(document.activeElement !== this.el) return false;
      
      // Vérifier que l'utilisateur a tapé récemment
      const timeSinceLastTyping = Date.now() - this.lastTypingTime;
      return timeSinceLastTyping < TYPING_DELAY;
    }
    
    
    toggleEnabled(){ this.setEnabled(!this.isEnabled); }
    setEnabled(state){
      if(this.isEnabled===state) return;
      this.isEnabled=state;
      hidePopover();
      this.render();
      if(state){ this.quickScan(); this.fullScanDebounced(); }
    }
    destroy(){
      if(this.destroyed) return;
      this.destroyed=true;
      try{ if(this._overlayGuard){ clearInterval(this._overlayGuard); this._overlayGuard=null; } }catch(_){ }
      try{ if(this.domObserver){ this.domObserver.disconnect(); this.domObserver=null; } }catch(_){ }
      try{ if(this.resizeObs && this.resizeObs.unobserve){ this.resizeObs.unobserve(this.el); this.resizeObs.disconnect?.(); this.resizeObs=null; } }catch(_){ }
      try{ if(this.boundSyncScroll) this.el.removeEventListener('scroll', this.boundSyncScroll); }catch(_){ }
      try{ if(this.repositionHandler){ window.removeEventListener('scroll', this.repositionHandler, true); window.removeEventListener('resize', this.repositionHandler, true); } }catch(_){ }
      // Nettoyer les timeouts
      try{ if(this.typingTimeout){ clearTimeout(this.typingTimeout); this.typingTimeout=null; } }catch(_){ }
      try{ if(this.correctionTimeout){ clearTimeout(this.correctionTimeout); this.correctionTimeout=null; } }catch(_){ }
      if(this.overlay && this.overlay.parentNode) this.overlay.parentNode.removeChild(this.overlay);
      hidePopover();
      this.boundSyncScroll=null;
      this.repositionHandler=null;
      this.overlay=null;
      this.el=null;
    }
    positionOverlay(){
      if(this.destroyed || !this.overlay) return;
      if(!this.el || !this.el.isConnected){ this.destroy(); return; }
      const r=this.el.getBoundingClientRect();
      if(!r || (r.width===0 && r.height===0)){
        this.overlay.style.visibility='hidden';
        return;
      }
      this.overlay.style.visibility='visible';
      const s=window.getComputedStyle(this.el);
      Object.assign(this.overlay.style,{left:(r.left+window.scrollX)+"px",top:(r.top+window.scrollY)+"px",width:r.width+"px",height:r.height+"px",padding:s.padding,font:s.font,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing,whiteSpace:"pre-wrap",direction:s.direction});
      // Le repositionnement du FAB est géré par positionFabAndMenu()
    }
    syncOverlayScroll(){ if(this.destroyed || !this.overlay) return; this.overlay.scrollTop=this.el.scrollTop; this.overlay.scrollLeft=this.el.scrollLeft; }
    setBadge(n){
      // Le compteur est maintenant géré par le FAB via updateFabCounter()
      // Exposer le compteur sur l'élément observé pour que l'autre module puisse le lire
      try { if (this.el && this.el.setAttribute) this.el.setAttribute('data-textoo-count', String(n)); } catch(_){ }
      // Synchroniser le compteur du FAB pour CE composer précis (avec override du nombre)
      try{ updateFabCounter(this.el, n); }catch(_){ }
    }

    getLinearized(){
      if (this.el.isContentEditable){
        this.indexer = buildIndexer(this.el);
        return this.indexer.text;
      } else {
        const v = this.el.value || "";
        this.indexer = { text:v, segments:[{type:'text', node:this.el, start:0, length:v.length}] };
        return v;
      }
    }
    getValue(){ return this.getLinearized(); }

    optimisticClearNearCaret(){
      if(!this.isEnabled) return;
      const text = this.getLinearized();
      let pos = text.length;
      if (this.el.isContentEditable){
        pos = indexFromSelection(this.el, this.indexer);
      } else if (this.el instanceof HTMLInputElement || this.el instanceof HTMLTextAreaElement){
        try{ pos=this.el.selectionStart; }catch(e){}
      }
      this.results = this.results.filter(m => (m.offset + m.length < pos - 2) || (m.offset > pos + 2));
      this.render();
    }
    rebaseMatches(start, delta){ if(!delta) return; this.results=this.results.map(m => (m.offset>=start?Object.assign({},m,{offset:m.offset+delta}):m)); }
    normalize(matches){
      if(!matches) return [];
      let arr = matches.map(m=>({offset:m.offset,length:m.length,message:m.message||m.shortMessage||"",replacements:(m.replacements||[]).slice(0,6),rule:m.rule||{id:"GENERIC",description:m.shortMessage||"Suggestion"},type:m.type||m.rule?.issueType||"grammar"}));
      // Apply user preferences
      if (DISABLE_THIN_SPACE){
        arr = arr.filter(m => (m.rule?.id) !== 'OFF_ESPACE_AVANT_PONCT');
      }
      arr.sort((a,b)=>a.offset-b.offset||b.length-a.length);
      return arr.filter(m=>!this.ignoredOffsets.has(m.offset));
    }
    hasDiff(a,b){ if(a.length!==b.length) return true; for(let i=0;i<a.length;i++){ const x=a[i], y=b[i]; if(x.offset!==y.offset||x.length!==y.length||x.message!==y.message) return true; } return false; }

    quickScan(){
      if(this.destroyed || !this.overlay) return;
      if(!this.isEnabled) return;
      // Ne pas scanner si l'utilisateur n'est pas en train de taper
      if(!this.isUserActuallyTyping()) return;
      // Ne pas scanner pendant les corrections pour éviter le scintillement
      if(this.isCorrecting) return;
      const text=this.getLinearized();
      if(!text.trim().length){
        this.lastQuickText = text;
        if(this.results.length){ this.results=[]; }
        this.render();
        return;
      }
      if(text===this.lastQuickText) return;
      this.lastQuickText=text;
      let off={matches:[]};
      try{ off=window.TextooOfflineChecker.check(text); }catch(e){ off={matches:[]}; }
      const matches=this.normalize(off.matches);
      if(matches.length===0){
        if(this.results.length){ this.results=[]; }
        this.render();
        try{ updateFabCounter(this.el, 0); }catch(_){ }
        return;
      }
      if(this.hasDiff(this.results,matches)){ this.results=matches; this.render(); }
      // Mettre à jour le FAB même si le rendu n'a pas changé visuellement
      try{ updateFabCounter(this.el, (this.results||[]).length); }catch(_){ }
    }

    async fullScan(){ if(this.destroyed || !this.overlay) return; if(!this.isEnabled) return; 
      // Ne pas scanner si l'utilisateur n'est pas en train de taper
      if(!this.isUserActuallyTyping()) return;
      // Ne pas scanner pendant les corrections pour éviter le scintillement
      if(this.isCorrecting) return; const text=this.getLinearized(); if(!text||text.trim().length===0){ this.results=[]; this.render(); return; } if(text===this.lastText) return; this.lastText=text; const rid=++this.scanRID;
      // offline merge
      let off={matches:[]}; try{ off=window.TextooOfflineChecker.check(text); }catch(e){ off={matches:[]}; } const offlineMapped=this.normalize(off.matches);
      if(offlineMapped.length===0 && this.results.length>0){ /* keep */ } else { const merged=[...this.results]; offlineMapped.forEach(m=>{ if(!merged.some(u=>Math.max(u.offset,m.offset)<Math.min(u.offset+u.length,m.offset+m.length))) merged.push(m); }); merged.sort((a,b)=>a.offset-b.offset||b.length-a.length); if(this.hasDiff(this.results,merged)){ this.results=merged; this.render(); } }
      try{ updateFabCounter(this.el, (this.results||[]).length); }catch(_){ }
      // Choix de langue et mode de routage
      let mappedTotal = null;
      const forced = (PREF_FORCE_LANG && PREF_FORCE_LANG !== 'auto') ? PREF_FORCE_LANG : null;
      const allowPerSentence = !!PREF_MULTI_BY_SENTENCE && !forced;
      if(allowPerSentence){
        try{
          const sents = splitSentencesSimple(text);
          if(sents.length){
            const groups=[]; let cur=null;
            for(const s of sents){
              const l = detectLanguageSimple(s.text);
              if(!cur || cur.lang!==l){ cur = { lang:l, start:s.start, end:s.end, parts:[s] }; groups.push(cur); }
              else { cur.end = s.end; cur.parts.push(s); }
            }
            if(PREF_DEBUG){ try{ console.debug('[Textoo·Assist] groups=', groups.map(g=>({lang:g.lang, span:`'+g.start+'-'+g.end+'`, len:g.end-g.start}))); }catch(_){ } }
            if(groups.length<=5){
              const allMatches=[];
              for(const g of groups){
                const gText = text.slice(g.start, g.end);
                if(PREF_DEBUG){ try{ console.debug('[Textoo·Assist] LT chunk', { lang: g.lang, start: g.start, end: g.end, len: gText.length }); }catch(_){ } }
                const resp = await new Promise(res=>{ try{ chrome.runtime.sendMessage({type:"CHECK_TEXT", text: gText, lang: g.lang}, r=>res(r)); }catch(e){ res({ok:false,error:String(e)}); } });
                if(rid!==this.scanRID) return;
                if(resp && resp.ok && resp.data){
                  const local = Array.isArray(resp.data.matches) ? resp.data.matches : [];
                  for(const m of local){ if(typeof m.offset==='number'){ m.offset = m.offset + g.start; } }
                  allMatches.push(...local);
                }
              }
              mappedTotal = this.normalize(allMatches);
              if(PREF_DEBUG){ try{ console.debug('[Textoo·Assist] LT merged matches', mappedTotal.length); }catch(_){ } }
            }
          }
        }catch(_){ mappedTotal = null; }
      }
      // Fallback ou mode forcé: requête unique
      if(!mappedTotal){
        const lang = forced || detectLanguageSimple(text);
        if(PREF_DEBUG){ try{ console.debug('[Textoo·Assist] LT single request', { forced: !!forced, lang }); }catch(_){ } }
        const resp = await new Promise(res=>{ try{ chrome.runtime.sendMessage({type:"CHECK_TEXT", text, lang}, r=>res(r)); }catch(e){ res({ok:false,error:String(e)}); } });
        if(rid!==this.scanRID) return;
        if(resp && resp.ok && resp.data){ mappedTotal=this.normalize(resp.data.matches||[]); }
      }
      if(mappedTotal){
        if(mappedTotal.length===0 && this.results.length>0){ /* keep */ }
        else if(this.hasDiff(this.results,mappedTotal)){ this.results=mappedTotal; this.render(); }
        try{ updateFabCounter(this.el, (this.results||[]).length); }catch(_){ }
      }
    }

    applyReplacement(offset, length, replacement){
      if(this.destroyed || !this.overlay) return;
      
      // Marquer qu'une correction est en cours pour bloquer les scans
      this.isCorrecting = true;
      
      // Nettoyer les timeouts existants
      if(this.correctionTimeout) {
        clearTimeout(this.correctionTimeout);
        this.correctionTimeout = null;
      }
      
      // Sauvegarder les soulignements existants AVANT toute modification
      const existingResults = [...this.results];
      
      const oldEnd = offset + length;
      this.results = this.results.filter(m => (m.offset + m.length <= offset) || (m.offset >= oldEnd));
      const delta = String(replacement).length - length;
      this.rebaseMatches(oldEnd, delta);
      
      // Rendu immédiat pour maintenir l'affichage
      this.render();

      this.isProgrammatic = true;
      if (this.el.isContentEditable){
        const idx = buildIndexer(this.el);
        const startPos = posFromIndex(this.el, offset, idx);
        const endPos   = posFromIndex(this.el, offset+length, idx);
        const range = document.createRange();
        try{ range.setStart(startPos.node, startPos.offset); range.setEnd(endPos.node, endPos.offset); }catch(e){ range.selectNodeContents(this.el); }
        range.deleteContents();
        const tn=document.createTextNode(replacement);
        range.insertNode(tn);
        const sel=window.getSelection(); sel.removeAllRanges(); const after=document.createRange(); after.setStart(tn, tn.nodeValue.length); after.collapse(true); sel.addRange(after);
        try{ this.el.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertReplacementText",data:replacement})); }catch(_){ this.el.dispatchEvent(new Event("input",{bubbles:true})); }
      } else {
        const before=this.el.value||"";
        const after = before.slice(0, offset)+replacement+before.slice(offset+length);
        this.el.value = after;
        try{ this.el.setSelectionRange(offset+replacement.length, offset+replacement.length); }catch(e){}
        this.el.dispatchEvent(new Event("input",{bubbles:true}));
      }
      this.isProgrammatic = false;
      
      // Maintenir les soulignements pendant une période plus longue
      this.correctionTimeout = setTimeout(() => {
        if(this.destroyed) return;
        this.isCorrecting = false;
        this.correctionTimeout = null;
        
        // Faire un rescan complet après la correction
        setTimeout(() => {
          if(this.destroyed) return;
          // Forcer un scan complet même si l'utilisateur n'est plus en train de taper
          // car nous venons d'appliquer une correction et devons détecter les nouvelles erreurs
          this.forceFullScanAfterCorrection();
        }, 100);
      }, 1000); // 1 seconde de protection contre le scintillement
      
      // Forcer la mise à jour immédiate du FAB après remplacement
      try{ updateFabCounter(this.el, (this.results||[]).length); }catch(_){ }
    }

    // Force un scan complet après une correction, indépendamment de l'état de frappe
    async forceFullScanAfterCorrection(){
      if(this.destroyed || !this.overlay) return;
      if(!this.isEnabled) return;
      
      const text = this.getLinearized();
      if(!text || text.trim().length === 0){ 
        this.results = []; 
        this.render(); 
        return; 
      }
      
      // Scanner d'abord avec les règles offline
      let off = {matches: []}; 
      try{ off = window.TextooOfflineChecker.check(text); }catch(e){ off = {matches: []}; } 
      const offlineMapped = this.normalize(off.matches);
      
      // Mettre à jour les résultats même si l'utilisateur ne tape pas
      if(offlineMapped.length === 0 && this.results.length > 0){ 
        this.results = []; 
        this.render(); 
      } else { 
        const merged = [...this.results]; 
        offlineMapped.forEach(m => { 
          if(!merged.some(u => Math.max(u.offset, m.offset) < Math.min(u.offset+u.length, m.offset+m.length))) 
            merged.push(m); 
        }); 
        merged.sort((a,b) => a.offset - b.offset || b.length - a.length); 
        if(this.hasDiff(this.results, merged)){ 
          this.results = merged; 
          this.render(); 
        } 
      }
      
      // Puis faire un scan LanguageTool complet (version forcée)
      await this.forceFullScanLanguageTool(text);
    }

    // Version forcée du scan LanguageTool qui ignore l'état de frappe
    async forceFullScanLanguageTool(text){
      if(this.destroyed || !this.overlay) return;
      if(!this.isEnabled) return;
      
      const rid = ++this.scanRID;
      let mappedTotal = null;
      
      // Choix de langue et mode de routage
      const forced = (PREF_FORCE_LANG && PREF_FORCE_LANG !== 'auto') ? PREF_FORCE_LANG : null;
      const allowPerSentence = !!PREF_MULTI_BY_SENTENCE && !forced;
      
      if(allowPerSentence){
        try{
          const sents = splitSentencesSimple(text);
          if(sents.length){
            const groups = []; let cur = null;
            for(const s of sents){
              const l = detectLanguageSimple(s.text);
              if(!cur || cur.lang !== l){ cur = { lang: l, start: s.start, end: s.end, parts: [s] }; groups.push(cur); }
              else { cur.end = s.end; cur.parts.push(s); }
            }
            if(groups.length <= 5){
              const allMatches = [];
              for(const g of groups){
                const gText = text.slice(g.start, g.end);
                const resp = await new Promise(res => { try{ chrome.runtime.sendMessage({type: "CHECK_TEXT", text: gText, lang: g.lang}, r => res(r)); }catch(e){ res({ok: false, error: String(e)}); } });
                if(rid !== this.scanRID) return;
                if(resp && resp.ok && resp.data){
                  const local = Array.isArray(resp.data.matches) ? resp.data.matches : [];
                  for(const m of local){ if(typeof m.offset === 'number'){ m.offset = m.offset + g.start; } }
                  allMatches.push(...local);
                }
              }
              mappedTotal = this.normalize(allMatches);
            }
          }
        }catch(_){ mappedTotal = null; }
      }
      
      // Fallback ou mode forcé: requête unique
      if(!mappedTotal){
        const lang = forced || detectLanguageSimple(text);
        const resp = await new Promise(res => { try{ chrome.runtime.sendMessage({type: "CHECK_TEXT", text, lang}, r => res(r)); }catch(e){ res({ok: false, error: String(e)}); } });
        if(rid !== this.scanRID) return;
        if(resp && resp.ok && resp.data){ mappedTotal = this.normalize(resp.data.matches || []); }
      }
      
      if(mappedTotal){
        if(mappedTotal.length === 0 && this.results.length > 0){ 
          this.results = []; 
          this.render(); 
        }
        else if(this.hasDiff(this.results, mappedTotal)){ 
          this.results = mappedTotal; 
          this.render(); 
        }
        try{ updateFabCounter(this.el, (this.results || []).length); }catch(_){ }
      }
    }

    // --- Rendering ---
    render(){
      if(this.destroyed || !this.overlay) return;
      if(!this.isEnabled){
        if(this.el.isContentEditable){ this.overlay.replaceChildren(); }
        else { this.overlay.innerHTML=""; }
        this.overlay.style.display="none";
        this.positionOverlay();
        this.setBadge(this.results.length);
        return;
      }
      this.overlay.style.display="block";
      const text=this.getLinearized();
      if(this.el.isContentEditable){ this.renderMarkersCE(text,this.results); }
      else{
        // textarea/input: paint as text overlay with inline spans
        let out=[], i=0; const all=[...this.results].sort((a,b)=>a.offset-b.offset);
        const matches = all.slice(0, MAX_VISIBLE_MARKERS);
        for(let k=0;k<matches.length;k++){
          const m=matches[k]; const start=m.offset, end=m.offset+m.length; if(start<i) continue;
          out.push(esc(text.slice(i,start)));
          const klass="textoo-highlight"+(m.type==="style"?" style":(m.type==="typography"?" typography":(m.type==="ambiguity"?" ambiguity":"")));
          out.push(`<span class="${klass}" data-idx="${k}">${esc(text.slice(start,end))}</span>`);
          i=end;
        }
        out.push(esc(text.slice(i)));
        const html=out.join("");
        // Éviter le scintillement en ne mettant à jour que si nécessaire
        if(this.overlay.innerHTML!==html) {
          this.overlay.innerHTML=html;
          this.syncOverlayScroll(); 
          this.positionOverlay();
        }
      }
      this.setBadge(this.results.length);
    }

    // Rect-based markers for CE with atomic swap
    renderMarkersCE(text, matches){
      const r=this.el.getBoundingClientRect();
      const scrollX=window.scrollX, scrollY=window.scrollY;
      Object.assign(this.overlay.style,{left:(r.left+scrollX)+"px",top:(r.top+scrollY)+"px",width:r.width+"px",height:r.height+"px"});
      const frag=document.createDocumentFragment();
      const addMarker = (x,y,w,type,idx)=>{
        // Validation et clamp dans les bornes du composeur
        if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(w)) return;
        // Ignorer rects sans largeur
        if(w<=0.5) return;
        const relLeft = Math.max(0, Math.min(r.width, x - r.left));
        const relTop  = Math.max(0, Math.min(r.height, y - r.top + 2));
        // Ajuster largeur pour rester dans la boîte
        let relWidth = Math.min(w, r.width - relLeft);
        if(relWidth<=0.5) return;
        const div=document.createElement("div");
        div.className="textoo-marker"; div.dataset.idx=String(idx);
        div.style.position="absolute";
        div.style.left=relLeft+"px";
        div.style.top=relTop+"px";
        div.style.width=relWidth+"px";
        div.style.height="0px";
        let color = getErrorColor();
        if(type==="style") color = "#1e88e5";
        else if(type==="typography") color = "#6a1b9a";
        else if(type==="ambiguity") color = "#fb8c00";
        div.style.borderBottom = "2px solid " + color;
        div.style.pointerEvents="auto";
        frag.appendChild(div);
      };
      const cap = Math.min(matches.length, MAX_VISIBLE_MARKERS);
      for(let k=0;k<cap;k++){
        const m=matches[k];
        const idx = this.indexer;
        const startPos = posFromIndex(this.el, m.offset, idx);
        const endPos   = posFromIndex(this.el, m.offset+m.length, idx);
        const rg = document.createRange();
        try{ rg.setStart(startPos.node, startPos.offset); rg.setEnd(endPos.node, endPos.offset); }catch(e){ continue; }
        const rects = rg.getClientRects();
        for(const rect of rects){
          // Ignorer les rects dégénérés ou hors de l'écran
          if(!rect || rect.width<=0 || rect.height<=0) continue;
          // On n'utilise que la baseline inférieure; clamp plus bas dans addMarker
          addMarker(rect.left+scrollX, rect.bottom+scrollY-2, rect.width, m.type, k);
        }
      }
      // Utiliser replaceChildren de manière atomique pour éviter le scintillement
      this.overlay.replaceChildren(frag);
    }
  }
 
  // Met à jour le texte du FAB avec le nombre de fautes soulignées détectées
  // Optionnellement, accepter un élément composer et/ou un override numérique
  function updateFabCounter(composerEl, overrideCount){
    try{
      const f = (typeof fab !== 'undefined' && fab) ? fab : (window.__textooFab || document.getElementById('hmw-fab'));
      if(!f) return;
      // Trouver un composeur: prioriser celui fourni, sinon fallback sur findComposerBox() (disponible dans cet IIFE)
      let comp = composerEl;
      if(!comp){
        try{ if(typeof findComposerBox === 'function') comp = findComposerBox(); }catch(_){ }
      }
      // Point de départ: valeur fournie en override si présente, sinon 0
      let n = (typeof overrideCount === 'number' && overrideCount >= 0) ? overrideCount : 0;
      const prevShown = parseInt((f.textContent||'').replace(/[^0-9]/g,'')||'0',10) || 0;
      // Important: ne jamais empêcher la baisse du compteur.
      // On ne tient compte de l'affichage précédent que si AUCUN override n'est fourni (pour éviter un clignotement transitoire)
      if(typeof overrideCount !== 'number'){
        n = Math.max(n, prevShown);
      }
      let truncated = false;
      // 0a) Estimation directe pour le composeur actif si dispo
      try{
        if(n === 0 && comp){
          const approx = getCountForComposer(comp);
          if(Number.isFinite(approx) && approx > 0){ n = approx; }
        }
      }catch(_){ }
      // 1) Préférer la source vérité: le watcher en mémoire si disponible
      try{
        if(n === 0 && comp && typeof watched !== 'undefined' && watched && watched.has && watched.has(comp)){
          const inst = watched.get(comp);
          if(inst && Array.isArray(inst.results)){
            n = inst.results.length || 0;
            if(n > MAX_VISIBLE_MARKERS) truncated = true;
          }
        }
      }catch(_){ }
      // 2) Sinon, tenter l'attribut DOM
      if(n === 0 && comp && comp.getAttribute){
        const v = comp.getAttribute('data-textoo-count');
        const p = parseInt(v||'0',10);
        if(Number.isFinite(p) && p>0) n = p; else n = 0;
      }
      // 2b) Compter les marques inline (runLint) si présentes dans le composeur
      if(n === 0 && comp){
        try{
          const k = comp.querySelectorAll('mark.hmw-err, mark.hmw-warn').length;
          if(k > 0) n = k;
        }catch(_){ }
      }
      // Si toujours 0, essayer tous les composeurs visibles et prendre le max
      if(n === 0){
        try{
          const selG = 'div[aria-label="Corps du message"], div[aria-label="Message body"]';
          const selO = 'div[aria-label="Message body"], div[aria-label="Corps du message"], div[aria-label="Rédiger un message"], div[role="textbox"][aria-label*="message"], div[contenteditable="true"][role="textbox"], div[data-testid="rooster-editor"], div.rooster-editor, [role="textbox"][contenteditable="true"]';
          // Se limiter strictement au composeur actif
          const active = comp || (typeof findActiveComposerForFab === 'function' ? findActiveComposerForFab() : null);
          if(active){
            let localN = 0;
            // Essayer d'abord l'attribut propre à CE composeur
            try{
              const vv = active.getAttribute && active.getAttribute('data-textoo-count');
              const pp = parseInt(vv||'0',10);
              if(Number.isFinite(pp) && pp>localN) localN = pp;
            }catch(_){ }
            // Puis estimation directe via watcher/overlay
            try{
              const gg = getCountForComposer(active);
              if(Number.isFinite(gg) && gg>localN) localN = gg;
            }catch(_){ }
            // Et enfin les marques inline si présentes
            try{
              const kk = active.querySelectorAll('mark.hmw-err, mark.hmw-warn').length;
              if(kk>localN) localN = kk;
            }catch(_){ }
            if(localN>0) n = localN;
          }
        }catch(_){ }
      }
      // Ultime fallback: NE COMPTER QUE DANS LE COMPOSEUR ACTIF
      if(n === 0){
        try{
          let k = 0;
          const compEl = comp || (typeof findActiveComposerForFab === 'function' ? findActiveComposerForFab() : null);
          if(compEl){
            // Markers de l'overlay associé à CE composeur
            try{
              const ov = (typeof watched !== 'undefined' && watched && watched.get) ? (watched.get(compEl)?.overlay) : null;
              if(ov){ k = ov.querySelectorAll('.textoo-marker').length; }
            }catch(_){ }
            // Inline lint marks dans CE composeur
            if(k === 0){ k = compEl.querySelectorAll('mark.hmw-err, mark.hmw-warn').length; }
          }
          // Si rien trouvé, rester à 0 (ne pas utiliser document entier)
          if(k>0) n = k;
        }catch(_){ }
      }
      // Si le composeur actif est vide, forcer n=0
      try{
        const compEl2 = comp || (typeof findActiveComposerForFab === 'function' ? findActiveComposerForFab() : null);
        if(compEl2){
          const raw = (compEl2.innerText || compEl2.textContent || '').replace(/[\u00A0\s]+/g,'').trim();
          if(raw.length === 0){
            // Forcer 0 et nettoyer toute trace résiduelle dans CE composeur
            n = 0;
            try{
              // Vider l'état du watcher et rerender
              const inst = (typeof watched !== 'undefined' && watched && watched.get) ? watched.get(compEl2) : null;
              if(inst){ inst.results = []; inst.render && inst.render(); }
            }catch(_){ }
            try{
              // Supprimer tout mark inline résiduel
              compEl2.querySelectorAll('mark.hmw-err, mark.hmw-warn').forEach(m=>m.replaceWith(...m.childNodes));
            }catch(_){ }
            try{
              // Purger l'overlay associé
              const ov = (typeof watched !== 'undefined' && watched && watched.get) ? (watched.get(compEl2)?.overlay) : null;
              if(ov){ ov.querySelectorAll('.textoo-marker').forEach(e=>e.remove()); }
            }catch(_){ }
            try{ if(typeof hidePopover === 'function') hidePopover(); }catch(_){ }
          }
        }
      }catch(_){ }

      // Couleur responsive: 0 => vert, >=1 => rouge
      const isError = n >= 1;
      const col = isError ? getErrorColor() : '#008a47';
      try{
        // Forcer via !important pour éviter tout override CSS externe
        f.style.setProperty('background-color', col, 'important');
        f.style.setProperty('background', col, 'important');
        // Pas de bordure visible sur le FAB
        f.style.setProperty('border-width', '0', 'important');
        f.style.setProperty('border-style', 'none', 'important');
        f.style.setProperty('border-color', 'transparent', 'important');
        // Pas d'ombre pour éviter tout effet de bord
        f.style.setProperty('box-shadow', 'none', 'important');
        f.style.setProperty('color', '#fff', 'important');
        // Aucune outline pour éviter toute bordure visuelle
        f.style.removeProperty('outline');
        f.style.removeProperty('outline-offset');
        f.setAttribute('data-state', isError ? 'err' : 'ok');
      }catch(_){ }
      // Affichage du compteur en fonction du site
      if(!(typeof IS_GMAIL!=="undefined" && IS_GMAIL) && !(typeof IS_OUTLOOK!=="undefined" && IS_OUTLOOK)){
        // Hors Gmail/Outlook: afficher un point discret, sans nombre
        try{
          f.textContent = '';
          f.style.setProperty('width', '14px', 'important');
          f.style.setProperty('height', '14px', 'important');
          f.style.setProperty('border-radius', '3px', 'important');
          f.style.setProperty('font-size', '0', 'important');
          f.style.setProperty('line-height', '0', 'important');
          f.style.setProperty('border', '1px solid #ffffff', 'important');
          f.style.setProperty('box-shadow', '0 2px 6px rgba(0,0,0,0.25)', 'important');
          f.style.setProperty('pointer-events', 'none', 'important');
          f.setAttribute('aria-label', 'Textoo actif');
        }catch(_){ }
      } else {
        // Gmail/Outlook: garder l'affichage numérique
        if(truncated && n > MAX_VISIBLE_MARKERS){
          f.textContent = `${MAX_VISIBLE_MARKERS}+`;
        } else {
          f.textContent = String(n);
        }
        f.setAttribute('aria-label', n===1 ? '1 faute soulignée' : `${n} fautes soulignées`);
        try{
          f.style.setProperty('width', '16px', 'important');
          f.style.setProperty('height', '16px', 'important');
          f.style.setProperty('border-radius', '2px', 'important');
          f.style.setProperty('font-size', '11px', 'important');
          f.style.setProperty('line-height', '1', 'important');
        }catch(_){ }
      }
      // Garde-fou: si une autre routine a modifié le texte, recalcule la couleur depuis le contenu affiché
      try{
        const shown = parseInt(f.textContent.replace(/\D+/g,'' )||'0',10);
        const isErr2 = Number.isFinite(shown) && shown >= 1;
        const col2 = isErr2 ? getErrorColor() : '#008a47';
        f.style.setProperty('background-color', col2, 'important');
        f.style.setProperty('background', col2, 'important');
        f.style.setProperty('border-width', '0', 'important');
        f.style.setProperty('border-style', 'none', 'important');
        f.style.setProperty('border-color', 'transparent', 'important');
        f.style.setProperty('box-shadow', '0 4px 12px rgba(0,0,0,0.18)', 'important');
        f.style.setProperty('color', '#fff', 'important');
        f.setAttribute('data-state', isErr2 ? 'err' : 'ok');
      }catch(_){ }
    }catch(_){ /* no-op */ }
  }
  try{ window.updateFabCounter = updateFabCounter; }catch(_){ }

  // Helper: obtenir le nombre de fautes pour un composeur donné
  function getCountForComposer(el){
    if(!el) return 0;
    // watcher en mémoire
    try{
      if(typeof watched !== 'undefined' && watched && watched.has && watched.has(el)){
        const inst = watched.get(el);
        if(inst && Array.isArray(inst.results)) return inst.results.length || 0;
      }
    }catch(_){ }
    // attribut DOM
    try{
      const v = el.getAttribute && el.getAttribute('data-textoo-count');
      const p = parseInt(v||'0',10);
      if(Number.isFinite(p) && p>0) return p;
    }catch(_){ }
    // fallback visuel: compter les marqueurs dans l'overlay si existant
    try{
      const ov = (typeof watched !== 'undefined' && watched && watched.get) ? (watched.get(el)?.overlay) : null;
      if(ov){ const k = ov.querySelectorAll('.textoo-marker').length; if(k>0) return k; }
    }catch(_){ }
    return 0;
  }

  function isEditable(el){
    if(!el || el.hidden) return false;
    if(el.closest && el.closest(".textoo-overlay")) return false;
    const tn=el.nodeName;
    if(tn==="TEXTAREA") return true;
    if(tn==="INPUT"){
      if(IS_GMAIL){
        const name=(el.getAttribute('name')||'').toLowerCase();
        if(name!=='subjectbox') return false;
      }
      if(IS_OUTLOOK){
        // Pour Outlook, accepter tous les champs de texte
        const t=(el.getAttribute("type")||"text").toLowerCase();
        if(["text","search","email","url","tel",""].includes(t)) return true;
      } else {
        const t=(el.getAttribute("type")||"text").toLowerCase();
        if(["text","search","email","url","tel",""].includes(t)) return true;
      }
      return false;
    }
    if(el.isContentEditable) return true;
    return false;
  }
  function isTopEditable(el){
    if(!isEditable(el)) return false;
    const a = el.closest('textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input:not([type]), [contenteditable=""], [contenteditable="true"]');
    return a===el;
  }

  // Limiter aux vrais composeurs d'email (Gmail/Outlook)
  function isTopComposer(el){
    if(!el || !el.isConnected) return false;
    // Uniquement les zones de rédaction (composer) — pas les champs de recherche/sujet/etc.
    if(IS_GMAIL){
      // Gmail: corps du message
      return el.matches && el.matches('div[aria-label="Corps du message"], div[aria-label="Message body"]');
    }
    if(IS_OUTLOOK){
      // Outlook: large éventail de sélecteurs pour la zone de rédaction
      const selector = 'div[aria-label="Message body"], div[aria-label="Corps du message"], div[aria-label="Rédiger un message"], div[role="textbox"][aria-label*="message"], div[contenteditable="true"][role="textbox"], div[data-testid="rooster-editor"], div.rooster-editor, div[aria-label*="Compose"], div[aria-label*="compose"], div[class*="editor"], div[class*="compose"], [role="textbox"][contenteditable="true"]';
      return el.matches && el.matches(selector);
    }
    // Autres sites: considérer les champs éditables génériques comme "composeurs"
    const generic = 'textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input:not([type]), [contenteditable=""], [contenteditable="true"]';
    return el.matches && el.matches(generic) && isTopEditable(el);
  }

  const watched=new WeakMap();
  // Exposer watched globalement pour que les autres modules puissent y accéder
  window.__textooWatched = watched;
  function detach(el){
    const inst = watched.get(el);
    if(inst){
      inst.destroy();
      watched.delete(el);
    }
  }
  function attach(el){ if(!el || watched.has(el) || !el.isConnected) return; watched.set(el,new FieldWatcher(el)); }
  function scanForFields(root=document){
    // Scanner uniquement les composeurs pour ne pas afficher le compteur ailleurs
    let candidates = [];
    if(IS_GMAIL){
      candidates = root.querySelectorAll('div[aria-label="Corps du message"], div[aria-label="Message body"]');
    } else if(IS_OUTLOOK){
      candidates = root.querySelectorAll('div[aria-label="Message body"], div[aria-label="Corps du message"], div[aria-label="Rédiger un message"], div[role="textbox"][aria-label*="message"], div[contenteditable="true"][role="textbox"], div[data-testid="rooster-editor"], div.rooster-editor, div[aria-label*="Compose"], div[aria-label*="compose"], div[class*="editor"], div[class*="compose"], [role="textbox"][contenteditable="true"]');
    } else {
      // Autres sites: champs éditables génériques (top-level uniquement)
      candidates = root.querySelectorAll('textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input:not([type]), [contenteditable=""], [contenteditable="true"]');
    }
    candidates.forEach(el=>{ if(isTopComposer(el)) attach(el); });
  }
  scanForFields();
  const mo=new MutationObserver((muts)=>{
    for(const m of muts){
      if(m.addedNodes) m.addedNodes.forEach(n=>{
        if(n.nodeType===1){
          // Attacher uniquement sur des composeurs réels
          if(isTopComposer(n)) attach(n);
          const els = n.querySelectorAll ? (IS_GMAIL
            ? n.querySelectorAll('div[aria-label="Corps du message"], div[aria-label="Message body"]')
            : (IS_OUTLOOK
              ? n.querySelectorAll('div[aria-label="Message body"], div[aria-label="Corps du message"], div[aria-label="Rédiger un message"], div[role="textbox"][aria-label*="message"], div[contenteditable="true"][role="textbox"], div[data-testid="rooster-editor"], div.rooster-editor, div[aria-label*="Compose"], div[aria-label*="compose"], div[class*="editor"], div[class*="compose"], [role="textbox"][contenteditable="true"]')
              : n.querySelectorAll('textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input:not([type]), [contenteditable=""], [contenteditable="true"]'))) : [];
          els.forEach(e=>{ if(isTopComposer(e)) attach(e); });
        }
      });
      if(m.removedNodes) m.removedNodes.forEach(n=>{
        if(n.nodeType===1){
          if(watched.has(n)) detach(n);
          const els = n.querySelectorAll ? (IS_GMAIL
            ? n.querySelectorAll('div[aria-label="Corps du message"], div[aria-label="Message body"]')
            : (IS_OUTLOOK
              ? n.querySelectorAll('div[aria-label="Message body"], div[aria-label="Corps du message"], div[aria-label="Rédiger un message"], div[role="textbox"][aria-label*="message"], div[contenteditable="true"][role="textbox"], div[data-testid="rooster-editor"], div.rooster-editor, div[aria-label*="Compose"], div[aria-label*="compose"], div[class*="editor"], div[class*="compose"], [role="textbox"][contenteditable="true"]')
              : n.querySelectorAll('textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input:not([type]), [contenteditable=""], [contenteditable="true"]'))) : [];
          els.forEach(e=>{ detach(e); });
        }
      });
    }
  });
  mo.observe(document.documentElement,{childList:true,subtree:true});
})();


(function(){
  // Assist module now runs on all sites. Behavior differs per platform flags below.

  // Local platform flags for this module (avoid cross-IIFE scope)
  const IS_GMAIL   = /mail\.google\.com$/.test(window.location.hostname);
  const IS_OUTLOOK = /outlook\.(live|office)\.com$/.test(window.location.hostname);

  const log = (...args)=>console.debug('[Textoo·Assist]', ...args);
  const BOX_WIDTH = 540;
  const STORAGE_KEY = 'endpoint';

  let ENDPOINT = '';
  function loadEndpoint(){
    try {
      chrome.storage?.sync?.get([STORAGE_KEY], (res)=>{
        ENDPOINT = (res && res[STORAGE_KEY]) || '';
        if(!ENDPOINT){
          chrome.storage?.local?.get([STORAGE_KEY], (loc)=>{
            ENDPOINT = (loc && loc[STORAGE_KEY]) || '';
            if(!ENDPOINT){
              try{ ENDPOINT = localStorage.getItem('HMW_WORKER_URL') || ''; }
              catch(e){ ENDPOINT=''; }
            }
            log('endpoint:', ENDPOINT || '(non défini)');
          });
        } else {
          log('endpoint:', ENDPOINT);
        }
      });
    } catch(e){
      try{ ENDPOINT = localStorage.getItem('HMW_WORKER_URL') || ''; }
      catch(_){ ENDPOINT=''; }
      log('endpoint (fallback):', ENDPOINT || '(non défini)');
    }
  }
  loadEndpoint();

  // Helpers et action pour la correction en place (même IIFE que le menu)
  // Forcer la prise en compte de TOUS les types d'erreurs (y compris style/typo)
  const FORCE_ALL_CORRECTIONS = true;
  function a_isBlock(el){ if (!el || el.nodeType!==1) return false; return /^(DIV|P|LI|UL|OL|TABLE|TBODY|TR|TD|SECTION|ARTICLE|HEADER|FOOTER|H[1-6]|BLOCKQUOTE)$/.test(el.tagName); }
  function a_childIndex(node){ return Array.prototype.indexOf.call(node.parentNode ? node.parentNode.childNodes : [], node); }
  function a_buildIndexer(root){
    let text = ""; const segments = []; let lastTextNode=null;
    function walk(node){
      for (let child = node.firstChild; child; child = child.nextSibling){
        if (child.nodeType === 3){
          const t = child.nodeValue || "";
          if (t.length){ segments.push({ type:'text', node: child, start: text.length, length: t.length }); text += t; lastTextNode=child; }
        } else if (child.nodeType === 1){
          if (child.tagName === 'BR'){ const parent=child.parentNode; segments.push({ type:'br', node: child, parent, afterIndex: a_childIndex(child)+1, start: text.length, length: 1 }); text += "\n"; }
          else { const before=text.length; walk(child); const contributed=text.length-before; if (a_isBlock(child) && contributed>0 && text.slice(-1)!=="\n"){ segments.push({ type:'blocksep', node: child, ref:lastTextNode, start: text.length, length: 1 }); text += "\n"; } }
        }
      }
    }
    walk(root);
    return { text, segments };
  }
  function a_posFromIndex(root, index, indexer){
    const segs=indexer.segments; if(index>=indexer.text.length){ const last=segs[segs.length-1]; if(last&&last.type==='text') return {node:last.node, offset:last.node.nodeValue.length}; return {node:root, offset:(root.childNodes?root.childNodes.length:0)}; }
    for(const s of segs){ if(index < s.start + s.length){ if(s.type==='text') return {node:s.node, offset:index - s.start}; if(s.type==='br') return {node:s.parent, offset:s.afterIndex}; if(s.type==='blocksep'){ if(s.ref) return {node:s.ref, offset:s.ref.nodeValue.length}; return {node:root, offset:(root.childNodes?root.childNodes.length:0)}; } } }
    return {node:root, offset:(root.childNodes?root.childNodes.length:0)};
  }
  function a_decodeEscapes(str){ if (typeof str !== 'string') return str; return str.replace(/\\u([0-9a-fA-F]{4})/g,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/\\x([0-9a-fA-F]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16))); }
  function a_normalizeMatches(matches){
    if(!Array.isArray(matches)) return [];
    return matches
      .map(m=>({ offset:m.offset??m.start??0, length:m.length??((m.end!=null&&m.start!=null)?(m.end-m.start):0), replacements:(m.replacements||[]), message:m.message||m.shortMessage||'', rule:m.rule||{}, category:(m.rule&&m.rule.category)||{} }))
      // Garder uniquement grammaire/orthographe; exclure style/typographie
      .filter(m=>{
        if(!FORCE_ALL_CORRECTIONS){
          const it = String(m.rule?.issueType||'');
          const cat = String(m.category?.id||'');
          if(/style|typograph/i.test(it)) return false;
          if(/STYLE|TYPOG/i.test(cat)) return false;
        }
        return Array.isArray(m.replacements) && m.replacements.length>0 && m.length>0;
      })
      .map(m=>{ const alts = m.replacements.map(r=>a_decodeEscapes(String(r.value ?? r))).filter(Boolean); return { offset:m.offset, length:m.length, value:alts[0], alts }; });
  }

  function a_isConservativeReplace(orig, repl){
    if(!orig || !repl) return false;
    if(orig === repl) return false;
    const o = orig.trim();
    const r = repl.trim();
    if(!o || !r) return false;
    // Éviter d'introduire ponctuation nouvelle
    if(/[,:;]/.test(r) && !/[,:;]/.test(o)) return false;
    // Pas de duplication évidente
    if(r.includes(o + ' ') || r.includes(' ' + o) || (r.match(new RegExp(o,'g'))||[]).length>=2) return false;
    const ow = o.split(/\s+/).length;
    const rw = r.split(/\s+/).length;
    if(rw > ow + 1) return false; // autoriser au plus +1 mot (ex: contractions corrigées)
    // S'il s'agit d'un remplacement mot->mot (conjugaison/accord), l'autoriser largement
    if(ow === 1 && rw === 1){
      if(!/[,:;]/.test(r)) return o.toLowerCase() !== r.toLowerCase();
    }
    const delta = Math.abs(r.length - o.length);
    if(delta > 10) return false; // rester modéré mais moins strict
    return true;
  }
  function a_mergeMatches(base, add){
    const out = base.slice();
    for(const m of add){ if(!out.some(u=>Math.max(u.offset,m.offset)<Math.min(u.offset+u.length,m.offset+m.length))) out.push(m); }
    return out.sort((a,b)=>a.offset-b.offset||b.length-a.length);
  }
  // Déduplique les correspondances qui se chevauchent à l'intérieur d'un même lot
  // — on garde la plus longue (souvent la proposition la plus précise, ex: « J'ai manger » -> « J'ai mangé »)
  // — si longueurs égales, on garde celle dont la proposition est la plus proche en longueur de l’original
  function a_dedupOverlaps(matches, originalText=''){
    if(!Array.isArray(matches) || matches.length<=1) return matches||[];
    const sorted = matches.slice().sort((a,b)=>{
      const la = a.length||0, lb = b.length||0;
      if(lb!==la) return lb-la; // plus long d'abord
      if(a.offset!==b.offset) return a.offset-b.offset; // plus à gauche d'abord si même longueur
      return 0;
    });
    const chosen = [];
    const overlaps = (x,y)=>!(x.offset + x.length <= y.offset || y.offset + y.length <= x.offset);
    for(const m of sorted){
      if(chosen.some(c => overlaps(c,m))) continue;
      chosen.push(m);
    }
    // Tri final par offset croissant pour l'application descendante
    chosen.sort((a,b)=>a.offset-b.offset||b.length-a.length);
    return chosen;
  }
  const FR_DETS = new Set(['du','de','de la','de l\'','le','la','les','un','une','des']);
  function a_prevToken(idx, offset){
    const left = idx.text.slice(0, Math.max(0, offset));
    const m = left.match(/([A-Za-zÀ-ÖØ-öø-ÿ']+)\s*$/);
    return m ? m[1].toLowerCase() : '';
  }
  function a_adjustReplacement(idx, m, replacement){
    let r = replacement;
    // Supprimer un déterminant en tête si déjà un déterminant avant la zone
    const prev = a_prevToken(idx, m.offset);
    const lead = r.toLowerCase().match(/^(du|de la|de l'|de|le|la|les|un|une|des)\s+/);
    if(prev && FR_DETS.has(prev) && lead){
      r = r.slice(lead[0].length);
    }
    // Convenir singulier après "du" simple (heuristique légère)
    if(prev === 'du'){
      r = r.replace(/\b([A-Za-zÀ-ÖØ-öø-ÿ']+)s\b$/, '$1');
    }
    // Nettoyage espaces multiples
    r = r.replace(/\s{2,}/g, ' ').trim();
    return r;
  }
  // Découper le texte en phrases avec mapping offsets
  function a_splitSentences(text){
    const res=[]; let start=0; const rx=/([.!?…]+)(\s+|$)/g; let m;
    while((m=rx.exec(text))){ const end = m.index + (m[1]?.length||0); const slice = text.slice(start, end); if(slice.trim().length){ res.push({start, end, text:slice}); } start = m.index + m[0].length; }
    if(start < text.length){ const slice = text.slice(start); if(slice.trim().length){ res.push({start, end:text.length, text:slice}); } }
    return res;
  }
  function a_applyCorrectionsToSlice(idx, sliceStart, sliceText, sliceMatches){
    if(!sliceMatches.length) return { text: sliceText, count:0 };
    // recalculer offsets relatifs à la tranche
    const rel = sliceMatches.map(m=>({
      offset: m.offset - sliceStart,
      length: m.length,
      alts: m.alts||[],
      value: m.value||''
    }));
    // appliquer de droite à gauche
    let out = sliceText; let count=0;
    const sorted = rel.slice().sort((a,b)=>b.offset - a.offset || a.length - b.length);
    for(const m of sorted){
      if(m.offset<0 || m.offset+m.length>out.length) continue;
      const current = out.slice(m.offset, m.offset+m.length);
      let repl = String(m.value||'');
      if(Array.isArray(m.alts) && m.alts.length){
        const best = m.alts.find(v=>a_isConservativeReplace(current, v));
        if(best) repl = best;
      }
      // Ajustements contextuels (utilise idx global + offsets absolus)
      const fakeM = { offset: sliceStart + m.offset, length: m.length };
      repl = a_adjustReplacement(idx, fakeM, repl);
      if(!a_isConservativeReplace(current, repl)) continue;
      // Préserver blancs internes à la tranche
      const leadWS  = (current.match(/^\s+/) || [''])[0];
      const trailWS = (current.match(/\s+$/) || [''])[0];
      const final = leadWS + repl.trim() + trailWS;
      out = out.slice(0, m.offset) + final + out.slice(m.offset + m.length);
      count++;
    }
    // Nettoyage simple: éviter doublons immédiats de mots (ex: pouletpoulet ou "poulet poulet")
    try{
      out = out.replace(/\b([A-Za-zÀ-ÖØ-öø-ÿ']{2,})\1\b/gi, '$1');
      out = out.replace(/\b([A-Za-zÀ-ÖØ-öø-ÿ']{2,})\s+\1\b/gi, '$1');
    }catch(_){ }
    return { text: out, count };
  }
  // Appliquer les corrections sur tout le texte (mode robuste, sans mise en forme)
  function a_applyCorrectionsToFull(text, matches){
    const sorted = (matches||[]).slice().sort((a,b)=>b.offset - a.offset || a.length - b.length);
    let out = text; let count=0;
    for(const m of sorted){
      if(m.offset<0 || m.offset+m.length>out.length) continue;
      const current = out.slice(m.offset, m.offset+m.length);
      let repl = String(m.value||'');
      if(Array.isArray(m.alts) && m.alts.length){
        // En mode global, choisir la 1ère alternative ou la 1ère qui diffère
        const best = m.alts.find(v=>String(v).trim().toLowerCase() !== current.trim().toLowerCase());
        if(best) repl = best;
      }
      // En mode global, on applique dès que ça change réellement le texte
      if(current.trim() === String(repl).trim()) continue;
      const leadWS  = (current.match(/^\s+/) || [''])[0];
      const trailWS = (current.match(/\s+$/) || [''])[0];
      const final = leadWS + repl.trim() + trailWS;
      out = out.slice(0, m.offset) + final + out.slice(m.offset + m.length);
      count++;
    }
    try{
      out = out.replace(/\b([A-Za-zÀ-ÖØ-öø-ÿ']{2,})\1\b/gi, '$1');
      out = out.replace(/\b([A-Za-zÀ-ÖØ-öø-ÿ']{2,})\s+\1\b/gi, '$1');
      out = out.replace(/\s{2,}/g, ' ');
      // Corriger les espaces avant les virgules (erreur typographique française)
      out = out.replace(/\s+,/g, ',');
    }catch(_){ }
    return { text: out, count };
  }
  // Dans Outlook Web, le vrai contenteditable peut être un descendant du composer (et dans un iframe)
  function a_getOutlookEditable(root){
    try{
      const doc = root?.ownerDocument || document;
      const inRoot = root.querySelector('[contenteditable="true"], div[aria-label="Message body"], [role="textbox"]');
      if(inRoot) return inRoot;
      // Fallback global dans le même document (si root est un wrapper)
      const global = doc.querySelector('div[aria-label="Message body"][contenteditable="true"], [role="textbox"][contenteditable="true"], [contenteditable="true"]');
      if(global) return global;
      // Dernier recours: l’élément actif si c’est un contenteditable
      const ae = doc.activeElement; if(ae && ae.isContentEditable) return ae;
    }catch(_){ }
    return root;
  }
  function a_setContentHard(root, text){
    const target = (typeof IS_OUTLOOK !== 'undefined' && IS_OUTLOOK) ? (a_getOutlookEditable(root) || root) : root;
    const doc = target.ownerDocument || document;
    try{ target.textContent = text; }
    catch(_){
      try{ const rng = doc.createRange(); rng.selectNodeContents(target); rng.deleteContents(); rng.insertNode(doc.createTextNode(text)); }catch(__){}
    }
    try{ target.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertReplacementText',data:text})); }catch(_){ target.dispatchEvent(new Event('input',{bubbles:true})); }
  }
  // Normaliser la langue et le correcteur natif pour éviter des soulignements erronés d'Outlook
  function a_prepareOutlookEditor(el){
    try{
      if(!(typeof IS_OUTLOOK !== 'undefined' && IS_OUTLOOK)) return;
      const target = a_getOutlookEditable(el) || el;
      if(!target) return;
      // Forcer le français pour le correcteur natif (s'il est actif)
      try{ target.setAttribute('lang','fr'); target.setAttribute('xml:lang','fr'); }catch(_){ }
      // Désactiver le spellcheck natif pour laisser Textoo gérer les soulignements
      try{ target.setAttribute('spellcheck','false'); target.spellcheck = false; }catch(_){ }
    }catch(_){ }
  }
  // Sur Outlook, certains scripts rétablissent spellcheck/lang: on l'empêche via un observer
  function a_enforceNoNativeSpellcheck(el){
    try{
      if(!(typeof IS_OUTLOOK !== 'undefined' && IS_OUTLOOK)) return;
      const target = a_getOutlookEditable(el) || el;
      if(!target || target.dataset.textooNoSpellObs) return;
      a_prepareOutlookEditor(target);
      const obs = new MutationObserver(() => { a_prepareOutlookEditor(target); });
      obs.observe(target, { attributes:true, attributeFilter:['spellcheck','lang','xml:lang'] });
      target.dataset.textooNoSpellObs = '1';
    }catch(_){ }
  }
  async function correctAllInComposer(){
    // Sur Outlook, s'assurer qu'un composeur de réponse est ouvert
    if(IS_OUTLOOK){ try{ await ensureOutlookReplyComposer(2000); }catch(_){ } }
    const composer = findComposerBox();
    if(!composer){ showToast('❌ Aucune zone de rédaction détectée.', 'error'); return; }
    showToast('Correction en cours…', 'info', 1200);
    try{ console.debug('[Textoo·Assist] Corriger: composer found', composer); }catch(_){}
    const TARGET_NODE = (typeof IS_OUTLOOK !== 'undefined' && IS_OUTLOOK) ? (a_getOutlookEditable(composer) || composer) : composer;
    try{ console.debug('[Textoo·Assist] Target node for indexing:', TARGET_NODE); }catch(_){}
    let idx = a_buildIndexer(TARGET_NODE);
    const text = idx.text || '';
    try{ console.debug('[Textoo·Assist] Text length captured:', text.length); }catch(_){}
    if(!text.trim()){ showToast('Aucun texte à corriger.', 'info'); try{ console.debug('[Textoo·Assist] Corriger: empty text'); }catch(_){} return; }

    let merged = [];
    try{
      const off = window.TextooOfflineChecker?.check?.(text) || {matches:[]};
      merged = a_normalizeMatches(off.matches);
      try{ console.debug('[Textoo·Assist] Offline matches found:', off.matches.length, '→ normalized:', merged.length); }catch(_){}
    }catch(_){ merged = []; }

    try{
      const resp = await new Promise(res=>{ try{ chrome.runtime.sendMessage({type:'CHECK_TEXT', text}, r=>res(r)); }catch(e){ res({ok:false}); } });
      if(resp && resp.ok && resp.data){
        const add = a_normalizeMatches(resp.data.matches||[]);
        merged = a_mergeMatches(merged, add);
        try{ console.debug('[Textoo·Assist] LT matches found:', (resp.data.matches||[]).length, '→ normalized:', add.length, '→ total merged:', merged.length); }catch(_){}
      } else {
        try{ console.debug('[Textoo·Assist] Corriger: LT unavailable or no data', resp); }catch(_){}
      }
    }catch(_){ }

    // Ajouter heuristiques locales sûres (avoir/être + infinitif ; c'etais -> c'était)
    try{ const avoir = a_buildAvoirInfMatches2(idx); merged = a_mergeMatches(merged, avoir); console.debug('[Textoo·Assist] Avoir heuristics:', avoir.length); }catch(_){ }
    try{ const etre = a_buildEtreInfMatches(idx); merged = a_mergeMatches(merged, etre); console.debug('[Textoo·Assist] Être heuristics:', etre.length); }catch(_){ }
    try{ const cetait = a_buildCTetaitMatches(idx); merged = a_mergeMatches(merged, cetait); console.debug('[Textoo·Assist] C\'était heuristics:', cetait.length); }catch(_){ }

    try{ console.debug('[Textoo·Assist] Final merged matches before dedup:', merged.length, merged); }catch(_){}
    if(!merged.length){ showToast('Aucune correction nécessaire.', 'info'); try{ console.debug('[Textoo·Assist] No merged matches found'); }catch(_){} return; }

    // Dédupliquer les chevauchements puis corriger TOUT le texte en une seule opération
    merged = a_dedupOverlaps(merged, text);
    try{ console.debug('[Textoo·Assist] After dedup:', merged.length, 'matches'); }catch(_){}
    let totalApplied = 0;
    try{
      const full0 = a_applyCorrectionsToFull(text, merged);
      try{ console.debug('[Textoo·Assist] Full correction result:', full0); }catch(_){}
      if(full0 && full0.count){
        // Remplacement dur pour éviter toute duplication (Gmail RTE)
        a_setContentHard(composer, full0.text);
        totalApplied = full0.count;
        try{ idx = a_buildIndexer(TARGET_NODE); }catch(_){ }
      } else if(full0 && !full0.count){
        // Fallback ultra-simple: applique les remplacements séquentiellement sur la string complète
        try{ console.debug('[Textoo·Assist] Full pass produced 0 changes despite', merged.length, 'matches — applying sequential fallback'); }catch(_){ }
        let tmp = text; let cnt = 0;
        const seq = merged.slice().sort((a,b)=>b.offset - a.offset || a.length - b.length);
        for(const m of seq){
          if(m.offset<0 || m.offset+m.length>tmp.length) continue;
          const cur = tmp.slice(m.offset, m.offset+m.length);
          let rep = String(m.value||'');
          if(Array.isArray(m.alts) && m.alts.length){
            const diff = m.alts.find(v=>String(v).trim().toLowerCase() !== cur.trim().toLowerCase());
            if(diff) rep = diff;
          }
          if(cur.trim().toLowerCase() === rep.trim().toLowerCase()) continue;
          const leadWS  = (cur.match(/^\s+/) || [''])[0];
          const trailWS = (cur.match(/\s+$/) || [''])[0];
          tmp = tmp.slice(0, m.offset) + (leadWS + rep.trim() + trailWS) + tmp.slice(m.offset + m.length);
          cnt++;
        }
        if(cnt>0){
          a_setContentHard(composer, tmp);
          totalApplied = cnt; // compter ce fallback
          try{ idx = a_buildIndexer(TARGET_NODE); }catch(_){ }
        } else {
          try{ showToast('ℹ️ Aucune modification détectée.', 'info', 1500); }catch(_){ }
        }
      }
    }catch(err){ try{ console.error('[Textoo·Assist] full replace failed', err); }catch(_){} }

    // Vérifier s'il reste des anomalies évidentes (doublons, matchs offline restants)
    let robustApplied = 0;
    try{
      const afterIdx = a_buildIndexer(TARGET_NODE);
      const afterText = afterIdx.text || '';
      const off = window.TextooOfflineChecker?.check?.(afterText) || {matches:[]};
      let remaining = a_normalizeMatches(off.matches);
      remaining = a_dedupOverlaps(remaining, afterText);
      const hasDup = /\b([A-Za-zÀ-ÖØ-öø-ÿ']{2,})\s+\1\b/i.test(afterText) || /\b([A-Za-zÀ-ÖØ-öø-ÿ']{2,})\1\b/i.test(afterText);
      if(hasDup || remaining.length>=1){
        // Mode robuste: on calcule un nouveau texte global corrigé et on remplace le contenu intégralement
        const allMerged = a_mergeMatches(remaining, []);
        const full = a_applyCorrectionsToFull(afterText, allMerged);
        if(full && full.count){
          a_setContentHard(composer, full.text);
          robustApplied = full.count;
          try{ idx = a_buildIndexer(TARGET_NODE); }catch(_){ }
        }
      }
    }catch(_){ }

    // Dernière passe: re-vérification LanguageTool sur le texte final, et application globale si nécessaire
    let ltApplied = 0;
    try{
      const postIdx = a_buildIndexer(TARGET_NODE);
      const postText = postIdx.text || '';
      const resp2 = await new Promise(res=>{ try{ chrome.runtime.sendMessage({type:'CHECK_TEXT', text: postText}, r=>res(r)); }catch(e){ res({ok:false}); } });
      if(resp2 && resp2.ok && resp2.data){
        let rem = a_normalizeMatches(resp2.data.matches||[]);
        rem = a_dedupOverlaps(rem, postText);
        if(rem.length){
          const full2 = a_applyCorrectionsToFull(postText, rem);
          if(full2 && full2.count){
            a_setContentHard(composer, full2.text);
            ltApplied = full2.count;
          }
        }
      }
    }catch(_){ }

    // Convergence finale: itérations globales Offline+LT si des erreurs persistent
    let convergeApplied = 0;
    try{
      for(let round=0; round<4; round++){
        const idxC = a_buildIndexer(TARGET_NODE);
        const textC = idxC.text || '';
        // Offline
        let mergedC = [];
        try{ const offC = window.TextooOfflineChecker?.check?.(textC) || {matches:[]}; mergedC = a_normalizeMatches(offC.matches); }catch(_){ }
        // LT
        try{
          const respC = await new Promise(res=>{ try{ chrome.runtime.sendMessage({type:'CHECK_TEXT', text: textC}, r=>res(r)); }catch(e){ res({ok:false}); } });
          if(respC && respC.ok && respC.data){ mergedC = a_mergeMatches(mergedC, a_normalizeMatches(respC.data.matches||[])); }
        }catch(_){ }
        if(!mergedC.length) break;
        mergedC = a_dedupOverlaps(mergedC, textC);
        const fullC = a_applyCorrectionsToFull(textC, mergedC);
        if(!fullC || !fullC.count) break;
        a_setContentHard(composer, fullC.text);
        convergeApplied += fullC.count;
      }
      // Vérification finale: s'il reste des matches, tenter une dernière passe globale
      try{
        const idxF = a_buildIndexer(TARGET_NODE);
        const textF = idxF.text || '';
        let mergedF = [];
        try{ const offF = window.TextooOfflineChecker?.check?.(textF) || {matches:[]}; mergedF = a_normalizeMatches(offF.matches); }catch(_){ }
        try{
          const respF = await new Promise(res=>{ try{ chrome.runtime.sendMessage({type:'CHECK_TEXT', text: textF}, r=>res(r)); }catch(e){ res({ok:false}); } });
          if(respF && respF.ok && respF.data){ mergedF = a_mergeMatches(mergedF, a_normalizeMatches(respF.data.matches||[])); }
        }catch(_){ }
        mergedF = a_dedupOverlaps(mergedF, textF);
        if(mergedF.length){
          const fullF = a_applyCorrectionsToFull(textF, mergedF);
          if(fullF && fullF.count){ a_setContentHard(composer, fullF.text); convergeApplied += fullF.count; }
          try{ console.debug('[Textoo·Assist] Final verification applied:', fullF?.count||0, 'changes; remaining matches input:', mergedF.length); }catch(_){ }
        } else {
          try{ console.debug('[Textoo·Assist] Final verification: 0 remaining matches'); }catch(_){ }
        }
      }catch(_){ }
    }catch(_){ }

    const total = totalApplied + robustApplied + ltApplied + convergeApplied;
    showToast(`✅ ${total} correction${total>1?'s':''} appliquée${total>1?'s':''}.`, total>0?'success':'info');
    
    // Forcer un rescan complet pour mettre à jour les soulignements après correction
    try{ 
      // Trouver le watcher associé au composeur et forcer un scan
      const composerEl = TARGET_NODE;
      const watched = window.__textooWatched;
      if(watched && watched.has && watched.has(composerEl)){
        const watcher = watched.get(composerEl);
        if(watcher && typeof watcher.forceFullScanAfterCorrection === 'function'){
          // Utiliser notre nouvelle méthode qui force le scan même si l'utilisateur ne tape pas
          await watcher.forceFullScanAfterCorrection();
        } else if(watcher && typeof watcher.fullScan === 'function'){
          // Fallback: forcer un fullScan même si l'utilisateur ne tape pas
          watcher.lastText = ''; // Forcer le scan en vidant le cache
          await watcher.fullScan();
        }
      }
    }catch(_){ }
    
    // Forcer la mise à jour immédiate du compteur FAB
    try{ updateFabCounter(TARGET_NODE); }catch(_){ }
  }
  const $  = (sel, root=document)=>root.querySelector(sel);
  const $$ = (sel, root=document)=>Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn)=>el && el.addEventListener(ev, fn);
  // Mini toaster pour feedback visuel
  function showToast(msg, kind='info', ttl=2500){
    try{
      let t = document.getElementById('textoo-toast');
      if(!t){
        t = document.createElement('div');
        t.id='textoo-toast';
        Object.assign(t.style,{position:'fixed',right:'16px',bottom:'16px',zIndex:2147483647,minWidth:'200px',maxWidth:'360px',padding:'10px 12px',borderRadius:'8px',color:'#fff',font:'13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif',boxShadow:'0 6px 18px rgba(0,0,0,.22)'});
        document.body.appendChild(t);
      }
      t.textContent = String(msg||'');
      t.style.background = kind==='error' ? '#d13438' : (kind==='success' ? '#107c10' : '#6c3ef0');
      t.style.display='block';
      clearTimeout(t._h);
      t._h = setTimeout(()=>{ t.style.display='none'; }, ttl);
    }catch(_){ /* no-op */ }
  }

  // Popover pour les corrections individuelles
  function showPopover(x, y, match, applyCallback, ignoreCallback){
    hidePopover(); // Masquer tout popover existant
    
    const popover = document.createElement('div');
    popover.className = 'textoo-popover';
    popover.style.left = x + 'px';
    popover.style.top = y + 'px';
    
    const header = document.createElement('div');
    header.className = 'textoo-popover-header';
    header.textContent = 'Corrections suggérées';
    
    const suggestions = document.createElement('div');
    suggestions.className = 'textoo-suggestions';
    
    // Ajouter les suggestions de correction
    if(match.replacements && match.replacements.length > 0){
      match.replacements.slice(0, 5).forEach((replacement, index) => {
        const suggest = document.createElement('div');
        suggest.className = 'textoo-suggest';
        suggest.textContent = replacement.value || replacement;
        suggest.onclick = () => {
          applyCallback(replacement.value || replacement);
          hidePopover();
        };
        suggestions.appendChild(suggest);
      });
    }
    
    const actions = document.createElement('div');
    actions.className = 'textoo-actions';
    
    const ignoreBtn = document.createElement('div');
    ignoreBtn.className = 'textoo-btn';
    ignoreBtn.textContent = 'Ignorer';
    ignoreBtn.onclick = () => {
      ignoreCallback(true);
      hidePopover();
    };
    
    const closeBtn = document.createElement('div');
    closeBtn.className = 'textoo-btn';
    closeBtn.textContent = 'Fermer';
    closeBtn.onclick = () => hidePopover();
    
    actions.appendChild(ignoreBtn);
    actions.appendChild(closeBtn);
    
    popover.appendChild(header);
    if(suggestions.children.length > 0) popover.appendChild(suggestions);
    popover.appendChild(actions);
    
    document.body.appendChild(popover);
    
    // Masquer le popover si on clique ailleurs
    const hideOnClickOutside = (e) => {
      if(!popover.contains(e.target)){
        hidePopover();
        document.removeEventListener('click', hideOnClickOutside);
      }
    };
    setTimeout(() => document.addEventListener('click', hideOnClickOutside), 100);
  }
  
  function hidePopover(){
    const existing = document.querySelector('.textoo-popover');
    if(existing) existing.remove();
  }

  // Ouvre le composeur de réponse sur Outlook si nécessaire
  async function ensureOutlookReplyComposer(timeoutMs = 2000){
    if(!IS_OUTLOOK) return false;
    // Si un composer est déjà présent, rien à faire
    if(findComposerBox()) return true;
    // Tenter de cliquer sur le bouton "Répondre"
    const candidates = [
      'button[aria-label^="Répondre"]',
      'button[title^="Répondre"]',
      'button[data-automationid="replyButton"]',
      'button[aria-label*="Reply"]',
      'button[aria-label*="Répondre à"]',
      '[data-automationid="replyButton"] button',
      'button[aria-label*="Répondre à tous"]',
      'button[title*="Répondre"]',
      'button:has(span:not(:empty))'
    ];
    let clicked = false;
    for(const sel of candidates){
      const btns = $$(sel);
      for(const b of btns){
        const txt = (b.innerText||b.textContent||'').trim().toLowerCase();
        if(/^(répondre|reply)$/i.test(txt) || sel.includes('replyButton') || sel.includes('Répondre')){
          try{ b.click(); clicked = true; break; }catch(_){ }
        }
      }
      if(clicked) break;
    }
    if(!clicked) return false;
    // Attendre l'apparition du composer
    const start = Date.now();
    while(Date.now()-start < timeoutMs){
      const box = findComposerBox();
      if(box) return true;
      await new Promise(r=>setTimeout(r, 100));
    }
    return !!findComposerBox();
  }

  function findComposerBox(){
    if(IS_GMAIL){
      return $('div[aria-label="Corps du message"], div[aria-label="Message body"]');
    }
    if(IS_OUTLOOK){
      // 1) Essai dans le document principal
      const main = $('div[aria-label="Message body"], div[aria-label="Corps du message"], div[aria-label="Rédiger un message"], div[role="textbox"][aria-label*="message"], div[contenteditable="true"][role="textbox"], div[data-testid="rooster-editor"], div.rooster-editor, div[aria-label*="Compose"], div[aria-label*="compose"], div[class*="editor"], div[class*="compose"], [role="textbox"][contenteditable="true"]')
                || $('div[contenteditable="true"]')
                || $('textarea[aria-label*="message"], textarea[aria-label*="Message"]');
      if(main) return main;

      // 2) Recherche dans les iframes (Outlook utilise souvent un RTE dans un iframe)
      const iframes = Array.from(document.querySelectorAll('iframe'));
      for(const iframe of iframes){
        try{
          const idoc = iframe.contentDocument || iframe.contentWindow?.document;
          if(!idoc) continue;
          const box = idoc.querySelector('div[aria-label="Message body"], div[aria-label="Corps du message"], div[aria-label="Rédiger un message"], div[role="textbox"][aria-label*="message"], div[contenteditable="true"][role="textbox"], div[data-testid="rooster-editor"], div.rooster-editor, div[aria-label*="Compose"], div[aria-label*="compose"], div[class*="editor"], div[class*="compose"], [role="textbox"][contenteditable="true"]')
                   || idoc.querySelector('div[contenteditable="true"]')
                   || idoc.querySelector('textarea[aria-label*="message"], textarea[aria-label*="Message"]');
          if(box) return box;
        }catch(_e){ /* cross-origin or inaccessible */ }
      }

      // 3) Fallback focus: si un élément a le focus, remonter vers un contenteditable
      const active = document.activeElement;
      if(active){
        const ce = active.closest ? active.closest('[contenteditable="true"], div[role="textbox"], textarea') : null;
        if(ce) return ce;
      }
    }
    return null;
  }
  function getLastMessageText(){
    if(IS_GMAIL){
      const blocks = $$('div.a3s, div[role="listitem"] .a3s');
      for(let i = blocks.length - 1; i >= 0; i--){
        const txt = blocks[i].innerText || '';
        if(txt && txt.trim().length > 40) return txt.trim();
      }
      return '';
    }
    
    if(IS_OUTLOOK){
      // Logique spécifique pour Outlook Live Mail
      console.log('[Textoo·Assist] Recherche du message Outlook...');
      
      // Analyser tous les éléments potentiels
      const allElements = $$('div, p, span, td, th, [role="listitem"], [class*="message"], [class*="mail"], [class*="content"]');
      console.log(`[Textoo·Assist] Analyse de ${allElements.length} éléments...`);
      
      let bestCandidate = '';
      let bestScore = 0;
      
      for(let i = 0; i < Math.min(allElements.length, 500); i++){
        const element = allElements[i];
        const txt = element.innerText || element.textContent || '';
        
        if(txt && txt.trim().length > 30 && txt.trim().length < 5000){
          const lowerTxt = txt.toLowerCase();
          let score = 0;
          
          // Mots-clés généraux d'email
          if(lowerTxt.includes('bonjour')) score += 2;
          if(lowerTxt.includes('merci')) score += 1;
          if(lowerTxt.includes('cordialement')) score += 1;
          if(lowerTxt.includes('salutations')) score += 1;
          
          // Mots-clés spécifiques aux formations/business
          if(lowerTxt.includes('formation')) score += 3;
          if(lowerTxt.includes('planning')) score += 3;
          if(lowerTxt.includes('session')) score += 2;
          if(lowerTxt.includes('réunion')) score += 2;
          if(lowerTxt.includes('confirmer')) score += 2;
          if(lowerTxt.includes('présence')) score += 2;
          if(lowerTxt.includes('calendrier')) score += 2;
          if(lowerTxt.includes('rendez-vous')) score += 2;
          if(lowerTxt.includes('meeting')) score += 2;
          
          // Pénaliser les métadonnées et éléments d'interface
          if(lowerTxt.match(/^(mer|mar|jeu|ven|sam|dim|lun)/i)) score -= 5;
          if(lowerTxt.match(/^\d{1,2}:\d{2}/)) score -= 5;
          if(lowerTxt.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) score -= 5;
          if(lowerTxt.includes('outlook')) score -= 3;
          if(lowerTxt.includes('microsoft')) score -= 3;
          if(lowerTxt.split('\n').length > 20) score -= 3;
          
          // Bonus pour les éléments qui semblent être des messages
          if(element.closest('[role="listitem"]')) score += 1;
          if(element.closest('[class*="message"]')) score += 1;
          
          if(score > bestScore){
            bestScore = score;
            bestCandidate = txt.trim();
            console.log(`[Textoo·Assist] Nouveau meilleur candidat (score: ${score}): "${txt.substring(0, 100)}..."`);
          }
        }
      }
      
      if(bestCandidate && bestScore > 0){
        console.log(`[Textoo·Assist] ✅ Message Outlook trouvé avec score ${bestScore}`);
        return bestCandidate;
      }
      
      console.log('[Textoo·Assist] ❌ Aucun message Outlook trouvé');
      return '';
    }
    
    return '';
  }
  function insertInComposer(text){
    const box = findComposerBox();
    if(!box){ 
      log('Composer introuvable');
      if(IS_OUTLOOK){
        // Fallback pour Outlook : essayer d'autres sélecteurs
        const fallbackBox = $('div[contenteditable="true"]') || $('textarea');
        if(fallbackBox){
          log('Utilisation du composer fallback Outlook');
          const fdoc = fallbackBox.ownerDocument || document;
          const fwin = fdoc.defaultView || window;
          fallbackBox.focus();
          try {
            if(fallbackBox.tagName === 'TEXTAREA'){
              fallbackBox.value = (fallbackBox.value || '') + text;
              fallbackBox.dispatchEvent(new Event('input', {bubbles: true}));
            } else {
              if(fdoc.execCommand('insertText', false, text)) return true;
            }
            return true;
          } catch(e){ log('Fallback Outlook failed', e); }
        }
      }
      return false; 
    }

    const doc = box.ownerDocument || document;
    const win = doc.defaultView || window;
    box.focus();

    if(IS_OUTLOOK){
      // Logique spécifique pour Outlook (utiliser le contexte du document propriétaire)
      try {
        // Méthode 1 : insertText sur le document de l'iframe si besoin
        if(doc.execCommand('insertText', false, text)){
          log('✅ Texte inséré dans Outlook via insertText');
          return true;
        }
      } catch(e1){ /* continue to next method */ }
      try {
        // Méthode 2 : Manipulation DOM directe dans le bon document
        if(box.isContentEditable){
          const selection = win.getSelection();
          let range;
          try { range = selection.getRangeAt(0); } catch(_e){ range = doc.createRange(); range.selectNodeContents(box); range.collapse(false); }
          range.deleteContents();
          const textNode = doc.createTextNode(text);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          log('✅ Texte inséré dans Outlook via DOM');
          return true;
        }
      } catch(e2){ /* continue */ }
      try {
        // Méthode 3 : innerHTML dans le bon document
        if('innerHTML' in box){
          box.innerHTML = (box.innerHTML || '') + text.replace(/\n/g, '<br>');
          log('✅ Texte inséré dans Outlook via innerHTML');
          return true;
        }
      } catch(e3){
        log('❌ Toutes les méthodes Outlook ont échoué', e3);
      }
      return false;
    }

    // Logique Gmail existante (document principal)
    try {
      if(doc.execCommand('insertText', false, text)) return true;
    } catch(_){
      try {
        const rng = doc.createRange();
        rng.selectNodeContents(box);
        rng.collapse(false);
        const sel = (box.ownerDocument || document).getSelection ? (box.ownerDocument || document).getSelection() : window.getSelection();
        sel.removeAllRanges();
        sel.addRange(rng);
        if(doc.execCommand('insertText', false, text)) return true;
      } catch(err){ log('Insert fallback failed', err); }
    }
    return false;
  }

  const CSS = `
  :root{
    --hmw-bg:#faf9fc;--hmw-fg:#3f23c2;--hmw-border:#A94BF7;--hmw-muted:#b8aaf2;--hmw-danger:#ff6b6b;
  }
  #hmw-fab{
    position:absolute;z-index:2147483000;display:none;
    width:16px;height:16px;border-radius:2px;
    background:#008a47;color:#fff;
    cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;
    background-image: none !important;
    box-shadow: none !important;
    font-family: system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
    font-weight: 700;
    border: 0 !important; border-width:0 !important; border-style:none !important;
    outline: none !important;
    background-clip: padding-box !important;
    text-shadow: none !important;
    appearance: none !important;
    -webkit-appearance: none !important;
    
    text-align: center;
font-size: 11px;
    line-height: 1;
    
    padding: 0;

  }
  #hmw-fab::before, #hmw-fab::after{ content:none !important; display:none !important; }
  #hmw-fab:focus{ outline:none !important; }
  #hmw-menu{
    position:absolute;z-index:2147483000;display:none;
    background:#fff;border:1px solid #ede9ff;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.12);
    padding:8px;min-width:160px;width:max-content;max-width:calc(100vw - 16px);
  }
  #hmw-menu button{
    display:grid;grid-template-columns:14px 1fr;align-items:center;column-gap:10px;white-space:nowrap;
    width:100%;padding:8px 12px;border:none;background:transparent;
    color:#3f23c2;font-size: 11px;line-height:20px;cursor:pointer;border-radius:8px;text-align:left;min-height:38px;
  }
  #hmw-menu button:hover{background:#f6f3ff}
  #hmw-box{
    position:absolute;z-index:2147483000;background:var(--hmw-bg);
    border:1px solid var(--hmw-border);border-radius:4px;box-shadow:0 2px 17px rgba(63,35,194,.12);
    overflow:hidden;backdrop-filter:saturate(1.1);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
    width:${BOX_WIDTH}px;
  }
  #hmw-box.dragging{opacity:0.92;cursor:grabbing;}
  #hmw-box .hmw-header{display:flex;align-items:center;justify-content:space-between;padding:8px 12px 0 12px;gap:8px;cursor:grab;user-select:none;}
  #hmw-box.dragging .hmw-header{cursor:grabbing;}
  #hmw-box .hmw-title{font-style:italic;color:var(--hmw-muted);font-size: 11px;flex:1;}
  #hmw-box .hmw-area{position:relative;margin:8px 12px 6px 12px;border-radius:8px;background:#FAF9FC;}
  #hmw-box textarea{
    width:100%;height:54px;min-height:42px;max-height:180px;padding:12px 44px 12px 18px;
    border:0;outline:0;resize:vertical;background:transparent;color:#301994;font-size: 11px;line-height:1.35;
  }
  #hmw-copy{
    position:absolute;right:10px;top:10px;font-size:16px;color:var(--hmw-fg);opacity:.85;cursor:pointer;user-select:none;
  }
  #hmw-box .hmw-chip{
    display:none;padding:8px 44px 6px 14px;color:#7c74c9;background:#f6f3ff;border-bottom:1px solid var(--hmw-border);
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;
  }
  #hmw-result{display:none;padding:12px 14px;color:#261a86;font-size: 11px;line-height:1.35;max-height:220px;overflow:auto;white-space:pre-wrap;}
  #hmw-actions{
    display:flex;align-items:center;gap:18px;justify-content:center;border-top:1px solid #F3F0FF;padding:10px 12px;background:#FFFFFF;
  }
  #hmw-actions .hmw-link{appearance:none;border:0;background:transparent;color:var(--hmw-fg);font-weight:400;font-size: 11px;line-height:1;padding:6px 0;cursor:pointer;}
  #hmw-actions .hmw-sep{width:1px;height:16px;background:#cbbefc;}
  #hmw-close{
    position:absolute;right:8px;bottom:8px;width:22px;height:22px;border-radius:50%;background:var(--hmw-danger);
    color:#fff;font-weight:700;
    text-align: center;
border:0;line-height:22px;text-align:center;font-size: 11px;cursor:pointer;
  }
  #hmw-box.has-result .hmw-chip{display:block;}
  #hmw-box.has-result textarea{display:none;}
  #hmw-box.has-result #hmw-result{display:block;}
  mark.hmw-err,mark.hmw-warn{background:transparent;color:inherit;padding:0;-webkit-text-fill-color:currentColor;}
  mark.hmw-err{text-decoration:underline wavy #ff6b6b 2px;}
  mark.hmw-warn{text-decoration:underline wavy #3f23c2 2px;}
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.documentElement.appendChild(styleEl);

  let fab, menu;
  let panelPos = null;
  let lastSelectedText = ''; // Variable pour stocker le dernier texte sélectionné
  let lastSelectionRange = null; // Variable pour stocker la range de sélection
  try {
    const savedPos = JSON.parse(localStorage.getItem('textooAssistPos') || 'null');
    if(savedPos && typeof savedPos.left === 'number' && typeof savedPos.top === 'number'){
      panelPos = savedPos;
    }
  } catch(e){}
  function savePanelPos(left, top){
    panelPos = { left, top, pinned:true };
    try{ localStorage.setItem('textooAssistPos', JSON.stringify(panelPos)); }catch(e){}
  }
  function clearSavedPanelPos(){
    panelPos = null;
    try{ localStorage.removeItem('textooAssistPos'); }catch(e){}
  }
  // Positionne le FAB et le menu à l'intérieur visuel du composeur
  // Détecte si la sélection/caret est à l'intérieur d'un élément
  function isSelectionInside(el){
    try{
      const sel = window.getSelection();
      if(!sel || sel.rangeCount===0) return false;
      const r = sel.getRangeAt(0);
      const common = r.commonAncestorContainer;
      const node = common.nodeType===1 ? common : common.parentNode;
      return !!(node && el && el.contains(node));
    }catch(_){ return false; }
  }
  // Sur Outlook, ne prendre que le composer actif (en cours d'édition)
  function findActiveComposerForFab(){
    if(IS_GMAIL){
      const selector = 'div[aria-label="Corps du message"], div[aria-label="Message body"]';
      const ae = document.activeElement;
      if(ae){
        const focused = ae.closest ? ae.closest(selector) : null;
        if(focused) return focused;
      }
      // sélection
      try{
        const sel = window.getSelection();
        if(sel && sel.rangeCount){
          const node = sel.getRangeAt(0).commonAncestorContainer;
          const el = (node.nodeType===1?node:node.parentNode);
          const cont = el && el.closest ? el.closest(selector) : null;
          if(cont) return cont;
        }
      }catch(_){ }
      return findComposerBox();
    }
    if(!IS_OUTLOOK) return findComposerBox();
    const selector = 'div[aria-label="Message body"], div[aria-label="Corps du message"], div[aria-label="Rédiger un message"], div[role="textbox"][aria-label*="message"], div[contenteditable="true"][role="textbox"], div[data-testid="rooster-editor"], div.rooster-editor, [role="textbox"][contenteditable="true"]';
    // 1) priorité: élément actif contenteditable conforme au selector
    const ae = document.activeElement;
    if(ae && ae.matches && ae.matches(selector)) return ae;
    const focused = ae && ae.closest ? ae.closest(selector) : null;
    if(focused) return focused;
    // 2) priorité: sélection courante à l'intérieur d'un composer
    const candidates = Array.from(document.querySelectorAll(selector));
    for(const c of candidates){ if(isSelectionInside(c)) return c; }
    // 3) Pas de fallback en Outlook: si pas d'édition active, ne rien afficher
    return null;
  }
  function positionFabAndMenu(){
    if(!fab) return;
    // Hors Gmail/Outlook: ancrer à l'intérieur du champ éditable actif uniquement; sinon masquer
    if(!(typeof IS_GMAIL!=="undefined" && IS_GMAIL) && !(typeof IS_OUTLOOK!=="undefined" && IS_OUTLOOK)){
      try{
        const comp = findActiveGenericEditableForFab();
        if(comp && comp.isConnected){
          let r = comp.getBoundingClientRect();
          // Si la sélection est à l'intérieur, privilégier le rect de sélection
          try{
            const sel = window.getSelection();
            if(sel && sel.rangeCount && isSelectionInside(comp)){
              const rr = sel.getRangeAt(0);
              const rects = rr.getClientRects();
              const last = rects && rects.length ? rects[rects.length-1] : rr.getBoundingClientRect();
              if(last && last.width>=0 && last.height>=0) r = last;
            }
          }catch(_){ }
          if(r && (r.width>0 || r.height>0)){
            // Utiliser des coordonnées viewport avec position:fixed et décaler vers l'intérieur du champ
            const size = 14; // taille du mini-FAB (style MerciApp)
            const inset = 8; // décalage intérieur plus visible
            const left = (r.left) + (r.width>0 ? r.width : 0) - size - inset;
            const top  = (r.top)  + (r.height>0 ? r.height : 0) - size - inset;
            fab.style.setProperty('position', 'fixed', 'important');
            fab.style.left = left + 'px';
            fab.style.top  = top  + 'px';
            fab.style.removeProperty('right');
            fab.style.removeProperty('bottom');
            fab.style.setProperty('display', 'block', 'important');
            fab.style.setProperty('z-index', '2147483000', 'important');
            fab.style.setProperty('visibility', 'visible', 'important');
            fab.style.setProperty('opacity', '1', 'important');
            fab.style.setProperty('pointer-events', 'auto', 'important');
            fab.style.setProperty('transform', 'none', 'important');
            fab.style.setProperty('filter', 'none', 'important');
            if(menu) menu.style.display = 'none';
            try{ updateFabCounter(comp); }catch(_){ }
            return;
          }
        }
        // Aucun champ actif détecté: masquer le mini-FAB
        fab.style.setProperty('display', 'none', 'important');
        if(menu) menu.style.display = 'none';
      }catch(_){ }
      return;
    }
    const comp = findActiveComposerForFab();
    if(!comp || !comp.isConnected){
      fab.style.display = 'none';
      if(menu) menu.style.display = 'none';
      return;
    }
    const r = comp.getBoundingClientRect();
    if(!r || r.width === 0 || r.height === 0){
      fab.style.display = 'none';
      if(menu) menu.style.display = 'none';
      return;
    }
    const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

    // Positionner le FAB exactement à l'emplacement du compteur de fautes (badge)
    // Même logique que dans FieldWatcher.positionOverlay()
    const left = (r.left + scrollX) + r.width - 8;
    const top  = (r.top + scrollY) - 8;

    fab.style.left = left + 'px';
    fab.style.top  = top + 'px';
    // Mettre à jour le compteur pour CE composer précis avant l'affichage
    try{ 
      let c = 0;
      if(typeof watched !== 'undefined' && watched && watched.has && watched.has(comp)){
        const inst = watched.get(comp);
        if(inst && Array.isArray(inst.results)) c = inst.results.length || 0;
      }
      if(c === 0){
        const markers = document.querySelectorAll('.textoo-marker').length;
        if(markers > 0) c = markers;
      }
      updateFabCounter(comp, c); 
    }catch(_){ }
    fab.style.display = 'block';

    if(menu && menu.style.display === 'block'){
      // Positionner le menu au-dessus ou en dessous selon la place disponible, et le borner au viewport
      const mw = menu.offsetWidth || 220;
      const mh = menu.offsetHeight || 150;
      const vw = window.innerWidth || document.documentElement.clientWidth || 1024;
      const vh = window.innerHeight || document.documentElement.clientHeight || 768;
      const sx = window.scrollX || document.documentElement.scrollLeft || 0;
      const sy = window.scrollY || document.documentElement.scrollTop || 0;
      const pad = 8;
      // Try above by default
      let mTop = top - mh - 8;
      let mLeft = left;
      // If above doesn't fit, place below
      if(mTop < sy + pad) mTop = Math.min(sy + vh - mh - pad, top + ((typeof fab!=='undefined' && fab && fab.getBoundingClientRect ? fab.getBoundingClientRect().height : 26)) + 8);
      // Clamp horizontally within viewport (document coords)
      mLeft = Math.min(Math.max(sx + pad, mLeft), sx + vw - mw - pad);
      // Final clamp vertical (document coords)
      mTop = Math.min(Math.max(sy + pad, mTop), sy + vh - mh - pad);
      menu.style.left = mLeft + 'px';
      menu.style.top  = mTop + 'px';
    }
  }
  function ensureFab(){
  if(fab) return;
  fab = document.createElement('button');
  fab.id = 'hmw-fab';
  fab.title = 'Textoo Assist';
  // Compteur numérique initial
  fab.textContent = '0';
  fab.setAttribute('aria-live', 'polite');
  document.body.appendChild(fab);
  try{ window.__textooFab = fab; }catch(_){ }
  try{ updateFabCounter(); }catch(_){ }

  menu = document.createElement('div');
  menu.id = 'hmw-menu';
  menu.innerHTML = `
    <button data-act="correct"><span class="hmw-ico ico-correct" aria-hidden="true"></span><span>Corriger</span></button>
    <button data-act="quick-reply"><span class="hmw-ico ico-quick" aria-hidden="true"></span><span>Réponse rapide</span></button>
    <button data-act="reformulate"><span class="hmw-ico ico-reform" aria-hidden="true"></span><span>Reformulation</span></button>
  `;
  document.body.appendChild(menu);
  // Placer immédiatement si un composeur est présent
  positionFabAndMenu();

  // Capturer la sélection avant que le clic ne la perde
  on(fab,'mousedown',(e)=>{
    // Capturer le texte sélectionné au moment du mousedown
    lastSelectedText = getSelectedText();
    console.log('Texte capturé au mousedown:', lastSelectedText);
  });
  
  on(fab,'mouseenter',(e)=>{
    // Capturer aussi au survol pour plus de sécurité
    const currentSelection = getSelectedText();
    if(currentSelection) {
      lastSelectedText = currentSelection;
      console.log('Texte capturé au mouseenter:', lastSelectedText);
    }
  });
  
  // Capturer la sélection lors du survol du menu
  on(menu,'mouseenter',(e)=>{
    const currentSelection = getSelectedText();
    if(currentSelection) {
      lastSelectedText = currentSelection;
      console.log('Texte capturé au survol du menu:', lastSelectedText);
    }
  });
  
  on(fab,'click',(e)=>{
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    // Repositionner le menu par rapport au FAB
    positionFabAndMenu();
    
    // Essayer de restaurer la sélection après l'ouverture du menu
    if(lastSelectionRange) {
      setTimeout(() => {
        try {
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(lastSelectionRange);
        } catch(e) {
          console.log('Impossible de restaurer la sélection:', e);
        }
      }, 100);
    }
  });
  
  on(document,'click',(e)=>{ if(menu && !menu.contains(e.target) && e.target !== fab) menu.style.display = 'none'; });
  
  // Capturer la sélection de texte en temps réel
  on(document,'selectionchange',()=>{
    const selectedText = getSelectedText();
    if(selectedText) {
      lastSelectedText = selectedText;
      console.log('Texte capturé au selectionchange:', lastSelectedText);
    }
    // Repositionner le FAB pour Outlook si la sélection/focus change de composer
    positionFabAndMenu();
  });
  on(menu,'click',(e)=>{
    const b = e.target.closest('button');
    if(!b) return;
    const action = b.dataset.act;
    if(action === 'correct') {
      correctAllInComposer();
    } else if(action === 'quick-reply') {
      handleDirectQuickReply();
    } else if(action === 'reformulate') {
      handleDirectReformulate();
    } else {
      openPanel('reply');
    }
    menu.style.display = 'none';
  });
}  

  let panel, titleEl, ctxInput, ctxCopy, chip, resultEl, btnProposal, btnQuick, btnInsert, btnClose, btnLint;
  let currentMode = 'reply';

  function buildPanel(){
    if(panel) return;
    panel = document.createElement('div');
    panel.id = 'hmw-box';
    panel.style.display = 'none';
    panel.innerHTML = `
      <div class="hmw-header"><div class="hmw-title"></div><div class="hmw-chip" id="hmw-chip"></div></div>
      <div class="hmw-area">
        <textarea id="hmw-ctx" placeholder="Contexte… (laisse vide ou écris \"répond\" pour une réponse automatique)"></textarea>
        <span id="hmw-copy" title="Copier">📋</span>
        <div id="hmw-result"></div>
      </div>
      <div id="hmw-actions">
        <button class="hmw-link" id="hmw-lint">🔎 Lint</button>
        <span class="hmw-sep"></span>
        <button class="hmw-link" id="hmw-propose">Proposition</button>
        <span class="hmw-sep"></span>
        <button class="hmw-link" id="hmw-quick">Réponse rapide</button>
        <span class="hmw-sep"></span>
        <button class="hmw-link" id="hmw-insert">Insérer</button>
      </div>
      <button id="hmw-close" title="Fermer">✖</button>
    `;
    document.body.appendChild(panel);

    titleEl   = panel.querySelector('.hmw-title');
    ctxInput  = panel.querySelector('#hmw-ctx');
    ctxCopy   = panel.querySelector('#hmw-copy');
    chip      = panel.querySelector('#hmw-chip');
    resultEl  = panel.querySelector('#hmw-result');
    btnProposal = panel.querySelector('#hmw-propose');
    btnQuick    = panel.querySelector('#hmw-quick');
    btnInsert   = panel.querySelector('#hmw-insert');
    btnClose    = panel.querySelector('#hmw-close');
    btnLint     = panel.querySelector('#hmw-lint');

    let dragOffset = {x:0,y:0};
    let dragging = false;
    const header = panel.querySelector('.hmw-header');
    const dragHandles = [header];
    const onDrag = (e)=>{
      if(!dragging) return;
      panel.style.position = 'absolute';
      const left = Math.max(0, e.clientX - dragOffset.x);
      const top = Math.max(0, e.clientY - dragOffset.y);
      panel.style.left = left + 'px';
      panel.style.top  = top + 'px';
    };
    const endDrag = ()=>{
      if(!dragging) return;
      dragging = false;
      panel.classList.remove('dragging');
      document.removeEventListener('mousemove', onDrag);
      savePanelPos(panel.offsetLeft, panel.offsetTop);
    };
    const startDrag = (e)=>{
      if(e.button !== 0) return;
      const rect = panel.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      dragging = true;
      panel.classList.add('dragging');
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', endDrag, { once:true });
      e.preventDefault();
    };
    dragHandles.forEach(el => el && el.addEventListener('mousedown', startDrag));
    header && header.addEventListener('dblclick', () => { clearSavedPanelPos(); positionPanel(); });

    on(ctxCopy,'click',()=>{
      const txt = panel.classList.contains('has-result') ? (resultEl.innerText || '') : (ctxInput.value || '');
      navigator.clipboard?.writeText?.(txt);
    });
    on(btnClose,'click',()=> panel.style.display = 'none');
    on(btnProposal,'click',()=>handleSubmit('draft'));
    on(btnQuick,'click',()=>handleSubmit('quick'));
    on(btnInsert,'click',()=>{
      const txt = panel.classList.contains('has-result') ? resultEl.innerText.trim() : ctxInput.value.trim();
      if(txt) insertInComposer(txt + '\n');
    });
    on(btnLint,'click',async ()=>{
      const composer = findComposerBox();
      if(composer) await runLint(composer);
    });
  }

  function getSelectedText(){
    try {
      const sel = window.getSelection();
      if(sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const selectedText = range.toString().trim();
        
        // Vérifier que la sélection n'est pas vide et contient du texte significatif
        if(selectedText.length > 0) {
          console.log('Texte sélectionné trouvé:', selectedText);
          // Sauvegarder la range pour pouvoir la restaurer et remplacer
          lastSelectionRange = range.cloneRange();
          return selectedText;
        }
      }
      
      // Fallback: essayer de récupérer la sélection depuis l'élément actif
      const activeEl = document.activeElement;
      if(activeEl && (activeEl.tagName === 'DIV' || activeEl.isContentEditable)) {
        const sel = window.getSelection();
        if(sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const selectedText = range.toString().trim();
          if(selectedText.length > 0) {
            console.log('Texte sélectionné trouvé via range:', selectedText);
            lastSelectionRange = range.cloneRange();
            return selectedText;
          }
        }
      }
      
      // Fallback spécifique pour Outlook
      if(IS_OUTLOOK) {
        // Essayer de récupérer la sélection dans les éléments Outlook
        const outlookElements = $$('div[contenteditable="true"], div[role="textbox"], textarea');
        for(const el of outlookElements) {
          if(el === document.activeElement) {
            const sel = window.getSelection();
            if(sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              const selectedText = range.toString().trim();
              if(selectedText.length > 0) {
                console.log('Texte sélectionné trouvé dans Outlook:', selectedText);
                lastSelectionRange = range.cloneRange();
                return selectedText;
              }
            }
          }
        }
      }
      
      console.log('Aucun texte sélectionné trouvé');
      return '';
    } catch(e) {
      console.error('Erreur lors de la récupération de la sélection:', e);
      return '';
    }
  }

  async function handleDirectQuickReply(){
    if(!ENDPOINT){ 
      showToast("Configure l'endpoint dans les options.", 'error');
      return; 
    }
    
    const autoCtx = getLastMessageText() || '';
    if(!autoCtx) {
      showToast("Aucun message détecté pour générer une réponse.", 'error');
      return;
    }

    try {
      const payload = {
        mode:'reply',
        autoTone:true,
        context: autoCtx,
        tone:'direct',
        signature:'Cordialement,\nNOM Prénom'
      };

      const res = await fetch(ENDPOINT, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      
      const data = await res.json().catch(()=>({}));
      const raw = (data && (data.text || data.explanation || '')) || '';
      const formatted = formatMail(raw, { original: autoCtx });
      if(!formatted){
        showToast('Aucune réponse générée.', 'error');
        return;
      }

      // S'assurer que le composeur Outlook est ouvert
      if(IS_OUTLOOK){
        await ensureOutlookReplyComposer(2500);
      }

      // Tenter l'insertion avec plusieurs méthodes et quelques réessais
      let ok = insertInComposer(formatted + '\n');
      if(!ok && IS_OUTLOOK){
        await new Promise(r=>setTimeout(r,150));
        ok = insertInComposer(formatted + '\n');
      }

      if(!ok){
        try{
          await navigator.clipboard.writeText(formatted + '\n');
          alert("ℹ️ Réponse copiée dans le presse‑papiers. Collez-la dans le composer.");
        }catch(_e){
          alert("❌ Impossible d'insérer automatiquement. Copiez/collez cette réponse:\n\n"+formatted);
        }
      }
      // Après insertion ou fallback, relancer une analyse et rafraîchir le compteur
      try{ const box = findComposerBox(); if(box){ await runLint(box); updateFabCounter(box); } }catch(_){ }
      
    } catch(err){
      console.error('[Textoo·Assist] Direct quick reply failed', err);
      alert('❌ Erreur lors de la génération de la réponse rapide.');
    }
  }

  async function handleDirectReformulate(){
    if(!ENDPOINT){ 
      alert("⚠️ Configure l'endpoint dans les options.");
      return; 
    }
    
    // Utiliser le texte sauvegardé ou essayer de récupérer la sélection actuelle
    const selectedText = lastSelectedText || getSelectedText();
    console.log('Texte à reformuler:', selectedText);
    console.log('Texte sauvegardé:', lastSelectedText);
    
    if(!selectedText) {
      alert("❌ Veuillez sélectionner du texte à reformuler avant de cliquer sur le bouton.");
      return;
    }

    try {
      // Payload optimisé pour la reformulation stylistique - UNIQUEMENT le corps du message
      const payload = {
        mode: 'improve',
        text: selectedText,
        context: `Reformule cette phrase dans un ton naturel, respectueux et poli. Utilise le vouvoiement, des formules de politesse comme "s'il vous plaît", "pourriez-vous", "merci", et un langage professionnel mais accessible. IMPORTANT: Ne pas inclure d'objet, de salutation, ni de signature. Juste la phrase reformulée: "${selectedText}"`,
        style: 'polite_professional',
        tone: 'respectful_polite',
        phraseOnly: true,
        noSignature: true,
        noSubject: true,
        noGreeting: true,
        bodyOnly: true,
        politeness: 'high',
        formality: 'professional',
        instructions: "Répondre uniquement avec la phrase reformulée dans un ton naturel, respectueux et poli, sans objet ni signature. Utiliser le vouvoiement et des formules de politesse appropriées."
      };

      const res = await fetch(ENDPOINT, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      
      const data = await res.json().catch(()=>({}));
      let reformulated = (data && (data.text || data.explanation || data.reformulated || data.improved || '')) || '';
      
      // Nettoyage ultra-agressif pour ne garder QUE le corps du message
      if(reformulated) {
        // Supprimer TOUS les éléments d'email (objet, salutation, signature) - plus agressif
        reformulated = reformulated.replace(/^(Objet|Subject|Object|Sujet)\s*:.*$/gmi, '').trim();
        reformulated = reformulated.replace(/^(Bonjour|Bonsoir|Cher|Chère|Madame|Monsieur|Monsieur|Madame).*$/gmi, '').trim();
        reformulated = reformulated.replace(/^(Cordialement|Bien à vous|Sincèrement|Merci|Thank you|Best regards|Kind regards).*$/gmi, '').trim();
        reformulated = reformulated.replace(/^(Veuillez agréer|Je vous prie d'agréer).*$/gmi, '').trim();
        
        // Supprimer aussi les patterns d'objet qui pourraient rester
        reformulated = reformulated.replace(/^.*?(Objet|Subject|Object|Sujet)\s*:.*$/gmi, '').trim();
        
        // Nettoyer les sauts de ligne multiples et espaces
        reformulated = reformulated.replace(/\n+/g, ' ').trim();
        reformulated = reformulated.replace(/\s+/g, ' ').trim();
        
        // Supprimer les guillemets et ponctuation superflue (mais garder les formules de politesse)
        reformulated = reformulated.replace(/^["'«»]|["'«»]$/g, '').trim();
        // Ne pas supprimer la ponctuation finale si elle fait partie d'une formule de politesse
        if(!reformulated.match(/s'il vous plaît[.!?]*$/i) && !reformulated.match(/merci[.!?]*$/i)) {
          reformulated = reformulated.replace(/^[.,;:!?]+|[.,;:!?]+$/g, '').trim();
        }
        
        // Nettoyage supplémentaire pour éliminer tout résidu d'objet
        reformulated = reformulated.replace(/^.*?(?:objet|subject|object|sujet)\s*:.*$/gmi, '').trim();
        
        // Nettoyage final ultra-agressif - supprimer tout ce qui ressemble à un objet
        reformulated = reformulated.replace(/^.*?(?:objet|subject|object|sujet).*$/gmi, '').trim();
        
        // Si le texte commence encore par "Objet:", le supprimer complètement
        if(reformulated.toLowerCase().startsWith('objet:')) {
          reformulated = reformulated.replace(/^objet\s*:.*$/gmi, '').trim();
        }
        
        // Nettoyage final - supprimer les lignes vides et espaces
        reformulated = reformulated.replace(/^\s*$/gm, '').trim();
        
        // S'assurer qu'on a une phrase complète et cohérente
        if(reformulated.length > 0) {
          // Ajouter un point final si nécessaire
          if(!/[.!?]$/.test(reformulated)) {
            reformulated += '.';
          }
          
          // Si c'est encore trop long, prendre juste la première phrase cohérente
          if(reformulated.length > selectedText.length * 3) {
            const sentences = reformulated.split(/[.!?]+/).filter(s => s.trim().length > 0);
            reformulated = sentences[0] ? sentences[0].trim() + '.' : reformulated.split(' ').slice(0, 12).join(' ').trim() + '.';
          }
        }
        
        console.log('Phrase reformulée stylistique (nettoyée):', reformulated);
      }
      
      if(reformulated && reformulated.trim().length > 0) {
        // Remplacement ciblé de la phrase sélectionnée uniquement
        if(lastSelectionRange) {
          try {
            // Vérifier que la range est toujours valide
            if(lastSelectionRange.startContainer && lastSelectionRange.endContainer) {
              // Restaurer la sélection
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(lastSelectionRange);
              
              // Remplacer le contenu de la range par la version reformulée
              lastSelectionRange.deleteContents();
              lastSelectionRange.insertNode(document.createTextNode(reformulated));
              
              // Nettoyer la sélection
              sel.removeAllRanges();
              
              console.log('Phrase remplacée avec succès:', reformulated);
              
              // Réinitialiser la range sauvegardée
              lastSelectionRange = null;
            } else {
              throw new Error('Range invalide');
            }
          } catch(e) {
            console.error('Erreur lors du remplacement ciblé:', e);
            // Fallback: essayer d'insérer dans le composer
            const composer = findComposerBox();
            if(composer) {
              composer.focus();
              try {
                document.execCommand('insertText', false, reformulated);
                console.log('Phrase insérée dans le composer:', reformulated);
              } catch(e2) {
                console.error('Erreur insertion composer:', e2);
                alert(`Phrase reformulée:\n\n${reformulated}\n\nCopiez-la manuellement.`);
              }
            } else {
              alert(`Phrase reformulée:\n\n${reformulated}\n\nCopiez-la manuellement.`);
            }
          }
        } else {
          // Si pas de range sauvegardée, essayer d'insérer dans le composer
          const composer = findComposerBox();
          if(composer) {
            composer.focus();
            try {
              document.execCommand('insertText', false, reformulated);
              console.log('Phrase insérée dans le composer (sans range):', reformulated);
            } catch(e) {
              console.error('Erreur insertion composer (sans range):', e);
              alert(`Phrase reformulée:\n\n${reformulated}\n\nCopiez-la manuellement.`);
            }
          } else {
            alert(`Phrase reformulée:\n\n${reformulated}\n\nCopiez-la manuellement.`);
          }
        }
      } else {
        alert('❌ Aucune reformulation stylistique générée.');
      }
      
      // Après reformulation, relancer une analyse et rafraîchir le compteur
      try{ const box = findComposerBox(); if(box){ await runLint(box); updateFabCounter(box); } }catch(_){ }
    } catch(err){
      console.error('[Textoo·Assist] Direct reformulate failed', err);
      alert('❌ Erreur lors de la reformulation stylistique.');
    }
  }

  function openPanel(mode){
    currentMode = mode;
    buildPanel();
    
    let title, placeholder, initialValue = '';
    switch(mode) {
      case 'analyze':
        title = 'Analyse rapide';
        placeholder = "Contexte… (facultatif, l'email actuel sera analysé)";
        break;
      case 'quick-reply':
        title = 'Réponse rapide';
        placeholder = "Contexte… (laisse vide pour une réponse automatique)";
        // Pour réponse rapide, on répond directement au mail
        break;
      case 'reformulate':
        title = 'Reformulation';
        // Récupérer le texte sélectionné
        initialValue = getSelectedText();
        if(initialValue) {
          placeholder = "Texte à reformuler…";
        } else {
          placeholder = "Sélectionnez du texte à reformuler ou saisissez-le ici…";
        }
        break;
      default:
        title = 'Rédaction';
        placeholder = "Contexte… (laisse vide ou écris \"répond\" pour une réponse automatique)";
    }
    
    titleEl.textContent = title;
    ctxInput.placeholder = placeholder;
    panel.classList.remove('has-result');
    panel.dataset.mode = currentMode;
    panel.dataset.source = '';
    ctxInput.value = initialValue;
    chip.textContent='';
    resultEl.textContent='';
    positionPanel();
    panel.style.display='block';
    
    // Pour réponse rapide, déclencher automatiquement la génération
    if(mode === 'quick-reply') {
      setTimeout(() => {
        handleSubmit('quick');
      }, 100);
    } else {
      ctxInput.focus();
    }
  }

  function positionPanel(){
    if(panelPos && panelPos.pinned){
      panel.style.position = 'absolute';
      panel.style.left = Math.max(0, panelPos.left) + 'px';
      panel.style.top  = Math.max(0, panelPos.top) + 'px';
      return;
    }
    const comp = findComposerBox();
    if(!comp){
      panel.style.position='fixed';
      panel.style.left = `calc(50% - ${BOX_WIDTH/2}px)`;
      panel.style.top  = '20%';
      return;
    }
    const r = comp.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const top = Math.max(18, r.top + scrollY - 140);
    const left = Math.max(18, r.left + window.scrollX);
    panel.style.position='absolute';
    panel.style.left = `${left}px`;
    panel.style.top  = `${top}px`;
    if(panelPos && panelPos.pinned){
      savePanelPos(left, top);
    } else {
      panelPos = { left, top, pinned:false };
    }
  }

  async function handleSubmit(kind){
    if(!ENDPOINT){ showResult("⚠️ Configure l'endpoint dans les options."); return; }
    let payload = {};
    let sourceContext = '';
    
    if(currentMode === 'analyze'){
      const ctx = getLastMessageText() || ctxInput.value.trim();
      payload = { mode:'explain', context: ctx };
      sourceContext = ctx;
    } else if(currentMode === 'quick-reply'){
      // Pour réponse rapide, utiliser automatiquement le dernier message reçu
      const autoCtx = getLastMessageText() || '';
      const additionalCtx = ctxInput.value.trim();
      payload = {
        mode:'reply',
        autoTone:true,
        context: additionalCtx ? `${autoCtx}\n\nContexte supplémentaire: ${additionalCtx}` : autoCtx,
        tone:'direct',
        signature:'Cordialement,\nNOM Prénom'
      };
      sourceContext = autoCtx;
    } else if(currentMode === 'reformulate'){
      // Pour reformulation, utiliser le texte sélectionné ou saisi
      const ctx = ctxInput.value.trim();
      if(!ctx) {
        showResult("❌ Veuillez sélectionner du texte à reformuler ou le saisir manuellement.");
        return;
      }
      payload = {
        mode:'reformulate',
        context: ctx,
        tone:'direct'
      };
      sourceContext = ctx;
    } else {
      const ctx = ctxInput.value.trim();
      if(kind === 'quick' && (!ctx || /^répond/i.test(ctx))){
        const autoCtx = getLastMessageText() || '';
        payload = {
          mode:'reply',
          autoTone:true,
          context:autoCtx,
          tone:'direct',
          signature:'Cordialement,\nNOM Prénom'
        };
        sourceContext = autoCtx;
      } else {
        payload = {
          mode:'draft',
          context:ctx,
          tone:'direct',
          signature:'Cordialement,\nNOM Prénom'
        };
        sourceContext = ctx;
      }
    }

    btnProposal.disabled = btnQuick.disabled = true;
    const prevProp = btnProposal.textContent;
    const prevQuick = btnQuick.textContent;
    btnProposal.textContent = '…';
    btnQuick.textContent = '…';

    try {
      const res = await fetch(ENDPOINT, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(()=>({}));
      const raw = (data && (data.text || data.explanation || '')) || '';
      const formatted = formatMail(raw, { original: sourceContext });
      showResult(formatted, ctxInput.value.trim());
      panel.dataset.source = sourceContext || '';
    } catch(err){
      console.error('[Textoo·Assist] submit failed', err);
      showResult('❌ Erreur réseau ou serveur.');
    } finally {
      btnProposal.disabled = btnQuick.disabled = false;
      btnProposal.textContent = prevProp;
      btnQuick.textContent = prevQuick;
    }
  }

  function showResult(text, ctx){
    let chipText = '';
    if(ctx && ctx.length) {
      // Tronquer le texte long pour l'affichage du chip
      chipText = ctx.length > 50 ? ctx.substring(0, 47) + '...' : ctx;
    } else {
      switch(currentMode) {
        case 'analyze':
          chipText = 'Analyse du message affiché';
          break;
        case 'quick-reply':
          chipText = 'Réponse rapide générée';
          break;
        case 'reformulate':
          chipText = 'Texte reformulé';
          break;
        default:
          chipText = 'Réponse automatique';
      }
    }
    
    chip.textContent = chipText;
    panel.dataset.mode = currentMode;
    resultEl.textContent = text || '—';
    panel.classList.add('has-result');
    resultEl.scrollTop = 0;
  }

  function formatMail(s, opts={}){
    if(!s) return s;
    let text = s.replace(/^\s*objet\s*:.*$/gmi,'').trim();
    text = text.replace(/\r\n/g,'\n');
    text = text.replace(/^Re:\s*.*(?:\r?\n|$)/i,'').trim();

    const original = (opts && typeof opts.original === 'string') ? opts.original : '';

    let signature = 'Cordialement,\nNOM Prénom';
    const sigMatch = text.match(/\bCordialement\b[\s\S]*$/i);
    if(sigMatch){
      text = text.slice(0, sigMatch.index).trim();
    }

    text = text.replace(/^(?:Re:\s*)?(Bonjour|Bonsoir)[^\n]*\n?/i,'').trim();

    text = text.replace(/\n{3,}/g,'\n\n').trim();

    let paragraphs = text.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);

    if(original && !/\?/.test(original)){
      const filtered = paragraphs.filter(p => !/\?\s*$/.test(p));
      if(filtered.length){
        paragraphs = filtered;
      }
    }

    if(paragraphs.length === 0){
      paragraphs = ['Merci pour votre retour.'];
    }

    let nameCandidate = '';
    const nameMatch = original.match(/(?:Bonjour|Bonsoir)\s+([^,\n]+)/i);
    if(nameMatch){
      const candidate = nameMatch[1].replace(/[,:;]+$/,'').trim();
      if(candidate && !/^à\s+tous/i.test(candidate) && !/^à\s+toutes/i.test(candidate)){
        nameCandidate = candidate;
      }
    }

    const greeting = nameCandidate ? `Bonjour ${nameCandidate},` : 'Bonjour,';
    const body = paragraphs.join('\n\n');

    return `${greeting}\n\n${body}\n\n${signature}`.trim();
  }

  // Fallback local minimal reply when endpoint is down or returns empty
  function buildLocalQuickReply(original){
    const nameMatch = (original||'').match(/(?:Bonjour|Bonsoir)\s+([^,\n]+)/i);
    const name = nameMatch ? nameMatch[1].replace(/[,:;]+$/,'').trim() : '';
    const greeting = name ? `Bonjour ${name},` : 'Bonjour,';
    let body = "Merci pour votre message. Je vous confirme bonne réception et reviens vers vous rapidement avec plus de détails.";
    const lower = (original||'').toLowerCase();
    if(lower.includes('formation') && (lower.includes('confirmer')||lower.includes('présence'))){
      body = "Merci pour cette information concernant la formation. Je confirme ma présence à la session indiquée.";
    } else if(lower.includes('réunion')||lower.includes('meeting')||lower.includes('rendez-vous')){
      body = "Merci pour votre message. La réunion est bien notée; je confirme ma disponibilité et viendrai préparé.";
    }
    const signature = 'Cordialement,\nNOM Prénom';
    return `${greeting}\n\n${body}\n\n${signature}`;
  }

  function extractTextAndMap(rootEl){
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let text='', pos=0, node;
    while((node = walker.nextNode())){
      const val = node.nodeValue || '';
      if(!val) continue;
      nodes.push({ node, start:pos, end:pos + val.length });
      text += val;
      pos += val.length;
    }
    return { text, nodes };
  }
  function clearHighlights(rootEl){
    rootEl.querySelectorAll('mark.hmw-err, mark.hmw-warn').forEach(mark=>{
      const parent = mark.parentNode;
      while(mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    });
  }
  function wrapRange(nodes, start, end, cls, title){
    if(end <= start) return;
    let idx = nodes.findIndex(n => start >= n.start && start < n.end);
    if(idx === -1) return;
    let remaining = end - start;
    let offset = start - nodes[idx].start;
    while(idx < nodes.length && remaining > 0){
      const info = nodes[idx];
      const take = Math.min(remaining, info.end - (info.start + offset));
      const textNode = info.node;
      const range = document.createRange();
      range.setStart(textNode, offset);
      range.setEnd(textNode, offset + take);
      const mark = document.createElement('mark');
      mark.className = cls;
      if(title) mark.title = title;
      range.surroundContents(mark);
      remaining -= take;
      idx += 1;
      offset = 0;
    }
  }
  function applyHighlights(rootEl, issues, nodes){
    const sorted = [...issues].sort((a,b)=>b.start - a.start);
    for(const it of sorted){
      const cls = it.severity ==='warning' ? 'hmw-warn' : 'hmw-err';
      wrapRange(nodes, it.start, it.end, cls, it.message || '');
    }
  }
  async function runLint(composerEl){
    try {
      clearHighlights(composerEl);
      const { text, nodes } = extractTextAndMap(composerEl);
      if(!text.trim()){
        try{ updateFabCounter(composerEl, 0); }catch(_){ }
        return;
      }
      if(!ENDPOINT){ console.warn('[Textoo·Assist] Endpoint manquant pour lint'); return; }
      const res = await fetch(ENDPOINT, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ mode:'lint', text })
      });
      if(!res.ok) return;
      const data = await res.json().catch(()=>({}));
      const issues = Array.isArray(data.issues) ? data.issues : [];
      applyHighlights(composerEl, issues, nodes);
      // Mettre à jour le comptueur FAB en fonction des résultats
      try{ updateFabCounter(composerEl, issues.length); }catch(_){ }
    } catch(err){
      console.error('[Textoo·Assist] runLint failed', err);
    }
  }
  
  // --- Bootstrapping / ensure module starts ---
  function enforceMiniFabStyles(){
    try{
      if(!fab) return;
      if((typeof IS_GMAIL!=="undefined" && IS_GMAIL) || (typeof IS_OUTLOOK!=="undefined" && IS_OUTLOOK)) return;
      // Assurer style mini-point (dupliquer logique d'updateFabCounter au cas où)
      fab.style.setProperty('width', '12px', 'important');
      fab.style.setProperty('height', '12px', 'important');
      fab.style.setProperty('border-radius', '50%', 'important');
      fab.style.setProperty('font-size', '0', 'important');
      fab.style.setProperty('line-height', '0', 'important');
      fab.style.setProperty('border', '1px solid #ffffff', 'important');
      fab.style.setProperty('box-shadow', '0 2px 6px rgba(0,0,0,0.25)', 'important');
      fab.style.setProperty('display', 'block', 'important');
      fab.style.setProperty('position', 'fixed', 'important');
      fab.style.setProperty('right', '16px', 'important');
      fab.style.setProperty('bottom', '20px', 'important');
      fab.style.setProperty('z-index', '2147483000', 'important');
      fab.style.setProperty('visibility', 'visible', 'important');
      fab.style.setProperty('opacity', '1', 'important');
    }catch(_){ }
  }
  let __activeEditable = null;
  let __activeEditableResizeObs = null;
  function setActiveEditable(el){
    try{
      if(__activeEditable === el) return;
      // cleanup previous
      try{ __activeEditable?.removeEventListener('scroll', positionFabAndMenu); }catch(_){ }
      try{ __activeEditable?.removeEventListener('input', positionFabAndMenu, {passive:true}); }catch(_){ }
      try{ __activeEditable?.removeEventListener('keyup', positionFabAndMenu, {passive:true}); }catch(_){ }
      try{ __activeEditableResizeObs?.disconnect(); __activeEditableResizeObs = null; }catch(_){ }
      __activeEditable = el;
      if(!__activeEditable) return;
      __activeEditable.addEventListener('scroll', positionFabAndMenu, {passive:true});
      __activeEditable.addEventListener('input', positionFabAndMenu, {passive:true});
      __activeEditable.addEventListener('keyup', positionFabAndMenu, {passive:true});
      if(window.ResizeObserver){
        __activeEditableResizeObs = new ResizeObserver(()=>positionFabAndMenu());
        __activeEditableResizeObs.observe(__activeEditable);
      }
    }catch(_){ }
  }

  function init(){
    try{
      ensureFab();
      buildPanel();
      positionFabAndMenu();
      try{ updateFabCounter(); }catch(_){ }
      // Attacher dynamiquement dès qu'un champ éditable reçoit le focus (hors Gmail/Outlook inclus)
      try{
        const genericSel = 'textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input:not([type]), [contenteditable=""], [contenteditable="true"]';
        document.addEventListener('focusin', (ev)=>{
          let cand = null;
          try{
            const path = (typeof ev.composedPath === 'function') ? ev.composedPath() : [];
            for(const node of path){
              if(node && node.nodeType===1 && (node.matches||node.closest)){
                if(node.matches && node.matches(genericSel)){ cand = node; break; }
                const c = node.closest && node.closest(genericSel);
                if(c){ cand = c; break; }
              }
            }
          }catch(_){ }
          if(!cand){
            const t = ev.target;
            if(t && (t.matches||t.closest)){
              cand = t.matches(genericSel) ? t : (t.closest && t.closest(genericSel));
            }
          }
          if(cand){
            try{ updateFabCounter(cand); }catch(_){ }
            setActiveEditable(cand);
            positionFabAndMenu();
          }
        }, true);
      }catch(_){ }
      // Repositionner sur scroll/resize au cas où l'UI couvre le FAB
      try{
        window.addEventListener('scroll', ()=>{ positionFabAndMenu(); }, {passive:true});
        window.addEventListener('resize', ()=>{ positionFabAndMenu(); }, {passive:true});
        document.addEventListener('input', (e)=>{
          const t = e.target;
          if(!t) return;
          const genericSel = 'textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input:not([type]), [contenteditable=""], [contenteditable="true"]';
          if((t.matches && t.matches(genericSel)) || (t.closest && t.closest(genericSel))){ positionFabAndMenu(); }
        }, {passive:true});
        document.addEventListener('keyup', (e)=>{
          const t = e.target;
          if(!t) return;
          const genericSel = 'textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input:not([type]), [contenteditable=""], [contenteditable="true"]';
          if((t.matches && t.matches(genericSel)) || (t.closest && t.closest(genericSel))){ positionFabAndMenu(); }
        }, {passive:true});
      }catch(_){ }
      // Fallback périodique: attacher sur l'élément actif s'il est éditable (couvre Shadow DOM/SPA récalcitrants)
      try{
        setInterval(()=>{
          try{
            const ae = document.activeElement;
            if(!ae) return;
            const genericSel = 'textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input:not([type]), [contenteditable=""], [contenteditable="true"]';
            const cand = (ae.matches && ae.matches(genericSel)) ? ae : (ae.closest && ae.closest(genericSel));
            if(cand){
              updateFabCounter(cand);
              setActiveEditable(cand);
              positionFabAndMenu();
            }
          }catch(_){}
        }, 1500);
      }catch(_){ }
    }catch(_){ }
  }
  // Système de compteur live pour les autres sites (non-Gmail/Outlook)
  let liveCounter = null;
  let currentActiveElement = null;
  let liveCounterTimeout = null;

  function createLiveCounter() {
    if (liveCounter) {
      console.log('Compteur déjà créé');
      return liveCounter;
    }
    
    console.log('Création du compteur live');
    liveCounter = document.createElement('div');
    liveCounter.id = 'textoo-live-counter-badge';
    liveCounter.className = 'textoo-live-counter';
    liveCounter.textContent = '0';
    liveCounter.style.cssText = `
      position: fixed !important;
      background: #e53935 !important;
      color: #fff !important;
      font: 10px/12px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif !important;
      width: 14px !important;
      height: 14px !important;
      border-radius: 3px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 2147483647 !important;
      box-shadow: 0 1px 2px rgba(0,0,0,.25) !important;
      pointer-events: none !important;
      user-select: none !important;
      opacity: 0 !important;
      transform: scale(0.8) !important;
      transition: opacity 0.2s ease, transform 0.2s ease !important;
      cursor: pointer !important;
      min-width: 14px !important;
      min-height: 14px !important;
    `;
    document.body.appendChild(liveCounter);
    console.log('Compteur créé et ajouté au DOM');
    return liveCounter;
  }

  function updateLiveCounterPosition(element) {
    if (!liveCounter || !element) return;
    try {
      const rect = element.getBoundingClientRect();
      const cursorPos = getCursorPosition(element);
      
      // Calculer la position précise du curseur
      const charWidth = 8; // Largeur approximative d'un caractère
      const lineHeight = 16; // Hauteur de ligne
      
      // Position de base : coin supérieur gauche de l'élément
      let x = rect.left;
      let y = rect.top;
      
      // Ajuster selon la position du curseur
      if (cursorPos > 0) {
        // Calculer la position horizontale du curseur
        const textBeforeCursor = (element.value || element.textContent || '').substring(0, cursorPos);
        const textWidth = textBeforeCursor.length * charWidth;
        x += Math.min(textWidth, rect.width - 20);
      }
      
      // Positionner le compteur juste à droite du curseur
      x += 5; // Petit décalage pour ne pas coller au texte
      y += lineHeight / 2 - 7; // Centrer verticalement (7 = moitié de la hauteur du compteur)
      
      // S'assurer que le compteur reste visible
      const counterSize = 14;
      const margin = 10;
      
      if (x + counterSize + margin > window.innerWidth) {
        x = window.innerWidth - counterSize - margin;
      }
      if (x < margin) {
        x = margin;
      }
      if (y + counterSize + margin > window.innerHeight) {
        y = window.innerHeight - counterSize - margin;
      }
      if (y < margin) {
        y = margin;
      }
      
      liveCounter.style.left = x + 'px';
      liveCounter.style.top = y + 'px';
      
      console.log('Position du compteur:', x, y, 'curseur:', cursorPos);
    } catch (e) {
      console.error('Erreur positionnement:', e);
    }
  }

  function getCursorPosition(element) {
    try {
      if (element.setSelectionRange) {
        return element.selectionStart || 0;
      } else if (window.getSelection) {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const preCaretRange = range.cloneRange();
          preCaretRange.selectNodeContents(element);
          preCaretRange.setEnd(range.endContainer, range.endOffset);
          return preCaretRange.toString().length;
        }
      }
      return 0;
    } catch (e) {
      return 0;
    }
  }

  function updateLiveCounterText(count) {
    if (!liveCounter) {
      console.log('Pas de compteur à mettre à jour');
      return;
    }
    
    console.log('Mise à jour du compteur avec', count, 'erreurs');
    
    // Mettre à jour le texte
    liveCounter.textContent = count.toString();
    
    // Appliquer la couleur directement via style (même logique que Gmail/Outlook)
    if (count === 0) {
      liveCounter.style.background = '#22c55e'; // Vert (0 erreur)
    } else {
      liveCounter.style.background = '#e53935'; // Rouge (1+ erreurs)
    }
    
    // Afficher le compteur avec animation
    liveCounter.style.opacity = '1';
    liveCounter.style.transform = 'scale(1)';
    
    console.log('Compteur mis à jour:', liveCounter.textContent, 'couleur:', liveCounter.style.background);
  }

  function hideLiveCounter() {
    if (liveCounter) {
      liveCounter.classList.remove('visible');
      setTimeout(() => {
        if (liveCounter) liveCounter.style.display = 'none';
      }, 200);
    }
  }

  function countErrorsInText(text) {
    if (!text || text.trim().length < 2) return 0;
    
    let count = 0;
    
    // Détection complète des erreurs courantes
    const allErrors = [
      // Erreurs de conjugaison - détection individuelle
      { pattern: /j'ai\s+manger\b/gi, name: "j'ai manger" },
      { pattern: /j'ai\s+etre\b/gi, name: "j'ai être" },
      { pattern: /j'ai\s+avoir\b/gi, name: "j'ai avoir" },
      { pattern: /j'ai\s+faire\b/gi, name: "j'ai faire" },
      { pattern: /j'ai\s+aller\b/gi, name: "j'ai aller" },
      { pattern: /j'ai\s+venir\b/gi, name: "j'ai venir" },
      { pattern: /j'ai\s+voir\b/gi, name: "j'ai voir" },
      { pattern: /j'ai\s+savoir\b/gi, name: "j'ai savoir" },
      { pattern: /j'ai\s+prendre\b/gi, name: "j'ai prendre" },
      
      // Erreurs d'articles - détection individuelle
      { pattern: /\bdes\b/gi, name: "des (article)" },
      { pattern: /\bdes\s+(?:poulet|poisson|chat|chien)\b/gi, name: "des + animal" },
      { pattern: /\bdes\s+(?:maison|voiture|livre)\b/gi, name: "des + objet" },
      
      // Erreurs de prépositions - détection individuelle
      { pattern: /\ba\b/gi, name: "à (préposition)" },
      { pattern: /\ba\s+(?:la|le|les)\b/gi, name: "à la/le/les" },
      { pattern: /\ba\s+(?:maison|école|travail)\b/gi, name: "à + lieu" },
      
      // Erreurs de mots - détection individuelle
      { pattern: /\bmanger\b/gi, name: "manger (infinitif)" },
      { pattern: /\bpoulet\b/gi, name: "poulet" },
      
      // Erreurs spécifiques
      { pattern: /c'est\s+etais\b/gi, name: "c'est etais" },
      { pattern: /c'est\s+etait\b/gi, name: "c'est etait" },
      { pattern: /\bet\s+est\b/gi, name: "et est" },
      { pattern: /\bon\s+ont\b/gi, name: "on ont" },
      { pattern: /\bpulet\b/gi, name: "pulet" },
      { pattern: /\bpoisson\b/gi, name: "poisson" },
      { pattern: /\bpoison\b/gi, name: "poison" }
    ];
    
    // Compter toutes les erreurs détectées
    for (const error of allErrors) {
      const matches = text.match(error.pattern);
      if (matches) {
        count += matches.length;
        console.log(`Erreur détectée: ${error.name} (${matches.length})`);
      }
    }
    
    // Essayer d'utiliser les fonctions avancées en plus
    try {
      const idx = { text: text };
      
      if (typeof a_buildAvoirInfMatches2 === 'function') {
        const avoirMatches = a_buildAvoirInfMatches2(idx);
        count += avoirMatches.length;
        if (avoirMatches.length > 0) {
          console.log(`Erreurs avoir+inf avancées: ${avoirMatches.length}`);
        }
      }
      
      if (typeof a_buildEtreInfMatches === 'function') {
        const etreMatches = a_buildEtreInfMatches(idx);
        count += etreMatches.length;
        if (etreMatches.length > 0) {
          console.log(`Erreurs être+inf avancées: ${etreMatches.length}`);
        }
      }
      
      if (typeof a_buildCTetaitMatches === 'function') {
        const ctetaitMatches = a_buildCTetaitMatches(idx);
        count += ctetaitMatches.length;
        if (ctetaitMatches.length > 0) {
          console.log(`Erreurs c'est etais avancées: ${ctetaitMatches.length}`);
        }
      }
      
    } catch (e) {
      console.log('Erreur dans les fonctions avancées:', e);
    }
    
    console.log(`Total d'erreurs détectées: ${count} pour le texte: "${text}"`);
    return count;
  }

  function handleLiveCounterInput(event) {
    if (IS_GMAIL || IS_OUTLOOK) return;
    
    const element = event.target;
    if (!element) return;
    
    const genericSel = 'textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input:not([type]), [contenteditable=""], [contenteditable="true"]';
    const isEditable = element.matches && element.matches(genericSel);
    const isInEditable = element.closest && element.closest(genericSel);
    
    if (!isEditable && !isInEditable) return;
    
    const targetElement = isEditable ? element : element.closest(genericSel);
    if (!targetElement) return;
    
    console.log('INPUT détecté sur:', targetElement);
    currentActiveElement = targetElement;
    createLiveCounter();
    
    if (liveCounterTimeout) {
      clearTimeout(liveCounterTimeout);
    }
    
    liveCounterTimeout = setTimeout(() => {
      try {
        const text = targetElement.value || targetElement.textContent || '';
        const errorCount = countErrorsInText(text);
        console.log('Mise à jour compteur:', errorCount, 'erreurs');
        updateLiveCounterText(errorCount);
        updateLiveCounterPosition(targetElement);
      } catch (e) {
        console.error('Erreur dans handleLiveCounterInput:', e);
        hideLiveCounter();
      }
    }, 200);
  }

  function handleLiveCounterFocus(event) {
    if (IS_GMAIL || IS_OUTLOOK) return;
    const element = event.target;
    if (!element) return;
    const genericSel = 'textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input:not([type]), [contenteditable=""], [contenteditable="true"]';
    const isEditable = element.matches && element.matches(genericSel);
    const isInEditable = element.closest && element.closest(genericSel);
    if (!isEditable && !isInEditable) return;
    const targetElement = isEditable ? element : element.closest(genericSel);
    if (!targetElement) return;
    currentActiveElement = targetElement;
    createLiveCounter();
    const text = targetElement.value || targetElement.textContent || '';
    const errorCount = countErrorsInText(text);
    updateLiveCounterText(errorCount);
    updateLiveCounterPosition(targetElement);
  }

  function handleLiveCounterBlur(event) {
    setTimeout(() => {
      if (currentActiveElement !== document.activeElement) {
        hideLiveCounter();
        currentActiveElement = null;
      }
    }, 100);
  }

  function testLiveCounter() {
    console.log('Test du compteur live...');
    createLiveCounter();
    updateLiveCounterText(2);
    liveCounter.style.left = '100px';
    liveCounter.style.top = '100px';
    console.log('Compteur de test affiché');
  }

  function initLiveCounter() {
    console.log('Initialisation du compteur live...');
    console.log('IS_GMAIL:', IS_GMAIL, 'IS_OUTLOOK:', IS_OUTLOOK);
    
    if (IS_GMAIL || IS_OUTLOOK) {
      console.log('Compteur live ignoré pour Gmail/Outlook');
      return;
    }
    
    try {
      console.log('Ajout des event listeners pour le compteur live');
      document.addEventListener('input', handleLiveCounterInput, true);
      document.addEventListener('keyup', handleLiveCounterInput, true);
      document.addEventListener('focusin', handleLiveCounterFocus, true);
      document.addEventListener('focusout', handleLiveCounterBlur, true);
      document.addEventListener('selectionchange', () => {
        if (currentActiveElement && liveCounter) {
          updateLiveCounterPosition(currentActiveElement);
        }
      });
      window.addEventListener('scroll', () => {
        if (liveCounter && currentActiveElement) {
          updateLiveCounterPosition(currentActiveElement);
        }
      }, { passive: true });
      
      // Le compteur est maintenant fonctionnel
      
      console.log('Compteur live initialisé avec succès');
    } catch (e) {
      console.error('Erreur initialisation compteur live:', e);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
    document.addEventListener('DOMContentLoaded', initLiveCounter, { once:true });
  } else {
    init();
    initLiveCounter();
  }
})();
