import { TrialStage } from '../engine/useTrialRunner'
import { TaskConfig, Trial } from '../types'
import { DoubleBufferedVideo } from './DoubleBufferedVideo'

type Props = {
  task: TaskConfig
  trial: Trial
  nextTrial?: Trial
  stage: TrialStage
  clicked: boolean
  onStarClick: () => void
}

export function TrialScene({ task, trial, nextTrial, stage, clicked, onStarClick }: Props) {
  const responseOpen = stage === 'response'
  const stimulusVisible = stage === 'pre_stimulus' || responseOpen

  return <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-3xl bg-sky-100">
    <img
      src={task.assets.scene_background}
      alt="教室任务场景"
      className="absolute inset-0 h-full w-full object-cover"
    />

    <DoubleBufferedVideo
      src={trial.distractor_video}
      nextSrc={nextTrial?.distractor_video}
    />

    <img
      src={task.assets[clicked ? 'star_active' : 'star_idle']}
      alt=""
      aria-hidden="true"
      className={`pointer-events-none absolute left-1/2 top-[58%] aspect-square w-[22%] -translate-x-1/2 -translate-y-1/2 object-contain transition-opacity duration-100 ${
        stimulusVisible ? 'opacity-100' : 'opacity-0'
      }`}
    />

    <button
      type="button"
      aria-label="点击画面中央的星星"
      disabled={!responseOpen || clicked}
      onClick={onStarClick}
      className="absolute left-1/2 top-[58%] aspect-square w-[calc(22%+60px)] -translate-x-1/2 -translate-y-1/2 rounded-[40%] bg-transparent disabled:cursor-default enabled:cursor-pointer active:scale-95"
    />
  </div>
}
