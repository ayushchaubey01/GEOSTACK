import { test } from '@playwright/test';

test('capture screenshots', async ({ page }) => {
  // Mobile size for responsive design verification
  await page.setViewportSize({ width: 390, height: 844 });
  
  await page.goto('http://localhost:3000/');
  
  // Wait for the map to load
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'artifacts/mobile_2d_view.png' });

  // Click on a colony
  await page.mouse.click(200, 400); // Random click to enter a colony
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'artifacts/mobile_2d_colony.png' });

  // Open 3D viewer (by clicking a building, or just navigating to a mock URL if routing allows)
  // Since we don't know exact coordinates, we can try to click on the map center
  await page.mouse.click(200, 400);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'artifacts/mobile_3d_view.png' });
});
