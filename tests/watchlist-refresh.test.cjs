const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
const part=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert.ok(i>=0&&j>i);return html.slice(i,j);};
const update=part('async function updateWatchScores(','\nfunction gs(');
const full=part('async function fullWatchUpdate(','\nasync function scanWatchWeeklyKD(');
function makeContext(stocks,responses){
  let items=stocks.map(x=>({...x}));const elements={};
  const ctx={
    LS:{get:()=>items,set:(_k,v)=>{items=v}},
    document:{getElementById:id=>elements[id]||(elements[id]={style:{},textContent:'',innerHTML:''})},
    fetchStock:async sym=>{const v=responses[sym];if(v instanceof Error)throw v;return v},
    analyze:raw=>({overall:raw.score,vcp:{status:'contracting'}}),
    calcWatchDayMACross:(_rows,n)=>n===100?'prepare':'golden_cross',
    calcWeeklyKDLabel:()=>'',calcMA5MA20CrossLabel:()=>'',calcMA5MA20Prepare:()=>false,
    calcMACD:()=>({histArr5:[],hist:0,prev_hist:0}),
    rW:()=>{},localStorage:{setItem:()=>{}},
    setTimeout:(fn)=>{fn();return 1},Date,Promise,console
  };
  const data=score=>({score,data:Array.from({length:120},(_,i)=>({date:'2026-01-'+String(i+1).padStart(3,'0'),close:100}))});
  return {ctx,items:()=>items,data};
}
test('score refresh removes only <55, retains 55 and failures, sets MA labels',async()=>{
  const f=makeContext([{sym:'54',score:60},{sym:'55',score:60},{sym:'fail',score:60}],{});
  f.ctx.fetchStock=async sym=>sym==='fail'?Promise.reject(Error('network')):f.data(Number(sym));
  vm.runInNewContext(update+';this.updateWatchScores=updateWatchScores',f.ctx);
  await f.ctx.updateWatchScores();
  assert.deepEqual(f.items().map(x=>x.sym),['55','fail']);
  assert.equal(f.items()[0].dayMA100Label,'prepare');
  assert.equal(f.items()[0].dayMA60Label,'golden_cross');
});
test('full refresh removes only <55, retains 55 and failures, sets MA labels',async()=>{
  const f=makeContext([{sym:'54',score:60},{sym:'55',score:60},{sym:'fail',score:60}],{});
  f.ctx.fetchStock=async sym=>sym==='fail'?Promise.reject(Error('network')):f.data(Number(sym));
  vm.runInNewContext(full+';this.fullWatchUpdate=fullWatchUpdate',f.ctx);
  await f.ctx.fullWatchUpdate(false);
  assert.deepEqual(f.items().map(x=>x.sym),['55','fail']);
  assert.equal(f.items()[0].dayMA100Label,'prepare');
  assert.equal(f.items()[0].dayMA60Label,'golden_cross');
});
