// удаление фона: заливка от краёв по близости к цвету фона + мягкий край
const sharp=require('sharp'),fs=require('fs');
async function cut(inp,out,tol=26,scale=2){
  const img=sharp(inp).ensureAlpha(); const {data,info}=await img.raw().toBuffer({resolveWithObject:true});
  const W=info.width,H=info.height,px=(x,y)=>(y*W+x)*4;
  const seen=new Uint8Array(W*H), q=[];
  for(let x=0;x<W;x++){q.push([x,0],[x,H-1]);} for(let y=0;y<H;y++){q.push([0,y],[W-1,y]);}
  const dist=new Float32Array(W*H).fill(999);
  while(q.length){ const [x,y]=q.pop(); const i=y*W+x; if(seen[i])continue; seen[i]=1;
    const p=i*4, r=data[p],g=data[p+1],b=data[p+2];
    // фон: светлый, малонасыщенный (лавандовый/белый)
    const mx=Math.max(r,g,b), mn=Math.min(r,g,b), light=(r+g+b)/3;
    const d = Math.max(0, 235-light) + Math.max(0,(mx-mn)-22)*1.5;
    if(d>tol) continue;
    dist[i]=d; data[p+3]=0;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy; if(nx>=0&&ny>=0&&nx<W&&ny<H&&!seen[ny*W+nx]) q.push([nx,ny]);}
  }
  // антиалиас: пиксели объекта рядом с фоном — полупрозрачные
  const a2=Buffer.from(data);
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const p=px(x,y); if(data[p+3]===0)continue; let n=0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if(data[px(x+dx,y+dy)+3]===0)n++; if(n) a2[p+3]=Math.round(255*(1-n*.18));}
  let s=sharp(a2,{raw:{width:W,height:H,channels:4}}).trim({threshold:1});
  await s.resize({width:Math.round(W*scale),kernel:'lanczos3'}).png({compressionLevel:9}).toFile(out);
}
module.exports=cut;
if(require.main===module) cut(process.argv[2],process.argv[3]);
