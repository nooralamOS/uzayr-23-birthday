import { useEffect, useState } from 'react'

// Fades in once Satisfy has loaded, so the greeting never flashes in a fallback font.
export default function Title({ text }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const show = () => !cancelled && setReady(true)
    document.fonts?.load('32px Satisfy', text).then(show, show) ?? show()
    const timeout = setTimeout(show, 1500)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [text])

  return (
    <h1 className="title" data-ready={ready || undefined}>
      {text}
    </h1>
  )
}
