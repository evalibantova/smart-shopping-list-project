// Main-ingredient tag per recipe (by cleaned title). Desserts and recipes without a clear main ingredient have none.
const G={
 'bravčové':['Bravčová krkovička na horčici','Bravčové na rasci','Guláš','Maďarský guláš','Rebierka'],
 'kuracie':['Kuracia živánska','Kuracie krídelká ako z KFC','Medové kurča','Kurací perkelt s haluškami','Slepačia polievka so strúhaním','Sweet and Spicy Baked Chicken Wings'],
 'hovädzie':['Boloňská omáčka k cestovinám','Čarovné lasagne','Fašírky','Vietnamská polievka pho'],
 'zemiaky':['Kyslá zemiaková polievka s klobásou','Zemiaková štipľavá polievka','Granatiersky pochod','Hranolky'],
 'kapusta':['Kapustnica s klobásou a hubami','Rýchla kapustnica','Kapustový šalát podľa maminy','Koložvárska kapusta','Segedínský guláš po maďarsku','Taštičky z lístkového cesta s kapustou','Csalamádé na zimu'],
 'fazuľa':['Fazuľová polievka na kyslo','Jókaiho fazuľová polievka'],
 'šošovica':['Šošovicová polievka'],
 'huby':['Kyslá hubová polievka','Kyslá šampiňónová polievka'],
 'ryža':['Klasický ryžový nákyp','Kuracie rizoto po slovensky'],
 'paradajky':['Paradajková polievka'],
 'baklažán':['Grilovaný baklažán s mozzarelou a rajčinami'],
 'mušle':['Dagnje na buzaru'],
};
const BY_TITLE={};for(const [tag,titles] of Object.entries(G))for(const t of titles)BY_TITLE[t]=tag;
module.exports=title=>BY_TITLE[title]||null;
