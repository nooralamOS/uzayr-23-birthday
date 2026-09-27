import { useEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { asset } from '../asset'
import { songInfo } from '../config'

const PILL_WIDTH = 142
const TAB_WIDTH = 38 // how much of the pill peeks in from the edge when tucked away
const EDGE = 12 // gap to the screen edge when pulled out
const CLOSED_X = PILL_WIDTH + EDGE - TAB_WIDTH
const SPRING = { type: 'spring', stiffness: 520, damping: 40 }

// Resting heights from the mockup, plus where each bar swings to while the song plays.
const BARS = [
  { rest: 0.48, peak: 0.95, dur: 430, delay: 0 },
  { rest: 1, peak: 0.35, dur: 560, delay: 120 },
  { rest: 0.61, peak: 1, dur: 380, delay: 60 },
  { rest: 1, peak: 0.45, dur: 610, delay: 200 },
  { rest: 1, peak: 0.3, dur: 470, delay: 30 },
  { rest: 0.61, peak: 1, dur: 520, delay: 160 },
  { rest: 1, peak: 0.4, dur: 400, delay: 90 },
  { rest: 0.48, peak: 0.9, dur: 580, delay: 10 },
]

export default function MusicPlayer({ song }) {
  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [coverFailed, setCoverFailed] = useState(false)
  const reduceMotion = useReducedMotion()
  const x = useMotionValue(CLOSED_X)
  const tabOpacity = useTransform(x, [CLOSED_X * 0.55, CLOSED_X], [0, 1])
  const bodyOpacity = useTransform(x, [0, CLOSED_X * 0.75], [1, 0])
  const pillRef = useRef(null)
  const audioRef = useRef(null)
  const draggedRef = useRef(false)

  const slide = (nextOpen, velocity = 0) => {
    setOpen(nextOpen)
    animate(x, nextOpen ? 0 : CLOSED_X, reduceMotion ? { duration: 0.15 } : { ...SPRING, velocity })
  }
  const slideRef = useRef(slide)
  useEffect(() => {
    slideRef.current = slide
  })

  // Tap anywhere else (or press Escape) to tuck the player away again.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (!pillRef.current?.contains(e.target)) slideRef.current(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') slideRef.current(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Follow the audio element itself, so lock-screen controls keep the button in sync.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [])

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused) {
      audio.pause()
      return
    }
    try {
      await audio.play()
      if ('mediaSession' in navigator && song.cover) {
        navigator.mediaSession.metadata = new MediaMetadata({
          ...songInfo,
          artwork: [
            { src: new URL(asset(song.cover), location.href).href, sizes: '512x512', type: 'image/jpeg' },
          ],
        })
      }
    } catch (error) {
      console.warn('Could not play the song', error)
    }
  }

  return (
    <motion.div
      ref={pillRef}
      className="player"
      style={{ x }}
      drag="x"
      dragConstraints={{ left: 0, right: CLOSED_X }}
      dragElastic={0.08}
      dragMomentum={false}
      onPointerDownCapture={() => {
        draggedRef.current = false
      }}
      onDragStart={() => {
        draggedRef.current = true
      }}
      onDragEnd={(e, info) => {
        const v = info.velocity.x
        slide(Math.abs(v) > 200 ? v < 0 : x.get() < CLOSED_X / 2, v)
      }}
    >
      <motion.button
        type="button"
        className="player__tab"
        style={{ opacity: tabOpacity }}
        aria-label="Show music player"
        aria-expanded={open}
        aria-controls="player-body"
        tabIndex={open ? -1 : 0}
        onClick={() => !draggedRef.current && slide(true)}
      >
        <Chevron />
      </motion.button>

      <motion.div id="player-body" className="player__body" style={{ opacity: bodyOpacity }} inert={!open}>
        <div className="player__art">
          {song.cover && !coverFailed ? (
            <img
              className="player__cover"
              src={asset(song.cover)}
              alt=""
              draggable={false}
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <span className="player__cover" />
          )}
          <div className="wave" data-playing={playing || undefined} aria-hidden="true">
            {BARS.map((bar, i) => (
              <span
                key={i}
                style={{
                  '--rest': bar.rest,
                  '--peak': bar.peak,
                  '--dur': `${bar.dur}ms`,
                  '--delay': `${bar.delay}ms`,
                }}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          className="player__play"
          aria-label={song.src ? (playing ? 'Pause song' : 'Play song') : 'Song not added yet'}
          disabled={!song.src}
          onClick={() => !draggedRef.current && toggle()}
        >
          <PlayPauseIcon playing={playing} />
        </button>
      </motion.div>

      {song.src && <audio ref={audioRef} src={asset(song.src)} loop preload="metadata" />}
    </motion.div>
  )
}

function Chevron() {
  return (
    <svg className="chevron" viewBox="0 0 16 26" width="16" height="26" aria-hidden="true">
      <defs>
        {/* Inner shadow along the top edge, for the engraved look */}
        <filter id="engrave" x="-40%" y="-40%" width="180%" height="180%">
          <feComponentTransfer in="SourceAlpha" result="inverse">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>
          <feOffset in="inverse" dy="1.1" result="shifted" />
          <feGaussianBlur in="shifted" stdDeviation="0.7" result="blurred" />
          <feFlood floodColor="#3a1340" floodOpacity="0.5" />
          <feComposite operator="in" in2="blurred" />
          <feComposite operator="in" in2="SourceAlpha" result="inner" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="inner" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M12.9 3.6 2.9 13l10 9.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#engrave)"
      />
    </svg>
  )
}

function PlayPauseIcon({ playing }) {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeWidth="3" />
      <path
        className="icon icon--play"
        data-shown={!playing || undefined}
        d="M13 10.6v10.8c0 .9 1 1.4 1.7.9l8-5.4c.6-.4.6-1.4 0-1.8l-8-5.4c-.7-.5-1.7 0-1.7.9Z"
      />
      <g className="icon icon--pause" data-shown={playing || undefined}>
        <rect x="11" y="10" width="3.6" height="12" rx="1.2" />
        <rect x="17.4" y="10" width="3.6" height="12" rx="1.2" />
      </g>
    </svg>
  )
}
