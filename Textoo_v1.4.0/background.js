
const LT_ENDPOINT = "https://api.languagetool.org/v2/check";
async function ltCheck(text, lang){
  const language = (lang && typeof lang === 'string') ? lang : 'fr';
  const ttlMs = 60_000; // 60s cache
  const timeoutMs = 5000; // 5s timeout
  // Simple hash (djb2)
  function hash(s){ let h=5381; for(let i=0;i<s.length;i++){ h=((h<<5)+h) + s.charCodeAt(i); h|=0; } return h>>>0; }
  const key = `${language}:${hash(text)}`;
  try{
    if(!globalThis.__LT_CACHE__){ globalThis.__LT_CACHE__ = new Map(); }
    const cache = globalThis.__LT_CACHE__;
    const now = Date.now();
    const ent = cache.get(key);
    if(ent && (now - ent.t) < ttlMs){ return ent.d; }

    async function fetchWithTimeout(){
      const p = new URLSearchParams();
      p.set("text", text);
      p.set("language", language);
      p.set("level","picky");
      p.set("enabledOnly","false");
      const ctrl = new AbortController();
      const id = setTimeout(()=>ctrl.abort(), timeoutMs);
      try{
        const r = await fetch(LT_ENDPOINT, { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body: p.toString(), signal: ctrl.signal });
        if(!r.ok) throw new Error(`LT error ${r.status}`);
        const d = await r.json();
        return d;
      } finally { clearTimeout(id); }
    }

    // Try once, retry once on error
    let data;
    try{ data = await fetchWithTimeout(); }
    catch(_e){ data = await fetchWithTimeout(); }
    // Maintain simple LRU cap of 100
    try{
      cache.set(key, { t: now, d: data });
      if(cache.size > 100){ const firstKey = cache.keys().next().value; cache.delete(firstKey); }
    }catch(_){ }
    return data;
  }catch(e){
    // Fallback: direct request without cache/timeout (last resort)
    const p = new URLSearchParams();
    p.set("text", text);
    p.set("language", language);
    p.set("level","picky");
    p.set("enabledOnly","false");
    const r = await fetch(LT_ENDPOINT, { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body: p.toString() });
    if(!r.ok) throw new Error(`LT error ${r.status}`);
    return r.json();
  }
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
  if (msg && msg.type==="CHECK_TEXT"){
    ltCheck(msg.text, msg.lang).then(d=>sendResponse({ok:true,data:d})).catch(e=>sendResponse({ok:false,error:e.message}));
    return true;
  }
});
