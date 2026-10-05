'use client';

/**
 * LoadingScreen.tsx
 *
 * Light-theme loading state shown until the WebGL scene has booted.
 * Uses Tailwind tokens + indigo progress bar.
 * Minimum text size: 11px per design tokens.
 */

import { motion } from 'framer-motion';
import { useViewerStore } from '@/lib/viewer-store';

const PHASES = ['SHADERS', 'GEOMETRY', 'LIGHTING', 'SCENE'] as const;

export default function LoadingScreen() {
  const loadProgress = useViewerStore((s) => s.loadProgress);
  const pct = Math.round(loadProgress * 100);

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      <div className="flex flex-col items-center gap-8 px-8">
        {/* Logo mark */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <div className="w-3 h-3 rounded-sm bg-primary animate-pulse" />
          </div>
          <div className="text-xs font-mono-nums uppercase tracking-[0.35em] text-muted-foreground font-medium">
            3D ULPIN · Vertical Mapping
          </div>
        </div>

        {/* Headline */}
        <motion.h1
          className="text-3xl md:text-4xl font-semibold text-foreground text-center tracking-tight"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          style={{ letterSpacing: '-0.025em' }}
        >
          Preparing 3D Property Model
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="text-sm text-muted-foreground text-center max-w-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          Phase 1 prototype · Synthetic demo data · Not official ULPINs
        </motion.p>

        {/* Progress bar */}
        <div className="w-72 md:w-96 flex flex-col gap-2">
          <div className="h-1 w-full rounded-full bg-border overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              style={{ width: `${pct}%` }}
              transition={{ ease: 'linear', duration: 0.1 }}
            />
          </div>
          <div className="flex justify-between text-xs font-mono-nums text-muted-foreground">
            <span>Loading geometry</span>
            <span>{pct.toString().padStart(3, '0')}%</span>
          </div>
        </div>

        {/* Phase chips */}
        <div className="flex gap-2 flex-wrap justify-center mt-1">
          {PHASES.map((phase, i) => {
            const active = loadProgress > i * 0.25;
            return (
              <motion.div
                key={phase}
                className="text-xs font-mono-nums uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg border transition-all duration-300"
                style={{
                  background: active ? 'var(--primary-50)' : 'transparent',
                  borderColor: active ? 'var(--primary-200)' : 'var(--border)',
                  color: active ? 'var(--primary-700)' : 'var(--text-subtle)',
                }}
              >
                {phase}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-6 right-6 flex justify-between text-xs font-mono-nums text-muted-foreground">
        <span>SIH26011 · DoLR · Phase 1 Prototype</span>
        <span>Bengaluru</span>
      </div>
    </motion.div>
  );
}
