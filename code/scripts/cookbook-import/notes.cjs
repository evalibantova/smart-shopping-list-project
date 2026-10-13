// Builds the Markdown `notes` text per recipe (method steps + source link) straight from the XML,
// in the same order as export.cjs numbers recipes (recipe id = index + 1).
const fs=require('fs'),path=require('path');
const dec=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&amp;/g,'&');
const URL_RE=/(https?:\/\/[^\s<>)]+)/g;
// escape Markdown punctuation in plain text, but leave URLs intact so they autolink
const esc=t=>t.split(URL_RE).map((p,i)=>i%2?p:p.replace(/([\\`*_\[\]<>~#])/g,'\\$1')).join('');
const clean=h=>dec(h).replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').split('\n').map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean).map(esc).join('  \n   ');
const items=(r,t)=>[...(r.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`))?.[1]??'').matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m=>clean(m[1])).filter(Boolean);
module.exports=function(){
  const xml=fs.readFileSync(path.join(__dirname,'data','mycookbookrecipes.xml'),'utf8');
  return [...xml.matchAll(/<recipe>([\s\S]*?)<\/recipe>/g)].map(m=>{
    const r=m[1],steps=items(r,'recipetext'),parts=[];
    if(steps.length)parts.push(steps.map((s,i)=>`${i+1}. ${s}`).join('\n'));
    else{const d=items(r,'description');if(d.length)parts.push(d.join('\n\n'))}
    const url=(r.match(/<url>([\s\S]*?)<\/url>/)?.[1]||'').trim();
    if(url){const u=dec(url);let host=u;try{host=new URL(u).hostname.replace(/^www\./,'')}catch{}parts.push(`Zdroj: [${host}](${u})`)}
    return parts.join('\n\n');
  });
};
