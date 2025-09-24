
const LT_ENDPOINT = "https://api.languagetool.org/v2/check";
async function ltCheck(text){
  const p = new URLSearchParams();
  p.set("text", text); p.set("language","fr"); p.set("level","picky"); p.set("enabledOnly","false");
  const r = await fetch(LT_ENDPOINT, { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body: p.toString() });
  if(!r.ok) throw new Error(`LT error ${r.status}`);
  return r.json();
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
  if (msg && msg.type==="CHECK_TEXT"){
    ltCheck(msg.text).then(d=>sendResponse({ok:true,data:d})).catch(e=>sendResponse({ok:false,error:e.message}));
    return true;
  }
});
