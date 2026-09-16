import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

type AssetContract = {
  file: string;
  width: number;
  height: number;
  sha256: string;
};

const assets: AssetContract[] = [
  {
    file: 'assets/shop/bush/flower-pixi-source.png',
    width: 256,
    height: 256,
    sha256: '7476fb3784b8279a7a54f280bfde60d63bc07e21beb40512eafcad92f3164239',
  },
  {
    file: 'assets/shop/mushroom/mushroom-pixi-sheet.webp',
    width: 3990,
    height: 608,
    sha256: 'aa3b28a01a61f9cad00fbb440607d4fa4c89969882643dbd8ad889847d371546',
  },
  {
    file: 'assets/shop/robo/robo-pixi-sheet.webp',
    width: 4077,
    height: 1032,
    sha256: '9701f03761048bf5d50ac0969d5b053d44b4505413f4e3f60a2f1ea3d3b6c01e',
  },
  {
    file: 'assets/shop/juice/juice-pixi-sheet.webp',
    width: 3999,
    height: 561,
    sha256: '721442a1cfec8b9348144a624a63a0f6bb943918298d19223d1fb75e4cb911fd',
  },
  {
    file: 'assets/shop/ball/ball-pixi-sheet.webp',
    width: 4048,
    height: 840,
    sha256: 'f81508250065f9b603cc616f49f37ff3add287d47a6e538a9862061e5325ef27',
  },
  {
    file: 'assets/shop/star/star-pixi-sheet.webp',
    width: 4077,
    height: 735,
    sha256: 'b223f9ba4a06b9ae17be553a84eb6bd0afd36b5b64177ef2ddb6a0a4babfcaa7',
  },
];

function imageDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes.subarray(1, 4).toString('ascii') === 'PNG') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') {
    throw new Error('Expected PNG or WebP asset');
  }
  const chunk = bytes.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8X') {
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3),
    };
  }
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    const packed = bytes.readUInt32LE(21);
    return {
      width: 1 + (packed & 0x3fff),
      height: 1 + ((packed >>> 14) & 0x3fff),
    };
  }
  throw new Error(`Unsupported WebP chunk ${chunk}`);
}

describe('optimized animated Special artwork assets', () => {
  test.each(assets)('locks $file dimensions and chronological source bytes', (asset) => {
    const bytes = fs.readFileSync(path.resolve(process.cwd(), asset.file));
    expect(imageDimensions(bytes)).toEqual({ width: asset.width, height: asset.height });
    expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    expect(asset.width).toBeLessThanOrEqual(4096);
    expect(asset.height).toBeLessThanOrEqual(4096);
  });

  test('keeps SVG documents and large Pixi sheets out of generic image preloaders', () => {
    const genericSources = [
      fs.readFileSync(path.resolve(process.cwd(), 'src/modules/asset-preloader.ts'), 'utf8'),
      fs.readFileSync(path.resolve(process.cwd(), 'src/utils/comprehensive-image-preloader.ts'), 'utf8'),
    ].join('\n');
    const runtimeOnlyAssets = [
      'juice-bounce.svg', 'ball-bouncy.svg', 'robo-bouncy.svg', 'star.svg',
      'mushroom.svg', 'flower.svg',
      'juice-pixi-sheet.webp', 'ball-pixi-sheet.webp', 'robo-pixi-sheet.webp',
      'star-pixi-sheet.webp', 'mushroom-pixi-sheet.webp', 'flower-pixi-source.png',
    ];
    runtimeOnlyAssets.forEach((asset) => expect(genericSources).not.toContain(asset));
  });

  test('keeps every individual sheet below a 17 MiB decoded source', () => {
    assets.slice(1).forEach((asset) => {
      expect(asset.width * asset.height * 4).toBeLessThan(17 * 1024 * 1024);
    });
  });
});
