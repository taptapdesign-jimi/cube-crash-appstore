import fs from 'node:fs';
import path from 'node:path';

const managerSource = fs.readFileSync(
  path.join(process.cwd(), 'src/modules/journey-boards-manager.ts'),
  'utf8',
);

describe('Journey detail modal handoff', () => {
  it('does not replay the legacy viewport cascade after coordinated World and nav exit', () => {
    const regularExitSource = managerSource.split('private startBoardAreaThenJourneyExit(')[1]
      ?.split('private installInterimAreaHitTargets(')[0] ?? '';

    expect(regularExitSource).toContain('if (contentExitPromise) {');
    expect(regularExitSource).toContain('this.finalizeJourneyViewportAfterCoordinatedWorldExit(boardId);');
    expect(regularExitSource).toContain('} else {\n          await this.startJourneyExitAnimation();');
  });

  it('commits the hidden viewport state without changing Unit motion timing', () => {
    const finalizeSource = managerSource.split('private finalizeJourneyViewportAfterCoordinatedWorldExit(')[1]
      ?.split('private getJourneyAreaElements(')[0] ?? '';

    expect(finalizeSource).toContain("journeyScreen.style.visibility = 'hidden'");
    expect(finalizeSource).toContain("journeyScreen.style.pointerEvents = 'none'");
    expect(finalizeSource).toContain('opacity: 0');
    expect(finalizeSource).not.toContain('duration:');
    expect(finalizeSource).not.toContain('setTimeout');
  });
});
