/**
 * Generates Android launcher icons + splash screens for the "DS" monogram.
 *
 * The app deliberately carries no illustrated logo: the mark is the two-letter
 * wordmark "DS" on the brand gradient. Everything is rasterised from inline SVG
 * with sharp and written into the files Capacitor's template already references,
 * so the build stays reproducible:
 *
 *   npm run assets
 */

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const RES = path.resolve('android/app/src/main/res')

const BRAND = '#4D6BFE'
const BRAND_LIGHT = '#5B78FF'
const BRAND_DARK = '#3B57E8'

const FONT = "'Segoe UI', 'Helvetica Neue', Arial, 'Microsoft YaHei', sans-serif"

/** Wordmark glyphs, centred in a square box of `size`. */
function markText(size, color, scale = 1, dy = 0) {
  const fontSize = size * 0.42 * scale
  return `<text x="${size / 2}" y="${size / 2 + dy}" fill="${color}"
    font-size="${fontSize}" font-weight="700" font-family="${FONT}"
    text-anchor="middle" dominant-baseline="central"
    letter-spacing="${fontSize * 0.02}">DS</text>`
}

function iconSvg(size, { round = false } = {}) {
  const radius = round ? size / 2 : size * 0.222
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${BRAND_LIGHT}"/>
        <stop offset="1" stop-color="${BRAND_DARK}"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="url(#g)"/>
    ${markText(size, '#ffffff')}
  </svg>`)
}

/** Transparent foreground for the adaptive icon (kept inside the safe zone). */
function foregroundSvg(size) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${markText(size, '#ffffff', 0.82)}
  </svg>`)
}

function splashSvg(width, height) {
  const base = Math.min(width, height)
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${BRAND_LIGHT}"/>
        <stop offset="1" stop-color="${BRAND_DARK}"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <text x="${width / 2}" y="${height / 2 - base * 0.02}" fill="#ffffff"
      font-size="${base * 0.16}" font-weight="700" font-family="${FONT}"
      text-anchor="middle" dominant-baseline="central" letter-spacing="${base * 0.006}">DS</text>
    <text x="${width / 2}" y="${height / 2 + base * 0.11}" fill="#ffffff" opacity="0.82"
      font-size="${base * 0.045}" font-weight="600" font-family="${FONT}"
      text-anchor="middle" dominant-baseline="central" letter-spacing="${base * 0.002}">Deepseek APP</text>
  </svg>`)
}

const DENSITIES = [
  { dir: 'mipmap-mdpi', legacy: 48, adapt: 108 },
  { dir: 'mipmap-hdpi', legacy: 72, adapt: 162 },
  { dir: 'mipmap-xhdpi', legacy: 96, adapt: 216 },
  { dir: 'mipmap-xxhdpi', legacy: 144, adapt: 324 },
  { dir: 'mipmap-xxxhdpi', legacy: 192, adapt: 432 },
]

async function writePng(target, buffer, size) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  await sharp(buffer).resize(size, size, { fit: 'fill' }).png({ compressionLevel: 9 }).toFile(target)
}

async function main() {
  for (const density of DENSITIES) {
    const dir = path.join(RES, density.dir)
    await writePng(path.join(dir, 'ic_launcher.png'), iconSvg(512), density.legacy)
    await writePng(path.join(dir, 'ic_launcher_round.png'), iconSvg(512, { round: true }), density.legacy)
    await writePng(path.join(dir, 'ic_launcher_foreground.png'), foregroundSvg(512), density.adapt)
  }

  // Splash screens: reuse the dimensions of the template files.
  const splashTargets = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === 'splash.png') splashTargets.push(full)
    }
  }
  walk(RES)

  for (const target of splashTargets) {
    const meta = await sharp(target).metadata()
    const width = meta.width ?? 2732
    const height = meta.height ?? 2732
    await sharp(splashSvg(width, height)).png({ compressionLevel: 9 }).toFile(target)
    console.log(`splash ${path.relative(RES, target)} → ${width}x${height}`)
  }

  // Adaptive icon background colour. Capacitor's template ships its own
  // `values/ic_launcher_background.xml`; keeping both it and a colors.xml entry
  // makes aapt fail with "Duplicate resources".
  const templateColor = path.join(RES, 'values/ic_launcher_background.xml')
  if (fs.existsSync(templateColor)) {
    fs.rmSync(templateColor)
    console.log('removed template values/ic_launcher_background.xml')
  }

  const colorsXml = path.join(RES, 'values/colors.xml')
  let existing = ''
  try {
    existing = fs.readFileSync(colorsXml, 'utf8')
  } catch {
    existing = ''
  }
  if (!existing.includes('ic_launcher_background')) {
    const body = existing
      ? existing.replace('</resources>', `    <color name="ic_launcher_background">${BRAND}</color>\n</resources>`)
      : `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BRAND}</color>
    <color name="colorPrimary">${BRAND}</color>
    <color name="colorPrimaryDark">${BRAND_DARK}</color>
    <color name="colorAccent">${BRAND}</color>
</resources>
`
    fs.mkdirSync(path.dirname(colorsXml), { recursive: true })
    fs.writeFileSync(colorsXml, body, 'utf8')
    console.log(`colors.xml updated (${path.relative(RES, colorsXml)})`)
  }

  console.log('assets generated')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
