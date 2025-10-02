
(function(){
  const WSP = "[ \t\u00A0\u202F]";
  const WORD = "[a-zàâçéèêëîïôûùüÿœ]+";
  const SUBJECTS = "(?:je|tu|il|elle|on|nous|vous|ils|elles|la\\spolice|les\\spoliciers|le\\s"+WORD+"|la\\s"+WORD+"|l['’]"+WORD+"|[A-ZÉÈÀÇ][\\w-]+)";

  const Morph = window.TextooMorphology || {
    lookup: ()=>[],
    getTags: ()=>[],
    getBestNoun: ()=>null,
    getDetInfo: ()=>null,
    getContextConfusion: ()=>null
  };

  function byParagraphs(text, fn){
    const rx = /[^\n]+/g; let m, out=[];
    while((m = rx.exec(text)) !== null){
      const start = m.index; const seg = m[0];
      const add = fn(seg, start) || [];
      if (Array.isArray(add)) out = out.concat(add);
    } return out;
  }

  const RULES = [
    { id:"OFF_AUX_A_ACCENT", description:"« à » vs « a » + participe passé",
      test:(t)=>{
        const rx = new RegExp("\\\\b(?:"+SUBJECTS+")"+WSP+"+(à"+WSP+"+("+WORD+"))er\\\\b","gi");
        let m, out=[];
        while((m = rx.exec(t)) !== null){
          const inner = m[1], base = m[2];
          const start = m.index + m[0].indexOf(inner);
          const len = inner.length + 2;
          out.push({ offset:start, length:len, message:"Remplacez \u00AB \u00E0 "+base+"er \u00BB par \u00AB a "+base+"\u00E9 \u00BB.", replacements:[{value:"a "+base+"\u00E9"}], rule:{id:"OFF_AUX_A_ACCENT", description:"\u00AB \u00E0 \u00BB \u2192 \u00AB a \u00BB + participe"} });
        } return out;
      }},
    { id:"OFF_DE_PLUS_PP", description:"Infinitif après préposition",
      test:(t)=>{
        const rx = new RegExp("\\\\b(de|à|pour|sans)("+WSP+"+)"+"("+WORD+")é(e?s?)?\\\\b","gi");
        let m, out=[];
        while((m = rx.exec(t)) !== null){
          const prep = m[1], spaces = m[2], base = m[3];
          const start = m.index + prep.length + spaces.length;
          const len = m[0].length - (prep.length + spaces.length);
          out.push({ offset:start, length:len, message:"Utilisez l’infinitif après \u00AB "+prep+" \u00BB.", replacements:[{value: base + "er"}], rule:{id:"OFF_DE_PLUS_PP", description:"Infinitif après préposition"} });
        } return out;
      }},
    { id:"OFF_AVOIR_PP", description:"Avoir + participe passé",
      test:(t)=>{
        const rx = /\b(j['’]ai|tu\s+as|il\s+a|elle\s+a|on\s+a|nous\s+avons|vous\s+avez|ils\s+ont|elles\s+ont)\s+([a-zàâçéèêëîïôûùüÿœ]+)er\b/gi;
        let m, out=[];
        while((m = rx.exec(t)) !== null){
          const aux = m[1]; const base = m[2];
          const start = m.index + aux.length + 1;
          out.push({ offset:start, length:(base+"er").length, message:"Avec \u00AB "+aux+" \u00BB, utilisez le participe passé.", replacements:[{value: base+"\u00E9"}], rule:{id:"OFF_AVOIR_PP", description:"avoir + participe"} });
        } return out;
      }},
    { id:"OFF_LES_PLURIEL", description:"Pluriel après « les »",
      test:(t)=>{ const rx = new RegExp("\\\\bles"+WSP+"+("+WORD+")\\\\b","gi"); let m,out=[]; while((m=rx.exec(t))!==null){ const w=m[1]; if(!/(s|x|z|aux|eaux)$/i.test(w)){ let plural=w; if(/al$/i.test(w) && !/(bal|carnaval|chacal|festival|r\u00E9cital|r\u00E9gal)$/i.test(w)) plural = w.replace(/al$/i,"aux"); else if (/(eau|au|eu)$/i.test(w)) plural = w + "x"; else plural = w + "s"; out.push({ offset:m.index+4, length:w.length, message:"Nom au pluriel après \u00AB les \u00BB.", replacements:[{value:plural}], rule:{id:"OFF_LES_PLURIEL"} }); } } return out; }},
    { id:"OFF_DU_PLURIEL", description:"« du » devant un pluriel",
      test:(t)=>{ const rx=/\bdu"+WSP+"+("+WORD+"[sx])\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ const plural=m[1]; let singular=plural; if(/aux$/i.test(plural)) singular=plural.replace(/aux$/i,"al"); else if(/eaux$/i.test(plural)) singular=plural.replace(/eaux$/i,"eau"); else if(/([sx])$/i.test(plural)) singular=plural.replace(/([sx])$/i,""); out.push({ offset:m.index+3, length:plural.length, message:"\u00AB du \u00BB se combine mal avec un pluriel.", replacements:[{value:"des "+plural},{value:"du "+singular}], rule:{id:"OFF_DU_PLURIEL"} }); } return out; }},
    { id:"OFF_VERBE_PLURIEL_ENT", description:"Accord verbe (‑ent)",
      test:(t)=>{ const rx=new RegExp("\\\\b(les|des|ces|mes|tes|ses|nos|vos|leurs)"+WSP+"+"+WORD+"s?"+WSP+"+ne"+WSP+"+("+WORD+")e\\\\b","gi"); let m,out=[]; while((m=rx.exec(t))!==null){ const base=m[2]; const start=m.index + m[0].lastIndexOf(base+"e"); out.push({ offset:start, length:(base+"e").length, message:"Sujet pluriel \u2192 verbe en -ent.", replacements:[{value: base+"ent"}], rule:{id:"OFF_VERBE_PLURIEL_ENT"} }); } return out; }},
    { id:"OFF_PAR_LA_LA", description:"« par là »",
      test:(t)=>{ const rx=/\bpar\s+la\s*\?/gi; let m,out=[]; while((m=rx.exec(t))!==null){ out.push({ offset:m.index+4, length:2, message:"Écrivez \u00AB l\u00E0 \u00BB (adverbe).", replacements:[{value:"l\u00E0"}], rule:{id:"OFF_PAR_LA_LA"} }); } return out; }},
    { id:"OFF_C_ETAIT", description:"« c'était »",
      test:(t)=>{ const rx=/\bc['’]été\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ out.push({ offset:m.index, length:m[0].length, message:"Écrivez \u00AB c'était \u00BB.", replacements:[{value:"c'\u00E9tait"}], rule:{id:"OFF_C_ETAIT"} }); } return out; }},
    { id:"OFF_DET_NOM_ACCORD", description:"Accord déterminant/nom",
      test:(t)=>{
        const rx = new RegExp("\\\\b(de\\s+l'|de\\s+la|du|des|les|l'|la|le|une|un)"+WSP+"+("+WORD+")\\\\b","gi");
        let m, out=[];
        while((m=rx.exec(t))!==null){
          const detRaw = m[1];
          const noun = m[2];
          const detInfo = Morph.getDetInfo(detRaw.replace(/\s+/g,' ').toLowerCase());
          const nounInfo = Morph.getBestNoun(noun);
          if(!detInfo || !nounInfo) continue;
          const genderMismatch = detInfo.gender && nounInfo.gender && detInfo.gender !== nounInfo.gender;
          const numberMismatch = detInfo.number && nounInfo.number && detInfo.number !== nounInfo.number;
          if(!genderMismatch && !numberMismatch) continue;

          const normalizedDet = detRaw.toLowerCase();
          let suggestion = normalizedDet;
          if(numberMismatch){
            if(nounInfo.number === "pl") suggestion = "les";
            else if(nounInfo.number === "sg") suggestion = nounInfo.gender === "f" ? "la" : "le";
          } else if(genderMismatch){
            if(nounInfo.gender === "f"){
              if(normalizedDet === "un") suggestion = "une";
              else if(normalizedDet === "le") suggestion = "la";
              else if(normalizedDet === "du") suggestion = "de la";
            } else if(nounInfo.gender === "m"){
              if(normalizedDet === "une") suggestion = "un";
              else if(normalizedDet === "la") suggestion = "le";
              else if(normalizedDet === "de la") suggestion = "du";
            }
          }

          const start = m.index + m[0].toLowerCase().indexOf(detRaw.toLowerCase());
          const len = detRaw.length;
          const message = numberMismatch
            ? "Le déterminant devrait être au même nombre que le nom."
            : "Le déterminant ne correspond pas au genre du nom.";
          const replacements = suggestion && suggestion !== normalizedDet ? [{value: suggestion}] : [];
          out.push({ offset:start, length:len, message, replacements, rule:{id:"OFF_DET_NOM_ACCORD"}, type:"style" });
        }
        return out;
      }},
    { id:"OFF_POISON_POISSON", description:"Ambiguïté poison/poisson",
      test:(t)=>{
        const wordRx = new RegExp(WORD, "gi");
        const tokens = [];
        let w;
        while((w = wordRx.exec(t)) !== null){
          tokens.push({ text: w[0], index: w.index });
        }

        const rx = /\b(poison|poisons)\b/gi;
        let m, out=[];
        while((m = rx.exec(t)) !== null){
          const noun = m[1];
          const start = m.index;
          const len = noun.length;

          const tokenIndex = tokens.findIndex(tok => tok.index === start);
          if(tokenIndex === -1) continue;

          let contextTags = [];
          for(let back = tokenIndex - 1; back >= 0 && back >= tokenIndex - 4; back--){
            const tags = Morph.getTags(tokens[back].text);
            if(tags && tags.length){
              contextTags = tags;
              break;
            }
          }

          if(!contextTags.length) continue;

          const confusion = Morph.getContextConfusion(noun, contextTags);
          if(!confusion) continue;

          out.push({ offset:start, length:len, message:confusion.message || "Ambiguïté lexicale détectée.", replacements:[{value:confusion.suggestion}], rule:{id:"OFF_POISON_POISSON", description:"Paronyme poison/poisson"}, type:"ambiguity" });
        }
        return out;
      }},
    { id:"OFF_PONCTUATION_FIN", description:"Ponctuation de fin par paragraphe",
      test:(t)=>{ return byParagraphs(t,(seg,start)=>{
        const trimmed = seg.replace(new RegExp(WSP+"+$"),"");
        if(!trimmed) return [];
        const lastChar = trimmed.slice(-1);
        if(/[\.?!…]/.test(lastChar)) return [];

        // Exceptions pour les formules d'appel, de politesse et signatures
        const lowerTrimmed = trimmed.toLowerCase();
        
        // Formules d'appel (se terminent par une virgule)
        if(/^(bonjour|bonsoir|cher|chère|madame|monsieur|mesdames|messieurs|à\s+tous|à\s+toutes),?\s*$/i.test(lowerTrimmed)) return [];
        
        // Formules de politesse (se terminent par une virgule)
        if(/^(cordialement|bien\s+à\s+vous|sincèrement|merci|thank\s+you|best\s+regards|kind\s+regards|veuillez\s+agréer|je\s+vous\s+prie\s+d'agréer),?\s*$/i.test(lowerTrimmed)) return [];
        
        // Signatures (noms propres, se terminent souvent par une virgule ou rien)
        if(/^[A-ZÉÈÀÇ][a-zéèàç\s-]+(,?\s*)?$/i.test(trimmed) && trimmed.length < 50) return [];
        
        // Titres et fonctions (se terminent souvent par une virgule)
        if(/^(docteur|dr\.?|professeur|pr\.?|ingénieur|ing\.?|directeur|directrice|responsable|chef|m\.|mme|mademoiselle|mlle)\s+[A-ZÉÈÀÇ]/i.test(trimmed)) return [];

        const trailing = seg.match(/([A-Za-zÀ-ÖØ-öø-ÿ0-9'’_-]+)([ \t\u00A0\u202F]*)$/);
        let word = trimmed.slice(-1);
        let wordOffset = start + seg.length - 1;
        if(trailing && trailing[1]){
          word = trailing[1];
          wordOffset = start + trailing.index;
        }
        const originalWord = t.slice(wordOffset, wordOffset + word.length) || word;

        return [{
          offset: wordOffset,
          length: word.length,
          message:"Ajoutez une ponctuation de fin.",
          replacements:[{value: originalWord + '.'}],
          rule:{id:"OFF_PONCT_FIN"},
          type:"ambiguity"
        }];
      }); }},
    { id:"OFF_ESPACE_AVANT_PONCT", description:"Espace fine insécable avant ?!;:",
      test:(t)=>{
        const rx = new RegExp("(\\S)("+WSP+"?)([?!;:])","g");
        let m, out=[];
        while((m = rx.exec(t)) !== null){
          const between = m[2] || "";
          // Si une espace (même normale) est déjà présente, ne pas proposer (tolérance utilisateur)
          if (between.length > 0) continue;
          // Par sécurité, si c'est déjà une fine/insécable (cas rare avec 0 char), ignorer
          if(/[\u202F\u00A0]/.test(between)) continue;
          const punctIndex = m.index + m[1].length + between.length;
          out.push({ offset: punctIndex, length:1, message:"Ajoutez une espace fine insécable.", replacements:[{value:"\u202F"+m[3]}], rule:{id:"OFF_ESPACE_AVANT_PONCT"}, type:"typography"});
        }
        return out;
      }},
    { id:"OFF_FALLAIT_ALLER", description:"« fallait allait » → « fallait aller »",
      test:(t)=>{ const rx=/\b(fallait|faut)\s+allai(t|s)?\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ const aux=m[1]; out.push({ offset:m.index+aux.length+1, length:m[0].length-(aux.length+1), message:"On emploie l’infinitif : \u00AB "+aux+" aller \u00BB.", replacements:[{value:"aller"}], rule:{id:"OFF_FALLAIT_ALLER"} }); } return out; }}
  ,
    { id:"OFF_J_AVER", description:"« j'aver » → « j'avais »",
      test:(t)=>{ const rx=/\bj['’]\s*aver\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ out.push({ offset:m.index, length:m[0].length, message:"Conjuguez « avoir » à l’imparfait : j’avais.", replacements:[{value:"j’avais"}], rule:{id:"OFF_J_AVER"} }); } return out; } },
    { id:"OFF_MA_REFUS", description:"« m'a refus » → « m'a refusé »",
      test:(t)=>{ const rx=/\bm['’]a\s+refus\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ out.push({ offset:m.index+m[0].lastIndexOf("refus"), length:5, message:"Participe passé attendu : « refusé ».", replacements:[{value:"refusé"},{value:"refusée"}], rule:{id:"OFF_MA_REFUS"} }); } return out; } }
  ,
    // Homophones conservateurs
    { id:"OFF_ET_EST", description:"Confusion « et » / « est »",
      test:(t)=>{ const rx=/\b(?:il|elle|on|ce|c['’]|ça)\s+et\s+([a-zàâçéèêëîïôûùüÿœ]+(?:é|ée|és|ées)\b|[a-zàâçéèêëîïôûùüÿœ]{3,}\b)/gi; let m,out=[]; while((m=rx.exec(t))!==null){ const start=m.index + m[0].indexOf(' et '); out.push({ offset:start+1, length:2, message:"Ici, on attend probablement le verbe « est ».", replacements:[{value:"est"}], rule:{id:"OFF_ET_EST"} }); } return out; } },
    { id:"OFF_ON_ONT", description:"Confusion « on » / « ont »",
      test:(t)=>{ const rx=/\bon\s+([a-zàâçéèêëîïôûùüÿœ]+(?:é|ée|és|ées))\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ const start=m.index; out.push({ offset:start, length:2, message:"Avec un participe passé, utilisez « ont » (auxiliaire).", replacements:[{value:"ont"}], rule:{id:"OFF_ON_ONT"} }); } return out; } },
    { id:"OFF_OU_OU_ACCENT", description:"Confusion « ou » / « où »",
      test:(t)=>{ const rx=/\bou\s+(est|étais|était|êtes|sommes|sont|sera|seront|allons|vas)\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ const start=m.index; out.push({ offset:start, length:2, message:"Adverbe de lieu/interrogatif attendu : « où ».", replacements:[{value:"où"}], rule:{id:"OFF_OU_OU_ACCENT"}, type:"ambiguity" }); } return out; } },
    { id:"OFF_CE_EST", description:"« ce est » → « c'est »",
      test:(t)=>{ const rx=/\bce\s+est\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ out.push({ offset:m.index, length:m[0].length, message:"Contraction usuelle : « c'est ».", replacements:[{value:"c'est"}], rule:{id:"OFF_CE_EST"} }); } return out; } },
    { id:"OFF_S_EST_UN", description:"« s'est » vs « c'est » devant un nom",
      test:(t)=>{ const rx=/\bs['’]est\s+(un|une|des|le|la|les)\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ out.push({ offset:m.index, length:m[0].length, message:"Devant un nom/déterminant, utilisez « c'est ».", replacements:[{value:m[0].replace(/^s/i,"c")}], rule:{id:"OFF_S_EST_UN"} }); } return out; } },
    { id:"OFF_LA_BAS", description:"« la bas » → « là-bas »",
      test:(t)=>{ const rx=/\bla\s+bas\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ out.push({ offset:m.index, length:m[0].length, message:"Écrivez « là-bas ».", replacements:[{value:"là-bas"}], rule:{id:"OFF_LA_BAS"}, type:"typography" }); } return out; } },
    // Paronymes ciblés (simples)
    { id:"OFF_TACHE_TACHE", description:"« tache » vs « tâche »",
      test:(t)=>{ const rx=/\btache(s?)\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ out.push({ offset:m.index, length:m[0].length, message:"Contexte de travail/mission : « tâche ».", replacements:[{value:"tâche$1"}], rule:{id:"OFF_TACHE_TACHE"}, type:"ambiguity" }); } return out; } },
    { id:"OFF_COTE_COTE_COTE", description:"« cote »/« côte »/« côté »",
      test:(t)=>{ const rx=/\b(cote|côte|côté)\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ const w=m[1].toLowerCase(); if(w==="cote"){ out.push({ offset:m.index, length:m[0].length, message:"Voulez-vous dire « côte » (relief) ou « côté » (point de vue) ?", replacements:[{value:"côte"},{value:"côté"}], rule:{id:"OFF_COTE_COTE_COTE"}, type:"ambiguity" }); } } return out; } },
    { id:"OFF_FOI_FOIE", description:"« foi » vs « foie »",
      test:(t)=>{ const rx=/\b(foi|foie)\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ const w=m[1].toLowerCase(); if(w==="foi"){ out.push({ offset:m.index, length:m[0].length, message:"Contexte alimentaire/santé : « foie ».", replacements:[{value:"foie"}], rule:{id:"OFF_FOI_FOIE"}, type:"ambiguity" }); } } return out; } },
    { id:"OFF_VOIE_VOIX", description:"« voie » vs « voix »",
      test:(t)=>{ const rx=/\b(voie|voix)\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ const w=m[1].toLowerCase(); if(w==="voie"){ out.push({ offset:m.index, length:m[0].length, message:"Contexte sonore/vote : « voix ».", replacements:[{value:"voix"}], rule:{id:"OFF_VOIE_VOIX"}, type:"ambiguity" }); } } return out; } },
    { id:"OFF_CE_SE_SIMPLE", description:"« ce/se » simplifié",
      test:(t)=>{ const rx=/\bce\s+(?:que|qui)\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ /* ok, « ce » correct */ } return out; } },
    // Style: phrases trop longues (> 32 mots)
    { id:"OFF_PHRASE_TROP_LONGUE", description:"Phrase longue (lisibilité)",
      test:(t)=>{
        // Split naif en phrases
        const sentences = t.split(/([.!?…]+)(\s+|$)/).reduce((acc,cur,idx,arr)=>{ if(idx%3===0){ const seg = cur + (arr[idx+1]||''); if(seg.trim()) acc.push(seg); } return acc; }, []);
        let out=[]; let offset=0; for(const s of sentences){ const start = t.indexOf(s, offset); offset = start + s.length; const words = (s.match(/[A-Za-zÀ-ÖØ-öø-ÿ']+/g)||[]); if(words.length>=33){ // seuil conservateur
            // cibler le cœur de la phrase
            const lead = s.match(/^\s*/)[0].length; const len = Math.max(10, Math.min(s.length-lead, 40));
            out.push({ offset:start+lead, length:len, message:"Phrase longue (≥ 33 mots). Scindez-la en 2 phrases plus courtes.", replacements:[], rule:{id:"OFF_PHRASE_TROP_LONGUE"}, type:"style" });
          } }
        return out;
      }
    },
    // Style: répétitions rapprochées (>2 occurrences dans ~60 mots), hors stopwords
    { id:"OFF_REPETITION_MOT", description:"Répétitions rapprochées",
      test:(t)=>{
        const STOP = new Set(["le","la","les","un","une","des","de","du","au","aux","et","ou","mais","que","qui","ne","pas","je","tu","il","elle","on","nous","vous","ils","elles","est","sont","à","dans","pour","avec","ce","cet","cette","ces","se","sur","par","en","comme","plus","moins","très","trop"]);
        const tokens = []; const rx=/[A-Za-zÀ-ÖØ-öø-ÿ']+/g; let m; while((m=rx.exec(t))!==null){ tokens.push({w:m[0].toLowerCase(), i:m.index, l:m[0].length}); }
        let out=[]; const WIN=60; for(let i=0;i<tokens.length;i++){ const base=tokens[i]; if(base.w.length<3 || STOP.has(base.w)) continue; let count=1; let last=base; for(let j=i+1;j<tokens.length && (tokens[j].i - base.i) < 400; j++){ const tk=tokens[j]; if(tk.w===base.w){ count++; last=tk; if(count===3){ // flag à partir de la 3e occurrence
                  out.push({ offset:last.i, length:last.l, message:`Répétition du mot « ${base.w} ». Variez le vocabulaire.`, replacements:[], rule:{id:"OFF_REPETITION_MOT"}, type:"style" }); break; }
              } }
        }
        return out;
      }
    },
    // Style: complexité (métriques simples)
    { id:"OFF_COMPLEXITE", description:"Complexité élevée (lisibilité)",
      test:(t)=>{
        // Paragraphe par paragraphe
        const paras = t.split(/\n+/);
        let cursor=0, out=[]; for(const p of paras){ const start=t.indexOf(p, cursor); cursor = start + p.length; const words=(p.match(/[A-Za-zÀ-ÖØ-öø-ÿ']+/g)||[]); if(words.length<20) continue; const long=words.filter(w=>w.length>=8).length; const subord=(p.match(/\b(?:que|qui|dont|lorsque|puisque|quoique|bien que|alors que|tandis que)\b/gi)||[]).length; const sents=p.split(/[.!?…]+/).filter(s=>s.trim().length); const avgLen = words.length / Math.max(1,sents.length);
          if(avgLen>=28 || (long/words.length)>=0.35 || subord>=3){
            // Marquer un segment court en tête de paragraphe
            const lead = p.match(/^\s*/)[0].length; const len = Math.min(30, p.length - lead);
            out.push({ offset:start+lead, length:len, message:"Texte potentiellement complexe (phrase longue, mots longs, subordination). Simplifiez et scindez.", replacements:[], rule:{id:"OFF_COMPLEXITE"}, type:"style" });
          }
        }
        return out;
      }
    }
  ];
  
  function check(text){
    let matches = [];
    for (const r of RULES) try{ matches = matches.concat(r.test(text)||[]); }catch(e){}
    matches.sort((a,b)=>a.offset - b.offset || b.length - a.length);
    const filtered=[], seen=new Set();
    for(const m of matches){
      const key = m.offset+"-"+m.length+"-"+(m.rule?.id||"");
      if(!seen.has(key)){ seen.add(key); filtered.push(m); }
    }
    return { software:{name:"Textoo Offline"}, language:{code:"fr"}, matches: filtered };
  }
  window.TextooOfflineChecker = { check };
})();
