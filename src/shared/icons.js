/* ReelPilot — inline SVG icon set (stroke icons on a 24px grid). */
(() => {
  'use strict';
  const RP = (globalThis.ReelPilot = globalThis.ReelPilot || {});

  const svg = (body, extra = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${extra}>${body}</svg>`;

  RP.ICONS = {
    play: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5.6v12.8c0 .8.9 1.3 1.6.9l10.2-6.4a1.05 1.05 0 0 0 0-1.8L9.6 4.7C8.9 4.3 8 4.8 8 5.6Z"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect fill="currentColor" x="6" y="5" width="4.2" height="14" rx="1.4"/><rect fill="currentColor" x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>`,
    up: svg('<path d="M6 15l6-6 6 6"/>'),
    down: svg('<path d="M6 9l6 6 6-6"/>'),
    chevron: svg('<path d="M6 9l6 6 6-6"/>', ' class="rp-chev"'),
    minus: svg('<path d="M5 12h14"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    minimize: svg('<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>'),
    autoplay: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M10 8.5v7l5.5-3.5z" fill="currentColor" stroke="none"/>'),
    volume: svg('<path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke-width="1.6"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
    volumeLow: svg('<path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke-width="1.6"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>'),
    muted: svg('<path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke-width="1.6"/><path d="M22 9l-6 6M16 9l6 6"/>'),
    settings: svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
    skip: svg('<path d="M5 5v14l9-7z" fill="currentColor" stroke="none"/><path d="M18 5v14"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    alert: svg('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
    zap: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
    external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    keyboard: svg('<rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
    refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'),
    pip: svg('<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><rect x="12" y="11" width="7" height="6" rx="1.3" fill="currentColor" stroke="none"/>'),
    onReel: svg('<rect x="6" y="2.5" width="12" height="19" rx="2.6"/><path d="M9.2 6.6h5.6" stroke-width="2.4"/>'),
    panel: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M14.5 4v16"/>'),
    reels: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M3 8.5h18M8.5 3l3 5.5M14 3l3 5.5"/><path d="M10.5 12v5l4-2.5z" fill="currentColor" stroke="none"/>'),
    music: svg('<path d="M9 18V5.5l11-2.2V16"/><circle cx="6" cy="18" r="3" fill="currentColor"/><circle cx="17" cy="16" r="3" fill="currentColor"/>'),
  };

  RP.logoSVG = (id = 'rpLogo') => `
<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${id}" x1="2" y1="30" x2="30" y2="2" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FEDA75"/>
      <stop offset=".26" stop-color="#FA7E1E"/>
      <stop offset=".52" stop-color="#D62976"/>
      <stop offset=".78" stop-color="#962FBF"/>
      <stop offset="1" stop-color="#4F5BD5"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="9.5" fill="url(#${id})"/>
  <rect x="1" y="1" width="30" height="30" rx="8.5" fill="none" stroke="#fff" stroke-opacity=".18"/>
  <path d="M13.2 8.9v9.2c0 .7.8 1.1 1.4.7l7-4.6a.85.85 0 0 0 0-1.4l-7-4.6c-.6-.4-1.4 0-1.4.7Z" fill="#fff"/>
  <path d="M11 22.3l5.6 3.2 5.6-3.2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
})();
