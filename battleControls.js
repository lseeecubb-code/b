/* Real-time battle keybind system. */
(function () {
  "use strict";
  const KEY = "the-last-save.battle-keybinds";
  const ALLOWED = ["1","2","3","4","5","6","7","8","9","0","z","x","c","v","q","e","r","f","w","a","s","d","shift","space","tab","escape","arrowup","arrowdown","arrowleft","arrowright"];
  const DEFAULTS = { attack:"1",skill1:"2",skill2:"3",skill3:"4",skill4:"5",skill5:"6",skill6:"7",skill7:"8",dodge:"v",parry:"c",dash:"space",moveUp:"w",moveDown:"s",moveLeft:"a",moveRight:"d",focus:"shift",potion:"z",limit:"x",pause:"escape",run:"r" };
  const LABELS = { attack:"Attack",skill1:"Skill 1",skill2:"Skill 2",skill3:"Skill 3",skill4:"Skill 4",skill5:"Skill 5",skill6:"Skill 6",skill7:"Skill 7",dodge:"Dodge",parry:"Parry",dash:"Dash",moveUp:"Move Up",moveDown:"Move Down",moveLeft:"Move Left",moveRight:"Move Right",focus:"Focus / Precision",potion:"Potion",limit:"Limit Break",pause:"Pause",run:"Run Away" };
  function load(){try{return {...DEFAULTS,...(JSON.parse(localStorage.getItem(KEY)||"{}"))};}catch(_){return {...DEFAULTS};}}
  function save(b){try{localStorage.setItem(KEY,JSON.stringify(b));}catch(_){} }
  function normalize(k){const s=String(k||"").trim().toLowerCase();return s==="spacebar"?"space":s;}
  function setBinding(action,key){const b=load(),k=normalize(key);if(!Object.prototype.hasOwnProperty.call(DEFAULTS,action)||!ALLOWED.includes(k))return false;const other=Object.keys(b).find(a=>a!==action&&b[a]===k);if(other)return false;b[action]=k;save(b);return true;}
  function codeLabel(k){return String(k||"").toUpperCase().replace("ARROW","ARROW ");}
  function openBattleKeybinds(){const b=load(),actions=Object.keys(DEFAULTS),lines=actions.map((a,i)=>`${i+1}. ${LABELS[a]} = ${codeLabel(b[a])}`).join("\n");const choice=prompt(`BATTLE KEYBINDS\n\n${lines}\n\nEnter the number of an action to change it, or Cancel to close.`);if(choice==null)return;const action=actions[Number(choice)-1];if(!action)return;const key=prompt(`Set ${LABELS[action]} key.\nAllowed: ${ALLOWED.map(codeLabel).join(", ")}`,b[action]);if(key==null)return;const k=normalize(key);if(!setBinding(action,k)){if(typeof print==="function")print("⚠️ That key is not allowed or is already assigned to another battle action.");return;}if(typeof print==="function")print(`⌨️ ${LABELS[action]} is now bound to ${codeLabel(k)}.`);}
  window.BattleKeybinds={KEY,ALLOWED,DEFAULTS,LABELS,load,save,setBinding,open:openBattleKeybinds};
  window.openBattleKeybinds=openBattleKeybinds;
  window.BattleManualAttack={arm:()=>{},isArmed:()=>true};
})();
