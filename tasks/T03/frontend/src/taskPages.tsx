import { ReactNode, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from './api'
import { useAssessment } from './context'
import { preloadTaskAssets } from './engine/assetPreloader'
import { Phase } from './types'

function Shell({children}:{children:ReactNode}){
  return <main className="min-h-screen flex items-center justify-center p-6">
    <section className="w-full max-w-4xl min-h-[560px] rounded-[2rem] bg-white shadow-xl flex flex-col items-center justify-center p-8 text-center">
      {children}
    </section>
  </main>
}

export function Home(){
  const nav=useNavigate()
  const ctx=useAssessment()
  const [id,setId]=useState('C001')
  const [age,setAge]=useState(7)
  const [error,setError]=useState('')
  const start=async()=>{
    try{
      setError('')
      const task=await api.task('T03')
      await api.child(id,age)
      const session=await api.createSession(id)
      ctx.setTask(task)
      ctx.setSessionId(session.session_id)
      nav('/rule')
    }catch(error){
      setError((error as Error).message)
    }
  }
  return <Shell>
    <div className="text-7xl mb-8">⭐</div>
    <h1 className="text-4xl font-bold">欢迎参加游戏</h1>
    <p className="text-2xl mt-4">准备好了吗？</p>
    <div className="grid gap-3 mt-8 max-w-sm w-full">
      <input aria-label="儿童编号" className="border-2 rounded-xl p-3 text-lg" value={id} onChange={event=>setId(event.target.value)} placeholder="儿童编号"/>
      <input aria-label="年龄" type="number" className="border-2 rounded-xl p-3 text-lg" value={age} onChange={event=>setAge(Number(event.target.value))}/>
    </div>
    {error&&<p className="text-red-600 mt-3">{error}</p>}
    <button onClick={start} className="mt-8 bg-sky-600 text-white text-2xl font-bold px-16 py-4 rounded-full hover:bg-sky-700">开始</button>
  </Shell>
}

export function Rule(){
  const {task,sessionId}=useAssessment()
  const nav=useNavigate()
  useEffect(()=>{
    if(task)preloadTaskAssets(task).catch(()=>undefined)
  },[task])
  if(!task||!sessionId)return <Missing/>
  return <Shell>
    <h1 className="text-3xl font-bold mb-6">听一听游戏规则</h1>
    <video className="w-full max-w-3xl rounded-2xl bg-slate-900" controls playsInline autoPlay src={task.assets.rule_video} onEnded={()=>nav('/practice-intro')}/>
    <button className="mt-6 text-sky-700 underline" onClick={()=>nav('/practice-intro')}>素材调试：跳过视频</button>
  </Shell>
}

export function PracticeIntro(){
  const {task,sessionId}=useAssessment()
  const nav=useNavigate()
  const [error,setError]=useState('')
  if(!task||!sessionId)return <Missing/>
  const start=async()=>{
    try{
      await api.start(sessionId)
      nav('/practice')
    }catch(error){
      setError((error as Error).message)
    }
  }
  return <Shell>
    <div className="rounded-full bg-amber-100 p-5 text-5xl">👂</div>
    <h1 className="mt-7 text-4xl font-bold">先来练习一下</h1>
    <div className="mt-7 max-w-xl rounded-3xl bg-sky-50 p-7 text-left text-xl leading-9">
      <p>听到“咚”：点击星星。</p>
      <p>听到“叮”：不要点击，安静等待。</p>
    </div>
    <p className="mt-6 text-lg text-slate-600">认真听声音，只需要点击星星。</p>
    {error&&<p className="mt-3 text-red-600">{error}</p>}
    <button onClick={start} className="mt-8 rounded-full bg-sky-600 px-12 py-4 text-2xl font-bold text-white hover:bg-sky-700">开始练习</button>
  </Shell>
}

export function PracticeComplete(){
  const {task,sessionId}=useAssessment()
  const nav=useNavigate()
  if(!task||!sessionId)return <Missing/>
  return <Shell>
    <div className="text-7xl">🌟</div>
    <h1 className="mt-7 text-4xl font-bold">练习完成</h1>
    <p className="mt-5 text-2xl">接下来进入正式测评</p>
    <p className="mt-3 text-lg text-slate-500">正式测评中不会提示正确或错误。</p>
    <button onClick={()=>nav('/test')} className="mt-9 rounded-full bg-indigo-600 px-12 py-4 text-2xl font-bold text-white hover:bg-indigo-700">开始正式测评</button>
  </Shell>
}

type PendingResponse={
  actual_response:'click'|'no_click'
  response_time:string|null
  reaction_time_ms:number|null
}

export function Trials({phase}:{phase:Phase}){
  const {task,sessionId}=useAssessment()
  const nav=useNavigate()
  const [index,setIndex]=useState(0)
  const [active,setActive]=useState(false)
  const [enabled,setEnabled]=useState(false)
  const [error,setError]=useState('')
  const soundClockRef=useRef(0)
  const clickedRef=useRef(false)
  const responseRef=useRef<PendingResponse>({actual_response:'no_click',response_time:null,reaction_time_ms:null})

  useEffect(()=>{
    if(!task||!sessionId)return
    let cancelled=false
    const trials=phase==='practice'?task.practice_trials:task.test_trials
    const run=async()=>{
      try{
        if(index>=trials.length){
          if(phase==='test'){
            await api.complete(sessionId)
            nav('/done')
          }else{
            nav('/practice-complete')
          }
          return
        }
        const trial=trials[index]
        setActive(false)
        setEnabled(false)
        clickedRef.current=false
        responseRef.current={actual_response:'no_click',response_time:null,reaction_time_ms:null}
        await wait(task.timing.pre_stimulus_ms)
        if(cancelled)return

        const stimulusOnset=new Date().toISOString()
        setActive(true)
        const audio=new Audio(task.assets[`${trial.stimulus}_audio`])
        let soundOnset=''
        const markSoundOnset=()=>{
          if(soundOnset)return
          soundOnset=new Date().toISOString()
          soundClockRef.current=performance.now()
          setEnabled(true)
        }
        audio.addEventListener('playing',markSoundOnset,{once:true})
        try{
          await audio.play()
          markSoundOnset()
        }catch{
          markSoundOnset()
        }

        await wait(task.timing.response_window_ms)
        if(cancelled)return
        setEnabled(false)
        await api.response(sessionId,{
          trial_id:trial.trial_id,
          trial_order:index+1,
          phase,
          condition:trial.condition,
          stimulus:trial.stimulus,
          stimulus_onset:stimulusOnset,
          sound_onset:soundOnset,
          ...responseRef.current,
        })
        await wait(task.timing.inter_trial_interval_ms)
        if(!cancelled)setIndex(value=>value+1)
      }catch(error){
        setError((error as Error).message)
      }
    }
    run()
    return()=>{cancelled=true}
  },[index,nav,phase,sessionId,task])

  if(!task||!sessionId)return <Missing/>
  const trials=phase==='practice'?task.practice_trials:task.test_trials
  const trial=trials[index]
  const click=()=>{
    if(!enabled||clickedRef.current)return
    clickedRef.current=true
    responseRef.current={
      actual_response:'click',
      response_time:new Date().toISOString(),
      reaction_time_ms:Math.round(performance.now()-soundClockRef.current),
    }
  }
  const image=task.assets[`${phase}_${active?'active':'idle'}`]
  return <Shell>
    <p className="mb-5 text-lg">{phase==='practice'?'练习':'正式测评'} · {Math.min(index+1,trials.length)} / {trials.length}</p>
    <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-3xl bg-sky-100">
      <img src={image} alt="教室中的星星任务画面" className="absolute inset-0 h-full w-full object-cover"/>
      {trial?.distractor_video&&<>
        <video key={trial.trial_id} src={trial.distractor_video} muted autoPlay playsInline className="pointer-events-none absolute inset-0 h-full w-full object-cover"/>
        <img src={task.assets[active?'star_active':'star_idle']} alt="" className="pointer-events-none absolute left-1/2 top-[58%] aspect-square w-[22%] -translate-x-1/2 -translate-y-1/2 object-contain"/>
      </>}
      <button
        aria-label="点击画面中央的星星"
        disabled={!enabled}
        onClick={click}
        className="absolute left-1/2 top-[58%] aspect-square w-[calc(22%+60px)] -translate-x-1/2 -translate-y-1/2 rounded-[40%] bg-transparent disabled:cursor-default enabled:cursor-pointer"
      />
    </div>
    <p className="mt-6 text-xl">请仔细听声音</p>
    {error&&<p className="mt-3 text-red-600">{error}</p>}
  </Shell>
}

export function Done(){
  const {sessionId}=useAssessment()
  return <Shell>
    <div className="text-8xl">🌟</div>
    <h1 className="mt-8 text-4xl font-bold">任务完成</h1>
    <p className="mt-4 text-2xl">谢谢你的参与</p>
    {sessionId&&<a href={`/report/${sessionId}`} className="mt-12 rounded-full bg-slate-700 px-8 py-3 text-white">教师／研究者查看报告</a>}
  </Shell>
}

function Missing(){
  return <Shell>
    <p>测评信息已丢失，请返回首页重新开始。</p>
    <a href="/" className="mt-4 text-sky-700 underline">返回首页</a>
  </Shell>
}

function wait(ms:number){
  return new Promise(resolve=>setTimeout(resolve,ms))
}
