/* 世界地图与版本迁移；原地图整体右移1280，迁移只作用于旧快照。 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DuckWorld=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const width=5120,height=3040,version=5,legacyOffset=1280,viewport=Object.freeze({width:1280,height:760});
  const bounds=Object.freeze({left:44,right:width-44,top:70,bottom:height-44});
  const ponds=Object.freeze([Object.freeze({x:1499,y:914,width:842,height:452,radius:125}),Object.freeze({x:1499,y:1674,width:842,height:452,radius:125})]);
  const ocean=Object.freeze({x:4352,y:760,width:768,height:1520});
  const shelters=Object.freeze(Array.from({length:80},(_,i)=>Object.freeze({x:256+(i%10)*512,y:i<20?192+Math.floor(i/10)*384:952+Math.floor((i-20)/10)*384,radius:80})));
  const itemCaps=Object.freeze({med:24,speed:16,gun:8,potion:8}),mineCaps=Object.freeze({water:24,land:24}),breadCap=40;
  const specialItemCaps=Object.freeze({sniper:4,omen:1,staff:4,teleport:1,revive:1,summon:1});
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function isWater(p){return p.x>=ocean.x&&p.y>=ocean.y&&p.y<ocean.y+ocean.height||ponds.some(r=>Math.hypot(p.x-clamp(p.x,r.x+r.radius,r.x+r.width-r.radius),p.y-clamp(p.y,r.y+r.radius,r.y+r.height-r.radius))<=r.radius);}
  function sheltered(p){return shelters.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<=q.radius);}
  function contains(p){return !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=bounds.left&&p.x<=bounds.right&&p.y>=bounds.top&&p.y<=bounds.bottom;}
  function region(p){if(p.y>=2280)return '极光冰川';if(p.y<760)return '金色沙漠';if(p.x<1280)return '火山原野';if(p.x>=4352)return '蔚蓝海洋';if(p.x>=3840)return '海岸沙滩';return p.y<1520?(p.x<2560?'青苔池塘':'松果树林'):(p.x<2560?'睡莲池塘':'贝壳沙滩');}
  function camera(p){return {x:clamp(p.x-viewport.width/2,0,width-viewport.width),y:clamp(p.y-viewport.height/2,0,height-viewport.height),...viewport};}
  // 药水天气保存实际命中者；目标死亡后留在最后记录位置，不转追施法者。
  function weatherTarget(s){const w=s.combat.weather,r=w?.potionTarget;if(r){const a=r.kind==='duck'?s.duck:r.kind==='goose'?s.goose:[...(s.combat.octopuses||[]),...(s.combat.desert?.monsters||[]),...(s.combat.bears||[]),...(s.combat.godzillas||[])].find(m=>m.id===r.id);if(a?.hp>0){r.x=a.x;r.y=a.y;}return r;}return w?.omenTargetGoose?s.goose:s.role==='goose'?s.goose:s.duck;}
  function migrateSave(raw){
    if(!raw||typeof raw!=='object')return raw;const d=JSON.parse(JSON.stringify(raw)),v=d.mapVersion||1;if(v>=version)return d;
    function shift(dx,dy){const seen=new Set(),move=p=>{if(p&&typeof p==='object'&&!seen.has(p)){seen.add(p);if(Number.isFinite(p.x))p.x+=dx;if(Number.isFinite(p.y))p.y+=dy;if(Number.isFinite(p.targetX))p.targetX+=dx;if(Number.isFinite(p.targetY))p.targetY+=dy;}};
      for(const p of [d.duck,d.goose,d.battle?.duck,d.battle?.goose,...(d.bread||[])])move(p);const c=d.battle?.combat;if(c){for(const k of ['items','mines','bullets','potionShots','clones','cannons','cannonShots','octopuses','godzillas','bossShots'])for(const p of c[k]||[])move(p);for(const g of c.godzillas||[])if(g.beam){move(g.beam);g.beam.tx+=dx;g.beam.ty+=dy;}move(c.netTarget);const w=c.weather;if(w){for(const k of ['center','target','giantMeteor','potionTarget'])move(w[k]);for(const v of w.vortices||[]){move(v.center);move(v.target);move(v.staffTarget);}move(w.staffTarget);for(const r of Object.values(w.staffTargets||{}))move(r);for(const k of ['strikes','meteors','rocks','lava'])for(const p of w[k]||[])move(p);}if(c.desert){for(const p of [...(c.desert.monsters||[]),...(c.desert.shots||[])])move(p);}}}
    if(v<3)shift(legacyOffset,0);if(v<4)shift(0,760);d.mapVersion=version;return d;
  }
  return Object.freeze({weatherTarget,version,legacyOffset,width,height,viewport,bounds,ponds,ocean,shelters,itemCaps,specialItemCaps,mineCaps,breadCap,isWater,sheltered,contains,region,camera,migrateSave});
});
