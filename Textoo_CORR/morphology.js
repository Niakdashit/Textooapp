(function(){
  const ENTRIES = [
    { lemma:"poisson", form:"poisson", pos:"NOUN", gender:"m", number:"sg", tags:["food"] },
    { lemma:"poisson", form:"poissons", pos:"NOUN", gender:"m", number:"pl", tags:["food"] },
    { lemma:"poison", form:"poison", pos:"NOUN", gender:"m", number:"sg", tags:["toxin"],
      confusions:[{ tags:["ingest"], suggestion:"poisson", message:"Ambiguite possible : « poison » ou « poisson » ?" }] },
    { lemma:"poison", form:"poisons", pos:"NOUN", gender:"m", number:"pl", tags:["toxin"],
      confusions:[{ tags:["ingest"], suggestion:"poissons", message:"Ambiguite possible : « poisons » ou « poissons » ?" }] },

    { lemma:"voiture", form:"voiture", pos:"NOUN", gender:"f", number:"sg", tags:["object"] },
    { lemma:"voiture", form:"voitures", pos:"NOUN", gender:"f", number:"pl", tags:["object"] },
    { lemma:"poulet", form:"poulet", pos:"NOUN", gender:"m", number:"sg", tags:["food"] },
    { lemma:"poulet", form:"poulets", pos:"NOUN", gender:"m", number:"pl", tags:["food"] },
    { lemma:"poule", form:"poule", pos:"NOUN", gender:"f", number:"sg", tags:["animal"] },
    { lemma:"poule", form:"poules", pos:"NOUN", gender:"f", number:"pl", tags:["animal"] },

    { lemma:"attention", form:"attention", pos:"NOUN", gender:"f", number:"sg", tags:["abstract", "paronyme:intention"] },
    { lemma:"intention", form:"intention", pos:"NOUN", gender:"f", number:"sg", tags:["abstract"] },

    { lemma:"manger", form:"manger", pos:"VERB", tags:["ingest"] },
    { lemma:"manger", form:"mange", pos:"VERB", tags:["ingest"] },
    { lemma:"manger", form:"manges", pos:"VERB", tags:["ingest"] },
    { lemma:"manger", form:"mangeons", pos:"VERB", tags:["ingest"] },
    { lemma:"manger", form:"mangez", pos:"VERB", tags:["ingest"] },
    { lemma:"manger", form:"mangent", pos:"VERB", tags:["ingest"] },
    { lemma:"manger", form:"mangeait", pos:"VERB", tags:["ingest"] },
    { lemma:"manger", form:"mangeais", pos:"VERB", tags:["ingest"] },
    { lemma:"manger", form:"mangerons", pos:"VERB", tags:["ingest"] },
    { lemma:"manger", form:"mangea", pos:"VERB", tags:["ingest"] },
    { lemma:"manger", form:"mangé", pos:"PART", tags:["ingest"] },
    { lemma:"manger", form:"mangée", pos:"PART", tags:["ingest"] },
    { lemma:"manger", form:"mangés", pos:"PART", tags:["ingest"] },
    { lemma:"manger", form:"mangées", pos:"PART", tags:["ingest"] }
  ];

  const byForm = new Map();
  ENTRIES.forEach(entry => {
    const key = entry.form.toLowerCase();
    if(!byForm.has(key)) byForm.set(key, []);
    byForm.get(key).push(entry);
  });

  const determiners = {
    "un": { gender:"m", number:"sg" },
    "une": { gender:"f", number:"sg" },
    "le": { gender:"m", number:"sg" },
    "la": { gender:"f", number:"sg" },
    "l'": { gender:null, number:"sg" },
    "les": { gender:null, number:"pl" },
    "des": { gender:null, number:"pl" },
    "du": { gender:"m", number:"sg" },
    "de la": { gender:"f", number:"sg" },
    "de l'": { gender:null, number:"sg" }
  };

  function lookup(form){
    if(!form) return [];
    return byForm.get(String(form).toLowerCase()) || [];
  }
  function getTags(form){
    const set = new Set();
    lookup(form).forEach(entry => {
      (entry.tags||[]).forEach(t=>set.add(t));
    });
    return Array.from(set);
  }
  function getBestNoun(form){
    return lookup(form).find(e => e.pos === "NOUN") || null;
  }
  function getDetInfo(det){
    if(!det) return null;
    const key = det.trim().toLowerCase();
    return determiners[key] || null;
  }
  function getContextConfusion(form, contextTags){
    const tags = new Set(contextTags||[]);
    for(const entry of lookup(form)){
      const confs = entry.confusions || [];
      for(const conf of confs){
        if(!conf.tags || conf.tags.some(t => tags.has(t))){
          return { entry, suggestion: conf.suggestion, message: conf.message };
        }
      }
    }
    return null;
  }

  window.TextooMorphology = {
    lookup,
    getTags,
    getBestNoun,
    getDetInfo,
    getContextConfusion
  };
})();
