import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { asset } from '../asset'

export default function ThumbStrip({ photos, index, onSelect }) {
  const scrollerRef = useRef(null)
  const mountedRef = useRef(false)
  const reduceMotion = useReducedMotion()

  // Keep the selected photo centred in the strip.
  useEffect(() => {
    const scroller = scrollerRef.current
    const thumb = scroller?.children[index]
    if (!thumb) return
    scroller.scrollTo({
      left: thumb.offsetLeft + thumb.offsetWidth / 2 - scroller.clientWidth / 2,
      behavior: mountedRef.current && !reduceMotion ? 'smooth' : 'auto',
    })
    mountedRef.current = true
  }, [index, reduceMotion])

  return (
    <nav className="tray" aria-label="All photos">
      <div className="tray__shelf" aria-hidden="true" />
      <div ref={scrollerRef} className="tray__scroller">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            className="thumb"
            aria-label={`Photo ${i + 1}`}
            aria-current={i === index || undefined}
            onClick={() => onSelect(i)}
          >
            <img src={asset(photo.thumb)} alt="" loading="lazy" decoding="async" draggable={false} />
          </button>
        ))}
      </div>
    </nav>
  )
}
