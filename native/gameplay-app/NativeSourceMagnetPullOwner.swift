import Foundation

/// Original per-target linked timeline roots, borrowed from the app Source
/// clock. A finite owner never creates a timer/displaylink or renderer demand.
@MainActor final class NativeSourceMagnetPullOwner {
 final class Root {
  private var release:((Bool)->Void)?
  init(_ release:@escaping(Bool)->Void){self.release=release}
  func cancel(success:Bool=false){let action=release;release=nil;action?(success)}
 }
 typealias Register=(any NativeSourceAnimationParticipant,Double,Double,@escaping(Bool)->Void)->Root?
 enum Completion:Equatable {case cleaned,interrupted,unavailable,timeout}
 struct Target {let id:String;let pose:NativeSourceMagnetPullMotion.Pose}
 struct Hooks {
  let current:()->Bool
  let random:()->Double
  let protect:(Target)->Bool
  /// Literal killTweensOf(scale) after the two creation draws; preserves the
  /// surviving ordinary idle rotation/callback root.
  let prepareRoot:(Target)->Bool
  let read:(String)->NativeSourceMagnetPullMotion.Pose?
  let paint:(String,NativeSourceMagnetPullMotion.Pose)->Bool
  let arrived:(String)->Bool
  /// Same Source sound then tryMerge prefix; the literal import continuation
  /// must be enqueued by the genuinely bound APP FIFO, not dispatched by us.
  let convergence:()->Bool
  let restore:(Target)->Void
  let acquireFrames:()->(()->Void)?
  let stopForceSound:()->Void
  let releasePullGuard:()->Void
  let pullGuardActive:()->Bool
  let scheduleTimeout:(Int,@escaping()->Void,@escaping()->Void)->(()->Void)?
  let recoveryCheck:(Int)->Void
  let finished:(Completion)->Void
 }
 @MainActor private final class Participant:NativeSourceAnimationParticipant {
  let advance:(Double)->Void
  init(_ advance:@escaping(Double)->Void){self.advance=advance}
  func advanceSourceAnimation(seconds:Double){advance(seconds)}
 }
 @MainActor private final class Entry {
  let target:Target,motion:NativeSourceMagnetPullMotion
  var participant:Participant?,lease:Root?
  var initializedPoint:NativeSourceMagnetPullMotion.Point?,initializedRotation:Double?
  var arrived=false,retired=false
  init(target:Target,motion:NativeSourceMagnetPullMotion){self.target=target;self.motion=motion}
 }
 private let register:Register,hooks:Hooks
 private var entries:[String:Entry]=[:],ordered:[Entry]=[],protected:[Target]=[]
 private var timeoutSequence:UInt64=0,activeTimeout:UInt64?
 private var releaseFrames:(()->Void)?,cancelTimeout:(()->Void)?
 private var starting=false,begun=false,closed=false
 private(set) var mergeStarted=false
 private var arrivalCount=0
 var active:Bool {begun && !closed}
 init(register:@escaping Register,hooks:Hooks){self.register=register;self.hooks=hooks}
 private func current()->Bool {
  guard !closed else{return false};let answer=hooks.current();return answer && !closed
 }
 private func owns(_ entry:Entry)->Bool {!closed && !entry.retired && entries[entry.target.id] === entry}
 @discardableResult func start(targets:[Target],destination:NativeSourceMagnetPullMotion.Point,tileSize:Double=128)->Bool {
  guard !begun,!starting,current(),!targets.isEmpty,Set(targets.map(\.id)).count==targets.count else{return false}
  starting=true;begun=true
  // Literal protect/stop-idle pass completes for ALL targets before its one
  // pull100 capture and before the two per-target creation-time APP draws.
  for target in targets {
   guard current() else{finish(.unavailable);return false}
   protected.append(target) // before external protector: cleanup owns a partially entered write too.
   guard hooks.protect(target),current() else{finish(.unavailable);return false}
  }
  let release=hooks.acquireFrames()
  guard current(),let release else{release?();finish(.unavailable);return false}
  releaseFrames=release
  for (index,target) in targets.enumerated() {
   guard current() else{finish(.unavailable);return false}
   let motion=NativeSourceMagnetPullMotion(start:target.pose.point,destination:destination,rotation:target.pose.rotation,
    scaleX:target.pose.scaleX,scaleY:target.pose.scaleY,index:index,count:targets.count,tileSize:tileSize,random:{[weak self] in
     guard let self,self.current() else{return .nan};let value=self.hooks.random();return self.current() ? value:.nan
    })
   guard current(),let motion,hooks.prepareRoot(target),current() else{finish(.unavailable);return false}
   let entry=Entry(target:target,motion:motion);entries[target.id]=entry;ordered.append(entry)
   let participant=Participant{[weak self,weak entry] seconds in guard let self,let entry else{return};self.advance(entry,seconds:seconds)}
   entry.participant=participant
   let lease=register(participant,motion.duration,motion.delay,{[weak self,weak entry] success in
    guard let self,let entry,self.owns(entry) else{return};entry.lease=nil
    // Source natural completion marks the timeline killed but retains the
    // captured list/activity until cleanupAllPullAnimations. No frame release.
    if !success {self.retire(entry,restore:!self.mergeStarted)}
   })
   guard current(),owns(entry),let lease else{lease?.cancel(success:false);finish(.unavailable);return false}
   entry.lease=lease
  }
  timeoutSequence &+= 1;let timeoutID=timeoutSequence;activeTimeout=timeoutID
  let timeout=hooks.scheduleTimeout(2000,{[weak self] in
   guard let self,!self.closed,self.activeTimeout==timeoutID else{return}
   self.activeTimeout=nil;self.cancelTimeout=nil
   guard self.current() else{self.finish(.unavailable);return}
   let active=self.hooks.pullGuardActive()
   guard self.current() else{self.finish(.unavailable);return}
   if active {self.finish(.timeout,recoveryMilliseconds:120)}
  },{[weak self] in
   guard let self,self.activeTimeout==timeoutID else{return}
   self.activeTimeout=nil;self.cancelTimeout=nil
  })
  // Scheduler may deliver/cancel synchronously, including teardown. A late
  // handle belongs to that old receipt and cannot be published after closure.
  guard current(),activeTimeout==timeoutID,let timeout else{
   timeout?();if !closed {finish(.unavailable)};return false
  }
  cancelTimeout=timeout;starting=false;return true
 }

 private func advance(_ entry:Entry,seconds:Double) {
  guard !closed,owns(entry) else{return}
  guard current() else{finish(.unavailable);return}
  if entry.initializedPoint==nil {
   guard let pose=hooks.read(entry.target.id),current(),owns(entry) else{retire(entry,restore:!mergeStarted);return}
   entry.initializedPoint=pose.point;entry.initializedRotation=pose.rotation
  }
  let pose=entry.motion.sample(seconds:seconds,initializedPoint:entry.initializedPoint,initializedRotation:entry.initializedRotation)
  guard hooks.paint(entry.target.id,pose),current(),owns(entry) else{retire(entry,restore:!mergeStarted);return}
  // Source children continue to paint after convergence; only onUpdate's
  // marker/check branch yields to the already-started merge coroutine.
  guard !mergeStarted,!entry.arrived,pose.converged else{return}
  guard hooks.arrived(entry.target.id),current(),owns(entry) else{retire(entry,restore:true);return}
  entry.arrived=true;arrivalCount+=1
  if arrivalCount==ordered.count {
   mergeStarted=true
   let admitted=hooks.convergence()
   guard admitted,current() else{finish(.unavailable);return}
  }
 }
 private func retire(_ entry:Entry,restore:Bool) {
  guard owns(entry) else{return};entry.retired=true;entries.removeValue(forKey:entry.target.id)
  let lease=entry.lease;entry.lease=nil;entry.participant=nil
  lease?.cancel(success:false)
  if restore,current(){hooks.restore(entry.target)}
 }
 /// Genuine handler finally/owned destructive cleanup; old A's captured
 /// closures cannot release or restore a later C participant/object.
 func cleanup(preserveCommittedSound:Bool=false){finish(.cleaned,preserveCommittedSound:preserveCommittedSound)}
 func dispose(){finish(.interrupted)}
 private func finish(_ outcome:Completion,preserveCommittedSound:Bool=false,recoveryMilliseconds:Int?=nil) {
  guard !closed else{return};let canRestore = !mergeStarted
  closed=true;starting=false
  let captured=ordered,restoreTargets=protected;ordered=[];protected=[];entries=[:];activeTimeout=nil
  let release=releaseFrames,timeout=cancelTimeout;releaseFrames=nil;cancelTimeout=nil
  // Seal and unhook before all external cancellation/release callbacks.
  for entry in captured {entry.retired=true;let lease=entry.lease;entry.lease=nil;entry.participant=nil;lease?.cancel(success:false)}
  timeout?();release?()
  // Restore hook requires the exact captured target/parent/gen/pull token;
  // do not query a reentrant scope predicate before the terminal seal.
  if canRestore {for target in restoreTargets{hooks.restore(target)}}
  if !preserveCommittedSound {hooks.stopForceSound()}
  hooks.releasePullGuard()
  if let recoveryMilliseconds {hooks.recoveryCheck(recoveryMilliseconds)}
  hooks.finished(outcome)
 }
 isolated deinit {dispose()}
}
