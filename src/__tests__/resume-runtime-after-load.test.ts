import { resumeRuntimeAfterLoad } from '../modules/app-core-load-finalize.ts';

describe('resumeRuntimeAfterLoad', () => {
  it('calls gsap resume and ticker start', () => {
    let resumed = false;
    let started = false;

    const app = { ticker: { start: () => { started = true; } } } as any;
    const gsap = { globalTimeline: { resume: () => { resumed = true; } } } as any;

    resumeRuntimeAfterLoad({ app, gsap, devLog: () => {}, devWarn: () => {} });

    expect(resumed).toBe(true);
    expect(started).toBe(true);
  });
});
