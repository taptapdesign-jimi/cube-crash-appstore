import { JOURNEY_STAGES_PER_WORLD } from './journey-world-stage';
import { RUN_MODE_JOURNEY, type RunMode } from './run-mode';

export type BoardTransitionThemeId = 'forest' | 'beach' | 'area55';

export interface BoardTransitionThemeLayer {
  key: string;
  src: string;
  alt: string;
  style: string[];
  spatialRole?: 'primary' | 'terrain' | 'scene';
  motionRole?: 'sea' | 'float' | 'shore' | 'curtain';
}

export interface BoardTransitionThemeProfile {
  id: BoardTransitionThemeId;
  sceneClass: string;
  layers: readonly BoardTransitionThemeLayer[];
  enterOrder: readonly string[];
}

export const BEACH_BOARD_TRANSITION_CLOUD_COUNT = 6;

const islandStyle = (
  left: string,
  bottom: number | string,
  width: string,
  zIndex: number,
): string[] => [
  `left: ${left}`,
  `bottom: ${typeof bottom === 'number' ? `${bottom}px` : bottom}`,
  `width: ${width}`,
  `z-index: ${zIndex}`,
  'transform-origin: center center',
];

const palmCurtainStyle = (left: string, top: string, width: string, zIndex: number): string[] => [
  `left: ${left}`,
  `top: ${top}`,
  'bottom: auto',
  `width: ${width}`,
  `z-index: ${zIndex}`,
  'transform-origin: center bottom',
];

export const BEACH_BOARD_TRANSITION_PROFILE = Object.freeze({
  id: 'beach',
  sceneClass: 'cc-board-transition-scene--beach',
  layers: Object.freeze([
    { key: 'beach-sea-1', src: './assets/journey assets/beach/more1.png', alt: '', style: islandStyle('50%', 88, '695px', 6), spatialRole: 'terrain', motionRole: 'sea' },
    { key: 'beach-bottle', src: './assets/journey assets/beach/bottle.png', alt: '', style: islandStyle('calc(100% - 60px)', 370, 'min(31.9vw, 124.3px)', 9), spatialRole: 'scene', motionRole: 'float' },
    { key: 'beach-sea-2', src: './assets/journey assets/beach/more2.png', alt: '', style: islandStyle('50%', 190, '674px', 12), spatialRole: 'terrain', motionRole: 'sea' },
    { key: 'beach-ball', src: './assets/journey assets/beach/lopta.png', alt: '', style: islandStyle('calc(54% - 100px)', 284, '149px', 15), spatialRole: 'scene', motionRole: 'float' },
    { key: 'beach-sea-3', src: './assets/journey assets/beach/more3.png', alt: '', style: islandStyle('50%', -16, '1014px', 18), spatialRole: 'terrain', motionRole: 'sea' },
    { key: 'beach-shore-1', src: './assets/journey assets/beach/plaza1.png', alt: '', style: islandStyle('calc(34% - 40%)', 22, 'min(174vw, 679px)', 24), spatialRole: 'scene', motionRole: 'shore' },
    { key: 'beach-castle', src: './assets/journey assets/beach/dvorac.png', alt: 'Beach', style: islandStyle('calc(68% + 30px)', 134, 'min(78.2vw, 305px)', 27), spatialRole: 'primary', motionRole: 'shore' },
    { key: 'beach-shore-2', src: './assets/journey assets/beach/plaza2.png', alt: '', style: [...islandStyle('63%', -274, 'min(220vw, 858px)', 30), 'transform-origin: center bottom'], spatialRole: 'scene', motionRole: 'shore' },
    { key: 'beach-palm-1', src: './assets/journey assets/beach/palm 1.png', alt: '', style: palmCurtainStyle('calc(-18% + 60px)', 'calc(30% - 420px)', 'min(143vw, 557px)', 60), spatialRole: 'scene', motionRole: 'curtain' },
    { key: 'beach-palm-2', src: './assets/journey assets/beach/palm 2.png', alt: '', style: palmCurtainStyle('16%', 'calc(60% - 455px)', 'min(154vw, 602px)', 62), spatialRole: 'scene', motionRole: 'curtain' },
    { key: 'beach-palm-3', src: './assets/journey assets/beach/palm 3.png', alt: '', style: palmCurtainStyle('72%', 'calc(44% - 310px)', 'min(151vw, 589px)', 64), spatialRole: 'scene', motionRole: 'curtain' },
    { key: 'beach-palm-4', src: './assets/journey assets/beach/palm 4.png', alt: '', style: palmCurtainStyle('calc(114% - 80px)', 'calc(76% - 435px)', 'min(141vw, 552px)', 66), spatialRole: 'scene', motionRole: 'curtain' },
    { key: 'beach-palm-center', src: './assets/journey assets/beach/palm 2.png', alt: '', style: palmCurtainStyle('calc(50% - 20px)', 'calc(100% - 400px)', 'min(154vw, 602px)', 68), spatialRole: 'scene', motionRole: 'curtain' },
  ]),
  enterOrder: Object.freeze(['beach-palm-1', 'beach-palm-2', 'beach-palm-3', 'beach-palm-4', 'beach-palm-center', 'beach-shore-1', 'beach-castle', 'beach-shore-2', 'beach-sea-1', 'beach-bottle', 'beach-sea-2', 'beach-ball', 'beach-sea-3']),
} satisfies BoardTransitionThemeProfile);

export const AREA55_BOARD_TRANSITION_PROFILE = Object.freeze({
  id: 'area55',
  sceneClass: 'cc-board-transition-scene--area55',
  layers: Object.freeze([
    { key: 'robo-front', src: './assets/journey assets/robo/robo frontalni.png', alt: '', style: islandStyle('16%', -200, 'min(128vw, 500px)', 70), spatialRole: 'primary' },
    { key: 'robo-ground-front', src: './assets/journey assets/robo/zemlja1.png', alt: '', style: islandStyle('50%', -280, 'min(263vw, 1023px)', 60), spatialRole: 'terrain' },
    { key: 'robo-fence', src: './assets/journey assets/robo/ograda.png', alt: '', style: islandStyle('25%', 151, 'min(77vw, 299px)', 50), spatialRole: 'scene' },
    { key: 'robo-walker', src: './assets/journey assets/robo/robo1.png', alt: '', style: islandStyle('80%', 136, 'min(64vw, 251px)', 40), spatialRole: 'scene' },
    { key: 'robo-ground-rear', src: './assets/journey assets/robo/zemlja2.png', alt: '', style: islandStyle('50%', -90, 'min(237vw, 921px)', 30), spatialRole: 'terrain' },
    { key: 'robo-ship', src: './assets/journey assets/robo/ship.png', alt: 'Robo World', style: islandStyle('calc(30% - 7px)', 249, 'min(98vw, 383px)', 20), spatialRole: 'scene' },
  ]),
  enterOrder: Object.freeze(['robo-ground-front', 'robo-ground-rear', 'robo-walker', 'robo-fence', 'robo-ship', 'robo-front']),
} satisfies BoardTransitionThemeProfile);

export function getJourneyBoardTransitionTheme(boardNumber: number): BoardTransitionThemeId {
  const safeBoard = Math.max(1, Math.min(30, Math.trunc(Number.isFinite(boardNumber) ? boardNumber : 1)));
  const worldIndex = Math.floor((safeBoard - 1) / JOURNEY_STAGES_PER_WORLD);
  return worldIndex === 1 ? 'beach' : worldIndex >= 2 ? 'area55' : 'forest';
}

export function resolveBoardTransitionTheme(options: {
  boardNumber: number;
  explicitTheme?: BoardTransitionThemeId;
  hideForest?: boolean;
  runMode: RunMode | null;
}): BoardTransitionThemeId | 'none' {
  if (options.explicitTheme) return options.explicitTheme;
  if (options.hideForest) return 'none';
  if (options.runMode === RUN_MODE_JOURNEY) return getJourneyBoardTransitionTheme(options.boardNumber);
  return 'forest';
}
