import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('3-Step Floor Inspection Flow', () => {
  const screenshotsDir = path.join(process.cwd(), 'tests', 'screenshots', 'after');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('Captures 3-step flow screenshots', async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for viewerStore and switch to 3D viewer
    await page.waitForFunction(() => typeof (window as any).__viewerStore !== 'undefined', { timeout: 15000 });

    await page.evaluate(() => {
      (window as any).__viewerStore.setState({ appView: 'viewer', selectedFloor: null });
    });

    await page.waitForFunction(() => typeof (window as any).__viewer !== 'undefined', { timeout: 20000 });

    await page.evaluate(() => {
      const store = (window as any).__viewerStore;
      store.setState({ sceneReady: true, phase: 'overview', xrayMode: false });
    });

    await page.waitForTimeout(1500);

    // ── STEP 1: Building Overview ──────────────────────────────────────────
    const state1 = await page.evaluate(() => {
      const v = (window as any).__viewer;
      const store = (window as any).__viewerStore;
      return {
        phase: store.getState().phase,
        buildingX: v.building?.position.x,
        buildingVisible: v.building?.visible,
        floorVisible: v.extractedFloor?.visible,
      };
    });
    console.log('[Step 1 Overview]', state1);
    expect(state1.phase).toBe('overview');
    expect(state1.buildingX).toBe(0);
    expect(state1.buildingVisible).toBe(true);

    await page.screenshot({ path: path.join(screenshotsDir, '01-step-building-overview.png') });

    // ── STEP 2: Click floor -> Floor Beside Building ────────────────────────
    await page.evaluate(() => {
      const store = (window as any).__viewerStore;
      store.getState().selectFloor(3);
      store.getState().setPhase('floor_selecting');
    });

    await page.waitForFunction(() => {
      const v = (window as any).__viewer;
      const store = (window as any).__viewerStore;
      return !v.isTransitionRunning() && store.getState().phase === 'extracted';
    }, { timeout: 10000 });

    const inspectBtn = page.locator('button:has-text("Inspect Floor Layout")');
    await expect(inspectBtn).toBeVisible();

    const state2 = await page.evaluate(() => {
      const v = (window as any).__viewer;
      const store = (window as any).__viewerStore;
      return {
        phase: store.getState().phase,
        selectedFloor: store.getState().selectedFloor,
        buildingX: v.building?.position.x,
        buildingVisible: v.building?.visible,
        floorX: v.extractedFloor?.position.x,
        floorVisible: v.extractedFloor?.visible,
      };
    });
    console.log('[Step 2 Extracted / Floor Beside Building]', state2);
    expect(state2.phase).toBe('extracted');
    expect(state2.selectedFloor).toBe(3);
    expect(state2.buildingX).toBe(-12);
    expect(state2.buildingVisible).toBe(true);
    expect(state2.floorX).toBe(13);
    expect(state2.floorVisible).toBe(true);

    await page.screenshot({ path: path.join(screenshotsDir, '02-step-floor-beside-building.png') });

    // ── STEP 3: Click Inspect Floor Layout -> Separate Floor View ───────────
    await inspectBtn.click();

    await page.waitForFunction(() => {
      const v = (window as any).__viewer;
      const store = (window as any).__viewerStore;
      return !v.isTransitionRunning() && store.getState().phase === 'floor_inspecting';
    }, { timeout: 10000 });

    const returnBesideBtn = page.locator('button:has-text("Floor Beside Building")');
    await expect(returnBesideBtn).toBeVisible();

    const state3 = await page.evaluate(() => {
      const v = (window as any).__viewer;
      const store = (window as any).__viewerStore;
      return {
        phase: store.getState().phase,
        buildingX: v.building?.position.x,
        buildingVisible: v.building?.visible,
        floorX: v.extractedFloor?.position.x,
        floorVisible: v.extractedFloor?.visible,
      };
    });
    console.log('[Step 3 Solo Floor View]', state3);
    expect(state3.phase).toBe('floor_inspecting');
    expect(state3.buildingX).toBe(-48);
    expect(state3.buildingVisible).toBe(false);
    expect(state3.floorX).toBe(0);
    expect(state3.floorVisible).toBe(true);

    await page.screenshot({ path: path.join(screenshotsDir, '03-step-separate-floor-view.png') });
  });
});
