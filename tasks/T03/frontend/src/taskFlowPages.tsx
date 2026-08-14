import { ReactNode, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from './api'
import { useAssessment } from './context'
import { playNarration } from './engine/speech'

function Shell({ children }: { children: ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center p-6">
    <section className="flex min-h-[560px] w-full max-w-4xl flex-col items-center justify-center rounded-[2rem] bg-white p-8 text-center shadow-xl">
      {children}
    </section>
  </main>
}

function Missing() {
  return <Shell>
    <p>测评信息已丢失，请返回首页重新开始。</p>
    <a href="/" className="mt-4 text-sky-700 underline">返回首页</a>
  </Shell>
}

export function Home() {
  const navigate = useNavigate()
  const assessment = useAssessment()
  const [childId, setChildId] = useState('C001')
  const [age, setAge] = useState(7)
  const [error, setError] = useState('')

  const start = async () => {
    try {
      setError('')
      const task = await api.task('T03')
      await api.child(childId, age)
      const session = await api.createSession(childId)
      assessment.setTask(task)
      assessment.setSessionId(session.session_id)
      navigate('/rule')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法开始测评')
    }
  }

  return <Shell>
    <div className="mb-8 text-7xl">⭐</div>
    <h1 className="text-4xl font-bold">欢迎参加游戏</h1>
    <p className="mt-4 text-2xl">准备好了吗？</p>
    <div className="mt-8 grid w-full max-w-sm gap-3">
      <input aria-label="儿童编号" className="rounded-xl border-2 p-3 text-lg" value={childId} onChange={event => setChildId(event.target.value)} />
      <input aria-label="年龄" type="number" className="rounded-xl border-2 p-3 text-lg" value={age} onChange={event => setAge(Number(event.target.value))} />
    </div>
    {error && <p className="mt-3 text-red-600">{error}</p>}
    <button onClick={start} className="mt-8 rounded-full bg-sky-600 px-16 py-4 text-2xl font-bold text-white hover:bg-sky-700">开始</button>
  </Shell>
}

export function Rule() {
  const { task, sessionId } = useAssessment()
  const navigate = useNavigate()
  if (!task || !sessionId) return <Missing />

  return <Shell>
    <h1 className="mb-6 text-3xl font-bold">听一听游戏规则</h1>
    <video
      className="w-full max-w-3xl rounded-2xl bg-slate-900"
      controls
      playsInline
      autoPlay
      preload="auto"
      src={task.assets.rule_video}
      onEnded={() => navigate('/practice-intro')}
    />
    <button className="mt-6 text-sm text-slate-400 underline" onClick={() => navigate('/practice-intro')}>
      研究者调试：跳过规则视频
    </button>
  </Shell>
}

export function PracticeIntro() {
  const { task, sessionId } = useAssessment()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [voiceReady, setVoiceReady] = useState(false)
  useEffect(() => {
    if (!task || !sessionId) return
    let active = true
    playNarration(task.assets.practice_intro_audio, '小朋友，我们先试一下这个游戏。').then(() => {
      if (active) setVoiceReady(true)
    })
    return () => { active = false }
  }, [sessionId, task])
  if (!task || !sessionId) return <Missing />

  const start = async () => {
    try {
      await api.start(sessionId)
      navigate('/practice')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法开始练习')
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
    {error && <p className="mt-3 text-red-600">{error}</p>}
    <button
      onClick={start}
      disabled={!voiceReady}
      className="mt-8 rounded-full bg-sky-600 px-12 py-4 text-2xl font-bold text-white hover:bg-sky-700 disabled:cursor-wait disabled:bg-slate-300"
    >{voiceReady ? '开始练习' : '请听提示…'}</button>
  </Shell>
}

export function PracticeComplete() {
  const { task, sessionId } = useAssessment()
  const navigate = useNavigate()
  const [learnedReady, setLearnedReady] = useState(false)
  useEffect(() => {
    if (!task || !sessionId) return
    let active = true
    const playFormalIntroduction = async () => {
      await playNarration(task.assets.formal_intro_audio, '现在开始正式游戏，请准备好。')
      if (active) setLearnedReady(true)
    }
    void playFormalIntroduction()
    return () => { active = false }
  }, [sessionId, task])
  if (!task || !sessionId) return <Missing />

  const startFormalAssessment = () => navigate('/test')

  return <Shell>
    <div className="text-7xl">🌟</div>
    <h1 className="mt-7 text-4xl font-bold">练习完成</h1>
    <p className="mt-5 text-2xl">接下来进入正式测评</p>
    <p className="mt-3 text-lg text-slate-500">正式测评中不会提示正确或错误。</p>
    <button
      onClick={startFormalAssessment}
      disabled={!learnedReady}
      className="mt-9 rounded-full bg-indigo-600 px-12 py-4 text-2xl font-bold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:bg-slate-300"
    >{learnedReady ? '开始正式测评' : '请听提示…'}</button>
  </Shell>
}

export function Done() {
  const { sessionId } = useAssessment()
  return <Shell>
    <div className="text-8xl">🌟</div>
    <h1 className="mt-8 text-4xl font-bold">任务完成</h1>
    <p className="mt-4 text-2xl">谢谢你的参与</p>
    {sessionId && <a href={`/report/${sessionId}`} className="mt-12 rounded-full bg-slate-700 px-8 py-3 text-white">教师／研究者查看报告</a>}
  </Shell>
}
