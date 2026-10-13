"""Render ReelPilot's toolbar/store icons (icons/icon{16,32,48,128}.png).

Usage:  python tools/make_icons.py
Draws at 8x and downsamples for clean anti-aliasing. Mirrors RP.logoSVG in src/shared/icons.js.
The 128px icon follows the Chrome Web Store guideline: 96px artwork inside 16px of transparent padding.
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

STOPS = [(0.0, (0xFE, 0xDA, 0x75)), (0.26, (0xFA, 0x7E, 0x1E)), (0.52, (0xD6, 0x29, 0x76)),
         (0.78, (0x96, 0x2F, 0xBF)), (1.0, (0x4F, 0x5B, 0xD5))]
OUT = Path(__file__).resolve().parent.parent / "icons"


def lerp_color(t):
    for (t0, c0), (t1, c1) in zip(STOPS, STOPS[1:]):
        if t <= t1:
            f = (t - t0) / (t1 - t0)
            return tuple(round(a + (b - a) * f) for a, b in zip(c0, c1))
    return STOPS[-1][1]


def gradient(size):
    # Diagonal gradient from bottom-left (warm) to top-right (cool), built from a 1-D ramp.
    ramp = Image.new("RGB", (512, 1))
    ramp.putdata([lerp_color(i / 511) for i in range(512)])
    ramp = ramp.resize((size * 2, size * 2), Image.BILINEAR).rotate(45, resample=Image.BICUBIC)
    off = size // 2
    return ramp.crop((off, off, off + size, off + size))


def render(px):
    s = px * 8
    u = s / 32  # one unit of the 32-unit logo grid
    img = gradient(s).convert("RGBA")

    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=round(9.5 * u), fill=255)
    img.putalpha(mask)

    glyph = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(glyph)
    small = px <= 16
    if small:
        # 16px: bigger play glyph, no chevron, so it stays legible.
        d.polygon([(11 * u, 7.5 * u), (11 * u, 24.5 * u), (25 * u, 16 * u)], fill=255)
    else:
        d.polygon([(13.2 * u, 8.6 * u), (13.2 * u, 18.4 * u), (21.8 * u, 13.5 * u)], fill=255)
        w = round(2.3 * u)
        pts = [(11 * u, 22.3 * u), (16.6 * u, 25.5 * u), (22.2 * u, 22.3 * u)]
        d.line(pts, fill=255, width=w, joint="curve")
        for x, y in (pts[0], pts[2]):
            r = w / 2
            d.ellipse((x - r, y - r, x + r, y + r), fill=255)

    white = Image.new("RGBA", (s, s), (255, 255, 255, 255))
    white.putalpha(ImageChops.multiply(glyph, mask))
    img = Image.alpha_composite(img, white)
    return img.resize((px, px), Image.LANCZOS)


def padded(px, art):
    """`art`-sized artwork centered on a transparent `px` canvas."""
    canvas = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    off = (px - art) // 2
    canvas.alpha_composite(render(art), (off, off))
    return canvas


def main():
    OUT.mkdir(exist_ok=True)
    for px in (16, 32, 48):
        render(px).save(OUT / f"icon{px}.png", optimize=True)
        print("wrote", OUT / f"icon{px}.png")
    padded(128, 96).save(OUT / "icon128.png", optimize=True)
    print("wrote", OUT / "icon128.png")


if __name__ == "__main__":
    main()
