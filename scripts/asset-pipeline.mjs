import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'oss_upload');
const mediaRe = /\.(png|jpe?g|webp|mp4|mp3|wav|m4a|webm)(?:[?#'"`\s)]|$)/i;
const extRe = /\.(png|jpe?g|webp|mp4|mp3|wav|m4a|webm)$/i;
const skipParts = new Set(['node_modules', '.git', 'output', 'tmp', 'dist.backup-20260814-001306']);
const taskDirs = new Map([
  ['MASTER', ['index.html', 'app.js', 'introAndReport.js', 'taskManager.js', 'taskAdapters.js', 'mediaResolver.js', 'styles.css', 'fullscreen.js']],
  ['T01', ['tasks/T01']], ['T02', ['tasks/T02']], ['T03', ['tasks/T03/frontend/dist', 'tasks/T03/tasks', 'tasks/T03/frontend/src']],
  ['T04', ['tasks/T04']], ['T05', ['tasks/T05']], ['T06', ['tasks/T06']], ['T07', ['tasks/T07/dist']],
  ['T08', ['tasks/T08']], ['T09', ['tasks/T09']], ['T10', ['tasks/T10']], ['INTRO', ['tasks/intro']]
]);
const exists = p => fs.existsSync(p) && fs.statSync(p).isFile();
function walk(p) {
  if (!fs.existsSync(p)) return [];
  const st = fs.statSync(p); if (st.isFile()) return [p];
  const result = [];
  for (const e of fs.readdirSync(p, {withFileTypes:true})) {
    if (skipParts.has(e.name)) continue;
    const q = path.join(p, e.name);
    if (e.isDirectory()) result.push(...walk(q)); else result.push(q);
  }
  return result;
}
function filesFor(paths) { return paths.flatMap(x => walk(path.join(root, x))); }
function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function imageInfo(p) {
  const b = fs.readFileSync(p); const ext = path.extname(p).toLowerCase();
  if (ext === '.png' && b.length >= 24) return {w:b.readUInt32BE(16), h:b.readUInt32BE(20)};
  if ((ext === '.jpg' || ext === '.jpeg') && b.length > 4) {
    let i=2; while (i+9 < b.length) { if (b[i] !== 0xff) { i++; continue; } const marker=b[i+1]; const len=b.readUInt16BE(i+2); if (marker>=0xc0&&marker<=0xc3) return {w:b.readUInt16BE(i+7),h:b.readUInt16BE(i+5)}; i += 2 + len; }
  }
  return {};
}
function csvCell(x) { return '"' + String(x ?? '').replaceAll('"','""') + '"'; }
function taskForFile(p) { const m=p.match(/(?:^|[\\/])tasks[\\/](T0[1-9]|T10)(?:[\\/]|$)/i); return m?.[1]?.toUpperCase() || (p.includes('tasks\\intro') ? 'INTRO' : 'MASTER'); }
const activeRoots = [...taskDirs.values()].flat();
const allFiles = filesFor(activeRoots).filter(p => !/\.(phase5-backup|backup|log)$/i.test(p) && !p.replaceAll('\\','/').includes('/prototype-t03/'));
const byBase = new Map();
for (const p of allFiles) { const b=path.basename(p).toLowerCase(); if (!byBase.has(b)) byBase.set(b,[]); byBase.get(b).push(p); }
const refs = new Map();
const sourceFiles = filesFor(activeRoots).filter(p => /\.(html?|css|jsx?|tsx?|json|md)$/i.test(p) && !/README|SOURCE_INVENTORY/i.test(p));
for (const src of sourceFiles) {
  const text=readText(src);
  const re = /(?:[A-Za-z0-9_./\\%?=&:-]+[\\/])?[^\s'"`<>(),;{}]+\.(?:png|jpe?g|webp|mp4|mp3|wav|m4a|webm)(?:\?[^\s'"`<>(),;{}]*)?/gi;
  for (const raw of text.matchAll(re)) {
    let token=raw[0].replaceAll('\\','/').replace(/^\.?\//,'').replace(/^\//,'').split(/[?#]/)[0];
    const base=path.basename(token).toLowerCase();
    if (!extRe.test(token) || !byBase.has(base)) continue;
    const candidates=byBase.get(base);
    const sourceTask=taskForFile(src);
    const preferred=candidates.find(p=>taskForFile(p)===sourceTask) || candidates[0];
    const rel=path.relative(root,preferred).replaceAll('\\','/');
    if (!refs.has(rel)) refs.set(rel,[]);
    refs.get(rel).push(`${path.relative(root,src).replaceAll('\\','/')}:${token}`);
  }
}
// Explicit production entry points that use runtime-computed intro/T03 URLs.
for (const [rel, task] of [['tasks/intro/进入游戏.mp4','INTRO'], ['tasks/T03/frontend/dist/assets/tasks/T03/T03_00_rule_final.mp4','T03']]) {
  if (exists(path.join(root,rel)) && !refs.has(rel)) refs.set(rel,[`runtime:${task}`]);
}
// These production pages build filenames from the current item id at runtime.
for (const [dir, task] of [['tasks/T10/assets','T10'], ['tasks/T07/dist/assets/T07','T07']]) {
  for (const p of walk(path.join(root, dir))) {
    if (!mediaRe.test(p)) continue;
    const rel=path.relative(root,p).replaceAll('\\','/');
    if (!refs.has(rel)) refs.set(rel,[`runtime:${task}:asset-id`]);
  }
}
const rows=[]; const upload=[]; const missing=[];
for (const [rel, locations] of refs) {
  const p=path.join(root,rel); if (!exists(p)) { missing.push(rel); continue; }
  const st=fs.statSync(p); const ext=path.extname(p).toLowerCase(); const info=imageInfo(p);
  const row={task_id:taskForFile(p), code_reference_location:locations.join(' | '), url_or_relative_path:'/'+rel, actual_local_path:rel, file_type:ext.slice(1), file_size:st.size, image_dimensions:info.w?`${info.w}x${info.h}`:'', video_resolution:'', video_duration:'', chinese_filename:/[^\x00-\x7F]/.test(path.basename(p)), first_screen_or_current_scene:/intro|rule|00|A01|B01/i.test(path.basename(p)), classification:locations.some(x=>x.startsWith('runtime:'))?'DYNAMIC':'ACTIVE', needs_optimization:((/^\.(png|jpe?g)$/i.test(ext)&&st.size>1024*1024)||(ext==='.mp4'&&st.size>8*1024*1024)||(ext==='.mp3'&&st.size>1024*1024))?'review':'no', pre_size:st.size, post_size:st.size};
  rows.push(row); upload.push({rel,p,st,ext});
}
const allRows=rows.sort((a,b)=>a.actual_local_path.localeCompare(b.actual_local_path));
fs.rmSync(outDir,{recursive:true,force:true});
for (const x of upload) { const dest=path.join(outDir,x.rel); fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.copyFileSync(x.p,dest); }
const invHeader=['task_id','code_reference_location','url_or_relative_path','actual_local_path','file_type','file_size','image_dimensions','video_resolution','video_duration','chinese_filename','first_screen_or_current_scene','classification','needs_optimization','pre_size','post_size'];
fs.writeFileSync(path.join(root,'media_inventory.csv'),[invHeader,...allRows.map(r=>invHeader.map(k=>csvCell(r[k])))].map(r=>r.join(',')).join('\n'),'utf8');
const manHeader=['local_path','oss_object_key','content_type','original_size','optimized_size','saved_bytes','saved_percent','cache_control'];
const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4','.webm':'video/webm'};
const man=upload.map(x=>[x.rel,'/'+x.rel,mime[x.ext]||'application/octet-stream',x.st.size,x.st.size,0,'0.00%','public, max-age=604800']);
fs.writeFileSync(path.join(root,'OSS_UPLOAD_MANIFEST.csv'),[manHeader,...man].map(r=>r.map(csvCell).join(',')).join('\n'),'utf8');
const summary={active:allRows.filter(r=>r.classification==='ACTIVE').length, dynamic:allRows.filter(r=>r.classification==='DYNAMIC').length, missing, bytes:upload.reduce((n,x)=>n+x.st.size,0), imagesOver1MB:allRows.filter(r=>/^(png|jpe?g|webp)$/.test(r.file_type)&&r.file_size>1048576).length, videosOver8MB:allRows.filter(r=>r.file_type==='mp4'&&r.file_size>8*1048576).length, audioOver1MB:allRows.filter(r=>/^(mp3|wav|m4a)$/.test(r.file_type)&&r.file_size>1048576).length, uploadFiles:upload.length, uploadBytes:man.reduce((n,r)=>n+r[4],0)};
fs.writeFileSync(path.join(root,'media_inventory_summary.json'),JSON.stringify(summary,null,2),'utf8');
console.log(JSON.stringify(summary,null,2));
