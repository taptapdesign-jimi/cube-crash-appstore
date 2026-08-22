import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.js';

interface JourneyCardInteractionMark {
  phase: string;
  atMs: number;
  boardId?: number;
}

interface JourneyCardInteractionLongFrame {
  phase: string;
  frameMs: number;
  atMs: number;
}

const PROFILE_DURATION_MS = 8000;
const MAX_MARKS = 48;
const MAX_LONG_FRAMES = 12;

/**
 * Read-only physical-iPhone profiler for one rapid Journey Card interaction
 * chain. It spans open, dismiss, native scroll and re-open while owning only
 * one bounded RAF. Phase changes are buffered and cross the native bridge once
 * in the final summary so the profiler does not manufacture the hitch it is
 * measuring.
 */
export class JourneyCardInteractionProfiler {
  private startedAt = 0;
  private previousFrameAt = 0;
  private frameId = 0;
  private currentPhase = 'inactive';
  private startBoardId: number | null = null;
  private openCount = 0;
  private frameCount = 0;
  private totalFrameMs = 0;
  private worstFrameMs = 0;
  private over20 = 0;
  private over34 = 0;
  private over50 = 0;
  private marks: JourneyCardInteractionMark[] = [];
  private longFrames: JourneyCardInteractionLongFrame[] = [];

  public begin(boardId: number): void {
    if (this.frameId !== 0) {
      this.openCount += 1;
      this.mark('card-reopen-handler', boardId);
      return;
    }

    const now = performance.now();
    this.startedAt = now;
    this.previousFrameAt = now;
    this.currentPhase = 'card-open-handler';
    this.startBoardId = boardId;
    this.openCount = 1;
    this.frameCount = 0;
    this.totalFrameMs = 0;
    this.worstFrameMs = 0;
    this.over20 = 0;
    this.over34 = 0;
    this.over50 = 0;
    this.marks = [{ phase: this.currentPhase, atMs: 0, boardId }];
    this.longFrames = [];
    this.frameId = requestAnimationFrame(this.sampleFrame);
  }

  public mark(phase: string, boardId?: number): void {
    if (this.frameId === 0 || !phase) return;
    this.currentPhase = phase;
    if (this.marks.length >= MAX_MARKS) return;
    this.marks.push({
      phase,
      atMs: Number((performance.now() - this.startedAt).toFixed(2)),
      ...(boardId === undefined ? {} : { boardId }),
    });
  }

  public dispose(reason = 'disposed'): void {
    if (this.frameId === 0) return;
    this.emitSummary(reason);
  }

  private readonly sampleFrame = (now: number): void => {
    this.frameId = 0;
    const frameMs = Math.max(0, now - this.previousFrameAt);
    this.previousFrameAt = now;
    if (this.frameCount > 0) {
      this.totalFrameMs += frameMs;
      this.worstFrameMs = Math.max(this.worstFrameMs, frameMs);
      if (frameMs > 20) {
        this.over20 += 1;
        this.longFrames.push({
          phase: this.currentPhase,
          frameMs: Number(frameMs.toFixed(2)),
          atMs: Number((now - this.startedAt).toFixed(2)),
        });
        this.longFrames.sort((a, b) => b.frameMs - a.frameMs);
        if (this.longFrames.length > MAX_LONG_FRAMES) this.longFrames.length = MAX_LONG_FRAMES;
      }
      if (frameMs > 34) this.over34 += 1;
      if (frameMs > 50) this.over50 += 1;
    }
    this.frameCount += 1;

    if ((now - this.startedAt) >= PROFILE_DURATION_MS) {
      this.emitSummary('window-complete');
      return;
    }
    this.frameId = requestAnimationFrame(this.sampleFrame);
  };

  private emitSummary(result: string): void {
    if (this.frameId !== 0) cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    const durationMs = Math.max(0, performance.now() - this.startedAt);
    const measuredFrames = Math.max(0, this.frameCount - 1);
    emitNativeConsoleDiagnostic('[CC_JOURNEY_CARD_CHAIN]', 'summary', {
      result,
      durationMs: Number(durationMs.toFixed(2)),
      startBoardId: this.startBoardId,
      openCount: this.openCount,
      frameCount: measuredFrames,
      averageFrameMs: measuredFrames > 0
        ? Number((this.totalFrameMs / measuredFrames).toFixed(2))
        : 0,
      worstFrameMs: Number(this.worstFrameMs.toFixed(2)),
      over20: this.over20,
      over34: this.over34,
      over50: this.over50,
      marks: this.marks,
      longFrames: this.longFrames,
    });
    this.currentPhase = 'inactive';
    this.startBoardId = null;
    this.marks = [];
    this.longFrames = [];
  }
}
