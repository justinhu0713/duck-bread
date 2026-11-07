/* 战斗规则独立于画布，浏览器和 Node 测试使用同一份实现。 */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./world.js'):root.DuckWorld,typeof module==='object'&&module.exports?require('./disasters.js'):root.DuckDisasters,typeof module==='object'&&module.exports?require('./flood.js'):root.DuckFlood,typeof module==='object'&&module.exports?require('./desert.js'):root.DuckDesert,typeof module==='object'&&module.exports?require('./glacier.js'):root.DuckGlacier,typeof module==='object'&&module.exports?require('./godzilla.js'):root.DuckGodzilla,typeof module==='object'&&module.exports?require('./boss-skills.js'):root.DuckBossSkills,typeof module==='object'&&module.exports?require('./factions.js'):root.DuckFactions);if(typeof module==='object'&&module.exports)module.exports=api;else root.DuckCombat=api;})(typeof globalThis!=='undefined'?globalThis:this,function(M,D,F,S,G,Z,R,A){
  'use strict';
  const B=M.bounds,OMEN_RANGE=900,TOTAL_LEVELS=40;
  const shotRange=p=>p.maxDistance??450;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const copy=x=>JSON.parse(JSON.stringify(x));
  const player=s=>s.role==='goose'?s.goose:s.duck;
  const enemy=s=>s.role==='goose'?s.duck:s.goose;
  const coopActive=F.coopActive;
  // 生存倒计时冻结时，伤害保护和电脑观察仍使用持续前进的战斗时钟。
  const clock=s=>s.elapsed+(s.combat.coopTime||0);
  function syncCoop(s,preserveSavedFreeze=false){const c=s.combat,active=coopActive(s);if(active&&!c.cooperating){
    c.bullets=c.bullets.filter(b=>b.targetId!==undefined);c.potionShots=c.potionShots.filter(p=>p.targetId!==undefined);c.cannonShots=[];
    c.root=0;c.netWindup=0;c.netTarget=null;
    for(const a of [s.duck,s.goose]){a.poisonTime=0;a.poisonTick=0;a.stun=0;if(!preserveSavedFreeze)a.freezeTime=0;a.slowTime=0;a.staffPoisonTime=0;a.staffPoisonTick=0;}
    notice(s,'临时合作：哥斯拉、北极熊、沙虫或章鱼存活，生存倒计时暂停，双方停战，共同对付怪物！');
  }else if(!active&&c.cooperating)notice(s,'合作首领已消灭，恢复对抗与剩余倒计时；道具召唤的首领不会触发合作。');c.cooperating=active;return active;}
  const isWater=(p,s)=>F.active(s)||M.isWater(p);
  const advanced=s=>s.difficulty==='hard'||s.difficulty==='hell';
  const staffWeatherRef=(s,a)=>({kind:a===s.duck?'duck':a===s.goose?'goose':'monster',...(a.id!==undefined?{id:a.id}:{}),x:a.x,y:a.y});
  const weatherRefActor=(s,r)=>!r?null:r.kind==='duck'?s.duck:r.kind==='goose'?s.goose:F.monsters(s).find(m=>m.id===r.id);
  const resolveWeatherRef=(s,r)=>{const a=weatherRefActor(s,r);return a?.hp>0?a:r;};
  const weatherTarget=(s,kind)=>{const r=s.combat.weather?.staffTargets?.[kind];return r?resolveWeatherRef(s,r):M.weatherTarget(s);};
  const weatherTracking=(s,kind)=>!!s.combat.weather?.staffTargets?.[kind]||advanced(s)||!!s.combat.weather?.potionTarget||s.combat.weather?.omenTargetGoose===true;
  const windTarget=(s,v)=>v.staffTarget?resolveWeatherRef(s,v.staffTarget):weatherTarget(s);
  const windTracking=(s,v)=>!!v.staffTarget||weatherTracking(s);
  const hellGooseAI=s=>s.difficulty==='hell'&&s.role==='duck';
  const hardGooseAI=s=>s.difficulty==='hard'&&s.role==='duck';
  const gooseSpeed=s=>hellGooseAI(s)?1.3:hardGooseAI(s)?1.21:advanced(s)?1.1:1;
  const gooseDamage=s=>hellGooseAI(s)?(s.combat.gooseRevived?2:1):hardGooseAI(s)?2:1;
  const gooseDamageCap=s=>hellGooseAI(s)?50:hardGooseAI(s)?100:advanced(s)?300:s.role==='goose'?400:200;
  const duckSpeed=s=>advanced(s)?1.1:1;
  const duckCooldown=s=>advanced(s)?.5:1;
  const duckDamage=s=>advanced(s)?2:1;
  const gooseCooldown=s=>hellGooseAI(s)?.7:hardGooseAI(s)?.64:advanced(s)?.8:1;
  const controlled=a=>a.stun>0||a.freezeTime>0;
  const gooseMemory=new WeakMap();
  function init(s,rng=Math.random){
    gooseMemory.delete(s);
    s.difficulty=['hard','hell'].includes(s.difficulty)?s.difficulty:'normal';s.balanceVersion=4;
    s.role=s.role==='goose'?'goose':'duck';
    Object.assign(s.duck,{hp:(advanced(s)?(s.role==='goose'?100:30):10)*(s.difficulty==='hell'?2:1),maxHp:(advanced(s)?(s.role==='goose'?100:30):10)*(s.difficulty==='hell'?2:1),haste:0,ammo:0,fireCooldown:0,potions:0,potionCooldown:0,moving:false,staffCharges:0,staffCooldown:0,freezeTime:0,slowTime:0,staffPoisonTime:0,staffPoisonTick:0,healTime:0,venomTime:0,venomTick:0,stun:0,poisonTime:0,poisonTick:0,potionInvulnerable:0,sniperAmmo:0,weapon:'pistol',omenArmed:false,teleports:0,reviveCharges:0});
    Object.assign(s.goose,{hp:hellGooseAI(s)?6000:hardGooseAI(s)?2250:advanced(s)?750:1000,maxHp:hellGooseAI(s)?6000:hardGooseAI(s)?2250:advanced(s)?750:1000,haste:0,ammo:0,fireCooldown:0,potions:0,potionCooldown:0,moving:false,staffCharges:0,staffCooldown:0,freezeTime:0,slowTime:0,staffPoisonTime:0,staffPoisonTick:0,healTime:0,venomTime:0,venomTick:0,stun:0,poisonTime:0,poisonTick:0,potionInvulnerable:0,sniperAmmo:0,weapon:'pistol',omenArmed:false,teleports:0,reviveCharges:0});
    s.combat={mineDeaths:{},gooseItemRevived:false,gooseItemReviveTime:0,duckRevived:false,duckReviveTime:0,coopTime:0,cooperating:false,gooseBlinkCooldown:0,gooseSprintCooldown:0,gooseSprintTime:0,gooseBlinkFlash:0,gooseReviveTime:0,gooseShieldTime:0,gooseShieldCooldown:0,gooseRevived:false,potionShots:[],deathCause:null,weather:null,gooseArmorTime:0,gooseArmorCooldown:0,cloneTime:0,cloneCooldown:0,clones:[],root:0,invulnerable:0,armorTime:0,armorCooldown:0,attackCooldown:0,netCooldown:4*gooseCooldown(s),netWindup:0,netTarget:null,damageLog:[],items:[],mines:[],bullets:[],effects:[],events:[],audioEvents:[],spawnTimer:4};
    F.init(s.combat);S.init(s.combat);G.init(s.combat);Z.init(s.combat);for(let i=0;i<8;i++)replenish(s,rng,i===0);return s;
  }
  // 老存档没有半径/预警元数据时沿用旧规则，避免读档瞬间扩大危险圈。
  const meteorRadius=m=>m.radius??(m.kind==='meteor'?70:55);
  const meteorThreat=(s,a)=>D.circles(s.combat.weather).some(m=>m.unblockable&&dist(a,m)<=m.r)||!!s.combat.weather?.meteors?.some(m=>!m.hit&&m.delay<=.7&&dist(a,m)<=meteorRadius(m)+12);
  function meteorLanding(s,kind,index,placed,rng){
    const target=weatherTarget(s,kind),tracking=weatherTracking(s,kind),minGap=tracking?240:320;
    const bounds=tracking?{left:Math.max(B.left,target.x-480),right:Math.min(B.right,target.x+480),top:Math.max(B.top,target.y-480),bottom:Math.min(B.bottom,target.y+480)}:B;
    const clearance=p=>placed.length?Math.min(...placed.map(m=>dist(p,m))):Infinity;
    const offsets=[[0,0],[-360,0],[360,0],[0,-360],[0,360]];
    if(tracking){const [dx,dy]=kind==='shower'?offsets[index]:offsets[0],p={x:clamp(target.x+dx,B.left,B.right),y:clamp(target.y+dy,B.top,B.bottom)};if(kind==='meteor'||clearance(p)>=minGap)return p;}
    else for(let i=0;i<32;i++){const p={x:B.left+rng()*(B.right-B.left),y:B.top+rng()*(B.bottom-B.top)};if(kind==='meteor'||clearance(p)>=minGap)return p;}
    // 角落或随机源重复时选最分散的落点，不把五颗流星压在一起。
    let best=null,score=-Infinity;for(let y=0;y<=6;y++)for(let x=0;x<=6;x++){const p={x:bounds.left+x*(bounds.right-bounds.left)/6,y:bounds.top+y*(bounds.bottom-bounds.top)/6},value=clearance(p);if(value>score){score=value;best=p;}}
    return best;
  }
  // 预警期沿用灾害数据推导安全边界，无需额外存档状态。
  function giantRouteSafe(s,from,to){const h=D.circles(s.combat.weather).find(p=>p.unblockable);if(!h)return true;const initial=dist(from,h);return initial<h.r?dist(to,h)>initial+1e-8:segmentDistance(h,from,to)>=h.r-1e-8;}
  const vortices=s=>s.combat.weather?.vortex?[s.combat.weather,...(s.combat.weather.vortices||[])]:[];
  function addVortex(s,p,staffTarget=null){const w=s.combat.weather;if(!w)return false;const data={vortex:true,center:{x:clamp(p.x,B.left,B.right),y:clamp(p.y,B.top,B.bottom)},target:null,vortexWarning:advanced(s)?.9:0,vortexTimer:1,...(staffTarget?{staffTarget:copy(staffTarget)}:{}),...(w.itemWeather?{itemWeather:true}:{})};
    if(!w.vortex){Object.assign(w,data);return true;}w.vortices=w.vortices||[];if(w.vortices.length>=7)w.vortices.shift();w.vortices.push(data);return true;
  }
  function ensureVortices(s,rng=Math.random){if(!s.combat.weather?.vortex)return;for(let i=0;i<16&&vortices(s).length<3;i++){const p={x:B.left+rng()*(B.right-B.left),y:B.top+rng()*(B.bottom-B.top)};if(vortices(s).every(v=>dist(v.center,p)>350))addVortex(s,p);}for(const p of [{x:650,y:600},{x:4200,y:1800},{x:3500,y:400},{x:800,y:2000}]){if(vortices(s).length>=3)break;if(vortices(s).every(v=>dist(v.center,p)>350))addVortex(s,p);}}
  const monsterCircles=s=>[...F.circles(s).filter(m=>m.kind!=='bear'),...G.bearCircles(s),...Z.circles(s)];
  function bearDefense(s,a){if(a===player(s)||s.phase!=='playing'||a.hp<=0||!coopActive(s)||(a===s.duck?s.combat.armorTime:s.combat.gooseArmorTime)>0)return false;const imminent=(s.combat.bears||[]).some(b=>b.hp>0&&dist(a,b)<=205&&(a.freezeTime>0||Math.max(b.stun||0,b.freezeTime||0)<=.15&&(b.freezeCooldown||0)<=.15));return imminent?armor(s,a):false;}
  function weatherDanger(s,actor,includeMonsters=true){
    const w=s.combat.weather,monsters=includeMonsters&&(monsterCircles(s).some(m=>dist(actor,m)<m.r)||S.threat(s,actor));if(!w)return !!monsters;
    return R.incoming(s,actor,.8).length>0||Z.danger(s,actor)||monsters||D.danger(w,actor)||!!(vortices(s).some(v=>dist(actor,v.center)<240)||(w.strikes||[]).some(b=>!b.hit&&dist(actor,b)<78)||(w.meteors||[]).some(m=>!m.hit&&dist(actor,m)<meteorRadius(m)+35));
  }
  function weatherEscape(s,actor,speed){
    if(!weatherDanger(s,actor)&&!D.tsunamiThreat(s.combat.weather,actor))return null;
    const w=s.combat.weather||{},duck=actor===s.duck,shots=[...S.incoming(s,actor,1.2),...R.incoming(s,actor,1.2)];
    const shelter=D.shelterGoal(s,actor,speed,p=>!weatherDanger(s,p)&&s.combat.mines.every(m=>dist(m,p)>50));
    if(shelter&&dist(actor,shelter)<=65&&!weatherDanger(s,actor))return {x:0,y:0};
    const zones=[...monsterCircles(s),...S.circles(s),...D.circles(w).map(p=>({...p,r:p.r,lightning:p.damage===Infinity})),...(w.strikes||[]).filter(m=>!m.hit).map(m=>({...m,r:55,damage:Infinity,lightning:true,delay:advanced(s)&&m.tracking?m.delay:0})),...(w.meteors||[]).filter(m=>!m.hit).map(m=>({...m,r:meteorRadius(m),damage:m.kind==='meteor'?150:75}))];
    // 锁定自己的吐息会随移动转向；预测时按整个有效射程评估，不能把侧移误判为脱离。
    for(const g of s.combat.godzillas||[]){const b=g.beam;if(g.hp<=0||!b||b.hit||b.target!==(duck?'duck':'goose'))continue;for(let i=zones.length-1;i>=0;i--)if(zones[i].atomicSource===g.id)zones.splice(i,1);zones.push({x:g.x,y:g.y,r:Z.range,delay:b.delay,damage:100000});}
    const winds=vortices(s),windAt=(v,t)=>{const center=v.center,goal=windTracking(s,v)?windTarget(s,v):v.target||center,gap=dist(center,goal),travel=Math.min(gap,35*Math.max(0,t-(v.vortexWarning||0)));return {x:center.x+(goal.x-center.x)/(gap||1)*travel,y:center.y+(goal.y-center.y)/(gap||1)*travel};};
    const mineTrigger=duck?29:33,armor=duck?s.combat.armorTime:s.combat.gooseArmorTime;
    const remainingBudget=Math.max(0,gooseDamageCap(s)-s.combat.damageLog.filter(x=>clock(s)-x.at<5).reduce((sum,x)=>sum+x.amount,0));
    const horizon=1.2,times=[...Array.from({length:12},(_,i)=>(i+1)/10),...zones.map(m=>m.delay).filter(t=>t>=0&&t<=horizon)].sort((a,b)=>a-b);
    // Wind positions are identical for every candidate route. Predict them once per sample.
    const windSamples=times.map(t=>winds.map(v=>windAt(v,t)));
    const finalWinds=winds.map(v=>windAt(v,horizon));
    // Even with every vortex pulling at full force, farther mines cannot touch this route.
    const mineReach=(speed+150*winds.length)*horizon+mineTrigger;
    const nearbyMines=s.combat.mines.filter(m=>Math.abs(m.x-actor.x)<=mineReach&&Math.abs(m.y-actor.y)<=mineReach);
    let best=null,bestScore=-Infinity;
    const angles=Array.from({length:64},(_,i)=>i*Math.PI/32);if(shelter)angles.push(Math.atan2(shelter.y-actor.y,shelter.x-actor.x));
    for(const angle of angles){
      const dir={x:Math.cos(angle),y:Math.sin(angle)};
      // 已在避难点时保留边缘余量，躲弹也不能踏出致命天气的安全圈。
      if(shelter&&M.sheltered(actor)&&Math.hypot(actor.x+dir.x*speed*.05-shelter.x,actor.y+dir.y*speed*.05-shelter.y)>75)continue;
      const seen=new Set(),seenMines=new Set(),seenWind=new Set(),seenShots=new Set();
      let pos={x:actor.x,y:actor.y},previousTime=0,hp=actor.hp,budget=remainingBudget,loss=0,bufferRisk=0,windExposure=0;
      function incoming(amount,t,lightning=false,unblockable=false){
        if(!unblockable&&((actor.potionInvulnerable||0)>t||!duck&&hellGooseAI(s)&&s.combat.gooseShieldTime>t||duck&&((s.combat.duckReviveTime||0)>t||!lightning&&s.combat.invulnerable>t)))return;
        const damage=lightning?hp:duck?Math.min(hp,amount):Math.min(hp,budget,reduceDamage(s,actor,amount));hp-=damage;loss+=damage;if(!duck&&!lightning)budget-=damage;
      }
      for(let sample=0;sample<times.length;sample++){
        const t=times[sample],dt=t-previousTime;if(dt<0)continue;const start={...pos},step=shelter&&dist(pos,shelter)<=65?0:speed*dt;pos.x=clamp(pos.x+dir.x*step,B.left,B.right);pos.y=clamp(pos.y+dir.y*step,B.top,B.bottom);
        for(let wi=0;wi<winds.length;wi++){const v=winds[wi],wind=windSamples[sample][wi],gap=dist(pos,wind),active=t>(v.vortexWarning||0);
          if(active&&gap>0&&gap<210&&!(armor>t)){const pull=Math.min(gap,(40+110*(1-gap/210))*dt);pos.x+=(wind.x-pos.x)/gap*pull;pos.y+=(wind.y-pos.y)/gap*pull;}
          const currentGap=dist(pos,wind);windExposure+=Math.max(0,240-currentGap)*dt;
          const firstHit=(v.vortexWarning||0)+v.vortexTimer;
          if(active)for(let k=0;k<2;k++){const hit=firstHit+k;if(hit<=t&&!seenWind.has(wi*2+k)){seenWind.add(wi*2+k);if(hit>=previousTime-1e-8&&currentGap<=65)incoming(50,t);}}
          if(active&&currentGap<=75)bufferRisk+=(75-currentGap)*dt*2;
        }
        for(let j=0;j<zones.length;j++){const m=zones[j];if(!seen.has(j)&&t>=m.delay){seen.add(j);const gap=dist(pos,m);if(gap<=m.r)incoming(m.damage,t,m.lightning,m.unblockable);bufferRisk+=Math.max(0,m.r+14-gap)*(m.lightning?5:1);}}
        for(let j=0;j<shots.length;j++){const p=shots[j];if(previousTime>=p.life)continue;const endTime=Math.min(t,p.life),relativeStart={x:start.x-p.x-p.vx*previousTime,y:start.y-p.y-p.vy*previousTime},relativeEnd={x:pos.x-p.x-p.vx*endTime,y:pos.y-p.y-p.vy*endTime},near=segmentDistance({x:0,y:0},relativeStart,relativeEnd);if(near<(p.radius||11)+25&&!seenShots.has(j)){seenShots.add(j);incoming(p.damage||50,endTime);}bufferRisk+=Math.max(0,75-near)*dt;}
        for(let j=0;j<nearbyMines.length;j++){const m=nearbyMines[j];if(!seenMines.has(j)&&segmentDistance(m,start,pos)<mineTrigger){seenMines.add(j);incoming(m.type==='water'?100:150,t);bufferRisk+=50;}}
        previousTime=t;
      }
      let clearance=Infinity;for(const m of zones)clearance=Math.min(clearance,dist(pos,m)-m.r);
      for(const wind of finalWinds)clearance=Math.min(clearance,dist(pos,wind)-240);
      if(!giantRouteSafe(s,actor,pos))continue;
      const moved=dist(actor,pos),other=duck?s.goose:s.duck;
      const score=-(hp<=0?1e10:0)-loss*1e6-bufferRisk*1000-windExposure*250+Math.min(400,clearance)*3+(duck?Math.min(350,dist(pos,other))*.15:0)+moved*.05-(shelter?Math.max(0,dist(pos,shelter)-65)*500:0);
      if(score>bestScore){bestScore=score;best=dir;}
    }
    return best||{x:0,y:0};
  }
  function ensureFinalBosses(s){
    if(![20,TOTAL_LEVELS].includes(s.level)||s.completed)return;
    const c=s.combat,d=c.desert;
    // Keep defeated records: loading an unfinished final must not resurrect a boss.
    if(!d.monsters.some(m=>m.kind==='worm'&&!m.noCoop))d.monsters.push({id:d.nextId++,kind:'worm',x:4600,y:400,hp:20000,maxHp:20000,attackCooldown:0,rangedCooldown:2});
    if(!c.octopuses.some(m=>!m.noCoop))c.octopuses.push({id:c.nextFloodId++,x:4400,y:1800,hp:10000,maxHp:10000,attackCooldown:0});
    if(!c.bears.some(m=>!m.noCoop))c.bears.push({id:200000,kind:'bear',x:3600,y:2700,hp:20000,maxHp:20000,attackCooldown:0,freezeCooldown:0});
    A.boostAll(s);c.finalBossBattle=true;syncCoop(s);
  }
  function finalBossesDefeated(s){const c=s.combat,w=(c.desert?.monsters||[]).filter(m=>m.kind==='worm'&&!m.noCoop),octopuses=c.octopuses.filter(m=>!m.noCoop),bears=c.bears.filter(m=>!m.noCoop);return [20,TOTAL_LEVELS].includes(s.level)&&w.length>0&&octopuses.length>0&&bears.length>0&&[...w,...octopuses,...bears].every(m=>m.hp<=0)&&Z.afterTrio(s);}
  function configureLevel(s,level=1,rng=Math.random){
    s.level=clamp(Math.floor(level)||1,1,TOTAL_LEVELS);
    let vortex=rng()<.3,lightning=rng()<.3;
    if((s.level===5||s.level===10)&&!vortex&&!lightning){if(rng()<.5)vortex=true;else lightning=true;}
    const center=vortex?{x:B.left+rng()*(B.right-B.left),y:B.top+rng()*(B.bottom-B.top)}:{x:640,y:380};
    if(vortex&&advanced(s)){center.x=player(s).x;center.y=player(s).y;}
    const meteor=rng()<.3,meteorShower=rng()<.1;
    s.combat.weather={meteor,meteorShower,meteorTimer:5,showerTimer:8,meteors:[],vortexWarning:vortex&&advanced(s)?.9:0,center,target:null,vortex,lightning,vortexTimer:1,lightningTimer:1.5,strikes:[],cause:null,itemWeather:false};
    D.defaults(s.combat.weather);s.combat.weather.eruption=rng()<.1;s.combat.weather.tsunami=rng()<.1;if(rng()<.05)s.combat.weather.giantMeteor={x:960+rng()*(M.width-1920),y:M.height/2,radius:960,impactAt:20,hit:false};
    S.configure(s,rng);ensureVortices(s,rng);G.configure(s,rng);Z.configure(s,rng);
    ensureFinalBosses(s);A.boostAll(s);
    syncCoop(s);return s.combat.weather;
  }
  const weatherBossImmune=(s,a,event)=>s.level===20&&a.id!==undefined&&a.kind!=='scorpion'||a.noCoop===true&&!!(event?.itemWeather||event?.staffCaster||event?.staffTarget);
  function tickWeather(s,dt,rng=Math.random){
    const w=s.combat.weather;if(!w)return;
    for(const r of [...Object.values(w.staffTargets||{}),...vortices(s).map(v=>v.staffTarget).filter(Boolean)]){const a=weatherRefActor(s,r);if(a?.hp>0){r.x=a.x;r.y=a.y;}}
    function updateWind(v){let windDt=dt;
    if(v.vortex&&(v.vortexWarning||0)>0){const wait=Math.min(windDt,v.vortexWarning);v.vortexWarning=Math.max(0,v.vortexWarning-wait);windDt-=wait;}
    if(v.vortex&&windDt>0){
      const center=v.center||(v.center={x:640,y:380});
      if(windTracking(s,v)){const a=windTarget(s,v);v.target={x:a.x,y:a.y};}
      else if(!v.target||dist(center,v.target)<.001){
        v.target={x:B.left+rng()*(B.right-B.left),y:B.top+rng()*(B.bottom-B.top)};
        if(dist(center,v.target)<1)v.target={x:center.x>640?B.left:B.right,y:center.y>393?B.top:B.bottom};
      }
      const gapToTarget=dist(center,v.target),travel=Math.min(gapToTarget,35*windDt);
      if(gapToTarget>0){center.x=clamp(center.x+(v.target.x-center.x)/gapToTarget*travel,B.left,B.right);center.y=clamp(center.y+(v.target.y-center.y)/gapToTarget*travel,B.top,B.bottom);}

      for(const a of [s.duck,s.goose]){const gap=dist(a,center);if(a.hp>0&&!(a===s.duck?s.combat.armorTime>0:s.combat.gooseArmorTime>0)&&gap>0&&gap<210){const pull=Math.min(gap,(40+110*(1-gap/210))*windDt);a.x+=(center.x-a.x)/gap*pull;a.y+=(center.y-a.y)/gap*pull;}}
      v.vortexTimer-=windDt;
      while(v.vortexTimer<=0){v.vortexTimer+=1;for(const a of [s.duck,s.goose])if(a.hp>0&&dist(a,center)<=65){if(a===s.duck)damageDuck(s,50);else damageGoose(s,50,Math.max(0,dt+v.vortexTimer-1));if(a.hp<=0)w.cause='vortex';}for(const m of F.monsters(s))if(m.hp>0&&!weatherBossImmune(s,m,v)&&dist(m,center)<=65)F.hurt(m,50);}
    }
    }
    for(const v of vortices(s))updateWind(v);
    // 普通模式瞬发；困难模式锁定玩家附近三处落点，预警结束后同时结算。
    function strike(bolt,at=dt){bolt.hit=true;bolt.delay=.25;s.combat.audioEvents.push('explosion');effect(s,bolt,'闪电！','#8b65bf');for(const a of [s.duck,s.goose])if(a.hp>0&&!immune(s,a,at)&&dist(a,bolt)<=55){killActor(s,a,at);if(a.hp<=0)w.cause='lightning';}for(const m of F.monsters(s))if(m.hp>0&&!weatherBossImmune(s,m,bolt)&&dist(m,bolt)<=55){if(m.kind==='scorpion')m.hp=0;else F.hurt(m,500);}}
    for(let i=w.strikes.length-1;i>=0;i--){const bolt=w.strikes[i];if(!bolt.hit){const at=Math.max(0,bolt.delay);if(!advanced(s)||!bolt.tracking||(bolt.delay-=dt)<=0)strike(bolt,at);}else if((bolt.delay-=dt)<=0)w.strikes.splice(i,1);}
    if(w.lightning){w.lightningTimer-=dt;while(w.lightningTimer<=0){w.lightningTimer+=2.8;for(let i=0;i<3;i++){const hard=advanced(s),tracking=weatherTracking(s,'lightning'),a=weatherTarget(s,'lightning'),bolt={x:tracking?clamp(a.x+(i-1)*80,B.left,B.right):B.left+rng()*(B.right-B.left),y:tracking?a.y:B.top+rng()*(B.bottom-B.top),delay:hard?.9:0,hit:false,tracking:hard,...(w.itemWeather||w.staffTargets?.lightning?{itemWeather:true}:{})};if(!hard)strike(bolt);w.strikes.push(bolt);}}}
    for(let i=(w.meteors||[]).length-1;i>=0;i--){const m=w.meteors[i],at=Math.max(0,m.delay);m.delay-=dt;
      if(!m.hit&&m.delay<=0){m.hit=true;m.delay=.5;s.combat.audioEvents.push('explosion');const radius=meteorRadius(m),damage=m.kind==='meteor'?150:75;
        effect(s,m,m.kind==='meteor'?'流星撞击！':'流星雨撞击！','#c57535');
        for(const actor of [s.duck,s.goose])if(actor.hp>0&&actor!==s[m.staffCaster]&&dist(actor,m)<=radius){if(actor===s.duck)damageDuck(s,damage,at);else damageGoose(s,damage,at);if(actor.hp<=0)w.cause=m.kind;}for(const target of F.monsters(s))if(target.hp>0&&!weatherBossImmune(s,target,m)&&dist(target,m)<=radius)F.hurt(target,target.kind==='scorpion'?damage:100);
      }else if(m.hit&&m.delay<=0)w.meteors.splice(i,1);
    }
    const spawnMeteor=(kind,index=0,placed=[])=>{
      w.meteors=w.meteors||[];if(w.meteors.length>=24)return;
      const tracking=weatherTracking(s,kind),p=meteorLanding(s,kind,index,placed,rng);
      // 将施法者固定在每个落点上，后续施法或天气来源切换不会改写待落流星的归属。
      const m={...p,kind,delay:.8,warningDuration:.8,radius:kind==='meteor'?140:110,hit:false,tracking,...(w.staffTargets?.[kind]?.caster?{staffCaster:w.staffTargets[kind].caster}:{}),...(w.itemWeather?{itemWeather:true}:{})};w.meteors.push(m);placed.push(m);
    };
    if(w.meteor){w.meteorTimer=(w.meteorTimer??5)-dt;while(w.meteorTimer<=0){w.meteorTimer+=5;spawnMeteor('meteor');}}
    if(w.meteorShower){w.showerTimer=(w.showerTimer??8)-dt;while(w.showerTimer<=0){w.showerTimer+=8;const placed=[];for(let i=0;i<5;i++)spawnMeteor('shower',i,placed);}}

    syncClones(s);
  }
  function effect(s,p,label,color='#b75640'){s.combat.effects.push({x:p.x,y:p.y,label,color,life:.8});}
  function notice(s,text){s.combat.events.push(text);}
  function point(s,rng,predicate=()=>true){
    function safe(p){return predicate(p)&&dist(p,s.duck)>100&&dist(p,s.goose)>100&&[...s.combat.items,...s.combat.mines,...(s.bread||[])].every(x=>dist(x,p)>48);}
    for(let i=0;i<60;i++){const p={x:B.left+35+rng()*(B.right-B.left-70),y:B.top+35+rng()*(B.bottom-B.top-70)};if(safe(p))return p;}
    // 极端随机源或拥挤地图时仍可找到安全落点。
    for(let y=B.top+35;y<B.bottom-25;y+=70)for(let x=B.left+35;x<B.right-25;x+=70){const p={x,y};if(safe(p))return p;}
    return null;
  }
  function replenish(s,rng=Math.random,rare=true){
    const omenRoll=rare?rng():1;
    for(const [type,cap] of Object.entries(M.itemCaps)){if(s.combat.items.filter(x=>x.type===type).length<cap){const p=point(s,rng);if(p)s.combat.items.push({...p,type});}}
    for(const type of ['sniper','omen','staff'])if((type!=='omen'||s.combat.omenTrial===true||omenRoll<.01)&&s.combat.items.filter(p=>p.type===type).length<M.specialItemCaps[type]){const p=point(s,rng);if(p)s.combat.items.push({...p,type});}
    for(const [type,cap] of Object.entries(M.mineCaps)){if(s.combat.mines.filter(x=>x.type===type).length<cap){const p=point(s,rng,p=>isWater(p,s)===(type==='water'));if(p)s.combat.mines.push({...p,type,...(type==='water'&&!M.isWater(p)?{floodMine:true}:{})});}}
    if(rare&&rng()<.05&&!s.combat.items.some(p=>p.type==='teleport')){const p=point(s,rng);if(p)s.combat.items.push({...p,type:'teleport'});}
    if(rare&&rng()<.05&&!s.combat.items.some(p=>p.type==='revive')){const p=point(s,rng);if(p)s.combat.items.push({...p,type:'revive'});}
    if(rare&&rng()<.05&&!s.combat.items.some(p=>p.type==='summon')){const p=point(s,rng);if(p)s.combat.items.push({...p,type:'summon'});}
  }
  // 仅由下一把试玩入口调用，常规1%补给逻辑保持独立。
  function spawnTrialOmen(s){
    const a=player(s),c=s.combat;
    const safe=p=>M.contains(p)&&dist(p,a)>35&&dist(p,enemy(s))>100&&!weatherDanger(s,p)&&c.mines.every(m=>dist(m,p)>70)&&c.items.every(m=>m.type==='omen'||dist(m,p)>48)&&(s.bread||[]).every(b=>dist(b,p)>48);
    let location=null;for(const r of [160,240,320]){for(let i=0;i<24;i++){const angle=i*Math.PI/12,p={x:a.x+Math.cos(angle)*r,y:a.y+Math.sin(angle)*r};if(safe(p)){location=p;break;}}if(location)break;}
    if(!location)location=point(s,Math.random,safe);if(!location)return false;
    c.items=c.items.filter(p=>p.type!=='omen');c.items.push({...location,type:'omen'});c.omenTrial=true;return true;
  }
  // 帧内命中按碰撞时刻检查新护盾，避免在最后一帧提前失效；不写入存档。
  const shieldFrames=new WeakMap();
  const gooseImmune=(s,at)=>{const f=shieldFrames.get(s),t=at??f?.dt??0;return (f?f.potions.goose>t:s.goose.potionInvulnerable>0)||(f?f.gooseItemRevive>t||f.gooseItemRevivedAt!==undefined&&t<f.gooseItemRevivedAt+2:s.combat.gooseItemReviveTime>0)||hellGooseAI(s)&&(f?(f.time>t||f.revive>t||f.revivedAt!==undefined&&t<f.revivedAt+2):s.combat.gooseShieldTime>0||s.combat.gooseReviveTime>0);};
  const immune=(s,a,at)=>{const f=shieldFrames.get(s),t=at??f?.dt??0;return a===s.goose?gooseImmune(s,at):(f?f.potions.duck>t:a.potionInvulnerable>0)||(f?f.duckRevive>t||f.duckRevivedAt!==undefined&&t<f.duckRevivedAt+2:s.combat.duckReviveTime>0);};
  const reduceDamage=(s,a,amount)=>amount*(a===s.goose&&hellGooseAI(s)?.5:1);
  function reviveGoose(s,at){
    if(s.goose.hp<=0&&s.goose.reviveCharges>0&&!s.combat.gooseItemRevived&&(!hellGooseAI(s)||s.combat.gooseRevived)){
      const c=s.combat,f=shieldFrames.get(s),when=at??f?.dt??0;if(f)f.gooseItemRevivedAt=when;
      s.goose.reviveCharges=0;c.gooseItemRevived=true;c.gooseItemReviveTime=2;s.goose.hp=Math.ceil(s.goose.maxHp/2);
      for(const k of ['poisonTime','poisonTick','staffPoisonTime','staffPoisonTick','venomTime','venomTick','freezeTime','slowTime','stun'])s.goose[k]=0;
      if(c.mineDeaths)delete c.mineDeaths.goose;c.damageLog=[];c.deathCause=null;if(c.weather)c.weather.cause=null;effect(s,s.goose,'大鹅复活 · 无敌2s','#8a68b1');notice(s,'大鹅消耗复活道具：恢复一半最大生命并无敌2秒，本局无法再次复活。');return true;
    }
    if(!hellGooseAI(s)||s.goose.hp>0||s.combat.gooseRevived)return false;
    const frame=shieldFrames.get(s),when=at??frame?.dt??0;if(frame)frame.revivedAt=when;s.combat.gooseReviveTime=2;
    s.combat.gooseRevived=true;s.goose.hp=Math.ceil(s.goose.maxHp/2);s.goose.poisonTime=0;s.goose.poisonTick=0;s.goose.staffPoisonTime=0;s.goose.staffPoisonTick=0;s.goose.freezeTime=0;s.goose.stun=0;
    if(s.combat.mineDeaths)delete s.combat.mineDeaths.goose;s.combat.damageLog=[];s.combat.deathCause=null;if(s.combat.weather)s.combat.weather.cause=null;
    effect(s,s.goose,'复活！伤害翻倍','#b44666');notice(s,'地狱大鹅复活：恢复一半最大生命，伤害增加 100%！本关无法再次复活。');return true;
  }
  function reviveDuck(s,at){
    if(!(s.duck.reviveCharges>0)||s.duck.hp>0||s.combat.duckRevived)return false;const f=shieldFrames.get(s),when=at??f?.dt??0;if(f)f.duckRevivedAt=when;
    s.duck.reviveCharges=0;s.combat.duckRevived=true;s.combat.duckReviveTime=2;s.duck.hp=Math.ceil(s.duck.maxHp/2);
    for(const k of ['poisonTime','poisonTick','staffPoisonTime','staffPoisonTick','venomTime','venomTick','freezeTime','slowTime','stun'])s.duck[k]=0;
    if(s.combat.mineDeaths)delete s.combat.mineDeaths.duck;s.combat.root=0;s.combat.deathCause=null;if(s.combat.weather)s.combat.weather.cause=null;effect(s,s.duck,'鸭鸭复活 · 无敌2s','#8a68b1');notice(s,'鸭子消耗复活道具：恢复一半最大生命并无敌2秒，本关无法再次复活。');return true;
  }
  function directDamage(s,a,amount,immunityChecked=false,at){if(!immunityChecked&&immune(s,a,at)||a.hp<=0)return 0;const damage=Math.min(a.hp,reduceDamage(s,a,amount));a.hp-=damage;if(a===s.goose)reviveGoose(s,at);else reviveDuck(s,at);return damage;}
  function killActor(s,a,at){if(immune(s,a,at)||a.hp<=0)return;a.hp=0;if(a===s.goose)reviveGoose(s,at);else reviveDuck(s,at);}
  function duckExecute(s){
    if(coopActive(s)||s.phase!=='playing'||s.role!=='goose'||s.duck.hp<=0||s.goose.hp<=0||s.goose.hp>=s.goose.maxHp*.05)return false;
    // 斩杀独立于普通伤害与秒杀判定，直接穿透所有无敌和伤害保护。
    s.goose.hp=0;s.combat.deathCause='execution';if(s.combat.weather)s.combat.weather.cause=null;effect(s,s.goose,'斩杀！','#be4040');notice(s,'电脑鸭子触发斩杀：大鹅生命低于 5%！');reviveGoose(s);return true;
  }
  function gooseShield(s){const c=s.combat;if(!hellGooseAI(s)||s.phase!=='playing'||s.goose.hp<=0||controlled(s.goose)||c.gooseShieldCooldown>0)return false;c.gooseShieldTime=1;c.gooseShieldCooldown=15;effect(s,s.goose,'无敌 · 1s','#c79b24');return true;}
  function damageDuck(s,amount,at){
    if(s.combat.invulnerable>0||immune(s,s.duck,at)||s.duck.hp<=0)return 0;
    const damage=Math.min(amount,s.duck.hp);s.duck.hp-=damage;effect(s,s.duck,'−'+damage);reviveDuck(s,at);return damage;
  }
  function prune(s){s.combat.damageLog=s.combat.damageLog.filter(x=>clock(s)-x.at<5-1e-9);}
  function damageGoose(s,amount,at){
    if(gooseImmune(s,at)||s.goose.hp<=0)return 0;
    prune(s);const budget=Math.max(0,gooseDamageCap(s)-s.combat.damageLog.reduce((n,x)=>n+x.amount,0));
    const damage=Math.min(reduceDamage(s,s.goose,amount),budget,s.goose.hp);
    if(damage>0){s.goose.hp-=damage;s.combat.damageLog.push({at:clock(s),amount:damage});effect(s,s.goose,'−'+damage);reviveGoose(s,at);}
    else if(s.goose.hp>0)effect(s,s.goose,'伤害保护','#5c88a0');
    return damage;
  }
  function beginDash(s){if(s.phase!=='playing'||s.duck.hp<=0||controlled(s.duck)||s.combat.root>0)return false;s.combat.invulnerable=1;effect(s,s.duck,'无敌 1s','#c79b24');return true;}
  function useTeleport(s,actor=player(s),rng=Math.random){
    if(s.phase!=='playing'||actor.hp<=0||controlled(actor)||actor===s.duck&&s.combat.root>0||!(actor.teleports>0))return false;
    effect(s,actor,'传送！','#8b73c9');actor.teleports--;actor.x=B.left+rng()*(B.right-B.left);actor.y=B.top+rng()*(B.bottom-B.top);actor.moving=false;
    if(actor===s.duck)syncClones(s);
    effect(s,actor,'随机瞬移','#8b73c9');if(actor===player(s))notice(s,'瞬移道具已使用，随机传送到地图上的新位置。');return true;
  }
  function aiTeleport(s,a=enemy(s),rng=Math.random){
    const c=s.combat;if(a===player(s)||s.phase!=='playing'||a.hp<=0||controlled(a)||a===s.duck&&c.root>0||!(a.teleports>0))return false;
    const rival=a===s.duck?s.goose:s.duck,owner=a===s.duck?'duck':'goose',hostile=p=>!coopActive(s)&&p.owner!==owner&&p.targetId===undefined;
    const incoming=c.bullets.some(b=>{if(!hostile(b)||b.willHit===false)return false;const end={x:b.x+b.vx*Math.min(.6,b.life),y:b.y+b.vy*Math.min(.6,b.life)};return segmentDistance(a,b,end)<40;});
    const danger=weatherDanger(s,a)||c.mines.some(m=>dist(a,m)<80)||incoming||c.potionShots.some(p=>hostile(p)&&dist(a,p)<180)||!coopActive(s)&&a===s.duck&&rival.hp>0&&dist(a,rival)<140;
    // Preserve the item's uniform random destination: using it is an escape attempt, not a safe-location search.
    return danger?useTeleport(s,a,rng):false;
  }
  function armor(s,actor=player(s)){
    const c=s.combat,goose=actor===s.goose,time=goose?'gooseArmorTime':'armorTime',cooldown=goose?'gooseArmorCooldown':'armorCooldown';
    if(s.phase!=='playing'||actor.hp<=0||(c[cooldown]||0)>0)return false;
    actor.stun=0;actor.freezeTime=0;if(!goose)c.root=0;c[time]=1.5;c[cooldown]=goose?8*gooseCooldown(s):20*duckCooldown(s);
    effect(s,actor,'霸体 · 免控','#4e91b5');notice(s,(goose?'大鹅':'鸭子')+'霸体开启：1.5 秒免控并抵抗风涡拉扯，仍会受到伤害。');return true;
  }
  function syncClones(s){
    const center=clamp(s.duck.x,B.left+62,B.right-62);
    for(const clone of s.combat.clones||[]){clone.x=center+clone.dx;clone.y=clamp(s.duck.y+(s.duck.y>B.bottom-38?-38:38),B.top,B.bottom);clone.face=s.duck.face;clone.moving=!!s.duck.moving;}
  }
  function summonClones(s){
    const c=s.combat;if(s.phase!=='playing'||s.duck.hp<=0||controlled(s.duck)||c.root>0||(c.cloneCooldown||0)>0)return false;
    c.cloneTime=6;c.cloneCooldown=20*duckCooldown(s);c.clones=[-62,62].map(dx=>({dx,x:0,y:0,face:s.duck.face,moving:false,fireFlash:0}));syncClones(s);
    effect(s,s.duck,'双重分身 · 6s','#8873bc');notice(s,'分身出动！两个分身同步移动和射击，每次只消耗本体 1 发子弹。');return true;
  }
  function moveDistance(s,dt,actor=player(s)){
    const held=Math.max(actor.stun||0,actor.freezeTime||0,actor===s.duck?s.combat.root:0),active=Math.max(0,dt-held);
    const buff=Math.max(actor.haste||0,actor===s.duck?s.skill.boost:0);
    const slow=Math.max(0,Math.min(dt,actor.slowTime||0)-held),both=Math.max(0,Math.min(dt,buff,actor.slowTime||0)-held);return (actor===s.duck?215*duckSpeed(s):190*gooseSpeed(s))*(active+.3*Math.max(0,Math.min(dt,buff)-held)-.3*(slow+.3*both));
  }
  function castNet(s){
    const c=s.combat;if(coopActive(s)||s.phase!=='playing'||controlled(s.goose)||c.netCooldown>0||c.netWindup>0||gooseBlinkRecovering(s)||s.goose.hp<=0||dist(s.duck,s.goose)>360)return false;
    c.netTarget=null;c.netWindup=0;c.netCooldown=8*gooseCooldown(s);
    if(c.invulnerable===0&&!(s.duck.potionInvulnerable>0)&&!(c.armorTime>0)){c.root=1.5;effect(s,s.duck,'被捕网禁锢 1.5s','#ba7137');}
    return true;
  }
  function weapon(a){return a.weapon==='sniper'?((a.sniperAmmo||0)>0||!(a.ammo>0)?'sniper':'pistol'):(a.ammo>0||!((a.sniperAmmo||0)>0)?'pistol':'sniper');}
  const ammunition=a=>weapon(a)==='sniper'?(a.sniperAmmo||0):(a.ammo||0);
  function switchWeapon(s,a=player(s)){if(s.phase!=='playing'||!(a.ammo>0)||!((a.sniperAmmo||0)>0))return false;a.weapon=weapon(a)==='sniper'?'pistol':'sniper';return true;}
  function fire(s,actor=player(s),rng=Math.random,aimTarget=null){
    if(coopActive(s)&&aimTarget&&(aimTarget===s.duck||aimTarget===s.goose))return false;
    if(s.phase!=='playing'||actor.hp<=0||controlled(actor)||actor.fireCooldown>0||(actor===s.duck&&s.combat.root>0))return false;
    const cannon=F.nearby(s,actor);if(cannon){const chance=actor===s.duck&&s.role==='goose'?1:actor.moving?(advanced(s)?.1:.2):(advanced(s)?.4:.5);return F.fire(s,actor,cannon,rng,chance,aimTarget);}
    if(actor!==player(s)&&(actor.sniperAmmo||0)>0)actor.weapon='sniper';
    if(ammunition(actor)<=0)return false;const sniper=weapon(actor)==='sniper';
    const target=aimTarget||F.target(s,actor);if(!target||target.hp<=0)return false;const gap=dist(actor,target);if(gap<.001)return false;
    if(sniper)actor.sniperAmmo--;else actor.ammo--;actor.fireCooldown=.28*(actor===s.goose?gooseCooldown(s):duckCooldown(s));
    (s.combat.audioEvents||(s.combat.audioEvents=[])).push(sniper?'sniper':'gunshot');
    if(actor===s.duck)syncClones(s);
    const shooters=actor===s.duck?[actor,...(s.combat.clones||[])]:[actor];
    for(const from of shooters){
      from.fireFlash=.12;
      const hard=advanced(s),homing=!sniper&&actor===s.duck&&s.role==='goose',hitChance=sniper?(actor.moving?.1:.6):homing?1:actor.moving?(hard?.1:.2):(hard?.4:.5),willHit=homing||rng()<hitChance;
      const headshot=willHit&&rng()<(sniper?.1:hard?.05:.1),damage=sniper?(headshot?800:400):(headshot?200:100)*(hard?.5:1)*(actor===s.duck?duckDamage(s):gooseDamage(s));
      const angle=Math.atan2(target.y-from.y,target.x-from.x)+(willHit?0:.35);
      s.combat.bullets.push({x:from.x,y:from.y,vx:Math.cos(angle)*760,vy:Math.sin(angle)*760,owner:actor===s.duck?'duck':'goose',life:2,willHit,hitChance,damage,headshot,homing,clone:from!==actor,...(sniper?{weapon:'sniper',bypassProtection:true}:{}),...(target.id!==undefined?{targetId:target.id}:{})});
    }
    return true;
  }
  const throwTarget=(s,a,allowSummons=true)=>coopActive(s)?F.target(s,a,m=>allowSummons||!m.noCoop):a===s.duck?s.goose:s.duck;
  function throwPotion(s,actor=player(s),rng=Math.random,aimTarget=null){
    const target=aimTarget||throwTarget(s,actor,false);if(target?.noCoop)return false;if(aimTarget&&(!coopActive(s)||!F.monsters(s).includes(aimTarget)))return false;
    if(s.phase!=='playing'||actor.hp<=0||controlled(actor)||!target||target.hp<=0||!(actor.potions>0)||actor.potionCooldown>0||(actor===s.duck&&s.combat.root>0))return false;
    actor.potions--;actor.potionCooldown=.6*(actor===s.goose?gooseCooldown(s):duckCooldown(s));
    const roll=rng(),outcome=roll<.1?'kill':roll<.3?'poison':roll<.7?'stun':roll<.9?'damage':roll<.99?'shield':'weather';
    const gap=dist(actor,target),vx=gap>0?(target.x-actor.x)/gap*480:480,vy=gap>0?(target.y-actor.y)/gap*480:0;
    s.combat.potionShots.push({x:actor.x,y:actor.y,owner:actor===s.duck?'duck':'goose',life:4,outcome,trackingRange:300,vx,vy,distance:0,...(target.id!==undefined?{targetId:target.id}:{})});
    effect(s,actor,'药水投掷！','#9467b4');return true;
  }
  function throwOmen(s,actor=player(s)){
    const target=throwTarget(s,actor);
    if(s.phase!=='playing'||actor.hp<=0||controlled(actor)||!target||target.hp<=0||!actor.omenArmed||(actor===s.duck&&s.combat.root>0))return false;
    const gap=dist(actor,target);actor.omenArmed=false;
    s.combat.potionShots.push({kind:'omen',x:actor.x,y:actor.y,owner:actor===s.duck?'duck':'goose',life:4,outcome:'weather',trackingRange:600,maxDistance:OMEN_RANGE,vx:gap?(target.x-actor.x)/gap*480:480,vy:gap?(target.y-actor.y)/gap*480:0,distance:0,...(target.id!==undefined?{targetId:target.id}:{})});
    effect(s,actor,'天灾印记投掷！','#9a68a6');return true;
  }
  const staffTarget=(s,a=player(s))=>F.target(s,a,m=>!m.noCoop);
  function useStaff(s,actor=player(s),rng=Math.random,aimTarget=null){
    const target=aimTarget||staffTarget(s,actor),c=s.combat;if(target?.noCoop)return false;
    if(target&&!F.monsters(s).includes(target)&&!(target===(actor===s.duck?s.goose:s.duck)&&!coopActive(s)))return false;
    if(s.phase!=='playing'||actor.hp<=0||controlled(actor)||actor===s.duck&&c.root>0||!(actor.staffCharges>0)||actor.staffCooldown>0||!target||target.hp<=0||dist(actor,target)>600)return false;
    actor.staffCharges--;actor.staffCooldown=.6;const roll=rng(),kind=roll<.4?'stun':roll<.6?'freeze':roll<.7?'meteor':roll<.8?'vortex':roll<.9?'shower':roll<.91?'lightning':'poison';
    if(!c.weather)configureLevel(s,s.level||1,()=>.5);const w=c.weather;effect(s,actor,'法杖释放！','#9b75c5');
    if(['meteor','shower','lightning','vortex'].includes(kind)){if(kind==='vortex')addVortex(s,target,staffWeatherRef(s,target));else{w.staffTargets=w.staffTargets||{};w.staffTargets[kind]={...staffWeatherRef(s,target),caster:actor===s.duck?'duck':'goose'};}if(kind==='meteor'){w.meteor=true;w.meteorTimer=0;}if(kind==='shower'){w.meteorShower=true;w.showerTimer=0;}if(kind==='lightning'){w.lightning=true;w.lightningTimer=0;}notice(s,'法杖召唤：'+({meteor:'流星',shower:'流星雨',lightning:'雷暴',vortex:'新风涡'})[kind]);return true;}
    notice(s,'法杖目标：'+(target===s.duck?'鸭子':target===s.goose?'大鹅':target.kind==='scorpion'?'蝎子':target.kind==='worm'?'沙虫':target.kind==='bear'?'北极熊':target.kind==='godzilla'?'哥斯拉':'章鱼'));
    if(target.id===undefined&&(immune(s,target)||target===s.duck&&c.invulnerable>0)){effect(s,target,'无敌抵挡','#c79b24');return true;}
    const armored=target===s.duck?c.armorTime>0:target===s.goose?c.gooseArmorTime>0:false;
    if(kind==='poison'){target.staffPoisonTime=6;target.staffPoisonTick=1;target.slowTime=5;effect(s,target,'杖毒 50/s · 6s / 减速30% · 5s','#729d43');}
    else if(armored)effect(s,target,'霸体免控','#4e91b5');else{target[kind==='freeze'?'freezeTime':'stun']=kind==='freeze'?2:1;effect(s,target,kind==='freeze'?'冰冻 · 2s':'眩晕 · 1s','#689fc1');}
    return true;
  }
  function summonOutcome(rng=Math.random){const r=rng();return r<.05?'godzilla':r<.25?'worm':r<.45?'bear':r<.75?'octopus':r<.76?'all':'none';}
  function openSummon(s,actor=player(s),rng=Math.random){
    if(s.phase!=='playing'||actor.hp<=0)return [];
    const outcome=summonOutcome(rng),kinds=outcome==='all'?['godzilla','worm','bear','octopus']:outcome==='none'?[]:[outcome],spawned=[],c=s.combat;
    for(const kind of kinds){
      const list=kind==='godzilla'?c.godzillas:kind==='worm'?c.desert.monsters:kind==='bear'?c.bears:c.octopuses;
      if((kind==='octopus'?list.length>=8:list.filter(m=>m.noCoop&&m.kind===kind).length>=8))continue;
      let id;
      if(kind==='godzilla'||kind==='bear'){const base=kind==='godzilla'?300000:200000;id=Array.from({length:8},(_,i)=>base+i+1).find(id=>!list.some(m=>m.id===id));}
      else if(kind==='worm'){if(c.desert.nextId>=100100)continue;id=c.desert.nextId;}
      else{if(c.nextFloodId>=100000)continue;id=c.nextFloodId;}
      if(id===undefined)continue;
      const p=point(s,rng,p=>dist(p,s.duck)>=650&&dist(p,s.goose)>=650&&!weatherDanger(s,p)&&F.monsters(s).every(m=>m.hp<=0||dist(m,p)>220));if(!p)continue;
      const hp=kind==='godzilla'?100000:kind==='octopus'?10000:20000;
      const m={...p,id,...(kind==='octopus'?{}:{kind}),hp,maxHp:hp,attackCooldown:0,noCoop:true,summoner:actor===s.goose?'goose':'duck',...(kind==='godzilla'?{breathCooldown:30,beam:null}:kind==='worm'?{rangedCooldown:2}:kind==='bear'?{freezeCooldown:0}:{})};
      A.boost(s,m);list.push(m);if(kind==='worm')c.desert.nextId++;if(kind==='octopus')c.nextFloodId++;spawned.push(m);effect(s,m,'盲盒召唤 · 不合作','#b77c47');
    }
    const names={godzilla:'哥斯拉',worm:'沙虫',bear:'北极熊',octopus:'章鱼'};
    const message=spawned.length?'首领盲盒：召唤'+spawned.map(m=>names[m.kind||'octopus']).join('、')+'！不触发合作，倒计时照常，首领保护召唤者，攻击敌方角色与自然首领。':outcome==='none'?'首领盲盒：无事发生。':'首领盲盒：场上该类召唤首领已达上限或没有安全落点，本次未召唤。';
    effect(s,actor,spawned.length?'首领召唤！':'本次未召唤','#b77c47');notice(s,message);return spawned;
  }
  function collect(s,actor,rng){
    for(let i=s.combat.items.length-1;i>=0;i--){const item=s.combat.items[i];if(dist(item,actor)>=30||(item.type==='potion'&&actor.potions>=3)||(item.type==='omen'&&actor.omenArmed)||(item.type==='teleport'&&actor.teleports>=1)||(item.type==='revive'&&(actor.reviveCharges>0||(actor===s.duck?s.combat.duckRevived:s.combat.gooseItemRevived))))continue;
      s.combat.items.splice(i,1);
      if(item.type==='summon'){openSummon(s,actor);continue;}
      if(item.type==='med'){
        if(rng()<.05){const healed=Math.min(actor.maxHp-actor.hp,actor.maxHp*.2);actor.hp+=healed;effect(s,actor,'幸运回血 +'+Math.round(healed)+' · 20%','#4a965d');}
        else if(actor.hp>=actor.maxHp){const before=actor.maxHp,limit=actor===s.duck&&s.difficulty==='hell'?200000:100000;actor.maxHp=Math.min(limit,before+Math.ceil(before/10));actor.hp=actor.maxHp;effect(s,actor,actor.maxHp>before?'生命上限 +'+(actor.maxHp-before)+' · 10%':'生命上限已达上限','#4a965d');}
        else{const healed=Math.min(20,actor.maxHp-actor.hp);actor.hp+=healed;effect(s,actor,'立即回血 +'+healed,'#4a965d');}
      }
      if(item.type==='speed'){actor.haste=3;effect(s,actor,'加速 +30% · 3s','#b68b22');}
      if(item.type==='potion'){actor.potions=(actor.potions||0)+1;effect(s,actor,'药水 +1','#9467b4');}
      if(item.type==='revive'){actor.reviveCharges=1;effect(s,actor,'复活道具 · 死亡半血复活','#d180ad');}
      if(item.type==='teleport'){actor.teleports=1;effect(s,actor,'瞬移道具 · T 使用','#8b73c9');}
      if(item.type==='staff'){actor.staffCharges=3;effect(s,actor,'法杖 · H · 3次','#8b6bbc');}
      if(item.type==='sniper'){actor.sniperAmmo=3;actor.weapon='sniper';effect(s,actor,'狙击枪 · 3发','#557e91');s.combat.audioEvents.push('sniperReload');}
      if(item.type==='omen'){actor.omenArmed=true;effect(s,actor,'天灾印记 · M 投掷','#9a68a6');}
      if(item.type==='gun'){actor.weapon='pistol';actor.ammo=5;effect(s,actor,'手枪 · 5 发','#657b92');s.combat.audioEvents.push('reload');}
      if(actor===player(s))notice(s,item.type==='revive'?'复活道具已携带：死亡自动消耗，恢复一半最大生命并无敌2秒，本局限一次。':item.type==='teleport'?'瞬移道具已拾取：按 T 或点击瞬移道具按钮，随机传送至全图任意地点，使用一次后消耗。':item.type==='staff'?'法杖已拾取：H释放，600像素内自动瞄准，3次机会。':item.type==='sniper'?'狙击枪：3发，普通400 / 爆头800，无视伤害保护；静止60% / 移动10%，爆头10%，R切换武器。':item.type==='omen'?'天灾印记已携带：最远900像素、600像素内追踪，按 M 或印记按钮投掷，命中敌方触发全部八种极端天气。':item.type==='potion'?'药水：10%秒杀 / 20%中毒 / 40%眩晕 / 20%伤害400 / 9%自己无敌 / 1%全部极端天气':item.type==='med'?'血包：5%概率恢复最大生命值的20%；其余95%满血时上限+10%，未满时回血20点，均不超过上限。':item.type==='speed'?'疾走道具：移动速度 +30%，持续 3 秒。':(advanced(s)?`困难手枪：普通 ${actor===s.duck?100:50} / 爆头 ${actor===s.duck?200:100} 伤害，静止命中 40%、移动 10%。`:'拾取手枪：5 发子弹，空格 或「射击」按钮开火。'));
    }
  }
  function contacts(s,rng=Math.random){
    if(s.phase!=='playing')return;
    if(s.duck.hp>0)collect(s,s.duck,rng);if(s.goose.hp>0)collect(s,s.goose,rng);
    for(let i=s.combat.mines.length-1;i>=0;i--){const m=s.combat.mines[i];if(dist(m,s.duck)>=29&&dist(m,s.goose)>=33&&!F.monsters(s).some(o=>o.hp>0&&dist(m,o)<45))continue;
      s.combat.mines.splice(i,1);const damage=m.type==='water'?100:150;
      (s.combat.audioEvents||(s.combat.audioEvents=[])).push('explosion');
      effect(s,m,m.type==='water'?'水雷爆炸 −100':'地雷爆炸 −150');
      // 只记录本次爆炸真正致死的角色；幸存、无敌或当场复活不留下死亡记录。
      for(const [key,a] of [['duck',s.duck],['goose',s.goose]])if(a.hp>0&&dist(m,a)<65){if(key==='duck')damageDuck(s,damage);else damageGoose(s,damage);if(a.hp<=0){s.combat.mineDeaths=s.combat.mineDeaths||{};s.combat.mineDeaths[key]=m.type;}}for(const o of F.monsters(s))if(o.hp>0&&dist(m,o)<65)F.hurt(o,damage);
    }
    if(!coopActive(s)&&s.goose.hp>0&&!(controlled(s.goose))&&(s.role==='goose'||!gooseEvading(s)&&!duckProtected(s))&&s.duck.hp>0&&dist(s.duck,s.goose)<31&&s.combat.attackCooldown<=0){s.combat.attackCooldown=1.2*gooseCooldown(s);damageDuck(s,50*gooseDamage(s));if(s.duck.hp<=0&&s.role==='duck'&&s.combat.gooseBlinkFlash>0)s.combat.deathCause='blink';}
  }
  function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
  function duckSteering(s){
    bearDefense(s,s.duck);if(s.duck.hp<=0||controlled(s.duck))return {x:0,y:0};
    const d=s.duck,g=s.goose,gap=dist(d,g);
    const escape=weatherEscape(s,d,moveDistance(s,1,d)*.85);if(escape)return escape;
    const rearm=weaponPlan(s,d);if(rearm)return rearm.direction;
    const revival=revivalPlan(s,d);if(revival)return revival.direction;
    if(F.nearby(s,d)&&gap>180&&!weatherDanger(s,d)&&!D.tsunamiThreat(s.combat.weather,d))return {x:0,y:0};
    const teleport=teleportPlan(s,d);if(teleport)return teleport.direction;const engage=monsterSteering(s,d);if(engage)return engage;
    // Revival supplies only use the shared safe-route planner; never fall back to direct pursuit.
    const useful=item=>item.type==='summon'?false:item.type==='revive'?false:item.type==='teleport'?!d.teleports:item.type==='staff'?(d.staffCharges||0)<3:item.type==='sniper'?(d.sniperAmmo||0)<3:item.type==='omen'?!d.omenArmed:item.type==='gun'?d.ammo<5:item.type==='potion'?d.potions<3:item.type==='speed'?d.haste<1:true;
    const safe=points=>points.filter(p=>!weatherDanger(s,p)&&s.combat.mines.every(m=>dist(p,m)>=50)&&(coopActive(s)||dist(p,g)>85&&(gap<70||segmentDistance(g,d,p)>65)));
    const supplies=safe(s.combat.items.filter(useful)),options=supplies.length?supplies:safe(s.bread||[]);
    options.sort((a,b)=>(dist(a,d)+(a.type?-35:0))-(dist(b,d)+(b.type?-35:0)));
    if(!options.length&&gap>180&&D.circles(s.combat.weather).some(h=>h.unblockable))return {x:0,y:0};
    const throwSpot=!coopActive(s)&&d.omenArmed&&gap>800?{x:g.x+(d.x-g.x)/gap*800,y:g.y+(d.y-g.y)/gap*800}:null;
    const target=throwSpot&&safe([throwSpot]).length?throwSpot:options[0]||{x:M.width/2,y:M.height/2},directions=[];
    const toward={x:target.x-d.x,y:target.y-d.y},len=Math.hypot(toward.x,toward.y);if(len>0)directions.push({x:toward.x/len,y:toward.y/len});
    for(let i=0;i<24;i++){const angle=i*Math.PI/12;directions.push({x:Math.cos(angle),y:Math.sin(angle)});}
    let best=null,bestScore=-Infinity;
    for(const dir of directions){const end={x:clamp(d.x+dir.x*90,B.left,B.right),y:clamp(d.y+dir.y*90,B.top,B.bottom)},travel=dist(d,end);if(travel<1||!giantRouteSafe(s,d,end))continue;
      const clearance=dist(end,g),pathClear=segmentDistance(g,d,end),progress=dist(d,target)-dist(end,target);
      let score=progress*1.5+(coopActive(s)?0:Math.min(clearance,450)*.12-Math.max(0,180-clearance)*3-Math.max(0,70-pathClear)*6);
      for(const mine of s.combat.mines){const path=segmentDistance(mine,d,end),initial=dist(mine,d);score-=Math.max(0,75-path)*5;if((initial>=45&&path<45)||(initial<45&&dist(end,mine)<=initial))score-=10000;}
      const w=s.combat.weather;for(const h of [...D.circles(w),...monsterCircles(s),...S.circles(s)]){const path=segmentDistance(h,d,end);score-=Math.max(0,h.r+10-path)*20;}if(w){for(const b of w.strikes)if(!b.hit)score-=Math.max(0,80-dist(end,b))*6;for(const v of vortices(s))score-=Math.max(0,240-dist(end,v.center))*4;for(const m of w.meteors||[])if(!m.hit){const r=meteorRadius(m)+23,initial=dist(d,m),path=segmentDistance(m,d,end);score-=Math.max(0,r-dist(end,m))*10;if(initial>=r?path<r:dist(end,m)<=initial)score-=10000;}}
      if(score>bestScore){bestScore=score;best={x:(end.x-d.x)/travel,y:(end.y-d.y)/travel};}
    }
    return best||{x:0,y:0};
  }
  const duckProtected=s=>s.combat.invulnerable>0||s.duck.potionInvulnerable>0;
  const gooseEvading=s=>weatherDanger(s,s.goose)||D.tsunamiThreat(s.combat.weather,s.goose);
  // 固定25秒瞬移冷却的首秒就是恢复期，沿用原计时保存，避免读档刷新。
  const gooseBlinkRecovering=s=>s.role==='duck'&&(s.combat.gooseBlinkCooldown||0)>24+1e-8;
  const gooseCanAct=s=>s.role==='duck'&&s.phase==='playing'&&s.goose.hp>0&&s.duck.hp>0&&!(controlled(s.goose));
  function gooseMoveSpeed(s){return (105+((s.level||1)-1)*5+s.elapsed*1.25)*gooseSpeed(s)*(s.goose.haste>0?1.3:1)*(s.role==='duck'&&s.combat.gooseSprintTime>0?1.5:1)*(s.goose.slowTime>0?.7:1);}
  function gooseMoveDistance(s,dt){const g=s.goose,c=s.combat,held=Math.max(g.stun||0,g.freezeTime||0),sprint=s.role==='duck'?c.gooseSprintTime||0:0,base=(105+((s.level||1)-1)*5+s.elapsed*1.25)*gooseSpeed(s),times=[0,dt,...[held,g.haste,sprint,g.slowTime||0].filter(t=>t>0&&t<dt)].sort((a,b)=>a-b);let travel=0;for(let i=1;i<times.length;i++){const mid=(times[i]+times[i-1])/2;if(mid<held)continue;travel+=base*(times[i]-times[i-1])*(mid<g.haste?1.3:1)*(mid<sprint?1.5:1)*(mid<(g.slowTime||0)?.7:1);}return travel;}
  function gooseIntercept(s){let m=gooseMemory.get(s);if(!m){m={x:s.duck.x,y:s.duck.y,at:clock(s),vx:0,vy:0,target:null,chosenAt:0};gooseMemory.set(s,m);}const dt=clock(s)-m.at;if(dt>0){if(dt<=.5){m.vx=(s.duck.x-m.x)/dt;m.vy=(s.duck.y-m.y)/dt;}else m.vx=m.vy=0;m.x=s.duck.x;m.y=s.duck.y;m.at=clock(s);}const speed=Math.hypot(m.vx,m.vy),scale=speed>0?Math.min(.4,100/speed):0;return {x:clamp(s.duck.x+m.vx*scale,B.left,B.right),y:clamp(s.duck.y+m.vy*scale,B.top,B.bottom)};}
  function gooseLandingSafe(s,p){if(!giantRouteSafe(s,s.goose,p)||!M.contains(p)||weatherDanger(s,p)||s.combat.mines.some(m=>dist(m,p)<50))return false;const w=s.combat.weather;if(vortices(s).some(v=>dist(p,v.center)<267))return false;return true;}
  function gooseBlink(s){const c=s.combat,g=s.goose,d=s.duck,gap=dist(g,d);if(coopActive(s)||!gooseCanAct(s)||c.gooseBlinkCooldown>0||gap>600||gap<=180||duckProtected(s)||gooseEvading(s))return false;const predicted=gooseIntercept(s),heading=Math.atan2(predicted.y-g.y,predicted.x-g.x),travel=Math.min(150,gap-100),options=[];for(let i=0;i<24;i++){const a=heading+i*Math.PI/12,p={x:g.x+travel*Math.cos(a),y:g.y+travel*Math.sin(a)},remaining=dist(p,d);if(remaining>=100-1e-8&&remaining<gap-40&&gooseLandingSafe(s,p))options.push(p);}options.sort((a,b)=>dist(a,predicted)-dist(b,predicted));if(!options.length)return false;effect(s,g,'瞬移！','#9275bb');Object.assign(g,options[0]);g.face=d.x>=g.x?1:-1;c.gooseBlinkCooldown=25;c.gooseBlinkFlash=.3;c.attackCooldown=Math.max(c.attackCooldown,1);effect(s,g,'短距瞬移','#9275bb');return true;}
  function gooseSprint(s){const c=s.combat;if(!gooseCanAct(s)||c.gooseSprintCooldown>0||c.gooseSprintTime>0)return false;c.gooseSprintTime=5;c.gooseSprintCooldown=25;effect(s,s.goose,'疾跑 ×1.5 · 5s','#d59a37');return true;}
  // 空弹时优先选择可安全到达的枪械，寻路结果由当前世界推导，不新增存档状态。
  function weaponPlan(s,a){
    if(a===player(s)||ammunition(a)>0||F.nearby(s,a)&&(!coopActive(s)||!!monsterTarget(s,a))&&!(s.combat.godzillas||[]).some(g=>g.hp>0)||a.hp<=0||controlled(a)||weatherDanger(s,a)||D.tsunamiThreat(s.combat.weather,a))return null;
    return supplyPlan(s,a,['gun','sniper']);
  }
  function revivalPlan(s,a){return a===player(s)||a.reviveCharges>0||(a===s.duck?s.combat.duckRevived:s.combat.gooseItemRevived)?null:supplyPlan(s,a,['revive']);}
  function teleportPlan(s,a){return a.teleports>0?null:supplyPlan(s,a,['teleport']);}
  function supplyPlan(s,a,types){
    if(a===player(s)||s.phase!=='playing'||a.hp<=0||controlled(a)||weatherDanger(s,a)||D.tsunamiThreat(s.combat.weather,a))return null;
    const w=s.combat.weather,other=a===s.duck?s.goose:s.duck;
    const hazards=[...s.combat.mines.map(p=>({...p,r:60})),...monsterCircles(s),...S.circles(s).map(p=>({...p,r:p.kind==='worm'?205:p.kind==='scorpion'?135:70})),...D.circles(w),...(w?.strikes||[]).filter(p=>!p.hit).map(p=>({...p,r:85})),...(w?.meteors||[]).filter(p=>!p.hit).map(p=>({...p,r:meteorRadius(p)+40})),...(!coopActive(s)?[{...other,r:100}]:[])];
    for(const v of vortices(s))hazards.push({...v.center,r:245});
    const safe=p=>M.contains(p)&&hazards.every(h=>dist(p,h)>=h.r),clear=(p,q)=>giantRouteSafe(s,p,q)&&hazards.every(h=>segmentDistance(h,p,q)>=h.r);
    const options=s.combat.items.filter(p=>types.includes(p.type)&&safe(p)).sort((p,q)=>dist(a,p)-dist(a,q));
    for(const target of options){
      const direction=p=>{const n=dist(a,p);return n>.001?{x:(p.x-a.x)/n,y:(p.y-a.y)/n}:{x:0,y:0};};
      if(clear(a,target))return {target,direction:direction(target)};
      const size=80,cols=Math.ceil((B.right-B.left)/size)+1,rows=Math.ceil((B.bottom-B.top)/size)+1,n=cols*rows;
      const nodes=Array.from({length:n},(_,i)=>({x:Math.min(B.right,B.left+(i%cols)*size),y:Math.min(B.bottom,B.top+Math.floor(i/cols)*size)})),pass=nodes.map(safe);
      const goals=new Set();for(let i=0;i<n;i++)if(pass[i]&&dist(nodes[i],target)<=120&&clear(nodes[i],target))goals.add(i);if(!goals.size)continue;
      const cost=Array(n).fill(Infinity),parent=Array(n).fill(-1),closed=new Set(),open=[];
      for(let i=0;i<n;i++)if(pass[i]&&dist(a,nodes[i])<=125&&clear(a,nodes[i])){cost[i]=dist(a,nodes[i]);open.push(i);}
      let end=-1;
      while(open.length){open.sort((p,q)=>(cost[p]+dist(nodes[p],target))-(cost[q]+dist(nodes[q],target)));const at=open.shift();if(closed.has(at))continue;closed.add(at);if(goals.has(at)){end=at;break;}const x=at%cols,y=Math.floor(at/cols);
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if((!dx&&!dy)||x+dx<0||x+dx>=cols||y+dy<0||y+dy>=rows)continue;const next=(y+dy)*cols+x+dx;if(!pass[next]||closed.has(next)||!clear(nodes[at],nodes[next]))continue;const c=cost[at]+dist(nodes[at],nodes[next]);if(c<cost[next]){cost[next]=c;parent[next]=at;open.push(next);}}
      }
      if(end<0)continue;const route=[];for(let at=end;at>=0;at=parent[at])route.unshift(nodes[at]);for(let i=route.length-1;i>=0;i--)if(clear(a,route[i]))return {target,direction:direction(route[i])};
    }
    return null;
  }
  function monsterTarget(s,a,range=700){
    const options=F.monsters(s).filter(m=>m.hp>0&&dist(a,m)<range);
    options.sort((p,q)=>(dist(a,p)-(p.kind==='scorpion'?80:0))-(dist(a,q)-(q.kind==='scorpion'?80:0)));return options[0]||null;
  }
  function monsterItemTarget(s,a,range){const bosses=coopActive(s)?F.monsters(s).filter(m=>m.hp>0&&!m.noCoop&&m.kind!=='scorpion'&&dist(a,m)<=range).sort((p,q)=>dist(a,p)-dist(a,q)):[];return bosses[0]||F.monsters(s).filter(m=>m.hp>0&&!m.noCoop&&dist(a,m)<=range).sort((p,q)=>dist(a,p)-dist(a,q))[0]||null;}
  function monsterItems(s,a=enemy(s),rng=Math.random){
    const coop=coopActive(s);if(a===player(s)||s.phase!=='playing'||a.hp<=0||controlled(a)||weatherDanger(s,a,coop)||D.tsunamiThreat(s.combat.weather,a)&&!M.sheltered(a))return false;
    let used=false;const staffMonster=monsterItemTarget(s,a,600);if(a.staffCharges>0&&staffMonster)used=useStaff(s,a,rng,staffMonster)||used;
    if(!coop)return used;const target=F.target(s,a);if(target?.id!==undefined&&a.omenArmed&&dist(a,target)<=OMEN_RANGE)used=throwOmen(s,a)||used;
    const potionTarget=monsterItemTarget(s,a,450);if(a.potions>0&&potionTarget)used=throwPotion(s,a,rng,potionTarget)||used;return used;
  }
  function monsterAttack(s,a=enemy(s),rng=Math.random){
    if(a===player(s)||s.phase!=='playing'||a.hp<=0||controlled(a)||weatherDanger(s,a,false)||D.tsunamiThreat(s.combat.weather,a)&&!M.sheltered(a))return false;
    const target=monsterTarget(s,a);if(!target)return false;
    if(ammunition(a)>0||F.nearby(s,a))return fire(s,a,rng,target);
    if(a===s.goose&&!['bear','godzilla'].includes(target.kind)&&dist(a,target)<=65&&s.combat.attackCooldown<=0&&!gooseBlinkRecovering(s)){s.combat.attackCooldown=1.2*gooseCooldown(s);const dealt=F.hurt(target,50*gooseDamage(s));effect(s,target,'近战 −'+dealt);return true;}return false;
  }
  function monsterSteering(s,a){
    if(a===player(s)||ammunition(a)<=0&&!(a.potions>0)&&!a.omenArmed&&!(a.staffCharges>0)&&!(a===s.goose&&coopActive(s))||D.tsunamiThreat(s.combat.weather,a))return null;
    const m=monsterTarget(s,a,coopActive(s)?Math.hypot(M.width,M.height):900);if(!m)return null;
    const other=a===s.duck?s.goose:s.duck;if(!coopActive(s)&&a===s.duck&&dist(a,other)<180)return null;
    const distance=dist(a,m);if(distance<=(a.potions>0?400:ammunition(a)>0?500:a.omenArmed?800:a.staffCharges>0?550:380))return {x:0,y:0};
    const step={x:clamp(a.x+(m.x-a.x)/distance*90,B.left,B.right),y:clamp(a.y+(m.y-a.y)/distance*90,B.top,B.bottom)};
    if(!giantRouteSafe(s,a,step)||weatherDanger(s,step)||s.combat.mines.some(p=>segmentDistance(p,a,step)<50)||!coopActive(s)&&a===s.duck&&segmentDistance(other,a,step)<100)return null;
    return {x:(m.x-a.x)/distance,y:(m.y-a.y)/distance};
  }
  function canCounterOctopus(s,a){return !!monsterTarget(s,a)&&!weatherDanger(s,a,false)&&(!D.tsunamiThreat(s.combat.weather,a)||M.sheltered(a));}
  function goosePlan(s){
    bearDefense(s,s.goose);if(!gooseCanAct(s))return {x:0,y:0};gooseIntercept(s);const g=s.goose;
    // 持枪也先判断撤离，不能因为准备进攻而漏掉疾跑。
    if(gooseEvading(s)){const direction=gooseSteering(s);if((!M.sheltered(g)||weatherDanger(s,g))&&(direction.x||direction.y))gooseSprint(s);return direction;}
    const rearm=weaponPlan(s,g);if(rearm)return rearm.direction;const revival=revivalPlan(s,g);if(revival)return revival.direction;const teleport=teleportPlan(s,g);if(teleport)return teleport.direction;
    if(ammunition(g)>0&&monsterTarget(s,g,coopActive(s)?Math.hypot(M.width,M.height):900))return gooseSteering(s);
    if(F.nearby(s,g)&&(!coopActive(s)||!!monsterTarget(s,g))&&!weatherDanger(s,g)&&!D.tsunamiThreat(s.combat.weather,g)&&(!duckProtected(s)||F.target(s,g)?.id!==undefined))return {x:0,y:0};
    if(!coopActive(s)&&!duckProtected(s)){const blinked=gooseBlink(s),gap=dist(g,s.duck);if(!blinked&&gap>=180&&gap<=900&&!(s.combat.root>0))gooseSprint(s);}
    return gooseSteering(s);
  }
  function gooseAttack(s,rng=Math.random){if(!gooseCanAct(s))return;monsterItems(s,s.goose,rng);if(monsterAttack(s,s.goose,rng))return;const target=F.target(s,s.goose),monster=target?.id!==undefined;if(monster){if(!canCounterOctopus(s,s.goose))return;if(ammunition(s.goose)>0||F.nearby(s,s.goose))fire(s,s.goose,rng);return;}if(coopActive(s)||gooseEvading(s)||duckProtected(s))return;const gap=dist(s.goose,s.duck);if(s.goose.staffCharges>0&&gap<=600)useStaff(s,s.goose,rng);if(gap<=OMEN_RANGE&&s.goose.omenArmed)throwOmen(s,s.goose);if(gap<=450&&s.goose.potions>0)throwPotion(s,s.goose,rng);if(F.nearby(s,s.goose)||gap<700&&ammunition(s.goose)>0)fire(s,s.goose,rng);}
  function gooseShouldNet(s){const c=s.combat;return !coopActive(s)&&gooseCanAct(s)&&!gooseEvading(s)&&!duckProtected(s)&&!(c.root>0)&&!(c.armorTime>0)&&dist(s.goose,s.duck)<=Math.min(360,31+gooseMoveDistance(s,1.5)*.8);}
  function gooseSteering(s){
    bearDefense(s,s.goose);if(s.goose.hp<=0||controlled(s.goose))return {x:0,y:0};
    const g=s.goose,d=s.duck,gap=dist(g,d),w=s.combat.weather;
    const escape=weatherEscape(s,g,gooseMoveSpeed(s));if(escape)return escape;const rearm=weaponPlan(s,g);if(rearm)return rearm.direction;const revival=revivalPlan(s,g);if(revival)return revival.direction;const teleport=teleportPlan(s,g);if(teleport)return teleport.direction;const engage=monsterSteering(s,g);if(engage)return engage;
    const hazards=[...monsterCircles(s),...S.circles(s),...s.combat.mines.map(p=>({...p,r:50})),...D.circles(w)];
    if(w){for(const v of vortices(s))hazards.push({...v.center,r:225,wind:true});for(const b of w.strikes)if(!b.hit)hazards.push({...b,r:78,lightning:true});for(const m of w.meteors||[])if(!m.hit)hazards.push({...m,r:meteorRadius(m)+23,lightning:true});}
    const useful=p=>p.type==='summon'?false:p.type==='revive'?false:p.type==='teleport'?!g.teleports:p.type==='staff'?(g.staffCharges||0)<3:p.type==='sniper'?(g.sniperAmmo||0)<3:p.type==='omen'?!g.omenArmed:p.type==='gun'?g.ammo<5:p.type==='potion'?g.potions<3:p.type==='speed'?g.haste<1:true;
    const safe=p=>hazards.every(h=>dist(p,h)>=h.r);
    const giantBlocksTarget=D.circles(w).some(h=>h.unblockable&&dist(d,h)<h.r);
    const intercepted=gooseIntercept(s);let target=coopActive(s)?monsterTarget(s,g,Math.hypot(M.width,M.height))||g:gap>100?intercepted:{x:d.x,y:d.y};const memory=gooseMemory.get(s);
    const supplies=s.combat.items.filter(p=>useful(p)&&safe(p)&&dist(g,p)<(p.type==='med'&&g.hp<g.maxHp?420:280)&&(giantBlocksTarget||dist(g,p)+dist(p,d)-gap<200));
    const value=p=>dist(g,p)-(p.type==='med'?(1-g.hp/g.maxHp)*140:p.type==='sniper'?(3-(g.sniperAmmo||0))*20:p.type==='omen'?65:p.type==='gun'?(5-g.ammo)*8:p.type==='potion'?(3-g.potions)*12:20);
    supplies.sort((a,b)=>value(a)-value(b));let chosen=gap>90?supplies[0]:null;
    const old=memory.target;if(old&&gap>90&&supplies.includes(old)&&clock(s)-memory.chosenAt<.5&&(!chosen||value(chosen)>=value(old)-Math.max(20,Math.abs(value(old))*.2)))chosen=old;
    if(chosen){target=chosen;if(memory.target!==chosen){memory.target=chosen;memory.chosenAt=clock(s);}}else memory.target=null;
    const direction=p=>{const n=dist(g,p);return n>.001?{x:(p.x-g.x)/n,y:(p.y-g.y)/n}:{x:0,y:0};};
    const clear=(a,b)=>hazards.every(h=>{const start=dist(a,h);return start<h.r?dist(b,h)>start:segmentDistance(h,a,b)>=h.r;});
    // 已处危险区时先脱离，避免寻路起点被障碍包围。
    if(!safe(g)){
      let best=null,score=-Infinity;
      const speed=gooseMoveSpeed(s);
      // 重叠天气不要求每一步同时远离所有落点；按实际落雷时间判断能否撤出。
      for(let i=0;i<64;i++){
        const angle=i*Math.PI/32,p={x:clamp(g.x+Math.cos(angle)*180,B.left,B.right),y:clamp(g.y+Math.sin(angle)*180,B.top,B.bottom)};
        if(dist(g,p)<1)continue;
        const dir=direction(p);
        if(hazards.some(h=>h.wind&&dist(g,h)>=75&&segmentDistance(h,g,p)<75))continue;
        if(!hazards.every(h=>h.lightning&&dist(g,h)<h.r?true:dist(g,h)<h.r?dist(p,h)>dist(g,h):segmentDistance(h,g,p)>=h.r))continue;
        let lightningPenalty=0;
        for(const h of hazards)if(h.lightning){
          const time=Math.max(0,h.delay),future={x:clamp(g.x+dir.x*speed*time,B.left,B.right),y:clamp(g.y+dir.y*speed*time,B.top,B.bottom)};
          lightningPenalty+=Math.max(0,h.r-dist(future,h))*1000;
        }
        const value=-lightningPenalty+Math.min(...hazards.map(h=>dist(p,h)-h.r))*4-dist(p,target)*.05;
        if(value>score){score=value;best=p;}
      }
      return best?direction(best):{x:0,y:0};
    }
    if(D.circles(w).some(h=>h.unblockable&&dist(g,h)>=h.r&&dist(target,h)<h.r))return {x:0,y:0};
    if(safe(target)&&clear(g,target))return direction(target);
    // 在整个可走地图上规划绕行路线，避免只凭局部转向在雷区前来回摆动。
    const size=64,cols=Math.ceil((B.right-B.left)/size)+1,rows=Math.ceil((B.bottom-B.top)/size)+1,n=cols*rows;
    const nodes=Array.from({length:n},(_,i)=>({x:Math.min(B.right,B.left+(i%cols)*size),y:Math.min(B.bottom,B.top+Math.floor(i/cols)*size)}));
    const pass=nodes.map(safe);let goal=-1,closest=Infinity;
    for(let i=0;i<n;i++)if(pass[i]&&dist(nodes[i],target)<closest){closest=dist(nodes[i],target);goal=i;}
    if(goal<0)return {x:0,y:0};
    const cost=Array(n).fill(Infinity),parent=Array(n).fill(-1),closed=new Set(),open=[];
    for(let i=0;i<n;i++)if(pass[i]&&dist(g,nodes[i])<=110&&clear(g,nodes[i])){cost[i]=dist(g,nodes[i]);open.push(i);}
    let end=-1;
    while(open.length){open.sort((a,b)=>(cost[a]+dist(nodes[a],nodes[goal]))-(cost[b]+dist(nodes[b],nodes[goal])));const at=open.shift();if(closed.has(at))continue;closed.add(at);if(at===goal){end=at;break;}
      const x=at%cols,y=Math.floor(at/cols);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if((!dx&&!dy)||x+dx<0||x+dx>=cols||y+dy<0||y+dy>=rows)continue;const next=(y+dy)*cols+x+dx;if(!pass[next]||closed.has(next)||!clear(nodes[at],nodes[next]))continue;const c=cost[at]+dist(nodes[at],nodes[next]);if(c<cost[next]){cost[next]=c;parent[next]=at;open.push(next);}}
    }
    if(end<0)return {x:0,y:0};
    const route=[];for(let at=end;at>=0;at=parent[at])route.unshift(nodes[at]);
    for(let i=route.length-1;i>=0;i--)if(clear(g,route[i]))return direction(route[i]);
    return {x:0,y:0};
  }
  function allWeather(s,target,source='药水效果'){
      const c=s.combat;if(!c.weather)configureLevel(s,s.level||1,()=>.5);
      // 两种道具共用命中目标引用。新的落点使用最新目标，已有落点保留。
      const w=c.weather;w.itemWeather=source!=='天灾印记';delete w.staffTargets;delete w.staffTarget;for(const v of vortices(s)){delete v.staffTarget;v.itemWeather=w.itemWeather;}
      delete w.omenTargetGoose;
      w.potionTarget=staffWeatherRef(s,target);
      const origin=M.weatherTarget(s);w.vortex=true;w.lightning=true;w.meteor=true;w.meteorShower=true;D.defaults(w,s.elapsed);if(!w.eruption)w.eruptionNext=w.disasterTime;w.eruption=true;if(!w.tsunami)w.tsunamiNext=[10,30,50].find(t=>t>=w.disasterTime+3)??70;w.tsunami=true;w.potionWaveAt=w.disasterTime+3;w.meteorTimer=0;w.showerTimer=0;w.center={x:origin.x,y:origin.y};w.target=null;w.vortexWarning=advanced(s)?.9:0;w.vortexTimer=1;w.lightningTimer=2.8;
      // 全天气效果补齐巨型陨石；保留本关已有事件及其结算状态，避免重复落下。
      if(!w.sandstorm)w.stormNext=[20,40].find(t=>t>=w.disasterTime+3)??60;w.sandstorm=true;w.stormAt=w.disasterTime+3;
      if(!w.giantMeteor)w.giantMeteor={x:clamp(origin.x,960,M.width-960),y:origin.y,radius:960,triggeredAt:w.disasterTime,impactAt:w.disasterTime+5,hit:false,...(w.itemWeather?{itemWeather:true}:{})};
      G.enable(s);ensureVortices(s);
      // 替换当前落雷波，避免重复投掷无限累积落点。
      w.strikes=[-80,0,80].map(dx=>({x:clamp(origin.x+dx,B.left,B.right),y:origin.y,delay:advanced(s)?.9:0,hit:false,tracking:advanced(s),...(w.itemWeather?{itemWeather:true}:{})}));
      effect(s,origin,'全部极端天气！','#7268a0');notice(s,source+'：天灾锁定命中者！触发所有极端天气！风涡、闪电、流星、流星雨、火山喷发和海啸已开启。巨型陨石、沙尘暴、暴风雪与雪崩已加入本关事件。');
  }
  function potionImpact(s,shot,target,at){
    if(target.noCoop)return;const c=s.combat,actor=shot.owner==='duck'?s.duck:s.goose;
    if(shot.outcome==='shield'){actor.potionInvulnerable=2;const f=shieldFrames.get(s);if(f){const k=actor===s.duck?'duck':'goose';f.potions[k]=(at??f.dt)+2;f.grants[k]=at??f.dt;}effect(s,actor,'药水无敌 · 2s','#c79b24');notice(s,'药水效果：自己无敌 2 秒！');return;}
    if(shot.outcome==='weather'){allWeather(s,target);return;}
    if(target.id!==undefined){
      if(shot.outcome==='kill'){F.hurt(target,target.hp);effect(s,target,'药水秒杀！','#a146a8');}
      if(shot.outcome==='damage')effect(s,target,`药水 −${F.hurt(target,400)}！`,'#a146a8');
      if(shot.outcome==='poison'){target.poisonTime=5;target.poisonTick=1;effect(s,target,'中毒 · 50/s · 5s','#729d43');}
      if(shot.outcome==='stun'){target.stun=1;effect(s,target,'眩晕 · 1s','#b68b22');}
      return;
    }
    if(immune(s,target,at)){effect(s,target,'无敌抵挡','#c79b24');return;}
    if(shot.outcome==='kill'){killActor(s,target,at);if(target.hp<=0)c.deathCause='potion';effect(s,target,'药水秒杀！','#a146a8');}
    if(shot.outcome==='damage'){const damage=directDamage(s,target,400,false,at);if(target.hp<=0)c.deathCause='potion';effect(s,target,`药水 −${damage}！`,'#a146a8');}
    if(shot.outcome==='poison'){target.poisonTime=5;target.poisonTick=1;effect(s,target,'中毒 · 50/s · 5s','#729d43');}
    if(shot.outcome==='stun'){
      const armored=target===s.duck?c.armorTime>0||c.invulnerable>0:c.gooseArmorTime>0;
      if(!armored){target.stun=1;effect(s,target,'眩晕 · 1s','#b68b22');}else effect(s,target,'霸体免控','#4e91b5');
    }
    notice(s,{kill:'药水效果：秒杀！',damage:'药水效果：400 点伤害，无视伤害保护！',poison:'药水效果：中毒 5 秒，每秒 50 点，无视伤害保护（重复命中刷新，不叠加）。',stun:'药水效果：眩晕 1 秒，霸体可抵抗或解除。'}[shot.outcome]);
  }
  function tickStaffPoison(s,dt){for(const a of [s.duck,s.goose,...F.monsters(s)]){if(a.noCoop){a.staffPoisonTime=0;a.staffPoisonTick=0;continue;}let remaining=Math.min(dt,a.staffPoisonTime||0);while(remaining>1e-9&&a.hp>0){const step=Math.min(remaining,a.staffPoisonTick||1);a.staffPoisonTick=(a.staffPoisonTick||1)-step;remaining-=step;if(a.staffPoisonTick<1e-8){a.staffPoisonTick=1;if(a.id!==undefined)F.hurt(a,50);else{directDamage(s,a,50,false,dt-remaining);if(a.hp<=0)s.combat.deathCause='staff';}}}if(a.staffPoisonTime!==undefined){a.staffPoisonTime=Math.max(0,a.staffPoisonTime-dt);if(a.staffPoisonTime===0)a.staffPoisonTick=0;}}}
  function tickStatuses(s,dt){
    for(const a of [s.duck,s.goose]){
      const active=Math.min(a.poisonTime||0,dt);let remaining=active;
      while(remaining>0&&a.hp>0&&(a.poisonTime||0)>0){const wait=Math.min(a.poisonTick||1,remaining);a.poisonTick=(a.poisonTick||1)-wait;remaining-=wait;
        if(a.poisonTick<1e-8){a.poisonTick=1;if(!immune(s,a,dt-remaining)){const damage=directDamage(s,a,50,true,dt-remaining);effect(s,a,'中毒 −'+damage,'#729d43');if(a.hp<=0)s.combat.deathCause='potion';}}
      }
      a.poisonTime=Math.max(0,(a.poisonTime||0)-dt);if(a.poisonTime===0)a.poisonTick=0;
      a.stun=Math.max(0,(a.stun||0)-dt);for(const k of ['freezeTime','slowTime','staffCooldown'])if(a[k]!==undefined)a[k]=Math.max(0,a[k]-dt);a.potionInvulnerable=Math.max(0,(a.potionInvulnerable||0)-dt);
    }
  }
  function impactTime(a,start,end,dt){const dx=end.x-start.x,dy=end.y-start.y,x=start.x-a.x,y=start.y-a.y,A=dx*dx+dy*dy,C=x*x+y*y-625;if(C<=0||A===0)return 0;const B=2*(x*dx+y*dy),D=Math.max(0,B*B-4*A*C);return clamp((-B-Math.sqrt(D))/(2*A),0,1)*dt;}
  function disasterImmune(s,a,at){const f=shieldFrames.get(s);return immune(s,a,at)||a===s.duck&&(f?f.duck>at:s.combat.invulnerable>0);}
  const sweepingBossImmune=(a,cause)=>a.id!==undefined&&a.kind!=='scorpion'&&['sandstorm','blizzard','tsunami'].includes(cause);
  function tickDisasters(s,dt,rng){D.tick(s,dt,{
    monsters:()=>F.monsters(s),
    immune:(a,event)=>weatherBossImmune(s,a,event),
    ice:(a,n,freeze,at,cause,event)=>{if(a.noCoop&&event?.itemWeather)return;if(sweepingBossImmune(a,cause))return;if(weatherBossImmune(s,a,event)){if(a.hp>0&&freeze)a.freezeTime=Math.max(a.freezeTime||0,Math.max(0,freeze-(dt-at)));return;}if(a.id===undefined&&disasterImmune(s,a,at))return;if(n===Infinity){if(a.id!==undefined)a.hp=0;else killActor(s,a,at);}else if(a.id!==undefined)F.hurt(a,n);else if(a===s.duck)damageDuck(s,n,at);else damageGoose(s,n,at);if(a.hp>0&&freeze&&!(a.id===undefined&&(shieldFrames.get(s)?.armor?.[a===s.duck?'duck':'goose']??(a===s.duck?s.combat.armorTime:s.combat.gooseArmorTime))>at)&&!(a.id===undefined&&disasterImmune(s,a,at)))a.freezeTime=Math.max(a.freezeTime||0,Math.max(0,freeze-(dt-at)));if(a.hp<=0&&a.id===undefined)s.combat.weather.cause=cause;},
    iceEffect:p=>{effect(s,p,'雪崩 · 10000','#5e9bbb');s.combat.audioEvents.push('explosion');},
    wave:(w,at,rng)=>F.onWave(s,w,at,rng),
    kill:(a,at,cause,event)=>{if(weatherBossImmune(s,a,event)||sweepingBossImmune(a,cause))return;if(a.id!==undefined){if(cause==='giant'&&a.kind!=='scorpion')F.hurt(a,a.kind==='godzilla'?5000:100);else a.hp=0;return;}if(cause==='giant'){a.hp=0;if(a===s.goose)reviveGoose(s,at);else reviveDuck(s,at);}else if(!disasterImmune(s,a,at))killActor(s,a,at);},
    giantImpact:m=>{s.combat.audioEvents.push('explosion');effect(s,m,'巨型陨石撞击！','#c44332');notice(s,'巨型陨石撞击！范围内角色无视所有无敌与伤害保护直接秒杀；哥斯拉受到5000点伤害，其他首领受到100点伤害（第20关免疫）。');},
    burn:(a,amount,from,to)=>{const f=shieldFrames.get(s);let cursor=from;
      while(cursor<to-1e-10&&a.hp>0){const ends=[f?f.potions[a===s.duck?'duck':'goose']:a.potionInvulnerable||0];if(a===s.duck)ends.push(f?.duck??s.combat.invulnerable,f?.duckRevive??s.combat.duckReviveTime,f?.duckRevivedAt!==undefined?f.duckRevivedAt+2:0);else{ends.push(f?.gooseItemRevive??s.combat.gooseItemReviveTime,f?.gooseItemRevivedAt!==undefined?f.gooseItemRevivedAt+2:0);if(hellGooseAI(s))ends.push(f?.time??s.combat.gooseShieldTime,f?.revive??s.combat.gooseReviveTime,f?.revivedAt!==undefined?f.revivedAt+2:0);}cursor=Math.max(cursor,...ends);if(cursor>=to)break;
        const rate=reduceDamage(s,a,200),span=Math.min(to-cursor,a.hp/rate);directDamage(s,a,200*span,true,cursor+span);cursor+=span;if(a.hp<=0)s.combat.weather.cause='lava';
      }
    }
  },rng);}
  function tick(s,dt,rng=Math.random){
    if(s.phase!=='playing')return;const c=s.combat;if(syncCoop(s))c.coopTime=(c.coopTime||0)+dt;shieldFrames.set(s,{gooseItemRevive:c.gooseItemReviveTime||0,time:c.gooseShieldTime||0,revive:c.gooseReviveTime||0,duckRevive:c.duckReviveTime||0,duck:c.invulnerable||0,potions:{duck:s.duck.potionInvulnerable||0,goose:s.goose.potionInvulnerable||0},grants:{},dt,armor:{duck:c.armorTime||0,goose:c.gooseArmorTime||0}});tickStaffPoison(s,dt);tickStatuses(s,dt);
    for(const m of F.monsters(s)){if(m.noCoop){m.poisonTime=0;m.poisonTick=0;continue;}let remaining=Math.min(dt,m.poisonTime||0);while(remaining>1e-9&&m.hp>0){const step=Math.min(remaining,m.poisonTick||1);m.poisonTick=(m.poisonTick||1)-step;remaining-=step;if(m.poisonTick<1e-8){m.poisonTick=1;F.hurt(m,50);}}if(m.poisonTime!==undefined){m.poisonTime=Math.max(0,m.poisonTime-dt);if(m.poisonTime===0)m.poisonTick=0;}}
    for(const a of [s.duck,s.goose]){const remaining=a.healTime||0;if(a.hp<=0){a.healTime=0;continue;}a.hp=Math.min(a.maxHp,a.hp+10*Math.min(dt,remaining));a.healTime=Math.max(0,remaining-dt);if(a.healTime<1e-8)a.healTime=0;}
    for(const key of ['gooseItemReviveTime','duckReviveTime','gooseBlinkCooldown','gooseSprintCooldown','gooseSprintTime','gooseBlinkFlash','gooseReviveTime','gooseShieldTime','gooseShieldCooldown','root','invulnerable','attackCooldown','netCooldown','gooseArmorTime','gooseArmorCooldown','armorTime','armorCooldown','cloneTime','cloneCooldown'])c[key]=Math.max(0,(c[key]||0)-dt);
    for(const key of ['gooseBlinkCooldown','gooseSprintCooldown','gooseSprintTime','gooseBlinkFlash'])if(c[key]<1e-8)c[key]=0;
    if(c.cloneTime===0)c.clones=[];syncClones(s);
    for(const actor of [s.duck,s.goose,...(c.clones||[])]){actor.fireFlash=Math.max(0,(actor.fireFlash||0)-dt);if(actor===s.duck||actor===s.goose){actor.haste=Math.max(0,actor.haste-dt);actor.fireCooldown=Math.max(0,actor.fireCooldown-dt);actor.potionCooldown=Math.max(0,(actor.potionCooldown||0)-dt);}}
    prune(s);c.effects=c.effects.filter(x=>(x.life-=dt)>0);
    // 兼容旧存档中的待落网状态，恢复后立即结算；瞬移恢复期内延后，不显示落点。
    if(!coopActive(s)&&c.netWindup>0&&!gooseBlinkRecovering(s)){c.netWindup=0;c.netTarget=null;if(c.invulnerable===0&&!(s.duck.potionInvulnerable>0)&&!(c.armorTime>0))c.root=1.5;}
    else if(gooseShouldNet(s))castNet(s);
    for(let i=c.bullets.length-1;i>=0;i--){const b=c.bullets[i];if(coopActive(s)&&b.targetId===undefined){c.bullets.splice(i,1);continue;}const old={x:b.x,y:b.y},target=b.targetId!==undefined?F.monsters(s).find(o=>o.id===b.targetId&&o.hp>0):(b.owner==='duck'?s.goose:s.duck);if(!target){c.bullets.splice(i,1);continue;}
      // 概率在开枪时确定；命中弹跟随目标，落空弹永不造成伤害。
      if(b.willHit!==false){const gap=dist(b,target);if(gap>0){b.vx=(target.x-b.x)/gap*760;b.vy=(target.y-b.y)/gap*760;}}
      b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
      if(b.willHit!==false&&segmentDistance(target,old,b)<25){const damage=b.damage||100;const dealt=target.id!==undefined?F.hurt(target,damage):b.bypassProtection?(disasterImmune(s,target,impactTime(target,old,b,dt))?0:directDamage(s,target,damage,true,impactTime(target,old,b,dt))):b.owner==='duck'?damageGoose(s,damage,impactTime(target,old,b,dt)):damageDuck(s,damage,impactTime(target,old,b,dt));if((b.headshot===true||(b.headshot===undefined&&damage===200))&&dealt>0){effect(s,target,'爆头！','#b78a23');c.audioEvents.push('headshot');}c.bullets.splice(i,1);}
      else if(b.life<=0||b.x<0||b.x>M.width||b.y<0||b.y>M.height)c.bullets.splice(i,1);
    }
    for(let i=c.potionShots.length-1;i>=0;i--){const shot=c.potionShots[i],target=shot.targetId!==undefined?F.monsters(s).find(m=>m.id===shot.targetId&&m.hp>0):shot.owner==='duck'?s.goose:s.duck;
      if(!target||target.hp<=0||shot.kind!=='omen'&&target.noCoop||coopActive(s)&&shot.targetId===undefined){c.potionShots.splice(i,1);continue;}const gap=dist(shot,target);shot.life-=dt;
      const old={x:shot.x,y:shot.y},legacy=shot.trackingRange===undefined;let vx=legacy?0:shot.vx,vy=legacy?0:shot.vy;
      if((legacy||gap<=shot.trackingRange)&&gap>0){vx=(target.x-shot.x)/gap*480;vy=(target.y-shot.y)/gap*480;if(!legacy){shot.vx=vx;shot.vy=vy;}}
      const travel=Math.min(480*dt,shot.distance===undefined?Infinity:Math.max(0,shotRange(shot)-shot.distance)),next={x:shot.x+vx/480*travel,y:shot.y+vy/480*travel};if(shot.distance!==undefined)shot.distance+=travel;
      if(segmentDistance(target,old,next)<=25){const at=impactTime(target,old,next,travel/480);if(shot.kind==='omen')allWeather(s,target,'天灾印记');else if(shot.outcome)potionImpact(s,shot,target,at);else if(shot.lethal){const damage=shot.damage===undefined?(advanced(s)?400:0):shot.damage,hard=damage>0;if(hard)directDamage(s,target,damage);else killActor(s,target,at);if(target.hp<=0)c.deathCause='potion';effect(s,target,hard?`药水 −${damage}！`:'药水秒杀！','#a146a8');notice(s,hard?`困难药水触发：${damage} 点伤害，无视伤害保护！`:'药水触发 10% 秒杀！');}else{effect(s,target,'药水未生效','#9467b4');notice(s,advanced(s)?'药水命中，本次未触发伤害。':'药水命中，本次未触发秒杀。');}c.potionShots.splice(i,1);}
      else if(shot.life<=0||shot.distance>=shotRange(shot)||!M.contains(next))c.potionShots.splice(i,1);
      else{shot.x=next.x;shot.y=next.y;}
    }
    S.tick(s,dt,{contact:(a,n,kind)=>{const dealt=a===s.duck?damageDuck(s,n):damageGoose(s,n);if(a.hp<=0)c.deathCause=kind;return dealt;},ranged:(a,n)=>{const dealt=a===s.duck?damageDuck(s,n):damageGoose(s,n);if(a.hp<=0)c.deathCause='worm';return dealt;},poison:(a,n,at)=>{const dealt=disasterImmune(s,a,at)?0:directDamage(s,a,n,true,at);if(a.hp<=0)c.deathCause='venom';return dealt;}});
    G.tickBears(s,dt,{contact:(a,n)=>{if(a.id!==undefined)return F.hurt(a,n);const hit=a===s.duck?damageDuck(s,n):damageGoose(s,n);if(a.hp<=0)c.deathCause='bear';return hit;},freeze:(a,time)=>{if(a.id===undefined&&(disasterImmune(s,a,dt)||(a===s.duck?c.armorTime:c.gooseArmorTime)>0))return;a.freezeTime=Math.max(a.freezeTime||0,time);}});
    Z.tick(s,dt,{damage:(a,n,at,kind)=>{if(disasterImmune(s,a,at))return 0;const hit=kind==='burn'?directDamage(s,a,n,true,at):a===s.duck?damageDuck(s,n,at):damageGoose(s,n,at);if(a.hp<=0)c.deathCause=kind==='burn'?'atomic-burn':kind==='breath'?'atomic':'godzilla';return hit;}});
    F.tick(s,dt,{splash:(a,amount,at)=>{if(!disasterImmune(s,a,at))directDamage(s,a,amount,true,at);},contact:(a,amount)=>{if(a===s.duck)damageDuck(s,amount);else damageGoose(s,amount);}});R.tick(s,dt,(a,n,at,kind)=>{if(disasterImmune(s,a,at))return;const dealt=a===s.duck?damageDuck(s,n,at):damageGoose(s,n,at);if(kind==='ice'&&a.hp>0)a.slowTime=Math.max(a.slowTime||0,Math.max(0,5-(dt-at)));if(a.hp<=0)c.deathCause=kind==='ice'?'ice-spike':'water-column';effect(s,a,(kind==='ice'?'冰锥':'水柱')+' −'+Math.round(dealt),kind==='ice'?'#70a7c8':'#418fbb');});A.spread(s,dt);tickWeather(s,dt,rng);tickDisasters(s,dt,rng);syncCoop(s);contacts(s,rng);c.spawnTimer-=dt;if(c.spawnTimer<=0){c.spawnTimer=4;replenish(s,rng);}
    const frame=shieldFrames.get(s);if(frame?.gooseItemRevivedAt!==undefined)c.gooseItemReviveTime=Math.min(2,Math.max(0,2-(dt-frame.gooseItemRevivedAt)));if(frame?.duckRevivedAt!==undefined)c.duckReviveTime=Math.min(2,Math.max(0,2-(dt-frame.duckRevivedAt)));if(frame?.revivedAt!==undefined)c.gooseReviveTime=Math.min(2,Math.max(0,2-(dt-frame.revivedAt)));
    if(frame)for(const [k,at] of Object.entries(frame.grants))s[k].potionInvulnerable=Math.max(0,2-(dt-at));
    duckExecute(s);shieldFrames.delete(s);
  }
  function restoreItemWeather(s){const w=s.combat.weather;if(!w)return;
    if(w.itemWeather===undefined){w.itemWeather=!!w.potionTarget;if(w.itemWeather){for(const e of [w,...(w.vortices||[]),...(w.strikes||[]),...(w.meteors||[]),...(w.rocks||[]),...(w.lava||[]),...(w.waves||[]),...(w.stormWaves||[]),w.giantMeteor,...(w.ice?.waves||[]),...(w.ice?.falls||[])])if(e)e.itemWeather=true;}}
    if(w.staffTargets?.lightning)for(const e of w.strikes||[])if(e.itemWeather===undefined)e.itemWeather=true;
  }
  function serialize(s){S.init(s.combat);A.boostAll(s);R.init(s.combat);return copy({duckUpgradeVersion:1,balanceVersion:4,role:s.role,difficulty:s.difficulty||'normal',duck:{reviveCharges:s.duck.reviveCharges||0,teleports:s.duck.teleports||0,staffCharges:s.duck.staffCharges||0,staffCooldown:s.duck.staffCooldown||0,freezeTime:s.duck.freezeTime||0,slowTime:s.duck.slowTime||0,staffPoisonTime:s.duck.staffPoisonTime||0,staffPoisonTick:s.duck.staffPoisonTick||0,healTime:s.duck.healTime||0,sniperAmmo:s.duck.sniperAmmo||0,weapon:s.duck.weapon||'pistol',omenArmed:!!s.duck.omenArmed,venomTime:s.duck.venomTime||0,venomTick:s.duck.venomTick||0,stun:s.duck.stun||0,poisonTime:s.duck.poisonTime||0,poisonTick:s.duck.poisonTick||0,potionInvulnerable:s.duck.potionInvulnerable||0,hp:s.duck.hp,maxHp:s.duck.maxHp,haste:s.duck.haste,ammo:s.duck.ammo,fireCooldown:s.duck.fireCooldown,potions:s.duck.potions,potionCooldown:s.duck.potionCooldown},goose:{reviveCharges:s.goose.reviveCharges||0,teleports:s.goose.teleports||0,staffCharges:s.goose.staffCharges||0,staffCooldown:s.goose.staffCooldown||0,freezeTime:s.goose.freezeTime||0,slowTime:s.goose.slowTime||0,staffPoisonTime:s.goose.staffPoisonTime||0,staffPoisonTick:s.goose.staffPoisonTick||0,healTime:s.goose.healTime||0,sniperAmmo:s.goose.sniperAmmo||0,weapon:s.goose.weapon||'pistol',omenArmed:!!s.goose.omenArmed,venomTime:s.goose.venomTime||0,venomTick:s.goose.venomTick||0,stun:s.goose.stun||0,poisonTime:s.goose.poisonTime||0,poisonTick:s.goose.poisonTick||0,potionInvulnerable:s.goose.potionInvulnerable||0,hp:s.goose.hp,maxHp:s.goose.maxHp,haste:s.goose.haste,ammo:s.goose.ammo,fireCooldown:s.goose.fireCooldown,potions:s.goose.potions,potionCooldown:s.goose.potionCooldown},combat:{...s.combat,events:[],effects:[],audioEvents:[]}});}
  const num=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
  const pos=p=>p&&num(p.x,B.left,B.right)&&num(p.y,B.top,B.bottom);
  function valid(data,elapsed){
    if(!data||!data.combat||(data.role!==undefined&&!['duck','goose'].includes(data.role))||(data.difficulty!==undefined&&!['normal','hard','hell'].includes(data.difficulty)))return false;
    if(data.duckUpgradeVersion!==undefined&&data.duckUpgradeVersion!==1)return false;
    if(data.balanceVersion!==undefined&&![2,3,4].includes(data.balanceVersion))return false;
    for(const key of ['duck','goose']){const a=data[key];if(!a||!Number.isSafeInteger(a.maxHp)||a.maxHp<(data.difficulty==='hell'?(key==='duck'?(data.role==='goose'?100:30)*(data.duckUpgradeVersion===1?2:1):(data.role==='duck'?6000:750)):(key==='duck'?(data.difficulty==='hard'&&data.balanceVersion>=2?(data.balanceVersion>=3&&data.role==='goose'?100:30):10):data.difficulty==='hard'?(data.balanceVersion>=4&&data.role==='duck'?2250:750):1000))||a.maxHp>(key==='duck'&&data.difficulty==='hell'?200000:100000)||!num(a.hp,coopActive({combat:data.combat})&&key!==(data.role||'duck')?0:1,a.maxHp)||!num(a.haste,0,3)||!Number.isInteger(a.ammo)||!num(a.ammo,0,5)||!num(a.fireCooldown,0,.28))return false;}
    for(const a of [data.duck,data.goose])for(const [key,max] of Object.entries({staffCooldown:.6,freezeTime:10,slowTime:5,staffPoisonTime:6,staffPoisonTick:1,healTime:2,venomTime:5,venomTick:1,stun:1,poisonTime:5,poisonTick:1,potionInvulnerable:2}))if(a[key]!==undefined&&!num(a[key],0,max))return false;
    for(const a of [data.duck,data.goose])if((a.reviveCharges!==undefined&&(!Number.isInteger(a.reviveCharges)||!num(a.reviveCharges,0,1)))||(a.teleports!==undefined&&(!Number.isInteger(a.teleports)||!num(a.teleports,0,1)))||(a.staffCharges!==undefined&&(!Number.isInteger(a.staffCharges)||!num(a.staffCharges,0,3)))||(a.sniperAmmo!==undefined&&(!Number.isInteger(a.sniperAmmo)||!num(a.sniperAmmo,0,3)))||(a.weapon!==undefined&&!['pistol','sniper'].includes(a.weapon))||(a.omenArmed!==undefined&&typeof a.omenArmed!=='boolean'))return false;
    const c=data.combat;if(c.mineDeaths!==undefined&&(!c.mineDeaths||typeof c.mineDeaths!=='object'||Array.isArray(c.mineDeaths)||!Object.entries(c.mineDeaths).every(([key,type])=>['duck','goose'].includes(key)&&['land','water'].includes(type))))return false;if(c.gooseItemRevived!==undefined&&typeof c.gooseItemRevived!=='boolean'||c.gooseItemReviveTime!==undefined&&!num(c.gooseItemReviveTime,0,2)||(c.gooseItemReviveTime||0)>0&&c.gooseItemRevived!==true)return false;if(c.finalBossBattle!==undefined&&typeof c.finalBossBattle!=='boolean')return false;if(c.duckRevived!==undefined&&typeof c.duckRevived!=='boolean'||c.duckReviveTime!==undefined&&!num(c.duckReviveTime,0,2))return false;if((c.duckReviveTime||0)>0&&c.duckRevived!==true)return false;if(c.omenTrial!==undefined&&typeof c.omenTrial!=='boolean')return false;
    if(c.coopTime!==undefined&&!num(c.coopTime,0,Number.MAX_SAFE_INTEGER)||c.cooperating!==undefined&&typeof c.cooperating!=='boolean')return false;
    if(c.weather){const w=c.weather,list=v=>Array.isArray(v)?v:[],events=[w,...list(w.vortices),...list(w.strikes),...list(w.meteors),...list(w.rocks),...list(w.lava),...list(w.waves),...list(w.stormWaves),w.giantMeteor,...list(w.ice?.waves),...list(w.ice?.falls)];if(events.some(e=>e&&e.itemWeather!==undefined&&typeof e.itemWeather!=='boolean'))return false;}
    if(!R.valid(c)||!Z.valid(c)||!F.valid(c)||!S.valid(c)||!G.valid(c)||!G.validWeather(c.weather))return false;
    for(const m of F.monsters({combat:c}))if(m.hardBossBoost!==undefined&&(typeof m.hardBossBoost!=='boolean'||m.hardBossBoost&&data.difficulty!=='hard')||m.noCoop!==undefined&&typeof m.noCoop!=='boolean'||m.summoner!==undefined&&(m.noCoop!==true||!['duck','goose'].includes(m.summoner)))return false;
    for(const m of F.monsters({combat:c}))for(const [key,max] of Object.entries({venomTime:5,venomTick:1,freezeTime:10,slowTime:5,staffPoisonTime:6,staffPoisonTick:1,poisonTime:5,poisonTick:1,stun:1}))if(m[key]!==undefined&&!num(m[key],0,max))return false;
    if(c.gooseRevived!==undefined&&typeof c.gooseRevived!=='boolean')return false;
    for(const [key,max] of Object.entries({gooseBlinkCooldown:25,gooseSprintCooldown:25,gooseSprintTime:5,gooseBlinkFlash:.3,gooseReviveTime:2,gooseShieldTime:1,gooseShieldCooldown:15}))if(c[key]!==undefined&&!num(c[key],0,max))return false;
    for(const a of [data.duck,data.goose])if((a.potions!==undefined&&(!Number.isInteger(a.potions)||!num(a.potions,0,3)))||(a.potionCooldown!==undefined&&!num(a.potionCooldown,0,.6)))return false;
    if(c.deathCause!==undefined&&![null,'ice-spike','water-column','godzilla','atomic','atomic-burn','staff','potion','execution','blink','scorpion','worm','bear','venom'].includes(c.deathCause))return false;
    if(c.potionShots!==undefined&&(!Array.isArray(c.potionShots)||c.potionShots.length>16||!c.potionShots.every(p=>pos(p)&&(p.targetId===undefined||Number.isSafeInteger(p.targetId)&&p.targetId>0&&p.outcome!==undefined)&&(p.kind===undefined||p.kind==='omen'&&p.outcome==='weather'&&(p.trackingRange===300&&p.maxDistance===undefined||p.trackingRange===600&&p.maxDistance===OMEN_RANGE)&&p.distance!==undefined)&&['duck','goose'].includes(p.owner)&&num(p.life,0,4)&&(p.outcome!==undefined?['kill','poison','stun','damage','shield','weather'].includes(p.outcome):typeof p.lethal==='boolean')&&(p.damage===undefined||[0,400,800].includes(p.damage)))))return false;
    if((c.potionShots||[]).some(p=>p.maxDistance!==undefined&&!(p.kind==='omen'&&p.maxDistance===OMEN_RANGE&&p.trackingRange===600)))return false;
    if((c.potionShots||[]).some(p=>p.distance!==undefined&&!num(p.distance,0,shotRange(p))))return false;
    if((c.potionShots||[]).some(p=>p.trackingRange===undefined?(p.vx!==undefined||p.vy!==undefined):(p.trackingRange!==300&&!(p.kind==='omen'&&p.trackingRange===600&&p.maxDistance===OMEN_RANGE))||!num(p.vx,-480,480)||!num(p.vy,-480,480)||Math.abs(Math.hypot(p.vx,p.vy)-480)>.001))return false;
    const validStaffRef=r=>r&&pos(r)&&(r.caster===undefined||['duck','goose'].includes(r.caster))&&['duck','goose','monster'].includes(r.kind)&&(r.kind==='monster'?Number.isSafeInteger(r.id)&&r.id>0:r.id===undefined);
    if(c.weather){const w=c.weather;if(w.potionTarget!==undefined&&!validStaffRef(w.potionTarget))return false;if(w.staffTargets!==undefined&&(!w.staffTargets||typeof w.staffTargets!=='object'||Array.isArray(w.staffTargets)||!Object.entries(w.staffTargets).every(([k,r])=>['meteor','shower','lightning'].includes(k)&&validStaffRef(r))))return false;
      for(const v of [w,...(Array.isArray(w.vortices)?w.vortices:[])])if(v&&v.staffTarget!==undefined&&!validStaffRef(v.staffTarget))return false;}
    if(c.weather!==undefined&&c.weather!==null){const w=c.weather;if((w.omenTargetGoose!==undefined&&typeof w.omenTargetGoose!=='boolean')||(w.vortexWarning!==undefined&&!num(w.vortexWarning,0,.9))||(w.target!==undefined&&w.target!==null&&!pos(w.target))||(w.center!==undefined&&!pos(w.center))||typeof w.vortex!=='boolean'||typeof w.lightning!=='boolean'||!num(w.vortexTimer,0,1)||!num(w.lightningTimer,0,2.8)||![null,'vortex','lightning','meteor','shower','tsunami','eruption','lava','giant','sandstorm','blizzard','avalanche'].includes(w.cause)||!Array.isArray(w.strikes)||w.strikes.length>8||(!w.lightning&&w.strikes.length)||!w.strikes.every(b=>pos(b)&&num(b.delay,0,b.hit?.25:.9)&&typeof b.hit==='boolean'&&(b.tracking===undefined||typeof b.tracking==='boolean')))return false;}
    if(c.weather?.vortices!==undefined&&(!Array.isArray(c.weather.vortices)||c.weather.vortices.length>7||!c.weather.vortices.every(v=>v&&v.vortex===true&&pos(v.center)&&(v.target===null||pos(v.target))&&num(v.vortexTimer,0,1)&&num(v.vortexWarning,0,.9))))return false;
    if(!D.valid(c.weather))return false;
    if(c.weather){const w=c.weather;
      for(const key of ['meteor','meteorShower'])if(w[key]!==undefined&&typeof w[key]!=='boolean')return false;
      for(const [key,max] of Object.entries({meteorTimer:5,showerTimer:8}))if(w[key]!==undefined&&!num(w[key],0,max))return false;
      if(w.meteors!==undefined&&(!Array.isArray(w.meteors)||w.meteors.length>24||!w.meteors.every(m=>pos(m)&&(m.staffCaster===undefined||['duck','goose'].includes(m.staffCaster))&&['meteor','shower'].includes(m.kind)&&typeof m.hit==='boolean'&&(m.tracking===undefined||typeof m.tracking==='boolean')&&num(m.delay,0,m.hit?.5:(m.warningDuration??1.2))&&(m.warningDuration===undefined||[.8,1.2].includes(m.warningDuration))&&(m.radius===undefined||(m.kind==='meteor'?[70,140]:[55,110]).includes(m.radius)))))return false;
    }
    for(const [key,max] of Object.entries({root:1.5,invulnerable:1,attackCooldown:1.2,netCooldown:8,netWindup:.65,spawnTimer:4}))if(!num(c[key],0,max))return false;
    for(const [key,max] of Object.entries({armorTime:1.5,armorCooldown:20,gooseArmorTime:1.5,gooseArmorCooldown:8}))if(c[key]!==undefined&&!num(c[key],0,max))return false;
    for(const [key,max] of Object.entries({cloneTime:6,cloneCooldown:20}))if(c[key]!==undefined&&!num(c[key],0,max))return false;
    if((c.cloneTime||0)>0&&!Array.isArray(c.clones))return false;
    if(c.clones!==undefined&&(!Array.isArray(c.clones)||c.clones.length!==((c.cloneTime||0)>0?2:0)||!c.clones.every((x,i)=>pos(x)&&x.dx===(i===0?-62:62)&&(x.face===1||x.face===-1)&&typeof x.moving==='boolean'&&num(x.fireFlash,0,.12))))return false;
    if(c.netWindup>0?!pos(c.netTarget):c.netTarget!==null)return false;
    if(!Array.isArray(c.damageLog)||c.damageLog.length>200||!c.damageLog.every(x=>x&&num(x.at,0,elapsed+(c.coopTime||0))&&num(x.amount,.001,data.difficulty==='hard'||data.role==='goose'?400:200))||c.damageLog.filter(x=>elapsed+(c.coopTime||0)-x.at<5-1e-9).reduce((n,x)=>n+x.amount,0)>(data.difficulty==='hard'||data.role==='goose'?400.000001:200.000001))return false;
    if(!Array.isArray(c.items)||c.items.length>68||!c.items.every(x=>pos(x)&&['med','speed','gun','potion','sniper','omen','staff','teleport','revive','summon'].includes(x.type)))return false;
    for(const [type,cap] of Object.entries(M.specialItemCaps))if(c.items.filter(p=>p.type===type).length>cap)return false;
    if(!Array.isArray(c.mines)||c.mines.length>48||!c.mines.every(x=>pos(x)&&['water','land'].includes(x.type)&&(x.floodMine===true?x.type==='water':M.isWater(x)===(x.type==='water'))))return false;
    if(!Array.isArray(c.bullets)||c.bullets.length>64||!c.bullets.every(x=>x&&num(x.x,0,M.width)&&num(x.y,0,M.height)&&num(x.vx,-760,760)&&num(x.vy,-760,760)&&num(x.life,0,2)&&['duck','goose'].includes(x.owner)&&(x.targetId===undefined||Number.isSafeInteger(x.targetId)&&x.targetId>0)&&(x.homing===undefined||typeof x.homing==='boolean')&&(x.clone===undefined||typeof x.clone==='boolean')&&(x.willHit===undefined||typeof x.willHit==='boolean')&&(x.damage===undefined||[50,100,200,400,800].includes(x.damage))&&(x.headshot===undefined||typeof x.headshot==='boolean')&&(x.hitChance===undefined||[.1,.2,.4,.5,.6,1].includes(x.hitChance))))return false;
    if(c.bullets.some(b=>b.weapon!==undefined?(b.weapon!=='sniper'||b.bypassProtection!==true||![400,800].includes(b.damage)||![.1,.6].includes(b.hitChance)||b.homing!==false):(b.bypassProtection!==undefined||b.damage===800||b.hitChance===.6)))return false;
    return true;
  }
  function restore(s,data){if(!valid(data,s.elapsed))throw new Error('Invalid combat save');gooseMemory.delete(s);const d=copy(data);if(d.role)s.role=d.role;s.difficulty=d.difficulty||'normal';Object.assign(s.duck,{staffCharges:0,staffCooldown:0,freezeTime:0,slowTime:0,staffPoisonTime:0,staffPoisonTick:0,healTime:0,venomTime:0,venomTick:0,stun:0,poisonTime:0,poisonTick:0,potionInvulnerable:0,potions:0,potionCooldown:0,sniperAmmo:0,weapon:'pistol',omenArmed:false,teleports:0,reviveCharges:0},d.duck);Object.assign(s.goose,{staffCharges:0,staffCooldown:0,freezeTime:0,slowTime:0,staffPoisonTime:0,staffPoisonTick:0,healTime:0,venomTime:0,venomTick:0,stun:0,poisonTime:0,poisonTick:0,potionInvulnerable:0,potions:0,potionCooldown:0,sniperAmmo:0,weapon:'pistol',omenArmed:false,teleports:0,reviveCharges:0},d.goose);s.combat={mineDeaths:{},gooseItemRevived:false,gooseItemReviveTime:0,duckRevived:false,duckReviveTime:0,coopTime:0,cooperating:false,gooseBlinkCooldown:0,gooseSprintCooldown:0,gooseSprintTime:0,gooseBlinkFlash:0,gooseReviveTime:0,gooseShieldTime:0,gooseShieldCooldown:0,gooseRevived:false,potionShots:[],deathCause:null,weather:null,gooseArmorTime:0,gooseArmorCooldown:0,cloneTime:0,cloneCooldown:0,clones:[],armorTime:0,armorCooldown:0,...d.combat,effects:[],events:[],audioEvents:[]};if(s.difficulty==='hard'&&d.balanceVersion===undefined){s.duck.maxHp+=20;s.duck.hp=Math.min(s.duck.maxHp,s.duck.hp+20);const oldMax=s.goose.maxHp;s.goose.maxHp=Math.max(750,oldMax-750);s.goose.hp=Math.max(1,Math.ceil(s.goose.hp/oldMax*s.goose.maxHp));for(const key of ['armorCooldown','cloneCooldown'])s.combat[key]*=.5;s.duck.fireCooldown*=.5;s.duck.potionCooldown*=.5;if(s.skill)s.skill.cooldown*=.5;}if(s.difficulty==='hard'&&s.role==='goose'&&(d.balanceVersion===undefined||d.balanceVersion<3)){s.duck.maxHp+=70;s.duck.hp=Math.min(s.duck.maxHp,s.duck.hp+70);}if(hardGooseAI(s)&&(d.balanceVersion===undefined||d.balanceVersion<4)){s.goose.maxHp+=1500;s.goose.hp=Math.min(s.goose.maxHp,s.goose.hp+1500);for(const key of ['netCooldown','gooseArmorCooldown','attackCooldown'])s.combat[key]*=.8;s.goose.fireCooldown*=.8;s.goose.potionCooldown*=.8;}if(s.difficulty==='hell'&&d.duckUpgradeVersion!==1){s.duck.maxHp*=2;s.duck.hp*=2;}F.init(s.combat);S.init(s.combat);G.init(s.combat);Z.init(s.combat);A.boostAll(s);R.init(s.combat);restoreItemWeather(s);s.balanceVersion=4;if(s.combat.weather){D.defaults(s.combat.weather,s.elapsed);for(const [key,value] of Object.entries({meteor:false,meteorShower:false,meteorTimer:5,showerTimer:8,meteors:[]}))if(s.combat.weather[key]===undefined)s.combat.weather[key]=value;s.combat.weather.vortexWarning=s.combat.weather.vortexWarning||0;s.combat.weather.target=s.combat.weather.target||null;s.combat.weather.center=s.combat.weather.center||{x:640,y:380};for(const bolt of s.combat.weather.strikes)if(!bolt.hit&&!(advanced(s)&&bolt.tracking))bolt.delay=0;}syncCoop(s,s.combat.bears.some(b=>b.hp>0));}
  return {summonOutcome,openSummon,aiTeleport,teleportPlan,useTeleport,replenish,ensureFinalBosses,finalBossesDefeated,totalLevels:TOTAL_LEVELS,reviveDuck,staffTarget,useStaff,vortices,addVortex,omenRange:OMEN_RANGE,spawnTrialOmen,monsterItems,throwTarget,coopActive,syncCoop,clock,weaponPlan,monsterTarget,monsterAttack,weapon,ammunition,switchWeapon,giantRouteSafe,canCounterOctopus,nearbyCannon:F.nearby,floodActive:F.active,gooseBlink,gooseSprint,goosePlan,gooseAttack,gooseIntercept,gooseMoveSpeed,gooseMoveDistance,advanced,hellGooseAI,gooseShield,reviveGoose,world:M,meteorRadius,meteorThreat,weatherDanger,init,duckSpeed,duckCooldown,duckDamage,gooseSpeed,gooseCooldown,gooseDamageCap,configureLevel,tickWeather,player,enemy,isWater,damageDuck,damageGoose,beginDash,armor,summonClones,syncClones,moveDistance,castNet,fire,throwPotion,throwOmen,contacts,duckSteering,gooseSteering,tick,serialize,valid,restore,segmentDistance};
});
