import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../api'
import { Phase, TaskConfig, Trial } from '../types'
import { preloadTaskAssets } from './assetPreloader'
import { playNarration } from './speech'

export type TrialStage =
  | 'loading'
  | 'condition_transition'
  | 'pre_stimulus'
  | 'response'
  | 'saving'
  | 'feedback'
  | 'inter_trial'
  | 'complete'
  | 'error'

type RecordedResponse = {
  actual_response: 'click' | 'no_click'
  response_time: string | null
  reaction_time_ms: number | null
}

type RunnerOptions = {
  phase: Phase
  task: TaskConfig
  sessionId: string
  onComplete: () => Promise<void> | void
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(new DOMException('Trial cancelled', 'AbortError'))
    }, { once: true })
  })
}

async function playStimulus(url: string, signal: AbortSignal) {
  const audio = new Audio(url)
  audio.preload = 'auto'
  return new Promise<{ clock: number; timestamp: string }>((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('error', onError)
      signal.removeEventListener('abort', onAbort)
    }
    const onPlaying = () => {
      cleanup()
      resolve({ clock: performance.now(), timestamp: new Date().toISOString() })
    }
    const onError = () => {
      cleanup()
      reject(new Error('声音刺激播放失败，当前试次未记录。'))
    }
    const onAbort = () => {
      audio.pause()
      cleanup()
      reject(new DOMException('Trial cancelled', 'AbortError'))
    }
    audio.addEventListener('playing', onPlaying, { once: true })
    audio.addEventListener('error', onError, { once: true })
    signal.addEventListener('abort', onAbort, { once: true })
    audio.play().catch(onError)
  })
}

export function useTrialRunner({ phase, task, sessionId, onComplete }: RunnerOptions) {
  const trials = phase === 'practice' ? task.practice_trials : task.test_trials
  const [index, setIndex] = useState(0)
  const [practiceAttempt, setPracticeAttempt] = useState(0)
  const [stage, setStage] = useState<TrialStage>('loading')
  const [clicked, setClicked] = useState(false)
  const [practiceFeedback, setPracticeFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [error, setError] = useState('')
  const [assetsReady, setAssetsReady] = useState(false)
  const responseRef = useRef<RecordedResponse>({
    actual_response: 'no_click',
    response_time: null,
    reaction_time_ms: null,
  })
  const soundClockRef = useRef(0)
  const soundOnsetRef = useRef('')
  const completedRef = useRef(false)

  useEffect(() => {
    let active = true
    preloadTaskAssets(task)
      .then(() => active && setAssetsReady(true))
      .catch(reason => {
        if (!active) return
        setError(reason instanceof Error ? reason.message : '素材预加载失败')
        setStage('error')
      })
    return () => { active = false }
  }, [task])

  useEffect(() => {
    if (!assetsReady || completedRef.current) return
    const controller = new AbortController()
    const { signal } = controller

    const run = async () => {
      try {
        if (index >= trials.length) {
          completedRef.current = true
          setStage('complete')
          await onComplete()
          return
        }

        const trial = trials[index]
        const previous = trials[index - 1]
        if (previous && previous.condition !== trial.condition) {
          setStage('condition_transition')
          await delay(task.timing.condition_transition_ms ?? 900, signal)
        }

        responseRef.current = {
          actual_response: 'no_click',
          response_time: null,
          reaction_time_ms: null,
        }
        setClicked(false)
        setPracticeFeedback(null)
        setStage('pre_stimulus')
        const stimulusOnset = new Date().toISOString()
        await delay(task.timing.pre_stimulus_ms, signal)

        const audioUrl = task.assets[`${trial.stimulus}_audio`]
        const sound = await playStimulus(audioUrl, signal)
        soundClockRef.current = sound.clock
        soundOnsetRef.current = sound.timestamp
        setStage('response')
        await delay(task.timing.response_window_ms, signal)

        const expectedResponse = trial.stimulus === 'dong' ? 'click' : 'no_click'
        const isCorrect = responseRef.current.actual_response === expectedResponse
        setStage('saving')
        await api.response(sessionId, {
          trial_id: trial.trial_id,
          trial_order: index + 1,
          phase,
          practice_attempt_no: phase === 'practice' ? practiceAttempt + 1 : 1,
          condition: trial.condition,
          stimulus: trial.stimulus,
          stimulus_onset: stimulusOnset,
          sound_onset: soundOnsetRef.current,
          ...responseRef.current,
        })

        if (phase === 'practice') {
          setPracticeFeedback(isCorrect ? 'correct' : 'incorrect')
          setStage('feedback')
          if (isCorrect) {
            await playNarration(task.assets.practice_correct_audio, '答对啦！')
          } else {
            await delay(1200, signal)
          }
        }

        setStage('inter_trial')
        const minimumIti = task.timing.inter_trial_interval_ms
        const maximumIti = task.timing.inter_trial_interval_max_ms ?? minimumIti
        const iti = minimumIti + Math.floor(Math.random() * (maximumIti - minimumIti + 1))
        await delay(iti, signal)
        if (phase === 'practice' && !isCorrect) {
          setPracticeAttempt(value => value + 1)
          return
        }
        setPracticeAttempt(0)
        setIndex(value => value + 1)
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : '试次运行失败')
        setStage('error')
      }
    }

    run()
    return () => controller.abort()
  }, [assetsReady, index, onComplete, phase, practiceAttempt, sessionId, task, trials])

  const respond = useCallback(() => {
    if (stage !== 'response' || clicked) return
    responseRef.current = {
      actual_response: 'click',
      response_time: new Date().toISOString(),
      reaction_time_ms: Math.max(0, Math.round(performance.now() - soundClockRef.current)),
    }
    setClicked(true)
  }, [clicked, stage])

  return {
    trial: trials[index] as Trial | undefined,
    nextTrial: trials[index + 1] as Trial | undefined,
    index,
    total: trials.length,
    stage,
    clicked,
    practiceFeedback,
    error,
    respond,
  }
}
