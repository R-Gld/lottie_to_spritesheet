#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function usage() {
  console.error(
    [
      "Usage:",
      "  node export-lottie-spritesheet.js <source.json|source.lottie> <frames-dir> <width> <height> <frame-count> [sheet.png] [columns=10]",
    ].join("\n"),
  );
}

function buildSpritesheet(framesDir, sheetPath, columns, frameCount) {
  const rows = Math.ceil(frameCount / columns);
  fs.mkdirSync(path.dirname(sheetPath), { recursive: true });

  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-y",
      "-i",
      path.join(framesDir, "frame_%04d.png"),
      "-vf",
      `tile=${columns}x${rows}`,
      "-frames:v",
      "1",
      "-update",
      "1",
      sheetPath,
    ],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    throw new Error(`ffmpeg failed with exit code ${result.status}`);
  }
}

function unzipText(sourcePath, entryPath) {
  const result = spawnSync("unzip", ["-p", sourcePath, entryPath], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(`Unable to read ${entryPath} from ${sourcePath}: ${result.stderr}`);
  }

  return result.stdout;
}

function loadAnimationData(sourcePath) {
  if (sourcePath.endsWith(".lottie")) {
    const manifest = JSON.parse(unzipText(sourcePath, "manifest.json"));
    const animationId = manifest.animations?.[0]?.id;
    if (!animationId) {
      throw new Error(`No animation id found in ${sourcePath}`);
    }

    return JSON.parse(unzipText(sourcePath, `animations/${animationId}.json`));
  }

  return JSON.parse(fs.readFileSync(sourcePath, "utf8"));
}

const [, , sourcePath, outputDir, widthArg, heightArg, frameCountArg, sheetPath, columnsArg = "10"] = process.argv;

if (!sourcePath || !outputDir || !widthArg || !heightArg || !frameCountArg) {
  usage();
  process.exit(1);
}

const width = Number(widthArg);
const height = Number(heightArg);
const frameCount = Number(frameCountArg);
const columns = Number(columnsArg);

if (![width, height, frameCount, columns].every(Number.isFinite)) {
  usage();
  process.exit(1);
}

const puppeteer = require("puppeteer-core");
const lottieWebPath = require.resolve("lottie-web/build/player/lottie.min.js");
const animationData = loadAnimationData(sourcePath);

fs.mkdirSync(outputDir, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome",
    headless: "new",
    protocolTimeout: 180000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-crash-reporter",
      "--disable-crashpad",
      "--disable-extensions",
      "--disable-background-networking",
      "--run-all-compositor-stages-before-draw",
      "--hide-scrollbars",
    ],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(180000);
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body, #animation {
      width: ${width}px;
      height: ${height}px;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: transparent;
    }
  </style>
</head>
<body>
  <div id="animation"></div>
</body>
</html>`);

    await page.addScriptTag({ path: lottieWebPath });

    await page.evaluate((data) => {
      window.animation = window.lottie.loadAnimation({
        container: document.getElementById("animation"),
        renderer: "canvas",
        loop: false,
        autoplay: false,
        animationData: data,
        rendererSettings: {
          preserveAspectRatio: "xMidYMid meet",
          progressiveLoad: false,
          hideOnTransparent: false,
        },
      });
    }, animationData);

    await page.evaluate(
      () =>
        new Promise((resolve) => {
          if (window.animation.isLoaded && window.animation.totalFrames > 0) {
            resolve();
            return;
          }

          window.animation.addEventListener("DOMLoaded", resolve);
        }),
    );

    const totalFrames = await page.evaluate(() => window.animation.totalFrames);
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const frame = (frameIndex * totalFrames) / frameCount;
      await page.evaluate((targetFrame) => {
        window.animation.goToAndStop(targetFrame, true);
      }, frame);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));

      const outputPath = path.join(outputDir, `frame_${String(frameIndex).padStart(4, "0")}.png`);
      await page.screenshot({
        path: outputPath,
        omitBackground: true,
        clip: { x: 0, y: 0, width, height },
      });
    }

    console.log(`Exported ${frameCount} frames from ${sourcePath} (${totalFrames} source frames)`);
  } finally {
    await browser.close();
  }

  if (sheetPath) {
    buildSpritesheet(outputDir, sheetPath, columns, frameCount);
    console.log(`Wrote spritesheet: ${sheetPath}`);
  }
})();
