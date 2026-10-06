import { releaseNativeBoardTransitionPresentation } from '../board-transition-native-presentation';
import { gsap } from 'gsap';

test('actual paused cloud timeline keeps its authored pose and delay when ACK resumes playback',async()=>{
  const pose={scale:.12,opacity:0};
  const cloud=gsap.timeline({paused:true,delay:.7}).to(pose,{scale:1.22,opacity:1,duration:.4});
  const initial=cloud.time();
  expect(pose).toMatchObject({scale:.12,opacity:0});
  await releaseNativeBoardTransitionPresentation({ready:async()=>true,isCurrent:()=>true,start:()=>cloud.play(),cancel:()=>cloud.kill()});
  expect(cloud.time()).toBe(initial);
  expect(cloud.startTime()-cloud.parent!.rawTime()).toBeCloseTo(.7,2);
  expect(pose).toMatchObject({scale:.12,opacity:0});cloud.kill();
});

test('delayed native ACK starts no cloud, scene enter or authored audio before actual coverage release',async()=>{
  let ack!:(accepted:boolean)=>void;
  const ready=new Promise<boolean>(resolve=>{ack=resolve;});
  const cloud=jest.fn(),scene=jest.fn(),audio=jest.fn(),cancel=jest.fn();
  const pending=releaseNativeBoardTransitionPresentation({ready:()=>ready,isCurrent:()=>true,
    start:()=>{audio();cloud();scene();},cancel});
  await Promise.resolve();await Promise.resolve();
  expect(audio).not.toHaveBeenCalled();expect(cloud).not.toHaveBeenCalled();expect(scene).not.toHaveBeenCalled();
  ack(true);await pending;
  expect(audio).toHaveBeenCalledTimes(1);expect(cloud).toHaveBeenCalledTimes(1);expect(scene).toHaveBeenCalledTimes(1);expect(cancel).not.toHaveBeenCalled();
});

test.each(['cancel','reject','stale'] as const)('native presentation %s leaves authored clocks stopped',async(mode)=>{
  const start=jest.fn(),cancel=jest.fn();
  await releaseNativeBoardTransitionPresentation({ready:()=>mode==='reject'?Promise.reject(new Error('bridge failed')):Promise.resolve(mode==='stale'),
    isCurrent:()=>mode!=='stale',start,cancel});
  expect(start).not.toHaveBeenCalled();expect(cancel).toHaveBeenCalledTimes(mode==='stale'?0:1);
});

test('a throwing authored start cancels the same current transition without an unhandled rejection',async()=>{
  const cancel=jest.fn();
  await expect(releaseNativeBoardTransitionPresentation({ready:async()=>true,isCurrent:()=>true,
    start:()=>{throw new Error('audio start failed');},cancel})).resolves.toBeUndefined();
  expect(cancel).toHaveBeenCalledTimes(1);
});
