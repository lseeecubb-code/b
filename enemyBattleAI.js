/* THE LAST SAVE - dynamic enemy movement AI.
 * Game-only boss/enemy behavior: replaces static orbiting with readable,
 * stateful movement and gives the secret Abyssal Starwyrm a segmented chase.
 */
(function () {
  "use strict";
  if (window.__enemyBattleAIInstalled) return;
  window.__enemyBattleAIInstalled = true;

  const FW = 400, FH = 520;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a,b) => Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));
  const states = new WeakMap();
  let wormSegments = [];

  function boss(e) { return !!e?.monster && (e.monster.chance <= 0 || e.monster.boss || e.monster.isBoss); }
  function wyrm(e) { return boss(e) && /abyssal starwyrm/i.test(String(e.monster.name || "")); }
  function state(e) {
    let s=states.get(e);
    if(!s){ s={phase:Math.random()*Math.PI*2, mode:"stalk", timer:.4+Math.random(), targetX:e.x||200,targetY:e.y||90, change:0, vx:0,vy:0}; states.set(e,s); }
    return s;
  }
  function player(f){ return {x:Number(f?._rtPlayer?.x ?? 200), y:Number(f?._rtPlayer?.y ?? 450)}; }

  function moveEnemy(e,f,dt,t,index){
    if(e.hp<=0) return;
    const s=state(e), p=player(f), isB=boss(e), isW=wyrm(e);
    s.timer-=dt;
    const speedBase=(isB?42:55) + Math.min(80,Number(e.monster?.level||1)*1.5);
    if(s.timer<=0){
      const d=dist(e,p);
      if(isW) s.mode=d>230?"approach":d<120?"retreat":(Math.random()<.5?"orbit":"stalk");
      else if(isB) s.mode=d<115?"retreat":(Math.random()<.35?"strafe":"stalk");
      else s.mode=Math.random()<.25?"strafe":"stalk";
      s.timer=(isW?.45: isB?.7:1.0)+Math.random()*.8;
      s.change=Math.random()*Math.PI*2;
    }
    let tx=p.x,ty=p.y, sp=speedBase;
    if(s.mode==="retreat"){
      const a=Math.atan2(e.y-p.y,e.x-p.x)+Math.sin(t*.9+s.phase)*.35;
      tx=e.x+Math.cos(a)*150; ty=e.y+Math.sin(a)*150; sp*=1.25;
    } else if(s.mode==="strafe" || s.mode==="orbit"){
      const a=Math.atan2(e.y-p.y,e.x-p.x)+(s.mode==="orbit"?1:-1)*(Math.PI/2+Math.sin(t*.7+s.phase)*.35);
      const r=isW?180:(isB?145:105);
      tx=p.x+Math.cos(a)*r; ty=p.y+Math.sin(a)*r; sp*=.9;
    }
    const ax=clamp(tx,35,FW-35)-e.x, ay=clamp(ty,35,210)-e.y;
    const l=Math.hypot(ax,ay)||1;
    s.vx += (ax/l*sp-s.vx)*Math.min(1,dt*3.5);
    s.vy += (ay/l*sp-s.vy)*Math.min(1,dt*3.5);
    e.x=clamp(e.x+s.vx*dt,24,FW-24); e.y=clamp(e.y+s.vy*dt,25,225);

    if(isW) updateWyrm(e,f,dt,t,s);
  }

  function updateWyrm(head,f,dt,t,s){
    const wanted=18;
    if(wormSegments.length!==wanted || wormSegments[0]?.head!==head){
      wormSegments=Array.from({length:wanted},(_,i)=>({head,x:head.x,y:head.y,angle:0,offset:i}));
    }
    let lead={x:head.x,y:head.y,angle:Math.atan2(s.vy,s.vx)};
    for(let i=0;i<wormSegments.length;i++){
      const seg=wormSegments[i];
      const gap=9.5;
      const dx=lead.x-seg.x,dy=lead.y-seg.y;
      const d=Math.hypot(dx,dy)||1;
      if(d>gap){
        const pull=Math.min(1,dt*18);
        seg.x += dx*pull; seg.y += dy*pull;
      }
      seg.angle=Math.atan2(lead.y-seg.y,lead.x-seg.x);
      lead={x:seg.x-Math.cos(seg.angle)*gap,y:seg.y-Math.sin(seg.angle)*gap,angle:seg.angle};
    }
    head._wormSegments=wormSegments;
  }

  function renderWyrm(ctx,project){
    const e=project,eSeg=e?._wormSegments;if(!eSeg)return;
    ctx.save();
    for(let i=eSeg.length-1;i>=0;i--){
      const s=eSeg[i], r=Math.max(5,13-i*.32);
      ctx.beginPath();ctx.arc(s.x,s.y,r,0,Math.PI*2);
      ctx.fillStyle=i%2?"#6f4fa8":"#9b6cff";ctx.globalAlpha=Math.max(.35,1-i/eSeg.length*.55);ctx.fill();
    }
    ctx.restore();
  }

  window.EnemyBattleAI={moveEnemy,renderWyrm,state,reset:()=>{wormSegments=[]}};

  function loop(){
    if(window.Battle25D?.isActive?.()){
      const f=window.Battle25D.fight?.();
      if(f){
        const t=performance.now()/1000;
        const dt=Math.min(.05,1/60);
        f._rtPlayer=f._rtPlayer||{x:200,y:450};
        for(let i=0;i<(f.enemies||[]).length;i++) moveEnemy(f.enemies[i],f,dt,t,i);
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
