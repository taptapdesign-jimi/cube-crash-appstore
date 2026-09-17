import fs from 'node:fs';
import ts from 'typescript';

it('disabled pointer diagnostics never measure the canvas; enabled diagnostics still report coordinates', () => {
  const source = fs.readFileSync('src/modules/drag-core.ts', 'utf8');
  const start = source.indexOf('  const onCanvasPointerTrace =');
  const end = source.indexOf('  const onCanvasPointerDownTrace', start);
  const js = ts.transpileModule(source.slice(start, end).replace('import.meta.env.DEV', 'false'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const rect = jest.fn(() => ({ left: 10, top: 20, width: 390, height: 844 }));
  const emit = jest.fn();
  const flags = { __ccFastStackDiagnostics: false };
  const handler = new Function('app', 'window', 'emitFastStackTrace', `${js}; return onCanvasPointerTrace('canvas-pointer-down');`)(
    { canvas: { getBoundingClientRect: rect } }, flags, emit,
  );
  const event = { pointerId: 1, pointerType: 'touch', buttons: 1, clientX: 30, clientY: 60 };
  handler(event);
  expect(rect).not.toHaveBeenCalled(); expect(emit).not.toHaveBeenCalled();
  flags.__ccFastStackDiagnostics = true; handler(event);
  expect(rect).toHaveBeenCalledTimes(1);
  expect(emit).toHaveBeenCalledWith('canvas-pointer-down', expect.objectContaining({ canvas: { x: 20, y: 40, width: 390, height: 844 } }));
});
