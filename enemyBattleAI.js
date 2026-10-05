/* THE LAST SAVE - dynamic enemy movement AI. */
(function () {
  "use strict";
  if (window.__enemyBattleAIInstalled) return;
  window.__enemyBattleAIInstalled = true;
  const FW=400,FH=520,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));
  const states=new WeakMap();let wormHead=null,wormSegments=[],svg=null;
  const boss=e=>!!e?.monster&&(e.monster.chance<=0||e.monster.boss||e.monster.isBoss);
  const wyrm=e=>boss(e)&&/abyssal starwyrm/i.test(String(e.monster.name||""));
  function state(e){let s=states.get(e);if(!s){s={mode:"stalk",timer:.4+Math.random(),phase:Math.random()*6.28,vx:0,vy:0};states.set(e,s);}return s;}
  function move(e,i,f,dt,t){
    if(!e||e.hp<=0)return;
    const s=state(e),p={x:Number(f._rtPlayer?.x||200),y:Number(f._rtPlayer?.y||450)},b=boss(e),w=wyrm(e);s.timer-=dt;
    if(s.timer<=0){const d=dist(e,p);s.mode=w?(d>235?"approach":d<125?"retreat":Math.random()<.5?"orbit":"stalk"):b?(d<105?"retreat":Math.random()<.45?"strafe":"stalk"):(d<80?"retreat":Math.random()<.35?"strafe":"stalk");s.timer=(w?.45:b?.7:1)+Math.random()*.7;}
    const sp0=(b?42:55)+Math.min(85,Number(e.monster?.level||1)*1.5);let tx=p.x,ty=p.y,sp=sp0;
    if(s.mode==="retreat"){const a=Math.atan2(e.y-p.y,e.x-p.x)+Math.sin(t*.8+s.phase)*.3;tx=p.x+Math.cos(a)*(w?245:b?165:125);ty=p.y+Math.sin(a)*(w?245:b?165:125);sp*=1.3;}
    else if(s.mode==="strafe"||s.mode==="orbit"){const a=Math.atan2(e.y-p.y,e.x-p.x)+Math.PI/2+Math.sin(t*.7+s.phase)*.45,r=w?185:b?145:105;tx=p.x+Math.cos(a)*r;ty=p.y+Math.sin(a)*r;sp*=.9;}
    const ax=clamp(tx,30,FW-30)-e.x,ay=clamp(ty,30,210)-e.y,l=Math.hypot(ax,ay)||1;s.vx+=(ax/l*sp-s.vx)*Math.min(1,dt*3.5);s.vy+=(ay/l*sp-s.vy)*Math.min(1,dt*3.5);
    const nx=clamp(e.x+s.vx*dt,24,FW-24),ny=clamp(e.y+s.vy*dt,25,225);const amp=b?90:55,rate=b?.5:.8;e.rx=nx-Math.sin(t*rate+i*2)*amp;e.ry=ny-Math.sin(t*1.3+i)*10;e.x=nx;e.y=ny;e._aiX=nx;e._aiY=ny;
    if(w) updateWyrm(e,dt);
  }
  function updateWyrm(head,dt){
    if(wormHead!==head||wormSegments.length!==20){wormHead=head;wormSegments=Array.from({length:20},(_,i)=>({x:head.x,y:head.y,i}));}
    let lead={x:head.x,y:head.y};for(const s of wormSegments){const dx=lead.x-s.x,dy=lead.y-s.y,d=Math.hypot(dx,dy)||1,gap=9.5;if(d>gap){const p=Math.min(1,dt*20);s.x+=dx*p;s.y+=dy*p;}lead={x:s.x-(dx/d)*gap,y:s.y-(dy/d)*gap};}
  }
  function ensureSvg(){const ov=document.getElementById("rtBattle");if(!ov)return null;if(!svg){svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.style.cssText="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3";ov.appendChild(svg);}return svg;}
  function drawWyrm(){const root=ensureSvg();if(!root||!wormHead)return;while(root.firstChild)root.removeChild(root.firstChild);const W=innerWidth,H=innerHeight,sc=Math.min(W*.96/FW,H*.86/FH),cx=W/2,oy=H*.07,to=(x,y)=>({x:cx+(x-FW/2)*sc,y:oy+y*sc});for(let i=wormSegments.length-1;i>=0;i--){const s=wormSegments[i],p=to(s.x,s.y),c=document.createElementNS("http://www.w3.org/2000/svg","circle");c.setAttribute("cx",p.x);c.setAttribute("cy",p.y);c.setAttribute("r",String(Math.max(4,12-i*.34)));c.setAttribute("fill",i%2?"#7049a8":"#a46cff");c.setAttribute("opacity",String(Math.max(.35,1-i*.035)));root.appendChild(c);}}
  function tick(){if(window.Battle25D?.isActive?.()){const f=window.Battle25D.fight?.();if(f){f._rtPlayer=f._rtPlayer||{x:200,y:450};const t=performance.now()/1000,dt=1/60;for(let i=0;i<(f.enemies||[]).length;i++)move(f.enemies[i],i,f,dt,t);drawWyrm();}}else if(svg){svg.remove();svg=null;wormHead=null;wormSegments=[];}requestAnimationFrame(()=>setTimeout(tick,0));}
  window.EnemyBattleAI={state,reset:()=>{wormHead=null;wormSegments=[];}};tick();
})();
