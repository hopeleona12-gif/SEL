import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const rows=[];
const csv=x=>'"'+String(x??'').replaceAll('"','""')+'"';
const parseLine=line=>line.match(/"(?:[^"]|"")*"|[^,]*/g).filter(x=>x!==undefined&&x!=='').map(x=>x.startsWith('"')?x.slice(1,-1).replaceAll('""','"'):x);
for(const line of fs.readFileSync('media_inventory.csv','utf8').trim().split(/\r?\n/).slice(1)){
  const c=parseLine(line); if(!/^(png|jpe?g|webp)$/.test(c[4])) continue;
  const p=path.join(root,'oss_upload_images',c[3]); const optimized=fs.statSync(p).size;
  rows.push([c[3],'/'+c[3],c[4]==='png'?'image/png':c[4]==='webp'?'image/webp':'image/jpeg',c[5],optimized,Number(c[5])-optimized,((Number(c[5])-optimized)/Number(c[5])*100).toFixed(2)+'%','public, max-age=604800']);
}
const h=['local_path','oss_object_key','content_type','original_size','optimized_size','saved_bytes','saved_percent','cache_control'];
fs.writeFileSync('OSS_IMAGE_UPLOAD_MANIFEST.csv',[h,...rows].map(r=>r.map(csv).join(',')).join('\n'));
const original=rows.reduce((n,r)=>n+Number(r[3]),0), optimized=rows.reduce((n,r)=>n+Number(r[4]),0);
console.log(JSON.stringify({files:rows.length,original,optimized,saved:original-optimized,savedPercent:((original-optimized)/original*100).toFixed(2)+'%'},null,2));
