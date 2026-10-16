# Chrome Web Store submission — ReelPilot 1.1.0

Everything to fill in, in the order the Developer Dashboard asks for it. Copy the text in the boxes as-is.

**Files**
- Package: `dist/reelpilot-1.1.0.zip` (rebuild with `python tools/build_zip.py`)
- Graphics: `store/assets/` (re-render with `cd tools/store && npm install && npm run render`)
- Item ID: `bphneemeaeekncgbmhfjjhfbplhplced`, published at https://chromewebstore.google.com/detail/reelpilot-%E2%80%93-auto-scroll-f/bphneemeaeekncgbmhfjjhfbplhplced
- Privacy policy: https://github.com/Mousta-Med/IG-Extension/blob/main/PRIVACY.md

---

## 1. One-time setup

1. Go to <https://chrome.google.com/webstore/devconsole> and sign in with the Google account that will own
   the extension.
2. Accept the developer agreement and pay the **one-time $5 registration fee**.
3. In **Account**, set a **contact email** and verify it. Google won't let you publish until it's verified.
4. Make sure **2-Step Verification** is on for that Google account. Publishing requires it.

## 2. Upload the package

**Items → New item** → upload `dist/reelpilot-1.1.0.zip`.

The listing **name** and **summary** come from the package:
- Name: `ReelPilot – Auto Scroll for Instagram Reels`
- Summary: `Auto-scroll Instagram Reels with on-screen controls, Picture-in-Picture and background play. Not affiliated with Instagram.`

## 3. Store listing tab

**Description**

```
ReelPilot puts Instagram Reels on autopilot. It moves to the next reel for you, adds playback controls on top of the page, and keeps your reels playing when you switch to another tab.

★ AUTO-SCROLL
• Moves to the next reel when the current one ends: after 1 to 10 plays, or on a timer (3–120 seconds).
• Handles image reels and image ads too: they stay up for a few seconds, then ReelPilot moves on.
• Optional: skip sponsored reels automatically.

★ CONTROLS YOUR WAY
• Floating panel: play/pause, previous/next, seek bar, speed (0.5×–2×), volume and a countdown to the next reel. Drag it anywhere or shrink it to a small button.
• Or a slim bar right on top of the reel that fades away while you watch.

★ KEEPS PLAYING IN THE BACKGROUND
• Switch tabs and your reels keep playing and auto-scrolling.
• Picture-in-Picture: pop the reel into a floating window that follows auto-scroll to every next reel. Optional automatic Picture-in-Picture when you leave the tab.

★ REMOTE CONTROL FROM ANY TAB
• Toolbar popup with every control.
• Keyboard shortcuts: Alt+Shift+S (auto-scroll on/off), Alt+Shift+K (play/pause), Alt+Shift+↓ and Alt+Shift+↑ (next/previous). Change them at chrome://extensions/shortcuts.
• Your keyboard's media keys and Chrome's media controls skip reels too.

★ PRIVATE BY DESIGN
• No account, no sign-in, no tracking, no ads.
• Your settings stay in your browser. ReelPilot sends no data anywhere.
• Runs only on instagram.com.

HOW TO USE
1. Open instagram.com/reels
2. Turn on Auto-scroll in the ReelPilot panel, or press Alt+Shift+S.
3. Watch, or switch tabs and keep listening.

ReelPilot is an independent project and is not affiliated with, endorsed by or sponsored by Instagram or Meta Platforms, Inc. Instagram is a trademark of Meta Platforms, Inc.
```

| Field | Value |
| --- | --- |
| Category | **Social Networking** (alternative: Entertainment) |
| Language | English |
| Store icon | `store/assets/store-icon-128.png` |
| Screenshots (1280×800, in this order) | `screenshot-1-autopilot.png`, `screenshot-2-on-reel-controls.png`, `screenshot-3-background-pip.png`, `screenshot-4-remote-control.png`, `screenshot-5-skip-ads.png` |
| Small promo tile (440×280) | `store/assets/promo-small-440x280.png` |
| Marquee promo tile (1400×560) | `store/assets/promo-marquee-1400x560.png` (optional) |
| Global promo video | `https://www.youtube.com/watch?v=Ak9mns1-8Ho` |
| Homepage URL | `https://github.com/Mousta-Med/IG-Extension` |
| Support URL | `https://github.com/Mousta-Med/IG-Extension/issues` |

## 4. Privacy practices tab

**Single purpose description**

```
ReelPilot controls playback of Instagram Reels on instagram.com: it automatically moves to the next reel and provides on-page and toolbar controls (play/pause, next/previous, speed, volume, Picture-in-Picture), including while the tab is in the background. It also plays the music attached to photo posts, as the Instagram app does.
```

**Permission justifications**

`storage`
```
Saves the user's ReelPilot settings (auto-scroll mode, plays per reel, timer, speed, volume, panel position) in the browser so they persist between visits. Nothing is sent off the device.
```

`scripting`
```
When the extension is installed or updated, it injects its own bundled content scripts (the same files listed in the manifest) into Instagram tabs that are already open, so the controls work without the user having to reload the page. No remote or dynamically generated code is injected.
```

Host permissions (`*://www.instagram.com/*`, `*://instagram.com/*`)
```
The extension's only function is controlling Reels playback on instagram.com. Host access is needed to run the content scripts that display the controls, operate the reel videos and play the music attached to photo posts (read from Instagram's post data, or from Instagram's own post-info endpoint for the post being viewed), and to find the open Instagram tab so the toolbar popup and keyboard shortcuts can control it from other tabs. The extension does not run on any other site.
```

**Are you using remote code?** → **No, I am not using remote code.**

**Data usage**
- Leave **all data categories unchecked**. ReelPilot doesn't collect or transmit user data. It reads the
  reel on screen (video, author name, "Ad" label) and the song details of the photo post on screen only in
  memory to drive its controls, and saves only its own settings locally. Its only requests go to instagram.com.
- Check all three certifications (no selling/transferring data, no use unrelated to the single purpose, no
  creditworthiness/lending use).

**Privacy policy URL** → `https://github.com/Mousta-Med/IG-Extension/blob/main/PRIVACY.md`

## 5. Privacy policy

Already hosted. GitHub shows [PRIVACY.md](../PRIVACY.md) as a readable page at https://github.com/Mousta-Med/IG-Extension/blob/main/PRIVACY.md.
Paste that link in the Privacy tab. If you edit the policy, update both `PRIVACY.md` and
`store/privacy-policy.html`.

## 6. Distribution tab

- Payments: **Free**
- Visibility: **Public** (or **Unlisted** for a soft launch that only people with the link can find)
- Regions: **All regions**

## 7. Test instructions (for the reviewer)

If the dashboard shows a test-instructions field, paste:
```
1. Sign in to instagram.com (a normal Instagram account is required to view the Reels feed).
2. Open https://www.instagram.com/reels/ — the ReelPilot panel appears at the top-right.
3. Turn on "Auto-scroll": when the reel ends, the next reel starts automatically.
4. Switch to another tab: playback and auto-scrolling continue in the background.
5. Click "On reel" to show the compact control bar on top of the reel; click "PiP" for Picture-in-Picture.
6. The toolbar icon opens a remote control that works from any tab.
```

## 8. Submit

Press **Submit for review**. You can tick **"Publish automatically after approval"**, or turn it off and
publish manually once it's approved. Review usually takes a few days. Google emails you the result.

---

## Before you submit: review risks

- **Trademark.** The name uses "for Instagram Reels", which describes what the extension works with, and the
  description includes a "not affiliated" notice. Google, or Meta through a trademark complaint, can still ask
  for a rename. If that happens, change `name` in `manifest.json` to `ReelPilot – Auto Scroll for Reels`,
  rebuild and resubmit.
- **Icon colors.** The icon uses a warm gradient similar to Instagram's, but not its camera glyph. If a
  reviewer objects, re-color the gradient stops in `tools/make_icons.py` and `src/shared/icons.js`.
- **Screenshots.** They show illustrated sample reels with invented `.demo` accounts, not real Instagram
  content or people.

## Publishing an update later

1. Increase `version` in `manifest.json` (for example `1.0.1`).
2. Run `python tools/build_zip.py`.
3. In the dashboard, open the item → **Package → Upload new package** → submit for review.
