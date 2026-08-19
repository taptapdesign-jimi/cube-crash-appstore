import { FinalResidualHandoffOwner } from '../final-residual-handoff-owner.ts';

describe('FinalResidualHandoffOwner', () => {
  it('shares one in-flight handoff within a gameplay generation', async () => {
    const owner = new FinalResidualHandoffOwner();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const task = jest.fn(() => gate);

    const first = owner.run(7, task);
    const duplicate = owner.run(7, task);

    expect(first.joined).toBe(false);
    expect(duplicate.joined).toBe(true);
    expect(duplicate.promise).toBe(first.promise);
    expect(task).toHaveBeenCalledTimes(0);

    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first.promise, duplicate.promise]);
  });

  it('does not let an old generation release a newer owner', async () => {
    const owner = new FinalResidualHandoffOwner();
    let releaseOld!: () => void;
    let releaseNew!: () => void;
    const oldRun = owner.run(3, () => new Promise<void>((resolve) => { releaseOld = resolve; }));
    const newRun = owner.run(4, () => new Promise<void>((resolve) => { releaseNew = resolve; }));

    await Promise.resolve();
    releaseOld();
    await oldRun.promise;

    const duplicateNew = owner.run(4, async () => {});
    expect(duplicateNew.joined).toBe(true);
    expect(duplicateNew.promise).toBe(newRun.promise);

    releaseNew();
    await newRun.promise;
  });
});
