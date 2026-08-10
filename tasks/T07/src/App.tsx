import { useCallback, useEffect, useRef, useState } from 'react'
import { scoreTask } from './scoring'
import { taskConfig } from './taskConfig'
import type { Condition, Phase, PromptLevel, ResponseRecord, Result } from './types'

type ClipStage =
  | 'intro' | 'A_observe' | 'A_entry' | 'A_reset' | 'A_peer' | 'A_adjustment' | 'A_end'
  | 'B_observe' | 'B_entry' | 'B_reset' | 'B_peer' | 'B_adjustment' | 'B_end' | 'complete'

const ASSET = '/assets/T07/'
const clips: Partial<Record<ClipStage, string>> = {
  intro: 'T07-00.mp4', A_observe: 'T07-A-01.mp4', A_reset: 'T07-A-03.mp4',
  A_peer: 'T07-A-04.mp4', A_end: 'T07-A-06.mp4', B_observe: 'T07-B-01.mp4',
  B_reset: 'T07-B-03.mp4', B_peer: 'T07-B-04.mp4', B_end: 'T07-B-06.mp4',
}
const choiceImage: Partial<Record<ClipStage, string>> = {
  A_entry: 'T07-A-02.png', A_adjustment: 'T07-A-05.png',
  B_entry: 'T07-B-02.png', B_adjustment: 'T07-B-05.png',
}
const choiceAudio: Partial<Record<ClipStage, string>> = {
  A_entry: 'T07-A-02_20260801_19150540.mp3', A_adjustment: 'T07-A-05-sequence.mp3',
  B_entry: 'T07-B-02.mp3', B_adjustment: 'T07-B-05.mp3',
}
const optionStarts: Partial<Record<ClipStage, number[]>> = {
  A_entry: [0, 2.50, 4.78, 6.91],
  A_adjustment: [5.09, 9.34, 11.86, 15.36],
  B_entry: [2.11, 5.04, 8.23, 12.15],
  B_adjustment: [2.99, 8.35, 11.23, 14.84],
}

function isChoice(stage: ClipStage) {
  return stage.endsWith('_entry') || stage.endsWith('_adjustment')
}

function contextFor(stage: ClipStage): { condition: Condition; phase: Phase } {
  return { condition: stage.startsWith('A_') ? 'A' : 'B', phase: stage.endsWith('_entry') ? 'entry' : 'adjustment' }
}

function speak(text: string) {
  void text
}

export function App() {
  const [stage, setStage] = useState<ClipStage>('intro')
  const [started, setStarted] = useState(false)
  const [needsPlay, setNeedsPlay] = useState(false)
  const [choiceReady, setChoiceReady] = useState(false)
  const [currentOption, setCurrentOption] = useState<number | null>(null)
  const [prompt, setPrompt] = useState<PromptLevel>('P0')
  const [records, setRecords] = useState<ResponseRecord[]>([])
  const [result, setResult] = useState<Result | null>(null)
  const startedAt = useRef(0)
  const timedOut = useRef(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const playCurrentVideo = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    void video.play().then(() => setNeedsPlay(false)).catch(() => setNeedsPlay(true))
  }, [])

  const startTask = () => {
    setStarted(true)
    playCurrentVideo()
  }

  useEffect(() => { setNeedsPlay(false); setCurrentOption(null) }, [stage])

  const enterChoice = useCallback(() => {
    setChoiceReady(false); setPrompt('P0'); timedOut.current = false
    const audio = audioRef.current
    if (audio) { audio.currentTime = 0; void audio.play().catch(() => undefined) }
  }, [stage])

  useEffect(() => { if (isChoice(stage)) enterChoice() }, [stage, enterChoice])

  useEffect(() => {
    if (!isChoice(stage) || !choiceReady) return
    const { condition, phase } = contextFor(stage)
    const scene = taskConfig.scenes[condition]
    const question = phase === 'entry' ? scene.entryQuestion : '接下来你会怎么做？'
    const options = scene[phase]
    const timer = window.setTimeout(() => {
      timedOut.current = true
      if (prompt === 'P0') {
        setPrompt('P1'); startedAt.current = performance.now()
        const audio = audioRef.current
        if (audio) { audio.currentTime = 0; void audio.play().catch(() => speak(question)) }
        else speak(question)
      } else if (prompt === 'P1') {
        setPrompt('P2'); startedAt.current = performance.now()
        speak(`${question}。选项一，${options[0]}。选项二，${options[1]}。选项三，${options[2]}。选项四，${options[3]}。`)
      }
    }, taskConfig.prompt_after_ms)
    return () => window.clearTimeout(timer)
  }, [stage, choiceReady, prompt])

  const trackSpokenOption = () => {
    const audio = audioRef.current
    if (!audio || choiceReady) return
    const starts = optionStarts[stage] || [0]
    if (audio.currentTime < starts[0]) {
      setCurrentOption(null)
      return
    }
    let index = 0
    for (let i = 1; i < starts.length; i++) {
      if (audio.currentTime >= starts[i]) index = i
    }
    setCurrentOption(index + 1)
  }

  const finishChoiceAudio = () => {
    setCurrentOption(null)
    setChoiceReady(true); startedAt.current = performance.now()
  }

  const advanceClip = () => {
    const next: Partial<Record<ClipStage, ClipStage>> = {
      intro: 'A_observe', A_observe: 'A_entry', A_reset: 'A_peer', A_peer: 'A_adjustment',
      A_end: 'B_observe', B_observe: 'B_entry', B_reset: 'B_peer', B_peer: 'B_adjustment',
      B_end: 'complete',
    }
    const target = next[stage]
    if (target) setStage(target)
  }

  const choose = (selected: 1 | 2 | 3 | 4) => {
    if (!choiceReady) return
    const { condition, phase } = contextFor(stage)
    const record: ResponseRecord = {
      task_id: 'T07', condition, phase, selected_option: selected, correctness: selected === 1,
      prompt_level: prompt, reaction_time: Math.round(performance.now() - startedAt.current),
      timeout: timedOut.current, answered_at: new Date().toISOString(),
    }
    const nextRecords = [...records, record]
    setRecords(nextRecords)
    localStorage.setItem('SEL_T07_responses', JSON.stringify(nextRecords))
    if (stage === 'A_entry') setStage('A_reset')
    else if (stage === 'A_adjustment') setStage('A_end')
    else if (stage === 'B_entry') setStage('B_reset')
    else {
      const scored = scoreTask(nextRecords)
      setResult(scored); localStorage.setItem('SEL_T07_result', JSON.stringify(scored))
      void fetch('/api/results', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(scored) }).catch(() => undefined)
      setStage('B_end')
    }
  }

  const restart = () => {
    setRecords([]); setResult(null); setPrompt('P0'); setStarted(false); setStage('intro')
    localStorage.removeItem('SEL_T07_responses'); localStorage.removeItem('SEL_T07_result')
  }

  return <main className="assessment-page">
    <section className="media-stage" aria-label="T07 加入小伙伴">
      {isChoice(stage) ? <>
        <div className={`choice-canvas ${stage.startsWith('A_') ? 'ratio-a' : 'ratio-b'}`}>
          <img className="material-base" src={ASSET + choiceImage[stage]} alt="四个动画选项"/>
          {currentOption !== null && !choiceReady && <div className={`material-option-zoom zoom-${currentOption}`} aria-hidden="true">
            <img src={ASSET + choiceImage[stage]} alt=""/>
          </div>}
          {choiceReady && <div className="hotspot-grid" aria-label="请选择一个办法">
            {[1, 2, 3, 4].map(value => <button key={value} className="choice-hotspot" onClick={() => choose(value as 1|2|3|4)} aria-label={`选择第${value}项`}/>) }
          </div>}
        </div>
        <audio ref={audioRef} src={ASSET + choiceAudio[stage]} onTimeUpdate={trackSpokenOption} onEnded={finishChoiceAudio}/>
      </> : stage === 'complete' ? <div className="complete-panel">
        <h1>这一关结束了</h1>
        {result && <p>数据已保存</p>}
        <button onClick={restart}>重新测试</button>
      </div> : <video ref={videoRef} key={stage} className="stage-media" src={ASSET + clips[stage]} playsInline onLoadedData={() => started && playCurrentVideo()} onEnded={advanceClip}/>} 
      {!isChoice(stage) && stage !== 'complete' && (!started || needsPlay) && <div className="play-gate">
        <button onClick={startTask}>{started ? '继续播放' : '点击开始'}</button>
      </div>}
    </section>
  </main>
}
