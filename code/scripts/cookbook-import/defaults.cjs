const path=require('path');const ROOT=process.env.COOKBOOK_ROOT||path.resolve(__dirname,'../../..');
const fs=require('fs');
const rd=f=>fs.readFileSync(f,'utf8').replace(/^﻿/,'').split(/\r?\n/).filter(Boolean).map(l=>{const o=[];let i=0;while(i<l.length){i++;let v='';while(i<l.length){if(l[i]=='"'){if(l[i+1]=='"'){v+='"';i+=2;continue}i++;break}v+=l[i++]}o.push(v);i++}return o});
const csv=rs=>'﻿'+rs.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n')+'\r\n';
const D={'strúhanka':['g',{ml:0.46}],'ryža dlhozrná':['g',{ml:0.8}],'mascarpone':['g',{pcs:250}],'majorán':['tsp',{}],'kmín':['tsp',{}],'kôpor sušený':['tsp',{}],'bylinky provensálske':['tsp',{}],'paprika mletá pálivá':['tsp',{}],'solamyl':['tsp',{}],'kakao':['tsp',{}],'chilli':['tsp',{}],'cestovina':['g',{}],'nudle ryžové':['g',{}],'hrozienka':['g',{}],'krupica detská':['g',{}],'sušienky':['g',{}],'ovocie':['g',{}],'mak':['g',{}],'cibuľa jarná':['pcs',{}],'slivka':['pcs',{}],'perilla':['pcs',{}],'bylinka horká':['pcs',{}],'eryngium foetidum':['pcs',{}], // name: [default_unit, {unit: factor to default}]
 'zemiak':['g',{pcs:150}],'cibuľa':['pcs',{g:1/120}],'klobása':['g',{pcs:200}],'smotana':['ml',{pcs:200}],
 'korenie čierne celé':['tsp',{pcs:1/70}],'ocot':['ml',{tbsp:15}],'múka hladká':['g',{tbsp:10}],'cukor':['g',{tbsp:12}],
 'cukor práškový':['g',{tbsp:8}],'soľ':['tsp',{tbsp:3}],'olej':['ml',{tbsp:15,tsp:5,g:1/0.92}],'maslo':['g',{tbsp:14,pcs:25}],
 'prášok do pečiva':['g',{pcs:12,tsp:4}],'mlieko':['ml',{tbsp:15,g:1}],'cukor vanilkový':['g',{pcs:8,tsp:4}],'zelenina mrazená':['g',{pcs:350}],'mrkva':['pcs',{g:0.01}],
 'cesnak':['cloves',{pcs:1}],'pretlak paradajkový':['ml',{pcs:500}],'paradajkové pyré koncentrované':['g',{pcs:70}],'slanina':['g',{pcs:20}],'korenie čierne mleté':['tsp',{tbsp:3}],
 'olej olivový':['ml',{tbsp:15}],'paprika mletá':['tsp',{tbsp:3}],'múka polohrubá':['g',{tbsp:10,ml:0.5}],'petržlen':['g',{pcs:80}],
 'voda':['ml',{tbsp:15}],'múka':['g',{tbsp:10}],'kapusta':['g',{pcs:1000}],'paprika':['pcs',{}],'vňať petržlenová':['pcs',{ml:1/60,g:1/50}],
 'masť bravčová':['g',{ml:0.92,tbsp:14}],'korenie na perník':['g',{pcs:20,tsp:2.5}],'lasagne':['g',{pcs:500}],'piškóty':['g',{pcs:220}],'paprika červená':['pcs',{}],'citrónová kôra':['pcs',{tbsp:1}],
 'zázvor':['g',{}],'zeler':['g',{}],'huby sušené':['g',{pcs:15}],'paprika zelená':['pcs',{g:1/150}],'čokoláda':['g',{pcs:100}],
 'stehno kuracie':['g',{pcs:180}],'omáčka sójová':['ml',{tbsp:15,tsp:5}],'droždie':['g',{pcs:7}],
};
const ing=rd(path.join(ROOT,'ingredients.csv'));const ri=rd(path.join(ROOT,'recipe_ingredients.csv'));const rec=rd(path.join(ROOT,'recipes.csv'));
const byName=Object.fromEntries(ing.slice(1).map(r=>[r[1],r[0]]));const nameOf=Object.fromEntries(ing.slice(1).map(r=>[r[0],r[1]]));
const P={'trocha oleja (3 PL)':[3,'tbsp'],'cca 3 dcl podľa potreby voda':[300,'ml'],'cca 1 l mlieko':[1000,'ml'],'tv paprika 6 db':[6,'pcs'],'sárgarépa 4 db':[4,'pcs'],'vöröshagyma 2 közepes fej':[2,'pcs'],'köménymag 1 teáskanál':[1,'tsp'],'négyszínű bors 1 teáskanál':[1,'tsp'],'mustármag 1 tk':[1,'tsp'],'koriander 1 teáskanál':[1,'tsp'],'cukor 4 ek':[4,'tbsp'],'só 4 ek':[4,'tbsp'],'Zálievka: 1 l vody':[1000,'ml'],'... okrem toho 3 ML soľ':[3,'tsp'],'½ ČL mletej červenej papriky':[0.5,'tsp'],'½ ČL soli':[0.5,'tsp'],'¼ ČL - čierneho mletého korenia aj saturejky':[0.25,'tsp'],'1dcl kečup':[100,'ml']};
let patched=0;for(const r of ri.slice(1)){if(!r[3]&&P[r[6]]){[r[2],r[3]]=P[r[6]];patched++}}console.log('patched',patched);
// reassign ground paprika rows entered as 'paprika'/'paprika červená' in tsp
for(const r of ri.slice(1)){if(r[3]=='tsp'&&['paprika','paprika červená'].includes(nameOf[r[1]]))r[1]=byName['paprika mletá']}
// dominant unit per ingredient
const cnt={};for(const r of ri.slice(1))if(r[3])((cnt[r[1]]??={})[r[3]]=(cnt[r[1]][r[3]]||0)+1);
const def={};
for(const [id,n] of Object.entries(nameOf)){
  if(D[n])def[id]=D[n];
  else{const u=cnt[id];def[id]=[u?Object.entries(u).sort((a,b)=>b[1]-a[1])[0][0]:(/víno|vývar|rum|omáčka|ocot|koňak|káva/.test(n)?'ml':'g'),{}]}
}
const bad=[];const PRET=byName['pretlak paradajkový'];

for(const r of ri.slice(1)){if(!r[3])continue;const [d,f]=def[r[1]];if(r[3]==d)continue;const k=f[r[3]];if(!k){bad.push(nameOf[r[1]]+' '+r[2]+r[3]+' '+r[6]);continue}r[2]=+(r[2]*k).toFixed(2);r[3]=d}
// ingredients.csv
const nd=[['ingredient_id','name','default_unit','recipe_count'],...ing.slice(1).map(r=>[r[0],r[1],def[r[0]][0],new Set(ri.slice(1).filter(x=>x[1]==r[0]).map(x=>x[0])).size])];
fs.writeFileSync(path.join(ROOT,'ingredients.csv'),csv(nd));fs.writeFileSync(path.join(ROOT,'recipe_ingredients.csv'),csv(ri));
// recipes.csv: refresh ids
const ci=rec[0].indexOf('ingredient_ids'),cc=rec[0].indexOf('ingredient_count');
for(const r of rec.slice(1)){const ids=[...new Set(ri.slice(1).filter(x=>x[0]==r[0]).map(x=>+x[1]))].sort((a,b)=>a-b);r[ci]=ids.join(';');r[cc]=ids.length}
fs.writeFileSync(path.join(ROOT,'recipes.csv'),csv(rec));
console.log('unconvertible:',bad);
const u={};ri.slice(1).forEach(r=>u[r[3]]=(u[r[3]]||0)+1);console.log(u);
const mixed=Object.keys(cnt).filter(id=>new Set(ri.slice(1).filter(x=>x[1]==id&&x[3]).map(x=>x[3])).size>1);console.log('mixed after:',mixed.length);
