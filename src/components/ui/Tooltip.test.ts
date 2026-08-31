import { describe, it, expect } from 'vitest';
import { computeTooltipPosition } from './Tooltip';

describe('computeTooltipPosition', () => {
  const VIEWPORT_WIDTH = 1200;
  const VIEWPORT_HEIGHT = 800;
  const TOOLTIP_WIDTH = 100;
  const TOOLTIP_HEIGHT = 30;
  const GAP = 10;
  const PADDING = 8;

  it('flips from top to bottom when anchor is near the top edge of viewport', () => {
    // Anchor at top: 10px, bottom: 34px (not enough space above: 10 - 10 = 0 < 30 + 8)
    const anchor = {
      top: 10,
      bottom: 34,
      left: 1000,
      right: 1024,
      width: 24,
      height: 24,
    };

    const layout = computeTooltipPosition(
      anchor,
      TOOLTIP_WIDTH,
      TOOLTIP_HEIGHT,
      'top',
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      GAP,
      PADDING
    );

    expect(layout.placement).toBe('bottom');
    expect(layout.top).toBe(anchor.bottom + GAP); // 44
    expect(layout.top).toBeGreaterThanOrEqual(PADDING);
    expect(layout.top + TOOLTIP_HEIGHT).toBeLessThanOrEqual(VIEWPORT_HEIGHT - PADDING);
  });

  it('flips from bottom to top when anchor is near the bottom edge of viewport', () => {
    // Anchor near bottom: top: 760px, bottom: 790px (space below: 800 - 790 - 10 = 0)
    const anchor = {
      top: 760,
      bottom: 790,
      left: 500,
      right: 540,
      width: 40,
      height: 30,
    };

    const layout = computeTooltipPosition(
      anchor,
      TOOLTIP_WIDTH,
      TOOLTIP_HEIGHT,
      'bottom',
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      GAP,
      PADDING
    );

    expect(layout.placement).toBe('top');
    expect(layout.top).toBe(anchor.top - GAP - TOOLTIP_HEIGHT); // 760 - 10 - 30 = 720
    expect(layout.top).toBeGreaterThanOrEqual(PADDING);
  });

  it('flips from left to right when anchor is near the left edge of viewport', () => {
    // Anchor near left: left: 10px, right: 34px (space left: 10 - 10 = 0 < 100 + 8)
    const anchor = {
      top: 200,
      bottom: 224,
      left: 10,
      right: 34,
      width: 24,
      height: 24,
    };

    const layout = computeTooltipPosition(
      anchor,
      TOOLTIP_WIDTH,
      TOOLTIP_HEIGHT,
      'left',
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      GAP,
      PADDING
    );

    expect(layout.placement).toBe('right');
    expect(layout.left).toBe(anchor.right + GAP);
    expect(layout.left).toBeGreaterThanOrEqual(PADDING);
    expect(layout.left + TOOLTIP_WIDTH).toBeLessThanOrEqual(VIEWPORT_WIDTH - PADDING);
  });

  it('flips from right to left when anchor is near the right edge of viewport', () => {
    // Anchor near right: left: 1160px, right: 1190px (space right: 1200 - 1190 - 10 = 0)
    const anchor = {
      top: 200,
      bottom: 224,
      left: 1160,
      right: 1190,
      width: 30,
      height: 24,
    };

    const layout = computeTooltipPosition(
      anchor,
      TOOLTIP_WIDTH,
      TOOLTIP_HEIGHT,
      'right',
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      GAP,
      PADDING
    );

    expect(layout.placement).toBe('left');
    expect(layout.left).toBe(anchor.left - GAP - TOOLTIP_WIDTH);
    expect(layout.left + TOOLTIP_WIDTH).toBeLessThanOrEqual(VIEWPORT_WIDTH - PADDING);
  });

  it('clamps horizontal position when tooltip is centered but near the right window edge', () => {
    // Anchor at top-right corner: left: 1170, right: 1194, width: 24
    // anchorCenterX = 1182. Ideal left = 1182 - 50 = 1132.
    // 1132 + 100 = 1232 > 1200 - 8 (1192).
    const anchor = {
      top: 20,
      bottom: 44,
      left: 1170,
      right: 1194,
      width: 24,
      height: 24,
    };

    const layout = computeTooltipPosition(
      anchor,
      TOOLTIP_WIDTH,
      TOOLTIP_HEIGHT,
      'bottom',
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      GAP,
      PADDING
    );

    expect(layout.placement).toBe('bottom');
    expect(layout.left + TOOLTIP_WIDTH).toBeLessThanOrEqual(VIEWPORT_WIDTH - PADDING);
    expect(layout.left).toBe(VIEWPORT_WIDTH - PADDING - TOOLTIP_WIDTH); // 1092
    // Arrow should still point at anchor center relative to tooltip
    const anchorCenterX = 1170 + 12; // 1182
    const expectedArrowLeft = anchorCenterX - layout.left; // 1182 - 1092 = 90
    expect(layout.arrowLeft).toBe(Math.min(TOOLTIP_WIDTH - 12, expectedArrowLeft));
  });

  it('clamps vertical position when tooltip is positioned left/right but near top/bottom window edge', () => {
    // Anchor at right edge, but near very top of window (top: 10)
    const anchor = {
      top: 10,
      bottom: 34,
      left: 800,
      right: 824,
      width: 24,
      height: 24,
    };

    const layout = computeTooltipPosition(
      anchor,
      TOOLTIP_WIDTH,
      TOOLTIP_HEIGHT,
      'left',
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      GAP,
      PADDING
    );

    expect(layout.placement).toBe('left');
    expect(layout.top).toBeGreaterThanOrEqual(PADDING);
    expect(layout.top + TOOLTIP_HEIGHT).toBeLessThanOrEqual(VIEWPORT_HEIGHT - PADDING);
  });
});
