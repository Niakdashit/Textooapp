(function(){
  const input = document.getElementById('endpoint');
  const msg   = document.getElementById('msg');
  const save  = document.getElementById('save');
  const KEY   = 'endpoint';

  const looksValid = (u) => /^https?:\/\//i.test((u || '').trim());
  const setMsg = (t) => { msg.textContent = t; if (t) setTimeout(()=> msg.textContent = '', 1800); };

  function loadExisting(){
    const fallback = () => {
      try {
        const stored = localStorage.getItem('HMW_WORKER_URL');
        if (stored) input.value = stored;
      } catch (e) {}
    };

    try {
      chrome.storage?.sync?.get?.([KEY], (res)=>{
        if (res && res[KEY]) { input.value = res[KEY]; return; }
        chrome.storage?.local?.get?.([KEY], (loc)=>{
          if (loc && loc[KEY]) { input.value = loc[KEY]; return; }
          fallback();
        });
      });
    } catch (e) {
      fallback();
    }
  }

  function persist(val){
    try {
      chrome.storage?.sync?.set?.({ [KEY]: val }, ()=>{
        try { chrome.storage?.local?.set?.({ [KEY]: val }); } catch (_) {}
        try { localStorage.setItem('HMW_WORKER_URL', val); } catch (_) {}
        setMsg('Sauvegardé ✓');
      });
    } catch (e) {
      try {
        localStorage.setItem('HMW_WORKER_URL', val);
        setMsg('Sauvegardé (local) ✓');
      } catch (err) {
        console.error('Textoo options save failed', err);
        setMsg('Erreur de sauvegarde');
      }
    }
  }

  save.addEventListener('click', ()=>{
    const val = (input.value || '').trim();
    if (!looksValid(val)) { setMsg('URL invalide'); return; }
    persist(val);
  });

  loadExisting();
})();
