const path=require('path');const ROOT=process.env.COOKBOOK_ROOT||path.resolve(__dirname,'../../..');
// Applies the approved estimates: proposals_missing_quantities.csv (DROP rows are removed)
// and proposals_servings.csv. Estimated values are flagged in the 'estimated' columns.
const fs=require('fs');
const rd=f=>fs.readFileSync(f,'utf8').replace(/^﻿/,'').split(/\r?\n/).filter(Boolean).map(l=>{const o=[];let i=0;while(i<l.length){i++;let v='';while(i<l.length){if(l[i]=='"'){if(l[i+1]=='"'){v+='"';i+=2;continue}i++;break}v+=l[i++]}o.push(v);i++}return o});
const csv=rs=>'﻿'+rs.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n')+'\r\n';
const P=p=>path.join(ROOT,p);const D=p=>path.join(__dirname,'data',p);
let ing=rd(P('ingredients.csv'));const nameOf=Object.fromEntries(ing.slice(1).map(r=>[r[0],r[1]]));
const ri=rd(P('recipe_ingredients.csv'));const props=rd(D('proposals_missing_quantities.csv')).slice(1);
const missing=ri.slice(1).filter(r=>!r[3]);
if(missing.length!==props.length)throw new Error(`proposals (${props.length}) out of sync with rows without quantity (${missing.length}) – regenerate them`);
const drop=new Set();
missing.forEach((r,i)=>{const p=props[i];
  if(p[0]!==r[0]||p[2]!==nameOf[r[1]]||p[4]!==r[6])throw new Error('proposal mismatch at '+i+': '+p.slice(0,5).join('|'));
  if(p[5]==='DROP'){drop.add(r);return}
  r[2]=p[5];r[3]=p[3];r[7]='yes'});
const head=[...ri[0],'estimated'];
const rows=ri.slice(1).filter(r=>!drop.has(r)).map(r=>{r[7]=r[7]||'';return r});
// manual corrections confirmed by the user (recipe text says 2 ČL, ingredient list says 1 KL)
for(const r of rows)if(r[0]=='18'&&r[6]=='1kl červená paprika'){r[2]='2';r[7]='yes'}
// recipes with no ingredients in the XML: estimated ingredient lists (new ingredients get new ids)
const idOf=Object.fromEntries(ing.slice(1).map(r=>[r[1],r[0]]));
for(const p of rd(D('proposals_empty_recipes.csv')).slice(1)){
  if(!idOf[p[2]]){const id=String(ing.length);ing.push([id,p[2],p[3],0]);idOf[p[2]]=id}
  rows.push([p[0],idOf[p[2]],p[4],p[3],'','','','yes']);
}
fs.writeFileSync(P('recipe_ingredients.csv'),csv([head,...rows]));
// drop ingredients no recipe uses and renumber ids so they stay contiguous
const used=new Set(rows.map(r=>r[1]));const newId={};let n=0;
ing=[ing[0],...ing.slice(1).filter(r=>used.has(r[0])).map(r=>{newId[r[0]]=String(++n);return [newId[r[0]],...r.slice(1)]})];
for(const r of rows)r[1]=newId[r[1]];
fs.writeFileSync(P('recipe_ingredients.csv'),csv([head,...rows]));
// recipes.csv: servings + refresh ingredient ids
const rec=rd(P('recipes.csv'));const ci=rec[0].indexOf('ingredient_ids'),cc=rec[0].indexOf('ingredient_count'),cs=rec[0].indexOf('servings');
const sv=Object.fromEntries([...rd(D('proposals_servings.csv')).slice(1).map(r=>[r[0],r[3]]),...rd(D('proposals_empty_recipes_servings.csv')).slice(1).map(r=>[r[0],r[2]])]);
rec[0].push('servings_estimated','servings_text');
const SERV_OVERRIDE={39:[8,'tart looks like ~8 slices'],53:[20,'1 tin 20×26 cm cut into squares']};
const toNum=t=>{const m=t.match(/\((\d+)\s*servings\)/i)||t.match(/\d+/);return m?+(m[1]||m[0]):''};
for(const r of rec.slice(1)){
  const ids=[...new Set(rows.filter(x=>x[0]==r[0]).map(x=>+x[1]))].sort((a,b)=>a-b);r[ci]=ids.join(';');r[cc]=ids.length;
  const txt=r[cs].replace(/\s+/g,' ').trim();
  if(SERV_OVERRIDE[r[0]]){r[cs]=SERV_OVERRIDE[r[0]][0];r.push('yes',txt)}
  else if(!txt&&sv[r[0]]){r[cs]=sv[r[0]];r.push('yes','')}
  else{r[cs]=toNum(txt);r.push('',txt)}
}
fs.writeFileSync(P('recipes.csv'),csv(rec));
const hd=ing[0];const rcI=hd.indexOf('recipe_count');
for(const r of ing.slice(1))r[rcI]=new Set(rows.filter(x=>x[1]==r[0]).map(x=>x[0])).size;
fs.writeFileSync(P('ingredients.csv'),csv(ing));
console.log(`applied ${props.length-drop.size} estimated quantities, dropped ${drop.size}, servings added for ${Object.keys(sv).length} recipes`);
