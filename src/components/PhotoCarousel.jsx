import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { asset } from '../asset'
import { tick } from '../haptics'

const GAP = 37 // px between neighbouring cards
const TILT = 2.6 // degrees a neighbour leans away from the centre
// Quick, with a hint of overshoot so each photo "clicks" into place.
const SNAP = { type: 'spring', stiffness: 420, damping: 32, restDelta: 0.0005, restSpeed: 0.005 }
const SNAP_REDUCED = { type: 'tween', duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }
const TAP_SLOP = 6 // px a finger can wander before a tap turns into a drag
const COMMIT = 0.22 // drag this much of a card to change photo…
const FLICK = 300 // …or flick faster than this (px/s)

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// iOS-style resistance when dragging past the first/last photo.
const rubberBand = (value, min, max) => {
  const resist = (over) => 1 - 1 / (over * 0.55 + 1)
  if (value < min) return min - resist(min - value)
  if (value > max) return max + resist(value - max)
  return value
}

const releaseVelocity = (samples, now) => {
  const recent = samples.filter((s) => now - s.t < 100)
  if (recent.length < 2) return 0
  const first = recent[0]
  const last = recent[recent.length - 1]
  const dt = last.t - first.t
  return dt > 0 ? ((last.x - first.x) / dt) * 1000 : 0
}

const isCached = (src) => {
  const img = new Image()
  img.src = src
  return img.complete && img.naturalWidth > 0
}

export default function PhotoCarousel({ photos, onIndexChange, ref }) {
  const count = photos.length
  const [index, setIndex] = useState(0)
  // On a long jump (tapping a far-away thumbnail) the current photo is redrawn as a "ghost"
  // right beside the destination, so the two slide past each other like neighbours.
  const [ghost, setGhost] = useState(null)
  const reduceMotion = useReducedMotion()

  const pos = useMotionValue(0) // fractional index sitting in the centre
  const pitch = useMotionValue(0) // card width + gap, in px
  const stageRef = useRef(null)
  const indexRef = useRef(0)
  const ghostRef = useRef(null)
  const animationRef = useRef(null)
  const jumpRef = useRef(0)
  const dragRef = useRef(null)
  const goToRef = useRef(null)

  useLayoutEffect(() => {
    const stage = stageRef.current
    const measure = () => {
      const card = stage.querySelector('.card')
      if (card) pitch.set(card.offsetWidth + GAP)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [pitch])

  const settle = (target, velocity = 0, onComplete) => {
    animationRef.current?.stop()
    animationRef.current = animate(pos, target, {
      ...(reduceMotion ? SNAP_REDUCED : { ...SNAP, velocity }),
      onComplete,
    })
  }

  const select = (target) => {
    if (target === indexRef.current) return false
    indexRef.current = target
    setIndex(target)
    onIndexChange?.(target)
    return true
  }

  const clearGhost = () => {
    if (!ghostRef.current) return
    animationRef.current?.stop()
    pos.jump(indexRef.current)
    ghostRef.current = null
    flushSync(() => setGhost(null))
  }

  const goTo = (requested, velocity = 0) => {
    clearGhost()
    const target = clamp(requested, 0, count - 1)
    const current = pos.get()
    const from = Math.round(current)
    const distance = target - from
    let changed = false

    if (Math.abs(distance) <= 1) {
      changed = select(target)
      settle(target, velocity)
    } else if (reduceMotion) {
      flushSync(() => {
        changed = select(target)
      })
      animationRef.current?.stop()
      pos.jump(target)
    } else {
      const slot = target - Math.sign(distance)
      const jump = ++jumpRef.current
      ghostRef.current = { slot, photo: from }
      flushSync(() => {
        setGhost(ghostRef.current)
        changed = select(target)
      })
      pos.jump(slot + (current - from))
      settle(target, 0, () => {
        if (jumpRef.current !== jump) return
        ghostRef.current = null
        setGhost(null)
      })
    }

    if (changed) tick()
  }

  useLayoutEffect(() => {
    goToRef.current = goTo
  })

  useImperativeHandle(ref, () => ({ goTo: (i) => goToRef.current(i) }), [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.altKey || e.metaKey || e.ctrlKey) return
      if (e.key === 'ArrowRight') goToRef.current(indexRef.current + 1)
      if (e.key === 'ArrowLeft') goToRef.current(indexRef.current - 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const onPointerDown = (e) => {
    if (dragRef.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    clearGhost()
    animationRef.current?.stop()
    dragRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      startPos: pos.get(),
      dragging: false,
      samples: [{ t: e.timeStamp, x: e.clientX }],
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.id) return
    const dx = e.clientX - drag.startX
    if (!drag.dragging) {
      if (Math.abs(dx) < TAP_SLOP) return
      drag.dragging = true
    }
    drag.samples.push({ t: e.timeStamp, x: e.clientX })
    if (drag.samples.length > 12) drag.samples.shift()
    pos.set(rubberBand(drag.startPos - dx / pitch.get(), 0, count - 1))
  }

  const onPointerUp = (e) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.id) return
    dragRef.current = null

    if (!drag.dragging) {
      // Tapping either side of the centre card goes to that neighbour.
      const rect = stageRef.current.getBoundingClientRect()
      const centre = rect.left + rect.width / 2
      const half = (pitch.get() - GAP) / 2
      if (e.clientX < centre - half) goTo(indexRef.current - 1)
      else if (e.clientX > centre + half) goTo(indexRef.current + 1)
      else settle(indexRef.current) // finish a snap the touch interrupted
      return
    }

    const width = pitch.get()
    const dx = e.clientX - drag.startX
    const velocity = releaseVelocity(drag.samples, e.timeStamp)
    const base = Math.round(drag.startPos)
    let target = base
    if (Math.abs(velocity) > FLICK) target = base - Math.sign(velocity)
    else if (Math.abs(dx) > width * COMMIT) target = base - Math.sign(dx)
    goTo(target, -velocity / width)
  }

  const onPointerCancel = (e) => {
    if (dragRef.current?.id !== e.pointerId) return
    dragRef.current = null
    settle(indexRef.current)
  }

  const slots = []
  for (let i = Math.max(0, index - 2); i <= Math.min(count - 1, index + 2); i++) slots.push(i)

  return (
    <section
      ref={stageRef}
      className="stage"
      aria-roledescription="carousel"
      aria-label="Birthday photos"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className="stage__track">
        {slots.map((i) => (
          <Card
            key={photos[i].id}
            photo={photos[i]}
            slot={i}
            pos={pos}
            pitch={pitch}
            label={`Photo ${i + 1} of ${count}`}
            hidden={i !== index}
          />
        ))}
        {ghost && (
          <Card
            key={`ghost-${ghost.slot}-${ghost.photo}`}
            photo={photos[ghost.photo]}
            slot={ghost.slot}
            pos={pos}
            pitch={pitch}
            hidden
            ghost
          />
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        Photo {index + 1} of {count}
      </p>
    </section>
  )
}

function Card({ photo, slot, pos, pitch, label, hidden, ghost = false }) {
  const x = useTransform(() => (slot - pos.get()) * pitch.get())
  const rotate = useTransform(() => clamp((slot - pos.get()) * TILT, -2 * TILT, 2 * TILT))

  return (
    <motion.div
      className={ghost ? 'card card--ghost' : 'card'}
      style={{ x, rotate }}
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      aria-hidden={hidden || undefined}
    >
      <Photo photo={photo} instant={ghost} />
    </motion.div>
  )
}

function Photo({ photo, instant }) {
  const src = asset(photo.full)
  const [loaded, setLoaded] = useState(() => instant || isCached(src))

  return (
    <div className="photo" style={{ '--ar': photo.width / photo.height }}>
      <img className="photo__placeholder" src={photo.placeholder} alt="" draggable={false} />
      <img
        className="photo__img"
        src={src}
        alt=""
        draggable={false}
        decoding="async"
        data-loaded={loaded || undefined}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}
