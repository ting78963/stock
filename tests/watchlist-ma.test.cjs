// Run: node --test tests/watchlist-ma.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
function extract(start,end){const i=html.indexOf(start);const j=html.indexOf(end,i);assert.ok(i>=0&&j>i);return html.slice(i,j);}
const calc = vm.runInNewContext(extract('function calcWatchDayMACross(', '\nfunction rW(){')+';calcWatchDayMACross');
function rows(base,last){return Array.from({length:120},(_,i)=>({date:String(i),close:i<99?100:i<119?base:last}));}
test('MA20/100 requires enough data',()=>assert.equal(calc(rows(99,100).slice(0,99),100),''));
test('flat MA does not alert',()=>assert.equal(calc(rows(100,100),100),''));
test('approaching cross',()=>assert.equal(calc(rows(99,100.25),100),'prepare'));
test('first golden cross',()=>assert.equal(calc(rows(99.75,104.75),100),'golden_cross'));
test('score threshold is below 55 in both refresh paths',()=>{
  assert.equal((html.match(/a\.overall<55/g)||[]).length,2);
  assert.equal(54<55,true);assert.equal(55<55,false);
});
test('watchlist renders overlapping signals without duplicating stored entries',()=>{
  let watch=[{sym:'2069',name:'運錩',score:60,wkKDLabel:'prepare',dayMA100Label:'prepare',dayMA60Label:'golden_cross',vcpStatus:'contracting'},{sym:'2330',name:'台積電',score:55,vcpStatus:'just_broke'}];
  const area={innerHTML:''};
  const ctx={LS:{get:()=>watch,set:(_k,v)=>{watch=v}},document:{getElementById:()=>area},sc:()=> '#777',getStockName:()=>null,updateWatchScores:()=>{}};
  vm.runInNewContext(extract('function rW(){','\nfunction rmW(')+';rW();',ctx);
  assert.match(area.innerHTML,/週KD準備交叉/);
  assert.match(area.innerHTML,/日20／100MA準備交叉/);
  assert.match(area.innerHTML,/日20／60MA黃金交叉第一天/);
  assert.equal((area.innerHTML.match(/gs\('2069'\)/g)||[]).length,3);
  assert.equal((area.innerHTML.match(/gs\('2330'\)/g)||[]).length,1);
  assert.equal(watch.length,2);
});
