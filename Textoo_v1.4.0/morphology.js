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
    { lemma:"manger", form:"mangées", pos:"PART", tags:["ingest"] },

    // Homophones et paronymes fréquents (contexte piloté par tags)
    // et / est
    { lemma:"et", form:"et", pos:"CONJ", tags:["coord"] },
    { lemma:"être", form:"est", pos:"VERB", tags:["copule"],
      confusions:[{ tags:["adj","part","etat"], suggestion:"est", message:"Peut-être « est » (verbe) plutôt que « et » (conjonction) ?" }] },

    // on / ont
    { lemma:"on", form:"on", pos:"PRON", tags:["pron"] },
    { lemma:"avoir", form:"ont", pos:"VERB", tags:["aux"],
      confusions:[{ tags:["part"], suggestion:"ont", message:"Avec un participe passé, utilisez « ont » (auxiliaire)." }] },

    // se / s'est (forme contractée traitée côté règles)
    { lemma:"se", form:"se", pos:"PRON", tags:["refl"] },

    // ou / où
    { lemma:"ou", form:"ou", pos:"CONJ", tags:["coord"] },
    { lemma:"où", form:"où", pos:"ADV", tags:["lieu","interro"],
      confusions:[{ tags:["lieu","interro"], suggestion:"où", message:"Ici on attend l’adverbe de lieu « où » (avec accent)." }] },

    // la / là
    { lemma:"la", form:"la", pos:"DET", tags:["det"] },
    { lemma:"là", form:"là", pos:"ADV", tags:["lieu"],
      confusions:[{ tags:["lieu"], suggestion:"là", message:"Adverbe de lieu attendu : « là »." }] },

    // ce / se
    { lemma:"ce", form:"ce", pos:"DET", tags:["det"] },

    // Paronymes (ajout de tags pour contexte)
    { lemma:"tâche", form:"tache", pos:"NOUN", gender:"f", number:"sg", tags:["tache-sans-accent"],
      confusions:[{ tags:["menage","travail"], suggestion:"tâche", message:"Souhaitez-vous écrire « tâche » (travail) ?" }] },
    { lemma:"tâche", form:"tâches", pos:"NOUN", gender:"f", number:"pl", tags:["travail"] },

    { lemma:"cote", form:"cote", pos:"NOUN", gender:"f", number:"sg", tags:["bourse"],
      confusions:[{ tags:["pente","relief"], suggestion:"côte", message:"Contexte relief : « côte » (accent circonflexe)." }, { tags:["opinion","avis"], suggestion:"côté", message:"Contexte point de vue : « côté »." }] },
    { lemma:"côte", form:"côte", pos:"NOUN", gender:"f", number:"sg", tags:["pente","relief"] },
    { lemma:"côté", form:"côté", pos:"NOUN", gender:"m", number:"sg", tags:["opinion","avis"] },

    { lemma:"foi", form:"foi", pos:"NOUN", gender:"f", number:"sg", tags:["religion"],
      confusions:[{ tags:["alimentation","santé"], suggestion:"foie", message:"Dans un contexte alimentaire/santé, utilisez « foie »." }] },
    { lemma:"foie", form:"foie", pos:"NOUN", gender:"m", number:"sg", tags:["alimentation","santé"] },

    { lemma:"voie", form:"voie", pos:"NOUN", gender:"f", number:"sg", tags:["route","circulation"],
      confusions:[{ tags:["audio","son","vote"], suggestion:"voix", message:"Contexte sonore ou vote : « voix »." }] },
    { lemma:"voix", form:"voix", pos:"NOUN", gender:"f", number:"sg", tags:["audio","son","vote"] },

    { lemma:"collision", form:"collision", pos:"NOUN", gender:"f", number:"sg", tags:["choc"],
      confusions:[{ tags:["entente","fraude"], suggestion:"collusion", message:"Contexte d’entente illicite : « collusion »." }] },
    { lemma:"collusion", form:"collusion", pos:"NOUN", gender:"f", number:"sg", tags:["entente","fraude"] },

    { lemma:"éruption", form:"éruption", pos:"NOUN", gender:"f", number:"sg", tags:["volcan","peau"],
      confusions:[{ tags:["entrée","forcé"], suggestion:"irruption", message:"Contexte entrée soudaine : « irruption »." }] },
    { lemma:"irruption", form:"irruption", pos:"NOUN", gender:"f", number:"sg", tags:["entrée","forcé"] }
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
