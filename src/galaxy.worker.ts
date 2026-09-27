type Star = { x: number; y: number; z: number; size: number; speed: number; alpha: number; hue: number; twinkle: number }

type GalaxyMessage =
  | { type: 'init'; canvas: OffscreenCanvas; reduced: boolean }
  | { type: 'resize'; width: number; height: number; ratio: number }
  | { type: 'pointer'; x: number; y: number }
  | { type: 'visible'; value: boolean }

let canvas: OffscreenCanvas | undefined
let context: OffscreenCanvasRenderingContext2D | null = null
let reduced = false
let visible = true
let frame = 0
let width = 0
let height = 0
let time = 0
let pointerX = 0
let pointerY = 0
let targetPointerX = 0
let targetPointerY = 0
let stars: Star[] = []

const createStar = (): Star => ({
  x: (Math.random() - 0.5) * width * 1.8,
  y: (Math.random() - 0.5) * height * 1.8,
  z: 0.14 + Math.random() * 0.86,
  size: 0.35 + Math.pow(Math.random(), 3) * 2.2,
  speed: 0.000018 + Math.random() * 0.000026,
  alpha: 0.22 + Math.random() * 0.78,
  hue: 190 + Math.random() * 95,
  twinkle: Math.random() * Math.PI * 2,
})

function resize(nextWidth: number, nextHeight: number, ratio: number) {
  if (!canvas || !context) return
  const previousWidth = width
  const previousHeight = height
  width = nextWidth
  height = nextHeight
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  context.setTransform(ratio, 0, 0, ratio, 0, 0)

  const count = Math.min(450, Math.max(180, Math.floor((width * height) / 3600)))
  if (stars.length === 0) stars = Array.from({ length: count }, createStar)
  else {
    const scaleX = previousWidth > 0 ? width / previousWidth : 1
    const scaleY = previousHeight > 0 ? height / previousHeight : 1
    for (const star of stars) {
      star.x *= scaleX
      star.y *= scaleY
    }
    if (stars.length < count) stars.push(...Array.from({ length: count - stars.length }, createStar))
    else if (stars.length > count) stars.length = count
  }
}

function draw(timestamp: number) {
  if (!context || width === 0 || height === 0) return
  context.clearRect(0, 0, width, height)
  const delta = time ? Math.min(timestamp - time, 32) : 16
  time = timestamp
  pointerX += (targetPointerX - pointerX) * 0.035
  pointerY += (targetPointerY - pointerY) * 0.035

  const centerX = width * 0.5 + pointerX * 8
  const centerY = height * 0.5 + pointerY * 6
  for (const star of stars) {
    if (!reduced) {
      star.z -= star.speed * delta
      if (star.z <= 0.08) {
        star.x = (Math.random() - 0.5) * width * 1.8
        star.y = (Math.random() - 0.5) * height * 1.8
        star.z = 1
      }
    }
    const depth = 1 / Math.max(star.z, 0.08)
    const x = centerX + star.x * depth * 0.52
    const y = centerY + star.y * depth * 0.52
    if (x < -24 || x > width + 24 || y < -24 || y > height + 24) {
      if (!reduced) star.z = 1
      continue
    }
    const pulse = reduced ? 1 : 0.72 + Math.sin(timestamp * 0.0018 + star.twinkle) * 0.28
    const radius = star.size * pulse * Math.min(depth, 3.4)
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fillStyle = `hsla(${star.hue}, 80%, 90%, ${star.alpha * pulse})`
    context.fill()
  }

  if (!reduced && visible) frame = requestAnimationFrame(draw)
}

function start() {
  if (!context || width === 0 || height === 0) return
  cancelAnimationFrame(frame)
  time = 0
  if (reduced) draw(performance.now())
  else if (visible) frame = requestAnimationFrame(draw)
}

self.onmessage = (event: MessageEvent<GalaxyMessage>) => {
  const message = event.data
  if (message.type === 'init') {
    canvas = message.canvas
    context = canvas.getContext('2d')
    reduced = message.reduced
    return
  }
  if (message.type === 'resize') {
    resize(message.width, message.height, message.ratio)
    start()
    return
  }
  if (message.type === 'pointer') {
    targetPointerX = message.x / Math.max(width, 1) - 0.5
    targetPointerY = message.y / Math.max(height, 1) - 0.5
    return
  }
  visible = message.value
  if (visible) start()
  else cancelAnimationFrame(frame)
}

