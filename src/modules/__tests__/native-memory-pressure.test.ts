import fs from 'node:fs';
import path from 'node:path';

describe('native memory warning wiring', () => {
  it('releases idle owner caches without calling generic destructive cleanup', async () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../main.ts'), 'utf8');
    const body = source.split('(window as any).__ccHandleNativeMemoryWarning = () => {')[1]
      .split('\n    };')[0];
    const emit = jest.fn();
    const audio = jest.fn();
    const sheets = jest.fn(() => Promise.resolve());
    const textureGC = jest.fn();
    const handler = new Function('emitRuntimeMemoryPressureSnapshot', 'releaseIdleDecodedGameplayAudio',
      'releaseIdleSharedPixiSheets', 'window', 'logger', body.replace('(window as any)', 'window'));
    handler(emit, audio, sheets, { STATE: { app: { renderer: { textureGC: { run: textureGC } } } } }, { warn: jest.fn() });
    expect(audio).toHaveBeenCalledTimes(1);
    expect(sheets).toHaveBeenCalledTimes(1);
    expect(textureGC).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(emit).toHaveBeenCalledWith('native-memory-warning:idle-sheets-released');
    expect(body).not.toContain('memoryManager.');
  });
});
