/* 通关记录独立于战斗快照；重玩不会降低解锁进度。 */
((root)=>{const total=40,cleared=n=>Number.isInteger(n)&&n>=0&&n<=total?n:0;
const fromSave=s=>s&&Number.isInteger(s.level)&&s.level>=1&&s.level<=total?s.completed?s.level:s.level-1:0;
const merge=(n,saves)=>Math.max(cleared(n),...saves.map(fromSave));
const canReplay=(n,max)=>Number.isInteger(n)&&n>=1&&n<=cleared(max);
const api={cleared,fromSave,merge,canReplay};if(typeof module==='object'&&module.exports)module.exports=api;else root.DuckCampaign=api;
})(typeof window==='object'?window:globalThis);
