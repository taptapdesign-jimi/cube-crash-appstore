/** Native presentation receipts. Canonical Journey owns all player state. */
import type { NativeForestBeePlan } from './journey-forest-bee-orbits.js';
export interface NativeWorldPart {
  asset: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  rotation: number;
  opacity: number;
  role: string;
  zIndex: number;
  beamIdle?: { points: { time: number; opacity: number }[]; duration: number; phase: number };
}
export interface NativeWorldUnit {
  id: string;
  boardID: number;
  frame: { x: number; y: number; width: number; height: number };
  islandArt: string;
  stumpArt?: string;
  cardArt?: string;
  cardArt2x?: string;
  newRibbonArt?: string;
  locked: boolean;
  interim: boolean;
  completed: boolean;
  stars: number;
  number: string;
  allowedActions: string[];
  stats: { label: string; value: string }[];
  cardRotationDeg?: number;
  cardRarity?: 'common' | 'legendary';
  viewed?: boolean;
  newRibbon?: boolean;
  enterDelayOffset?: number;
  lockedNumberOffset?: { x: number; y: number; rotation?: number };
  parts: NativeWorldPart[];
}
export interface NativeWorldAmbientFrame {
  time: number; x: number; y: number; width: number; height: number;
  rotation: number; opacity: number; asset: string; depth: 'front' | 'behind';
}
export interface NativeWorldAmbientPlan {
  id: number; worldID: 2 | 3; duration: number; frames: NativeWorldAmbientFrame[];
}
export interface NativeWorldAmbientViewport { top: number; bottom: number }
export interface NativeWorldSnapshot {
  version: 1;
  requestID: string;
  routeGeneration: number;
  stateRevision: number;
  worldID: 1 | 2 | 3;
  title: string;
  contentHeight: number;
  mainArt: string;
  mainFrame: { x: number; y: number; width: number; height: number };
  mainParts: NativeWorldPart[];
  units: NativeWorldUnit[];
  viewport: { width: number; height: number };
  cardBackArt: string;
  returnBoardID?: number;
  beePlans?: NativeForestBeePlan[];
  beeSessionID?: number;
  ambientPlans?: NativeWorldAmbientPlan[];
  ambientSessionID?: number;
}
export interface NativeWorldAction {
  id: number;
  routeGeneration: number;
  stateRevision: number;
  worldID: 1 | 2 | 3;
  action: 'openCard' | 'close' | 'play' | 'continue' | 'back';
  boardID?: number;
}
export interface NativeWorldActionReceipt {
  accepted: boolean;
  snapshot?: NativeWorldSnapshot;
  launchToken?: string;
  code?: string;
}
/** No timers, storage or renderer; one retained logical surface receipt. */
export class NativeWorldReceiptOwner {
  private worldID: 1 | 2 | 3 = 1;
  private generation = 0;
  private revision = 0;
  private lastID = 0;
  private phase: 'absent' | 'ready' | 'entering' | 'active' | 'parked' =
    'absent';
  private launch?: {
    token: string;
    boardID: number;
    action: 'play' | 'continue';
  };
  private fingerprint = '';
  prepare(worldID: 1 | 2 | 3 = 1): number {
    this.worldID = worldID;
    this.generation += 1;
    this.revision = 0;
    this.fingerprint = '';
    this.launch = undefined;
    this.phase = 'ready';
    return this.generation;
  }
  reconcile(state: unknown): void {
    const next = JSON.stringify(state);
    if (next !== this.fingerprint) {
      this.fingerprint = next;
      this.revision += 1;
      this.launch = undefined;
    }
  }
  identity() {
    return { routeGeneration: this.generation, stateRevision: this.revision };
  }
  activate(): boolean {
    if (this.phase !== 'ready') return false;
    this.phase = 'entering';
    return true;
  }
  commit(generation: number, revision: number): boolean {
    if (
      this.phase !== 'entering' ||
      generation !== this.generation ||
      revision !== this.revision
    )
      return false;
    this.phase = 'active';
    return true;
  }
  presentationCurrent(generation: number, revision: number): boolean {
    return (
      (this.phase === 'entering' || this.phase === 'active') &&
      generation === this.generation &&
      revision === this.revision
    );
  }
  recoverPresentation(): boolean {
    if (this.phase !== 'active' && this.phase !== 'entering') return false;
    this.phase = 'entering';
    return true;
  }
  ready(): boolean {
    return this.phase === 'active';
  }
  parked(): boolean { return this.phase === 'parked'; }
  retained(): boolean {
    return this.phase !== 'absent';
  }
  current(generation: number, revision: number): boolean {
    return (
      this.phase === 'active' &&
      generation === this.generation &&
      revision === this.revision
    );
  }
  admit(value: unknown, visible: boolean): NativeWorldAction | null {
    if (!value || typeof value !== 'object') return null;
    const request = value as NativeWorldAction;
    if (
      !Number.isSafeInteger(request.id) ||
      request.id <= this.lastID ||
      request.id <= 0
    )
      return null;
    this.lastID = request.id;
    if (
      !visible ||
      // Native navigation remains available while the Units enter.
      // Card/gameplay actions still require the completed presentation receipt.
      !(request.action === 'back'
        ? this.presentationCurrent(request.routeGeneration, request.stateRevision)
        : this.current(request.routeGeneration, request.stateRevision)) ||
      request.worldID !== this.worldID ||
      !['openCard', 'close', 'play', 'continue', 'back'].includes(
        request.action,
      ) ||
      (request.boardID !== undefined &&
        (!Number.isInteger(request.boardID) ||
          request.boardID < (this.worldID - 1) * 10 + 1 ||
          request.boardID > this.worldID * 10))
    )
      return null;
    return request;
  }
  cancelLaunch(): void {
    this.launch = undefined;
  }
  prepareLaunch(request: NativeWorldAction): string {
    const token = `${this.generation}:${this.revision}:${request.id}`;
    this.launch = {
      token,
      boardID: request.boardID!,
      action: request.action as 'play' | 'continue',
    };
    return token;
  }
  consumeLaunch(
    token: string,
  ): { boardID: number; action: 'play' | 'continue' } | null {
    const launch = this.launch;
    if (this.phase !== 'active' || !launch || launch.token !== token)
      return null;
    this.launch = undefined;
    this.phase = 'parked';
    return { boardID: launch.boardID, action: launch.action };
  }
  returnReady(): boolean {
    if (this.phase !== 'parked') return false;
    this.phase = 'entering';
    return true;
  }
  retire(): void {
    this.phase = 'absent';
    this.launch = undefined;
    this.generation += 1;
  }
}
