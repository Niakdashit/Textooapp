
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
        const trimmed = seg.replace(new RegExp(WSP+"+$",""),"");
        if(!trimmed) return [];
        const lastChar = trimmed.slice(-1);
        if(/[\.?!…]/.test(lastChar)) return [];
        const offset = start + trimmed.length - lastChar.length;
        return [{ offset, length:lastChar.length, message:"Ajoutez une ponctuation de fin.", replacements:[{value:lastChar+"."}], rule:{id:"OFF_PONCT_FIN"}, type:"style" }];
      }); }},
    { id:"OFF_ESPACE_AVANT_PONCT", description:"Espace fine insécable avant ?!;:",
      test:(t)=>{ const rx=new RegExp("(\\S)("+WSP+"?)([?!;:])","g"); let m,out=[]; while((m=rx.exec(t))!==null){ const between=m[2]||""; if(/[\\u202F\\u00A0]/.test(between)) continue; const punctIndex=m.index + m[1].length + between.length; out.push({ offset: punctIndex, length:1, message:"Ajoutez une espace fine insécable.", replacements:[{value:"\\u202F"+m[3]}], rule:{id:"OFF_ESPACE_AVANT_PONCT"}, type:"typography"}); } return out; }},
    { id:"OFF_FALLAIT_ALLER", description:"« fallait allait » → « fallait aller »",
      test:(t)=>{ const rx=/\b(fallait|faut)\s+allai(t|s)?\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ const aux=m[1]; out.push({ offset:m.index+aux.length+1, length:m[0].length-(aux.length+1), message:"On emploie l’infinitif : \u00AB "+aux+" aller \u00BB.", replacements:[{value:"aller"}], rule:{id:"OFF_FALLAIT_ALLER"} }); } return out; }}
  ,
    { id:"OFF_J_AVER", description:"« j'aver » → « j'avais »",
      test:(t)=>{ const rx=/\bj['’]\s*aver\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ out.push({ offset:m.index, length:m[0].length, message:"Conjuguez « avoir » à l’imparfait : j’avais.", replacements:[{value:"j’avais"}], rule:{id:"OFF_J_AVER"} }); } return out; } },
    { id:"OFF_MA_REFUS", description:"« m'a refus » → « m'a refusé »",
      test:(t)=>{ const rx=/\bm['’]a\s+refus\b/gi; let m,out=[]; while((m=rx.exec(t))!==null){ out.push({ offset:m.index+m[0].lastIndexOf("refus"), length:5, message:"Participe passé attendu : « refusé ».", replacements:[{value:"refusé"},{value:"refusée"}], rule:{id:"OFF_MA_REFUS"} }); } return out; } }
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
