const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('function rW(){');
  const end = html.indexOf('\nfunction rmW(', start);
  if(start<0||end<0)throw Error('watchlist render function not found');
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    await page.setContent('<html><body><div id="wa"></div></body></html>');
    const result=await page.evaluate(code=>{
      const items=[
        {sym:'2069',name:'運錩',score:60,wkKDLabel:'prepare',dayMA100Label:'prepare',dayMA60Label:'golden_cross',vcpStatus:'contracting'},
        {sym:'2330',name:'台積電',score:55,vcpStatus:'just_broke'}
      ];
      window.LS={get:()=>items,set:()=>{}};
      window.sc=()=> '#777';
      window.getStockName=()=>null;
      window.updateWatchScores=()=>{};
      (0,eval)(code+';rW();');
      const el=document.getElementById('wa');
      return {
        labels:el.textContent,
        stock2069:el.querySelectorAll('.li[onclick="gs(\'2069\')"]').length,
        stock2330:el.querySelectorAll('.li[onclick="gs(\'2330\')"]').length,
        overflow:document.documentElement.scrollWidth>window.innerWidth
      };
    },html.slice(start,end));
    if(!result.labels.includes('週KD準備交叉'))throw Error('weekly KD section missing');
    if(!result.labels.includes('日20／100MA準備交叉'))throw Error('100MA section missing');
    if(!result.labels.includes('日20／60MA黃金交叉第一天'))throw Error('60MA section missing');
    if(result.stock2069!==3||result.stock2330!==1)throw Error('wrong section item counts: '+JSON.stringify(result));
    if(result.overflow)throw Error('mobile horizontal overflow');
    console.log('Browser watchlist render PASS',JSON.stringify({stock2069:result.stock2069,stock2330:result.stock2330,mobileOverflow:result.overflow}));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
