import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { createStreamPlayer, type StreamPlayerHandle, type StreamPlayerPublicState } from './sdk'

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

const PLAYER_CAPTIONS = [
  { label: '한국어', srclang: 'ko', src: '/captions/demo.ko.vtt', default: true },
  { label: 'English', srclang: 'en', src: '/captions/demo.en.vtt' },
  { label: '日本語', srclang: 'ja', src: '/captions/demo.ja.vtt' },
]

const SHORTCUTS = ['Space/K: 재생', '←/→: 5초 이동', 'M: 음소거', 'F: 전체화면']
const INITIAL_PLAYBACK_TIME = '00:00 / 00:00'
const INITIAL_STREAM_URL = DEMO_STREAMS[0].url

type PlayerStatus =
  | { type: 'ready' }
  | { type: 'loading' }
  | { type: 'playing' }
  | { type: 'paused' }
  | { type: 'error'; message: string }

function toTimeText(seconds: number) {
  if (!Number.isFinite(seconds)) return '00:00'
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(Math.floor(seconds % 60)).padStart(2, '0')
  return `${mm}:${ss}`
}

function toPlaybackTimeText(state: Pick<StreamPlayerPublicState, 'currentTime' | 'duration'>) {
  return `${toTimeText(state.currentTime)} / ${toTimeText(state.duration)}`
}

function toStatusText(status: PlayerStatus) {
  if (status.type === 'error') {
    return `error: ${status.message}`
  }
  return status.type
}

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<StreamPlayerHandle | null>(null)
  const pendingLoadIdRef = useRef(0)
  const isLoadingRef = useRef(false)

  const [streamUrl, setStreamUrl] = useState(INITIAL_STREAM_URL)
  const [status, setStatus] = useState<PlayerStatus>({ type: 'ready' })
  const [time, setTime] = useState(INITIAL_PLAYBACK_TIME)

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const player = createStreamPlayer({
      container: containerRef.current,
      source: INITIAL_STREAM_URL,
      captions: PLAYER_CAPTIONS,
      autoplay: false,
      muted: false,
      controlsAutoHideMs: 1800,
      title: 'Stream-Style HLS Player',
      themeColor: '#f97316',
    })

    playerRef.current = player

    const setPlaybackStatus = (nextStatus: PlayerStatus) => {
      if (!isLoadingRef.current) {
        setStatus(nextStatus)
      }
    }

    const unready = player.on('ready', () => setPlaybackStatus({ type: 'ready' }))
    const unplay = player.on('play', () => setPlaybackStatus({ type: 'playing' }))
    const unpause = player.on('pause', () => setPlaybackStatus({ type: 'paused' }))
    const unerror = player.on('error', (event) => setStatus({ type: 'error', message: event.message }))
    const untime = player.on('timeupdate', (state) => setTime(toPlaybackTimeText(state)))

    return () => {
      unready()
      unplay()
      unpause()
      unerror()
      untime()
      player.destroy()
      playerRef.current = null
      isLoadingRef.current = false
    }
  }, [])

  const onSubmitStream = async (event: FormEvent) => {
    event.preventDefault()
    if (!playerRef.current) {
      return
    }

    const loadId = pendingLoadIdRef.current + 1
    pendingLoadIdRef.current = loadId
    isLoadingRef.current = true
    setStatus({ type: 'loading' })

    try {
      await playerRef.current.load(streamUrl)
      if (pendingLoadIdRef.current === loadId) {
        setStatus({ type: 'ready' })
      }
    } catch (error) {
      if (pendingLoadIdRef.current === loadId) {
        setStatus({
          type: 'error',
          message: error instanceof Error ? error.message : '스트림을 불러오지 못했습니다.',
        })
      }
    } finally {
      if (pendingLoadIdRef.current === loadId) {
        isLoadingRef.current = false
      }
    }
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
            <p>{toStatusText(status)}</p>
          </div>
          <div>
            <strong>Playback</strong>
            <p>{time}</p>
          </div>
          <div>
            <strong>Keyboard</strong>
            <p>{SHORTCUTS.join(' · ')}</p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
