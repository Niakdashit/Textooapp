(function(){
  const input = document.getElementById('endpoint');
  const msg   = document.getElementById('msg');
  const save  = document.getElementById('save');
  const chk   = document.getElementById('disableThinSpace');
  const forceLangSel = document.getElementById('forceLang');
  const multiSentChk = document.getElementById('multiBySentence');
  const maxMarkersInp= document.getElementById('maxMarkers');
  const longSentInp  = document.getElementById('longSentence');
  const debugChk     = document.getElementById('debugLogs');
  const KEY_ENDPOINT = 'endpoint';
  const KEY_DISABLE  = 'disableThinSpace';
  const KEY_FORCELANG= 'forceLang';
  const KEY_MULTI    = 'multiBySentence';
  const KEY_MAXMK    = 'maxMarkers';
  const KEY_LONGS    = 'longSentence';
  const KEY_DEBUG    = 'debugLogs';

  const looksValid = (u) => /^https?:\/\//i.test((u || '').trim());
  const setMsg = (t) => { msg.textContent = t; if (t) setTimeout(()=> msg.textContent = '', 1800); };

  function loadExisting(){
    const fallback = () => {
      try {
        const stored = localStorage.getItem('HMW_WORKER_URL');
        if (stored) input.value = stored;
      } catch (e) {}
      try {
        const ds = localStorage.getItem('Textoo_DisableThinSpace');
        if (ds != null) chk.checked = ds === '1';
      } catch (e) {}
      // defaults
      forceLangSel.value = 'auto';
      multiSentChk.checked = true;
      maxMarkersInp.value = '800';
      longSentInp.value = '33';
      debugChk.checked = false;
    };

    try {
      chrome.storage?.sync?.get?.([KEY_ENDPOINT, KEY_DISABLE, KEY_FORCELANG, KEY_MULTI, KEY_MAXMK, KEY_LONGS, KEY_DEBUG], (res)=>{
        if (res){
          if (res[KEY_ENDPOINT]) input.value = res[KEY_ENDPOINT];
          if (typeof res[KEY_DISABLE] === 'boolean') chk.checked = !!res[KEY_DISABLE];
          if (typeof res[KEY_FORCELANG] === 'string') forceLangSel.value = res[KEY_FORCELANG] || 'auto';
          if (typeof res[KEY_MULTI] === 'boolean') multiSentChk.checked = !!res[KEY_MULTI];
          if (typeof res[KEY_MAXMK] === 'number') maxMarkersInp.value = String(res[KEY_MAXMK]);
          if (typeof res[KEY_LONGS] === 'number') longSentInp.value = String(res[KEY_LONGS]);
          if (typeof res[KEY_DEBUG] === 'boolean') debugChk.checked = !!res[KEY_DEBUG];
        }
        chrome.storage?.local?.get?.([KEY_ENDPOINT, KEY_DISABLE, KEY_FORCELANG, KEY_MULTI, KEY_MAXMK, KEY_LONGS, KEY_DEBUG], (loc)=>{
          if (loc){
            if (!input.value && loc[KEY_ENDPOINT]) input.value = loc[KEY_ENDPOINT];
            if (typeof loc[KEY_DISABLE] === 'boolean') chk.checked = !!loc[KEY_DISABLE];
            if (!forceLangSel.value && typeof loc[KEY_FORCELANG] === 'string') forceLangSel.value = loc[KEY_FORCELANG] || 'auto';
            if (typeof loc[KEY_MULTI] === 'boolean') multiSentChk.checked = !!loc[KEY_MULTI];
            if (!maxMarkersInp.value && typeof loc[KEY_MAXMK] === 'number') maxMarkersInp.value = String(loc[KEY_MAXMK]);
            if (!longSentInp.value && typeof loc[KEY_LONGS] === 'number') longSentInp.value = String(loc[KEY_LONGS]);
            if (typeof loc[KEY_DEBUG] === 'boolean') debugChk.checked = !!loc[KEY_DEBUG];
          }
          if (!input.value) fallback();
        });
      });
    } catch (e) {
      fallback();
    }
  }

  function persist(endpointVal, disableVal){
    const payload = {
      [KEY_ENDPOINT]: endpointVal,
      [KEY_DISABLE]: !!disableVal,
      [KEY_FORCELANG]: forceLangSel.value || 'auto',
      [KEY_MULTI]: !!multiSentChk.checked,
      [KEY_MAXMK]: Math.max(200, Math.min(5000, parseInt(maxMarkersInp.value||'800',10) || 800)),
      [KEY_LONGS]: Math.max(20, Math.min(60, parseInt(longSentInp.value||'33',10) || 33)),
      [KEY_DEBUG]: !!debugChk.checked
    };
    try {
      chrome.storage?.sync?.set?.(payload, ()=>{
        try { chrome.storage?.local?.set?.(payload); } catch (_) {}
        try { localStorage.setItem('HMW_WORKER_URL', endpointVal); } catch (_) {}
        try { localStorage.setItem('Textoo_DisableThinSpace', disableVal ? '1' : '0'); } catch (_) {}
        setMsg('Sauvegardé ✓');
      });
    } catch (e) {
      try {
        localStorage.setItem('HMW_WORKER_URL', endpointVal);
        localStorage.setItem('Textoo_DisableThinSpace', disableVal ? '1' : '0');
        setMsg('Sauvegardé (local) ✓');
      } catch (err) {
        console.error('Textoo options save failed', err);
        setMsg('Erreur de sauvegarde');
      }
    }
  }

  save.addEventListener('click', ()=>{
    const val = (input.value || '').trim();
    const disable = !!chk.checked;
    if (val && !looksValid(val)) { setMsg('URL invalide'); return; }
    persist(val, disable);
  });

  loadExisting();
})();
