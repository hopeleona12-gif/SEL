const API = '/api/v1'
async function request<T>(path:string, init?:RequestInit):Promise<T>{
  const started=performance.now();const response=await fetch(`${API}${path}`,{headers:{'Content-Type':'application/json'},...init});console.info('[T03 API]',path,response.status,`${Math.round(performance.now()-started)}ms`)
  if(!response.ok) throw new Error((await response.json()).detail ?? `请求失败（${response.status}）`)
  return response.json()
}
export const api={
  health:()=>request<{status:string}>('/health'),
  task:(id:string)=>request<import('./types').TaskConfig>(`/tasks/${id}`),
  child:(child_id:string,age:number,participant_group?:string)=>request('/children',{method:'POST',body:JSON.stringify({child_id,age,participant_group})}),
  createSession:(child_id:string)=>request<{session_id:string}>('/assessments',{method:'POST',body:JSON.stringify({child_id,task_id:'T03'})}),
  start:(id:string)=>request(`/assessments/${id}/start`,{method:'POST'}),
  response:(id:string,data:unknown)=>request(`/assessments/${id}/responses`,{method:'POST',body:JSON.stringify(data)}),
  complete:(id:string)=>request(`/assessments/${id}/complete`,{method:'POST'})
  ,abort:(id:string)=>request(`/assessments/${id}/abort`,{method:'POST'})
  ,report:(id:string)=>request<import('./types').SelReport>(`/reports/${id}`)
}
