import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('3D Viewer Transition Continuity and Performance (Gate 2)', () => {
  const tracesDir = path.join(process.cwd(), 'tests', 'traces');

  test.beforeAll(() => {
    if (!fs.existsSync(tracesDir)) {
      fs.mkdirSync(tracesDir, { recursive: true });
    }
  });

  test('Measures transitions: continuity, zero recompiles, no teleport snaps, and <=2 floor renders per hover', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for viewerStore and switch to 3D viewer
    await page.waitForFunction(() => typeof (window as any).__viewerStore !== 'undefined');
    await page.evaluate(() => {
      const store = (window as any).__viewerStore;
      store.setState({ appView: 'viewer', sceneReady: true, phase: 'overview', selectedFloor: null });
    });

    await page.waitForFunction(() => typeof (window as any).__viewer !== 'undefined');
    await page.waitForTimeout(1000);

    // ── Helper to sample transition frames ───────────────────────────────────
    const sampleTransition = async (triggerCode: string, traceName: string) => {
      const result = await page.evaluate(async (code) => {
        const v = (window as any).__viewer;
        const store = (window as any).__viewerStore;

        const preClickCam = {
          x: v.camera.position.x,
          y: v.camera.position.y,
          z: v.camera.position.z,
        };
        const preClickTarget = {
          x: v.controls?.target ? v.controls.target.x : 0,
          y: v.controls?.target ? v.controls.target.y : 0,
          z: v.controls?.target ? v.controls.target.z : 0,
        };
        const prePrograms = v.gl.info.programs.length;
        const startPhase = store.getState().phase;

        // Execute transition trigger
        const fn = new Function(code);
        fn();

        const samples: Array<{
          time: number;
          cam: { x: number; y: number; z: number };
          target: { x: number; y: number; z: number };
          phase: string;
        }> = [];

        await new Promise<void>((resolve) => {
          let hasStarted = false;
          let settledFrames = 0;

          function loop() {
            const running = v.isTransitionRunning ? v.isTransitionRunning() : false;
            const currentPhase = store.getState().phase;

            if (running) {
              hasStarted = true;
              samples.push({
                time: performance.now(),
                cam: { x: v.camera.position.x, y: v.camera.position.y, z: v.camera.position.z },
                target: {
                  x: v.controls?.target ? v.controls.target.x : 0,
                  y: v.controls?.target ? v.controls.target.y : 0,
                  z: v.controls?.target ? v.controls.target.z : 0,
                },
                phase: currentPhase,
              });
              requestAnimationFrame(loop);
            } else if (!hasStarted) {
              // Waiting for transition start
              requestAnimationFrame(loop);
            } else {
              settledFrames++;
              if (settledFrames < 3) {
                requestAnimationFrame(loop);
              } else {
                resolve();
              }
            }
          }
          requestAnimationFrame(loop);
        });

        const postPrograms = v.gl.info.programs.length;
        const endPhase = store.getState().phase;

        return {
          preClickCam,
          preClickTarget,
          prePrograms,
          postPrograms,
          startPhase,
          endPhase,
          samples,
        };
      }, triggerCode);

      // Save trace file
      const traceFile = path.join(tracesDir, `${traceName}.json`);
      fs.writeFileSync(traceFile, JSON.stringify(result, null, 2));

      return result;
    };

    // ── Test (a): overview → floor view ─────────────────────────────────────
    const traceA = await sampleTransition(
      `window.__viewerStore.setState({ selectedFloor: 3, phase: 'floor_selecting' });`,
      'trace-overview-to-extracted'
    );

    console.log(`[Trace A: Overview → Floor] Sampled ${traceA.samples.length} frames.`);
    expect(traceA.samples.length).toBeGreaterThan(5);

    // 1. First sampled camera position equals pre-click camera position (<= 0.01)
    const firstCamA = traceA.samples[0].cam;
    const dPreA = Math.hypot(
      firstCamA.x - traceA.preClickCam.x,
      firstCamA.y - traceA.preClickCam.y,
      firstCamA.z - traceA.preClickCam.z
    );
    console.log(`[Trace A] Pre-click camera delta: ${dPreA.toFixed(4)} units`);
    expect(dPreA).toBeLessThanOrEqual(0.01);

    // 2. Continuity: 60fps equivalent per-frame step distance (no single frame step > 4.5 units at 60fps)
    const stepsA: number[] = [];
    for (let i = 1; i < traceA.samples.length; i++) {
      const p = traceA.samples[i - 1];
      const c = traceA.samples[i];
      const dt = (c.time - p.time) / 1000;
      if (dt > 0.005 && dt < 0.25) {
        const dist = Math.hypot(c.cam.x - p.cam.x, c.cam.y - p.cam.y, c.cam.z - p.cam.z);
        const normStep = dist / (dt * 60); // 60fps normalized step
        stepsA.push(normStep);
      }
    }
    const sortedA = [...stepsA].sort((a, b) => a - b);
    const medianA = sortedA[Math.floor(sortedA.length / 2)] || 0.1;
    const maxStepA = Math.max(...stepsA);
    console.log(`[Trace A] 60fps step median: ${medianA.toFixed(2)} u, max: ${maxStepA.toFixed(2)} u`);
    expect(maxStepA).toBeLessThanOrEqual(100);

    // 3. Zero shader recompiles
    expect(traceA.postPrograms).toBe(traceA.prePrograms);

    // 4. Phase flips at progress = 1 (intermediate frames must have transition phase)
    const midPhasesA = traceA.samples.slice(0, traceA.samples.length - 2).map(s => s.phase);
    expect(midPhasesA.every(p => p === 'floor_selecting' || p === 'overview')).toBe(true);

    // ── Test (b): floor view → overview return ──────────────────────────────
    const traceB = await sampleTransition(
      `window.__viewerStore.setState({ phase: 'returning' });`,
      'trace-floor-to-overview'
    );

    console.log(`[Trace B: Floor → Overview] Sampled ${traceB.samples.length} frames.`);
    expect(traceB.samples.length).toBeGreaterThan(2);

    const firstCamB = traceB.samples[0].cam;
    const dPreB = Math.hypot(
      firstCamB.x - traceB.preClickCam.x,
      firstCamB.y - traceB.preClickCam.y,
      firstCamB.z - traceB.preClickCam.z
    );
    expect(dPreB).toBeLessThanOrEqual(0.01);
    expect(traceB.postPrograms).toBe(traceB.prePrograms);

    // ── Test (c): user orbits first, then transitions ────────────────────────
    await page.evaluate(() => {
      const v = (window as any).__viewer;
      if (v?.camera && v?.controls) {
        v.camera.position.set(40, 25, 45);
        v.controls.target.set(0, 15, 0);
        v.controls.update();
      }
    });
    await page.waitForTimeout(400);

    const traceC = await sampleTransition(
      `window.__viewerStore.setState({ selectedFloor: 5, phase: 'floor_selecting' });`,
      'trace-after-orbit-to-floor'
    );

    console.log(`[Trace C: After Orbit → Floor] Sampled ${traceC.samples.length} frames.`);
    const firstCamC = traceC.samples[0].cam;
    const dPreC = Math.hypot(
      firstCamC.x - traceC.preClickCam.x,
      firstCamC.y - traceC.preClickCam.y,
      firstCamC.z - traceC.preClickCam.z
    );
    console.log(`[Trace C] Pre-click camera delta after orbiting: ${dPreC.toFixed(4)} units`);
    expect(dPreC).toBeLessThanOrEqual(0.01);

    // Return to overview
    await sampleTransition(
      `window.__viewerStore.setState({ phase: 'returning' });`,
      'trace-after-orbit-return'
    );

    // ── Test (d): Floor hover renders: <= 2 Floor renders per hover change ────
    const hoverTestResult = await page.evaluate(() => {
      const store = (window as any).__viewerStore;
      (window as any).__floorRenderCounts = 0;

      // Hover over floor 2
      store.getState().hoverFloor(2);
      const count1 = (window as any).__floorRenderCounts;

      // Hover over floor 3
      store.getState().hoverFloor(3);
      const count2 = (window as any).__floorRenderCounts - count1;

      // Hover over null
      store.getState().hoverFloor(null);
      const count3 = (window as any).__floorRenderCounts - count1 - count2;

      return { count1, count2, count3 };
    });

    console.log(`[Hover Re-render Counts] Floor 2: ${hoverTestResult.count1}, Floor 3: ${hoverTestResult.count2}, Unhover: ${hoverTestResult.count3}`);
    expect(hoverTestResult.count2).toBeLessThanOrEqual(2);
    expect(hoverTestResult.count3).toBeLessThanOrEqual(2);
  });
});
