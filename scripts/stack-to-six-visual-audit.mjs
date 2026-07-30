import fs from 'node:fs';

const collectibleCss = fs.readFileSync('src/collectibles-screen.css', 'utf8');
const styleCss = fs.readFileSync('src/style.css', 'utf8');

function selectorBlock(source, selectorPattern) {
  const match = source.match(new RegExp(`${selectorPattern}\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  return match?.[1] ?? '';
}

const blocks = {
  journeyRoot: selectorBlock(collectibleCss, '#journey-screen,\\s*\\.journey-screen'),
  scrollOwner: selectorBlock(collectibleCss, '\\.collectibles-scrollable:has\\(#journey-boards-container\\)'),
  edgeToEdge: selectorBlock(collectibleCss, '\\.collectibles-section:has\\(#journey-boards-container\\)'),
  cloudLayer: selectorBlock(collectibleCss, '\\.journey-v700-hub-cloud-layer'),
  cloud: selectorBlock(collectibleCss, '\\.journey-v700-hub-cloud'),
  bottomDecor: selectorBlock(styleCss, '\\.journey-game-bottom-decor'),
};

const checks = [
  ['Journey root clips physical viewport', blocks.journeyRoot, [/overflow:\s*hidden/, /overflow-x:\s*clip/, /width:\s*100vw/, /max-width:\s*100vw/]],
  ['Journey scroll owner hides horizontal overflow', blocks.scrollOwner, [/overflow-x:\s*hidden\s*!important/, /scrollbar-width:\s*none/]],
  ['Journey Worlds section reaches both viewport edges', blocks.edgeToEdge, [/margin-left:\s*calc\(-1\s*\*\s*var\(--pad-left,\s*24px\)\)\s*!important/, /width:\s*calc\(100%\s*\+\s*var\(--pad-left,\s*24px\)\s*\+\s*var\(--pad-right,\s*24px\)\)\s*!important/]],
  ['Journey cloud layer escapes inner padding without exposing a tile seam', blocks.cloudLayer, [/left:\s*calc\(-1\s*\*\s*var\(--pad-left,\s*24px\)\)/, /right:\s*calc\(-1\s*\*\s*var\(--pad-right,\s*24px\)\)/, /width:\s*calc\(100%\s*\+\s*var\(--pad-left,\s*24px\)\s*\+\s*var\(--pad-right,\s*24px\)\)/, /overflow:\s*hidden/]],
  ['Journey cloud coordinates compensate for expanded layer', blocks.cloud, [/left:\s*calc\(var\(--cloud-x,\s*0px\)\s*\+\s*var\(--pad-left,\s*24px\)\)/]],
  ['Journey bottom decor stays bottom-anchored', blocks.bottomDecor, [/bottom:\s*-1px/, /width:\s*100vw/, /transform-origin:\s*50%\s*100%/]],
];

let failures = 0;
for (const [label, block, assertions] of checks) {
  const passed = Boolean(block) && assertions.every((assertion) => assertion.test(block));
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}`);
  if (!passed) failures += 1;
}

if (failures) {
  console.error(`FAIL: ${failures} visual contract check${failures === 1 ? '' : 's'} failed.`);
  process.exit(1);
}

console.log('PASS: Stack to Six static visual contracts are intact.');
