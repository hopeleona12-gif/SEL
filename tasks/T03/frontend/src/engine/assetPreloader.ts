import { TaskConfig, Trial } from '../types'

type Priority = 'current' | 'next'

const cache = new Map<string, Promise<void>>()

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`图片加载失败：${url}`))
    image.src = url
  })
}

function preloadMedia(url: string, kind: 'audio' | 'video', priority: Priority): Promise<void> {
  return new Promise((resolve, reject) => {
    const media = document.createElement(kind)
    const readyEvent = priority === 'current' ? 'loadeddata' : 'loadedmetadata'
    media.preload = priority === 'current' && kind === 'audio' ? 'auto' : 'metadata'
    media.addEventListener(readyEvent, () => resolve(), { once: true })
    media.addEventListener('error', () => reject(new Error(`媒体加载失败：${url}`)), { once: true })
    media.src = url
    media.load()
  })
}

function preload(url: string, priority: Priority): Promise<void> {
  const key = `${priority}:${url}`
  const existing = cache.get(key)
  if (existing) return existing
  const normalized = url.toLowerCase()
  const promise = /\.(?:png|jpe?g|webp)(?:$|[?#])/.test(normalized)
    ? preloadImage(url)
    : preloadMedia(
        url,
        /\.(?:mp3|wav)(?:$|[?#])/.test(normalized) ? 'audio' : 'video',
        priority,
      )
  cache.set(key, promise)
  return promise
}

function trialUrls(task: TaskConfig, trial: Trial, includeVideo: boolean): string[] {
  const urls = [
    task.assets.scene_background,
    task.assets.star_active,
    task.assets.star_idle,
    task.assets[`${trial.stimulus}_audio`],
  ]
  if (includeVideo && trial.distractor_video) urls.push(trial.distractor_video)
  return [...new Set(urls.filter((url): url is string => Boolean(url)))]
}

export function preloadCurrentTrial(task: TaskConfig, trial: Trial): Promise<void> {
  return Promise.all(trialUrls(task, trial, true).map(url => preload(url, 'current')))
    .then(() => undefined)
}

let backgroundActive = 0
const backgroundQueue: Array<() => void> = []

function runBackgroundQueue() {
  while (backgroundActive < 2 && backgroundQueue.length) {
    backgroundActive += 1
    backgroundQueue.shift()?.()
  }
}

function enqueueNext(url: string): Promise<void> {
  return new Promise(resolve => {
    backgroundQueue.push(() => {
      preload(url, 'next').catch(() => undefined).finally(() => {
        backgroundActive -= 1
        resolve()
        runBackgroundQueue()
      })
    })
    runBackgroundQueue()
  })
}

export function preloadNextTrial(task: TaskConfig, trial?: Trial): Promise<void> {
  if (!trial) return Promise.resolve()
  // Shared images were already loaded for the current trial, while
  // DoubleBufferedVideo prepares the single next distractor video. Only the
  // next stimulus audio needs this max-2 background queue.
  const audioUrl = task.assets[`${trial.stimulus}_audio`]
  return audioUrl ? enqueueNext(audioUrl) : Promise.resolve()
}
