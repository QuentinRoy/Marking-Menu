import type { LayoutInput } from '../label-layout.js';

// Named fixtures shared by the correctness and performance test files, kept
// out of the published bundle (nothing under `src/index.ts` imports this
// module). Matches the production CSS defaults in `menu.css` unless a
// fixture needs otherwise.
const DEFAULT_RING_RADIUS = 80;
const DEFAULT_CLEARANCES = {
  plateHorizontal: 14,
  plateVertical: 7,
  plateToRing: 12,
  plateToConnector: 3,
};

function evenlySpaced(
  count: number,
  width: number,
  height: number,
): LayoutInput {
  return {
    plates: Array.from({ length: count }, (_, index) => ({
      angle: (360 / count) * index,
      width,
      height,
    })),
    ringRadius: DEFAULT_RING_RADIUS,
    clearances: DEFAULT_CLEARANCES,
  };
}

// A single item has no cyclic neighbor, so no association sector constrains it.
export const singleItem = evenlySpaced(1, 120, 20);

export const evenlySpaced4 = evenlySpaced(4, 120, 20);
export const evenlySpaced8 = evenlySpaced(8, 120, 20);
// Forward-looking stress cases beyond today's real 8-item ceiling (#274).
export const evenlySpaced12 = evenlySpaced(12, 100, 20);
export const evenlySpaced16 = evenlySpaced(16, 90, 20);

export const uniformWidths = evenlySpaced(8, 100, 24);

export const alternatingWidths: LayoutInput = {
  plates: Array.from({ length: 8 }, (_, index) => ({
    angle: 45 * index,
    width: index % 2 === 0 ? 60 : 160,
    height: 20,
  })),
  ringRadius: DEFAULT_RING_RADIUS,
  clearances: DEFAULT_CLEARANCES,
};

export const oneExtremeWidth: LayoutInput = {
  plates: Array.from({ length: 8 }, (_, index) => ({
    angle: 45 * index,
    width: index === 0 ? 300 : 80,
    height: 20,
  })),
  ringRadius: DEFAULT_RING_RADIUS,
  clearances: DEFAULT_CLEARANCES,
};

export const asymmetricWidths: LayoutInput = {
  plates: [60, 90, 130, 70, 200, 85, 110, 150].map((width, index) => ({
    angle: 45 * index,
    width,
    height: 18 + (index % 3) * 4,
  })),
  ringRadius: DEFAULT_RING_RADIUS,
  clearances: DEFAULT_CLEARANCES,
};

// Two items a fraction of a degree apart: no shared radius, however large,
// separates them, so this must resolve `oversized`.
export const oversized: LayoutInput = {
  plates: [
    { angle: 0, width: 120, height: 20 },
    { angle: 0.3, width: 120, height: 20 },
  ],
  ringRadius: DEFAULT_RING_RADIUS,
  clearances: DEFAULT_CLEARANCES,
};

// Several items packed into a narrow angular band alongside normally spaced
// ones, to exercise tight association sectors.
export const clusteredAngles: LayoutInput = {
  plates: [0, 15, 30, 120, 180, 240, 300, 330].map((angle) => ({
    angle,
    width: 90,
    height: 20,
  })),
  ringRadius: DEFAULT_RING_RADIUS,
  clearances: DEFAULT_CLEARANCES,
};

// Valid manual angles create both the narrowest and widest wedge sectors.
export const unevenSpacing: LayoutInput = {
  plates: [
    { angle: 0, label: 'Right' },
    { angle: 45, label: 'Down-right' },
    { angle: 90, label: 'Down' },
    { angle: 270, label: 'Up' },
  ].map(({ label, angle }) => ({
    angle,
    height: 20,
    width: 24 + label.length * 8,
  })),
  ringRadius: DEFAULT_RING_RADIUS,
  clearances: DEFAULT_CLEARANCES,
};

// Items on both sides of the 0/360 degree wrap.
export const boundaryCrossing: LayoutInput = {
  plates: [350, 10, 90, 180, 270].map((angle) => ({
    angle,
    width: 100,
    height: 20,
  })),
  ringRadius: DEFAULT_RING_RADIUS,
  clearances: DEFAULT_CLEARANCES,
};

// The exact production defaults at today's real maximum item count, with
// realistic varied label widths: the benchmark case.
export const default8ItemMenu: LayoutInput = {
  plates: [
    'Open',
    'Save a copy',
    'Close',
    'Preferences',
    'Export as PDF',
    'Print',
    'Share',
    'Recent documents',
  ].map((label, index) => ({
    angle: 45 * index,
    width: 24 + label.length * 8,
    height: 20,
  })),
  ringRadius: DEFAULT_RING_RADIUS,
  clearances: DEFAULT_CLEARANCES,
};

export const corpus: Record<string, LayoutInput> = {
  singleItem,
  evenlySpaced4,
  evenlySpaced8,
  evenlySpaced12,
  evenlySpaced16,
  uniformWidths,
  alternatingWidths,
  oneExtremeWidth,
  asymmetricWidths,
  clusteredAngles,
  unevenSpacing,
  boundaryCrossing,
  default8ItemMenu,
};
