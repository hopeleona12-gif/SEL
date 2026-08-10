export function speakChinese(text: string): Promise<void> {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    return Promise.resolve()
  }

  return new Promise(resolve => {
    const utterance = new SpeechSynthesisUtterance(text)
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.clearTimeout(fallbackTimer)
      resolve()
    }
    const fallbackTimer = window.setTimeout(finish, 10000)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.9
    utterance.pitch = 1.1
    utterance.onend = finish
    utterance.onerror = finish
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  })
}

export function playNarration(url: string | undefined, fallbackText: string): Promise<void> {
  if (!url) return speakChinese(fallbackText)

  return new Promise(resolve => {
    const audio = new Audio(url)
    let settled = false
    let fallbackStarted = false
    const cleanup = () => {
      audio.removeEventListener('ended', finish)
      audio.removeEventListener('error', fallback)
    }
    const finish = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }
    const fallback = () => {
      if (fallbackStarted || settled) return
      fallbackStarted = true
      cleanup()
      void speakChinese(fallbackText).then(finish)
    }
    audio.preload = 'auto'
    audio.addEventListener('ended', finish, { once: true })
    audio.addEventListener('error', fallback, { once: true })
    audio.play().catch(fallback)
  })
}
