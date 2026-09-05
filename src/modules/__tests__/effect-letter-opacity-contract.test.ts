import fs from 'node:fs';
import path from 'node:path';
import {
  applyEffectLetterOpacity,
  EFFECT_LETTER_OPACITY_RANGE,
  resolveEffectLetterOpacity,
} from '../effect-letter-opacity';

const read = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('shared gameplay effect-letter opacity', () => {
  test('matches the accepted Boooing 80-100 percent per-letter range by default', () => {
    expect(EFFECT_LETTER_OPACITY_RANGE).toEqual([0.8, 1]);
    expect(resolveEffectLetterOpacity(undefined, 0)).toBe(0.8);
    expect(resolveEffectLetterOpacity(undefined, 0.5)).toBe(0.9);
    expect(resolveEffectLetterOpacity(undefined, 1)).toBe(1);
    expect(applyEffectLetterOpacity('#E09FEF', 0.8)).toBe('rgba(224,159,239,0.80)');
  });

  test('is consumed by every gameplay finale text renderer', () => {
    const splash = read('src/modules/splash-text-overlay.ts');
    const bubbly = read('src/modules/wild-juice-bubbles-explosion.ts');
    const tnt = read('src/modules/tnt-animation.ts');

    expect(splash.match(/resolveEffectLetterOpacity\(/g)).toHaveLength(2);
    expect(splash).toContain('applyEffectLetterOpacity(lightColor, letterAlpha)');
    expect(splash).toContain('resolveSplashLetterOpacity(options?.letterOpacityRange)');
    expect(splash).toContain(
      'const visibleLightColor = applyEffectLetterOpacity(sparkleLightColor, letterAlpha)',
    );
    expect(splash).toContain(
      'const visibleDarkColor = applyEffectLetterOpacity(sparkleDarkColor, letterAlpha)',
    );
    expect(splash).toContain(
      'const visibleSparkleColor = index < sparkleSplitIndex ? visibleLightColor : visibleDarkColor',
    );
    expect(bubbly).toContain('const letterAlpha = resolveEffectLetterOpacity()');
    expect(bubbly).not.toContain('options.text ? 0.8 + Math.random() * 0.2 : 1');
    expect(tnt).toContain('resolveEffectLetterOpacity(options.letterOpacityRange)');
    expect(tnt).toContain('applyEffectLetterOpacity(lightColor, letterAlpha)');
  });
});
