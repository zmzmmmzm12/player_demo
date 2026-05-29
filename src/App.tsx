import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { createStreamPlayer, type StreamPlayerHandle } from './sdk'

const DEMO_STREAMS = [
  {
    label: 'Mux Test Stream',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    label: 'Sintel HLS',
    url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
  },
  {
    label: 'Big Buck Bunny HLS',
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
  },
]

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<StreamPlayerHandle | null>(null)

  const [streamUrl, setStreamUrl] = useState(DEMO_STREAMS[0].url)
  const [status, setStatus] = useState('ready')
  const [time, setTime] = useState('00:00 / 00:00')

  const shortcuts = useMemo(
    () => ['Space/K: 재생', '←/→: 5초 이동', 'M: 음소거', 'F: 전체화면'],
    [],
  )

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const player = createStreamPlayer({
      container: containerRef.current,
      source: streamUrl,
      captions: [
        { label: '한국어', srclang: 'ko', src: '/captions/demo.ko.vtt', default: true },
        { label: 'English', srclang: 'en', src: '/captions/demo.en.vtt' },
        { label: '日本語', srclang: 'ja', src: '/captions/demo.ja.vtt' },
      ],
      autoplay: false,
      muted: false,
      controlsAutoHideMs: 1800,
      title: 'Stream-Style HLS Player',
      themeColor: '#f97316',
    })

    playerRef.current = player

    const unready = player.on('ready', () => setStatus('ready'))
    const unplay = player.on('play', () => setStatus('playing'))
    const unpause = player.on('pause', () => setStatus('paused'))
    const unerror = player.on('error', (event) => setStatus(`error: ${event.message}`))
    const untime = player.on('timeupdate', (state) => {
      const toText = (seconds: number) => {
        if (!Number.isFinite(seconds)) return '00:00'
        const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
        const ss = String(Math.floor(seconds % 60)).padStart(2, '0')
        return `${mm}:${ss}`
      }
      setTime(`${toText(state.currentTime)} / ${toText(state.duration)}`)
    })

    return () => {
      unready()
      unplay()
      unpause()
      unerror()
      untime()
      player.destroy()
      playerRef.current = null
    }
  }, [])

  const onSubmitStream = async (event: FormEvent) => {
    event.preventDefault()
    if (!playerRef.current) {
      return
    }

    setStatus('loading')
    await playerRef.current.load(streamUrl)
    setStatus('ready')
  }

  return (
    <main className="page">
      <section className="panel panel--hero">
        <h1>Portable HLS Player SDK</h1>
        <p>
          빌드된 JS 파일을 다른 프로젝트에서 불러서 그대로 쓰는 방식으로 제작한 커스텀 플레이어 데모입니다.
        </p>
        <form className="stream-form" onSubmit={onSubmitStream}>
          <select
            value={streamUrl}
            onChange={(event) => setStreamUrl(event.target.value)}
            aria-label="Preset stream list"
          >
            {DEMO_STREAMS.map((item) => (
              <option key={item.url} value={item.url}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            type="url"
            value={streamUrl}
            onChange={(event) => setStreamUrl(event.target.value)}
            placeholder="https://...m3u8"
            required
          />
          <button type="submit">Load Stream</button>
        </form>
      </section>

      <section className="panel panel--player">
        <div ref={containerRef} className="player-stage" />
        <div className="meta-grid">
          <div>
            <strong>Status</strong>
            <p>{status}</p>
          </div>
          <div>
            <strong>Playback</strong>
            <p>{time}</p>
          </div>
          <div>
            <strong>Keyboard</strong>
            <p>{shortcuts.join(' · ')}</p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
