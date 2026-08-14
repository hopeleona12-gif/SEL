import { useEffect, useRef, useState } from 'react'

type VideoLayer = 0 | 1

type Props = {
  src?: string
  nextSrc?: string
  transitionMs?: number
}

export function DoubleBufferedVideo({ src, nextSrc, transitionMs = 140 }: Props) {
  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  const activeLayerRef = useRef<VideoLayer>(0)
  const layerSourcesRef = useRef<[string | undefined, string | undefined]>([
    undefined,
    undefined,
  ])
  const switchSequenceRef = useRef(0)
  const [activeLayer, setActiveLayer] = useState<VideoLayer>(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const videoA = videoARef.current
    const videoB = videoBRef.current
    if (!videoA || !videoB) return
    const layers: [HTMLVideoElement, HTMLVideoElement] = [videoA, videoB]

    const sequence = ++switchSequenceRef.current
    if (!src) {
      layers.forEach(video => video.pause())
      setVisible(false)
      if (nextSrc) {
        const preloadIndex = (activeLayerRef.current === 0 ? 1 : 0) as VideoLayer
        const preloadVideo = layers[preloadIndex]
        if (layerSourcesRef.current[preloadIndex] !== nextSrc) {
          preloadVideo.preload = 'metadata'
          preloadVideo.src = nextSrc
          layerSourcesRef.current[preloadIndex] = nextSrc
          preloadVideo.load()
        }
      }
      return
    }

    const previousIndex = activeLayerRef.current
    const nextIndex = (previousIndex === 0 ? 1 : 0) as VideoLayer
    const previousVideo = layers[previousIndex]
    const nextVideo = layers[nextIndex]
    let switchTimer = 0

    const prepare = (
      video: HTMLVideoElement,
      layer: VideoLayer,
      url: string,
      priority: 'current' | 'next',
    ) =>
      new Promise<void>((resolve, reject) => {
        const readyState = priority === 'current'
          ? HTMLMediaElement.HAVE_CURRENT_DATA
          : HTMLMediaElement.HAVE_METADATA
        const readyEvent = priority === 'current' ? 'loadeddata' : 'loadedmetadata'
        if (
          layerSourcesRef.current[layer] === url
          && video.readyState >= readyState
        ) {
          resolve()
          return
        }
        const cleanup = () => {
          video.removeEventListener(readyEvent, onReady)
          video.removeEventListener('error', onError)
        }
        const onReady = () => {
          cleanup()
          resolve()
        }
        const onError = () => {
          cleanup()
          reject(new Error(`Unable to preload distractor video: ${url}`))
        }
        video.pause()
        video.preload = priority === 'current' ? 'auto' : 'metadata'
        video.addEventListener(readyEvent, onReady, { once: true })
        video.addEventListener('error', onError, { once: true })
        video.src = url
        layerSourcesRef.current[layer] = url
        video.load()
      })

    const reveal = async () => {
      await prepare(nextVideo, nextIndex, src, 'current')
      if (sequence !== switchSequenceRef.current) return
      try {
        nextVideo.currentTime = 0
        await nextVideo.play()
      } catch {
        return
      }
      if (sequence !== switchSequenceRef.current) return
      activeLayerRef.current = nextIndex
      setActiveLayer(nextIndex)
      setVisible(true)
      switchTimer = window.setTimeout(() => {
        if (sequence !== switchSequenceRef.current) return
        previousVideo.pause()
        if (nextSrc && nextSrc !== src) {
          void prepare(previousVideo, previousIndex, nextSrc, 'next').catch(() => undefined)
        }
      }, transitionMs + 40)
    }

    void reveal().catch(() => undefined)

    return () => {
      window.clearTimeout(switchTimer)
    }
  }, [nextSrc, src, transitionMs])

  const layerClass = (layer: VideoLayer) =>
    `pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity ${
      visible && activeLayer === layer ? 'opacity-100' : 'opacity-0'
    }`

  return <>
    <video
      ref={videoARef}
      data-video-layer="A"
      data-active={visible && activeLayer === 0}
      muted
      playsInline
      preload="metadata"
      aria-hidden="true"
      className={layerClass(0)}
      style={{ transitionDuration: `${transitionMs}ms` }}
    />
    <video
      ref={videoBRef}
      data-video-layer="B"
      data-active={visible && activeLayer === 1}
      muted
      playsInline
      preload="metadata"
      aria-hidden="true"
      className={layerClass(1)}
      style={{ transitionDuration: `${transitionMs}ms` }}
    />
  </>
}
