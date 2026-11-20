import { writeFile } from 'node:fs/promises'

const key = process.env.GEMINI_API_KEY
if (!key) throw new Error('Set GEMINI_API_KEY before generating music.')

const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
  signal: AbortSignal.timeout(360_000),
  body: JSON.stringify({
    model: 'lyria-3.5',
    store: false,
    input: 'Original instrumental 8-bit Japanese school sports festival arcade BGM for a comic riverside hammer-throw game. Jaunty 144 BPM. Square-wave call and response, triangle bass, crunchy noise percussion, and a brief cartoon wobble that snaps back into the groove. Keep the melody light and unobtrusive for repeated play. Clean recurring 16-bar phrases, immediate downbeat, no vocals and no fade.',
  }),
})
if (!response.ok) throw new Error(`Lyria returned HTTP ${response.status}`)

function findAudio(value) {
  if (!value || typeof value !== 'object') return
  if (typeof value.data === 'string' && (value.type === 'audio' || value.mime_type?.startsWith('audio/'))) return value
  for (const child of Object.values(value)) {
    const audio = findAudio(child)
    if (audio) return audio
  }
}

const audio = findAudio(await response.json())
if (!audio) throw new Error('Lyria returned no audio.')
const output = new URL('../src/assets/spring-sports-bgm.mp3', import.meta.url)
await writeFile(output, Buffer.from(audio.data, 'base64'), { flag: 'wx' })
console.log('Saved spring-sports-bgm.mp3')
