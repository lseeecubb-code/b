/* THE LAST SAVE - dynamic boss-style enemy AI.
 * Original game behavior inspired by state-machine boss design: hover/position,
 * telegraph, execute, recover, enrage. No real-world behavior is involved.
 */
(function () {
  "use strict";
  if (window.__enemyBattleAIInstalled) return;
  window.__enemyBattleAIInstalled = true;

  const FW = 400, FH = 520;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const states = new WeakMap();
  let wormHead = null, wormSegments = [];

  const isBoss = e => !!e?.monster && (e.monster.chance <= 0 || e.monster.boss || e.monster.isBoss);
  const isWyrm = e => isBoss(e) && /abyssal starwyrm/i.test(String(e.monster.name || ""));
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const getState = e => {
    let s=states.get(e);
    if(!s){s={phase:0,mode:"intro",timer:.8,dir:Math.random()<.5?-1:1,vx:0,vy:0,attackTimer:0};states.set(e,s);}
    return s;
  };

  function player(f){return f?._rtPlayer||{x:200,y:450};}

  function chooseMode(e,f,s,t){
    const p=player(f), d=distance(e,p), hp=e.hp/Math.max(1,e.monster.hp);
    if(isWyrm(e)){
      if(hp<=.25) s.phase=2; else if(hp<=.55) s.phase=1;
      if(s.phase===2) return d<150?"swoop-away":"constellation";
      if(s.phase===1) return d>220?"burrow-approach":(d<120?"swoop-away":"coil");
      return d>230?"approach":(d<115?"swoop-away":"orbit");
    }
    if(isBoss(e)){
      if(hp<=.25) s.phase=2; else if(hp<=.55) s.phase=1;
      return s.phase===2 ? (d<125?"retreat":"charge") : (d<105?"retreat":(Math.random()<.5?"orbit":"reposition"));
    }
    return d<70?"retreat":(Math.random()<.35?"strafe":"chase");
  }

  function moveEnemy(e,f,dt,t,index){
    if(e.hp<=0)return;
    const s=getState(e),p=player(f);
    s.timer-=dt;
    if(s.timer<=0){s.mode=chooseMode(e,f,s,t);s.timer=(isBoss(e)?.75:1.1)+Math.random()*.65;s.dir=Math.random()<.5?-1:1;}

    const boss=isBoss(e), wyrm=isWyrm(e), hp=e.hp/Math.max(1,e.monster.hp);
    let tx=p.x,ty=p.y,speed=(boss?52:62)+Math.min(70,Number(e.monster?.level||1)*1.6);
    if(s.mode==="intro"){tx=200;ty=90;speed=75;}
    if(s.mode==="chase"||s.mode==="approach"||s.mode==="burrow-approach"){
      tx=p.x;ty=Math.min(p.y-80,190);speed*=wyrm?1.05:1;
    } else if(s.mode==="retreat"||s.mode==="swoop-away"){
      const a=Math.atan2(e.y-p.y,e.x-p.x)+Math.sin(t*.8+s.dir)*.22;
      tx=e.x+Math.cos(a)*190;ty=e.y+Math.sin(a)*190;speed*=1.45;
    } else if(s.mode==="orbit"||s.mode==="coil"){
      const r=wyrm?175:(boss?145:105),a=Math.atan2(e.y-p.y,e.x-p.x)+s.dir*(Math.PI/2+Math.sin(t*.6)*.25);
      tx=p.x+Math.cos(a)*r;ty=p.y+Math.sin(a)*r;speed*=.92;
    } else if(s.mode==="reposition"){
      tx=70+((index*97+t*18)%260);ty=65+Math.sin(t+index)*55;speed*=.8;
    } else if(s.mode==="charge"){
      tx=p.x;ty=p.y;speed*=1.8;
    } else if(s.mode==="constellation"){
      const a=t*.42+s.dir*.7;tx=200+Math.cos(a)*145;ty=115+Math.sin(a)*55;speed*=.8;
    }
    const ax=clamp(tx,30,FW-30)-e.x,ay=clamp(ty,35,225)-e.y,l=Math.hypot(ax,ay)||1;
    s.vx+=(ax/l*speed-s.vx)*Math.min(1,dt*4);
    s.vy+=(ay/l*speed-s.vy)*Math.min(1,dt*4);
    e.x=clamp(e.x+s.vx*dt,22,FW-22);e.y=clamp(e.y+s.vy*dt,28,235);
    e._bossPhase=s.phase;e._bossMode=s.mode;e._bossEnraged=hp<=.25;
    if(wyrm) updateWyrm(e,s,dt,t);
  }

  function updateWyrm(head,s,dt,t){
    if(wormHead!==head||wormSegments.length!==22){
      wormHead=head;wormSegments=Array.from({length:22},(_,i)=>({x:head.x,y:head.y,angle:0,index:i}));
    }
    let lead={x:head.x,y:head.y,angle:Math.atan2(s.vy,s.vx)};
    for(const seg of wormSegments){
      const gap=10,dx=lead.x-seg.x,dy=lead.y-seg.y,d=Math.hypot(dx,dy)||1;
      if(d>gap){const pull=Math.min(1,dt*20);seg.x+=dx*pull;seg.y+=dy*pull;}
      seg.angle=Math.atan2(lead.y-seg.y,lead.x-seg.x);
      lead={x:seg.x-Math.cos(seg.angle)*gap,y:seg.y-Math.sin(seg.angle)*gap,angle:seg.angle};
    }
    head._wormSegments=wormSegments;
  }

  function renderWyrm(ctx,project){
    const segs=project?._wormSegments;if(!segs)return;
    ctx.save();
    for(let i=segs.length-1;i>=0;i--){const s=segs[i],r=Math.max(5,14-i*.36);ctx.globalAlpha=Math.max(.3,1-i/segs.length*.6);ctx.fillStyle=i%2?"#6f4fa8":"#9b6cff";ctx.beginPath();ctx.arc(s.x,s.y,r,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }

  window.EnemyBattleAI={moveEnemy,renderWyrm,state:getState,reset:()=>{wormHead=null;wormSegments=[];}};

  function loop(){
    if(window.Battle25D?.isActive?.()){
      const f=window.Battle25D.fight?.();
      if(f){
        const t=performance.now()/1000,dt=1/60;
        f._rtPlayer=f._rtPlayer||{x:200,y:450};
        for(let i=0;i<(f.enemies||[]).length;i++)moveEnemy(f.enemies[i],f,dt,t,i);
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
