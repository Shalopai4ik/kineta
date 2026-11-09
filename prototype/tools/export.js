const sharp=require('sharp'),fs=require('fs');const cut=require('./cut.js');
const OUT='C:/Users/Антоха/Desktop/morotika/prototype/img/';fs.mkdirSync(OUT,{recursive:true});
const cutList=['o_ball','o_cube','o_ring','o_carrot','o_box','o_bottle','r_novice','r_student','r_master','r_expert','r_crystal','r_star','r_heart','r_cup','r_leaf','s_ok','s_retry','s_err','s_wait','mark'];
const tiles={k_open:2,k_fist:2,k_spread:2,k_point:2,k_pinch:2,k_down:2,k_up:2,p_relax:2,p_open:2,p_fist:2,g_ball:2,g_mug:2,g_ballhold:2,t_ball:2,m_calm:2,m_joy:2,m_wow:2,m_help:2,m_show:2,mascot_big:2.5,o_mug:2.5,o_plate:2,o_phone:2,bg_mount:4,bg_city:4,bg_forest:4,bg_space:4,scene_game:2,logo:2};
(async()=>{
 for(const n of cutList){ await cut('out/'+n+'.png','tmp_'+n+'.png',26,2.5); await sharp('tmp_'+n+'.png').webp({quality:90,alphaQuality:100}).toFile(OUT+n+'.webp'); }
 for(const [n,s] of Object.entries(tiles)){ const m=await sharp('out/'+n+'.png').metadata(); let p=sharp('out/'+n+'.png').resize({width:Math.round(m.width*s),kernel:'lanczos3'}); if(n.startsWith('bg_'))p=p.blur(1.2); await p.webp({quality:88}).toFile(OUT+n+'.webp'); }
 await sharp('tmp_mark.png').resize(64,64,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(OUT+'favicon.png');
 console.log(fs.readdirSync(OUT).length,'files');
})();
