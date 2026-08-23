import fs from 'fs';
import path from 'path';
import postcss, { type Declaration, type Rule } from 'postcss';

const SCREEN_ROOT_SELECTORS = new Set([
  '#app',
  '#app canvas',
  '#home',
  '#slider-wrapper',
  '#slider-dots',
  '#journey-screen',
  '.journey-screen',
  '#collectibles-screen',
  '#collectibles-detail-modal',
  '#independent-nav',
  '.independent-nav',
]);

function collectCssFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectCssFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.css') ? [entryPath] : [];
  });
}

const ROOT_LIFECYCLE_PROPERTIES = new Set([
  'display',
  'visibility',
  'opacity',
  'pointer-events',
  'transform',
  'animation',
  'transition',
  'will-change',
]);

function readRules(): Rule[] {
  return collectCssFiles(path.resolve(process.cwd(), 'src')).flatMap((absoluteFile) => {
    const root = postcss.parse(fs.readFileSync(absoluteFile, 'utf8'), { from: absoluteFile });
    const rules: Rule[] = [];
    root.walkRules((rule) => {
      rules.push(rule);
    });
    return rules;
  });
}

function importantLifecycleDeclarations(rule: Rule, properties: Set<string>): Declaration[] {
  const declarations: Declaration[] = [];
  rule.walkDecls((declaration) => {
    if (declaration.important && properties.has(declaration.prop)) declarations.push(declaration);
  });
  return declarations;
}

describe('CSS runtime ownership', () => {
  test('base screen and canvas rules cannot override JavaScript lifecycle state', () => {
    const conflicts = readRules().flatMap((rule) => {
      const ownedSelectors = rule.selectors.filter((selector) => SCREEN_ROOT_SELECTORS.has(selector.trim()));
      if (ownedSelectors.length === 0) return [];
      return importantLifecycleDeclarations(rule, ROOT_LIFECYCLE_PROPERTIES).map((declaration) => ({
        selector: ownedSelectors.join(', '),
        property: declaration.prop,
        file: path.relative(process.cwd(), declaration.source?.input.file ?? ''),
        line: declaration.source?.start?.line,
      }));
    });

    expect(conflicts).toEqual([]);
  });

  test('Journey detail description remains available to its GSAP visibility owner', () => {
    const visibilityProperties = new Set(['visibility', 'opacity', 'transform']);
    const conflicts = readRules().flatMap((rule) => {
      if (!rule.selectors.some((selector) => selector.trim() === '#collectibles-detail-modal .detail-description')) {
        return [];
      }
      return importantLifecycleDeclarations(rule, visibilityProperties).map((declaration) => declaration.prop);
    });

    expect(conflicts).toEqual([]);
  });
});
