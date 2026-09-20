import fs from 'node:fs';
import ts from 'typescript';
import {
  beginJourneyReturnTransition,
  completeJourneyReturnTransition,
  markJourneyReturnResultExitComplete,
  scheduleJourneyReturnReveal,
} from '../journey-return-transition-trace';

// Exercise the production caller guard, not a constant true callback: Homepage
// entry legitimately keeps the home zone while Journey's hidden prime is held.
const source = ts.createSourceFile('collectibles-manager.ts',
  fs.readFileSync('src/collectibles-manager.ts', 'utf8'), ts.ScriptTarget.Latest, true);
let declaration: ts.VariableDeclaration | undefined;
const findGuard = (node: ts.Node): void => {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'isJourneyRevealCurrent') declaration = node;
  ts.forEachChild(node, findGuard);
};
findGuard(source);
const guardCode = ts.transpileModule(`const ${declaration!.getText(source)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const zoneFile = ts.createSourceFile('app-zone-manager.ts',
  fs.readFileSync('src/modules/app-zone-manager.ts', 'utf8'), ts.ScriptTarget.Latest, true);
let method: ts.MethodDeclaration | undefined;
const findMethod = (node: ts.Node): void => {
  if (ts.isMethodDeclaration(node) && node.name.getText(zoneFile) === 'isPresentationCurrent') method = node;
  ts.forEachChild(node, findMethod);
};
findMethod(zoneFile);
const zoneCode = ts.transpileModule(`class ZoneProbe { ${method!.getText(zoneFile)} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const ZoneProbe = new Function(`${zoneCode}; return ZoneProbe;`)() as new () => {
  currentZone: string; presentationEpoch: number;
};
const makeGuard = new Function('screen', 'appZoneManager', 'journeyPresentationEpoch',
  'terminalReturnToken', `${guardCode}; return isJourneyRevealCurrent;`) as (
  screen: HTMLElement, zone: InstanceType<typeof ZoneProbe>, epoch: number, token: number | null,
) => () => boolean;

let frames: FrameRequestCallback[];
beforeEach(() => {
  frames = [];
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
});
afterEach(() => { completeJourneyReturnTransition(); document.body.innerHTML = ''; });

function fixture(zoneName: string, terminal = false) {
  const screen = document.createElement('section');
  screen.style.opacity = '0';
  screen.style.visibility = 'hidden';
  document.body.append(screen);
  const zone = new ZoneProbe();
  zone.currentZone = zoneName;
  zone.presentationEpoch = 4;
  const token = terminal ? beginJourneyReturnTransition('clean-board', 22) : null;
  if (token !== null) markJourneyReturnResultExitComplete(token);
  const current = makeGuard(screen, zone, 4, token);
  const reveal = jest.fn(() => { screen.style.opacity = '1'; screen.style.visibility = 'visible'; });
  const schedule = () => scheduleJourneyReturnReveal(token, current, () => {
    scheduleJourneyReturnReveal(token, current, reveal);
  });
  const flush = () => { while (frames.length) frames.shift()!(16); };
  return { screen, zone, current, reveal, schedule, flush };
}

test.each(['home', 'journey'])('standard entry from %s releases the actual hidden prime after its normal frames', (zone) => {
  const f = fixture(zone);
  f.schedule();
  expect(f.reveal).not.toHaveBeenCalled();
  f.flush();
  expect(f.reveal).toHaveBeenCalledTimes(1);
  expect(f.screen.style.opacity).toBe('1');
  expect(f.screen.style.visibility).toBe('visible');
});

test('terminal return in Journey starts immediately without changing standard-entry ownership', () => {
  const f = fixture('journey', true);
  f.schedule();
  expect(f.reveal).toHaveBeenCalledTimes(1);
  expect(frames).toHaveLength(0);
});

test('a terminal return cannot reveal over a different destination', () => {
  const f = fixture('home', true);
  f.schedule();
  expect(f.reveal).not.toHaveBeenCalled();
});

test.each(['replaced', 'detached'])('standard pending reveal is cancelled when %s between its two frames', (reason) => {
  const f = fixture('home');
  f.schedule();
  frames.shift()!(16);
  if (reason === 'replaced') { f.zone.presentationEpoch++; f.zone.currentZone = 'settings'; }
  else f.screen.remove();
  f.flush();
  expect(f.reveal).not.toHaveBeenCalled();
});
