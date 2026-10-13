const path=require('path');const ROOT=process.env.COOKBOOK_ROOT||path.resolve(__dirname,'../../..');
// Writes code/src/data/cookbookSeed.json (ingredients in the app's IngredientDbEntry shape + recipes referencing them by name).
const fs=require('fs');
const rd=f=>fs.readFileSync(f,'utf8').replace(/^﻿/,'').split(/\r?\n(?="|$)/).filter(Boolean).map(l=>{const o=[];let i=0;while(i<l.length){i++;let v='';while(i<l.length){if(l[i]=='"'){if(l[i+1]=='"'){v+='"';i+=2;continue}i++;break}v+=l[i++]}o.push(v);i++}return o});
const ing=rd(path.join(ROOT,'ingredients.csv')),ri=rd(path.join(ROOT,'recipe_ingredients.csv')),rec=rd(path.join(ROOT,'recipes.csv'));
// Strip site names / "recept" / "fotorecept" noise from titles, then apply hand-shortened overrides.
const SHORT={
 'Čokoládové brownies, které zvládne úplně každý':'Čokoládové brownies',
 'Easy Croatian Mussels (Dagnje na Buzaru)':'Dagnje na buzaru',
 'Csalamádé tartósító nélkül télire':'Csalamádé na zimu',
 'Bravčové na rasci-stará výborná klasika':'Bravčové na rasci',
 'Grilovaný baklažán - recept na grilovaný baklažán s mozzarelou a rajčinami':'Grilovaný baklažán s mozzarelou a rajčinami',
 'Jak uvařit vietnamskou hovězí polévku pho?':'Vietnamská polievka pho',
 'Kapustový šalát podľa mojej maminy - u nás najobľúbenejší':'Kapustový šalát podľa maminy',
 'Môj kurací perkelt s haluškami':'Kurací perkelt s haluškami',
 'Krupicové halušky do polievky':'Krupicové halušky',
 'Pravé slivkové gule zo zemiakového cesta':'Slivkové gule zo zemiakového cesta',
 'Slepačia polievka z domácej sliepky s domácim strúhaním zo semoliny':'Slepačia polievka so strúhaním',
 'SUPER BRYNDZOVE PIROHY OD MOJEJ MAMICKY':'Bryndzové pirohy',
 'Taštičky z lístkového cesta plnené kyslou kapustou+salámovo-syrové+ovocné taštičky':'Taštičky z lístkového cesta s kapustou',
 'TIRAMISU z Italie (bez vajec)':'Tiramisu bez vajec',
 'Kyslá zemiaková polievka s klobásou a vajcom':'Kyslá zemiaková polievka s klobásou',
};
const cleanTitle=t=>{
 t=t.replace(/\s*[-|]\s*(iDNES\.cz|Receptár.*|Žena\.sk)\s*$/i,'').replace(/^\s*fotorecept\s*:\s*/i,'').replace(/\s+fotorecept\s*$/i,'')
  .replace(/\s*-\s*recept\s*$/i,'').replace(/\s*\*+\s*$/,'').trim();
 return SHORT[t]||t;
};
const NOTES=require('./notes.cjs')();
const h=rec[0],ix=n=>h.indexOf(n);
const name=Object.fromEntries(ing.slice(1).map(r=>[r[0],r[1]]));
const out={ingredients:ing.slice(1).map(r=>({name:r[1],default_unit:r[2],category:r[4]})),
 recipes:rec.slice(1).map((r,n)=>({name:cleanTitle(r[ix('title')]),category:r[ix('category')],servings:+r[ix('servings')],servingsEstimated:r[ix('servings_estimated')]=='yes',url:r[ix('url')],notes:NOTES[+r[0]-1],
  ingredients:ri.slice(1).filter(x=>x[0]==r[0]).map(x=>({ingredient:name[x[1]],quantity:x[2]===''?null:+x[2],unit:x[3]||null,estimated:x[7]=='yes'}))}))};
const dir=path.join(ROOT,'code/src/data');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'cookbookSeed.json'),JSON.stringify(out,null,2)+'\n');
console.log(out.ingredients.length,'ingredients,',out.recipes.length,'recipes ->',path.join(dir,'cookbookSeed.json'));
