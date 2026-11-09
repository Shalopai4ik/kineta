const sharp=require('sharp'),fs=require('fs');
const C=JSON.parse(fs.readFileSync('crops.json','utf8'));
fs.mkdirSync('out',{recursive:true});
(async()=>{
 const tiles=[];
 for(const [name,[src,x,y,w,h]] of Object.entries(C)){
   await sharp(src).extract({left:x,top:y,width:w,height:h}).png().toFile('out/'+name+'.png');
   tiles.push(name);
 }
 // contact sheet
 const cell=170, cols=8, rows=Math.ceil(tiles.length/cols);
 const comps=[]; 
 for(let i=0;i<tiles.length;i++){ const buf=await sharp('out/'+tiles[i]+'.png').resize(cell-10,cell-30,{fit:'contain',background:'#ff00ff'}).toBuffer();
   comps.push({input:buf,left:(i%cols)*cell+5,top:Math.floor(i/cols)*cell+5});
   comps.push({input:Buffer.from(`<svg width="${cell}" height="20"><text x="5" y="15" font-size="13" font-family="Arial">${tiles[i]}</text></svg>`),left:(i%cols)*cell,top:Math.floor(i/cols)*cell+cell-22});}
 await sharp({create:{width:cols*cell,height:rows*cell,channels:3,background:'#888'}}).composite(comps).png().toFile('sheet.png');
 console.log(tiles.length,'crops');
})();
