/* THE LAST SAVE - universal battle controls and boss contact damage. */
(function(){
  "use strict";
  if(window.__battleFullControlsInstalled)return;
  window.__battleFullControlsInstalled=true;

  const DEFAULT_TO_ACTION={
    w:"moveUp",s:"moveDown",a:"moveLeft",d:"moveRight",arrowup:"moveUp",arrowdown:"moveDown",arrowleft:"moveLeft",arrowright:"moveRight",
    shift:"focus",z:"potion",x:"limit",escape:"pause",r:"run"
  };
  const KEY_TO_DEFAULT={moveUp:"w",moveDown:"s",moveLeft:"a",moveRight:"d",focus:"shift",potion:"z",limit:"x",pause:"escape",run:"r"};
  const held=new Set();
  const estimated={x:200,y:450,last:performance.now(),dashUntil:0};
  let lastContact=0;

  function active(){return !!window.Battle25D?.isActive?.();}
  function key(){return (window.BattleKeybinds?.load?.()||{});}
  function dispatch(k,type){window.dispatchEvent(new KeyboardEvent(type,{key:k,bubbles:true,cancelable:true}));}

  window.addEventListener("keydown",function(e){
    if(!active()||e.repeat)return;
    const k=String(e.key||"").toLowerCase(), b=key();
    const action=Object.keys(b).find(a=>b[a]===k);
    if(!action)return;
    if(["moveUp","moveDown","moveLeft","moveRight","focus","potion","limit","pause","run"].includes(action)){
      const base=KEY_TO_DEFAULT[action];
      if(base&&base!==k){e.preventDefault();held.add(action);dispatch(base,"keydown");}
    }
  },true);
  window.addEventListener("keyup",function(e){
    if(!active())return;
    const k=String(e.key||"").toLowerCase(), b=key();
    const action=Object.keys(b).find(a=>b[a]===k);
    if(!action)return;
    const base=KEY_TO_DEFAULT[action];
    if(base&&base!==k){held.delete(action);dispatch(base,"keyup");}
  },true);

  function track(dt){
    if(!active())return;
    const f=window.Battle25D.fight?.();
    if(!f)return;
    const b=key(), now=performance.now()/1000;
    let dx=0,dy=0;
    if(held.has("moveLeft")||b.moveLeft==="a"&&held.has("a"))dx--;
    if(held.has("moveRight"))dx++;
    if(held.has("moveUp"))dy--;
    if(held.has("moveDown"))dy++;
    const focus=held.has("focus");
    const speed=focus?80:190;
    const l=Math.hypot(dx,dy)||1;
    estimated.x=Math.max(8,Math.min(392,estimated.x+dx/l*speed*dt));
    estimated.y=Math.max(8,Math.min(512,estimated.y+dy/l*speed*dt));
    if(now-estimated.last>1.5){estimated.x=200;estimated.y=450;estimated.last=now;}

    /* Bosses now have a real contact zone: touching a boss body hurts even
       when no projectile is present. Invulnerability from dodge/parry wins. */
    if(now<lastContact)return;
    for(const e of (f.enemies||[])){
      if(e.hp<=0||e.monster?.chance>0)continue;
      const dx=estimated.x-Number(e.x||0),dy=estimated.y-Number(e.y||0);
      const radius=38;
      if(dx*dx+dy*dy<=radius*radius){
        const before=f.player_hp;
        const dmg=Math.max(1,Math.round((Number(e.monster?.contact_damage)||Number(e.monster?.level||10)*1.5)));
        const defense=Number(f.stats?.defense||0);
        let final=Math.max(1,dmg-Math.floor(defense*.5));
        const def=f._rtDefense, tm=performance.now()/1000;
        if(def&&(tm<def.dodgeUntil||tm<def.parryUntil))continue;
        f.player_hp=Math.max(0,f.player_hp-final);
        lastContact=now+0.45;
        if(typeof print==="function")print(`💥 ${String(e.monster?.name||"BOSS").toUpperCase()} body-checks you for ${final} damage.`);
        if(before!==f.player_hp&&window.BattleDefense?.state)window.BattleDefense.state(f).banner="CONTACT!";
        break;
      }
    }
  }
  let last=performance.now();
  function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;track(dt);requestAnimationFrame(loop);}
  requestAnimationFrame(loop);
})();
