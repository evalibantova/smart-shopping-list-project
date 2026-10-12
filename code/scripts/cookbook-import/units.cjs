const path=require('path');const ROOT=process.env.COOKBOOK_ROOT||path.resolve(__dirname,'../../..');
const fs=require('fs');
const lines=fs.readFileSync(path.join(ROOT,'recipe_ingredients.csv'),'utf8').replace(/^﻿/,'').split(/\r?\n/).filter(Boolean);
const parseRow=l=>{const out=[];let i=0;while(i<l.length){i++;let v='';while(i<l.length){if(l[i]=='"'){if(l[i+1]=='"'){v+='"';i+=2;continue}i++;break}v+=l[i++]}out.push(v);i++}return out};
const rows=lines.slice(1).map(parseRow);
const num=s=>{s=s.trim().replace(',','.').replace('⁄','/');let t=0;for(const p of s.split(/\s+/)){if(p.includes('/')){const [a,b]=p.split('/');t+=a/b}else t+=parseFloat(p)}return t};
const parseQty=q=>{q=q.replace(/[–—]/g,'-').replace(/\s*cm$/,'');const parts=q.split(/\s*-\s*|\s+to\s+/).filter(Boolean).map(num);return parts.some(isNaN)?null:Math.max(...parts)}; // ranges -> upper bound
const detect=(u,raw)=>{
  const t=(u+' '+raw).toLowerCase();
  if(/^(g|gram|gramy)$/i.test(u))return['g',1];
  if(/^(kg|kilogram)$/i.test(u))return['g',1000];
  if(/^(dkg|dag|dekagramy)$/i.test(u))return['g',10];
  if(/^(lbs?|pounds)$/i.test(u))return['g',453.6];
  if(/^ml$/.test(u))return['ml',1];
  if(/^(l|litre)$/i.test(u)&&!/lístk/i.test(raw))return['ml',1000];
  if(/^dl$/i.test(u))return['ml',100];
  if(/^(pl|polievkové lyžice|lyžice)$/i.test(u)&&!/plátk/i.test(raw))return['tbsp',1];
  if(/^(kl|čl|čajová lyžička|ml)$/i.test(u)&&!/plátk/i.test(raw))return['tsp',1];
  if(/^pl$/i.test(u)&&/plátk/i.test(raw))return['pcs',1];
  if(/^(ks|kusy|balík|balenie|balenia|hrste|strúčikov|strúčiky)$/i.test(u))return[/strúči/i.test(u)?'cloves':'pcs',1];
  // no unit: look in raw
  const r=raw.toLowerCase();
  if(/^[\d\s\-–.,/⁄to]+dcl\b/.test(r))return['ml',100];
  if(/\bcups?\b|šálk|hrnček/.test(r))return['ml',250];
  if(/\btsp\b/.test(r))return['tsp',1];
  if(/\btbsp\b/.test(r))return['tbsp',1];
  if(/lyžic/.test(r))return['tbsp',1];
  if(/strúčik|cloves/.test(r))return['cloves',1];
  return['pcs',1];
};
const out=[['recipe_id','ingredient_id','quantity','unit','original_quantity','original_unit','raw']];
const issues=[];
for(const [rid,iid,q,u,raw] of rows){
  if(!q){out.push([rid,iid,'','',q,u,raw]);continue}
  const val=parseQty(q);if(val==null){issues.push(raw);out.push([rid,iid,'','',q,u,raw]);continue}
  const [nu,f]=detect(u,raw);
  out.push([rid,iid,+(val*f).toFixed(2),nu,q,u,raw]);
}
const csv=rs=>'﻿'+rs.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n')+'\r\n';
fs.writeFileSync(path.join(ROOT,'recipe_ingredients.csv'),csv(out));
const c={};out.slice(1).forEach(r=>c[r[3]]=(c[r[3]]||0)+1);console.log(c,'unparsed:',issues);
