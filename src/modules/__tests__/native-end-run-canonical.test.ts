import { showEndRunModal, forceHideEndRunModal } from '../end-run-modal';
import { setNoMovesNavigationLocked } from '../terminal-navigation-lock';
import { requestExitToMenu } from '../menu-exit-handoff';
import { clearArcadeSaveState } from '../../utils/board-save-utils';
import { playCtaActivationSounds } from '../cta-activation-sound';

jest.mock('../../utils/animations.js', () => ({safePauseGame:jest.fn(),safeResumeGame:jest.fn(),safeUnlockSlider:jest.fn()}));
jest.mock('../pause-utils.js', () => ({resumeGame:jest.fn(),getCurrentScore:()=>0}));
jest.mock('../score-bottom-sheet.js', () => ({forceHideScoreBottomSheet:jest.fn(),isScoreBottomSheetVisible:()=>false,resetScoreBottomSheetState:jest.fn()}));
jest.mock('../run-mode.js', () => ({isArcadeHomeRunMode:()=>true}));
jest.mock('../menu-exit-handoff.ts', () => ({requestExitToMenu:jest.fn(async()=>true)}));
jest.mock('../journey-origin-state.js', () => ({resolveJourneyReturnTarget:jest.fn(async()=>({target:'homepage',boardId:null}))}));
jest.mock('../../utils/board-save-utils.js', () => ({clearArcadeSaveState:jest.fn(),getBoardSaveKey:(n:number)=>'board-'+n}));
jest.mock('../gameplay-exit-modal-enter-sound.ts', () => ({playGameplayExitModalEnterSound:jest.fn(),preloadGameplayExitModalEnterSound:jest.fn()}));
jest.mock('../cta-activation-sound.ts', () => ({playCtaActivationSounds:jest.fn(),preloadCtaActivationSounds:jest.fn()}));
jest.mock('../cta-system.ts', () => ({ctaMotion:{companionEnterStaggerMs:70},exitCtaGroup:jest.fn(),registerCta:jest.fn()}));
jest.mock('../gameplay-sheet-close.ts', () => ({mountGameplaySheetClose:jest.fn()}));
jest.mock('../modal-vertical-drag-dismiss.js', () => ({installGameplayOverlayModalDragMotion:jest.fn()}));
const host = window as any;
let post:jest.Mock;
const flush = async () => {for(let i=0;i<8;i++) await Promise.resolve();};
function open() {
  showEndRunModal();
  const message = post.mock.calls.find(c=>c[0].command==='present')![0];
  expect(host.__jimiNativeEndRun.ready(message.id)).toBe(true);
  return message.id;
}
beforeEach(()=>{
  jest.useFakeTimers();jest.clearAllMocks();post = jest.fn();
  host.__jimiNativeEndRunEnabled = true;host.webkit = {messageHandlers:{jimiHomeHub:{postMessage:post}}};
  host.STATE = {boardNumber:1};host._userMadeMove = true;host.CC = {restart:jest.fn(async()=>{})};
  Object.defineProperty(document,'hidden',{configurable:true,value:false});
  document.body.innerHTML = '<div id="app"></div><div id="board-container"></div><div id="hud"></div>';
  localStorage.setItem('board-1','saved-progress');
  setNoMovesNavigationLocked(false);
});
afterEach(()=>{
  setNoMovesNavigationLocked(false);forceHideEndRunModal('test-retirement');jest.clearAllTimers();jest.useRealTimers();
  delete host.__jimiNativeEndRunEnabled;delete host.webkit;delete host.__jimiNativeEndRun;delete host.CC;
});
test('native Close keeps canonical soft pause until actual dismissal and supports reopening',async()=>{
  const id = open();expect(host._gamePaused).toBe(true);
  expect(document.querySelector<HTMLElement>('.simple-bottom-sheet')!.style.display).toBe('none');
  // Close remains legal if NO MOVES claims terminal ownership after opening.
  setNoMovesNavigationLocked(true);expect(host.__jimiNativeEndRun.activate(id,'close')).toBe(true);
  jest.advanceTimersByTime(650);await flush();expect(host._gamePaused).toBe(true);
  expect(host.__jimiNativeEndRun.closed(id)).toBe(true);await flush();expect(host._gamePaused).toBe(false);
  expect(localStorage.getItem('board-1')).toBe('saved-progress');expect(requestExitToMenu).not.toHaveBeenCalled();
  setNoMovesNavigationLocked(false);post.mockClear();expect(open()).not.toBe(id);
});
test('native Exit preserves played save and waits for exact receipt before canonical menu handoff',async()=>{
  const id = open();expect(host.__jimiNativeEndRun.activate(id,'exit')).toBe(true);
  expect(host.__jimiNativeEndRun.activate(id,'exit')).toBe(false);
  jest.advanceTimersByTime(650);await flush();expect(requestExitToMenu).not.toHaveBeenCalled();
  host.__jimiNativeEndRun.closed(id);await flush();
  expect(requestExitToMenu).toHaveBeenCalledTimes(1);expect(requestExitToMenu).toHaveBeenCalledWith({reason:'end-run-modal-exit',target:'homepage'});
  expect(localStorage.getItem('board-1')).toBe('saved-progress');expect(playCtaActivationSounds).toHaveBeenCalledTimes(1);
});
test('native Restart respects terminal admission and delays canonical reset until dismissal',async()=>{
  const id = open();setNoMovesNavigationLocked(true);
  expect(host.__jimiNativeEndRun.activate(id,'restart')).toBe(false);expect(playCtaActivationSounds).not.toHaveBeenCalled();
  setNoMovesNavigationLocked(false);expect(host.__jimiNativeEndRun.activate(id,'restart')).toBe(true);
  jest.advanceTimersByTime(650);await flush();expect(clearArcadeSaveState).not.toHaveBeenCalled();expect(host.CC.restart).not.toHaveBeenCalled();
  host.__jimiNativeEndRun.closed(id);await flush();expect(clearArcadeSaveState).toHaveBeenCalledTimes(1);expect(host.CC.restart).toHaveBeenCalledTimes(1);
});
