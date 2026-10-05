/* Generic arcade projectile system. Player shots launch straight upward, then use configurable patterns. */
(function(){
  const API = {};
  const active = [];
  const TAU = Math.PI * 2;

  function nearest(x,y){
    const f = window.rtBattle;
    const es = f?.enemies || [];
    let best=null, bd=Infinity;
    for(const e of es){
      if(!e || e.dead) continue;
      const ex=Number(e.x), ey=Number(e.y);
      if(!Number.isFinite(ex)||!Number.isFinite(ey)) continue;
      const d=(ex-x)*(ex-x)+(ey-y)*(ey-y);
      if(d<bd){bd=d;best=e;}
    }
    return best;
  }

  function spawn(x,y,opts={}){
    const count=Math.max(1,Math.floor(opts.count??1));
    const spread=Number(opts.spread??0);
    const speed=Math.max(1,Number(opts.speed??320));
    for(let i=0;i<count;i++){
      const offset=count===1?0:(i-(count-1)/2)*spread;
      active.push({
        x,y,vx:Math.sin(offset)*speed,vy:-Math.cos(offset)*speed,
        speed,turn:Number(opts.turnRate??4.5),slowDistance:Number(opts.slowDistance??70),
        slowAmount:Number(opts.slowAmount??.55),life:Number(opts.lifetime??3),
        radius:Number(opts.radius??5),pattern:opts.pattern||"home",target:null,
        orbit:Number(opts.orbit??0),orbitAngle:Math.atan2(-1,0)+offset,
        weave:Number(opts.weave??0),weaveRate:Number(opts.weaveRate??7),phase:i*.8,
        split:Number(opts.split??0),splitDone:false,color:opts.color||"#fff",damage:Number(opts.damage??1)
      });
    }
  }

  API.spawn=spawn;
  API.patterns={
    straight:()=>({pattern:"straight"}),
    home:()=>({pattern:"home",turnRate:5,slowDistance:75,slowAmount:.5}),
    spread:(count=3)=>({pattern:"home",count,spread:.22,turnRate:4.5}),
    burst:(count=8)=>({pattern:"home",count,spread:TAU/count,turnRate:3.5}),
    orbit:()=>({pattern:"orbit",orbit:45,turnRate:4}),
    weave:()=>({pattern:"weave",weave:35,weaveRate:8,turnRate:3.5}),
    boomerang:()=>({pattern:"boomerang",turnRate:7,lifetime:2.4}),
    split:()=>({pattern:"split",split:2,turnRate:4})
  };

  function update(dt){
    for(let i=active.length-1;i>=0;i--){
      const b=active[i]; b.life-=dt;
      if(b.life<=0){active.splice(i,1);continue;}
      const target=nearest(b.x,b.y);
      if(target) b.target=target;
      const tx=b.target?.x, ty=b.target?.y;
      if(Number.isFinite(tx)&&Number.isFinite(ty)&&b.pattern!=="straight"){
        const desired=Math.atan2(ty-b.y,tx-b.x);
        let cur=Math.atan2(b.vy,b.vx);
        let d=Math.atan2(Math.sin(desired-cur),Math.cos(desired-cur));
        let turn=b.turn*dt;
        cur+=Math.max(-turn,Math.min(turn,d));
        const dist=Math.hypot(tx-b.x,ty-b.y);
        const factor=dist<b.slowDistance ? Math.max(b.slowAmount,dist/b.slowDistance) : 1;
        b.speed=Math.max(70,b.speed*0.98 + (Number(b._baseSpeed)||b.speed)*0.02)*factor;
        b.vx=Math.cos(cur)*b.speed; b.vy=Math.sin(cur)*b.speed;
      }
      if(b.pattern==="weave"){
        const nx=-b.vy, ny=b.vx, n=Math.hypot(nx,ny)||1;
        const w=Math.sin(performance.now()/1000*b.weaveRate+b.phase)*b.weave;
        b.x+=nx/n*w*dt; b.y+=ny/n*w*dt;
      }
      if(b.pattern==="orbit"&&b.target){
        b.orbitAngle+=2.8*dt;
        const ox=b.target.x+Math.cos(b.orbitAngle)*b.orbit;
        const oy=b.target.y+Math.sin(b.orbitAngle)*b.orbit;
        const a=Math.atan2(oy-b.y,ox-b.x); b.vx=Math.cos(a)*b.speed; b.vy=Math.sin(a)*b.speed;
      }
      if(b.pattern==="boomerang"&&b.life<1.2){
        const a=Math.atan2(-b.y+520,200-b.x);
        b.vx=Math.cos(a)*b.speed; b.vy=Math.sin(a)*b.speed;
      }
      b.x+=b.vx*dt; b.y+=b.vy*dt;
      if(b.x<0||b.x>400||b.y<-40||b.y>560) active.splice(i,1);
    }
  }
  API.update=update;
  API.get=()=>active;
  window.ArcadeProjectiles=API;
})();
