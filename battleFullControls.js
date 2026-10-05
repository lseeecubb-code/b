/* THE LAST SAVE - universal battle controls and boss contact damage. */
(function(){
  "use strict";
  if(window.__battleFullControlsInstalled)return;
  window.__battleFullControlsInstalled=true;
  const KEY_TO_DEFAULT={moveUp:"w",moveDown:"s",moveLeft:"a",moveRight:"d",focus:"shift",potion:"z",limit:"x",pause:"escape",run:"r"};
  const held=new Set();
  const estimated={x:200,y:450};
  let lastContact=0,last=performance.now();
  function active(){return !!window.Battle25D?.isActive?.();}
  function key(){return window.BattleKeybinds?.load?.()||{};}
  function dispatch(k,type){window.dispatchEvent(new KeyboardEvent(type,{key:k,bubbles:true,cancelable:true}));}
  window.addEventListener("keydown",function(e){
    if(!active()||e.repeat)return;
    const k=String(e.key||"").toLowerCase(),b=key(),action=Object.keys(b).find(a=>b[a]===k);
    if(!action)return;
    if(KEY_TO_DEFAULT[action]){
      held.add(action);
      const base=KEY_TO_DEFAULT[action];
      if(base!==k){e.preventDefault();dispatch(base,"keydown");}
    }
  },true);
  window.addEventListener("keyup",function(e){
    if(!active())return;
    const k=String(e.key||"").toLowerCase(),b=key(),action=Object.keys(b).find(a=>b[a]===k);
    if(!action)return;
    if(KEY_TO_DEFAULT[action]){
      held.delete(action);
      const base=KEY_TO_DEFAULT[action];
      if(base!==k)dispatch(base,"keyup");
    }
  },true);
  function track(dt){
    if(!active())return;
    const f=window.Battle25D.fight?.();if(!f)return;
    let dx=0,dy=0;
    if(held.has("moveLeft"))dx--;
    if(held.has("moveRight"))dx++;
    if(held.has("moveUp"))dy--;
    if(held.has("moveDown"))dy++;
    const speed=held.has("focus")?80:190,l=Math.hypot(dx,dy)||1;
    estimated.x=Math.max(8,Math.min(392,estimated.x+dx/l*speed*dt));
    estimated.y=Math.max(8,Math.min(512,estimated.y+dy/l*speed*dt));
    const now=performance.now()/1000;
    if(now<lastContact)return;
    for(const e of (f.enemies||[])){
      if(e.hp<=0||e.monster?.chance>0)continue;
      const dx=estimated.x-Number(e.x||0),dy=estimated.y-Number(e.y||0);
      if(dx*dx+dy*dy>38*38)continue;
      const def=f._rtDefense;
      if(def&&(now<def.dodgeUntil||now<def.parryUntil))continue;
      const raw=Number(e.monster?.contact_damage)||Math.max(1,Number(e.monster?.level||10)*1.5);
      const defense=Number(f.stats?.defense||0),final=Math.max(1,Math.round(raw-Math.floor(defense*.5)));
      f.player_hp=Math.max(0,f.player_hp-final);lastContact=now+.45;
      if(typeof print==="function")print("CONTACT HIT: "+String(e.monster?.name||"BOSS").toUpperCase()+" deals "+final+" damage.");
      if(window.BattleDefense?.state)window.BattleDefense.state(f).banner="CONTACT!";
      break;
    }
  }
  function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;track(dt);requestAnimationFrame(loop);}
  requestAnimationFrame(loop);
})();
