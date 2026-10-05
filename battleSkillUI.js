/* Right-side in-battle skill list. Presentation only; reads existing skill bindings/cooldowns. */
(function(){
  "use strict";
  function esc(v){return String(v??"").replace(/[&<>\"]/g,"_");}
  function codeLabel(code){
    if(!code)return "—";
    if(/^Digit\d$/.test(code))return code.slice(5);
    if(/^Key[A-Z]$/.test(code))return code.slice(3);
    return code.replace(/^Arrow/ , "");
  }
  function getRows(){
    try{
      if(typeof weaponSkills === "function") return weaponSkills().map((s,i)=>({name:s.name,kind:"Skill",key:i}));
    }catch(e){}
    return [];
  }
  function getBind(i){
    try{
      const b=JSON.parse(localStorage.getItem("the-last-save.skill-keybinds")||"{}");
      const keys=["Digit1","Digit2","Digit3","Digit4","Digit5","Digit6","Digit7","Digit8","Digit9","Digit0","KeyZ","KeyX","KeyC","KeyV","KeyQ","KeyE","KeyR","KeyF"];
      const rows=getRows();
      if(rows[i]){
        const key="weapon:"+rows[i].name;
        return codeLabel(b[key]===undefined?keys[i]:b[key]);
      }
    }catch(e){}
    return codeLabel(["Digit1","Digit2","Digit3","Digit4","Digit5","Digit6","Digit7","Digit8"][i]);
  }
  function mount(){
    if(document.getElementById("battleSkillUI"))return;
    const el=document.createElement("div");
    el.id="battleSkillUI";
    el.innerHTML='<div class="bsui-title">SKILLS</div><div class="bsui-list"></div>';
    const style=document.createElement("style");
    style.textContent=`#battleSkillUI{position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:9998;width:190px;font-family:inherit;pointer-events:none}.bsui-title{font-size:11px;letter-spacing:2px;opacity:.7;margin:0 0 7px;text-align:right}.bsui-list{display:flex;flex-direction:column;gap:6px}.bsui-row{display:flex;align-items:center;gap:8px;padding:7px 8px;border:1px solid rgba(255,255,255,.18);background:rgba(8,8,15,.78);border-radius:6px;box-shadow:0 3px 12px rgba(0,0,0,.25)}.bsui-key{width:26px;height:26px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.3);border-radius:4px;background:rgba(255,255,255,.08);font-weight:700;font-size:12px}.bsui-name{flex:1;min-width:0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bsui-state{font-size:9px;opacity:.65}.bsui-row.ready{border-color:rgba(255,255,255,.35)}.bsui-row.cooldown{opacity:.55}@media(max-width:700px){#battleSkillUI{right:7px;width:155px}.bsui-row{padding:5px}.bsui-name{font-size:10px}}`;
    document.head.appendChild(style); document.body.appendChild(el);
  }
  function update(){
    const el=document.getElementById("battleSkillUI"); if(!el)return;
    const active=window.Battle25D?.isActive?.(); el.style.display=active?"block":"none";
    if(!active)return;
    const list=el.querySelector(".bsui-list"); const rows=getRows();
    list.innerHTML="";
    rows.slice(0,10).forEach((s,i)=>{
      const row=document.createElement("div"); row.className="bsui-row ready";
      const key=document.createElement("span"); key.className="bsui-key"; key.textContent=getBind(i);
      const name=document.createElement("span"); name.className="bsui-name"; name.textContent=s.name;
      const state=document.createElement("span"); state.className="bsui-state"; state.textContent="READY";
      row.append(key,name,state); list.appendChild(row);
    });
  }
  document.addEventListener("DOMContentLoaded",()=>{mount();update();setInterval(update,120);});
})();
