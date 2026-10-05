import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const viewports = [
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '390x844', width: 390, height: 844 },
];

test.describe('Smoke tests - baseline map loading and viewports', () => {
  for (const vp of viewports) {
    test(`loads / at ${vp.name}, checks canvas, console errors, and captures screenshot`, async ({ page }) => {
      const consoleErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Ignore external tile network fetch errors in offline/sandboxed environments
          const isNetworkTileError =
            text.includes('ERR_NAME_NOT_RESOLVED') ||
            text.includes('tile.openstreetmap.org') ||
            text.includes('Failed to load resource') ||
            text.includes('AJAXError: Failed to fetch');

          if (!isNetworkTileError) {
            consoleErrors.push(text);
          }
        }
      });

      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Wait for map canvas to appear
      const canvas = page.locator('canvas.maplibregl-canvas, canvas').first();
      await expect(canvas).toBeVisible({ timeout: 30000 });

      // Allow a brief moment for initial render
      await page.waitForTimeout(1000);

      // Ensure screenshots directory exists
      const screenshotDir = path.join(process.cwd(), 'tests', 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      // Capture screenshot at this viewport
      await page.screenshot({
        path: path.join(screenshotDir, `smoke-${vp.name}.png`),
        fullPage: false,
      });

      // Assert there are no application console errors
      expect(consoleErrors).toEqual([]);
    });
  }
});
