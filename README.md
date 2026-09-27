# Happy Birthday Uzayr :DD

A mobile photo slideshow: swipe (or tap the neighbouring card) to move between photos, scroll the tray to jump anywhere, and pull out the tab in the top-right corner for the music.

## Run it

```bash
npm install
npm run dev
```

Open the **Network** URL that Vite prints on your phone (same Wi-Fi) to try it on a real device.

## Swapping content

| What | Where |
| --- | --- |
| Photos | `pictures/`, ordered by the number in the filename (`1.png`, `2.png`, …) |
| Song + cover | `music/`, one audio file (`.mp3`/`.m4a`) and one square image |
| Greeting, lock-screen song title | `src/config.js` |

`npm run dev` and `npm run build` automatically turn those originals into web-sized files in `public/` plus `src/media.json`. Only files that changed get reprocessed. You can also run that step on its own with `npm run media`.

## Deploy

```bash
npm run build
```

Upload the `dist/` folder anywhere static (Netlify Drop, Vercel, GitHub Pages). All paths are relative, so it also works from a subfolder.
