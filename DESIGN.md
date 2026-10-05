# DESIGN.md - 3D ULPIN Vertical Property Mapping System
## Visual Language (fixed decisions, not suggestions)

### Theme
**Light.** The shell is always light. The 3D canvas backdrop is neutral near-white (#F8F9FB). No dark mode toggle. The 3D viewer HUD chrome (cards, buttons, hint bar, top bar) is light-on-white.

### Colour Palette
- Primary (accent): Indigo 600 - oklch(0.51 0.21 265)
- Primary foreground: White
- Background: oklch(0.98 0.003 265) - near-white with faint indigo cast
- Foreground: oklch(0.13 0.02 265) - near-black
- Card: oklch(1 0 0) - pure white
- Muted: oklch(0.95 0.006 265)
- Muted-foreground: oklch(0.50 0.012 265)
- Border: oklch(0.88 0.010 265)
- Ring: oklch(0.65 0.19 265) - Indigo 400
- Destructive: oklch(0.58 0.22 25)
Underground floors: amber oklch(0.72 0.15 80) accent.

### Typography
- Sans/UI: Inter (Google Fonts, 300-700) -> --font-sans
- Mono/codes: JetBrains Mono (Google Fonts, 400-500) -> --font-mono

### Visual Style
Whimsical/Linear shell: clean, high-contrast, structured. No glassmorphism. Cards have 1px border and white fill. Active states use indigo accent with subtle indigo-tinted background.

### Honesty constraints (from PRODUCT.md)
- Labels 'Estimated' on all ML-derived heights and floor counts.
- Labels 'Synthetic demo data' on mock units.
- ULPIN column described as 'source ULPIN-labelled field' until D-2 resolved.
