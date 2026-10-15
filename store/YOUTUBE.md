# YouTube upload — ReelPilot promo video

**Files**
- Video: `store/video/reelpilot-promo.mp4` (1920×1080, 30 fps, 46 s, H.264 + AAC)
- Thumbnail: `store/video/youtube-thumbnail.png` (1280×720)
- Re-render after UI changes: `cd tools/store && npm install`, then `node ../video/render.mjs`
  (needs Chrome, ffmpeg and Python with numpy)

The soundtrack was synthesized for this video (`tools/video/music.py`), so there is no copyright claim
risk. To use different music, swap it in YouTube Studio's **Audio** editor or its free **Audio Library**.

---

## 1. Upload

<https://studio.youtube.com> → **Create → Upload videos** → select `reelpilot-promo.mp4`.

**Title**
```
ReelPilot – Auto Scroll for Instagram Reels (Chrome Extension)
```

**Description**
```
ReelPilot puts Instagram Reels on autopilot. It's a free Chrome extension that moves to the next reel for you, adds playback controls right on the page, and keeps your reels playing when you switch tabs.

✦ Auto-scroll after 1–10 plays, or on a timer
✦ Controls on top of the reel: play, skip, speed (0.5×–2×), volume
✦ Keeps playing in background tabs
✦ Picture-in-Picture that follows every next reel
✦ Remote control from any tab: toolbar popup, keyboard shortcuts, media keys
✦ Skips sponsored reels and image ads (optional)
✦ No account, no tracking: everything stays in your browser

Get it on the Chrome Web Store: https://chromewebstore.google.com/detail/reelpilot-%E2%80%93-auto-scroll-f/bphneemeaeekncgbmhfjjhfbplhplced
Source code: https://github.com/Mousta-Med/IG-Extension

Keyboard shortcuts
Alt+Shift+S  Auto-scroll on/off
Alt+Shift+K  Play / pause
Alt+Shift+↓ / ↑  Next / previous reel

Chapters
0:00 Auto-scroll & controls on the reel
0:21 Background play, Picture-in-Picture & remote control
0:36 Skip ads & get ReelPilot

ReelPilot is an independent project and is not affiliated with, endorsed by or sponsored by Instagram or Meta Platforms, Inc. Instagram is a trademark of Meta Platforms, Inc.
Music: original soundtrack made for this video.
```

**Thumbnail** → upload `youtube-thumbnail.png`. Custom thumbnails need a phone-verified YouTube account:
<https://www.youtube.com/verify>.

## 2. Details

| Setting | Value |
| --- | --- |
| Audience | **No, it's not made for kids** |
| Tags (Show more → Tags) | `instagram reels, auto scroll, autoscroll, chrome extension, reels auto scroll, instagram autoplay, picture in picture, reelpilot` |
| Category | Science & Technology |
| Altered or synthetic content | **No**. It's motion graphics of the extension's interface, not realistic footage. |
| Visibility | **Public**, or **Unlisted** if it's only for the store page |

## 3. Add it to the Chrome Web Store listing

1. The video is live at https://www.youtube.com/watch?v=Ak9mns1-8Ho.
2. Developer Dashboard → your item → **Store listing** → **Global promo video** → paste
   `https://www.youtube.com/watch?v=Ak9mns1-8Ho`.
3. Save. If the item is already published, submit it for review again.

The video then plays at the top of your Chrome Web Store page, before the screenshots.
