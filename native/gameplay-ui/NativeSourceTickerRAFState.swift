import Foundation

/// Literal GSAP3.13 ticker dispatch/finite root GC state. This value does not
/// schedule native work, acquire activity or invent a display-frame duration.
public struct NativeSourceTickerRAFState:Equatable,Sendable {
 public struct Dispatch:Equatable,Sendable {public let seconds,deltaMilliseconds:Double;public let frame:UInt64}
 public private(set) var awake=false,frame:UInt64=0,nextGCFrame:UInt64=30
 public private(set) var seconds=0.0
 private var startWall,lastWall,nextTime:Double
 private let gap=1000.0/240.0
 public init(wallOriginMilliseconds:Double){startWall=floor(wallOriginMilliseconds);lastWall=startWall;nextTime=1000.0/240.0}
 /// Source wake also calls _tick(2); caller enqueues next token BEFORE rendering
 /// its returned dispatch. Wake/RAF itself can enqueue without dispatch.
 public mutating func wake(wallMilliseconds:Double)->Dispatch? {awake=true;return tick(wallMilliseconds:wallMilliseconds)}
 public mutating func tick(wallMilliseconds:Double)->Dispatch? {
  guard awake else{return nil}
  let wall=floor(wallMilliseconds),elapsed=wall-lastWall
  if elapsed>500 || elapsed<0 {startWall += elapsed-33}
  lastWall += elapsed
  let time=lastWall-startWall,overlap=time-nextTime
  guard overlap>0 else{return nil}
  frame &+= 1;let delta=time-seconds*1000;seconds=time/1000
  nextTime += overlap + (overlap>=gap ? 4:gap-overlap)
  return Dispatch(seconds:seconds,deltaMilliseconds:delta,frame:frame)
 }
 /// Called after actual updateRoot render but BEFORE ordinary ticker listeners.
 /// Child admission represents literal globalTimeline child._ts!=0, including
 /// children retained beneath a paused globalTimeline; visual opacity is irrelevant.
 public mutating func finishRootRender(hasRunningChild:Bool,listenerCount:Int=1) {
  guard awake,frame>=nextGCFrame else{return}
  nextGCFrame &+= 120
  if !hasRunningChild && listenerCount<2 {awake=false}
 }
 /// Explicit original ticker.sleep/disposal, never modal/background pause.
 public mutating func sleep(){awake=false}
}
