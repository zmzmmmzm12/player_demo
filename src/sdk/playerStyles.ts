export const PLAYER_STYLE_ID = 'stream-hls-player-style-v2'

export const PLAYER_STYLES = `
.stream-player {
  --stream-accent: #f97316;
  --stream-text: #f8fbff;
  --stream-soft: rgba(236, 245, 255, 0.78);
  --stream-card: rgba(10, 16, 28, 0.72);
  --stream-card-border: rgba(255, 255, 255, 0.13);

  position: relative;
  width: 100%;
  color: var(--stream-text);
  border-radius: 18px;
  overflow: hidden;
  background: #050a13;
  box-shadow: 0 18px 40px rgba(2, 6, 12, 0.5);
  font-family: Sora, 'Avenir Next', 'Noto Sans KR', sans-serif;
}

.stream-player video {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
}

.stream-player__overlay-top,
.stream-player__overlay-bottom {
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
  transition: opacity 180ms ease;
}

.stream-player__overlay-top {
  top: 0;
  padding: 14px 18px;
  background: linear-gradient(180deg, rgba(2, 6, 12, 0.84) 0%, rgba(2, 6, 12, 0) 100%);
}

.stream-player__title {
  font-size: 13px;
  color: #d3deee;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.stream-player__overlay-bottom {
  bottom: 0;
  padding: 12px;
  background: linear-gradient(180deg, rgba(6, 10, 18, 0) 0%, rgba(6, 10, 18, 0.92) 45%, rgba(6, 10, 18, 0.98) 100%);
}

.stream-player__controls {
  pointer-events: auto;
  border: 1px solid var(--stream-card-border);
  background: var(--stream-card);
  backdrop-filter: blur(8px);
  border-radius: 14px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stream-progress {
  position: relative;
}

.stream-progress__buffered {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 6px;
  border-radius: 999px;
  width: 0;
  background: rgba(255, 255, 255, 0.35);
  pointer-events: none;
}

.stream-player__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.stream-player__left,
.stream-player__right {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.stream-btn,
.stream-select {
  border: 0;
  color: var(--stream-text);
  background: rgba(255, 255, 255, 0.08);
}

.stream-btn {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 120ms ease, transform 120ms ease;
}

.stream-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  transform: translateY(-1px);
}

.stream-btn svg {
  width: 18px;
  height: 18px;
}

.stream-range {
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--stream-accent) var(--stream-fill, 0%), rgba(255, 255, 255, 0.2) var(--stream-fill, 0%));
  cursor: pointer;
}

.stream-range::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 0;
  background: #fff;
}

.stream-range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 0;
  background: #fff;
}

.stream-range--volume {
  width: 88px;
}

.stream-time {
  min-width: 112px;
  text-align: center;
  color: var(--stream-soft);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.stream-select {
  height: 34px;
  border-radius: 10px;
  font-size: 12px;
  padding: 0 10px;
  cursor: pointer;
}

.stream-player__loading,
.stream-player__error {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.stream-player__loading.is-hidden,
.stream-player__error.is-hidden {
  display: none;
}

.stream-spinner {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.25);
  border-top-color: var(--stream-accent);
  animation: stream-spin 900ms linear infinite;
}

.stream-error-box {
  border: 1px solid rgba(255, 120, 120, 0.38);
  background: rgba(24, 10, 14, 0.84);
  border-radius: 12px;
  padding: 12px 14px;
  max-width: min(90%, 460px);
}

.stream-error-box strong {
  display: block;
  margin-bottom: 4px;
  color: #fff;
}

.stream-error-box span {
  font-size: 13px;
  color: #ffd2d2;
}

.stream-player.is-idle .stream-player__overlay-top,
.stream-player.is-idle .stream-player__overlay-bottom {
  opacity: 0;
}

.stream-btn:focus-visible,
.stream-select:focus-visible,
.stream-range:focus-visible,
.stream-player:focus-visible {
  outline: 2px solid var(--stream-accent);
  outline-offset: 2px;
}

@keyframes stream-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .stream-player__row {
    flex-direction: column;
    align-items: stretch;
    gap: 9px;
  }

  .stream-player__left,
  .stream-player__right {
    justify-content: center;
  }

  .stream-range--volume {
    width: 78px;
  }

  .stream-time {
    min-width: 100px;
  }
}
`
