// Turns the originals in /pictures and /music into web-ready files + src/media.json.
// Runs automatically before `npm run dev` / `npm run build` (and via `npm run media`).
// Unchanged photos are skipped, so re-runs are quick.
//
// pictures/  any .png/.jpg/.webp — ordered by the number in the filename (1.png, 2.png, …)
// music/     one audio file (.mp3/.m4a) + one square cover image

import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const picturesDir = path.join(root, 'pictures')
const musicDir = path.join(root, 'music')
const photosOut = path.join(root, 'public', 'photos')
const audioOut = path.join(root, 'public', 'audio')
const manifestPath = path.join(root, 'src', 'media.json')
const cachePath = path.join(root, 'node_modules', '.cache', 'media.json')

// Big enough for a ~310px-wide card on a 3x phone screen.
const FULL = { width: 960, height: 1400, quality: 80 }
// Thumbs render at ~80px, so 240px covers 3x screens.
const THUMB = { size: 240, quality: 72 }

const IMAGE = /\.(png|jpe?g|webp|avif|heic)$/i
const AUDIO = /\.(mp3|m4a|aac|ogg|wav)$/i

const list = async (dir, pattern) =>
  existsSync(dir)
    ? (await readdir(dir))
        .filter((f) => pattern.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : []

const fingerprint = async (file) => {
  const { size, mtimeMs } = await stat(file)
  return `${path.basename(file)}:${size}:${mtimeMs}`
}

const cache = existsSync(cachePath) ? JSON.parse(await readFile(cachePath, 'utf8')) : {}
const nextCache = {}

// ---------- photos ----------

await mkdir(path.join(photosOut, 'full'), { recursive: true })
await mkdir(path.join(photosOut, 'thumb'), { recursive: true })

const photos = []
let processed = 0

for (const [i, file] of (await list(picturesDir, IMAGE)).entries()) {
  const id = String(i + 1)
  const src = path.join(picturesDir, file)
  const fullPath = path.join(photosOut, 'full', `${id}.webp`)
  const thumbPath = path.join(photosOut, 'thumb', `${id}.webp`)
  const key = await fingerprint(src)

  const cached = cache[`photo:${id}`]
  if (cached?.key === key && existsSync(fullPath) && existsSync(thumbPath)) {
    photos.push(cached.entry)
    nextCache[`photo:${id}`] = cached
    continue
  }

  const input = sharp(src).rotate()
  const full = await input
    .clone()
    .resize({ width: FULL.width, height: FULL.height, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: FULL.quality })
    .toFile(fullPath)
  await input
    .clone()
    .resize({ width: THUMB.size, height: THUMB.size, fit: 'cover', position: 'attention' })
    .webp({ quality: THUMB.quality })
    .toFile(thumbPath)
  // Tiny pre-blurred preview that shows while the real photo loads.
  const tiny = await input.clone().resize({ width: 32 }).blur(1.2).webp({ quality: 45 }).toBuffer()

  const entry = {
    id,
    full: `photos/full/${id}.webp`,
    thumb: `photos/thumb/${id}.webp`,
    width: full.width,
    height: full.height,
    placeholder: `data:image/webp;base64,${tiny.toString('base64')}`,
  }
  photos.push(entry)
  nextCache[`photo:${id}`] = { key, entry }
  processed++
  console.log(`  ${file} → photos/full/${id}.webp (${full.width}×${full.height}, ${Math.round(full.size / 1024)} KB)`)
}

// Drop outputs left behind by photos that were removed.
for (const dir of ['full', 'thumb']) {
  for (const f of await readdir(path.join(photosOut, dir))) {
    if (Number.parseInt(f, 10) > photos.length) await rm(path.join(photosOut, dir, f))
  }
}

console.log(`photos: ${photos.length} (${processed} updated)`)

// ---------- music ----------

await mkdir(audioOut, { recursive: true })

const song = { src: null, cover: null }
const [audioFile] = await list(musicDir, AUDIO)
const [coverFile] = await list(musicDir, IMAGE)

if (audioFile) {
  const src = path.join(musicDir, audioFile)
  const { size } = await stat(src)
  if (size === 0) {
    console.warn(`⚠︎ music/${audioFile} is empty (0 bytes), so the play button stays disabled. Re-download the song.`)
  } else {
    const name = `song${path.extname(audioFile).toLowerCase()}`
    const key = await fingerprint(src)
    if (cache.audio?.key !== key || !existsSync(path.join(audioOut, name))) {
      await copyFile(src, path.join(audioOut, name))
    }
    nextCache.audio = { key }
    song.src = `audio/${name}`
    console.log(`song: music/${audioFile} → public/${song.src} (${(size / 1024 / 1024).toFixed(1)} MB)`)
  }
} else {
  console.warn('⚠︎ no song found in music/, so the play button stays disabled.')
}

if (coverFile) {
  const src = path.join(musicDir, coverFile)
  const out = path.join(audioOut, 'cover.jpg')
  const key = await fingerprint(src)
  if (cache.cover?.key !== key || !existsSync(out)) {
    await sharp(src).rotate().resize(512, 512, { fit: 'cover' }).flatten({ background: '#000' }).jpeg({ quality: 82 }).toFile(out)
  }
  nextCache.cover = { key }
  song.cover = 'audio/cover.jpg'
  console.log(`cover: music/${coverFile} → public/${song.cover}`)
}

// ---------- write ----------

await mkdir(path.dirname(manifestPath), { recursive: true })
const manifest = JSON.stringify({ song, photos }, null, 2) + '\n'
const previous = existsSync(manifestPath) ? await readFile(manifestPath, 'utf8') : ''
// Only touch the manifest when it changes, so the dev server doesn't reload for nothing.
if (manifest !== previous) await writeFile(manifestPath, manifest)

await mkdir(path.dirname(cachePath), { recursive: true })
await writeFile(cachePath, JSON.stringify(nextCache))
