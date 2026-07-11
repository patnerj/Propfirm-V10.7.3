#!/usr/bin/env python3
"""Generate Android launcher icons + splash from the brand mark (BUG 8).

Outputs (all committed to the android project source):
  mipmap-<dpi>/ic_launcher.png            legacy square icon (full-bleed, brand bg)
  mipmap-<dpi>/ic_launcher_round.png      legacy round icon
  mipmap-<dpi>/ic_launcher_foreground.png adaptive foreground (transparent, safe-zone padded)
  mipmap-anydpi-v26/ic_launcher{,_round}.xml   adaptive icon definitions
  values/ic_launcher_background.xml       adaptive background colour
  drawable/splash_mark.png                centered brand mark for the splash
"""
import os, cairosvg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES  = os.path.join(ROOT, "android", "app", "src", "main", "res")

BG_DARK = "#0F1729"   # brand surface (matches favicon.svg bg)
PURPLE  = "#7C6EF5"
GREEN   = "#10B981"

# The mark paths, lifted from public/favicon.svg (single source of truth).
MARK = f'''
  <path d="M256 128 L150 400 L214 400 L256 314 Z" fill="{PURPLE}"/>
  <path d="M256 128 L362 400 L298 400 L256 314 Z" fill="url(#g)"/>
  <path d="M256 92 L292 156 L256 142 L220 156 Z" fill="{GREEN}"/>
'''
GRAD = f'''
  <defs>
    <linearGradient id="g" x1="80" y1="430" x2="432" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{PURPLE}"/>
      <stop offset="1" stop-color="{GREEN}"/>
    </linearGradient>
  </defs>
'''

def svg(body, bg=None, rx=None):
    bgrect = f'<rect width="512" height="512" rx="{rx or 0}" fill="{bg}"/>' if bg else ""
    return f'<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">{GRAD}{bgrect}{body}</svg>'

# Legacy square: brand bg + mark (mark already ~60% of canvas height)
SQUARE = svg(MARK, bg=BG_DARK, rx=112)
# Legacy round: same, circular
ROUND  = svg(MARK, bg=BG_DARK, rx=256)
# Adaptive foreground: NO background. The OS mask crops aggressively, so the mark
# must sit inside the safe zone — scale to ~62% of the canvas and centre it.
# The mark's bbox is x150-362, y92-400 (centre 256,246); shift down 10px to centre,
# then scale about the centre so it occupies ~62% of the 512 canvas.
FOREGROUND = svg(
    f'<g transform="translate(256,256) scale(0.62) translate(-256,-246)">{MARK}</g>'
)
# Splash mark (transparent bg, centred — the splash background colour is set separately)
SPLASH = svg(f'<g transform="translate(256,256) scale(0.85) translate(-256,-246)">{MARK}</g>')

LEGACY_DPI = {"mdpi":48, "hdpi":72, "xhdpi":96, "xxhdpi":144, "xxxhdpi":192}
ADAPT_DPI  = {"mdpi":108, "hdpi":162, "xhdpi":216, "xxhdpi":324, "xxxhdpi":432}

def png(src, path, size):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    cairosvg.svg2png(bytestring=src.encode(), write_to=path,
                     output_width=size, output_height=size)

n = 0
for dpi, size in LEGACY_DPI.items():
    png(SQUARE, os.path.join(RES, f"mipmap-{dpi}", "ic_launcher.png"), size); n += 1
    png(ROUND,  os.path.join(RES, f"mipmap-{dpi}", "ic_launcher_round.png"), size); n += 1
for dpi, size in ADAPT_DPI.items():
    png(FOREGROUND, os.path.join(RES, f"mipmap-{dpi}", "ic_launcher_foreground.png"), size); n += 1

# Adaptive icon XML (API 26+): background colour + foreground layer
adaptive = ('<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <background android:drawable="@color/ic_launcher_background"/>\n'
            '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
            '</adaptive-icon>\n')
os.makedirs(os.path.join(RES, "mipmap-anydpi-v26"), exist_ok=True)
for f in ("ic_launcher.xml", "ic_launcher_round.xml"):
    open(os.path.join(RES, "mipmap-anydpi-v26", f), "w").write(adaptive); n += 1

os.makedirs(os.path.join(RES, "values"), exist_ok=True)
open(os.path.join(RES, "values", "ic_launcher_background.xml"), "w").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    f'    <color name="ic_launcher_background">{BG_DARK}</color>\n</resources>\n'); n += 1

# Splash mark
png(SPLASH, os.path.join(RES, "drawable", "splash_mark.png"), 512); n += 1

print(f"generated {n} branded asset files into android/app/src/main/res/")
