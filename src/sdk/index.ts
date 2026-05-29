import { createStreamPlayer, StreamHlsPlayer } from './player'
import type {
  CaptionTrackOption,
  QualityOption,
  StreamPlayerEventMap,
  StreamPlayerHandle,
  StreamPlayerOptions,
  StreamPlayerPublicState,
  StreamPlayerSource,
} from './types'

type LegacyEventHandlers = {
  ready?: (event: unknown, video: HTMLVideoElement | null) => void
  play?: () => void
  pause?: () => void
  ended?: () => void
  error?: (error: unknown) => void
}

type LegacyPlayerOptions = {
  url: string
  container: string | HTMLElement
  wrapper?: string
  thumbnailSrc?: string
  subtitle?: CaptionTrackOption[] | null
  autoplay?: boolean
  muted?: boolean
  loop?: boolean
  title?: string
  controlsAutoHideMs?: number
  themeColor?: string
  events?: LegacyEventHandlers
}

function resolveElement(target: string | HTMLElement): HTMLElement {
  if (typeof target === 'string') {
    const found = document.querySelector<HTMLElement>(target)
    if (!found) {
      throw new Error(`Player container not found: ${target}`)
    }
    return found
  }
  return target
}

function resolveMountContainer(target: string | HTMLElement, wrapperId?: string): HTMLElement {
  const base = resolveElement(target)
  if (!wrapperId) {
    return base
  }

  const existing = document.getElementById(wrapperId)
  if (existing?.parentNode) {
    existing.parentNode.removeChild(existing)
  }

  const wrapper = document.createElement('div')
  wrapper.id = wrapperId
  base.append(wrapper)
  return wrapper
}

function normalizeSubtitles(subtitle: LegacyPlayerOptions['subtitle']): CaptionTrackOption[] {
  if (!subtitle) {
    return []
  }
  return subtitle
}

class Player {
  private readonly mountElement: HTMLElement

  private readonly player: StreamPlayerHandle

  constructor(options: LegacyPlayerOptions) {
    this.mountElement = resolveMountContainer(options.container, options.wrapper)

    this.player = createStreamPlayer({
      container: this.mountElement,
      source: options.url,
      captions: normalizeSubtitles(options.subtitle),
      poster: options.thumbnailSrc,
      autoplay: options.autoplay,
      muted: options.muted,
      loop: options.loop,
      title: options.title,
      controlsAutoHideMs: options.controlsAutoHideMs,
      themeColor: options.themeColor,
    })

    if (options.events?.ready) {
      this.player.on('ready', () => {
        options.events?.ready?.(undefined, this.getVideoElement())
      })
    }
    if (options.events?.play) {
      this.player.on('play', () => options.events?.play?.())
    }
    if (options.events?.pause) {
      this.player.on('pause', () => options.events?.pause?.())
    }
    if (options.events?.ended) {
      this.player.on('ended', () => options.events?.ended?.())
    }
    if (options.events?.error) {
      this.player.on('error', (error) => options.events?.error?.(error))
    }
  }

  load(url: string): Promise<void> {
    return this.player.load(url)
  }

  play(): Promise<void> {
    return this.player.play()
  }

  pause(): void {
    this.player.pause()
  }

  destroy(): void {
    this.player.destroy()
  }

  getState(): StreamPlayerPublicState {
    return this.player.getState()
  }

  private getVideoElement(): HTMLVideoElement | null {
    return this.mountElement.querySelector('video')
  }
}

export {
  StreamHlsPlayer,
  Player,
  createStreamPlayer,
  type CaptionTrackOption,
  type QualityOption,
  type StreamPlayerEventMap,
  type StreamPlayerHandle,
  type StreamPlayerOptions,
  type StreamPlayerPublicState,
  type StreamPlayerSource,
}

export const StreamHlsPlayerSDK = {
  Player,
  StreamHlsPlayer,
  createPlayer: createStreamPlayer,
}

declare global {
  interface Window {
    StreamHlsPlayerSDK?: typeof StreamHlsPlayerSDK
    Player?: typeof Player
  }
}

if (typeof window !== 'undefined') {
  window.StreamHlsPlayerSDK = StreamHlsPlayerSDK
  window.Player = Player
}
