import { describe, expect, it } from 'vitest';
import { colorForUser, selectionColor } from '../utils/color.js';

describe('deterministic user color', () => {
  it('is stable for the same userId', () => {
    expect(colorForUser('alice')).toBe(colorForUser('alice'));
  });
  it('returns a hex color from the palette', () => {
    expect(colorForUser('bob')).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it('derives a translucent selection color', () => {
    expect(selectionColor('#30bced')).toBe('#30bced33');
  });
});
