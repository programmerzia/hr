type Tick = (now: Date) => void

const listeners = new Set<Tick>()
let timer: number | null = null

function start() {
  if (timer !== null) return
  timer = window.setInterval(() => {
    const now = new Date()
    listeners.forEach((fn) => fn(now))
  }, 1000)
}

function stop() {
  if (timer === null) return
  window.clearInterval(timer)
  timer = null
}

/** The single 1s interval for the whole app. Returns an unsubscribe function. */
export function onTick(fn: Tick): () => void {
  listeners.add(fn)
  start()
  return () => {
    listeners.delete(fn)
    if (listeners.size === 0) stop()
  }
}
