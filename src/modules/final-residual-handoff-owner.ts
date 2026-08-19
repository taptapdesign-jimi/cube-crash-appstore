export type FinalResidualHandoffRun = {
  joined: boolean;
  promise: Promise<void>;
};

/**
 * Owns the final board-residue visual handoff for one gameplay generation.
 *
 * Finality can be reported by more than one asynchronous boundary (the merge
 * resolver and the central endgame check). Those callers must share the same
 * in-flight animation; otherwise each caller can reveal and pop the ghost grid
 * independently.
 */
export class FinalResidualHandoffOwner {
  private active: { generation: number; promise: Promise<void> } | null = null;

  run(generation: number, task: () => Promise<void>): FinalResidualHandoffRun {
    const current = this.active;
    if (current && current.generation === generation) {
      return { joined: true, promise: current.promise };
    }

    const promise = Promise.resolve().then(task);
    const entry = { generation, promise };
    this.active = entry;

    const release = () => {
      if (this.active === entry) this.active = null;
    };
    promise.then(release, release);

    return { joined: false, promise };
  }

  reset(): void {
    this.active = null;
  }
}
