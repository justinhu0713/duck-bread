/* 鸭鸭抢面包：无需依赖，可直接用浏览器打开。 */
(() => {
  'use strict';
  const canvas = document.getElementById('pond');
  let ctx = canvas.getContext('2d', {alpha:false});
  const el = id => document.getElementById(id);
  const M=window.DuckWorld;
  const W=M.width,H=M.height,VW=M.viewport.width,VH=M.viewport.height,DURATION=120,DUCK_SPEED=215,TOTAL_LEVELS=window.DuckCombat.totalLevels;
  const DASH_DISTANCE = 110, DASH_COOLDOWN = 20, BOOST_DURATION = 2;
  const bounds=M.bounds;
  const keys = new Set();
  const C=window.DuckCombat;
  let selectedRole='duck',selectedDifficulty=(['normal','hard','hell'].includes(readRaw('duck-bread-active-difficulty'))?readRaw('duck-bread-active-difficulty'):'normal');
  const sound = window.DuckAudio || {unlock(){},stop(){},warning(){},crunch(){},caught(){},explosion(){},gunshot(){},sniper(){},sniperReload(){},headshot(){},reload(){}};
  let warningCooldown=0, dangerArmed=true;
  const SAVE_KEY = 'duck-bread-save-v1', AUTO_SAVE_KEY='duck-bread-autosave-v1';
  const OMEN_TRIAL_KEY='duck-bread-omen-trial-used-20261025';
  let omenTrialUsed=readRaw(OMEN_TRIAL_KEY)==='1';
  let replaySession=false;
  const clearedByMode={normal:0,hard:0,hell:0};
  let autoSaveElapsed=0,lastManualRevision=readRaw(SAVE_KEY);
  migrateLegacySaves();
  const gameCard = el('game-card');
  let savedGame = readLatestSave();
  for(const mode of Object.keys(clearedByMode))refreshCleared(mode);
  let state, best = 0, last = performance.now(), clock = 0;
  try { best = Number(localStorage.getItem('duck-bread-best')) || 0; } catch (_) { /* 私密模式仍可玩 */ }
  best = Math.max(0, best);
  const rand = (a,b) => a + Math.random()*(b-a);
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  // 只接受当前版本、数值完整且位于游戏范围内的存档。
  function readRaw(key){try{return localStorage.getItem(key);}catch(_){return null;}}
  function readSave(key=SAVE_KEY) {
    try {
      const save = M.migrateSave(JSON.parse(readRaw(key)));
      const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= bounds.left && p.x <= bounds.right && p.y >= bounds.top && p.y <= bounds.bottom;
      const bird = p => point(p) && (p.face === 1 || p.face === -1);
      if (!save || ![1,2].includes(save.version) || !Number.isFinite(save.savedAt) || !Number.isFinite(save.elapsed) || save.elapsed < 0 || (save.elapsed > DURATION || save.elapsed===DURATION&&!save.completed&&!C.coopActive({combat:save.battle?.combat||{}})) || !Number.isSafeInteger(save.score) || save.score < 0 || save.score % 10 !== 0 || !bird(save.duck) || !bird(save.goose) || !Array.isArray(save.bread) || ![5,20,M.breadCap].includes(save.bread.length) || !save.bread.every(b => point(b) && Number.isFinite(b.bob))) return null;
      if(save.difficulty!==undefined&&(!['normal','hard','hell'].includes(save.difficulty)||(save.battle?.difficulty!==undefined&&save.battle.difficulty!==save.difficulty)))return null;
      if(save.completed!==undefined&&typeof save.completed!=='boolean')return null;if(save.campaignVersion!==undefined&&![2,3].includes(save.campaignVersion))return null;
      if(save.level!==undefined&&(!Number.isInteger(save.level)||save.level<1||save.level>TOTAL_LEVELS))return null;if(save.completed&&save.level!==TOTAL_LEVELS&&!(save.level===10&&!save.campaignVersion)&&!(save.level===20&&save.campaignVersion!==3))return null;
      if (save.skill && (!Number.isFinite(save.skill.cooldown) || save.skill.cooldown<0 || save.skill.cooldown>DASH_COOLDOWN || !Number.isFinite(save.skill.boost) || save.skill.boost<0 || save.skill.boost>BOOST_DURATION)) return null;
      if (save.aim && (!Number.isFinite(save.aim.x) || !Number.isFinite(save.aim.y) || Math.abs(Math.hypot(save.aim.x,save.aim.y)-1)>.001)) return null;
      if(save.version===2 && (!['duck','goose'].includes(save.role)||(save.battle?.role!==undefined&&save.battle.role!==save.role)||!C.valid(save.battle,save.elapsed)))return null;
      return {...save,source:key};
    } catch (_) { return null; }
  }
  function saveDifficulty(save){return save.difficulty||save.battle?.difficulty||'normal';}
  function modeKey(base,mode){return base+'-'+mode;}
  function migrateLegacySaves(){
    for(const base of [SAVE_KEY,AUTO_SAVE_KEY]){const old=readSave(base);if(!old)continue;const key=modeKey(base,old.difficulty||old.battle?.difficulty||'normal'),current=readSave(key);
      if(!current||current.savedAt<old.savedAt)try{localStorage.setItem(key,readRaw(base));}catch(_){}
    }
  }
  function readModeSave(base,mode=selectedDifficulty){
    const scoped=readSave(modeKey(base,mode)),legacy=readSave(base);
    const a=scoped&&saveDifficulty(scoped)===mode?scoped:null,b=legacy&&saveDifficulty(legacy)===mode?legacy:null;
    return !a?b:!b?a:a.savedAt>=b.savedAt?a:b;
  }
  function readLatestSave(mode=selectedDifficulty){const manual=readModeSave(SAVE_KEY,mode),automatic=readModeSave(AUTO_SAVE_KEY,mode);return !manual?automatic:!automatic?manual:manual.savedAt>=automatic.savedAt?manual:automatic;}
  function writeModeSave(base,save){
    migrateLegacySaves();const raw=JSON.stringify(save);localStorage.setItem(modeKey(base,save.difficulty||'normal'),raw);
    // 保留旧键镜像，升级前的手动原文已按模式迁移，避免覆盖另一模式的备份。
    localStorage.setItem(base,raw);
  }
  function refreshCleared(mode){
    const key='duck-bread-cleared-v1-'+mode;
    let stored=0;try{stored=JSON.parse(readRaw(key));}catch(_){}
    const saves=[readSave(modeKey(SAVE_KEY,mode)),readSave(modeKey(AUTO_SAVE_KEY,mode)),readSave(SAVE_KEY),readSave(AUTO_SAVE_KEY)].filter(s=>s&&saveDifficulty(s)===mode);
    const value=window.DuckCampaign.merge(Math.max(clearedByMode[mode],window.DuckCampaign.cleared(stored)),saves);
    clearedByMode[mode]=value;try{localStorage.setItem(key,JSON.stringify(value));}catch(_){}
    return value;
  }
  function levelControls(){
    const max=refreshCleared(selectedDifficulty),select=el('level-select'),old=Number(select.value);
    const signature=selectedDifficulty+':'+max;
    if(select.dataset.progress!==signature){select.replaceChildren();for(let i=1;i<=TOTAL_LEVELS;i++){const option=document.createElement('option');option.value=i;option.textContent=`第 ${i} 关 · ${i<=max?'已通关':'未解锁'}`;option.disabled=i>max;select.append(option);}select.value=String(max?Math.min(Math.max(old,1),max):1);select.dataset.progress=signature;}
    select.disabled=max===0;el('replay-level').disabled=max===0;
    el('level-progress').textContent=`${selectedDifficulty==='hell'?'地狱':selectedDifficulty==='hard'?'困难':'普通'}模式 · 已通关 ${max} / ${TOTAL_LEVELS} 关`+(replaySession?' · 正在重玩':'');
  }
  function replayLevel(){
    const level=Number(el('level-select').value);if(!window.DuckCampaign.canReplay(level,refreshCleared(selectedDifficulty)))return;
    checkpointMode();replaySession=true;start(level,0);levelControls();
    el('status').textContent=`正在重玩第 ${level} 关；本次不覆盖冒险存档，点击「继续存档」返回原进度。`;
  }
  function snapshot(){return {version:2,campaignVersion:3,mapVersion:M.version,completed:!!state.completed,difficulty:state.difficulty,level:state.level,role:state.role,battle:C.serialize(state),savedAt:Date.now(),elapsed:state.elapsed,score:state.score,duck:{...state.duck},goose:{...state.goose},bread:state.bread.map(b=>({...b})),skill:{...state.skill},aim:{...state.aim}};}
  function autoSave(){
    if(replaySession||!state||!['playing','paused'].includes(state.phase)||state.elapsed>=DURATION&&!C.coopActive(state)||C.player(state).hp<=0||C.enemy(state).hp<=0&&!C.coopActive(state)||readRaw(SAVE_KEY)!==lastManualRevision)return;
    try{const save=snapshot();writeModeSave(AUTO_SAVE_KEY,save);savedGame=readLatestSave(state.difficulty);autoSaveElapsed=0;}catch(_){/* 自动保存失败时仍可继续游玩，手动保存会显示错误。 */}
  }
  function saveControls() {
    el('save').disabled = replaySession || !['playing','paused'].includes(state.phase);
    el('save').title=replaySession?'重玩期间保留原冒险存档，不覆盖保存':'保存当前冒险';
    el('load').disabled = !savedGame;
    el('load-manual').disabled=!readModeSave(SAVE_KEY);
    el('load').textContent = savedGame ? '继续存档' : '无存档';
    el('load').title = savedGame ? `${savedGame.source?.startsWith(AUTO_SAVE_KEY)?'自动':'手动'}存档：${new Date(savedGame.savedAt).toLocaleString('zh-CN')} · ${savedGame.score} 分 · 剩余 ${Math.ceil(DURATION-savedGame.elapsed)} 秒` : '开始游戏后，点击「保存进度」创建存档';
  }
  function saveProgress() {
    if (replaySession || !['playing','paused'].includes(state.phase)) return;
    if (state.phase === 'playing') pause();
    const save = snapshot();
    try {
      writeModeSave(SAVE_KEY,save);lastManualRevision=readRaw(SAVE_KEY);
      savedGame = save; saveControls();
      el('message').textContent = `已保存：${state.score} 分，剩余 ${Math.ceil(DURATION-state.elapsed)} 秒。下次打开游戏，点击「继续存档」即可。`;
      el('status').textContent = '存档成功，游戏已暂停。存档保存在当前浏览器中。';
    } catch (_) {
      el('message').textContent = '保存失败：浏览器暂时不允许本地存储。可以继续本局游戏，或换普通浏览窗口再试。';
      el('status').textContent = '未能保存进度，请勿关闭本局。';
    }
  }
  function loadProgress(source) {
    sound.stop(); warningCooldown=0; dangerArmed=true;
    savedGame = source===SAVE_KEY?readModeSave(SAVE_KEY):readLatestSave(); saveControls();
    if (!savedGame) {el('status').textContent='没有可用存档，存档可能已被清除或损坏。';return;}
    replaySession=false;levelControls();
    const save = savedGame;lastManualRevision=readRaw(SAVE_KEY);autoSaveElapsed=0;
    if(save.completed&&(save.level===20&&save.campaignVersion!==3||save.level===10&&!save.campaignVersion)){
      const nextLevel=save.level+1;
      selectedRole=save.role||'duck';selectedDifficulty=save.difficulty||save.battle?.difficulty||'normal';fresh(nextLevel,save.score);state.phase='paused';rememberDifficulty();roleControls();keys.clear();hud();el('pause').disabled=false;el('pause').textContent='▶ 继续';
      show(`第${nextLevel}关已解锁！`,`原通关进度已保留，累计 ${state.score} 分，从第${nextLevel}关继续新挑战。`,`继续第${nextLevel}关 →`,'🦆 🏆','四十关挑战');el('status').textContent=`旧通关存档已接续到第${nextLevel}关，其他模式进度保留。`;autoSave();saveControls();draw();return;
    }

    state = {phase:'paused', elapsed:save.elapsed, score:save.score, duck:{...save.duck}, goose:{...save.goose}, bread:save.bread.map(b=>({...b})), particles:[], trail:[], ripple:0, skill:save.skill?{...save.skill}:{cooldown:0,boost:0}, aim:save.aim?{...save.aim}:{x:save.duck.face,y:0}};
    state.difficulty=save.difficulty||save.battle?.difficulty||'normal';state.role=save.role||'duck';state.level=save.level||1;C.init(state);if(save.battle)C.restore(state,save.battle);if(!state.combat.weather)C.configureLevel(state,state.level,()=>.5);if(!save.battle?.combat?.desert)state.combat.desert={monsters:[],shots:[],nextId:100000};
    if(!save.completed)C.ensureFinalBosses(state);else state.combat.finalBossBattle=false;
    while(state.bread.length<M.breadCap)spawnBread();
    selectedRole=state.role;selectedDifficulty=state.difficulty;rememberDifficulty();roleControls();
    keys.clear(); hud(); el('pause').disabled=false; el('pause').textContent='▶ 继续';
    show('存档已就位，鸭鸭归队！',`已恢复 ${state.score} 分，剩余 ${Math.ceil(DURATION-state.elapsed)} 秒。准备好后点击继续。`,'继续抢面包 →','🦆 💾','欢迎回到池塘');
    el('status').textContent='已读取存档；游戏暂停中，点击继续即可出发。';
    if(save.completed){state.phase='won';state.completed=true;el('pause').disabled=true;show('四十关全部通关！',`本模式已通关，累计 ${state.score} 分。`,'重新挑战四十关 →','🏆 🦆','挑战成功');hud();}
    draw();
  }
  function rememberDifficulty(){try{localStorage.setItem('duck-bread-active-difficulty',selectedDifficulty);}catch(_){}}
  function checkpointMode(){
    if(replaySession)return;
    if(state.phase==='playing'||state.phase==='paused'){autoSave();return;}
    if(state.phase==='won'||state.phase==='lost'){
      const completed=state.phase==='won'&&state.level===TOTAL_LEVELS,level=state.phase==='won'&&!completed?state.level+1:state.level,score=state.score;
      selectedRole=state.role;selectedDifficulty=state.difficulty;fresh(level,score);state.phase='paused';state.completed=completed;if(completed){state.combat.finalBossBattle=false;state.combat.godzillas=[];state.combat.godzillaBurns=[];state.combat.bears=[];state.combat.octopuses=[];state.combat.desert.monsters=state.combat.desert.monsters.filter(m=>m.kind==='scorpion');C.syncCoop(state);}lastManualRevision=readRaw(SAVE_KEY);autoSave();
    }
  }
  function switchDifficulty(mode){
    if(mode===selectedDifficulty&&mode===state.difficulty){if(state.phase==='ready'&&readLatestSave(mode))loadProgress();return;}
    sound.stop();keys.clear();checkpointMode();replaySession=false;selectedDifficulty=mode;rememberDifficulty();savedGame=readLatestSave(mode);
    if(savedGame){loadProgress();return;}
    fresh();roleControls();el('pause').disabled=true;el('pause').textContent='Ⅱ 暂停';
    show((mode==='hell'?'地狱':mode==='hard'?'困难':'普通')+'模式 · 第 1 关','这个模式还没有进度，准备好后开始挑战。','开始抢面包 →','🦆 🍞','独立模式进度');
    el('status').textContent='已切换模式；其他模式的关卡和存档已保留。';draw();
  }
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  async function toggleFullscreen() {
    try {
      if (fullscreenElement()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      } else {
        const enter = gameCard.requestFullscreen || gameCard.webkitRequestFullscreen;
        if (!enter) throw new Error('unsupported');
        await enter.call(gameCard);
      }
    } catch (_) {el('status').textContent='此浏览器未能开启全屏，请尝试用 Chrome 打开游戏。';}
  }
  function fullscreenControls() {
    const active = fullscreenElement() === gameCard;
    el('fullscreen').textContent = active ? '⛶ 退出全屏' : '⛶ 全屏';
    el('fullscreen').setAttribute('aria-pressed', String(active));
  }
  function fresh(level=1,score=0) {
    state = { phase:'ready', elapsed:0, level, score, duck:{x:1740,y:1140,face:1}, goose:{x:3000,y:1000,face:-1}, bread:[], particles:[], trail:[], ripple:0, skill:{cooldown:0,boost:0}, aim:{x:1,y:0} };
    state.role=selectedRole;state.difficulty=selectedDifficulty;
    for(let i=0;i<M.breadCap;i++) spawnBread();
    C.init(state);C.configureLevel(state,level);
    hud();
  }
  function spawnBread() {
    let p;
    for(let i=0;i<100;i++) {
      p={x:rand(bounds.left+35,bounds.right-35),y:rand(bounds.top+35,bounds.bottom-35),bob:rand(0,6)};
      if(distance(p,state.duck)>70 && distance(p,state.goose)>85 && state.bread.every(b=>distance(p,b)>65)) break;
    }
    state.bread.push(p);
  }
  // 固定DOM首领血条：只读取战斗数据，镜头移动和暂停不影响显示。
  const bossRows=new Map();let bossRoster='';
  function bossHud(){
    const names={godzilla:['🦖','哥斯拉','#438b78'],worm:['🪱','沙虫','#be814b'],octopus:['🐙','章鱼','#a16caf'],bear:['🐻‍❄️','北极熊','#5796b6']},order={godzilla:0,worm:1,octopus:2,bear:3};
    const bosses=window.DuckFlood.monsters(state).filter(b=>b.kind!=='scorpion').map(b=>({boss:b,kind:b.kind||'octopus'})).sort((a,b)=>order[a.kind]-order[b.kind]||a.boss.id-b.boss.id);
    const panel=el('boss-hud'),list=el('boss-list');panel.hidden=!bosses.length;
    const totals={},seen={},keys=new Set();for(const b of bosses)totals[b.kind]=(totals[b.kind]||0)+1;
    for(const {boss:b,kind} of bosses){const key=kind+'-'+b.id;keys.add(key);seen[kind]=(seen[kind]||0)+1;let row=bossRows.get(key);
      if(!row){const node=document.createElement('div'),head=document.createElement('div'),name=document.createElement('span'),hp=document.createElement('strong'),bar=document.createElement('progress');node.className='boss-health';node.dataset.bossId=b.id;node.dataset.bossKind=kind;node.style.setProperty('--boss-color',names[kind][2]);head.className='boss-heading';name.className='boss-name';hp.className='boss-hp';head.append(name,hp);node.append(head,bar);row={node,name,hp,bar};bossRows.set(key,row);}
      const max=Math.max(1,b.maxHp),value=clamp(b.hp,0,max),label=names[kind][0]+' '+names[kind][1]+(totals[kind]>1?' #'+seen[kind]:'')+(b.noCoop?' · 召唤·护'+(window.DuckFactions.owner(state,b)==='goose'?'鹅':'鸭'):'');
      row.name.textContent=label+(value<=0?' · 已击败':'');row.name.title=row.name.textContent;row.hp.textContent=Math.ceil(value)+'/'+max;row.bar.max=max;row.bar.value=value;row.bar.setAttribute('aria-label',label+'生命');row.bar.setAttribute('aria-valuetext',row.hp.textContent);row.node.dataset.defeated=String(value<=0);
    }
    for(const key of bossRows.keys())if(!keys.has(key))bossRows.delete(key);
    const roster=[...keys].join(',');if(roster!==bossRoster){list.replaceChildren(...[...keys].map(key=>bossRows.get(key).node));bossRoster=roster;}
    el('boss-count').textContent=bosses.filter(({boss})=>boss.hp>0).length+'/'+bosses.length+' 存活';
  }
  let nextHudUpdate=0;
  function hud() {
    nextHudUpdate=performance.now()+80;
    bossHud();
    el('mode-combat-rules').textContent=state.difficulty==='hell'?'地狱战斗：鸭子玩家60/电脑200生命；玩家和电脑鸭子拾取复活道具后可半血复活，每局一次；电脑大鹅 6000 生命、移速 +30%、冷却减少 30%、5 秒最多受 50 点保护内伤害、被动减伤 50%；自动无敌 1 秒，冷却 15 秒。每关可复活一次，恢复一半最大生命，复活后近战和枪械伤害增加 100%。其余沿用困难模式规则，玩家大鹅数值不变。':C.advanced(state)?'困难战斗：鸭子玩家 30 / 电脑 100 生命、移速 +10%、技能冷却减半、伤害 ×2（手枪 100/200）；大鹅玩家 750 生命 / 5 秒 300 点保护；电脑 2250 生命 / 5 秒 100 点保护、移速再 +10%、冷却再减 20%、伤害翻倍（近战 100、枪伤 100/200）。枪械静止命中 40%、移动 10%，爆头率 5%。药水六种效果：10%秒杀、20%中毒、40%眩晕、20%伤害400、9%自己无敌、1%全部极端天气。':'普通战斗：药水六种效果：10%秒杀、20%中毒、40%眩晕、20%伤害400、9%自己无敌、1%全部极端天气；手枪普通 100 / 爆头 200，静止命中 50%、移动 20%，命中后 10% 爆头。';
    el('difficulty').textContent=state.difficulty==='hell'?'👹 地狱模式':C.advanced(state)?'🔥 困难模式':'🌿 普通模式';
    el('level').textContent=`第 ${state.level} / ${TOTAL_LEVELS} 关`+(replaySession?' · 重玩':'');
    const weather=state.combat.weather;el('weather').textContent=weather?([state.level===20?'🛡 首领免疫极端天气':'',(state.combat.godzillas||[]).some(g=>g.hp>0)?'🦖 哥斯拉来袭':'',...(state.combat.godzillaBurns||[]).map(b=>`🔥 ${b.kind==='duck'?'鸭子':'大鹅'}灼烧 ${b.remaining.toFixed(1)}s`),weather.staffTargets||C.vortices(state).some(v=>v.staffTarget)?'🎯 法杖对敌':'',weather.potionTarget?(weather.itemWeather?'🎯 药水天灾锁定命中者':'🎯 天灾印记锁定命中者'):weather.omenTargetGoose?'🎯 天灾锁定大鹅':'',weather.vortex?(C.isWater(weather.center||{x:640,y:380})?'🌀 风涡 ×'+C.vortices(state).length:'🌪 风涡 ×'+C.vortices(state).length):'',weather.lightning?((C.advanced(state)||weather.potionTarget||weather.omenTargetGoose||weather.staffTargets?.lightning)?'⛈ 追踪雷暴':'⛈ 雷暴'):'',weather.meteor?((C.advanced(state)||weather.potionTarget||weather.omenTargetGoose||weather.staffTargets?.meteor)?'☄ 追踪流星':'☄ 流星'):'',weather.meteorShower?((C.advanced(state)||weather.potionTarget||weather.omenTargetGoose||weather.staffTargets?.shower)?'🌠 追踪流星雨':'🌠 流星雨'):'',weather.sandstorm?'🏜 沙尘暴':'',weather.ice?.blizzard?'❄ 暴风雪':'',weather.ice?.avalanche?'🏔 雪崩':'',weather.eruption?'🌋 火山喷发':'',weather.tsunami?'🌊 海啸洪水':'',weather.giantMeteor?(weather.giantMeteor.hit?'☄ 陨石已落地':'☄ 巨型陨石事件'):''].filter(Boolean).join(' + ')||'☀ 晴朗'): '☀ 晴朗';
    el('score').innerHTML=state.score+'<small> 分</small>';
    const giant=weather?.giantMeteor,giantWarning=giant&&!giant.hit&&weather.disasterTime>=giant.impactAt-5;el('event-warning').hidden=!giantWarning;if(giantWarning)el('event-warning').textContent=`☄ 巨型陨石 ${(giant.impactAt-weather.disasterTime).toFixed(1)} 秒后落地！红圈内直接秒杀，无敌无效，立即撤离！`;
    const storm=window.DuckDisasters.stormThreat(weather,C.player(state));if(storm){el('event-warning').hidden=false;el('event-warning').textContent=(giantWarning?'☄ 巨型陨石预警！':'')+((weather.stormWaves||[]).some(v=>window.DuckDisasters.stormAxis(v)==='x')?'🏜 沙尘暴旧波次向右 →；新波次向下 ↓！':'🏜 沙尘暴从上往下扫过全图 ↓！')+'立即进入避难点，触碰秒杀！';}
    if(window.DuckGlacier.stormThreat(weather,C.player(state))){el('event-warning').hidden=false;el('event-warning').textContent=((weather.ice.waves||[]).some(v=>v.axis!=='up')?'❄ 暴风雪旧波次向下 ↓，新波次向上 ↑！':'❄ 暴风雪从底部向上扫过全图 ↑！')+'立即前往避难点，或使用有效无敌躲避！';}
    const remaining=Math.max(0,Math.ceil(DURATION-state.elapsed));
    const cooperating=C.coopActive(state);
    el('timer').innerHTML=cooperating?'∞<small> 合作中</small>':remaining+'<small> 秒</small>';
    el('timer').title=cooperating?'哥斯拉、北极熊、沙虫或章鱼存活：倒计时暂停，双方停战；全部消灭后恢复剩余 '+remaining+' 秒':'生存倒计时';
    el('timer').style.color=!cooperating&&remaining<=10?'#b9563e':'';
    el('best').innerHTML=best+'<small> 分</small>';
    const actor=C.player(state),gooseRole=state.role==='goose',c=state.combat;
    const cd=gooseRole?c.netCooldown:state.skill.cooldown;
    el('dash').disabled=cooperating&&gooseRole||state.phase!=='playing'||cd>0||(actor.stun>0||actor.freezeTime>0)||(!gooseRole&&c.root>0);
    el('dash').textContent=cd>0?`${gooseRole?'🕸 捕网':'⚡ 冲刺'} ${cd.toFixed(1)}s`:(gooseRole?'🕸 Shift 捕网':'⚡ Shift 冲刺');
    el('teleport').textContent=`🌀 T 瞬移道具 · ${actor.teleports||0}/1`;el('teleport').disabled=state.phase!=='playing'||!actor.teleports||actor.stun>0||actor.freezeTime>0||!gooseRole&&c.root>0;
    el('staff').title='H释放 · 600像素内自动瞄准敌人 · 法杖天气对敌释放 · 每根3次';el('staff').textContent=`🪄 H 法杖 · ${actor.staffCharges||0}/3`;el('staff').disabled=state.phase!=='playing'||!(actor.staffCharges>0)||actor.staffCooldown>0||actor.stun>0||actor.freezeTime>0||!gooseRole&&c.root>0;
    const nearbyCannon=C.nearbyCannon(state,actor);
    el('fire').disabled=state.phase!=='playing'||(!nearbyCannon&&C.ammunition(actor)<=0)||nearbyCannon?.cooldown>0||(actor.stun>0||actor.freezeTime>0)||(!gooseRole&&c.root>0);
    el('fire').textContent=nearbyCannon?`💥 大炮 · ${nearbyCannon.ammo}/3`:C.weapon(actor)==='sniper'?`🎯 狙击 · ${actor.sniperAmmo||0}/3`:`🔫 射击 · ${actor.ammo}/5`;
    el('weapon').disabled=state.phase!=='playing'||!(actor.ammo>0)||!(actor.sniperAmmo>0);el('weapon').textContent=C.weapon(actor)==='sniper'?'🔁 R 切手枪':'🔁 R 切狙击';
    el('omen').textContent=`🧿 M 投掷印记 · ${actor.omenArmed?1:0}/1`;el('omen').disabled=state.phase!=='playing'||!actor.omenArmed||!C.throwTarget(state,actor)||(actor.stun>0||actor.freezeTime>0)||(!gooseRole&&c.root>0);
    el('potion').textContent=`🧪 L 药水 · ${actor.potions||0}/3`;el('potion').disabled=state.phase!=='playing'||!(actor.potions>0)||!C.throwTarget(state,actor)||actor.potionCooldown>0||(actor.stun>0||actor.freezeTime>0)||(!gooseRole&&c.root>0);
    const armorCooldown=gooseRole?c.gooseArmorCooldown:c.armorCooldown;
    el('armor').hidden=false;el('armor').disabled=state.phase!=='playing'||armorCooldown>0;
    el('armor').textContent=armorCooldown>0?`🛡 霸体 ${armorCooldown.toFixed(1)}s`:'🛡 J 霸体';
    el('clone').hidden=gooseRole;el('clone').disabled=state.phase!=='playing'||c.cloneCooldown>0||(actor.stun>0||actor.freezeTime>0)||c.root>0;
    el('clone').textContent=c.cloneCooldown>0?`🪞 分身 ${c.cloneCooldown.toFixed(1)}s`:'🪞 K 分身';
    const effects=[];const ownRevived=gooseRole?c.gooseItemRevived:c.duckRevived,ownReviveTime=gooseRole?c.gooseItemReviveTime:c.duckReviveTime;effects.push(`💖 你的复活：${ownRevived?'本局已使用':actor.reviveCharges?'已携带道具':'未携带'}${ownReviveTime>0?' · 无敌'+ownReviveTime.toFixed(1)+'s':''}`);if(state.role==='duck')effects.push(`电脑大鹅道具复活：${c.gooseItemRevived?'本局已使用':state.goose.reviveCharges?'已携带道具':'需拾取道具'}${c.gooseItemReviveTime>0?' · 无敌'+c.gooseItemReviveTime.toFixed(1)+'s':''}`);if(state.role==='goose')effects.push(`电脑鸭子复活：${c.duckRevived?'本局已使用':state.duck.reviveCharges?'已携带道具':'需拾取道具'}${c.duckReviveTime>0?' · 无敌'+c.duckReviveTime.toFixed(1)+'s':''}`);if(cooperating)effects.push('🤝 临时合作 · 先消灭全部首领（含哥斯拉） · 倒计时暂停');for(const [a,name] of [[state.duck,'鸭子'],[state.goose,'大鹅']])if(a.omenArmed)effects.push(`🧿 ${name}携带天灾印记 · M 投掷命中触发`);
    if(C.floodActive(state))effects.push(`全图洪水 ${(c.weather.floodUntil-c.weather.disasterTime).toFixed(1)}s`);if(nearbyCannon)effects.push('靠近大炮 · 空格发射 · 自动瞄准最近敌人');
    if(state.role==='duck'&&!cooperating){effects.push(c.gooseBlinkCooldown>0?`电脑鹅瞬移 ${c.gooseBlinkCooldown.toFixed(1)}s`:'电脑鹅瞬移就绪');effects.push(c.gooseSprintTime>0?`电脑鹅疾跑 ${c.gooseSprintTime.toFixed(1)}s`:c.gooseSprintCooldown>0?`电脑鹅疾跑冷却 ${c.gooseSprintCooldown.toFixed(1)}s`:'电脑鹅疾跑就绪');}
    if(c.gooseReviveTime>0)effects.push(`大鹅复活无敌 ${c.gooseReviveTime.toFixed(1)}s`);
    if(C.hellGooseAI(state)){effects.push(c.gooseRevived?'地狱大鹅：复活已用 · 伤害 ×2':'地狱大鹅：剩余复活 1 次');effects.push(c.gooseShieldTime>0?`大鹅无敌 ${c.gooseShieldTime.toFixed(1)}s`:`大鹅无敌冷却 ${c.gooseShieldCooldown.toFixed(1)}s`);}
    for(const [a,name] of [[state.duck,'鸭子'],[state.goose,'大鹅']]){if(a.freezeTime>0)effects.push(`${name}冰冻 ${a.freezeTime.toFixed(1)}s`);if(a.slowTime>0)effects.push(`${name}减速30% ${a.slowTime.toFixed(1)}s`);if(a.staffPoisonTime>0)effects.push(`${name}杖毒50/s ${a.staffPoisonTime.toFixed(1)}s`);if(a.healTime>0)effects.push(`${name}回血 10/s · ${a.healTime.toFixed(1)}s`);if(a.venomTime>0)effects.push(`${name}蝎毒 ${a.venomTime.toFixed(1)}s · 5/s`);if(a.poisonTime>0)effects.push(`${name}中毒 ${a.poisonTime.toFixed(1)}s · 50/s`);if(a.stun>0)effects.push(`${name}眩晕 ${a.stun.toFixed(1)}s`);if(a.potionInvulnerable>0)effects.push(`${name}药水无敌 ${a.potionInvulnerable.toFixed(1)}s`);}
    if(state.combat.weather?.tsunamiWarning>0)effects.push(`海啸 ${state.combat.weather.tsunamiWarning.toFixed(1)}s 后从右向左袭来 · 前往高地！`);
    if(state.combat.weather?.vortexWarning>0)effects.push(`风涡预警 ${state.combat.weather.vortexWarning.toFixed(1)}s`);
    if(c.root>0)effects.push(`鸭子禁锢 ${c.root.toFixed(1)}s`);
    if(c.invulnerable>0)effects.push(`鸭子无敌 ${c.invulnerable.toFixed(1)}s`);
    if(c.cloneTime>0)effects.push(`分身 ×${c.clones.length} · ${c.cloneTime.toFixed(1)}s`);
    const armorTime=gooseRole?c.gooseArmorTime:c.armorTime;if(armorTime>0)effects.push(`霸体免控 ${armorTime.toFixed(1)}s`);
    const boost=Math.max(actor.haste,gooseRole?0:state.skill.boost);
    if(boost>0)effects.push(`加速 +30% · ${boost.toFixed(1)}s`);
    el('boost').textContent=effects.join(' · ')||(gooseRole?`Shift 捕网 · ${(8*C.gooseCooldown(state)).toFixed(1)} 秒冷却`:`Shift 冲刺 · 1 秒无敌 · ${20*C.duckCooldown(state)} 秒冷却`);
    el('boost').classList.toggle('active',effects.length>0);
    for(const kind of ['duck','goose']){const bird=state[kind];el(kind+'-hp').textContent=`${Math.ceil(bird.hp)}/${bird.maxHp}`;el(kind+'-bar').max=bird.maxHp;el(kind+'-bar').value=bird.hp;}
    el('role-label').textContent=(cooperating?'🤝 友方协作 · 消灭全部首领（含哥斯拉）':gooseRole?'你是大鹅 · 抓住鸭子获胜':`你是鸭子 · 生存 ${DURATION} 秒或击败大鹅`)+' · '+M.region(actor);
    const damage=c.damageLog.filter(x=>C.clock(state)-x.at<5).reduce((n,x)=>n+x.amount,0);
    el('net-state').textContent=`🛡 大鹅伤害保护 · 近 5 秒 ${Math.min(damage,C.gooseDamageCap(state))}/${C.gooseDamageCap(state)}`;
    saveControls();
  }
  function start(level=1,score=0) {
    sound.stop(); sound.unlock(); warningCooldown=0; dangerArmed=true;
    lastManualRevision=readRaw(SAVE_KEY);autoSaveElapsed=0;
    rememberDifficulty();fresh(level,score); state.phase='playing'; keys.clear();
    const omenTrial=!replaySession&&!omenTrialUsed&&C.spawnTrialOmen(state);
    if(omenTrial){omenTrialUsed=true;try{localStorage.setItem(OMEN_TRIAL_KEY,'1');}catch(_){/* 本次会话内仍只触发一次。 */}}
    el('overlay').hidden=true; el('pause').disabled=false; el('pause').textContent='Ⅱ 暂停';
    el('status').textContent=state.role==='goose'?'你是大鹅！Shift 捕网，靠近鸭子自动攻击；空格 射击。':'你是鸭子！Shift 冲刺无敌，拾取手枪后空格 射击。';
    if(omenTrial)el('status').textContent='🧿 本把试玩：已必定刷新一个天灾印记，通常在你附近；拾取后按 M 投掷。本把补充概率 100%，再下一把恢复原来的 1%。';
    hud();
    autoSave();saveControls();last=performance.now(); canvas.focus();
  }
  function show(title,message,button,mascot,subtitle) {
    el('title').textContent=title; el('message').textContent=message; el('start').textContent=button;
    el('mascot').textContent=mascot; el('subtitle').textContent=subtitle;
    el('hint').textContent=state.phase==='paused'?'按 P 或点击按钮继续':state.phase==='won'&&state.level<TOTAL_LEVELS&&(!replaySession||state.level<clearedByMode[state.difficulty])?'下一关重置生命和技能，累计分数保留':'WASD 移动 · Shift 技能 · 空格 射击 · R 切枪 · J 霸体 · K 分身 · L 药水 · M 印记 · H 法杖 · P 暂停';
    el('overlay').hidden=false; el('start').focus();
  }
  function pause() {
    if(state.phase==='playing') {
      sound.stop();
      state.phase='paused';autoSave(); keys.clear(); el('pause').textContent='▶ 继续';
      el('status').textContent='休息一下，大鹅也被按下了暂停。';
      show('鸭鸭喘口气','面包和大鹅都等着你，准备好了再继续。','继续抢面包 →','🦆 💤','池塘暂停营业');
      hud();
    } else if(state.phase==='paused') {
      sound.unlock();
      state.phase='playing'; el('overlay').hidden=true; el('pause').textContent='Ⅱ 暂停';
      el('status').textContent=C.coopActive(state)?'继续合作！先消灭全部首领（含哥斯拉），倒计时保持暂停。':'继续游！大鹅可没有放弃。'; last=performance.now(); canvas.focus();
      hud();
    }
  }
  function finish(won,reason='time') {
    sound.stop();
    if(reason==='caught')sound.caught();
    state.phase=won?'won':'lost';if(won&&state.level===TOTAL_LEVELS)state.combat.finalBossBattle=false;keys.clear();el('pause').disabled=true;
    if(state.score>best){best=state.score;try{localStorage.setItem('duck-bread-best',String(best));}catch(_){}}
    hud();
    const title=reason==='caught'?(state.role==='goose'?'大鹅执法成功！':'你已被大鹅依法逮捕'):reason==='goose-down'?(state.role==='duck'?'鸭鸭反击成功！':'大鹅倒下了！'):(won?'面包自由鸭，就是你！':'鸭鸭逃出生天了！');
    const detail=reason==='final-bosses'?'本关所有首领已全部击败，首领挑战完成！':reason==='caught'?'鸭子生命值归零。':reason==='goose-down'?'大鹅生命值归零。':`${DURATION} 秒结束，鸭子成功生存。`;
    if(won&&!replaySession){clearedByMode[state.difficulty]=Math.max(clearedByMode[state.difficulty],state.level);refreshCleared(state.difficulty);}
    levelControls();
    const next=won&&state.level<TOTAL_LEVELS&&(!replaySession||state.level<clearedByMode[state.difficulty]);
    const defeatedActor=won?(reason==='caught'?'duck':reason==='goose-down'?'goose':null):state.role;
    const mineCause=defeatedActor&&state[defeatedActor].hp<=0?state.combat.mineDeaths?.[defeatedActor]:null;
    const weatherReason=mineCause?null:state.combat.weather?.cause;
    // 胜利只描述本次获胜条件；失败才读取死亡来源，避免旧战斗记录污染过关提示。
    const actualDetail=won?detail:!mineCause&&['ice-spike','water-column'].includes(state.combat.deathCause)?(state.combat.deathCause==='ice-spike'?`被北极熊冰锥命中（基础伤害${state.difficulty==='hard'?600:200}），生命归零。`:`被章鱼水柱命中（基础伤害${state.difficulty==='hard'?1200:400}），生命归零。`):mineCause?`${defeatedActor==='duck'?'鸭子':'大鹅'}被${mineCause==='water'?'水雷':'地雷'}爆炸击败（基础伤害 ${mineCause==='water'?100:150}）。`:['godzilla','atomic','atomic-burn'].includes(state.combat.deathCause)?({godzilla:'被哥斯拉接触攻击击败（基础伤害5000）。',atomic:'被哥斯拉原子吐息击败（基础伤害100000）。','atomic-burn':'原子吐息的持续灼烧使生命归零。'}[state.combat.deathCause]):state.combat.deathCause==='bear'?'被北极熊攻击，生命归零。':weatherReason==='blizzard'?'暴风雪命中，未受避难点或无敌保护。':weatherReason==='avalanche'?'雪崩命中，受到10000点伤害。':['scorpion','worm','venom'].includes(state.combat.deathCause)?({scorpion:'被蝎子攻击，生命归零。',worm:'被沙虫的接触或远程攻击击败。',venom:'蝎毒持续伤害使生命归零。'}[state.combat.deathCause]):state.combat.deathCause==='blink'?'大鹅瞬移贴身后发动近战，鸭子生命归零；可用 Shift 冲刺无敌躲避。':state.combat.deathCause==='execution'?'大鹅生命低于最大生命的 5%，触发电脑鸭子的斩杀被动。':state.combat.deathCause==='staff'?'法杖中毒使生命归零。':state.combat.deathCause==='potion'?'药水效果或中毒使目标生命归零。':weatherReason==='sandstorm'?'沙尘暴扫过，未及时进入避难点。':weatherReason==='giant'?'巨型陨石命中，直接秒杀；所有无敌和伤害保护均无效。':weatherReason==='tsunami'?'海啸扫过，未及时进入高地避难。':weatherReason==='eruption'?'被空中岩浆直接命中。':weatherReason==='lava'?'地面岩浆造成致命灼烧。':weatherReason==='lightning'?'闪电命中，生命直接归零。':weatherReason==='vortex'?'漩涡 / 龙卷风造成致命伤害。':weatherReason==='meteor'?'流星撞击造成致命伤害。':weatherReason==='shower'?'流星雨撞击造成致命伤害。':detail;
    const defeatTitle=!mineCause&&['ice-spike','water-column'].includes(state.combat.deathCause)?(state.combat.deathCause==='ice-spike'?'冰锥命中，挑战结束！':'水柱命中，挑战结束！'):mineCause?(mineCause==='water'?'水雷爆炸，挑战结束！':'地雷爆炸，挑战结束！'):['godzilla','atomic','atomic-burn'].includes(state.combat.deathCause)?'哥斯拉来袭，挑战结束！':state.combat.deathCause==='bear'?'北极熊袭击，挑战结束！':weatherReason==='blizzard'||weatherReason==='avalanche'?'冰雪灾害，挑战结束！':['scorpion','worm','venom'].includes(state.combat.deathCause)?'沙漠生物袭击，挑战结束！':state.combat.deathCause==='blink'?'被大鹅瞬移突袭！':state.combat.deathCause==='execution'?'电脑鸭子斩杀，挑战结束！':state.combat.deathCause==='staff'?'法杖中毒，挑战结束！':state.combat.deathCause==='potion'?'药水效果，挑战结束！':state.duck.hp<=0&&state.goose.hp<=0?'双双倒下，本关失败！':weatherReason==='sandstorm'?'沙尘暴来袭，挑战结束！':weatherReason==='giant'?'巨型陨石撞击，挑战结束！':weatherReason==='tsunami'?'海啸来袭，挑战结束！':weatherReason==='eruption'||weatherReason==='lava'?'火山喷发，挑战结束！':weatherReason==='lightning'?'闪电命中，挑战结束！':weatherReason==='vortex'?'卷入风涡，挑战结束！':weatherReason==='meteor'||weatherReason==='shower'?'流星撞击，挑战结束！':title;
    show(won?(replaySession?`第 ${state.level} 关重玩完成！`:next?`第 ${state.level} 关通过！`:'四十关全部通关！'):defeatTitle,`${actualDetail}累计 ${state.score} 分，本关历时 ${state.elapsed.toFixed(1)} 秒。`,next?`进入第 ${state.level+1} 关 →`:won?(replaySession?'再次重玩本关 →':'重新挑战四十关 →'):`重试第 ${state.level} 关 →`,won?'🏆 🦆':'🪿 🚨',won?'挑战成功':'挑战结束');
    if(won&&!next&&!replaySession){state.completed=true;try{if(readRaw(SAVE_KEY)===lastManualRevision){const completedSave=snapshot(),other=state.role==='duck'?'goose':'duck';if(completedSave.battle[other].hp<=0){completedSave.battle[other].hp=completedSave.battle[other].maxHp;completedSave[other].hp=completedSave.battle[other].hp;}writeModeSave(AUTO_SAVE_KEY,completedSave);savedGame=readLatestSave(state.difficulty);saveControls();}}catch(_){/* 仍保留原手动存档。 */}}
    el('status').textContent=won?'获胜！可以选择另一个角色再来一局。':`当前第 ${state.level} 关已保留，点击重试继续挑战。`;
  }
  function resolveCombat(){
    const cues=[...new Set((state.combat.audioEvents||[]).splice(0))];
    const playCues=()=>cues.forEach(cue=>{if(typeof sound[cue]==='function')sound[cue]();});
    // 结算会停止旧声音，所以致命爆炸要在结算清理之后播放。
    if(C.player(state).hp>0&&C.finalBossesDefeated(state)){finish(true,'final-bosses');playCues();return true;}
    if(state.duck.hp<=0&&state.goose.hp<=0){finish(false,'weather');playCues();return true;}
    if(state.duck.hp<=0&&(!C.coopActive(state)||state.role==='duck')){finish(state.role==='goose','caught');playCues();return true;}
    if(state.goose.hp<=0&&(!C.coopActive(state)||state.role==='goose')){finish(state.role==='duck','goose-down');playCues();return true;}
    playCues();
    const messages=state.combat.events.splice(0);if(messages.length)el('status').textContent=messages.at(-1);
    return false;
  }
  function roleControls(){
    levelControls();
    document.querySelectorAll('[data-difficulty]').forEach(b=>{const active=b.dataset.difficulty===selectedDifficulty;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
    el('duck-choice-stats').textContent=selectedDifficulty==='hell'?'玩家60 / 电脑200生命 · 电脑拾取道具后可半血复活':selectedDifficulty!=='normal'?'玩家 30 / 电脑 100 生命 · 移速 +10% · 伤害 ×2 · 冷却减半':'10 生命 · 冲刺无敌 · 生存 / 反击';
    el('goose-choice-stats').textContent=selectedDifficulty!=='normal'?'玩家 750 生命 · 移速 +10% · 300 点保护':'1000 生命 · 捕网禁锢 · 8 秒霸体';
    document.querySelectorAll('[data-role]').forEach(b=>{const active=b.dataset.role===selectedRole;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
  }
  function shoot(){const actor=C.player(state),aim=direction();actor.moving=!!aim&&C.moveDistance(state,.01,actor)>0&&(clamp(actor.x+aim.x,bounds.left,bounds.right)!==actor.x||clamp(actor.y+aim.y,bounds.top,bounds.bottom)!==actor.y);if(C.fire(state)){resolveCombat();hud();canvas.focus();}}
  function switchGun(){if(C.switchWeapon(state)){hud();canvas.focus();}}
  function activateTeleport(){if(C.useTeleport(state)){C.contacts(state);resolveCombat();hud();canvas.focus();}}
  function activateStaff(){if(C.useStaff(state)){resolveCombat();hud();canvas.focus();}else if(state.phase==='playing'&&C.player(state).staffCharges>0){const t=C.staffTarget(state,C.player(state));if(t&&distance(C.player(state),t)>600)el('status').textContent='法杖射程为600像素，请靠近目标；本次未消耗次数。';}}
  function tossOmen(){if(C.throwOmen(state)){resolveCombat();hud();canvas.focus();}}
  function tossPotion(){if(C.throwPotion(state)){resolveCombat();hud();canvas.focus();}}
  function activateArmor(){if(C.armor(state)){resolveCombat();hud();canvas.focus();}}
  function activateClones(){if(state.role==='duck'&&C.summonClones(state)){resolveCombat();hud();canvas.focus();}}
  function direction() {
    let dx=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0);
    let dy=(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0);
    const length=Math.hypot(dx,dy);
    return length?{x:dx/length,y:dy/length}:null;
  }
  function dash() {
    if(state.phase!=='playing')return;
    if(state.role==='goose'){if(!C.castNet(state)&&state.combat.netCooldown===0)el('status').textContent='目标超出捕网范围，请靠近到 360 像素内。';hud();return;}
    if(state.skill.cooldown>0||!C.beginDash(state))return;
    const aim=direction() || state.aim;
    state.aim={...aim}; if(aim.x) state.duck.face=Math.sign(aim.x);
    state.skill.cooldown=DASH_COOLDOWN*C.duckCooldown(state); state.skill.boost=BOOST_DURATION;
    // 分段扫过路径：冲刺沿途能吃面包，也不能穿过大鹅。
    const steps=Math.ceil(DASH_DISTANCE/7);
    for(let i=0;i<steps;i++) {
      if(i%2===0)state.trail.push({x:state.duck.x,y:state.duck.y,life:.35});
      state.duck.x=clamp(state.duck.x+aim.x*DASH_DISTANCE/steps,bounds.left,bounds.right);
      state.duck.y=clamp(state.duck.y+aim.y*DASH_DISTANCE/steps,bounds.top,bounds.bottom);
      C.contacts(state);if(resolveCombat())return;
      collectBread();
    }
    C.syncClones(state);
    el('status').textContent='嘎嘎冲刺！无敌 1 秒，移动速度 +30% 持续 2 秒。';
    hud();
  }
  function update(dt) {
    if(state.phase!=='playing')return;
    if(C.finalBossesDefeated(state)){resolveCombat();return;}
    C.syncCoop(state);if(C.aiTeleport(state)){C.contacts(state);if(resolveCombat())return;}if(!C.coopActive(state))state.elapsed=Math.min(DURATION,state.elapsed+dt);
    const previous={duck:{x:state.duck.x,y:state.duck.y},goose:{x:state.goose.x,y:state.goose.y}};
    const actor=C.player(state),aim=direction(),step=C.moveDistance(state,dt,actor);
    if(aim){if(actor===state.duck)state.aim={...aim};actor.x=clamp(actor.x+aim.x*step,bounds.left,bounds.right);actor.y=clamp(actor.y+aim.y*step,bounds.top,bounds.bottom);if(aim.x)actor.face=Math.sign(aim.x);}
    actor.moving=distance(actor,previous[state.role])>.001;
    if(state.role==='duck'){
      const g=state.goose,d=state.duck,gap=distance(g,d);
      const escaping=C.weatherDanger(state,g)||window.DuckDisasters.tsunamiThreat(state.combat.weather,g),wind=state.combat.weather;
      if(g.freezeTime>0)C.armor(state,g);if(escaping||g.poisonTime>0||g.venomTime>0||gap<180||state.combat.bullets.some(b=>b.owner==='duck'&&b.willHit!==false&&distance(g,b)<400)||state.combat.potionShots.some(p=>p.owner==='duck'&&distance(g,p)<400))C.gooseShield(state);if(escaping&&C.vortices(state).some(v=>distance(g,v.center)<210))C.armor(state,g);
      const steering=C.goosePlan(state),travel=C.gooseMoveDistance(state,dt);g.x=clamp(g.x+steering.x*travel,bounds.left,bounds.right);g.y=clamp(g.y+steering.y*travel,bounds.top,bounds.bottom);if(steering.x)g.face=Math.sign(steering.x);
      const w=state.combat.weather;if(C.vortices(state).some(v=>!(v.vortexWarning>0)&&distance(g,v.center)<210))C.armor(state,g);
      g.moving=distance(g,previous.goose)>.001;
      C.gooseAttack(state);
    }else{
      const d=state.duck,g=state.goose,gap=distance(d,g);
      const escaping=C.weatherDanger(state,d)||window.DuckDisasters.tsunamiThreat(state.combat.weather,d),wind=state.combat.weather;
      if(state.combat.root>0||d.freezeTime>0||escaping&&C.vortices(state).some(v=>distance(d,v.center)<210))C.armor(state,state.duck);
      const steering=C.duckSteering(state),travel=C.moveDistance(state,dt,d)*.85;
      d.x=clamp(d.x+steering.x*travel,bounds.left,bounds.right);d.y=clamp(d.y+steering.y*travel,bounds.top,bounds.bottom);
      if(steering.x)d.face=Math.sign(steering.x);if(steering.x||steering.y)state.aim={...steering};
      const dashEnd={x:clamp(d.x+state.aim.x*110,bounds.left,bounds.right),y:clamp(d.y+state.aim.y*110,bounds.top,bounds.bottom)};
      if((!C.coopActive(state)&&gap<155||C.meteorThreat(state,d)||window.DuckGodzilla.imminent(state,d))&&state.skill.cooldown===0&&C.giantRouteSafe(state,d,dashEnd)&&C.beginDash(state)){Object.assign(d,dashEnd);state.skill.cooldown=20*C.duckCooldown(state);state.skill.boost=2;}
      d.moving=distance(d,previous.duck)>.001;
      C.monsterItems(state,d);
      if(!C.coopActive(state)&&!escaping&&!g.potionInvulnerable&&d.staffCharges>0&&gap<=600)C.useStaff(state,d);
      if(!C.coopActive(state)&&!escaping&&d.omenArmed&&gap<=C.omenRange)C.throwOmen(state,d);
      if(!C.coopActive(state)&&!escaping&&d.potions>0&&gap<=450)C.throwPotion(state,d);
      if(!escaping&&C.ammunition(d)>0&&gap<500)C.summonClones(state);
      const attackedMonster=C.monsterAttack(state,d);
      if(!C.coopActive(state)&&!attackedMonster&&!C.monsterTarget(state,d)&&!escaping&&(gap<700||C.nearbyCannon(state,d))&&(C.ammunition(d)>0||C.nearbyCannon(state,d)))C.fire(state,d);
    }
    state.skill.boost=Math.max(0,state.skill.boost-dt);state.skill.cooldown=Math.max(0,state.skill.cooldown-dt);
    C.tick(state,dt);if(resolveCombat())return;
    warningCooldown=Math.max(0,warningCooldown-dt);const dangerDistance=distance(state.goose,state.duck);
    if(dangerDistance>200)dangerArmed=true;
    if(!C.coopActive(state)&&dangerDistance<110&&dangerArmed&&warningCooldown===0){sound.warning();warningCooldown=5;dangerArmed=false;}
    collectBread();
    state.particles=state.particles.filter(p=>(p.life-=dt)>0);state.particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=90*dt;});state.trail=state.trail.filter(p=>(p.life-=dt)>0);
    autoSaveElapsed+=dt;if(autoSaveElapsed>=3)autoSave();
    if(performance.now()>=nextHudUpdate)hud();
    if(state.elapsed>=DURATION&&!C.coopActive(state))finish(state.role==='duck');
  }
  function collectBread() {
    const d=C.player(state);
    for(let i=state.bread.length-1;i>=0;i--) {
      const b=state.bread[i];
      if(distance(b,d)<30) {
        state.bread.splice(i,1); state.score+=10;
        sound.crunch();
        for(let j=0;j<8;j++)state.particles.push({x:b.x,y:b.y,vx:rand(-70,70),vy:rand(-90,10),life:.7,max:.7});
        spawnBread(); el('status').textContent=['嘎！碳水使鸭快乐。','又一口！大鹅看了很生气。','面包 +10，快乐 +100。'][Math.floor(Math.random()*3)];
      }
    }
  }
  let view;
  function visible(x,y,padding=100){
    return x+padding>=view.x&&x-padding<=view.x+VW&&y+padding>=view.y&&y-padding<=view.y+VH;
  }
  const whirlpoolLines=new Path2D();
  for(let arm=0;arm<3;arm++){
    for(let i=0;i<=60;i++){
      const t=i/60,r=10+t*110,angle=t*Math.PI*3+arm*Math.PI*2/3;
      const x=Math.cos(angle)*r,y=Math.sin(angle)*r;
      if(i===0)whirlpoolLines.moveTo(x,y);else whirlpoolLines.lineTo(x,y);
    }
  }
  function drawWeather(){
    const w=state.combat.weather;if(!w)return;
    ctx.save();
    for(const wind of C.vortices(state)){
    if(!visible(wind.center.x,wind.center.y,245))continue;
    if(wind.vortex&&wind.vortexWarning>0){const p=wind.center||state.duck;ellipse(p.x,p.y,65,65,'#b369b33a','#a34d91');ctx.font='bold 18px system-ui';ctx.textAlign='center';ctx.fillStyle='#773e83';ctx.fillText(`风涡预警 ${wind.vortexWarning.toFixed(1)}s`,clamp(p.x,100,W-100),clamp(p.y-80,90,H-20));}
    if(wind.vortex&&!(wind.vortexWarning>0)){
      const center=wind.center||{x:640,y:380},water=C.isWater(center,state),x=center.x,y=center.y;
      ellipse(x,y,210,210,water?'#274f7918':'#8a705d20');ellipse(x,y,65,65,water?'#244a74bb':'#7d6b5d70');
      if(water){ctx.save();ctx.translate(x,y);ctx.rotate(-clock*2);
        ctx.strokeStyle='#bce8ee';ctx.lineWidth=4;ctx.stroke(whirlpoolLines);ctx.restore();
      }else{for(let i=0;i<8;i++){const t=i/7,shift=Math.sin(clock*5+i)*9;ctx.beginPath();ctx.ellipse(x+shift,y+25-t*155,14+t*65,5+t*11,0,clock*4+i,clock*4+i+Math.PI*1.8);ctx.strokeStyle=i%2?'#a69580':'#75695b';ctx.lineWidth=7;ctx.stroke();}}
      ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.fillStyle=water?'#173b64':'#68513a';ctx.fillText((water?'漩涡':'龙卷风')+' · 核心每秒 −50',clamp(x,120,W-120),clamp(y+180,90,H-20));
    }
    }
    if(w.lightning){
      ctx.fillStyle='#38436722';ctx.fillRect(view.x,view.y,VW,VH);
      ctx.strokeStyle='#e6f4ff80';ctx.lineWidth=2;ctx.beginPath();
      for(let i=0;i<180;i++){
        const x=(i*137+clock*50)%W,y=(i*83+clock*430)%H;
        if(visible(x,y,18)){ctx.moveTo(x,y);ctx.lineTo(x-7,y+16);}
      }
      ctx.stroke();
    }
    for(const bolt of w.strikes){if(bolt.x<view.x-80||bolt.x>view.x+VW+80||bolt.y<view.y-80)continue;if(!bolt.hit){if(!C.advanced(state)||!bolt.tracking)continue;ellipse(bolt.x,bolt.y,55,55,'#f4a64450','#b84348');ctx.font='bold 16px system-ui';ctx.textAlign='center';ctx.fillStyle='#983a3a';ctx.fillText(`⚡ ${bolt.delay.toFixed(1)}s`,bolt.x,bolt.y+5);continue;}ellipse(bolt.x,bolt.y,55,55,'#fff3b6cc','#ffffff');ctx.beginPath();ctx.moveTo(bolt.x+20,0);ctx.lineTo(bolt.x-22,bolt.y*.55);ctx.lineTo(bolt.x+15,bolt.y*.55);ctx.lineTo(bolt.x,bolt.y);ctx.strokeStyle='#fff7b0';ctx.lineWidth=9;ctx.stroke();}
    for(const m of w.meteors||[]){const radius=C.meteorRadius(m);
      if(!visible(m.x,m.y,radius+400))continue;
      if(!m.hit){
        ellipse(m.x,m.y,radius,radius,'#f4a64438','#b5693c');ctx.font='bold 16px system-ui';ctx.textAlign='center';ctx.fillStyle='#914f2d';ctx.fillText(`${m.kind==='meteor'?'☄':'🌠'} ${m.delay.toFixed(1)}s`,m.x,m.y+5);
        const fraction=Math.max(0,m.delay/(m.warningDuration??1.2)),x=m.x-220*fraction,y=m.y-300*fraction;ctx.strokeStyle='#ffce7288';ctx.lineWidth=m.kind==='meteor'?16:10;ctx.beginPath();ctx.moveTo(x-60,y-80);ctx.lineTo(x,y);ctx.stroke();ellipse(x,y,m.kind==='meteor'?17:12,m.kind==='meteor'?17:12,'#ed9947','#f9db8b');ellipse(x-3,y-4,6,5,'#fff3c0');
      }else{ctx.globalAlpha=Math.max(0,m.delay/.5);ellipse(m.x,m.y,radius,radius,'#f2bd6655','#e09b4c');ellipse(m.x,m.y,radius*.45,radius*.3,'#9b826c');ctx.globalAlpha=1;}
    }
    const giant=w.giantMeteor;if(giant&&w.disasterTime>=giant.impactAt-5&&w.disasterTime<=giant.impactAt+1){
      const left=Math.max(0,giant.impactAt-w.disasterTime),flash=giant.hit;
      ctx.save();ctx.setLineDash(flash?[]:[24,16]);ctx.lineWidth=6;ellipse(giant.x,giant.y,giant.radius,giant.radius,flash?'#ef733285':'#d9523928','#c04332');ctx.setLineDash([]);
      ctx.font='bold 26px system-ui';ctx.textAlign='center';ctx.fillStyle='#a02e26';ctx.fillText(flash?'巨型陨石撞击！':`巨型陨石 · ${left.toFixed(1)}s · 无敌无效`,giant.x,giant.y+220);
      if(!flash){const f=left/5,x=giant.x+650*f,y=giant.y-1400*f,r=80+(1-f)*90;path([[x-70,y],[x+300,y-430],[x+65,y+30]],'#f39a44aa');ellipse(x,y,r,r*.8,'#a96549','#ffd17b');ellipse(x-r*.25,y-r*.1,r*.3,r*.22,'#7c5145');ellipse(x+r*.25,y+r*.22,r*.2,r*.13,'#c48555');}
      else{ellipse(giant.x,giant.y,giant.radius*.6,giant.radius*.6,'#ffda7450','#fbc77a');}
      ctx.restore();
    }
    ctx.restore();
  }
  function drawCombat(){
    const c=state.combat;ctx.textAlign='center';
    const monsterStatus=(m,y)=>{const labels=[];if(m.noCoop){const target=window.DuckFactions.targets(state,m).sort((a,b)=>distance(m,a)-distance(m,b))[0];if(target)labels.push(window.DuckFactions.melee(m,target)?'近战模式':'远程模式');}if(m.slowTime>0)labels.push(`减速30% ${m.slowTime.toFixed(1)}s`);if(m.freezeTime>0)labels.push(`冰冻 ${m.freezeTime.toFixed(1)}s`);if(m.staffPoisonTime>0)labels.push(`杖毒 ${m.staffPoisonTime.toFixed(1)}s`);if(m.poisonTime>0)labels.push(`中毒 ${m.poisonTime.toFixed(1)}s`);if(m.stun>0)labels.push(`眩晕 ${m.stun.toFixed(1)}s`);if(labels.length){ctx.font='bold 12px system-ui';ctx.fillStyle=m.stun>0?'#a77913':'#568534';ctx.fillText(labels.join(' · '),0,y);}};
    for(const gun of c.cannons){if(!visible(gun.x,gun.y))continue;ctx.save();ctx.translate(gun.x,gun.y);ellipse(0,19,35,12,'#315b5b40');ellipse(-15,14,12,12,'#6d6556','#b49b73');ellipse(16,14,12,12,'#6d6556','#b49b73');ctx.fillStyle=gun.ammo>0?'#657477':'#929285';ctx.save();ctx.rotate(-.3);ctx.fillRect(-22,-13,52,20);ctx.fillStyle='#303e45';ctx.fillRect(24,-12,10,18);ctx.restore();ctx.fillStyle='#3b5960';ctx.font='bold 13px system-ui';ctx.fillText(`大炮 ${gun.ammo}/3`,0,-28);ctx.restore();}
    for(const p of c.bossShots||[]){if(p.delay>0||!visible(p.x,p.y))continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));if(p.kind==='ice'){path([[24,0],[-16,-10],[-10,0],[-16,10]],'#c9f4ff','#579ebd');}else{ctx.strokeStyle='#57b8e9bb';ctx.lineWidth=22;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-38,0);ctx.lineTo(18,0);ctx.stroke();ellipse(18,0,12,12,'#b0edff','#4299ce');}ctx.restore();}
    for(const p of c.cannonShots){if(!visible(p.x,p.y))continue;ellipse(p.x,p.y,9,9,'#414b54','#ffcc68');ellipse(p.x-p.vx*.015,p.y-p.vy*.015,6,6,'#f4bb5a88');}
    for(const g of c.godzillas||[]){if(g.hp<=0)continue;const b=g.beam;if(b){ctx.save();ctx.strokeStyle=b.hit?'#b7faff':'#32a7c77a';ctx.lineWidth=b.hit?100:120;ctx.lineCap='round';ctx.setLineDash(b.hit?[]:[20,15]);ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.tx,b.ty);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#246983';ctx.font='bold 17px system-ui';ctx.fillText(b.hit?'原子吐息！':`${b.target?'锁定吐息':'原子吐息'} · ${b.delay.toFixed(1)}s`,b.x+(b.tx-b.x)*.2,b.y+(b.ty-b.y)*.2-70);ctx.restore();}
      if(!visible(g.x,g.y,150))continue;ctx.save();ctx.translate(g.x,g.y);path([[-20,20],[-115,65],[-65,20],[-20,-5]],'#537e69','#32594b');ellipse(-22,36,22,18,'#527966','#315443');ellipse(22,36,22,18,'#527966','#315443');ellipse(0,0,43,53,'#628f75','#315443');for(let n=0;n<4;n++)path([[-35,-36+n*20],[-57,-25+n*20],[-36,-13+n*20]],'#8bdce2','#386f79');ellipse(6,5,24,36,'#a2bb85');ellipse(3,-53,33,25,'#628f75','#315443');ellipse(18,-60,5,5,'#c0faff');ellipse(27,-44,17,8,'#4c7564');ellipse(-40,-3,17,13,'#628f75','#315443');ellipse(41,-3,17,13,'#628f75','#315443');ctx.fillStyle='#315e52';ctx.font='bold 15px system-ui';ctx.fillText(`哥斯拉 ${Math.ceil(g.hp)}/${g.maxHp}`,0,-102);ctx.fillStyle='#bdd3bf';ctx.fillRect(-65,-94,130,8);ctx.fillStyle='#438b78';ctx.fillRect(-65,-94,130*g.hp/g.maxHp,8);monsterStatus(g,-124);ctx.restore();}
    for(const o of c.octopuses){if(o.hp<=0||!visible(o.x,o.y))continue;ctx.save();ctx.translate(o.x,o.y);ctx.strokeStyle='#9b6ca4';ctx.lineWidth=13;ctx.lineCap='round';for(let i=0;i<8;i++){const a=i*Math.PI/4,t=clock*3+i;ctx.beginPath();ctx.moveTo(Math.cos(a)*18,Math.sin(a)*16);ctx.quadraticCurveTo(Math.cos(a)*42+Math.sin(t)*12,Math.sin(a)*42,Math.cos(a)*57,Math.sin(a)*40+Math.cos(t)*8);ctx.stroke();}ellipse(0,-7,36,34,'#b587bd','#8b619b');ellipse(-11,-12,7,10,'#fff8e8');ellipse(12,-12,7,10,'#fff8e8');ellipse(-10,-11,3,5,'#38494d');ellipse(11,-11,3,5,'#38494d');ctx.fillStyle='#556255';ctx.font='bold 12px system-ui';ctx.fillText(`巨型章鱼 ${Math.ceil(o.hp)}/${o.maxHp}`,0,-60);ctx.fillStyle='#5d4e6c55';ctx.fillRect(-45,-52,90,6);ctx.fillStyle='#b079bb';ctx.fillRect(-45,-52,90*o.hp/o.maxHp,6);ctx.fillStyle='#418fbb';ctx.fillText(`水柱 ${(o.rangedSkillCooldown??10).toFixed(1)}s`,0,62);monsterStatus(o,-78);ctx.restore();}
    c.mines.forEach(m=>{if(!visible(m.x,m.y,35))return;ellipse(m.x,m.y,19,13,m.type==='water'?'#496f8c':'#806847');ctx.font='19px system-ui';ctx.fillText(m.type==='water'?'💣':'✹',m.x,m.y+5);ctx.font='bold 10px system-ui';ctx.fillStyle='#fff';ctx.fillText(m.type==='water'?'100':'150',m.x,m.y+27);});
    for(const m of c.desert?.monsters||[]){if(m.hp<=0||!visible(m.x,m.y))continue;ctx.save();ctx.translate(m.x,m.y);const worm=m.kind==='worm';if(worm){for(let i=4;i>=0;i--)ellipse(-i*16,Math.sin(clock*3-i)*9,24,29,'#b17a4c','#875633');ellipse(10,0,28,33,'#d09a61','#875633');ellipse(23,0,12,20,'#624635');}else{ctx.strokeStyle='#8a633c';ctx.lineWidth=4;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-5,i*6-6);ctx.lineTo(-24,i*12-12);ctx.moveTo(5,i*6-6);ctx.lineTo(24,i*12-12);ctx.stroke();}ellipse(0,2,13,18,'#a77944');ctx.beginPath();ctx.moveTo(0,15);ctx.quadraticCurveTo(-30,25,-20,-9);ctx.stroke();ellipse(-20,-11,5,7,'#78512e');}ctx.fillStyle='#704b30';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText(`${worm?'沙虫':m.broodOf!==undefined?'蝎子·虫群':'蝎子'} ${Math.ceil(m.hp)}/${m.maxHp}`,0,-48);ctx.fillStyle='#8c663e55';ctx.fillRect(-35,-40,70,5);ctx.fillStyle='#c26b42';ctx.fillRect(-35,-40,70*m.hp/m.maxHp,5);if(worm)ctx.fillText(`虫群 ${(m.broodCooldown??30).toFixed(1)}s`,0,52);monsterStatus(m,-66);ctx.restore();}
    for(const b of c.bears||[]){if(b.hp<=0||!visible(b.x,b.y))continue;ctx.save();ctx.translate(b.x,b.y);ellipse(-19,20,15,17,'#e8f3f5','#8caab8');ellipse(19,20,15,17,'#e8f3f5','#8caab8');ellipse(0,0,35,32,'#f4fafb','#8caab8');ellipse(-21,-26,11,11,'#f4fafb','#8caab8');ellipse(21,-26,11,11,'#f4fafb','#8caab8');ellipse(0,-8,28,24,'#f9ffff','#8caab8');ellipse(-10,-12,3,4,'#344c60');ellipse(10,-12,3,4,'#344c60');ellipse(0,0,8,5,'#344c60');ctx.textAlign='center';ctx.fillStyle='#426b83';ctx.font='bold 12px system-ui';ctx.fillText(`北极熊 ${Math.ceil(b.hp)}/${b.maxHp}`,0,-57);ctx.fillStyle='#a8c7d8';ctx.fillRect(-42,-49,84,6);ctx.fillStyle='#5b9fbc';ctx.fillRect(-42,-49,84*b.hp/b.maxHp,6);ctx.fillText(`冰冻 ${b.freezeCooldown.toFixed(1)}s · 冰锥 ${(b.rangedSkillCooldown??10).toFixed(1)}s`,0,52);monsterStatus(b,-74);ctx.restore();}
    for(const p of c.desert?.shots||[]){if(!visible(p.x,p.y))continue;ellipse(p.x,p.y,11,7,'#d2933c','#906332');}
    c.items.forEach(item=>{if(!visible(item.x,item.y,65))return;ellipse(item.x,item.y+17,20,6,'#507d4535');ellipse(item.x,item.y,22,22,item.type==='summon'?'#f7d8ae':item.type==='revive'?'#f4d9e7':item.type==='teleport'?'#e3dafa':item.type==='staff'?'#e5d8f5':item.type==='omen'?'#e4d3ee':item.type==='sniper'?'#cce3e9':item.type==='potion'?'#efdbfa':item.type==='med'?'#f5f1dd':item.type==='speed'?'#fff0b6':'#dfe9ed');ctx.font='26px system-ui';ctx.fillText(item.type==='summon'?'🎲':item.type==='revive'?'💖':item.type==='teleport'?'🌀':item.type==='staff'?'🪄':item.type==='omen'?'🧿':item.type==='sniper'?'🎯':item.type==='potion'?'🧪':item.type==='med'?'💊':item.type==='speed'?'👟':'🔫',item.x,item.y+9);if(['staff','omen','sniper','teleport','revive','summon'].includes(item.type)){ctx.font='bold 11px system-ui';ctx.fillStyle='#4f6370';ctx.fillText(item.type==='summon'?'首领盲盒 · 5%':item.type==='revive'?'复活道具 · 5%':item.type==='teleport'?'瞬移道具 · 5%':item.type==='staff'?'法杖 · 3次':item.type==='sniper'?'狙击枪 · 3发':'天灾印记 · 1%',item.x,item.y+40);}});
    c.potionShots.forEach(p=>{if(!visible(p.x,p.y,30))return;ellipse(p.x,p.y,15,15,'#ecd6f8');ctx.font='21px system-ui';ctx.fillText(p.kind==='omen'?'🧿':'🧪',p.x,p.y+7);});
    c.bullets.forEach(b=>{if(!visible(b.x,b.y,80))return;if(b.weapon==='sniper'){ctx.strokeStyle='#b9f2f8';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x-b.vx*.025,b.y-b.vy*.025);ctx.lineTo(b.x,b.y);ctx.stroke();}ellipse(b.x,b.y,b.weapon==='sniper'?8:5,3,b.weapon==='sniper'?'#d9f9ff':'#fff0aa','#9f6935');});
    if(c.root>0){ctx.strokeStyle='#bb7c45';ctx.lineWidth=2;for(let i=-28;i<=28;i+=14){ctx.beginPath();ctx.moveTo(state.duck.x+i,state.duck.y-30);ctx.lineTo(state.duck.x+i,state.duck.y+30);ctx.moveTo(state.duck.x-30,state.duck.y+i);ctx.lineTo(state.duck.x+30,state.duck.y+i);ctx.stroke();}}
    if(c.gooseBlinkFlash>0){ctx.strokeStyle='#b995e2';ctx.lineWidth=5;ctx.beginPath();ctx.arc(state.goose.x,state.goose.y,38+(1-c.gooseBlinkFlash/.3)*25,0,Math.PI*2);ctx.stroke();}
    if(state.role==='duck'&&c.gooseSprintTime>0){ctx.strokeStyle='#f5cf70';ctx.lineWidth=4;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(state.goose.x-state.goose.face*(32+i*6),state.goose.y-9+i*12);ctx.lineTo(state.goose.x-state.goose.face*(58+i*7),state.goose.y-9+i*12);ctx.stroke();}}
    if(C.hellGooseAI(state)&&(c.gooseShieldTime>0||c.gooseReviveTime>0)){ctx.strokeStyle='#ffd56a';ctx.lineWidth=6;ctx.beginPath();ctx.arc(state.goose.x,state.goose.y,48,0,Math.PI*2);ctx.stroke();}
    for(const a of [state.duck,state.goose])if(a===state.duck?c.armorTime>0:c.gooseArmorTime>0){ctx.strokeStyle='#77c9ec';ctx.lineWidth=4;ctx.beginPath();ctx.arc(a.x,a.y,43,0,Math.PI*2);ctx.stroke();}
    for(const a of [state.duck,state.goose]){if(a.slowTime>0){ctx.fillStyle='#4d96c0';ctx.font='bold 13px system-ui';ctx.fillText(`减速30% ${a.slowTime.toFixed(1)}s`,a.x-45,a.y-65);}if(a.poisonTime>0){ellipse(a.x,a.y+25,34,10,'#83ad5366');}if(a.stun>0){ctx.font='bold 18px system-ui';ctx.fillStyle='#b68b22';ctx.fillText('✦ 眩晕 ✦',a.x-36,a.y-48);}if(a.potionInvulnerable>0){ctx.strokeStyle='#fff9ae';ctx.lineWidth=5;ctx.beginPath();ctx.arc(a.x,a.y,39,0,Math.PI*2);ctx.stroke();}}
    for(const a of [state.duck,state.goose])if(a.omenArmed){ctx.strokeStyle='#ae78be';ctx.lineWidth=3;ctx.beginPath();ctx.arc(a.x,a.y,46,0,Math.PI*2);ctx.stroke();ctx.font='20px system-ui';ctx.fillText('🧿',a.x,a.y-78);}
    if(c.invulnerable>0){ctx.strokeStyle='#fff9ae';ctx.lineWidth=5;ctx.beginPath();ctx.arc(state.duck.x,state.duck.y,37,0,Math.PI*2);ctx.stroke();}
  }
  function ellipse(x,y,rx,ry,fill,stroke) {ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
  function path(points,fill) {ctx.beginPath();ctx.moveTo(...points[0]);points.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
  function lake(r,index){
    const {x,y,width:w,height:h,radius}=r;
    ctx.beginPath();ctx.roundRect(x-20,y-19,w+40,h+38,radius+15);ctx.fillStyle='#91b883';ctx.fill();
    ctx.beginPath();ctx.roundRect(x-11,y-11,w+22,h+22,radius+9);ctx.fillStyle='#e4dec1';ctx.fill();
    ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,radius);ctx.clip();
    const grad=ctx.createLinearGradient(0,y,0,y+h);grad.addColorStop(0,index?'#b2d9cf':'#a4dbce');grad.addColorStop(1,index?'#80bcb6':'#71b9b5');ctx.fillStyle=grad;ctx.fillRect(x,y,w,h);
    for(let i=0;i<30;i++){const px=x+(i*157+90)%w,py=y+(i*93+70)%h,shift=Math.sin(i)*7;ctx.strokeStyle='#d6f2e780';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px+shift,py);ctx.quadraticCurveTo(px+12+shift,py+5,px+25+shift,py);ctx.stroke();}
    ctx.restore();
    [[62,64,23],[768,373,27],[767,52,19],[79,397,18]].forEach(([dx,dy,rad],i)=>{const px=x+dx,py=y+dy;ellipse(px,py+5,rad,rad*.45,'#4a9e9570');ctx.beginPath();ctx.ellipse(px,py,rad,rad*.65,0,.3,Math.PI*2-.2);ctx.lineTo(px,py);ctx.fillStyle='#699c68';ctx.fill();if(i===1||index){ellipse(px,py-5,7,5,'#f4c6cf');ellipse(px+5,py-8,5,6,'#fae0e0');}});
    [[-27,133],[864,265],[221,-24],[629,475]].forEach(([dx,dy])=>{ellipse(x+dx,y+dy,15,9,'#9dac88');ellipse(x+dx-3,y+dy-3,11,5,'#c5cdb4');});
  }
  function tree(x,y,i){
    ellipse(x,y+25,38,12,'#5b82472b');ctx.fillStyle='#ba9471';ctx.beginPath();ctx.roundRect(x-7,y-10,14,38,5);ctx.fill();
    const color=i%2?'#85b37b':'#94be82';ellipse(x-20,y-30,30,32,color);ellipse(x+17,y-32,31,35,color);ellipse(x,y-56,34,35,color);ellipse(x-10,y-64,17,14,'#b9d398');
    if(i%3===0){ellipse(x-7,y-24,4,4,'#e5b55f');ellipse(x+24,y-34,4,4,'#e5b55f');}
  }
  function centralScene(){
    ctx.fillStyle='#c1dc9c';ctx.fillRect(0,0,2560,1520);
    ctx.fillStyle='#c8dfb3';ctx.fillRect(1280,0,1280,760);
    ctx.fillStyle='#cfdfad';ctx.fillRect(0,760,1280,760);
    ctx.fillStyle='#f0dfac';ctx.fillRect(1280,760,1280,760);
    // 宽步道连接四区；树、贝壳均是装饰，不参与碰撞或减速。
    ctx.strokeStyle='#e8e0bd';ctx.lineWidth=64;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(110,760);ctx.bezierCurveTo(800,700,1700,820,2450,760);ctx.moveTo(1280,100);ctx.bezierCurveTo(1200,500,1360,1060,1280,1420);ctx.stroke();
    ctx.strokeStyle='#f6efcf';ctx.lineWidth=42;ctx.stroke();
    for(let i=0;i<190;i++){
      const x=32+(i*173)%(2560-64),y=40+(i*113)%(1520-70);
      if(M.isWater({x:x+1280,y:y+760})||x>1280&&y>760||Math.abs(x-1280)<65||Math.abs(y-760)<65)continue;
      ctx.strokeStyle='#8cac69';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y+7);ctx.lineTo(x-4,y-3);ctx.moveTo(x,y+7);ctx.lineTo(x+5,y-5);ctx.stroke();
      if(i%4===0){ellipse(x+10,y,4,4,'#fff9d1');ellipse(x+10,y,1.8,1.8,'#e8b959');}
    }
    M.ponds.forEach(p=>lake({...p,x:p.x-1280,y:p.y-760}));
    for(let i=0;i<35;i++){const x=1420+(i%7)*150+(i%2)*22,y=170+Math.floor(i/7)*118;tree(x,y,i);}
    for(let i=0;i<42;i++){
      const x=1400+(i*173)%1080,y=875+(i*113)%540;
      ctx.save();ctx.translate(x,y);ctx.rotate(i*.7);
      if(i%3===0){ctx.fillStyle='#d99c81';ctx.beginPath();for(let j=0;j<10;j++){const a=j*Math.PI/5-Math.PI/2,r=j%2?5:13;const px=Math.cos(a)*r,py=Math.sin(a)*r;if(j===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.fill();}
      else{ellipse(0,0,10,7,i%2?'#fff6db':'#e9b5a6');ctx.strokeStyle='#c1a57c';ctx.lineWidth=1;for(let j=-1;j<=1;j++){ctx.beginPath();ctx.moveTo(-7,j*2);ctx.lineTo(7,j*3);ctx.stroke();}}
      ctx.restore();
    }
    ctx.strokeStyle='#7eaa69';ctx.lineWidth=2;ctx.setLineDash([7,10]);ctx.beginPath();ctx.roundRect(18,25,2560-36,1520-44,22);ctx.stroke();ctx.setLineDash([]);
    ctx.textAlign='center';ctx.font='bold 20px system-ui';ctx.fillStyle='#68895b';
    ctx.fillText('青 苔 池 塘 · 熟 悉 的 出 发 点',640,85);ctx.fillText('松 果 树 林 · 林 间 自 由 穿 行',1920,85);ctx.fillText('睡 莲 池 塘 · 另 一 片 碧 波',640,845);ctx.fillStyle='#aa8654';ctx.fillText('贝 壳 沙 滩 · 踩 着 细 沙 去 冒 险',1920,845);
  }
  function pond(){
    ctx.save();ctx.translate(0,760);
    ctx.fillStyle='#bd8e77';ctx.fillRect(0,0,1280,1520);ctx.fillStyle='#ead597';ctx.fillRect(3840,0,1280,1520);ctx.fillStyle='#70bbc6';ctx.fillRect(4352,0,768,1520);
    ctx.save();ctx.beginPath();ctx.rect(1280,0,2560,1520);ctx.clip();ctx.translate(1280,0);centralScene();ctx.restore();
    // 火山与海岸全部可通行，山体和裂纹只作装饰。
    path([[180,850],[440,290],[650,230],[1000,850]],'#8d6b65');path([[440,290],[520,450],[610,410],[650,230]],'#c78760');ellipse(545,265,112,39,'#684d50');ellipse(545,267,83,23,'#f59a51');ellipse(550,263,45,13,'#ffd375');
    for(let i=0;i<26;i++){const x=100+(i*137)%1080,y=100+(i*179)%1300;ellipse(x,y,16,9,'#967565');}

    ctx.fillStyle='#79574e';ctx.textAlign='center';ctx.font='bold 23px system-ui';ctx.fillText('火 山 原 野 · 小 心 天 降 岩 浆',640,85);ctx.fillStyle='#487b82';ctx.fillText('海 岸 沙 滩 与 蔚 蓝 海 洋',4480,85);
    ctx.restore();
    ctx.fillStyle='#e6c47d';ctx.fillRect(0,0,W,760);
    for(let i=0;i<60;i++){const x=80+(i*317)%(W-160),y=110+(i*131)%570;ellipse(x,y,90,24,'#d8b36855');if(i%4===0){ctx.strokeStyle='#79945f';ctx.lineWidth=9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y+18);ctx.lineTo(x,y-24);ctx.moveTo(x,y);ctx.lineTo(x-15,y);ctx.lineTo(x-15,y-14);ctx.stroke();}}
    ctx.fillStyle='#976c3a';ctx.font='bold 28px system-ui';ctx.textAlign='center';ctx.fillText('金 色 沙 漠 · 小 心 蝎 子 与 沙 虫',W/2,75);
    ctx.fillStyle='#d9eff5';ctx.fillRect(0,2280,W,760);ctx.fillStyle='#effaff';for(let i=0;i<70;i++){const x=60+i*277%(W-120),y=2340+i*137%620;path([[x-60,y+60],[x,y-45],[x+75,y+60]],i%2?'#bbdce9':'#cce6ef');path([[x-20,y-8],[x,y-45],[x+30,y-3]],'#f5fdff');}ctx.fillStyle='#517f99';ctx.font='bold 28px system-ui';ctx.textAlign='center';ctx.fillText('极 光 冰 川 · 小 心 北 极 熊 与 冰 雪 天 灾',W/2,2350);
    for(const p of M.shelters){const water=M.isWater(p);ellipse(p.x,p.y+7,83,62,water?'#407e8d45':'#64804d44');ellipse(p.x,p.y,80,80,water?'#d7b67e':'#b7cc86',water?'#a48b66':'#87a66b');ctx.fillStyle='#fdf5cf';ctx.font='bold 14px system-ui';ctx.fillText(water?'⚑ 避难平台':'⚑ 避难高地',p.x,p.y+5);}
  }
  const terrainTiles=new Map();
  function drawTerrain(camera){
    const firstColumn=Math.floor(camera.x/VW),firstRow=Math.floor(camera.y/VH);
    const lastColumn=Math.ceil((camera.x+VW)/VW),lastRow=Math.ceil((camera.y+VH)/VH);
    for(let row=firstRow;row<lastRow;row++){
      for(let column=firstColumn;column<lastColumn;column++){
        const x=column*VW,y=row*VH,key=row*4+column;
        let tile=terrainTiles.get(key);
        if(!tile){
          tile=document.createElement('canvas');
          tile.width=VW;tile.height=VH;
          const screen=ctx;
          try{
            ctx=tile.getContext('2d',{alpha:false});
            ctx.translate(-x,-y);
            pond();
          }finally{ctx=screen;}
        }
        terrainTiles.delete(key);
        terrainTiles.set(key,tile);
        if(terrainTiles.size>6)terrainTiles.delete(terrainTiles.keys().next().value);
        ctx.drawImage(tile,x,y);
      }
    }
    if(camera.x+VW<4350||camera.y+VH<850||camera.y>2270)return;
    ctx.save();
    ctx.strokeStyle='#c9f1e6';ctx.lineWidth=5;
    ctx.beginPath();
    for(let y=880;y<2280;y+=150){
      if(y<camera.y-12||y>camera.y+VH+12)continue;
      for(let x=4350;x<W;x+=25){
        const py=y+Math.sin(x*.012+clock)*9;
        if(x===4350)ctx.moveTo(x,py);else ctx.lineTo(x,py);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
  function drawDisasters(){const w=state.combat.weather;if(!w)return;const t=w.disasterTime||0;if(C.floodActive(state)){ctx.fillStyle='#469dc951';ctx.fillRect(view.x,view.y,VW,VH);ctx.strokeStyle='#d1f4f080';ctx.lineWidth=2;const startX=Math.floor(view.x/40)*40;
      ctx.beginPath();
      for(let y=80;y<H;y+=120){
        if(y<view.y-12||y>view.y+VH+12)continue;
        for(let x=startX;x<=Math.min(W,view.x+VW+40);x+=40){
          const py=y+Math.sin(x*.012+clock*2)*9;
          if(x===startX)ctx.moveTo(x,py);else ctx.lineTo(x,py);
        }
      }
      ctx.stroke();}
    for(const v of w.ice?.waves||[]){const y=window.DuckGlacier.blizzardY(v,t),top=v.axis==='up'?y:y-180;ctx.fillStyle='#c6ecf4dd';ctx.fillRect(0,top,W,180);ctx.fillStyle='#ffffff';ctx.font='28px system-ui';for(let x=30;x<W;x+=100)ctx.fillText(v.axis==='up'?'❄ ↑':'❄ ↓',x,top+100+Math.sin(x+clock)*30);}
    for(const p of w.ice?.falls||[]){if(!visible(p.x,p.y,p.radius+460))continue;const delay=Math.max(0,p.impactAt-t);ellipse(p.x,p.y,p.radius,p.radius,'#a6dff166','#528cab');ctx.fillStyle='#385d7a';ctx.font='bold 18px system-ui';ctx.textAlign='center';ctx.fillText(`🏔 雪崩 ${delay.toFixed(1)}s · 10000`,p.x,p.y);ellipse(p.x,p.y-delay*450,35,28,'#edfaff','#88b2ca');}
    for(const v of w.stormWaves||[]){const p=window.DuckDisasters.stormY(v,t),vertical=window.DuckDisasters.stormAxis(v)==='y';ctx.fillStyle='#b98238b0';if(vertical)ctx.fillRect(0,p-180,W,180);else ctx.fillRect(p-180,0,180,H);ctx.strokeStyle='#e8ca80';ctx.lineWidth=5;ctx.beginPath();for(let i=0;i<(vertical?W:H);i+=60){if(vertical){ctx.moveTo(i,p-150);ctx.lineTo(i+25,p);}else{ctx.moveTo(p-150,i);ctx.lineTo(p,i-25);}}ctx.stroke();}
    for(const p of w.lava||[]){if(!visible(p.x,p.y,65))continue;ellipse(p.x,p.y,60,60,'#e56a37b0','#a54c31');ellipse(p.x-12,p.y,23,18,'#ffc45c');ctx.font='bold 12px system-ui';ctx.fillStyle='#743828';ctx.textAlign='center';ctx.fillText('岩浆 200/s',p.x,p.y+30);}
    for(const p of w.rocks||[]){if(!visible(p.x,p.y,420))continue;const left=Math.max(0,p.impactAt-t);ellipse(p.x,p.y,55,55,'#f8a44350','#b34f38');ctx.fillStyle='#a3452f';ctx.font='bold 16px system-ui';ctx.textAlign='center';ctx.fillText(`🌋 ${left.toFixed(1)}s`,p.x,p.y+5);const rockY=p.y-left*420;ctx.strokeStyle='#ffb64f';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(p.x+25,rockY-70);ctx.lineTo(p.x,rockY);ctx.stroke();ellipse(p.x,rockY,15,20,'#a95639','#ffd266');}
    for(const v of w.waves||[]){const x=window.DuckDisasters.waveX(v,t);ctx.fillStyle='#509ec9aa';ctx.fillRect(x,0,160,H);ctx.strokeStyle='#e9fcf8';ctx.lineWidth=9;ctx.beginPath();for(let y=0;y<=H;y+=20){const px=x+Math.sin(y*.025+clock*5)*10;if(y===0)ctx.moveTo(px,y);else ctx.lineTo(px,y);}ctx.stroke();}
  }
  function miniMap(camera){
    const mobile=window.innerWidth<650,mw=mobile?350:300,mh=mobile?200:148,x=VW-mw-18,y=18,pad=12,top=mobile?42:30,iw=mw-pad*2,ih=mh-top-(mobile?36:26),sx=iw/W,sy=ih/H;
    ctx.save();ctx.fillStyle='#fffdf3ed';ctx.strokeStyle='#9ab48e';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(x,y,mw,mh,14);ctx.fill();ctx.stroke();ctx.textAlign='left';ctx.font=`bold ${mobile?25:12}px system-ui`;ctx.fillStyle='#355b43';ctx.fillText('冒险世界 · '+M.region(C.player(state)),x+pad,y+(mobile?31:19));
    ctx.save();ctx.translate(x+pad,y+top);ctx.fillStyle='#b38978';ctx.fillRect(0,0,iw/4,ih);ctx.fillStyle='#bdd49e';ctx.fillRect(iw/4,0,iw/2,ih);ctx.fillStyle='#ead597';ctx.fillRect(iw*.75,0,iw*.25,ih);ctx.fillStyle='#70bbc6';ctx.fillRect(4352*sx,0,768*sx,ih);
    ctx.fillStyle='#e6c47d';ctx.fillRect(0,0,iw,760*sy);ctx.fillStyle='#d9eff5';ctx.fillRect(0,2280*sy,iw,760*sy);if(C.floodActive(state)){ctx.fillStyle='#7fb6d1';ctx.fillRect(0,0,iw,ih);}ctx.fillStyle='#80bbb5';for(const p of M.ponds)ctx.fillRect(p.x*sx,p.y*sy,p.width*sx,p.height*sy);
    for(const p of M.shelters)ellipse(p.x*sx,p.y*sy,2,2,'#fff4b1');const w=state.combat.weather;for(const p of [...(w?.rocks||[]),...(w?.lava||[])])ellipse(p.x*sx,p.y*sy,3,3,'#db6236');for(const m of w?.meteors||[])if(!m.hit)ellipse(m.x*sx,m.y*sy,3,3,'#d47b35');
    for(const v of C.vortices(state))ellipse(v.center.x*sx,v.center.y*sy,4,4,'#6972aa');
    const giant=w?.giantMeteor;if(giant&&w.disasterTime>=giant.impactAt-5&&w.disasterTime<=giant.impactAt+1){ctx.save();ctx.beginPath();ctx.rect(0,0,iw,ih);ctx.clip();ellipse(giant.x*sx,giant.y*sy,giant.radius*sx,giant.radius*sy,'#d7473a66','#b53a2e');ctx.restore();}
    for(const item of state.combat.items)if(['staff','sniper','omen','teleport','revive','summon'].includes(item.type))ellipse(item.x*sx,item.y*sy,2.5,2.5,item.type==='sniper'?'#406f91':'#a273ad');
    for(const c of state.combat.cannons||[])ellipse(c.x*sx,c.y*sy,3,3,'#3d5665');for(const o of state.combat.octopuses||[])if(o.hp>0)ellipse(o.x*sx,o.y*sy,4,4,'#a66cb2');
    for(const m of state.combat.desert?.monsters||[])if(m.hp>0)ellipse(m.x*sx,m.y*sy,m.kind==='worm'?5:2.5,m.kind==='worm'?5:2.5,'#98613c');
    for(const v of w?.stormWaves||[]){ctx.fillStyle='#a06c31';const pos=window.DuckDisasters.stormY(v,w.disasterTime);if(window.DuckDisasters.stormAxis(v)==='y')ctx.fillRect(0,(pos-180)*sy,iw,Math.max(3,180*sy));else ctx.fillRect((pos-180)*sx,0,Math.max(3,180*sx),ih);}
    for(const g of state.combat.godzillas||[])if(g.hp>0){ellipse(g.x*sx,g.y*sy,5,5,'#308c76','#bffaff');if(g.beam){ctx.strokeStyle='#33c5e6';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(g.beam.x*sx,g.beam.y*sy);ctx.lineTo(g.beam.tx*sx,g.beam.ty*sy);ctx.stroke();}}
    for(const b of state.combat.bears||[])if(b.hp>0)ellipse(b.x*sx,b.y*sy,4,4,'#f5fcff','#528cab');for(const p of w?.ice?.falls||[])ellipse(p.x*sx,p.y*sy,p.radius*sx,p.radius*sy,'#71b8df88','#528cab');for(const v of w?.ice?.waves||[]){ctx.fillStyle='#b4e5f3';ctx.fillRect(0,(window.DuckGlacier.blizzardY(v,w.disasterTime)+(v.axis==='up'?0:-180))*sy,iw,Math.max(3,180*sy));}
    for(const v of w?.waves||[]){ctx.fillStyle='#3798d4';ctx.fillRect(window.DuckDisasters.waveX(v,w.disasterTime)*sx,0,Math.max(3,160*sx),ih);}
    ctx.strokeStyle='#587d66';ctx.lineWidth=2;ctx.strokeRect(camera.x*sx,camera.y*sy,VW*sx,VH*sy);
    for(const [a,color] of [[state.duck,'#edba35'],[state.goose,'#c76550']]){ellipse(a.x*sx,a.y*sy,4.5,4.5,color,'#fffdf5');if(a===C.player(state)){ctx.strokeStyle='#2c5140';ctx.beginPath();ctx.arc(a.x*sx,a.y*sy,7,0,Math.PI*2);ctx.stroke();}}
    ctx.restore();ctx.font=`${mobile?20:11}px system-ui`;ctx.textAlign='left';ctx.fillStyle='#65805b';ctx.fillText('黄鸭 · 红鹅 · 高地 · 蓝海啸 · 红陨石',x+pad,y+mh-10);ctx.restore();
  }
  function bird(b,isGoose,isClone=false) {
    ctx.save();if(isClone)ctx.globalAlpha=.58;
    const bob=state.phase==='playing'?Math.sin(clock*9)*1.5:Math.sin(clock*2)*1;
    const onLand=!C.isWater(b,state);if(b.freezeTime>0)ellipse(b.x,b.y,35,40,'#a4dff060','#64a2c0');
    ellipse(b.x,b.y+20,29,8,onLand?'#70894645':'#438e8e45');
    if(onLand){ellipse(b.x-9,b.y+22,6,3,'#db9a40');ellipse(b.x+9,b.y+22,6,3,'#db9a40');}
    if(!isGoose && state.skill.boost>0){ctx.strokeStyle='#f9ed88';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(b.x,b.y+12,35,23,0,0,Math.PI*2);ctx.stroke();}
    ctx.save();ctx.translate(b.x,b.y+bob);ctx.scale(b.face,1);
    const fill=isGoose?'#fffef2':'#f7d15a', edge=isGoose?'#d4d8c3':'#dca638';
    path([[-22,4],[-33,-7],[-29,12]],fill);
    ellipse(-3,6,isGoose?27:24,19,fill,edge);
    if(isGoose){ctx.beginPath();ctx.moveTo(11,7);ctx.quadraticCurveTo(0,-20,16,-35);ctx.lineWidth=15;ctx.strokeStyle=fill;ctx.lineCap='round';ctx.stroke();}
    const hx=isGoose?18:17,hy=isGoose?-33:-13;
    ellipse(hx,hy,isGoose?13:17,isGoose?14:17,fill,edge);
    ellipse(-8,8,13,8,isGoose?'#e8eade':'#edbc43');
    path([[hx+10,hy-1],[hx+28,hy+3],[hx+11,hy+8]],'#ed9143');
    ellipse(hx+6,hy-4,2.6,3,'#30483d');ellipse(hx+7,hy-5,1,1,'#fff');
    if(isGoose){ctx.strokeStyle='#30483d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(hx+1,hy-10);ctx.lineTo(hx+10,hy-7);ctx.stroke();}else{ellipse(hx+3,hy+6,4,2.5,'#efa06b');}
    const gunActor=isClone?state.duck:b,sniper=C.weapon(gunActor)==='sniper';if(C.ammunition(gunActor)>0||b.fireFlash>0){ctx.fillStyle=isClone?'#665186':sniper?'#426b7b':'#3f4e55';ctx.fillRect(9,9,sniper?43:25,6);ctx.fillRect(13,14,7,9);if(sniper){ctx.fillRect(24,3,15,4);ellipse(30,3,6,3,'#7894a2');}if(b.fireFlash>0){const tip=sniper?52:35;path([[tip,7],[tip+9,5],[tip+5,12],[tip+11,17],[tip,16]],'#ffda64');}}
    ctx.restore();
    ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillStyle=isGoose?'#497475':'#6b631e';ctx.fillText(isClone?'分身':(b===C.player(state)?'你 · ':'电脑 · ')+(isGoose?'大鹅':'鸭子'),b.x,b.y+(isGoose?-57:-38));
    if(!isClone){const barY=b.y+(isGoose?-70:-51);ctx.fillStyle='#2b463c55';ctx.fillRect(b.x-30,barY,60,6);ctx.fillStyle=isGoose?'#d77857':'#6aab6d';ctx.fillRect(b.x-30,barY,60*b.hp/b.maxHp,6);}
    ctx.restore();
  }
  function draw() {
    ctx.clearRect(0,0,VW,VH);
    const camera=M.camera(C.player(state));view=camera;
    const cameraX=camera.x.toFixed(2),cameraY=camera.y.toFixed(2);
    if(canvas.dataset.cameraX!==cameraX)canvas.dataset.cameraX=cameraX;
    if(canvas.dataset.cameraY!==cameraY)canvas.dataset.cameraY=cameraY;
    ctx.save();ctx.translate(-camera.x,-camera.y);drawTerrain(camera);
    state.trail.forEach(p=>{ctx.globalAlpha=p.life/.35*.5;ellipse(p.x,p.y,23,17,'#fff3a0');});ctx.globalAlpha=1;
    state.bread.forEach(b=>{if(!visible(b.x,b.y,30))return;const y=b.y+Math.sin(clock*3+b.bob)*3;ellipse(b.x,y+14,17,5,'#438e8e35');ctx.save();ctx.translate(b.x,y);ctx.rotate(Math.sin(b.bob)*.2);ctx.beginPath();ctx.roundRect(-12,-10,24,24,5);ctx.fillStyle='#bc783a';ctx.fill();ctx.beginPath();ctx.roundRect(-9,-9,18,19,4);ctx.fillStyle='#ffdf91';ctx.fill();ellipse(-4,-8,7,6,'#ffdf91');ellipse(4,-8,7,6,'#ffdf91');[[-4,0],[3,4],[-2,7]].forEach(([x,y])=>ellipse(x,y,1.5,1.5,'#d5a657'));ctx.restore();});
    drawWeather();drawDisasters();drawCombat();
    [ [state.duck,false,false],[state.goose,true,false],...state.combat.clones.map(c=>[c,false,true]) ].sort((a,b)=>a[0].y-b[0].y).forEach(([b,g,clone])=>{if(visible(b.x,b.y))bird(b,g,clone);});
    state.combat.effects.forEach(e=>{if(!visible(e.x,e.y))return;ctx.globalAlpha=Math.min(1,e.life*2);ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.fillStyle=e.color;ctx.fillText(e.label,e.x,e.y-40-(.8-e.life)*35);});ctx.globalAlpha=1;
    state.particles.forEach(p=>{ctx.globalAlpha=p.life/p.max;ellipse(p.x,p.y,3,3,'#ffecaa');});ctx.globalAlpha=1;
    if(state.phase==='playing' && !C.coopActive(state) && distance(state.duck,state.goose)<130){ctx.font='bold 20px system-ui';ctx.fillStyle='#b6533d';ctx.textAlign='center';ctx.fillText('！',state.goose.x,state.goose.y-75);}
    ctx.restore();miniMap(camera);
  }
  function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;clock+=dt;update(dt);draw();requestAnimationFrame(frame);}
  const movement=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'];
  window.addEventListener('keydown',e=>{if(movement.includes(e.code)){e.preventDefault();if(state.phase==='playing')keys.add(e.code);}if((e.code==='ShiftLeft'||e.code==='ShiftRight')&&!e.repeat){e.preventDefault();dash();}if(e.code==='Space'&&!e.repeat){e.preventDefault();shoot();}if(e.code==='KeyR'&&!e.repeat){e.preventDefault();switchGun();}if(e.code==='KeyJ'&&!e.repeat){e.preventDefault();activateArmor();}if(e.code==='KeyK'&&!e.repeat){e.preventDefault();activateClones();}if(e.code==='KeyT'&&!e.repeat){e.preventDefault();activateTeleport();}if(e.code==='KeyH'&&!e.repeat){e.preventDefault();activateStaff();}if(e.code==='KeyM'&&!e.repeat){e.preventDefault();tossOmen();}if(e.code==='KeyL'&&!e.repeat){e.preventDefault();tossPotion();}if(e.code==='KeyP'&&!e.repeat){e.preventDefault();pause();}});
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{keys.clear();if(state.phase==='playing')pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.phase==='playing')pause();});
  el('start').addEventListener('click',()=>{if(replaySession&&state.phase==='won'){start(Math.min(state.level+1,clearedByMode[state.difficulty]),state.score);}else if(state.phase==='paused')pause();else if(state.phase==='lost'){selectedRole=state.role;selectedDifficulty=state.difficulty;roleControls();start(state.level,state.score);}else if(state.phase==='won'&&state.level<TOTAL_LEVELS){selectedRole=state.role;selectedDifficulty=state.difficulty;roleControls();start(state.level+1,state.score);}else start();});
  el('pause').addEventListener('click',pause);
  el('teleport').addEventListener('click',activateTeleport);
  el('staff').addEventListener('click',activateStaff);
  el('fire').addEventListener('click',shoot);
  el('weapon').addEventListener('click',switchGun);
  el('armor').addEventListener('click',activateArmor);
  el('clone').addEventListener('click',activateClones);
  el('omen').addEventListener('click',tossOmen);
  el('potion').addEventListener('click',tossPotion);
  document.querySelectorAll('[data-role]').forEach(button=>button.addEventListener('click',()=>{selectedRole=button.dataset.role;roleControls();if(state.phase==='playing')pause();if(state.phase==='ready'){fresh();draw();}else el('status').textContent='已选择'+(selectedRole==='goose'?'大鹅':'鸭子')+'，点击「新开一局」生效。';}));
  document.querySelectorAll('[data-difficulty]').forEach(button=>button.addEventListener('click',()=>switchDifficulty(button.dataset.difficulty)));
  el('new-game').addEventListener('click',()=>{replaySession=false;start();levelControls();});
  el('replay-level').addEventListener('click',replayLevel);
  el('dash').addEventListener('click',()=>{dash();canvas.focus();});
  el('save').addEventListener('click',saveProgress);
  el('load').addEventListener('click',()=>loadProgress());
  el('load-manual').addEventListener('click',()=>loadProgress(SAVE_KEY));
  el('fullscreen').addEventListener('click',toggleFullscreen);
  document.addEventListener('fullscreenchange',fullscreenControls);
  document.addEventListener('webkitfullscreenchange',fullscreenControls);
  window.addEventListener('pagehide',autoSave);
  window.addEventListener('beforeunload',autoSave);
  window.addEventListener('storage',e=>{if(e.key===null||e.key?.startsWith(SAVE_KEY)||e.key?.startsWith(AUTO_SAVE_KEY)||e.key?.startsWith('duck-bread-cleared-v1-')){savedGame=readLatestSave();saveControls();levelControls();}});
  document.querySelectorAll('[data-key]').forEach(button=>{
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);if(state.phase==='playing')keys.add(button.dataset.key);});
    ['pointerup','pointercancel','lostpointercapture'].forEach(event=>button.addEventListener(event,()=>keys.delete(button.dataset.key)));
  });
  fresh();roleControls(); requestAnimationFrame(frame);
})();
