
(function(){
  const QUICK_INTERVAL = 45;
  const FULL_DEBOUNCE  = 150;

  function debounce(fn, delay){ let t; return function(...args){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args), delay); } }
  function throttle(fn, delay){ let last=0, pending=null; return function(...args){ const now=Date.now(); const run=()=>{ last=now; pending=null; fn.apply(this,args); }; if(now-last>=delay){ run(); } else { pending&&clearTimeout(pending); pending=setTimeout(run, delay-(now-last)); } } }
  function esc(s){ return s.replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  const FR_WORDS = new Set(["le","la","les","des","un","une","et","ou","de","du","que","qui","pas","ne","je","tu","il","elle","on","nous","vous","ils","elles","est","sont","à","au","aux","dans","pour","avec","ce","cet","cette","ces"]);
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
      this.el.addEventListener("scroll", ()=>this.syncOverlayScroll(), {passive:true});
      const reposition=()=>this.positionOverlay(); window.addEventListener("scroll", reposition, true); window.addEventListener("resize", reposition, true);
      this.overlay.addEventListener("click",(e)=>{
        const marker=e.target.closest(".textoo-marker, .textoo-highlight"); if(!marker) return;
        const idx=Number(marker.getAttribute("data-idx")); const m=this.results[idx]; if(!m) return;
        const r=marker.getBoundingClientRect(); const apply=(val)=>this.applyReplacement(m.offset,m.length,val,m.rule?.id); const ignore=(persist=true)=>{ if(persist!==false) this.ignoredOffsets.add(m.offset); this.render(); };
        showPopover(r.left, r.bottom+6, m, apply, ignore);
      });

      // Click directly on the underlying word (contenteditable) to open the popover
      if (this.el.isContentEditable){
        this.el.addEventListener("click", (ev)=>{
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
              const ignore=(persist=true)=>{ if(persist!==false) this.ignoredOffsets.add(m.offset); this.render(); };
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
    positionOverlay(){ const r=this.el.getBoundingClientRect(); const s=window.getComputedStyle(this.el);
      Object.assign(this.overlay.style,{left:(r.left+window.scrollX)+"px",top:(r.top+window.scrollY)+"px",width:r.width+"px",height:r.height+"px",padding:s.padding,font:s.font,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing,whiteSpace:"pre-wrap",direction:s.direction});
      Object.assign(this.badge.style,{left:(r.left+window.scrollX)+r.width-8+"px",top:(r.top+window.scrollY)-8+"px"}); }
    syncOverlayScroll(){ this.overlay.scrollTop=this.el.scrollTop; this.overlay.scrollLeft=this.el.scrollLeft; }
    setBadge(n){
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

    quickScan(){ if(!this.isEnabled) return; const text=this.getLinearized(); if(text===this.lastQuickText) return; this.lastQuickText=text; let off={matches:[]}; try{ off=window.TextooOfflineChecker.check(text); }catch(e){ off={matches:[]}; } const matches=this.normalize(off.matches);
      if(matches.length===0 && this.results.length>0){ /* keep current to avoid flicker */ } else if(this.hasDiff(this.results,matches)){ this.results=matches; this.render(); } }

    async fullScan(){ if(!this.isEnabled) return; const text=this.getLinearized(); if(!text||text.trim().length===0){ this.results=[]; this.render(); return; } if(text===this.lastText) return; this.lastText=text; const rid=++this.scanRID;
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
          const klass="textoo-highlight"+(m.type==="style"?" style":(m.type==="typography"?" typography":""));
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
        div.style.borderBottom = "2px solid " + (type==="style"?"#1e88e5":(type==="typography"?"#6a1b9a":"#e53935"));
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

  function isEditable(el){ if(!el || el.hidden) return false; if(el.closest && el.closest(".textoo-overlay")) return false; const tn=el.nodeName; if(tn==="TEXTAREA") return true; if(tn==="INPUT"){ const t=(el.getAttribute("type")||"text").toLowerCase(); if(["text","search","email","url","tel",""].includes(t)) return true; return false; } if(el.isContentEditable) return true; return false; }
  function isTopEditable(el){ if(!isEditable(el)) return false; const a=el.closest('textarea, input[type="text"], input:not([type]), [contenteditable=""], [contenteditable="true"]'); return a===el; }

  const watched=new WeakMap();
  function attach(el){ if(watched.has(el)) return; watched.set(el,new FieldWatcher(el)); }
  function scanForFields(root=document){ const c=root.querySelectorAll("textarea, input[type='text'], input:not([type]), [contenteditable=''], [contenteditable='true']"); c.forEach(el=>{ if(isTopEditable(el)) attach(el); }); }
  scanForFields();
  const mo=new MutationObserver((muts)=>{ for(const m of muts){ if(m.addedNodes) m.addedNodes.forEach(n=>{ if(n.nodeType===1){ if(isTopEditable(n)) attach(n); const els=n.querySelectorAll ? n.querySelectorAll("textarea, input[type='text'], input:not([type]), [contenteditable=''], [contenteditable='true']") : []; els.forEach(e=>{ if(isTopEditable(e)) attach(e); }); } }); } }); mo.observe(document.documentElement,{childList:true,subtree:true});
})();
