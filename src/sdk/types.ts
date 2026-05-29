export type PlayerEvents =
  | 'ready'
  | 'play'
  | 'pause'
  | 'timeupdate'
  | 'ended'
  | 'error'
  | 'qualitychange'
  | 'ratechange'
  | 'captionchange'

export type QualityOption = {
  index: number
  label: string
  bitrate: number
  width?: number
  height?: number
}

export type StreamPlayerSource = {
  src: string
  type?: 'hls' | 'mp4' | 'auto'
}

export type CaptionTrackOption = {
  label: string
  srclang: string
  src: string
  default?: boolean
}

export type StreamPlayerOptions = {
  container: string | HTMLElement
  source: string | StreamPlayerSource
  captions?: CaptionTrackOption[]
  autoplay?: boolean
  muted?: boolean
  loop?: boolean
  poster?: string
  playsInline?: boolean
  title?: string
  controlsAutoHideMs?: number
  startTime?: number
  themeColor?: string
}

export type StreamPlayerPublicState = {
  currentTime: number
  duration: number
  paused: boolean
  muted: boolean
  volume: number
  playbackRate: number
  isFullscreen: boolean
  isPip: boolean
  quality: number | 'auto'
  caption: string | 'off'
}

export type StreamPlayerEventMap = {
  ready: undefined
  play: undefined
  pause: undefined
  timeupdate: StreamPlayerPublicState
  ended: undefined
  error: { message: string; details?: unknown }
  qualitychange: { quality: number | 'auto'; label: string }
  ratechange: { rate: number }
  captionchange: { caption: string | 'off'; label: string }
}

export type StreamPlayerHandle = {
  load: (source: string | StreamPlayerSource) => Promise<void>
  play: () => Promise<void>
  pause: () => void
  togglePlay: () => Promise<void>
  seekTo: (seconds: number) => void
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  setPlaybackRate: (rate: number) => void
  setQuality: (quality: number | 'auto') => void
  setCaptionLanguage: (caption: string | 'off') => void
  getQualityOptions: () => QualityOption[]
  getState: () => StreamPlayerPublicState
  on: <T extends PlayerEvents>(
    event: T,
    handler: (payload: StreamPlayerEventMap[T]) => void,
  ) => () => void
  off: <T extends PlayerEvents>(
    event: T,
    handler: (payload: StreamPlayerEventMap[T]) => void,
  ) => void
  destroy: () => void
}
