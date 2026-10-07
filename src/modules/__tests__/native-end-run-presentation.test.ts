import { canPresentNativeEndRun, presentNativeEndRun } from '../native-end-run-presentation';
const host = window as any;
const model = {title:'Exit Game?',subtitle:'Round 01 progress saved.',restartLabel:'New Game',exitLabel:'Exit Game'};
let post: jest.Mock;
let session: ReturnType<typeof presentNativeEndRun>;
let callbacks: {isCurrent:jest.Mock;onReady:jest.Mock;onFallback:jest.Mock;onAction:jest.Mock};
beforeEach(() => {
  jest.useFakeTimers();post = jest.fn();
  host.__jimiNativeEndRunEnabled = true;host.webkit = {messageHandlers:{jimiHomeHub:{postMessage:post}}};
  Object.defineProperty(document,'hidden',{configurable:true,value:false});
  callbacks = {isCurrent:jest.fn(()=>true),onReady:jest.fn(),onFallback:jest.fn(),onAction:jest.fn(()=>true)};
});
afterEach(() => {session?.dispose();delete host.__jimiNativeEndRunEnabled;delete host.webkit;delete host.__jimiNativeEndRun;jest.useRealTimers();});
test('web/default path has no native owner or work',()=>{
  host.__jimiNativeEndRunEnabled = false;expect(canPresentNativeEndRun()).toBe(false);
  expect(presentNativeEndRun(model,callbacks)).toBeNull();expect(post).not.toHaveBeenCalled();expect(jest.getTimerCount()).toBe(0);
});
test('one ready receipt admits one canonical action and retires admission cap',()=>{
  session = presentNativeEndRun(model,callbacks)!;expect(post.mock.calls[0][0]).toMatchObject({command:'present',model});
  expect(host.__jimiNativeEndRun.activate(session.id,'exit')).toBe(false);
  expect(host.__jimiNativeEndRun.ready(session.id)).toBe(true);expect(jest.getTimerCount()).toBe(0);
  expect(host.__jimiNativeEndRun.activate(session.id,'exit')).toBe(true);
  expect(host.__jimiNativeEndRun.activate(session.id,'restart')).toBe(false);expect(callbacks.onAction).toHaveBeenCalledTimes(1);
});
test('canonical rejection keeps the same owner available',()=>{
  callbacks.onAction.mockReturnValue(false);session = presentNativeEndRun(model,callbacks)!;host.__jimiNativeEndRun.ready(session.id);
  expect(host.__jimiNativeEndRun.activate(session.id,'restart')).toBe(false);
  callbacks.onAction.mockReturnValue(true);expect(host.__jimiNativeEndRun.activate(session.id,'close')).toBe(true);
});
test('malformed, hidden and retired receipts cannot call gameplay',()=>{
  session = presentNativeEndRun(model,callbacks)!;host.__jimiNativeEndRun.ready(session.id);
  expect(host.__jimiNativeEndRun.activate(session.id+1,'exit')).toBe(false);
  expect(host.__jimiNativeEndRun.activate(session.id,'delete')).toBe(false);
  Object.defineProperty(document,'hidden',{configurable:true,value:true});expect(host.__jimiNativeEndRun.activate(session.id,'exit')).toBe(false);
  Object.defineProperty(document,'hidden',{configurable:true,value:false});callbacks.isCurrent.mockReturnValue(false);
  expect(host.__jimiNativeEndRun.activate(session.id,'exit')).toBe(false);expect(callbacks.onAction).not.toHaveBeenCalled();
});
test('missing/rejected native presentation falls back once and rejects late completion',()=>{
  session = presentNativeEndRun(model,callbacks)!;const bridge = host.__jimiNativeEndRun;
  jest.advanceTimersByTime(1000);expect(callbacks.onFallback).toHaveBeenCalledTimes(1);
  expect(bridge.ready(session.id)).toBe(false);bridge.rejected(session.id);expect(callbacks.onFallback).toHaveBeenCalledTimes(1);
});
test('hidden time does not consume native admission cap',()=>{
  session = presentNativeEndRun(model,callbacks)!;jest.advanceTimersByTime(200);
  Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));jest.advanceTimersByTime(5000);
  expect(callbacks.onFallback).not.toHaveBeenCalled();
  Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));jest.advanceTimersByTime(800);
  expect(callbacks.onFallback).toHaveBeenCalledTimes(1);
});
test('close and duplicate disposal retire only the exact native presentation',()=>{
  session = presentNativeEndRun(model,callbacks)!;host.__jimiNativeEndRun.ready(session.id);session.close();session.close();session.dispose();session.dispose();
  expect(post.mock.calls.map(c=>c[0].command)).toEqual(['present','close','revoke']);expect(jest.getTimerCount()).toBe(0);
});
test('replacement revokes prior receipt and only replacement can become ready',()=>{
  const old = presentNativeEndRun(model,callbacks)!;const bridge = host.__jimiNativeEndRun;
  session = presentNativeEndRun(model,callbacks)!;expect(bridge.ready(old.id)).toBe(false);
  expect(host.__jimiNativeEndRun.ready(session.id)).toBe(true);expect(post.mock.calls[1][0]).toMatchObject({command:'revoke',id:old.id});
});

test('canonical departure waits for exact native dismissal, not its duration', async () => {
  session = presentNativeEndRun(model,callbacks)!;host.__jimiNativeEndRun.ready(session.id);
  const departed = jest.fn();session.exitComplete.then(departed);session.close();
  jest.advanceTimersByTime(650);await Promise.resolve();expect(departed).not.toHaveBeenCalled();
  expect(host.__jimiNativeEndRun.closed(session.id+1)).toBe(false);
  expect(host.__jimiNativeEndRun.closed(session.id)).toBe(true);
  await expect(session.exitComplete).resolves.toBe(true);expect(jest.getTimerCount()).toBe(0);
});
test('force retirement cancels pending departure and late dismissal cannot release a replacement', async () => {
  const old = presentNativeEndRun(model,callbacks)!;const bridge = host.__jimiNativeEndRun;
  old.close();session = presentNativeEndRun(model,callbacks)!;
  await expect(old.exitComplete).resolves.toBe(false);expect(bridge.closed(old.id)).toBe(false);
});
test('lost dismissal receipt retires native cover before bounded canonical recovery', async () => {
  session = presentNativeEndRun(model,callbacks)!;host.__jimiNativeEndRun.ready(session.id);session.close();
  Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
  jest.advanceTimersByTime(5000);expect(post.mock.calls.map(c=>c[0].command)).toEqual(['present','close']);
  Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));
  jest.advanceTimersByTime(1500);await expect(session.exitComplete).resolves.toBe(true);
  expect(post.mock.calls[post.mock.calls.length-1][0].command).toBe('revoke');
});
