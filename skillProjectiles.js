/* Skill-specific projectile visuals and flashy impact effects for real-time 2.5D battles. */
(function () {
  "use strict";
  const TAU = Math.PI * 2;
  const FW = 400, FH = 520;
  const META = {
    "twin slash": { kind:"slashes", color:"#fff", count:2, size:46, speed:460 },
    "guard breaker": { kind:"hammer", color:"#ffd166", count:1, size:26, speed:300, effect:"impact" },
    cleave: { kind:"arc", color:"#f2f2f2", count:1, size:62, speed:330, effect:"shock" },
    "reckless chop": { kind:"arc", color:"#ff5c5c", count:1, size:68, speed:280, effect:"rage" },
    backstab: { kind:"shadow", color:"#a879ff", count:1, size:20, speed:650, effect:"shadow" },
    "poison cut": { kind:"slash", color:"#8fe36b", count:1, size:42, speed:520, effect:"poison" },
    "skull crusher": { kind:"hammer", color:"#e6b3ff", count:1, size:34, speed:250, effect:"impact" },
    shatter: { kind:"shockwave", color:"#9bc6ff", count:1, size:76, speed:360, effect:"shock" },
    "piercing thrust": { kind:"lance", color:"#dcefff", count:1, size:28, speed:720 },
    "quick jab": { kind:"jab", color:"#fff", count:1, size:18, speed:760 },
    "aimed shot": { kind:"arrow", color:"#e6d6a8", count:1, size:20, speed:720, effect:"focus" },
    volley: { kind:"arrow", color:"#e6d6a8", count:3, size:18, speed:680, spread:.08 },
    "executioner swing": { kind:"arc", color:"#fff1d0", count:1, size:92, speed:230, effect:"impact" },
    whirlwind: { kind:"ring", color:"#cfd8ff", count:2, size:64, speed:300, effect:"vortex" },
    "arcane bolt": { kind:"bolt", color:"#b07cff", count:1, size:24, speed:620, effect:"arcane" },
    "mana siphon": { kind:"siphon", color:"#b86cff", count:1, size:24, speed:390, effect:"siphon" },
    "precision cut": { kind:"slash", color:"#e9f7ff", count:1, size:36, speed:620, effect:"focus" },
    "rending slash": { kind:"slash", color:"#ff5b69", count:1, size:52, speed:470, effect:"blood" },
    "flame slash": { kind:"arc", color:"#ff7a45", count:1, size:58, speed:430, effect:"fire" },
    "inferno strike": { kind:"fireball", color:"#ff7a45", count:1, size:34, speed:360, effect:"inferno" },
    "soul reap": { kind:"soul", color:"#b07cff", count:1, size:30, speed:410, effect:"soul" },
    "grim embrace": { kind:"arc", color:"#6f4fa8", count:1, size:84, speed:240, effect:"void" }
  };
  function point(x,y){
    const cv=document.querySelector("#rtBattle canvas"); if(!cv)return null;
    const r=cv.getBoundingClientRect(), sc=Math.min(r.width*.96/FW,r.height*.86/FH), cx=r.left+r.width/2, oy=r.top+r.height*.07, d=.72+.28*(y/FH);
    return {x:cx+(x-FW/2)*sc*d,y:oy+y*sc};
  }
  function spawn(name,fight){
    if(!fight||!document.getElementById("rtBattle"))return;
    const target=fight.enemies?.[fight.target]||fight.enemies?.find(e=>e.hp>0); if(!target)return;
    const meta=META[name]||{kind:"bolt",color:"#fff",count:1,size:24,speed:520};
    const from={x:FW/2,y:FH-72},to={x:target.x,y:target.y},a=Math.atan2(to.y-from.y,to.x-from.x),dist=Math.hypot(to.x-from.x,to.y-from.y),duration=Math.max(120,Math.min(650,dist/meta.speed*1000));
    for(let i=0;i<meta.count;i++){const off=(i-(meta.count-1)/2)*(meta.spread||0);makeProjectile(meta,from,to,a+off,duration,i);}
  }
  function makeProjectile(meta,from,to,angle,duration,index){
    const start=performance.now(),el=document.createElement("div"),size=Math.max(18,Math.min(110,meta.size));
    el.style.cssText=`position:fixed;left:0;top:0;width:${size}px;height:${size}px;pointer-events:none;z-index:10002;transform-origin:50% 50%;filter:drop-shadow(0 0 8px ${meta.color});`;
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg"); svg.setAttribute("viewBox","0 0 100 100");svg.setAttribute("width","100%");svg.setAttribute("height","100%");svg.style.overflow="visible";
    const path=document.createElementNS("http://www.w3.org/2000/svg","path"),circle=document.createElementNS("http://www.w3.org/2000/svg","circle"),line=document.createElementNS("http://www.w3.org/2000/svg","line");
    if(["arc","slash","slashes"].includes(meta.kind)){path.setAttribute("d",meta.kind==="arc"?"M 12 82 A 62 62 0 0 1 88 18":"M 18 78 L 82 22");path.setAttribute("fill","none");path.setAttribute("stroke",meta.color);path.setAttribute("stroke-width",meta.kind==="arc"?"10":"8");path.setAttribute("stroke-linecap","round");}
    else if(meta.kind==="shockwave"||meta.kind==="ring"){circle.setAttribute("cx","50");circle.setAttribute("cy","50");circle.setAttribute("r",meta.kind==="ring"?"34":"25");circle.setAttribute("fill","none");circle.setAttribute("stroke",meta.color);circle.setAttribute("stroke-width","7");}
    else if(meta.kind==="arrow"){line.setAttribute("x1","8");line.setAttribute("y1","50");line.setAttribute("x2","78");line.setAttribute("y2","50");line.setAttribute("stroke",meta.color);line.setAttribute("stroke-width","7");path.setAttribute("d","M 68 35 L 92 50 L 68 65 Z");path.setAttribute("fill",meta.color);}
    else if(meta.kind==="lance"||meta.kind==="jab"){line.setAttribute("x1","5");line.setAttribute("y1","50");line.setAttribute("x2","95");line.setAttribute("y2","50");line.setAttribute("stroke",meta.color);line.setAttribute("stroke-width",meta.kind==="lance"?"12":"8");line.setAttribute("stroke-linecap","round");}
    else{circle.setAttribute("cx","50");circle.setAttribute("cy","50");circle.setAttribute("r",meta.kind==="hammer"?"32":"25");circle.setAttribute("fill",meta.color);circle.setAttribute("fill-opacity",".9");if(["fireball","soul","bolt","siphon","shadow"].includes(meta.kind))circle.setAttribute("stroke","#fff");}
    [path,circle,line].forEach(n=>{if(n.hasAttribute("d")||n.hasAttribute("cx")||n.hasAttribute("x1"))svg.appendChild(n);});
    el.appendChild(svg);document.getElementById("rtBattle")?.appendChild(el);
    function tick(now){
      const q=Math.min(1,(now-start)/duration),eased=1-Math.pow(1-q,3),x=from.x+(to.x-from.x)*eased,y=from.y+(to.y-from.y)*eased,p=point(x,y);if(!p){el.remove();return;}
      const s=q<.2?.55+q*2.25:1,spin=meta.kind==="ring"?q*Math.PI*2:0;
      el.style.left=`${p.x-size/2}px`;el.style.top=`${p.y-size/2}px`;el.style.opacity=String(q<.15?q/.15:1-Math.max(0,q-.7)/.3);el.style.transform=`rotate(${angle+spin}rad) scale(${s})`;
      if(q<1)requestAnimationFrame(tick);else{if(["shockwave","ring","arc","slash","slashes","fireball","soul","siphon","shadow","hammer"].includes(meta.kind))burst(p,meta);el.remove();}
    }
    requestAnimationFrame(tick);
  }
  function burst(p,meta){
    const el=document.createElement("div"),size=Math.max(30,meta.size*1.5);el.style.cssText=`position:fixed;left:${p.x-size/2}px;top:${p.y-size/2}px;width:${size}px;height:${size}px;border:3px solid ${meta.color};border-radius:50%;pointer-events:none;z-index:10002;filter:drop-shadow(0 0 9px ${meta.color});`;
    document.getElementById("rtBattle")?.appendChild(el);const start=performance.now();function tick(now){const q=Math.min(1,(now-start)/180);el.style.opacity=String(1-q);el.style.transform=`scale(${.55+q*1.3})`;if(q<1)requestAnimationFrame(tick);else el.remove();}requestAnimationFrame(tick);
    special(meta,p);
  }
  function special(meta,p){
    const root=document.getElementById("rtBattle");if(!root)return;
    if(meta.effect==="fire"||meta.effect==="inferno") particleBurst(root,p,meta.color,meta.effect==="inferno"?22:10,meta.effect==="inferno"?150:90);
    if(meta.effect==="shock"||meta.effect==="impact") ringBurst(root,p,meta.color,meta.effect==="impact"?2:3);
    if(meta.effect==="rage") flashText(root,p,"RAGE",meta.color);
    if(meta.effect==="shadow") afterimages(root,p,meta.color);
    if(meta.effect==="poison") particleBurst(root,p,meta.color,12,70);
    if(meta.effect==="focus") flashText(root,p,"PRECISION",meta.color);
    if(meta.effect==="vortex") vortex(root,p,meta.color);
    if(meta.effect==="arcane") particleBurst(root,p,meta.color,16,100);
    if(meta.effect==="siphon") siphon(root,p,meta.color);
    if(meta.effect==="blood") particleBurst(root,p,meta.color,14,85);
    if(meta.effect==="soul") soulBurst(root,p,meta.color);
    if(meta.effect==="void") voidBurst(root,p,meta.color);
  }
  function particleBurst(root,p,color,n,spread){
    for(let i=0;i<n;i++){const a=Math.random()*TAU,dist=20+Math.random()*spread,size=3+Math.random()*5,el=document.createElement("div"),st=performance.now();el.style.cssText=`position:fixed;left:${p.x}px;top:${p.y}px;width:${size}px;height:${size}px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};pointer-events:none;z-index:10003;`;
      root.appendChild(el);function tick(now){const q=Math.min(1,(now-st)/420);el.style.transform=`translate(${Math.cos(a)*dist*q}px,${Math.sin(a)*dist*q}px) scale(${1-q*.7})`;el.style.opacity=String(1-q);if(q<1)requestAnimationFrame(tick);else el.remove();}requestAnimationFrame(tick);}
  }
  function ringBurst(root,p,color,n){for(let i=0;i<n;i++){const el=document.createElement("div"),size=35+i*22,st=performance.now();el.style.cssText=`position:fixed;left:${p.x-size/2}px;top:${p.y-size/2}px;width:${size}px;height:${size}px;border:3px solid ${color};border-radius:50%;box-shadow:0 0 12px ${color};pointer-events:none;z-index:10003;`;root.appendChild(el);function tick(now){const q=Math.min(1,(now-st)/(240+i*50));el.style.transform=`scale(${.4+q*1.5})`;el.style.opacity=String(1-q);if(q<1)requestAnimationFrame(tick);else el.remove();}requestAnimationFrame(tick);}}
  function flashText(root,p,text,color){const el=document.createElement("div");el.textContent=text;el.style.cssText=`position:fixed;left:${p.x}px;top:${p.y-45}px;color:${color};font:900 18px monospace;text-shadow:0 0 10px ${color};pointer-events:none;z-index:10003;`;root.appendChild(el);const st=performance.now();function tick(now){const q=Math.min(1,(now-st)/500);el.style.transform=`translate(-50%,-${q*35}px) scale(${1+q*.2})`;el.style.opacity=String(1-q);if(q<1)requestAnimationFrame(tick);else el.remove();}requestAnimationFrame(tick);}
  function afterimages(root,p,color){for(let i=0;i<4;i++){const el=document.createElement("div"),size=30+i*8,st=performance.now();el.style.cssText=`position:fixed;left:${p.x-size/2}px;top:${p.y-size/2}px;width:${size}px;height:${size}px;border:2px solid ${color};border-radius:50%;pointer-events:none;z-index:10002;`;root.appendChild(el);setTimeout(()=>el.remove(),180+i*60);}}
  function vortex(root,p,color){for(let i=0;i<10;i++){const el=document.createElement("div"),st=performance.now();el.style.cssText=`position:fixed;left:${p.x}px;top:${p.y}px;width:5px;height:5px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};pointer-events:none;z-index:10003;`;root.appendChild(el);const a=i*TAU/10;function tick(now){const q=Math.min(1,(now-st)/500),r=15+q*60;el.style.transform=`translate(${Math.cos(a+q*TAU*2)*r}px,${Math.sin(a+q*TAU*2)*r}px)`;el.style.opacity=String(1-q);if(q<1)requestAnimationFrame(tick);else el.remove();}requestAnimationFrame(tick);}}
  function siphon(root,p,color){const el=document.createElement("div");el.textContent="✦";el.style.cssText=`position:fixed;left:${p.x}px;top:${p.y}px;color:${color};font:900 32px serif;text-shadow:0 0 12px ${color};pointer-events:none;z-index:10003;`;root.appendChild(el);const st=performance.now();function tick(now){const q=Math.min(1,(now-st)/600);el.style.transform=`translate(-50%,-${q*65}px) rotate(${q*2}rad)`;el.style.opacity=String(1-q);if(q<1)requestAnimationFrame(tick);else el.remove();}requestAnimationFrame(tick);}
  function soulBurst(root,p,color){particleBurst(root,p,color,18,110);flashText(root,p,"SOUL",color);}
  function voidBurst(root,p,color){ringBurst(root,p,color,4);particleBurst(root,p,color,20,140);}
  window.SkillProjectiles={spawn};
})();