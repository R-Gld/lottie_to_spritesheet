# lottie_to_spritesheet

Export a Lottie animation to transparent PNG frames, then optionally assemble those frames into a PNG spritesheet.

The renderer used for export is `lottie-web` in headless Chrome. This is useful when a target runtime does not render a
Lottie file the same way as web-based Lottie viewers.

## Prerequisites

- Node.js and npm
- Google Chrome or Chromium
- `ffmpeg` when generating a spritesheet
- `unzip` when using `.lottie` files

On Ubuntu:

```bash
sudo apt install nodejs npm ffmpeg unzip chromium
```

If Chrome is installed under another executable name, set `CHROME_BIN` when running the script.

## Install

Install the Node dependencies locally:

```bash
npm install
```

`puppeteer-core` is used so the script can reuse an existing Chrome/Chromium install instead of downloading Chromium.

## Usage

```bash
node export-lottie-spritesheet.js \
  <source.json|source.lottie> \
  <frames-dir> \
  <frame-width> \
  <frame-height> \
  <frame-count> \
  [spritesheet.png] \
  [columns=10]
```

Arguments:

- `source.json|source.lottie`: input animation. `.lottie` containers are supported when `unzip` is available.
- `frames-dir`: output directory for individual PNG frames.
- `frame-width`: exported frame width in pixels.
- `frame-height`: exported frame height in pixels.
- `frame-count`: number of frames to export.
- `spritesheet.png`: optional output path for the assembled spritesheet.
- `columns`: optional number of columns in the spritesheet grid. Default: `10`.

## Examples

Export only frames:

```bash
node export-lottie-spritesheet.js \
  ./loader-stroke.lottie \
  ./output/loader-stroke-frames \
  302 260 60
```

Export frames and a `10 x 6` spritesheet:

```bash
node export-lottie-spritesheet.js \
  ./loader-stroke.lottie \
  ./output/loader-stroke-frames \
  302 260 60 \
  ./output/loader-stroke-sheet.png \
  10
```

Use a custom Chrome binary:

```bash
CHROME_BIN=/usr/bin/chromium \
node export-lottie-spritesheet.js \
  ./loader-stroke.lottie \
  ./output/loader-stroke-frames \
  302 260 60 \
  ./output/loader-stroke-sheet.png
```

## Notes

- Output frames are PNG with transparency.
- The animation is rendered with `lottie-web` using the canvas renderer.
- The spritesheet is assembled with `ffmpeg` using the PNG frames.
- For a 2-second animation, `60` exported frames is usually a good balance between quality, file size, and runtime memory
  use.
