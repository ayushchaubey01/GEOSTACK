import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

/**
 * Pure built-in PNG pixel reader (no external packages).
 */
function getPixelsFromPng(pngPath: string) {
  const buf = fs.readFileSync(pngPath);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  let pos = 8;
  const idatParts: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IDAT') {
      idatParts.push(buf.subarray(pos + 8, pos + 8 + len));
    }
    pos += 8 + len + 4;
  }
  const decomp = zlib.inflateSync(Buffer.concat(idatParts));
  const bpp = Math.round((decomp.length / height - 1) / width);
  const rowLen = width * bpp;
  const raw = Buffer.alloc(width * height * bpp);

  let srcPos = 0;
  for (let y = 0; y < height; y++) {
    const filter = decomp[srcPos++];
    const rowStart = y * rowLen;
    const prevRowStart = (y - 1) * rowLen;

    for (let x = 0; x < rowLen; x++) {
      const byte = decomp[srcPos++];
      const left = x >= bpp ? raw[rowStart + x - bpp] : 0;
      const up = y > 0 ? raw[prevRowStart + x] : 0;
      const upLeft = (y > 0 && x >= bpp) ? raw[prevRowStart + x - bpp] : 0;

      let val = 0;
      if (filter === 0) val = byte;
      else if (filter === 1) val = byte + left;
      else if (filter === 2) val = byte + up;
      else if (filter === 3) val = byte + Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const pr = (pa <= pb && pa <= pc) ? left : (pb <= pc ? up : upLeft);
        val = byte + pr;
      }
      raw[rowStart + x] = val & 0xff;
    }
  }

  return {
    width,
    height,
    getPixel: (x: number, y: number): [number, number, number] => {
      const idx = (y * width + x) * bpp;
      return [raw[idx], raw[idx + 1], raw[idx + 2]];
    },
  };
}

test.describe('Area-Driven Floor Plans & Parking Basements', () => {
  const screenshotDir = path.join(process.cwd(), 'tests', 'screenshots', 'after', 'layout');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test('Validates data-driven layouts, parking basements, cars, and captures screenshots', async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for viewerStore and switch to 3D viewer
    await page.waitForFunction(() => typeof (window as any).__viewerStore !== 'undefined', { timeout: 20000 });

    await page.evaluate(() => {
      (window as any).__viewerStore.setState({ appView: 'viewer', selectedFloor: null, selectedUnitId: null });
    });

    await page.waitForFunction(() => typeof (window as any).__viewer !== 'undefined', { timeout: 25000 });

    await page.evaluate(() => {
      const store = (window as any).__viewerStore;
      store.setState({ sceneReady: true, phase: 'overview', xrayMode: false, selectedFloor: null, selectedUnitId: null });
    });

    await page.waitForTimeout(2000);

    // Helpers to position camera & actors cleanly
    async function setOverviewView(xray = false, selFloor: number | null = null) {
      await page.evaluate(({ xrayMode, floorNum }) => {
        const v = (window as any).__viewer;
        const store = (window as any).__viewerStore;
        store.setState({ phase: 'overview', xrayMode, selectedFloor: floorNum, selectedUnitId: null });
        v.camera.position.set(0, 16, 42);
        v.camera.lookAt(0, 14, 0);
        if (v.controls) {
          v.controls.target.set(0, 14, 0);
          v.controls.update();
        }
        if (v.building) {
          v.building.position.set(0, 0, 0);
          v.building.visible = true;
        }
        if (v.extractedFloor) {
          v.extractedFloor.visible = false;
        }
      }, { xrayMode: xray, floorNum: selFloor });
      await page.waitForTimeout(600);
    }

    async function setExtractedView(fNum: number, unitId: string | null = null) {
      await page.evaluate(({ fl, uId }) => {
        const v = (window as any).__viewer;
        const store = (window as any).__viewerStore;
        store.setState({ phase: 'extracted', xrayMode: false, selectedFloor: fl, selectedUnitId: uId });
        v.camera.position.set(14, 24, 32);
        v.camera.lookAt(2, 8, 0);
        if (v.controls) {
          v.controls.target.set(2, 8, 0);
          v.controls.update();
        }
        if (v.building) {
          v.building.position.set(-12, 0, 0);
          v.building.visible = true;
        }
        if (v.extractedFloor) {
          v.extractedFloor.position.set(13, 0, 0);
          v.extractedFloor.scale.set(0.95, 0.95, 0.95);
          v.extractedFloor.visible = true;
        }
      }, { fl: fNum, uId: unitId });
      await page.waitForTimeout(600);
    }

    async function setSoloView(fNum: number) {
      await page.evaluate((fl) => {
        const v = (window as any).__viewer;
        const store = (window as any).__viewerStore;
        store.setState({ phase: 'floor_inspecting', xrayMode: false, selectedFloor: fl, selectedUnitId: null });
        v.camera.position.set(0, 22, 14);
        v.camera.lookAt(0, 0, 0);
        if (v.controls) {
          v.controls.target.set(0, 0, 0);
          v.controls.update();
        }
        if (v.building) {
          v.building.position.set(-48, 0, 0);
          v.building.visible = false;
        }
        if (v.extractedFloor) {
          v.extractedFloor.position.set(0, 0, 0);
          v.extractedFloor.scale.set(1.3, 1.3, 1.3);
          v.extractedFloor.visible = true;
        }
      }, fNum);
      await page.waitForTimeout(800);
    }

    // ── STEP 4 (Normal Tower Overview): Varied Balconies ────────────────────
    await setOverviewView(false);
    const normalOverviewPath = path.join(screenshotDir, '04-tower-normal-overview.png');
    await page.screenshot({ path: normalOverviewPath });
    console.log('[Screenshot 4 saved]:', normalOverviewPath);

    // ── STEP 3 (Tower X-Ray Overview): Different Partitions per Floor ────────
    await setOverviewView(true);
    const xrayOverviewPath = path.join(screenshotDir, '03-tower-xray-overview.png');
    await page.screenshot({ path: xrayOverviewPath });
    console.log('[Screenshot 3 saved]:', xrayOverviewPath);

    // ── STEP 6: B1 in X-Ray Overview ─────────────────────────────────────────
    await setOverviewView(true, -1);
    const b1XrayPath = path.join(screenshotDir, '06-b1-xray-overview.png');
    await page.screenshot({ path: b1XrayPath });
    console.log('[Screenshot 6 saved]:', b1XrayPath);

    // ── STEP 1: Extracted view of 4 different floors (1, 2, 3, 12) ───────────
    const testFloors = [1, 2, 3, 12];
    for (const fNum of testFloors) {
      await setExtractedView(fNum);
      const extPath = path.join(screenshotDir, `01-extracted-floor-${fNum}.png`);
      await page.screenshot({ path: extPath });
      console.log(`[Screenshot 1 (Floor ${fNum}) saved]:`, extPath);
    }

    // ── STEP 2: Solo view of the same four floors (1, 2, 3, 12) ─────────────
    for (const fNum of testFloors) {
      await setSoloView(fNum);
      const soloPath = path.join(screenshotDir, `02-solo-floor-${fNum}.png`);
      await page.screenshot({ path: soloPath });
      console.log(`[Screenshot 2 (Solo Floor ${fNum}) saved]:`, soloPath);
    }

    // ── Image-Difference Assertion: Floor 1 vs Floor 2 (> 2% differing pixels)
    const img1 = getPixelsFromPng(path.join(screenshotDir, '02-solo-floor-1.png'));
    const img2 = getPixelsFromPng(path.join(screenshotDir, '02-solo-floor-2.png'));

    let diffCount = 0;
    let sampledCount = 0;
    // Sample the center floor plate (25% to 75% width and height)
    for (let y = Math.floor(img1.height * 0.25); y < Math.floor(img1.height * 0.75); y += 3) {
      for (let x = Math.floor(img1.width * 0.25); x < Math.floor(img1.width * 0.75); x += 3) {
        sampledCount++;
        const [r1, g1, b1] = img1.getPixel(x, y);
        const [r2, g2, b2] = img2.getPixel(x, y);
        if (Math.abs(r1 - r2) > 15 || Math.abs(g1 - g2) > 15 || Math.abs(b1 - b2) > 15) {
          diffCount++;
        }
      }
    }
    const diffPct = (diffCount / sampledCount) * 100;
    console.log(`[Pixel Difference Floor 1 vs Floor 2]: ${diffPct.toFixed(2)}% differing pixels (threshold > 2.0%)`);
    expect(diffPct).toBeGreaterThan(2.0);

    // ── STEP 5: B1 Parking Solo View with Cars ────────────────────────────────
    await setSoloView(-1);
    const b1SoloPath = path.join(screenshotDir, '05-b1-parking-solo-cars.png');
    await page.screenshot({ path: b1SoloPath });
    console.log('[Screenshot 5 saved]:', b1SoloPath);

    // Validate car pixels and luminance on B1
    const b1Img = getPixelsFromPng(b1SoloPath);
    let darkIndigoCount = 0;
    let minCarLuminance = 1.0;

    // Sample the 3D floor plate scene (excluding 2D UI cards at left x < 320, top y < 70, bottom y > 840)
    for (let y = 80; y < b1Img.height - 70; y += 2) {
      for (let x = 320; x < b1Img.width - 60; x += 2) {
        const [r8, g8, b8] = b1Img.getPixel(x, y);
        const r = r8 / 255;
        const g = g8 / 255;
        const b = b8 / 255;

        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        // Dark-indigo car body tokens (#312E81 family: high blue, lower red/green, low lum)
        if (b > 0.25 && b > r + 0.08 && b > g + 0.08 && lum < 0.45) {
          darkIndigoCount++;
          if (lum < minCarLuminance) {
            minCarLuminance = lum;
          }
        }
      }
    }
    console.log(`[B1 Parking Cars Analysis]: darkIndigoCount=${darkIndigoCount}, minCarLuminance=${minCarLuminance.toFixed(3)}`);
    expect(darkIndigoCount).toBeGreaterThan(50);
    expect(minCarLuminance).toBeGreaterThanOrEqual(0.08);

    // ── STEP 7: Selected Flat with Unit Card ─────────────────────────────────
    await setExtractedView(3, 'KA-BLR-2024-F03-U01');
    const flatCardPath = path.join(screenshotDir, '07-selected-flat-card.png');
    await page.screenshot({ path: flatCardPath });
    console.log('[Screenshot 7 saved]:', flatCardPath);

    // ── STEP 8: Selected Parking Slot with its Card ──────────────────────────
    await setExtractedView(-1, 'KA-BLR-2024-B01-P07');
    const slotCardPath = path.join(screenshotDir, '08-selected-parking-slot-card.png');
    await page.screenshot({ path: slotCardPath });
    console.log('[Screenshot 8 saved]:', slotCardPath);

    // ── Performance & Draw Calls Reporting ──────────────────────────────────
    const perfReport = await page.evaluate(async () => {
      const v = (window as any).__viewer;
      const store = (window as any).__viewerStore;

      // 1. Tower X-ray calls
      store.setState({ phase: 'overview', xrayMode: true, selectedFloor: null, selectedUnitId: null });
      await new Promise((r) => setTimeout(r, 600));
      const towerXrayCalls = v.gl.info.render.calls;

      // 2. Extracted view without cars (residential floor 3)
      store.setState({ phase: 'extracted', xrayMode: false, selectedFloor: 3, selectedUnitId: null });
      await new Promise((r) => setTimeout(r, 600));
      const extractedNoCarsCalls = v.gl.info.render.calls;

      // 3. Extracted view with cars (parking basement -1)
      store.setState({ phase: 'extracted', xrayMode: false, selectedFloor: -1, selectedUnitId: null });
      await new Promise((r) => setTimeout(r, 600));
      const extractedWithCarsCalls = v.gl.info.render.calls;

      // 4. Frame time measurement in extracted view (30 frames)
      const frameTimes: number[] = [];
      let lastTime = performance.now();
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        const now = performance.now();
        frameTimes.push(now - lastTime);
        lastTime = now;
      }
      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;

      return {
        towerXrayCalls,
        extractedNoCarsCalls,
        extractedWithCarsCalls,
        avgFrameTimeMs: avgFrameTime.toFixed(2),
      };
    });

    console.log('\n======================================================');
    console.log('PART C PERFORMANCE & DRAW-CALLS REPORT:');
    console.log(`- Tower X-Ray render calls: ${perfReport.towerXrayCalls}`);
    console.log(`- Extracted view without cars (Residential F3): ${perfReport.extractedNoCarsCalls} calls`);
    console.log(`- Extracted view with cars (Parking B1): ${perfReport.extractedWithCarsCalls} calls`);
    console.log(`- Extracted view average frame time: ${perfReport.avgFrameTimeMs} ms (< 16.6 ms target)`);
    console.log('======================================================\n');
  });
});
