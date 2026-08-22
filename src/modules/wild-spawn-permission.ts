import { hasLastMergeTile } from './app-core-wild-preload.ts';
import { isWildMeterReady } from './wild-spawn-continuation.ts';

export type WildSpawnPermissionAction = 'allow' | 'block' | 'retry';

export type WildSpawnPermission = {
  action: WildSpawnPermissionAction;
  reason: string;
  retryDelayMs?: number;
};

export type WildSpawnPermissionInput = {
  tiles: any[];
  wildMeter: number;
  boardWildSpawnEnabled?: boolean;
  boardWildMeterEnabled?: boolean;
  wildSpawnInProgress?: boolean;
  busyEnding?: boolean;
  boardTransitionActive?: boolean;
  failScreenPending?: boolean;
  activeAnimationBlockReason?: string | null;
  devLog?: (...args: any[]) => void;
};

// The merge owner already keeps the reward out of the board until its atomic
// cleanup/spawn mutation has finished. This short paint handoff lets Pixi
// publish that final state without an additional half-second visual pause.
export const WILD_SPAWN_BOARD_SETTLE_MS = 80;

function block(reason: string): WildSpawnPermission {
  return { action: 'block', reason };
}

function retry(reason: string, retryDelayMs: number): WildSpawnPermission {
  return { action: 'retry', reason, retryDelayMs };
}

export function resolveWildSpawnPermission(input: WildSpawnPermissionInput): WildSpawnPermission {
  if (input.boardWildMeterEnabled === false) return block('wild-meter-disabled');
  if (input.boardWildSpawnEnabled === false) return block('wild-spawn-disabled');
  if (!isWildMeterReady(input.wildMeter)) return block('wild-meter-not-ready');
  if (input.wildSpawnInProgress) return block('wild-spawn-in-progress');
  if (input.busyEnding) return block('busyEnding');
  if (input.boardTransitionActive) return block('board-transition');
  if (input.failScreenPending) return block('fail-screen-pending');

  if (hasLastMergeTile({ tiles: input.tiles, devLog: input.devLog || (() => {}) })) {
    return block('last-merge');
  }

  if (input.activeAnimationBlockReason) {
    const retryDelayMs =
      input.activeAnimationBlockReason === 'merge6-spawn-in-progress' ||
      input.activeAnimationBlockReason === 'board-settling'
        ? WILD_SPAWN_BOARD_SETTLE_MS
        : 220;
    return retry(input.activeAnimationBlockReason, retryDelayMs);
  }

  return { action: 'allow', reason: 'ready' };
}
