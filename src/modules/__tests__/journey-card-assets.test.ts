import fs from 'node:fs';
import path from 'node:path';
import { resolveJourneyCardAsset } from '../journey-card-assets';

const read = (relativePath: string): string => fs.readFileSync(
  path.resolve(process.cwd(), relativePath),
  'utf8',
);

describe('Journey collectible card assets', () => {
  test.each([
    [1, 0, 'common'],
    [1, 1, 'common'],
    [1, 2499, 'common'],
    [1, 2500, 'common'],
    [1, 6499, 'common'],
    [1, 6500, 'legendary'],
    [2, 6499, 'common'],
    [2, 6500, 'legendary'],
    [4, 7999, 'common'],
    [4, 8000, 'legendary'],
    [10, 9499, 'common'],
    [10, 9500, 'legendary'],
    [21, 0, 'common'],
    [21, 999999, 'legendary'],
    [30, 0, 'common'],
    [30, 999999, 'legendary'],
  ])('Forest board %i at score %i resolves %s', (boardId, score, rarity) => {
    expect(resolveJourneyCardAsset(boardId, score)).toMatchObject({ rarity });
  });

  test('uses exact Forest case, numbering, gold suffix and density filenames', () => {
    expect(resolveJourneyCardAsset(1, 1)).toMatchObject({
      path1x: './assets/colelctibles/Forest/common/01.png',
      path2x: './assets/colelctibles/Forest/common/01@2x.png',
    });
    expect(resolveJourneyCardAsset(10, 9500)).toMatchObject({
      path1x: './assets/colelctibles/Forest/legendary/10-gold.png',
      path2x: './assets/colelctibles/Forest/legendary/10-gold@2x.png',
    });
    expect(resolveJourneyCardAsset(2, 999999)).toMatchObject({
      stageInWorld: 2,
      path1x: './assets/colelctibles/Forest/legendary/03-gold.png',
      path2x: './assets/colelctibles/Forest/legendary/03-gold@2x.png',
    });
    expect(resolveJourneyCardAsset(3, 999999)).toMatchObject({
      stageInWorld: 3,
      path1x: './assets/colelctibles/Forest/legendary/09-gold.png',
      path2x: './assets/colelctibles/Forest/legendary/09-gold@2x.png',
    });
    expect(resolveJourneyCardAsset(6, 999999)).toMatchObject({
      stageInWorld: 6,
      path1x: './assets/colelctibles/Forest/legendary/06-gold.png',
      path2x: './assets/colelctibles/Forest/legendary/06-gold@2x.png',
    });
    expect(resolveJourneyCardAsset(9, 999999)).toMatchObject({
      stageInWorld: 9,
      path1x: './assets/colelctibles/Forest/legendary/02-gold.png',
      path2x: './assets/colelctibles/Forest/legendary/02-gold@2x.png',
    });
  });

  test('uses dedicated Beach numbering, gold suffix and density filenames', () => {
    expect(resolveJourneyCardAsset(11, 999999)).toMatchObject({
      rarity: 'legendary',
      path1x: './assets/colelctibles/beach/legendary/01-gold.png',
      path2x: './assets/colelctibles/beach/legendary/01-gold@2x.png',
    });
  });

  test('all ten Beach stages use their own common and legendary 1x/2x artwork', () => {
    const paths = new Set<string>();
    for (let boardId = 11; boardId <= 20; boardId += 1) {
      for (const score of [0, 999999]) {
        const asset = resolveJourneyCardAsset(boardId, score);
        const rarity = score === 0 ? 'common' : 'legendary';
        const stem = String(boardId - 10).padStart(2, '0') + (score === 0 ? '' : '-gold');
        expect(asset.rarity).toBe(rarity);
        expect(asset.path1x).toBe(`./assets/colelctibles/beach/${rarity}/${stem}.png`);
        const densityFile = score === 0 && boardId === 16 ? '06@2x-1'
          : score === 0 && boardId === 19 ? '06@2x' : `${stem}@2x`;
        expect(asset.path2x).toBe(`./assets/colelctibles/beach/${rarity}/${densityFile}.png`);
        for (const file of [asset.path1x, asset.path2x!]) {
          expect(fs.existsSync(path.resolve(process.cwd(), file))).toBe(true);
          paths.add(file);
        }
      }
    }
    expect(paths.size).toBe(40);
  });

  test('all 40 declared Forest files exist', () => {
    for (let boardId = 1; boardId <= 10; boardId += 1) {
      for (const score of [1, 999999]) {
        const asset = resolveJourneyCardAsset(boardId, score);
        for (const relativePath of [asset.path1x, asset.path2x]) {
          expect(relativePath).toBeDefined();
          expect(fs.existsSync(path.resolve(process.cwd(), relativePath!))).toBe(true);
        }
      }
    }
  });

  test('uses all 40 dedicated Area 55 common/legendary density files without redundant fallbacks', () => {
    expect(resolveJourneyCardAsset(21, 0)).toMatchObject({
      stageInWorld: 1,
      rarity: 'common',
      path1x: './assets/colelctibles/Area55/common/04.png',
      path2x: './assets/colelctibles/Area55/common/04@2x.png',
    });
    expect(resolveJourneyCardAsset(22, 0).path1x)
      .toBe('./assets/colelctibles/Area55/common/01.png');
    expect(resolveJourneyCardAsset(23, 0).path1x)
      .toBe('./assets/colelctibles/Area55/common/03.png');
    expect(resolveJourneyCardAsset(24, 0).path1x)
      .toBe('./assets/colelctibles/Area55/common/02.png');
    expect(resolveJourneyCardAsset(30, 999999)).toMatchObject({
      stageInWorld: 10,
      rarity: 'legendary',
      path1x: './assets/colelctibles/Area55/legendary/10-gold.png',
      path2x: './assets/colelctibles/Area55/legendary/10-gold@2x.png',
    });

    for (let boardId = 21; boardId <= 30; boardId += 1) {
      for (const score of [0, 999999]) {
        const asset = resolveJourneyCardAsset(boardId, score);
        expect(asset.path1x).not.toContain('redundant assets');
        for (const relativePath of [asset.path1x, asset.path2x]) {
          expect(relativePath).toBeDefined();
          expect(fs.existsSync(path.resolve(process.cwd(), relativePath!))).toBe(true);
        }
      }
    }
  });

  test('keeps 1x on the World and promotes only reward/detail surfaces to 2x', () => {
    const manager = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-boards-manager.ts'),
      'utf8',
    );
    const completion = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-completion-flow.ts'),
      'utf8',
    );
    const overlay = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/journey-card-overlay-modal.ts'),
      'utf8',
    );
    const preloader = fs.readFileSync(
      path.resolve(process.cwd(), 'src/utils/comprehensive-image-preloader.ts'),
      'utf8',
    );
    const endgame = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/endgame-flow.ts'),
      'utf8',
    );

    expect(manager).toContain('const cardImagePath = cardAsset.path1x;');
    expect(manager.match(/const overlayCardAsset = this\.syncBoardCardAsset\(board\);/g)).toHaveLength(1);
    expect(manager.match(/cardImagePath2x: overlayCardAsset\.path2x/g)).toHaveLength(1);
    expect(manager.match(/cardRarity: overlayCardAsset\.rarity/g)).toHaveLength(1);
    expect(manager).toContain('presentJourneyCardReturnReminder({');
    expect(manager).toContain('(boardCardAsset.path2x || boardCardAsset.path1x)');
    expect(manager).toContain("this.refreshJourneyBoardCardArt(boardId, 'high-score-event')");
    expect(completion).toContain('cardImagePath: rewardAsset.path2x || rewardAsset.path1x');
    expect(completion).toContain('Math.max(savedHighScore, rewardScore || 0)');
    expect(endgame).toContain('rewardScore: journeyRewardFinalScore');
    expect(overlay).toContain('portaledCard.style.backgroundImage');
    expect(preloader).toContain('imagesToPreload.push(asset.path2x || asset.path1x)');
    expect(preloader).not.toContain("imagesToPreload.push(`./assets/colelctibles/common/${id}.png`)");
  });

  test('keeps Legendary card preview isolated to the DEV picker without changing score or unlock state', () => {
    const manager = read('src/modules/journey-boards-manager.ts');
    const settings = read('src/ui/components/settings-screen.ts');
    const previewOwner = manager.match(
      /private async showLegendaryBoardCardPreview[\s\S]*?\n {2}public showBoardPickerModal/,
    )?.[0] ?? '';

    expect(settings).toContain(
      "createDevButton('settings-dev-legendary-card-btn', 'Legendary Card', 'legendary')",
    );
    expect(settings).toContain('normalizeJourneyBoardId(Math.floor(boardNumber))');
    expect(manager).toContain("action: 'show' | 'hide' | 'legendary' | 'reset'");
    expect(manager).toContain("action === 'legendary' ? 'Open Legendary' : 'OK'");
    expect(manager).toContain("resolveJourneyCardAsset(i, Number.MAX_SAFE_INTEGER).rarity === 'legendary'");
    expect(previewOwner).toContain(
      'resolveJourneyCardAsset(safeBoardNumber, Number.MAX_SAFE_INTEGER)',
    );
    expect(previewOwner).toContain("cardRarity: 'legendary'");
    expect(previewOwner).not.toContain('updateBoardHighScore');
    expect(previewOwner).not.toContain('unlockBoardByNumber');
    expect(previewOwner).not.toContain('localStorage');
  });
});
