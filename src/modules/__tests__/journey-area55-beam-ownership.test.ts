import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const managerSource = fs.readFileSync(
  path.join(root, 'src/modules/journey-boards-manager.ts'),
  'utf8',
);
const collectiblesCss = fs.readFileSync(
  path.join(root, 'src/collectibles-screen.css'),
  'utf8',
);
const coordinatorSource = fs.readFileSync(
  path.join(root, 'src/modules/journey-world-animation-coordinator.ts'),
  'utf8',
);
const roboHelperSource = managerSource.slice(
  managerSource.indexOf('const addRoboBoardGroup = ('),
  managerSource.indexOf('addForestMainClouds();'),
);
const forestHelperSource = managerSource.slice(
  managerSource.indexOf('const addForestBoardGroup = ('),
  managerSource.indexOf('const addBeachBoardGroup = ('),
);

describe('Area 55 alien beam animation ownership', () => {
  it('uses the same sibling target Unit model as Forest and Beach', () => {
    expect(roboHelperSource).not.toContain('journey-robo-board-unit');
    expect(roboHelperSource).not.toContain('journey-robo-crater-beam-unit');
    expect(roboHelperSource).toContain('targets.push(cloud)');
    expect(roboHelperSource).toContain('targets.push(roboIsland)');
    expect(roboHelperSource).toContain('targets.push(crater)');
    expect(roboHelperSource).toContain('targets.push(beamUnit)');
    expect(roboHelperSource).toContain('targets.push(addImage(');
    expect(roboHelperSource).toContain('beamUnit.dataset.journeyAreaId = areaId');
    expect(roboHelperSource).toContain('decorContainer.appendChild(beamUnit)');
    expect(forestHelperSource).not.toContain('journey-robo-board-unit');
    expect(managerSource).toContain('targets: Array.from(new Set(targets))');
  });

  it('runs the idle opacity pulse on the nested visual, not the Unit motion owner', () => {
    expect(collectiblesCss).toContain(
      '.journey-robo-alien-beam-art.journey-robo-alien-beam-idle-ready .journey-robo-alien-beam-visual',
    );
    expect(collectiblesCss).not.toMatch(
      /\.journey-robo-alien-beam-art\.journey-robo-alien-beam-idle-ready\s*\{[^}]*animation:/s,
    );
    expect(managerSource).toContain('setJourneyAlienBeamIdleReady(target, false)');
    expect(managerSource).toContain('setJourneyAlienBeamIdleReady(target, true)');
  });

  it('clears stale cloud drift before the hidden return enter becomes visible', () => {
    const enterSource = coordinatorSource.split('public async enter(')[1]
      ?.split('public async exit(')[0] ?? '';
    const resetIndex = enterSource.indexOf('gsap.set(liveClouds, { x: 0, overwrite: true })');
    const timelineIndex = enterSource.indexOf('const timeline = gsap.timeline({');

    expect(enterSource).toContain('const liveClouds = Array.from(new Set(liveUnits.flatMap((unit) => unit.clouds)))');
    expect(resetIndex).toBeGreaterThanOrEqual(0);
    expect(resetIndex).toBeLessThan(timelineIndex);
  });
});
