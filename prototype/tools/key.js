// цветовой ключ «от фона»: альфа = насколько пиксель темнее фона, цвет — un-premultiply
const sharp=require('sharp');
(async()=>{
 const {data,info}=await sharp('out/logo.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const W=info.width,H=info.height; const bg=[0,1,2].map(c=>{let s=0,n=0;for(const [x,y] of [[1,1],[W-2,1],[1,H-2],[W-2,H-2]]){s+=data[(y*W+x)*4+c];n++}return s/n});
 for(let i=0;i<W*H;i++){const p=i*4;let a=0;for(let c=0;c<3;c++)a=Math.max(a,(bg[c]-data[p+c])/bg[c]);a=Math.min(1,Math.max(0,(a-.03)*1.15));
   for(let c=0;c<3;c++)data[p+c]=a>0?Math.max(0,Math.min(255,Math.round((data[p+c]-bg[c]*(1-a))/a))):0; data[p+3]=Math.round(a*255);}
 await sharp(data,{raw:{width:W,height:H,channels:4}}).trim({threshold:1}).resize({width:W*3,kernel:'lanczos3'}).webp({quality:92,alphaQuality:100}).toFile('C:/Users/Антоха/Desktop/morotika/prototype/img/logo.webp');
 console.log('bg',bg);
})();
