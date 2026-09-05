import fs from 'node:fs';
import path from 'node:path';
import { resolveJourneyCardAsset } from '../journey-card-assets';

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

  test('uses redundant placeholders for Beach and Area 55 without Forest rarity', () => {
    expect(resolveJourneyCardAsset(11, 999999)).toMatchObject({
      rarity: 'common',
      path1x: './assets/redundant assets/collectible cards old/11.png',
    });
    expect(resolveJourneyCardAsset(11, 999999).path2x).toBeUndefined();
    expect(resolveJourneyCardAsset(21, 999999)).toMatchObject({
      rarity: 'common',
      path1x: './assets/redundant assets/collectible cards old/21.png',
    });
    expect(resolveJourneyCardAsset(21, 999999).path2x).toBeUndefined();
    expect(resolveJourneyCardAsset(30, 999999)).toMatchObject({
      rarity: 'common',
      path1x: './assets/redundant assets/collectible cards old/24.png',
    });
    expect(resolveJourneyCardAsset(30, 999999).path2x).toBeUndefined();
  });

  test('every temporary Beach and Area 55 card resolves to an existing redundant asset', () => {
    for (let boardId = 11; boardId <= 30; boardId += 1) {
      const asset = resolveJourneyCardAsset(boardId, 999999);
      expect(asset.rarity).toBe('common');
      expect(asset.path2x).toBeUndefined();
      expect(fs.existsSync(path.resolve(process.cwd(), asset.path1x))).toBe(true);
    }
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
    expect(manager.match(/const overlayCardAsset = this\.syncBoardCardAsset\(board\);/g)).toHaveLength(2);
    expect(manager.match(/cardImagePath2x: overlayCardAsset\.path2x/g)).toHaveLength(2);
    expect(manager.match(/cardRarity: overlayCardAsset\.rarity/g)).toHaveLength(2);
    expect(manager).toContain('(boardCardAsset.path2x || boardCardAsset.path1x)');
    expect(manager).toContain("this.refreshJourneyBoardCardArt(boardId, 'high-score-event')");
    expect(completion).toContain('cardImagePath: rewardAsset.path2x || rewardAsset.path1x');
    expect(completion).toContain('Math.max(savedHighScore, rewardScore || 0)');
    expect(endgame).toContain('rewardScore: journeyRewardFinalScore');
    expect(overlay).toContain('portaledCard.style.backgroundImage');
    expect(preloader).toContain('imagesToPreload.push(asset.path2x || asset.path1x)');
    expect(preloader).not.toContain("imagesToPreload.push(`./assets/colelctibles/common/${id}.png`)");
  });
});
