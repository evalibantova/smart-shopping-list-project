const path=require('path');const ROOT=process.env.COOKBOOK_ROOT||path.resolve(__dirname,'../../..');
const fs=require('fs');
const xml=fs.readFileSync(path.join(__dirname,'data','mycookbookrecipes.xml'),'utf8');
const dec=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&amp;/g,'&');
const tag=(s,t)=>{const m=s.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`));return m?dec(m[1]).replace(/\s+/g,' ').trim():''};
const lis=(s,t)=>[...(s.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`))?.[1]??'').matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m=>dec(m[1]).replace(/<br\s*\/?>/g,' ').trim());
const csv=rows=>'﻿'+rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n')+'\r\n';
const splitCommas=s=>{const out=[];let d=0,c='';for(const ch of s){if(ch=='(')d++;if(ch==')')d--;if((ch==','||ch=='*')&&d<=0){out.push(c);c=''}else c+=ch}out.push(c);return out.map(x=>x.trim()).filter(Boolean)};
const U='kg|g|dkg|dag|mg|l|dl|cl|ml|litre|litra|litrov|ks|PL|KL|čl|polievkové lyžice|lyžice|lyžica|lyžičky|lyžička|balenia|balenie|balík|hrste|hrsť|štipka|štipky|strúčikov|strúčik|pounds|lbs|lb|kusy|dekagramy|kilogram|gramy|gram';
const numRe='(?:\\d+[\\d.,/⁄\\-–\\s]*\\d|\\d)';
const parse=raw=>{
  if(raw.includes('\t')){const p=raw.split('\t').map(x=>x.trim());return [p[0]||'',p[1]||'',p.slice(2).join(' ').trim()]}
  let m=raw.match(new RegExp(`^(${numRe})\\s*(${U})\\b\\.?\\s*(.*)$`,'i'));
  if(m)return [m[1].trim(),m[2],m[3].trim()];
  m=raw.match(new RegExp(`^(${numRe})\\s+(.*)$`));
  if(m)return [m[1].trim(),'',m[2].trim()];
  m=raw.match(new RegExp(`^(.*?)\\s+(${numRe})\\s*(${U})?$`,'i'));   // "káposzta 2 kg"
  if(m)return [m[2].trim(),m[3]||'',m[1].trim()];
  return ['','',raw];
};
const qtyOnly=new RegExp(`^${numRe}\\s*(${U})?\\.?$`,'i');
const recipes=[...xml.matchAll(/<recipe>([\s\S]*?)<\/recipe>/g)].map(m=>m[1]);
const canon=require('./canon.cjs');const DROPPED=[];const ING=new Map();const key=n=>n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const RI=[['recipe_id','ingredient_id','quantity','unit','raw']];
const R=[['recipe_id','title','category','servings','prep_time','cook_time','total_time','rating','source','url','image_url','ingredient_count','ingredient_ids']];
let rid=0;for(const r of recipes){rid++;const ids=[];
  const title=tag(r,'title').replace(/^\*♥\*|\*♥\*$/g,'');
  let l=lis(r,'ingredient');
  if(l.length==1&&l[0].includes(','))l=splitCommas(l[0]); else if(l.length==1&&l[0].includes(' * '))l=splitCommas(l[0]);
  // merge "300 g" + "múka" pairs
  const merged=[];
  for(let i=0;i<l.length;i++){ if(qtyOnly.test(l[i])&&i+1<l.length&&!qtyOnly.test(l[i+1])){merged.push(l[i]+' '+l[i+1]);i++}else merged.push(l[i])}
  const items=merged.filter(x=>x&&!/:$/.test(x));
  for(const raw of items){const [q,u,n0]=parse(raw);const n1=n0.replace(/^[\s,.\-]+|[\s,]+$/g,'');if(!key(n1))continue;const outs=canon(n1);if(!outs.length)DROPPED.push(n1);for(const n of outs){const k=key(n);if(!ING.has(k))ING.set(k,{id:ING.size+1,name:n,count:0});const g=ING.get(k);g.count++;if(!ids.includes(g.id))ids.push(g.id);RI.push([rid,g.id,q,u,raw.replace(/\t/g,' ').replace(/\s+/g,' ')])}}
  R.push([rid,title,tag(r,'category'),tag(r,'quantity'),tag(r,'preptime'),tag(r,'cooktime'),tag(r,'totaltime'),tag(r,'rating'),lis(r,'source').join('; '),tag(r,'url'),tag(r,'imageurl'),ids.length,ids.join(';')]);
}
fs.writeFileSync(path.join(ROOT,'recipes.csv'),csv(R));fs.writeFileSync(path.join(ROOT,'recipe_ingredients.csv'),csv(RI));
fs.writeFileSync(path.join(ROOT,'ingredients.csv'),csv([['ingredient_id','name','recipe_count'],...[...ING.values()].map(g=>[g.id,g.name,new Set(RI.filter(x=>x[1]==g.id).map(x=>x[0])).size])]));
console.log(R.length-1,'recipes',ING.size,'unique ingredients',RI.length-1,'links');

console.log('DROPPED:',DROPPED.join(' | '));console.log([...ING.values()].map(g=>g.name).sort((a,b)=>a.localeCompare(b,'sk')).join(' | '));