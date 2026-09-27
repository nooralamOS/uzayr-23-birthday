import { useRef, useState } from 'react'
import media from './media.json'
import { greeting } from './config'
import Title from './components/Title.jsx'
import MusicPlayer from './components/MusicPlayer.jsx'
import PhotoCarousel from './components/PhotoCarousel.jsx'
import ThumbStrip from './components/ThumbStrip.jsx'

export default function App() {
  const [index, setIndex] = useState(0)
  const carouselRef = useRef(null)

  return (
    <main className="app">
      <header className="header">
        <Title text={greeting} />
        <MusicPlayer song={media.song} />
      </header>
      <PhotoCarousel ref={carouselRef} photos={media.photos} onIndexChange={setIndex} />
      <ThumbStrip photos={media.photos} index={index} onSelect={(i) => carouselRef.current?.goTo(i)} />
    </main>
  )
}
