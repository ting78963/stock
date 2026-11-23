const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const a=html.indexOf('async function fetchYahooBatch(symbols){');
  const b=html.indexOf('\nasync function fetchIntlMarket()',a);
  const c=html.indexOf('async function fetchSoxYahooChart(){');
  const d=html.indexOf('\nwindow.addEventListener(\'load\'',c);
  if(a<0||b<0||c<0||d<0)throw Error('SOX functions missing');
  const js=html.slice(a,b)+'\n'+html.slice(c,d);
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.setContent('<div id="stock-sox-val">--</div><span id="stock-sox-chg">--</span><div id="stock-sox-status"></div>');
    const result=await page.evaluate(async code=>{
      const calls=[];
      window.fetch=async url=>{
        calls.push(url);
        if(url.includes('/v7/'))return {ok:false,status:401};
        if(url.includes('/v8/'))return {ok:true,json:async()=>({chart:{result:[{meta:{regularMarketPrice:9589.096,chartPreviousClose:9500,regularMarketTime:1795454119}}]}})};
        throw Error('unexpected URL');
      };
      (0,eval)(code+';window.__loadStockSox=loadStockSox;');
      await window.__loadStockSox(true);
      return {value:document.getElementById('stock-sox-val').textContent,change:document.getElementById('stock-sox-chg').textContent,status:document.getElementById('stock-sox-status').textContent,calls};
    },js);
    if(result.value!=='9,589.096')throw Error('wrong SOX price: '+JSON.stringify(result));
    if(result.change!=='+0.94%')throw Error('wrong SOX percent: '+JSON.stringify(result));
    if(!result.status.includes('美股報價'))throw Error('missing quote time: '+JSON.stringify(result));
    if(!result.calls.some(x=>x.includes('/v8/')))throw Error('chart fallback not used');
    console.log('SOX browser render PASS',JSON.stringify(result));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
