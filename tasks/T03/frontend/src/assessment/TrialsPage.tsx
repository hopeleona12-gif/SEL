import { ReactNode, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api'
import { TrialScene } from '../components/TrialScene'
import { useAssessment } from '../context'
import { useTrialRunner } from '../engine/useTrialRunner'
import { Phase, TaskConfig } from '../types'

function Shell({ children }: { children: ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center p-6">
    <section className="relative flex min-h-[560px] w-full max-w-4xl flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-white p-8 text-center shadow-xl">
      {children}
    </section>
  </main>
}

export function TrialsPage({ phase }: { phase: Phase }) {
  const { task, sessionId } = useAssessment()
  if (!task || !sessionId) {
    return <Shell>
      <p>测评信息已丢失，请返回首页重新开始。</p>
      <a href="/" className="mt-4 text-sky-700 underline">返回首页</a>
    </Shell>
  }
  return <ActiveTrials phase={phase} task={task} sessionId={sessionId} />
}

function ActiveTrials({
  phase,
  task,
  sessionId,
}: {
  phase: Phase
  task: TaskConfig
  sessionId: string
}) {
  const navigate = useNavigate()
  const handleComplete = useCallback(async () => {
    if (phase === 'practice') {
      navigate('/practice-complete')
      return
    }
    await api.complete(sessionId)
    navigate('/done')
  }, [navigate, phase, sessionId])

  const runner = useTrialRunner({ phase, task, sessionId, onComplete: handleComplete })

  if (runner.stage === 'loading') {
    return <Shell>
      <div className="h-14 w-14 animate-pulse rounded-full bg-sky-300" />
      <p className="mt-5 text-xl">正在准备任务…</p>
    </Shell>
  }

  if (runner.stage === 'error' || !runner.trial) {
    return <Shell>
      <p className="text-xl">任务已暂停，请研究者检查设备。</p>
      <p className="mt-3 text-sm text-slate-500">{runner.error}</p>
    </Shell>
  }

  return <Shell>
    <p className="mb-5 text-lg">
      {phase === 'practice' ? '练习' : '正式测评'} · {runner.index + 1} / {runner.total}
    </p>
    <TrialScene
      task={task}
      trial={runner.trial}
      nextTrial={runner.nextTrial}
      stage={runner.stage}
      clicked={runner.clicked}
      onStarClick={runner.respond}
    />
    {runner.stage === 'condition_transition' && (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px]">
        <div className="text-6xl">🐵</div>
        <p className="mt-6 text-2xl font-semibold">下一组马上开始</p>
        <p className="mt-2 text-slate-500">请继续仔细听声音</p>
      </div>
    )}
    {phase === 'practice' && runner.stage === 'feedback' && runner.practiceFeedback && (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/75 backdrop-blur-[2px]">
        <div className="animate-bounce text-7xl">
          {runner.practiceFeedback === 'correct' ? '🎉' : '🐶'}
        </div>
        <p className="mt-6 text-3xl font-bold text-sky-800">
          {runner.practiceFeedback === 'correct' ? '答对啦！' : '不对哦，再试一次。'}
        </p>
      </div>
    )}
    <p className="mt-6 text-xl">请仔细听声音</p>
  </Shell>
}
