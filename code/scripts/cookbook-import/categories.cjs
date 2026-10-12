const path=require('path');const ROOT=process.env.COOKBOOK_ROOT||path.resolve(__dirname,'../../..');
// Adds a 'category' column to ingredients.csv using the app's categories (see code/src/data/ingredientsSeed.ts).
const fs=require('fs');
const rd=f=>fs.readFileSync(f,'utf8').replace(/^﻿/,'').split(/\r?\n/).filter(Boolean).map(l=>{const o=[];let i=0;while(i<l.length){i++;let v='';while(i<l.length){if(l[i]=='"'){if(l[i+1]=='"'){v+='"';i+=2;continue}i++;break}v+=l[i++]}o.push(v);i++}return o});
const csv=rs=>'﻿'+rs.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n')+'\r\n';
const C={
 'Produce':['zemiak','cibuľa','jablko','zeler stopkatý','mrkva','cesnak','paradajka','petržlen','kapusta','uhorka','paprika','paradajka zelená','vňať petržlenová','bazalka','zázvor','cibuľa jarná','perilla','bylinka horká','eryngium foetidum','zeler','paprika červená','paprika žltá','paprika zelená','šampiňón','kaleráb','pór','vňať zelerová','kel','citrónová kôra','lesné ovocie','ovocie','slivka','baklažán','zelenina mrazená','hrozienka'],
 'Dairy':['vajce','smotana','maslo','mlieko','vaječný bielok','vaječný žĺtok','syr','smotana na šľahanie','smotana kyslá','tvaroh','jogurt biely','syr eidam','bryndza','mascarpone','mozzarella'],
 'Meat':['klobása','slanina','mäso mleté','krkovička bravčová','stehno bravčové','mäso údené','pliecko bravčové','mäso kuracie','masť bravčová','mäso hovädzie','kosti hovädzie','koleno bravčové','mäso bravčové','krídielko kuracie','stehno kuracie','rebrá','sliepka'],
 'Fish & Seafood':['mušle'],
 'Other':['víno červené','víno biele','prášok do pečiva','cukor vanilkový','bujón slepačí','bujón zeleninový','vývar','sóda bikarbóna','rum','amaretto','koňak vaječný','droždie','želatína','solamyl','stužovač šľahačky'],
};
const cat={};for(const [c,l] of Object.entries(C))for(const n of l)cat[n]=c;
const ing=rd(path.join(ROOT,'ingredients.csv'));
if(!ing[0].includes('category'))ing[0].push('category');
const unk=[];for(const r of ing.slice(1)){r[4]=cat[r[1]]||'Pantry & Dry Goods'}
fs.writeFileSync(path.join(ROOT,'ingredients.csv'),csv(ing));
const cnt={};ing.slice(1).forEach(r=>cnt[r[4]]=(cnt[r[4]]||0)+1);console.log(cnt);
