(async()=>{const BASE=(process.env.SMOKE_BASE_URL||'http://127.0.0.1:4170').replace(/\/$/,'');
const checks=[
  ['MASTER','/health'],['T02','/task/T02/'],['T03 UI','/tasks/T03/frontend/dist/index.html?v=def328e'],['T03 API','/api/v1/health'],
  ['T04','/tasks/T04/index.html'],['T01-A','/tasks/T01/index.html?part=A'],['T06','/tasks/T06/index.html'],['T05','/tasks/T05/index.html'],
  ['T07','/tasks/T07/dist/index.html'],['T08','/task/T08/'],['T01-B','/tasks/T01/index.html?part=B'],['T09','/tasks/T09/index.html'],['T10','/tasks/T10/index.html']
];
let failed=0;
for(const [name,path] of checks){const started=Date.now();try{const response=await fetch(BASE+path,{redirect:'manual',signal:AbortSignal.timeout(15000)});const type=response.headers.get('content-type')||'';const body=await response.text();const ok=response.status>=200&&response.status<400&&!/not found|subservice unavailable/i.test(body.slice(0,300));console.log(`${ok?'PASS':'FAIL'}\t${name}\t${response.status}\t${Date.now()-started}ms\t${path}\t${type}`);if(!ok)failed++}catch(error){failed++;console.log(`FAIL\t${name}\tNETWORK\t${Date.now()-started}ms\t${path}\t${error.message}`)}}
if(failed){console.error(`SMOKE_FAILED=${failed}`);process.exit(1)}console.log('SMOKE_PASS=13/13')})().catch(error=>{console.error(error);process.exit(1)});
