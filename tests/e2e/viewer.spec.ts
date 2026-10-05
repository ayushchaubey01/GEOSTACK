import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('3D Viewer Enterprise Visual Quality & Gate 1 Checks', () => {
  const screenshotDir = path.join(process.cwd(), 'tests', 'screenshots', 'after');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test('Captures 8 Gate 1 screenshots at 1440x900 and verifies pixel luminance', async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for store to hydrate
    await page.waitForFunction(() => typeof (window as any).__viewerStore !== 'undefined', { timeout: 15000 });

    // Transition to 3D Viewer view
    await page.evaluate(() => {
      (window as any).__viewerStore.setState({ appView: 'viewer', selectedFloor: null });
    });

    // Wait for 3D Scene and R3F canvas to mount
    await page.waitForFunction(() => typeof (window as any).__viewer !== 'undefined', { timeout: 20000 });

    // Force scene ready to dismiss loading screen
    await page.evaluate(() => {
      const store = (window as any).__viewerStore;
      store.setState({ sceneReady: true, phase: 'overview', xrayMode: false });
    });

    await page.waitForTimeout(1500);

    // Helper to evaluate pixel luminance and corner color
    const inspectCanvasPixels = async () => {
      return await page.evaluate(() => {
        const c = document.querySelector('canvas') as HTMLCanvasElement;
        if (!c) return { darkPct: 0, cornerHex: '#000000', r: 0, g: 0, b: 0 };
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        if (!gl) return { darkPct: 0, cornerHex: '#000000', r: 0, g: 0, b: 0 };

        const w = c.width;
        const h = c.height;
        const pixels = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        // Corner pixel at top-left: in WebGL, y=0 is bottom, so top-left is y = h - 4, x = 4
        const cornerIdx = ((h - 4) * w + 4) * 4;
        const r = pixels[cornerIdx];
        const g = pixels[cornerIdx + 1];
        const b = pixels[cornerIdx + 2];
        const cornerHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

        let darkCount = 0;
        const total = w * h;
        for (let i = 0; i < pixels.length; i += 4) {
          const lum = 0.2126 * (pixels[i] / 255) + 0.7152 * (pixels[i + 1] / 255) + 0.0722 * (pixels[i + 2] / 255);
          if (lum < 0.15) darkCount++;
        }
        const darkPct = (darkCount / total) * 100;
        return { darkPct, cornerHex, r, g, b };
      });
    };

    // ── 1. Overview normal (light background) ───────────────────────────────
    await page.evaluate(() => {
      const store = (window as any).__viewerStore;
      store.setState({ xrayMode: false, phase: 'overview', selectedFloor: null });
    });
    await page.waitForTimeout(1000);
    const shot1Path = path.join(screenshotDir, '01-overview-normal.png');
    await page.screenshot({ path: shot1Path });
    const pix1 = await inspectCanvasPixels();
    console.log(`[Screenshot 1] Dark pixel %: ${pix1.darkPct.toFixed(2)}%, Corner RGB: (${pix1.r}, ${pix1.g}, ${pix1.b})`);
    expect(pix1.darkPct).toBeLessThan(0.5);
    // #F6F7F9 is approx (246, 247, 249)
    expect(pix1.r).toBeGreaterThanOrEqual(240);
    expect(pix1.g).toBeGreaterThanOrEqual(240);
    expect(pix1.b).toBeGreaterThanOrEqual(240);

    // ── 2. Overview X-ray showing interior walls ────────────────────────────
    await page.evaluate(() => {
      const store = (window as any).__viewerStore;
      store.setState({ xrayMode: true, phase: 'overview', selectedFloor: null });
    });
    await page.waitForTimeout(1000);
    const shot2Path = path.join(screenshotDir, '02-overview-xray.png');
    await page.screenshot({ path: shot2Path });

    // ── 3. Close-up of one floor in X-ray ───────────────────────────────────
    await page.evaluate(() => {
      const v = (window as any).__viewer;
      if (v?.camera && v?.controls) {
        v.controls.target.set(0, 18, 0);
        v.camera.position.set(22, 20, 22);
        v.controls.update();
      }
    });
    await page.waitForTimeout(800);
    const shot3Path = path.join(screenshotDir, '03-closeup-floor-xray.png');
    await page.screenshot({ path: shot3Path });

    // ── 4. Extracted view normal ────────────────────────────────────────────
    await page.evaluate(() => {
      const store = (window as any).__viewerStore;
      store.setState({ xrayMode: false, selectedFloor: 3, phase: 'extracted' });
      const v = (window as any).__viewer;
      if (v?.camera && v?.controls) {
        v.controls.target.set(12, 10, 0);
        v.camera.position.set(38, 22, 38);
        v.controls.update();
      }
    });
    await page.waitForTimeout(1000);
    const shot4Path = path.join(screenshotDir, '04-extracted-normal.png');
    await page.screenshot({ path: shot4Path });
    const pix4 = await inspectCanvasPixels();
    console.log(`[Screenshot 4] Dark pixel %: ${pix4.darkPct.toFixed(2)}%, Corner RGB: (${pix4.r}, ${pix4.g}, ${pix4.b})`);
    expect(pix4.darkPct).toBeLessThan(0.5);
    expect(pix4.r).toBeGreaterThanOrEqual(240);

    // ── 5. Extracted view X-ray ─────────────────────────────────────────────
    await page.evaluate(() => {
      const store = (window as any).__viewerStore;
      store.setState({ xrayMode: true, selectedFloor: 3, phase: 'extracted' });
    });
    await page.waitForTimeout(1000);
    const shot5Path = path.join(screenshotDir, '05-extracted-xray.png');
    await page.screenshot({ path: shot5Path });

    // ── 6. Solo floor normal ────────────────────────────────────────────────
    await page.evaluate(() => {
      const store = (window as any).__viewerStore;
      store.setState({ xrayMode: false, selectedFloor: 3, phase: 'floor_inspecting' });
    });
    await page.waitForTimeout(1400);
    const shot6Path = path.join(screenshotDir, '06-solo-normal.png');
    await page.screenshot({ path: shot6Path });
    const pix6 = await inspectCanvasPixels();
    console.log(`[Screenshot 6] Dark pixel %: ${pix6.darkPct.toFixed(2)}%, Corner RGB: (${pix6.r}, ${pix6.g}, ${pix6.b})`);
    expect(pix6.darkPct).toBeLessThan(0.5);
    expect(pix6.r).toBeGreaterThanOrEqual(240);

    // ── 7. Solo floor X-ray ─────────────────────────────────────────────────
    await page.evaluate(() => {
      const store = (window as any).__viewerStore;
      store.setState({ xrayMode: true, selectedFloor: 3, phase: 'floor_inspecting' });
    });
    await page.waitForTimeout(1000);
    const shot7Path = path.join(screenshotDir, '07-solo-xray.png');
    await page.screenshot({ path: shot7Path });

    // ── 8. Solo with a unit selected ────────────────────────────────────────
    await page.evaluate(() => {
      const store = (window as any).__viewerStore;
      const bldg = store.getState().buildingData;
      const f3 = bldg?.floors?.find((f: any) => f.floorNumber === 3);
      const unitId = f3?.units?.[0]?.unitId || 'u-301';
      store.setState({ selectedFloor: 3, selectedUnitId: unitId, phase: 'floor_inspecting' });
    });
    await page.waitForTimeout(1400);
    const shot8Path = path.join(screenshotDir, '08-solo-unit-selected.png');
    await page.screenshot({ path: shot8Path });

    // Verify all 8 files exist on disk
    expect(fs.existsSync(shot1Path)).toBe(true);
    expect(fs.existsSync(shot2Path)).toBe(true);
    expect(fs.existsSync(shot3Path)).toBe(true);
    expect(fs.existsSync(shot4Path)).toBe(true);
    expect(fs.existsSync(shot5Path)).toBe(true);
    expect(fs.existsSync(shot6Path)).toBe(true);
    expect(fs.existsSync(shot7Path)).toBe(true);
    expect(fs.existsSync(shot8Path)).toBe(true);
  });
});
