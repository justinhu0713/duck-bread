/* 首领阵营：自然首领与盲盒首领敌对；同阵营不互相攻击。 */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./world.js'):root.DuckWorld);if(typeof module==='object'&&module.exports)module.exports=api;else root.DuckFactions=api;})(typeof globalThis!=='undefined'?globalThis:this,function(M){
 const monsters=s=>[...(s.combat.godzillas||[]),...(s.combat.octopuses||[]),...(s.combat.desert?.monsters||[]),...(s.combat.bears||[])];
 const boss=m=>m&&m.id!==undefined&&m.kind!=='scorpion';
 const damage=(s,n)=>n*(s.difficulty==='hard'?3:1),speed=s=>s.difficulty==='hard'?1.1:1;
 function boost(s,m){if(s.difficulty==='hard'&&boss(m)&&m.hardBossBoost!==true){m.hp*=2;m.maxHp*=2;m.hardBossBoost=true;}return m;}
 function boostAll(s){for(const m of monsters(s))boost(s,m);}
 const hostile=(a,b)=>a!==b&&(a.kind!=='scorpion'||a.broodOf!==undefined)&&(b.kind!=='scorpion'||b.broodOf!==undefined)&&(a.noCoop===true)!==(b.noCoop===true);
 const owner=(s,a)=>a.noCoop===true?(a.summoner||(s.role==='goose'?'goose':'duck')):null;
 const targets=(s,a)=>[s.duck,s.goose,...monsters(s).filter(b=>hostile(a,b))].filter(b=>b.hp>0&&b!==s[owner(s,a)]);
 const actor=(s,ref)=>typeof ref==='number'?monsters(s).find(m=>m.id===ref):s[ref];
 const hurt=(a,n)=>{if(!a||a.hp<=0)return 0;const amount=Math.min(a.hp,n);a.hp-=amount;return amount;};
 const melee=(m,target)=>m.kind==='scorpion'||m.noCoop!==true||m.hp>=target.hp;
 const ranged=(m,target)=>m.kind!=='scorpion'&&(m.noCoop!==true||m.hp<target.hp);
 const standoff=(m,target,original)=>m.kind==='scorpion'?original:m.noCoop===true?(melee(m,target)?original:m.kind==='godzilla'?400:320):target.id!==undefined?(m.kind==='godzilla'?400:320):original;
 const travel=(m,target,budget,original)=>{const delta=Math.hypot(m.x-target.x,m.y-target.y)-standoff(m,target,original);return Math.min(budget,Math.max(m.noCoop&&ranged(m,target)?-budget:0,delta));};
 function move(m,target,budget,original){if(budget<=0)return;const d=Math.hypot(m.x-target.x,m.y-target.y),step=travel(m,target,budget,original),angle=(m.id%32)*Math.PI/16,ux=d?(target.x-m.x)/d:Math.cos(angle),uy=d?(target.y-m.y)/d:Math.sin(angle),B=M.bounds,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),point=(x,y)=>({x:clamp(x,B.left,B.right),y:clamp(y,B.top,B.bottom)});let p=point(m.x+ux*step,m.y+uy*step);if(step<0&&Math.hypot(p.x-target.x,p.y-target.y)<=d+.001){let best=d;for(let i=0;i<32;i++){const a=i*Math.PI/16,q=point(m.x+Math.cos(a)*Math.abs(step),m.y+Math.sin(a)*Math.abs(step)),gap=Math.hypot(q.x-target.x,q.y-target.y);if(gap>best){best=gap;p=q;}}}Object.assign(m,p);}
 function spread(s,dt){if(s.phase!=='playing'||dt<=0)return;const bosses=monsters(s).filter(m=>m.hp>0&&m.kind!=='scorpion').sort((a,b)=>a.id-b.id),B=M.bounds,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const movable=m=>!(m.stun>0||m.freezeTime>0||m.beam);for(let i=0;i<bosses.length;i++)for(let j=i+1;j<bosses.length;j++){const a=bosses[i],b=bosses[j],d=Math.hypot(a.x-b.x,a.y-b.y);const spacing=hostile(a,b)&&(a.noCoop&&melee(a,b)||b.noCoop&&melee(b,a))?48:120;if(d>=spacing)continue;const angle=((a.id*7+b.id*11)%64)*Math.PI/32,ux=d?(b.x-a.x)/d:Math.cos(angle),uy=d?(b.y-a.y)/d:Math.sin(angle),n=Number(movable(a))+Number(movable(b));if(!n)continue;const push=Math.min((spacing-d)/n,(spacing===48?150:90)*dt);if(movable(a)){a.x=clamp(a.x-ux*push,B.left,B.right);a.y=clamp(a.y-uy*push,B.top,B.bottom);}if(movable(b)){b.x=clamp(b.x+ux*push,B.left,B.right);b.y=clamp(b.y+uy*push,B.top,B.bottom);}}
 }
 return {boost,boostAll,damage,speed,move,melee,ranged,travel,spread,standoff,monsters,hostile,owner,targets,actor,hurt};
});
