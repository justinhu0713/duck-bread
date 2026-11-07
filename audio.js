/* 本地音效：不依赖在线链接，浏览器首次点击后解锁播放。 */
(() => {
  'use strict';
  let enabled=true, unlocked=false, priming=false;
  try { enabled=localStorage.getItem('duck-bread-sound')!=='off'; } catch (_) {}
  const warning=new Audio('assets/audio/run-away-tight.wav');
  const caught=new Audio('assets/audio/caught-short.mp3');
  const crunches=Array.from({length:3},()=>new Audio('assets/audio/crunch-tight.wav'));
  const explosions=Array.from({length:2},()=>new Audio('assets/audio/explosion.wav'));
  const gunshots=Array.from({length:4},()=>new Audio('assets/audio/pistol-shot.wav'));
  const snipers=Array.from({length:4},()=>new Audio('assets/audio/awp-shot.wav'));
  snipers.forEach(a=>a.volume=.5);
  const sniperReloads=Array.from({length:2},()=>new Audio('assets/audio/awp-reload.wav'));
  sniperReloads.forEach(a=>a.volume=.55);
  const reloads=Array.from({length:2},()=>new Audio('assets/audio/pistol-reload.wav'));
  const headshots=Array.from({length:2},()=>new Audio('assets/audio/headshot.wav'));
  const cannons=Array.from({length:3},()=>new Audio('assets/audio/cannon.wav'));
  cannons.forEach(a=>a.volume=.55);
  const sounds=[...cannons,warning,caught,...crunches,...explosions,...gunshots,...snipers,...sniperReloads,...headshots,...reloads];
  const pending=new Set();
  warning.volume=.7;caught.volume=.7;crunches.forEach(a=>a.volume=.5);
  explosions.forEach(a=>a.volume=.45);
  gunshots.forEach(a=>a.volume=.5);headshots.forEach(a=>a.volume=.6);
  reloads.forEach(a=>a.volume=.55);
  sounds.forEach(a=>{a.preload='auto';});
  let cannonIndex=0,crunchIndex=0,explosionIndex=0,gunshotIndex=0,sniperIndex=0,sniperReloadIndex=0,headshotIndex=0,reloadIndex=0;
  function stop(){pending.clear();sounds.forEach(a=>{a.pause();a.currentTime=0;});}
  function unlock(){
    if(unlocked||priming||!enabled)return;
    priming=true;
    Promise.all(sounds.map(a=>{
      const volume=a.volume;a.volume=0;
      return a.play().then(()=>{a.pause();a.currentTime=0;a.volume=volume;return true;}).catch(()=>{a.volume=volume;return false;});
    })).then(results=>{unlocked=results.every(Boolean);priming=false;const queued=[...pending];pending.clear();queued.forEach(play);});
  }
  function play(a){
    if(!enabled)return;
    if(priming){pending.add(a);return;}
    a.currentTime=0;
    a.play().catch(()=>{document.getElementById('status').textContent='音效未能播放，请点击音效按钮重新开启。';});
  }
  function controls(){
    const button=document.getElementById('sound');
    button.textContent=enabled?'🔊 音效开':'🔇 音效关';
    button.setAttribute('aria-pressed',String(enabled));
  }
  document.getElementById('sound').addEventListener('click',()=>{
    enabled=!enabled;
    if(!enabled)stop();else unlock();
    try{localStorage.setItem('duck-bread-sound',enabled?'on':'off');}catch(_){}
    controls();
  });
  window.DuckAudio={unlock,stop,cannon(){play(cannons[cannonIndex++%cannons.length]);},warning(){if(priming||warning.paused)play(warning);},caught(){play(caught);},crunch(){play(crunches[crunchIndex++%crunches.length]);},explosion(){play(explosions[explosionIndex++%explosions.length]);},gunshot(){play(gunshots[gunshotIndex++%gunshots.length]);},sniperReload(){play(sniperReloads[sniperReloadIndex++%sniperReloads.length]);},sniper(){play(snipers[sniperIndex++%snipers.length]);},headshot(){play(headshots[headshotIndex++%headshots.length]);},reload(){play(reloads[reloadIndex++%reloads.length]);}};
  controls();
})();
