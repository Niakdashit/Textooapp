
(function(){
  const QUICK_INTERVAL = 45;
  const FULL_DEBOUNCE  = 150;

  function debounce(fn, delay){ let t; return function(...args){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args), delay); } }
  function throttle(fn, delay){ let last=0, pending=null; return function(...args){ const now=Date.now(); const run=()=>{ last=now; pending=null; fn.apply(this,args); }; if(now-last>=delay){ run(); } else { pending&&clearTimeout(pending); pending=setTimeout(run, delay-(now-last)); } } }
  function esc(s){ return s.replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  const FR_WORDS = new Set(["le","la","les","des","un","une","et","ou","de","du","que","qui","pas","ne","je","tu","il","elle","on","nous","vous","ils","elles","est","sont","à","au","aux","dans","pour","avec","ce","cet","cette","ces"]);
  const IS_GMAIL = typeof location !== 'undefined' && /mail\.google\.com$/.test(location.hostname);
  function isProbablyFrench(text){ const words=text.toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿœ'-]+/i).filter(Boolean); if(words.length<3) return true; let hits=0; for(const w of words) if(FR_WORDS.has(w)) hits++; return (hits/words.length)>=0.12; }

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
    popover.innerHTML = `<div class="textoo-popover-header">${esc(title)}</div><div>${esc(message||"Amélioration proposée")}</div>${suggs.length?`<div style="margin-top:6px;">${suggs.map(s=>`<span class="textoo-suggest" data-v="${esc(s.value)}">${esc(s.value)}</span>`).join("")}</div>`:""}<div class="textoo-actions"><button class="textoo-btn" data-act="ignore">Ignorer</button><button class="textoo-btn" data-act="recheck">Vérifier à nouveau</button></div>`;
    popover.style.left=Math.max(8,Math.min(window.innerWidth-360,x))+"px"; popover.style.top=Math.max(8,y)+"px"; popover.style.display="block";
    popover.querySelectorAll(".textoo-suggest").forEach(el=>el.addEventListener("click",()=>{ applyCb(el.getAttribute("data-v")); hidePopover(); }));
    popover.querySelector('[data-act="ignore"]').addEventListener("click",()=>{ ignoreCb(); hidePopover(); });
    popover.querySelector('[data-act="recheck"]').addEventListener("click",()=>{ ignoreCb(false); hidePopover(); });
  }

  class FieldWatcher {
    constructor(el){
      this.el=el; this.overlay=document.createElement("div"); this.overlay.className="textoo-overlay";
      this.badge=document.createElement("div"); this.badge.className="textoo-badge"; this.badge.textContent="0";
      this.isEnabled=true;
      this.badge.setAttribute("role","button"); this.badge.setAttribute("aria-pressed","true"); this.badge.tabIndex=0;
      this.badge.title="Cliquer pour désactiver Textoo";
      this.badge.addEventListener("click",(ev)=>{ ev.preventDefault(); ev.stopPropagation(); this.toggleEnabled(); });
      this.badge.addEventListener("keydown",(ev)=>{ if(ev.key===" "||ev.key==="Enter"){ ev.preventDefault(); this.toggleEnabled(); } });
      document.documentElement.appendChild(this.overlay); document.documentElement.appendChild(this.badge);
      this.results=[]; this.ignoredOffsets=new Set(); this.indexer={text:"",segments:[]}; this.isProgrammatic=false;
      this.scanRID=0; this.lastQuickText=""; this.lastText="";
      this.quickScanThrottled = throttle(()=>this.quickScan(), QUICK_INTERVAL);
      this.fullScanDebounced  = debounce(()=>this.fullScan(), FULL_DEBOUNCE);
      this.destroyed=false;
      this.repositionHandler=null;
      this.boundSyncScroll=null;
      this.handleEvents(); this.positionOverlay(); this.syncOverlayScroll(); this.quickScan(); this.fullScan();
    }
    handleEvents(){
      try{ this.el.spellcheck=false; }catch(e){}
      this.el.addEventListener("input", ()=>{
        if (!this.isProgrammatic) this.optimisticClearNearCaret();
        this.quickScanThrottled();
        this.fullScanDebounced();
      }, {passive:true});
      ["keyup","change","paste","cut"].forEach(e=>this.el.addEventListener(e, ()=>{ this.quickScanThrottled(); this.fullScanDebounced(); }, {passive:true}));
      this.boundSyncScroll = ()=>this.syncOverlayScroll();
      this.el.addEventListener("scroll", this.boundSyncScroll, {passive:true});
      this.repositionHandler = ()=>this.positionOverlay();
      window.addEventListener("scroll", this.repositionHandler, true);
      window.addEventListener("resize", this.repositionHandler, true);
      this.overlay.addEventListener("click",(e)=>{
        if(!this.isEnabled) return;
        const marker=e.target.closest(".textoo-marker, .textoo-highlight"); if(!marker) return;
        const idx=Number(marker.getAttribute("data-idx")); const m=this.results[idx]; if(!m) return;
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
    toggleEnabled(){ this.setEnabled(!this.isEnabled); }
    setEnabled(state){
      if(this.isEnabled===state) return;
      this.isEnabled=state;
      this.badge.setAttribute("aria-pressed", state?"true":"false");
      this.badge.title = state ? "Cliquer pour désactiver Textoo" : "Textoo désactivé – cliquer pour réactiver";
      if(!state) hidePopover();
      this.render();
      if(state){ this.quickScan(); this.fullScanDebounced(); }
    }
    destroy(){
      if(this.destroyed) return;
      this.destroyed=true;
      try{ if(this.boundSyncScroll) this.el.removeEventListener('scroll', this.boundSyncScroll); }catch(_){ }
      try{ if(this.repositionHandler){ window.removeEventListener('scroll', this.repositionHandler, true); window.removeEventListener('resize', this.repositionHandler, true); } }catch(_){ }
      if(this.overlay && this.overlay.parentNode) this.overlay.parentNode.removeChild(this.overlay);
      if(this.badge && this.badge.parentNode) this.badge.parentNode.removeChild(this.badge);
      hidePopover();
      this.boundSyncScroll=null;
      this.repositionHandler=null;
      this.overlay=null;
      this.badge=null;
      this.el=null;
    }
    positionOverlay(){
      if(this.destroyed || !this.overlay || !this.badge) return;
      if(!this.el || !this.el.isConnected){ this.destroy(); return; }
      const r=this.el.getBoundingClientRect();
      if(!r || (r.width===0 && r.height===0)){
        this.overlay.style.visibility='hidden';
        if(this.badge) this.badge.style.visibility='hidden';
        return;
      }
      this.overlay.style.visibility='visible';
      if(this.badge){ this.badge.style.visibility = (this.badge.style.display === 'none') ? 'hidden' : 'visible'; }
      const s=window.getComputedStyle(this.el);
      Object.assign(this.overlay.style,{left:(r.left+window.scrollX)+"px",top:(r.top+window.scrollY)+"px",width:r.width+"px",height:r.height+"px",padding:s.padding,font:s.font,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing,whiteSpace:"pre-wrap",direction:s.direction});
      Object.assign(this.badge.style,{left:(r.left+window.scrollX)+r.width-8+"px",top:(r.top+window.scrollY)-8+"px"}); }
    syncOverlayScroll(){ if(this.destroyed || !this.overlay) return; this.overlay.scrollTop=this.el.scrollTop; this.overlay.scrollLeft=this.el.scrollLeft; }
    setBadge(n){ if(!this.badge) return;
      this.badge.textContent=String(n);
      this.badge.classList.toggle("textoo-badge-disabled", !this.isEnabled);
      if(this.isEnabled){
        this.badge.style.display = n>0 ? "flex" : "none";
        this.badge.setAttribute("aria-label", n===1?"1 faute détectée":`${n} fautes détectées`);
      }
      else {
        this.badge.style.display="flex";
        const suffix = n===1?"1 faute détectée":`${n} fautes détectées`;
        this.badge.setAttribute("aria-label", n>0?`Textoo désactivé – ${suffix}`:"Textoo désactivé");
      }
      this.badge.style.visibility = (this.badge.style.display === 'none') ? 'hidden' : 'visible';
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
    normalize(matches){ if(!matches) return []; const arr=matches.map(m=>({offset:m.offset,length:m.length,message:m.message||m.shortMessage||"",replacements:(m.replacements||[]).slice(0,6),rule:m.rule||{id:"GENERIC",description:m.shortMessage||"Suggestion"},type:m.type||m.rule?.issueType||"grammar"})); arr.sort((a,b)=>a.offset-b.offset||b.length-a.length); return arr.filter(m=>!this.ignoredOffsets.has(m.offset)); }
    hasDiff(a,b){ if(a.length!==b.length) return true; for(let i=0;i<a.length;i++){ const x=a[i], y=b[i]; if(x.offset!==y.offset||x.length!==y.length||x.message!==y.message) return true; } return false; }

    quickScan(){
      if(this.destroyed || !this.overlay) return;
      if(!this.isEnabled) return;
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
        return;
      }
      if(this.hasDiff(this.results,matches)){ this.results=matches; this.render(); }
    }

    async fullScan(){ if(this.destroyed || !this.overlay) return; if(!this.isEnabled) return; const text=this.getLinearized(); if(!text||text.trim().length===0){ this.results=[]; this.render(); return; } if(text===this.lastText) return; this.lastText=text; const rid=++this.scanRID;
      // offline merge
      let off={matches:[]}; try{ off=window.TextooOfflineChecker.check(text); }catch(e){ off={matches:[]}; } const offlineMapped=this.normalize(off.matches);
      if(offlineMapped.length===0 && this.results.length>0){ /* keep */ } else { const merged=[...this.results]; offlineMapped.forEach(m=>{ if(!merged.some(u=>Math.max(u.offset,m.offset)<Math.min(u.offset+u.length,m.offset+m.length))) merged.push(m); }); merged.sort((a,b)=>a.offset-b.offset||b.length-a.length); if(this.hasDiff(this.results,merged)){ this.results=merged; this.render(); } }
      if(!isProbablyFrench(text)) return;
      const resp = await new Promise(res=>{ try{ chrome.runtime.sendMessage({type:"CHECK_TEXT", text}, r=>res(r)); }catch(e){ res({ok:false,error:String(e)}); } });
      if(rid!==this.scanRID) return;
      if(resp && resp.ok && resp.data){ const mapped=this.normalize(resp.data.matches||[]); // if API returns 0, keep until next
        if(mapped.length===0 && this.results.length>0){ /* keep */ } else if(this.hasDiff(this.results,mapped)){ this.results=mapped; this.render(); } }
    }

    applyReplacement(offset, length, replacement){
      if(this.destroyed || !this.overlay) return;
      const oldEnd = offset + length;
      this.results = this.results.filter(m => (m.offset + m.length <= offset) || (m.offset >= oldEnd));
      const delta = String(replacement).length - length;
      this.rebaseMatches(oldEnd, delta);
      // render immediately (keep others visible)
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
      // quick rescan
      this.quickScan();
      this.fullScanDebounced();
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
        let out=[], i=0; const matches=[...this.results].sort((a,b)=>a.offset-b.offset);
        for(let k=0;k<matches.length;k++){
          const m=matches[k]; const start=m.offset, end=m.offset+m.length; if(start<i) continue;
          out.push(esc(text.slice(i,start)));
          const klass="textoo-highlight"+(m.type==="style"?" style":(m.type==="typography"?" typography":(m.type==="ambiguity"?" ambiguity":"")));
          out.push(`<span class="${klass}" data-idx="${k}">${esc(text.slice(start,end))}</span>`);
          i=end;
        }
        out.push(esc(text.slice(i)));
        const html=out.join("");
        if(this.overlay.innerHTML!==html) this.overlay.innerHTML=html;
        this.syncOverlayScroll(); this.positionOverlay();
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
        const div=document.createElement("div");
        div.className="textoo-marker"; div.dataset.idx=String(idx);
        div.style.position="absolute";
        div.style.left=(x - r.left)+"px";
        div.style.top=(y - r.top + 2)+"px";
        div.style.width=w+"px";
        div.style.height="0px";
        let color = "#e53935";
        if(type==="style") color = "#1e88e5";
        else if(type==="typography") color = "#6a1b9a";
        else if(type==="ambiguity") color = "#fb8c00";
        div.style.borderBottom = "2px solid " + color;
        div.style.pointerEvents="auto";
        frag.appendChild(div);
      };
      for(let k=0;k<matches.length;k++){
        const m=matches[k];
        const idx = this.indexer;
        const startPos = posFromIndex(this.el, m.offset, idx);
        const endPos   = posFromIndex(this.el, m.offset+m.length, idx);
        const rg = document.createRange();
        try{ rg.setStart(startPos.node, startPos.offset); rg.setEnd(endPos.node, endPos.offset); }catch(e){ continue; }
        const rects = rg.getClientRects();
        for(const rect of rects){ addMarker(rect.left+scrollX, rect.bottom+scrollY-2, rect.width, m.type, k); }
      }
      this.overlay.replaceChildren(frag);
    }
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
      const t=(el.getAttribute("type")||"text").toLowerCase();
      if(["text","search","email","url","tel",""].includes(t)) return true;
      return false;
    }
    if(el.isContentEditable) return true;
    return false;
  }
  function isTopEditable(el){ if(!isEditable(el)) return false; const a=el.closest('textarea, input[type="text"], input:not([type]), [contenteditable=""], [contenteditable="true"]'); return a===el; }

  const watched=new WeakMap();
  function detach(el){
    const inst = watched.get(el);
    if(inst){
      inst.destroy();
      watched.delete(el);
    }
  }
  function attach(el){ if(!el || watched.has(el) || !el.isConnected) return; watched.set(el,new FieldWatcher(el)); }
  function scanForFields(root=document){ const c=root.querySelectorAll("textarea, input[type='text'], input:not([type]), [contenteditable=''], [contenteditable='true']"); c.forEach(el=>{ if(isTopEditable(el)) attach(el); }); }
  scanForFields();
  const mo=new MutationObserver((muts)=>{
    for(const m of muts){
      if(m.addedNodes) m.addedNodes.forEach(n=>{
        if(n.nodeType===1){
          if(isTopEditable(n)) attach(n);
          const els=n.querySelectorAll ? n.querySelectorAll("textarea, input[type='text'], input:not([type]), [contenteditable=''], [contenteditable='true']") : [];
          els.forEach(e=>{ if(isTopEditable(e)) attach(e); });
        }
      });
      if(m.removedNodes) m.removedNodes.forEach(n=>{
        if(n.nodeType===1){
          if(watched.has(n)) detach(n);
          const els=n.querySelectorAll ? n.querySelectorAll("textarea, input[type='text'], input:not([type]), [contenteditable=''], [contenteditable='true']") : [];
          els.forEach(e=>{ detach(e); });
        }
      });
    }
  });
  mo.observe(document.documentElement,{childList:true,subtree:true});
})();

(function(){
  if (!window.location || !/mail\.google\.com$/.test(window.location.hostname)) return;

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

  const $  = (sel, root=document)=>root.querySelector(sel);
  const $$ = (sel, root=document)=>Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn)=>el && el.addEventListener(ev, fn);

  function findComposerBox(){
    return $('div[aria-label="Corps du message"], div[aria-label="Message body"]');
  }
  function getLastMessageText(){
    const blocks = $$('div.a3s, div[role="listitem"] .a3s');
    for(let i = blocks.length - 1; i >= 0; i--){
      const txt = blocks[i].innerText || '';
      if(txt && txt.trim().length > 40) return txt.trim();
    }
    return '';
  }
  function insertInComposer(text){
    const box = findComposerBox();
    if(!box){ log('Composer introuvable'); return; }
    box.focus();
    try {
      document.execCommand('insertText', false, text);
    } catch(_){
      try {
        const rng = document.createRange();
        rng.selectNodeContents(box);
        rng.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(rng);
        document.execCommand('insertText', false, text);
      } catch(err){ log('Insert fallback failed', err); }
    }
  }

  const CSS = `
  :root{
    --hmw-bg:#faf9fc;--hmw-fg:#3f23c2;--hmw-border:#A94BF7;--hmw-muted:#b8aaf2;--hmw-danger:#ff6b6b;
  }
  #hmw-fab{
    position:fixed;right:18px;bottom:18px;z-index:2147483000;
    width:44px;height:44px;border-radius:50%;
    border:none;background:#6c3ef0;color:#fff;box-shadow:0 6px 18px rgba(108,62,240,.35);
    font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;
  }
  #hmw-menu{
    position:fixed;right:18px;bottom:72px;z-index:2147483000;display:none;
    background:#fff;border:1px solid #ede9ff;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.12);
    padding:6px;min-width:140px;
  }
  #hmw-menu button{
    display:block;width:100%;padding:8px 10px;border:none;background:transparent;
    color:#3f23c2;font-size:14px;cursor:pointer;border-radius:8px;text-align:left;
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
  #hmw-box .hmw-title{font-style:italic;color:var(--hmw-muted);font-size:14px;flex:1;}
  #hmw-box .hmw-area{position:relative;margin:8px 12px 6px 12px;border-radius:8px;background:#FAF9FC;}
  #hmw-box textarea{
    width:100%;height:54px;min-height:42px;max-height:180px;padding:12px 44px 12px 18px;
    border:0;outline:0;resize:vertical;background:transparent;color:#301994;font-size:14px;line-height:1.35;
  }
  #hmw-copy{
    position:absolute;right:10px;top:10px;font-size:16px;color:var(--hmw-fg);opacity:.85;cursor:pointer;user-select:none;
  }
  #hmw-box .hmw-chip{
    display:none;padding:8px 44px 6px 14px;color:#7c74c9;background:#f6f3ff;border-bottom:1px solid var(--hmw-border);
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;
  }
  #hmw-result{display:none;padding:12px 14px;color:#261a86;font-size:14px;line-height:1.35;max-height:220px;overflow:auto;white-space:pre-wrap;}
  #hmw-actions{
    display:flex;align-items:center;gap:18px;justify-content:center;border-top:1px solid #F3F0FF;padding:10px 12px;background:#FFFFFF;
  }
  #hmw-actions .hmw-link{appearance:none;border:0;background:transparent;color:var(--hmw-fg);font-weight:400;font-size:14px;line-height:1;padding:6px 0;cursor:pointer;}
  #hmw-actions .hmw-sep{width:1px;height:16px;background:#cbbefc;}
  #hmw-close{
    position:absolute;right:8px;bottom:8px;width:22px;height:22px;border-radius:50%;background:var(--hmw-danger);
    color:#fff;font-weight:700;border:0;line-height:22px;text-align:center;font-size:14px;cursor:pointer;
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
  function ensureFab(){
    if(fab) return;
    fab = document.createElement('button');
    fab.id = 'hmw-fab';
    fab.title = 'Textoo Assist';
    fab.textContent = '✨';
    document.body.appendChild(fab);

    menu = document.createElement('div');
    menu.id = 'hmw-menu';
    menu.innerHTML = `
      <button data-act="reply">Répondre</button>
      <button data-act="analyze">Analyser</button>
    `;
    document.body.appendChild(menu);

    on(fab,'click',()=>{ menu.style.display = (menu.style.display === 'block') ? 'none' : 'block'; });
    on(document,'click',(e)=>{ if(menu && !menu.contains(e.target) && e.target !== fab) menu.style.display = 'none'; });
    on(menu,'click',(e)=>{
      const b = e.target.closest('button');
      if(!b) return;
      openPanel(b.dataset.act === 'analyze' ? 'analyze' : 'reply');
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
        <textarea id="hmw-ctx" placeholder="Contexte… (laisse vide ou écris “répond” pour une réponse automatique)"></textarea>
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

  function openPanel(mode){
    currentMode = mode === 'analyze' ? 'analyze' : 'reply';
    buildPanel();
    titleEl.textContent = currentMode === 'analyze' ? 'Analyse rapide' : 'Rédaction';
    ctxInput.placeholder = currentMode === 'analyze'
      ? "Contexte… (facultatif, l'email actuel sera analysé)"
      : "Contexte… (laisse vide ou écris “répond” pour une réponse automatique)";
    panel.classList.remove('has-result');
    panel.dataset.mode = currentMode;
    panel.dataset.source = '';
    ctxInput.value='';
    chip.textContent='';
    resultEl.textContent='';
    positionPanel();
    panel.style.display='block';
    ctxInput.focus();
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
    if(!ENDPOINT){ showResult("⚠️ Configure l’endpoint dans les options."); return; }
    let payload = {};
    let sourceContext = '';
    if(currentMode === 'analyze'){
      const ctx = getLastMessageText() || ctxInput.value.trim();
      payload = { mode:'explain', context: ctx };
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
    chip.textContent = ctx && ctx.length ? ctx : (currentMode === 'analyze' ? 'Analyse du message affiché' : 'Réponse automatique');
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
      const cls = it.severity === 'warning' ? 'hmw-warn' : 'hmw-err';
      wrapRange(nodes, it.start, it.end, cls, it.message || '');
    }
  }
  async function runLint(composerEl){
    try {
      clearHighlights(composerEl);
      const { text, nodes } = extractTextAndMap(composerEl);
      if(!text.trim()) return;
      if(!ENDPOINT){ console.warn('[Textoo·Assist] Endpoint manquant pour lint'); return; }
      const res = await fetch(ENDPOINT, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ mode:'lint', text })
      });
      if(!res.ok) return;
      const data = await res.json().catch(()=>({}));
      const issues = Array.isArray(data.issues) ? data.issues : [];
      applyHighlights(composerEl, issues, nodes);
    } catch(err){
      console.error('[Textoo·Assist] runLint failed', err);
    }
  }

  let booted = false;
  function init(){
    if(booted) return; booted = true;
    ensureFab();
    buildPanel();
    const obs = new MutationObserver(()=>{
      ensureFab();
      if(panel && panel.style.display === 'block') positionPanel();
    });
    obs.observe(document.body, { childList:true, subtree:true });
    log('assist ready');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();
