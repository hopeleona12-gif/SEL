import { TaskConfig } from '../types'

const cache = new Map<string, Promise<void>>()

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`图片加载失败：${url}`))
    image.src = url
  })
}

function preloadMedia(url: string, kind: 'audio' | 'video'): Promise<void> {
  return new Promise((resolve, reject) => {
    const media = document.createElement(kind)
    media.preload = 'auto'
    media.oncanplaythrough = () => resolve()
    media.onerror = () => reject(new Error(`媒体加载失败：${url}`))
    media.src = url
    media.load()
  })
}

function preload(url: string): Promise<void> {
  const existing = cache.get(url)
  if (existing) return existing
  const normalized = url.toLowerCase()
  const promise = normalized.endsWith('.png') || normalized.endsWith('.jpg')
    ? preloadImage(url)
    : preloadMedia(
        url,
        normalized.endsWith('.mp3') || normalized.endsWith('.wav') ? 'audio' : 'video',
      )
  cache.set(url, promise)
  return promise
}

export function preloadTaskAssets(task: TaskConfig): Promise<void> {
  const trialVideos = [...task.practice_trials, ...task.test_trials]
    .map(trial => trial.distractor_video)
    .filter((url): url is string => Boolean(url))
  const taskAssets = Object.entries(task.assets)
    .filter(([key]) => key !== 'rule_video')
    .map(([, url]) => url)
  const urls = [...new Set([...taskAssets, ...trialVideos])]
  return Promise.all(urls.map(preload)).then(() => undefined)
}
