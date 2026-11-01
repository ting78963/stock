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
test('first golden cross',()=>assert.equal(calc(rows(99.75,104.75),100),'golden_cross_day1'));
test('MA20/60 requires 61 daily closes',()=>assert.equal(calc(rows(99,100).slice(0,60),60),''));
test('MA20/60 approaching cross',()=>assert.equal(calc(rows(99,100.25),60),'prepare'));
test('MA20/60 first golden cross',()=>assert.equal(calc(rows(99.75,104.75),60),'golden_cross_day1'));
test('MA20/60 flat prices do not alert',()=>assert.equal(calc(rows(100,100),60),''));
test('MA20/100 ignores a gap wider than 0.75%',()=>assert.equal(calc(rows(98,99),100),''));
test('score threshold is below 55 in both refresh paths',()=>{
  assert.equal((html.match(/a\.overall<55/g)||[]).length,2);
  assert.equal(54<55,true);assert.equal(55<55,false);
});
test('watchlist renders overlapping signals without duplicating stored entries',()=>{
  let watch=[{sym:'2069',name:'運錩',score:60,wkKDLabel:'prepare',dayMA100Label:'prepare',dayMA60Label:'golden_cross_day1',vcpStatus:'contracting'},{sym:'2330',name:'台積電',score:55,vcpStatus:'just_broke'}];
  const area={innerHTML:''};
  const ctx={LS:{get:()=>watch,set:(_k,v)=>{watch=v}},document:{getElementById:()=>area},sc:()=> '#777',getStockName:()=>null,updateWatchScores:()=>{}};
  vm.runInNewContext(extract('function rW(){','\nfunction rmW(')+';rW();',ctx);
  assert.match(area.innerHTML,/週KD準備交叉/);
  assert.match(area.innerHTML,/日20／100MA準備交叉/);
  assert.match(area.innerHTML,/日20／60MA黃金交叉 Day1/);
  assert.equal((area.innerHTML.match(/gs\('2069'\)/g)||[]).length,3);
  assert.equal((area.innerHTML.match(/gs\('2330'\)/g)||[]).length,1);
  assert.equal(watch.length,2);
});

test('watchlist signal badges do not break inside labels',()=>{
  const render=extract('function rW(){','\nfunction rmW(');
  assert.equal((render.match(/white-space:nowrap/g)||[]).length,4);
  assert.doesNotMatch(render,/黃金交叉第一天/);
  assert.match(render,/黃金交叉 Day/);
});

test('bullish MA20/60 and MA20/100 remain watchlisted beyond Day5',()=>{
  const sustained=Array.from({length:130},(_,i)=>({date:String(i),close:i<105?100:110}));
  assert.equal(calc(sustained,60),'bullish');
  assert.equal(calc(sustained,100),'bullish');
  const watch=[{sym:'1808',name:'潤隆',score:75,dayMA60Label:'bullish',dayMA100Label:'bullish',wkKDLabel:'prepare'}];
  const area={innerHTML:''};
  const ctx={LS:{get:()=>watch,set:()=>{}},document:{getElementById:()=>area},sc:()=> '#777',getStockName:()=>null,updateWatchScores:()=>{}};
  vm.runInNewContext(extract('function rW(){','\nfunction rmW(')+';rW();',ctx);
  assert.match(area.innerHTML,/日20／60MA多頭觀察/);
  assert.match(area.innerHTML,/日20／100MA多頭觀察/);
  assert.match(area.innerHTML,/週KD準備交叉/);
  assert.equal(watch.length,1);
});

test('weekly KD counts trading days and expires after Day5',()=>{
  const source=extract('function calcWeeklyKDLabel(','\nfunction analyzeVCP(');
  const dates=Array.from({length:80},(_,i)=>{const d=new Date('2026-01-05T12:00:00Z');d.setUTCDate(d.getUTCDate()+Math.floor(i/5)*7+i%5);return {date:d.toISOString().slice(0,10),close:100,high:102,low:98};});
  // KD hist starts from weekly bar 9, so hist[0] corresponds to weekly bar 9.
  // Cross at the start of week 15, then count trading sessions, not calendar days.
  const ctx={calcKD:(weekly)=>({hist:weekly.slice(8).map((_,i)=>({k:i>=6?60:40,d:50}))})};
  const fn=vm.runInNewContext(source+';calcWeeklyKDLabel',ctx);
  assert.equal(fn(dates.slice(0,71)),'golden_cross_day1');
  assert.equal(fn(dates.slice(0,75)),'golden_cross_day5');
  assert.equal(fn(dates.slice(0,76)),null);
  assert.equal(fn(dates.slice(0,70)),null);
});

test('analysis card also renders weekly KD day count',()=>{
  assert.match(html,/s\.wkKDLabel\.startsWith\('golden_cross_day'\)/);
});

test('MA20/60 and MA20/100 count Day2-Day5 then retain bullish trend',()=>{
  for(const period of [60,100]){
    const base=Array.from({length:125},(_,i)=>({date:String(i),close:i<119?100:110}));
    for(let day=1;day<=5;day++){
      const sample=base.slice(0,119+day);
      assert.equal(calc(sample,period),'golden_cross_day'+day,'MA'+period+' Day'+day);
    }
    assert.equal(calc(base,period),'bullish');
    const reversed=base.concat(Array.from({length:20},(_,i)=>({date:'reversal'+i,close:30})));
    assert.notEqual(calc(reversed,period),'bullish');
  }
});

test('MA5/20 cross disappears after bearish reversal even inside Day5',()=>{
  const fn=vm.runInNewContext(extract('function calcMA5MA20CrossLabel(','\n// 5/20MA 準備上穿')+';calcMA5MA20CrossLabel');
  const base=Array.from({length:35},(_,i)=>({date:String(i),close:i<30?100:110}));
  assert.equal(fn(base.slice(0,31)),1);
  const reversed=base.slice(0,32).concat([{date:'reversal',close:20}]);
  assert.equal(fn(reversed),null);
});
