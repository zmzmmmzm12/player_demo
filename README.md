# Stream HLS Player SDK Demo

`hls.js` 기반 커스텀 영상 플레이어 SDK입니다.

## Run

```bash
yarn install --ignore-engines
yarn dev
```

## Build (Single JS)

```bash
yarn build:sdk
```

생성 파일:

- `dist-sdk/player.umd.js`

이 파일 하나만 다른 프로젝트로 가져가면 됩니다.

## Usage (xshow-hls-player-sdk 스타일 호환)

```html
<div class="xshow-contents-player"></div>
<script src="%PUBLIC_URL%/player.umd.js" defer></script>
<script>
  window.addEventListener('DOMContentLoaded', () => {
    const { Player } = window;

    const player = new Player({
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      container: '.xshow-contents-player',
      thumbnailSrc: '',
      wrapper: 'xcast-custom-player-root',
      subtitle: [
        { label: '한국어', srclang: 'ko', src: '/captions/demo.ko.vtt', default: true },
        { label: 'English', srclang: 'en', src: '/captions/demo.en.vtt' },
      ],
      events: {
        ready: function (_e, info, element) {
          console.log('ready duration:', info?.duration);
          console.log('video element:', element);
        },
      },
    });

    // xshow-ui-admin 방식과 동일: 실시간 자막 교체
    player.setSubtitle([
      { language: 'ko', url: '/captions/demo.ko.vtt', primary: true, label: '한국어' },
    ]);

    // 언어만 즉시 전환
    // off | ko | en ...
    player.setCaptionLanguage('en');
  });
</script>
```

## Notes

- `dist`는 데모 앱 번들입니다.
- 다른 프로젝트에서 재사용할 SDK는 `dist-sdk/player.umd.js`를 사용하세요.
- 자막(`subtitle`)에 넣는 `.vtt` 파일은 사용하는 프로젝트에서 별도 경로로 제공해야 합니다.
