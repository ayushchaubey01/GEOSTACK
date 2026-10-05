import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

test.describe('Accessibility audit', () => {
  test('runs axe-core on / and writes violations to tests/a11y-report.json', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for map canvas to appear
    const canvas = page.locator('canvas.maplibregl-canvas, canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1000);

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    const reportPath = path.join(process.cwd(), 'tests', 'a11y-report.json');
    const testsDir = path.dirname(reportPath);
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }

    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          url: page.url(),
          violationsCount: accessibilityScanResults.violations.length,
          violations: accessibilityScanResults.violations,
          passesCount: accessibilityScanResults.passes.length,
          incompleteCount: accessibilityScanResults.incomplete.length,
        },
        null,
        2
      )
    );

    console.log(
      `[a11y] Found ${accessibilityScanResults.violations.length} accessibility violations. Report written to ${reportPath}`
    );
  });
});
