import Hls, { Events, type ErrorData, type Level } from 'hls.js'
import { PLAYER_STYLE_ID, PLAYER_STYLES } from './playerStyles'
import type {
  CaptionTrackOption,
  PlayerEvents,
  QualityOption,
  StreamPlayerEventMap,
  StreamPlayerHandle,
  StreamPlayerOptions,
  StreamPlayerPublicState,
  StreamPlayerSource,
} from './types'

type EventHandler<T extends PlayerEvents> = (payload: StreamPlayerEventMap[T]) => void

type Elements = {
  root: HTMLDivElement
  video: HTMLVideoElement
  playBtn: HTMLButtonElement
  muteBtn: HTMLButtonElement
  backwardBtn: HTMLButtonElement
  forwardBtn: HTMLButtonElement
  pipBtn: HTMLButtonElement
  fullscreenBtn: HTMLButtonElement
  timeLabel: HTMLSpanElement
  progressInput: HTMLInputElement
  progressBuffered: HTMLSpanElement
  volumeInput: HTMLInputElement
  speedSelect: HTMLSelectElement
  qualitySelect: HTMLSelectElement
  captionSelect: HTMLSelectElement
  loadingLayer: HTMLDivElement
  errorLayer: HTMLDivElement
  errorMessage: HTMLSpanElement
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]
const CAPTION_LINE_ABOVE_CONTROLS = -4
const CAPTION_LINE_DEFAULT = -1

const SVG = {
  play: '<path d="M8 6.5v19l16-9.5z"/>',
  pause: '<path d="M8 6h6v20H8zm12 0h6v20h-6z"/>',
  volumeOn:
    '<path d="M4 12v8h6l8 6V6l-8 6zm18.5 4a6.5 6.5 0 0 0-3.2-5.6v11.2a6.5 6.5 0 0 0 3.2-5.6z"/>',
  volumeMute:
    '<path d="M4 12v8h6l8 6V6l-8 6z"/><path d="m20 12 8 8m0-8-8 8" stroke="currentColor" stroke-width="2" fill="none"/>',
  forward: '<path d="M6 7.5v17l12-8.5zM18 7.5v17l12-8.5z"/>',
  backward: '<path d="M26 7.5v17l-12-8.5zM14 7.5v17L2 16z"/>',
  pip: '<path d="M4 6h24v20H4z"/><path d="M16 15h10v7H16z" fill="#38bdf8"/>',
  fullscreen:
    '<path d="M6 12V6h6M26 12V6h-6M6 20v6h6M26 20v6h-6" stroke="currentColor" stroke-width="2" fill="none"/>',
  fullscreenExit:
    '<path d="M12 6v6H6M20 6v6h6M12 26v-6H6M20 26v-6h6" stroke="currentColor" stroke-width="2" fill="none"/>',
}

const DEFAULT_OPTIONS: Required<
  Pick<
    StreamPlayerOptions,
    'autoplay' | 'muted' | 'loop' | 'playsInline' | 'controlsAutoHideMs' | 'title' | 'captions'
  >
> = {
  autoplay: false,
  muted: false,
  loop: false,
  playsInline: true,
  controlsAutoHideMs: 2200,
  title: 'Stream HLS Player',
  captions: [],
}

function ensureStylesInjected(): void {
  if (document.getElementById(PLAYER_STYLE_ID)) {
    return
  }
  const style = document.createElement('style')
  style.id = PLAYER_STYLE_ID
  style.textContent = PLAYER_STYLES
  document.head.append(style)
}

function toTimeText(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00'
  }
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function normalizeSource(source: string | StreamPlayerSource): StreamPlayerSource {
  if (typeof source === 'string') {
    return { src: source, type: 'auto' }
  }
  return { type: 'auto', ...source }
}

function guessIsHls(source: StreamPlayerSource): boolean {
  if (source.type === 'hls') {
    return true
  }
  if (source.type === 'mp4') {
    return false
  }
  return /\.m3u8($|\?)/i.test(source.src)
}

function describeLevel(level: Level): string {
  const height = level.height ?? 0
  const bitrate = level.bitrate ? Math.round(level.bitrate / 1000) : 0
  if (height > 0 && bitrate > 0) {
    return `${height}p • ${bitrate}kbps`
  }
  if (height > 0) {
    return `${height}p`
  }
  if (bitrate > 0) {
    return `${bitrate}kbps`
  }
  return 'Unknown'
}

export class StreamHlsPlayer implements StreamPlayerHandle {
  private readonly options: StreamPlayerOptions

  private readonly container: HTMLElement

  private readonly elements: Elements

  private hls: Hls | null = null

  private qualityOptions: QualityOption[] = []

  private captionOptions: CaptionTrackOption[] = []

  private selectedQuality: number | 'auto' = 'auto'

  private selectedCaption: string | 'off' = 'off'

  private previousVolume = 1

  private hideUiTimer: number | null = null

  private destroyed = false

  private readonly listeners = new Map<PlayerEvents, Set<EventHandler<PlayerEvents>>>()

  private readonly teardownStack: Array<() => void> = []

  constructor(options: StreamPlayerOptions) {
    ensureStylesInjected()
    this.options = options
    this.container = this.resolveContainer(options.container)
    this.elements = this.mount()
    this.bindCoreEvents()
    this.captionOptions = [...(options.captions ?? DEFAULT_OPTIONS.captions)]
    this.configureCaptions(this.captionOptions)

    void this.load(options.source).then(() => {
      const startTime = options.startTime ?? 0
      if (startTime > 0) {
        this.seekTo(startTime)
      }
      if (options.autoplay) {
        void this.play()
      }
      this.emit('ready', undefined)
    })
  }

  static create(options: StreamPlayerOptions): StreamHlsPlayer {
    return new StreamHlsPlayer(options)
  }

  async load(sourceInput: string | StreamPlayerSource): Promise<void> {
    this.clearError()
    this.showLoading(true)

    const source = normalizeSource(sourceInput)
    this.teardownHls()

    const { video } = this.elements
    video.pause()
    video.removeAttribute('src')
    video.load()

    const shouldUseHls = guessIsHls(source)
    if (shouldUseHls) {
      await this.attachHlsSource(source.src)
    } else {
      video.src = source.src
    }

    this.setStateFromOptions()
    this.refreshUi()
  }

  async play(): Promise<void> {
    try {
      await this.elements.video.play()
    } catch (error) {
      this.showError('재생을 시작할 수 없습니다.', error)
      throw error
    }
  }

  pause(): void {
    this.elements.video.pause()
  }

  async togglePlay(): Promise<void> {
    if (this.elements.video.paused) {
      await this.play()
      return
    }
    this.pause()
  }

  seekTo(seconds: number): void {
    const { video } = this.elements
    const duration = Number.isFinite(video.duration) ? video.duration : 0
    const next = Math.max(0, Math.min(seconds, duration || Number.MAX_SAFE_INTEGER))
    video.currentTime = next
    this.refreshProgressUi()
  }

  setVolume(volume: number): void {
    const next = Math.max(0, Math.min(volume, 1))
    const { video } = this.elements

    if (next > 0) {
      this.previousVolume = next
      video.muted = false
    } else {
      video.muted = true
    }

    video.volume = next
    this.refreshVolumeUi()
  }

  setMuted(muted: boolean): void {
    const { video } = this.elements

    if (muted) {
      if (video.volume > 0) {
        this.previousVolume = video.volume
      }
      video.muted = true
      video.volume = 0
    } else {
      const restore = this.previousVolume > 0 ? this.previousVolume : 1
      video.muted = false
      video.volume = restore
    }

    this.refreshVolumeUi()
  }

  setPlaybackRate(rate: number): void {
    if (!PLAYBACK_RATES.includes(rate)) {
      return
    }
    this.elements.video.playbackRate = rate
    this.elements.speedSelect.value = String(rate)
    this.emit('ratechange', { rate })
  }

  setQuality(quality: number | 'auto'): void {
    this.selectedQuality = quality
    if (this.hls) {
      this.hls.currentLevel = quality === 'auto' ? -1 : quality
    }
    this.elements.qualitySelect.value = quality === 'auto' ? 'auto' : String(quality)
    const label =
      quality === 'auto'
        ? 'Auto'
        : this.qualityOptions.find((item) => item.index === quality)?.label ?? 'Unknown'
    this.emit('qualitychange', { quality, label })
  }

  setCaptionLanguage(caption: string | 'off'): void {
    this.selectedCaption = caption

    const textTracks = this.elements.video.textTracks
    for (let i = 0; i < textTracks.length; i += 1) {
      const track = textTracks[i]
      track.mode = caption !== 'off' && track.language === caption ? 'showing' : 'disabled'
      if (track.mode === 'showing') {
        this.applyCaptionLine(track, this.getCaptionLineForCurrentUi())
      }
    }

    this.elements.captionSelect.value = caption

    const label =
      caption === 'off'
        ? 'Off'
        : this.captionOptions.find((item) => item.srclang === caption)?.label ?? caption
    this.forceCaptionReflow()
    this.emit('captionchange', { caption, label })
  }

  setCaptions(captions: CaptionTrackOption[], preferredCaption?: string | 'off'): void {
    this.captionOptions = [...captions]
    if (preferredCaption) {
      this.selectedCaption = preferredCaption
    }
    this.configureCaptions(this.captionOptions)
  }

  getQualityOptions(): QualityOption[] {
    return [...this.qualityOptions]
  }

  getState(): StreamPlayerPublicState {
    const { video, root } = this.elements
    return {
      currentTime: video.currentTime,
      duration: video.duration,
      paused: video.paused,
      muted: video.muted,
      volume: video.volume,
      playbackRate: video.playbackRate,
      isFullscreen: Boolean(document.fullscreenElement && root.contains(document.fullscreenElement)),
      isPip: document.pictureInPictureElement === video,
      quality: this.selectedQuality,
      caption: this.selectedCaption,
    }
  }

  on<T extends PlayerEvents>(event: T, handler: (payload: StreamPlayerEventMap[T]) => void): () => void {
    const typed = handler as EventHandler<PlayerEvents>
    const eventSet = this.listeners.get(event) ?? new Set<EventHandler<PlayerEvents>>()
    eventSet.add(typed)
    this.listeners.set(event, eventSet)
    return () => this.off(event, handler)
  }

  off<T extends PlayerEvents>(event: T, handler: (payload: StreamPlayerEventMap[T]) => void): void {
    const typed = handler as EventHandler<PlayerEvents>
    this.listeners.get(event)?.delete(typed)
  }

  destroy(): void {
    if (this.destroyed) {
      return
    }
    this.destroyed = true

    if (this.hideUiTimer) {
      window.clearTimeout(this.hideUiTimer)
      this.hideUiTimer = null
    }

    this.teardownHls()
    this.teardownStack.forEach((dispose) => dispose())
    this.teardownStack.length = 0
    this.container.innerHTML = ''
    this.listeners.clear()
  }

  private emit<T extends PlayerEvents>(event: T, payload: StreamPlayerEventMap[T]): void {
    const eventSet = this.listeners.get(event)
    if (!eventSet) {
      return
    }
    eventSet.forEach((handler) => {
      handler(payload as never)
    })
  }

  private resolveContainer(target: string | HTMLElement): HTMLElement {
    if (typeof target === 'string') {
      const found = document.querySelector<HTMLElement>(target)
      if (!found) {
        throw new Error(`Player container not found: ${target}`)
      }
      return found
    }
    return target
  }

  private mount(): Elements {
    this.container.innerHTML = ''

    const root = document.createElement('div')
    root.className = 'stream-player'
    root.tabIndex = 0
    if (this.options.themeColor) {
      root.style.setProperty('--stream-accent', this.options.themeColor)
    }

    root.innerHTML = `
      <video playsinline preload="metadata"></video>
      <div class="stream-player__overlay-top">
        <div class="stream-player__title"></div>
      </div>
      <div class="stream-player__overlay-bottom">
        <div class="stream-player__controls">
          <div class="stream-progress">
            <span class="stream-progress__buffered"></span>
            <input class="stream-range stream-range--progress" type="range" min="0" max="100" value="0" step="0.1" aria-label="Seek" />
          </div>
          <div class="stream-player__row stream-player__row--compact">
            <div class="stream-player__left">
              <button class="stream-btn stream-btn--play" type="button" aria-label="Play"></button>
              <button class="stream-btn stream-btn--backward" type="button" aria-label="Back 10 seconds"></button>
              <button class="stream-btn stream-btn--forward" type="button" aria-label="Forward 10 seconds"></button>
              <button class="stream-btn stream-btn--mute" type="button" aria-label="Mute"></button>
              <input class="stream-range stream-range--volume" type="range" min="0" max="1" value="1" step="0.05" aria-label="Volume" />
              <span class="stream-time">00:00 / 00:00</span>
            </div>
            <div class="stream-player__right">
              <select class="stream-select stream-select--caption" aria-label="Captions"></select>
              <select class="stream-select stream-select--speed" aria-label="Playback speed"></select>
              <select class="stream-select stream-select--quality" aria-label="Quality"></select>
              <button class="stream-btn stream-btn--pip" type="button" aria-label="Picture in Picture"></button>
              <button class="stream-btn stream-btn--fullscreen" type="button" aria-label="Fullscreen"></button>
            </div>
          </div>
        </div>
      </div>
      <div class="stream-player__loading is-hidden"><div class="stream-spinner" role="status" aria-label="Loading"></div></div>
      <div class="stream-player__error is-hidden">
        <div class="stream-error-box">
          <strong>Playback Error</strong>
          <span></span>
        </div>
      </div>
    `

    this.container.append(root)

    const title = root.querySelector<HTMLDivElement>('.stream-player__title')
    if (title) {
      title.textContent = this.options.title ?? DEFAULT_OPTIONS.title
    }

    const video = root.querySelector<HTMLVideoElement>('video')
    const playBtn = root.querySelector<HTMLButtonElement>('.stream-btn--play')
    const backwardBtn = root.querySelector<HTMLButtonElement>('.stream-btn--backward')
    const forwardBtn = root.querySelector<HTMLButtonElement>('.stream-btn--forward')
    const muteBtn = root.querySelector<HTMLButtonElement>('.stream-btn--mute')
    const pipBtn = root.querySelector<HTMLButtonElement>('.stream-btn--pip')
    const fullscreenBtn = root.querySelector<HTMLButtonElement>('.stream-btn--fullscreen')
    const timeLabel = root.querySelector<HTMLSpanElement>('.stream-time')
    const progressInput = root.querySelector<HTMLInputElement>('.stream-range--progress')
    const progressBuffered = root.querySelector<HTMLSpanElement>('.stream-progress__buffered')
    const volumeInput = root.querySelector<HTMLInputElement>('.stream-range--volume')
    const speedSelect = root.querySelector<HTMLSelectElement>('.stream-select--speed')
    const qualitySelect = root.querySelector<HTMLSelectElement>('.stream-select--quality')
    const captionSelect = root.querySelector<HTMLSelectElement>('.stream-select--caption')
    const loadingLayer = root.querySelector<HTMLDivElement>('.stream-player__loading')
    const errorLayer = root.querySelector<HTMLDivElement>('.stream-player__error')
    const errorMessage = root.querySelector<HTMLSpanElement>('.stream-error-box span')

    if (
      !video ||
      !playBtn ||
      !backwardBtn ||
      !forwardBtn ||
      !muteBtn ||
      !pipBtn ||
      !fullscreenBtn ||
      !timeLabel ||
      !progressInput ||
      !progressBuffered ||
      !volumeInput ||
      !speedSelect ||
      !qualitySelect ||
      !captionSelect ||
      !loadingLayer ||
      !errorLayer ||
      !errorMessage
    ) {
      throw new Error('Player UI mount failed.')
    }

    playBtn.innerHTML = this.makeIcon('play')
    muteBtn.innerHTML = this.makeIcon('volumeOn')
    backwardBtn.innerHTML = this.makeIcon('backward')
    forwardBtn.innerHTML = this.makeIcon('forward')
    pipBtn.innerHTML = this.makeIcon('pip')
    fullscreenBtn.innerHTML = this.makeIcon('fullscreen')

    PLAYBACK_RATES.forEach((rate) => {
      const option = document.createElement('option')
      option.value = String(rate)
      option.textContent = `${rate}x`
      speedSelect.append(option)
    })
    speedSelect.value = '1'

    const autoQualityOption = document.createElement('option')
    autoQualityOption.value = 'auto'
    autoQualityOption.textContent = 'Auto'
    qualitySelect.append(autoQualityOption)

    const offCaptionOption = document.createElement('option')
    offCaptionOption.value = 'off'
    offCaptionOption.textContent = 'CC Off'
    captionSelect.append(offCaptionOption)
    captionSelect.disabled = true

    return {
      root,
      video,
      playBtn,
      muteBtn,
      backwardBtn,
      forwardBtn,
      pipBtn,
      fullscreenBtn,
      timeLabel,
      progressInput,
      progressBuffered,
      volumeInput,
      speedSelect,
      qualitySelect,
      captionSelect,
      loadingLayer,
      errorLayer,
      errorMessage,
    }
  }

  private makeIcon(key: keyof typeof SVG): string {
    return `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">${SVG[key]}</svg>`
  }

  private bindCoreEvents(): void {
    const {
      root,
      video,
      playBtn,
      muteBtn,
      backwardBtn,
      forwardBtn,
      pipBtn,
      fullscreenBtn,
      progressInput,
      volumeInput,
      speedSelect,
      qualitySelect,
      captionSelect,
    } = this.elements

    const on = (target: EventTarget, event: string, handler: EventListener): void => {
      target.addEventListener(event, handler)
      this.teardownStack.push(() => target.removeEventListener(event, handler))
    }

    on(playBtn, 'click', () => {
      void this.togglePlay()
    })

    on(backwardBtn, 'click', () => {
      this.seekTo(video.currentTime - 10)
    })

    on(forwardBtn, 'click', () => {
      this.seekTo(video.currentTime + 10)
    })

    on(muteBtn, 'click', () => {
      const shouldMute = !video.muted || video.volume > 0
      this.setMuted(shouldMute)
    })

    on(volumeInput, 'input', () => {
      this.setVolume(Number(volumeInput.value))
    })

    on(progressInput, 'input', () => {
      const progress = Number(progressInput.value)
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      if (duration <= 0) {
        return
      }
      this.seekTo((progress / 100) * duration)
    })

    on(speedSelect, 'change', () => {
      this.setPlaybackRate(Number(speedSelect.value))
    })

    on(qualitySelect, 'change', () => {
      const next = qualitySelect.value === 'auto' ? 'auto' : Number(qualitySelect.value)
      this.setQuality(next)
    })

    on(captionSelect, 'change', () => {
      this.setCaptionLanguage(captionSelect.value as string | 'off')
    })

    on(pipBtn, 'click', () => {
      void this.togglePictureInPicture()
    })

    on(fullscreenBtn, 'click', () => {
      void this.toggleFullscreen()
    })

    on(video, 'click', () => {
      void this.togglePlay()
    })

    on(video, 'dblclick', () => {
      void this.toggleFullscreen()
    })

    on(video, 'timeupdate', () => {
      this.refreshProgressUi()
      this.refreshVisibleCaptionLine()
      this.emit('timeupdate', this.getState())
    })

    on(video, 'progress', () => {
      this.refreshBufferedUi()
    })

    on(video, 'play', () => {
      this.elements.playBtn.innerHTML = this.makeIcon('pause')
      this.elements.playBtn.setAttribute('aria-label', 'Pause')
      this.startUiHideTimer()
      this.emit('play', undefined)
    })

    on(video, 'pause', () => {
      this.elements.playBtn.innerHTML = this.makeIcon('play')
      this.elements.playBtn.setAttribute('aria-label', 'Play')
      this.cancelUiHideTimer()
      this.setControlsIdle(false)
      this.emit('pause', undefined)
    })

    on(video, 'ended', () => {
      this.setControlsIdle(false)
      this.emit('ended', undefined)
    })

    on(video, 'waiting', () => {
      this.showLoading(true)
    })

    on(video, 'stalled', () => {
      this.showLoading(true)
    })

    on(video, 'canplay', () => {
      this.showLoading(false)
    })

    on(video, 'playing', () => {
      this.showLoading(false)
    })

    on(video, 'loadedmetadata', () => {
      this.refreshProgressUi()
      this.refreshBufferedUi()
    })

    on(video, 'volumechange', () => {
      if (video.volume > 0) {
        this.previousVolume = video.volume
      }
      this.refreshVolumeUi()
    })

    on(video, 'ratechange', () => {
      this.elements.speedSelect.value = String(video.playbackRate)
    })

    on(root, 'mousemove', () => {
      this.setControlsIdle(false)
      this.startUiHideTimer()
    })

    on(root, 'mouseleave', () => {
      this.startUiHideTimer()
    })

    on(root, 'keydown', (rawEvent) => {
      const event = rawEvent as KeyboardEvent
      if (event.key === ' ' || event.key === 'k') {
        event.preventDefault()
        void this.togglePlay()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        this.seekTo(video.currentTime - 5)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        this.seekTo(video.currentTime + 5)
      } else if (event.key === 'm') {
        event.preventDefault()
        const shouldMute = !video.muted || video.volume > 0
        this.setMuted(shouldMute)
      } else if (event.key === 'f') {
        event.preventDefault()
        void this.toggleFullscreen()
      }
    })

    on(document, 'fullscreenchange', () => {
      this.elements.fullscreenBtn.innerHTML = this.makeIcon(
        document.fullscreenElement ? 'fullscreenExit' : 'fullscreen',
      )
    })
  }

  private configureCaptions(tracks: CaptionTrackOption[]): void {
    const { video, captionSelect } = this.elements

    video.querySelectorAll('track').forEach((node) => node.remove())
    captionSelect.innerHTML = ''

    const offOption = document.createElement('option')
    offOption.value = 'off'
    offOption.textContent = 'CC Off'
    captionSelect.append(offOption)

    tracks.forEach((trackDef, index) => {
      const track = document.createElement('track')
      track.kind = 'subtitles'
      track.label = trackDef.label
      track.srclang = trackDef.srclang
      track.src = trackDef.src
      track.default = Boolean(trackDef.default)
      video.append(track)
      const onTrackLoad = (): void => {
        this.applyCaptionLine(track.track, this.getCaptionLineForCurrentUi())

        const textTrack = track.track
        if (textTrack) {
          const onCueChange = (): void => {
            this.applyCaptionLine(textTrack, this.getCaptionLineForCurrentUi())
          }
          textTrack.addEventListener('cuechange', onCueChange)
          this.teardownStack.push(() => textTrack.removeEventListener('cuechange', onCueChange))
        }
      }
      track.addEventListener('load', onTrackLoad)
      this.teardownStack.push(() => track.removeEventListener('load', onTrackLoad))

      const option = document.createElement('option')
      option.value = trackDef.srclang
      option.textContent = `CC ${trackDef.label}`
      captionSelect.append(option)

      if (trackDef.default || (index === 0 && this.selectedCaption === 'off')) {
        this.selectedCaption = trackDef.srclang
      }
    })

    captionSelect.disabled = tracks.length === 0
    this.setCaptionLanguage(tracks.length > 0 ? this.selectedCaption : 'off')
  }

  private applyCaptionLine(track: TextTrack, line: number): void {
    const cues = track.cues
    if (!cues) {
      return
    }

    for (let i = 0; i < cues.length; i += 1) {
      const cue = cues[i]
      if (cue instanceof VTTCue) {
        cue.snapToLines = true
        cue.line = line
      }
    }
  }

  private getCaptionLineForCurrentUi(): number {
    return this.elements.root.classList.contains('is-idle')
      ? CAPTION_LINE_DEFAULT
      : CAPTION_LINE_ABOVE_CONTROLS
  }

  private refreshVisibleCaptionLine(): void {
    const tracks = this.elements.video.textTracks
    const line = this.getCaptionLineForCurrentUi()
    for (let i = 0; i < tracks.length; i += 1) {
      const track = tracks[i]
      if (track.mode === 'showing') {
        this.applyCaptionLine(track, line)
      }
    }
  }

  private forceCaptionReflow(): void {
    const tracks = this.elements.video.textTracks
    for (let i = 0; i < tracks.length; i += 1) {
      const track = tracks[i]
      if (track.mode === 'showing') {
        track.mode = 'hidden'
        track.mode = 'showing'
      }
    }
  }

  private setControlsIdle(isIdle: boolean): void {
    this.elements.root.classList.toggle('is-idle', isIdle)
    this.refreshVisibleCaptionLine()
    this.forceCaptionReflow()
  }

  private async attachHlsSource(src: string): Promise<void> {
    const { video } = this.elements

    if (Hls.isSupported()) {
      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      })

      this.hls.on(Events.ERROR, (_event, data: ErrorData) => {
        if (data.fatal) {
          this.showError(`스트림 재생 오류: ${data.type}`, data)
        }
      })

      this.hls.on(Events.MANIFEST_PARSED, () => {
        this.updateQualityOptions()
      })

      this.hls.on(Events.LEVEL_SWITCHED, (_event, data: { level: number }) => {
        if (this.selectedQuality === 'auto') {
          const label = this.qualityOptions.find((item) => item.index === data.level)?.label ?? 'Auto'
          this.emit('qualitychange', { quality: 'auto', label: `Auto (${label})` })
        }
      })

      this.hls.attachMedia(video)
      this.hls.loadSource(src)
      return
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return
    }

    this.showError('이 브라우저는 HLS 재생을 지원하지 않습니다.')
  }

  private updateQualityOptions(): void {
    if (!this.hls) {
      this.qualityOptions = []
      return
    }

    this.qualityOptions = this.hls.levels.map((level, index) => ({
      index,
      label: describeLevel(level),
      bitrate: level.bitrate,
      width: level.width,
      height: level.height,
    }))

    const { qualitySelect } = this.elements
    qualitySelect.innerHTML = ''

    const autoOption = document.createElement('option')
    autoOption.value = 'auto'
    autoOption.textContent = 'Auto'
    qualitySelect.append(autoOption)

    this.qualityOptions.forEach((quality) => {
      const option = document.createElement('option')
      option.value = String(quality.index)
      option.textContent = quality.label
      qualitySelect.append(option)
    })

    qualitySelect.value = this.selectedQuality === 'auto' ? 'auto' : String(this.selectedQuality)
  }

  private refreshUi(): void {
    this.refreshProgressUi()
    this.refreshBufferedUi()
    this.refreshVolumeUi()
    this.elements.speedSelect.value = String(this.elements.video.playbackRate)
  }

  private refreshProgressUi(): void {
    const { video, progressInput, timeLabel } = this.elements
    const duration = Number.isFinite(video.duration) ? video.duration : 0
    const current = Number.isFinite(video.currentTime) ? video.currentTime : 0
    const progress = duration > 0 ? (current / duration) * 100 : 0
    progressInput.value = String(progress)
    progressInput.style.setProperty('--stream-fill', `${progress}%`)
    timeLabel.textContent = `${toTimeText(current)} / ${toTimeText(duration)}`
  }

  private refreshBufferedUi(): void {
    const { video, progressBuffered } = this.elements
    const duration = Number.isFinite(video.duration) ? video.duration : 0
    if (duration <= 0 || video.buffered.length === 0) {
      progressBuffered.style.width = '0%'
      return
    }
    const buffered = video.buffered.end(video.buffered.length - 1)
    const percent = Math.max(0, Math.min((buffered / duration) * 100, 100))
    progressBuffered.style.width = `${percent}%`
  }

  private refreshVolumeUi(): void {
    const { video, volumeInput, muteBtn } = this.elements
    volumeInput.value = String(video.volume)
    volumeInput.style.setProperty('--stream-fill', `${video.volume * 100}%`)
    muteBtn.innerHTML = this.makeIcon(video.volume === 0 ? 'volumeMute' : 'volumeOn')
    muteBtn.setAttribute('aria-label', video.volume === 0 ? 'Unmute' : 'Mute')
  }

  private setStateFromOptions(): void {
    const options = {
      ...DEFAULT_OPTIONS,
      ...this.options,
    }
    const { video } = this.elements

    video.autoplay = options.autoplay
    video.loop = options.loop
    video.playsInline = options.playsInline

    if (this.options.poster) {
      video.poster = this.options.poster
    }

    video.playbackRate = 1
    video.volume = options.muted ? 0 : 1
    video.muted = options.muted
    this.previousVolume = 1
  }

  private showLoading(show: boolean): void {
    this.elements.loadingLayer.classList.toggle('is-hidden', !show)
  }

  private showError(message: string, details?: unknown): void {
    this.elements.errorMessage.textContent = message
    this.elements.errorLayer.classList.remove('is-hidden')
    this.emit('error', { message, details })
  }

  private clearError(): void {
    this.elements.errorLayer.classList.add('is-hidden')
    this.elements.errorMessage.textContent = ''
  }

  private startUiHideTimer(): void {
    this.cancelUiHideTimer()
    if (this.elements.video.paused) {
      return
    }
    const waitMs = this.options.controlsAutoHideMs ?? DEFAULT_OPTIONS.controlsAutoHideMs
    this.hideUiTimer = window.setTimeout(() => {
      this.setControlsIdle(true)
    }, waitMs)
  }

  private cancelUiHideTimer(): void {
    if (this.hideUiTimer) {
      window.clearTimeout(this.hideUiTimer)
      this.hideUiTimer = null
    }
  }

  private async toggleFullscreen(): Promise<void> {
    const { root } = this.elements
    if (!document.fullscreenElement) {
      await root.requestFullscreen()
      return
    }
    await document.exitFullscreen()
  }

  private async togglePictureInPicture(): Promise<void> {
    const { video } = this.elements
    if (!document.pictureInPictureEnabled || video.disablePictureInPicture) {
      return
    }
    if (document.pictureInPictureElement === video) {
      await document.exitPictureInPicture()
      return
    }
    await video.requestPictureInPicture()
  }

  private teardownHls(): void {
    if (!this.hls) {
      return
    }
    this.hls.destroy()
    this.hls = null
  }
}

export function createStreamPlayer(options: StreamPlayerOptions): StreamPlayerHandle {
  return StreamHlsPlayer.create(options)
}
