import Foundation
#if canImport(UIKit)
import XCTest
@testable import Stack_to_Six
#endif

@MainActor private final class PullFixture {
 let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0)
 var owner:NativeSourceMagnetPullOwner!
 var poses:[String:NativeSourceMagnetPullMotion.Pose]=[:],protected:[String]=[],restored:[String]=[],arrivals:[String]=[],trace:[String]=[]
 var valid=true,draws=0,acquired=0,released=0,guardReleased=0,soundsStopped=0,body=0,finished=0
 var afterConvergence:(()->Void)?
 var afterProtect:(()->Void)?,afterAcquire:(()->Void)?,afterRandom:(()->Void)?,afterPaint:(()->Void)?
 var onFinished:(()->Void)?,timeoutElapsed:(()->Void)?,timeoutCancelled:(()->Void)?
 var timeoutMode=0,cancelCount=0,recovery:[Int]=[]
 #if canImport(UIKit)
 var wall=0.0
 lazy var service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{[weak self] in self?.wall ?? 0})
 #endif
 init(){
  let hooks=NativeSourceMagnetPullOwner.Hooks(current:{[weak self] in self?.valid==true},random:{[weak self] in
   guard let self else{return .nan};self.draws+=1;self.afterRandom?();return 0.5
  },protect:{[weak self] target in guard let self else{return false};self.protected.append(target.id);self.afterProtect?();return true},prepareRoot:{_ in true},read:{[weak self] in self?.poses[$0]},paint:{[weak self] id,pose in
   guard let self else{return false};self.poses[id]=pose;self.afterPaint?();return true
  },arrived:{[weak self] id in self?.arrivals.append(id);return true},convergence:{[weak self] in
   guard let self else{return false};self.body+=1;self.trace.append("body");self.afterConvergence?();return true
  },restore:{[weak self] target in self?.restored.append(target.id);self?.poses[target.id]=target.pose},acquireFrames:{[weak self] in
   guard let self else{return nil};self.acquired+=1;self.afterAcquire?();return {[weak self] in self?.released+=1}
  },stopForceSound:{[weak self] in self?.soundsStopped+=1},releasePullGuard:{[weak self] in self?.guardReleased+=1},pullGuardActive:{true},scheduleTimeout:{[weak self] ms,elapsed,cancelled in
   guard let self else{return nil};precondition(ms==2000);self.timeoutElapsed=elapsed;self.timeoutCancelled=cancelled
   if self.timeoutMode==1{elapsed()};if self.timeoutMode==2{cancelled()}
   return {[weak self] in self?.cancelCount+=1;cancelled()}
  },recoveryCheck:{[weak self] in self?.recovery.append($0)},finished:{[weak self] _ in
   guard let self else{return};self.finished+=1;self.trace.append("finished");self.onFinished?()
  })
  #if canImport(UIKit)
  owner=NativeSourceMagnetPullOwner(service:service,hooks:hooks)
  #else
  owner=NativeSourceMagnetPullOwner(register:{[runtime] participant,duration,delay,cleanup in
   guard let lease=runtime.attach(participant:participant,family:.timeline,duration:duration,delay:delay,cleanup:cleanup) else{return nil}
   return NativeSourceMagnetPullOwner.Root{lease.cancel(success:$0)}
  },hooks:hooks)
  #endif
 }
 var active:Int {
  #if canImport(UIKit)
  service.activeParticipantCount
  #else
  runtime.activeCount
  #endif
 }
 func pause(_ value:Bool){
  #if canImport(UIKit)
  _=service.setSourceGlobalPaused(value)
  #else
  runtime.setGlobalPaused(value)
  #endif
 }
 func deliver(_ ms:Double){
  #if canImport(UIKit)
  wall=ms;service.deliver(wallMilliseconds:ms)
  #else
  runtime.deliver(wallMilliseconds:ms)
  #endif
 }
 @discardableResult func start(_ count:Int=2)->Bool {
  let targets:[NativeSourceMagnetPullOwner.Target]=(0..<count).map{i in
   let x=Double(64+i*148),rotation=0.025*Double(i-1)
   let sx=1.0+Double(i)*0.03,sy=0.96-Double(i)*0.02
   let pose=NativeSourceMagnetPullMotion.Pose(point:.init(x:x,y:64),rotation:rotation,scaleX:sx,scaleY:sy,converged:false)
   return NativeSourceMagnetPullOwner.Target(id:"t\(i)",pose:pose)
  }
  for t in targets{poses[t.id]=t.pose}
  return owner.start(targets:targets,destination:.init(x:148,y:64))
 }
 func dispose(){owner.dispose()
  #if canImport(UIKit)
  service.dispose()
  #else
  runtime.dispose()
  #endif
 }
}

@MainActor private enum PullCases {
 static func naturalRootAndGenuineHandlerFinally(){
  let f=PullFixture();defer{f.dispose()};precondition(f.start(4));precondition(f.draws==8 && f.acquired==1 && f.active==4)
  for ms in stride(from:0,through:950,by:7){f.deliver(Double(ms))}
  precondition(f.body==1 && f.arrivals.count==4 && f.active==0)
  // Literal naturally-killed child roots do NOT release pull100. Only the
  // actual enclosing handler's captured cleanup closes that lease.
  precondition(f.released==0 && f.owner.active && f.finished==0)
  let poses=f.poses;f.owner.cleanup(preserveCommittedSound:true)
  precondition(f.released==1 && f.guardReleased==1 && f.finished==1 && f.soundsStopped==0 && f.restored.isEmpty && f.poses==poses)
  f.owner.cleanup();precondition(f.released==1 && f.finished==1)
 }
 static func sourcePauseWallTimeout(){
  let f=PullFixture();defer{f.dispose()};precondition(f.start());f.deliver(100);let pose=f.poses
  f.pause(true);f.deliver(700);precondition(f.poses==pose && f.body==0 && f.active==2)
  f.timeoutElapsed?();precondition(f.active==0 && f.released==1 && f.restored.count==2 && f.recovery==[120] && f.finished==1)
  f.pause(false);f.deliver(716);precondition(f.body==0)
 }
 static func acquireReentry(){
  let f=PullFixture();defer{f.dispose()};f.afterAcquire={f.owner.dispose()}
  precondition(!f.start(4));precondition(f.draws==0 && f.active==0 && f.released==1 && f.restored.count==4 && f.finished==1)
 }
 static func protectReentry(){
  let f=PullFixture();defer{f.dispose()};f.afterProtect={f.owner.dispose()}
  precondition(!f.start(4));precondition(f.draws==0 && f.acquired==0 && f.active==0 && f.restored==["t0"] && f.finished==1)
 }
 static func randomReentry(){
  let f=PullFixture();defer{f.dispose()};f.afterRandom={f.owner.dispose()}
  precondition(!f.start(4));precondition(f.draws==1 && f.active==0 && f.released==1 && f.restored.count==4 && f.finished==1)
 }
 static func paintReentry(){
  let f=PullFixture();defer{f.dispose()};precondition(f.start(4));f.afterPaint={f.owner.dispose()};f.deliver(280) // last root starts270ms, actual first child/onUpdate at280.
  precondition(f.active==0 && f.released==1 && f.restored.count==4 && f.body==0 && f.finished==1)
 }
 static func schedulerLateHandle(){
  for mode in [1,2]{let f=PullFixture();defer{f.dispose()};f.timeoutMode=mode
   precondition(!f.start());precondition(f.active==0 && f.released==1 && f.cancelCount==1 && f.finished==1)
   f.timeoutElapsed?();precondition(f.finished==1 && f.released==1)
  }
 }
 static func convergenceReentryCannotStartLaterBodyOrRetainSound(){
  let f=PullFixture();defer{f.dispose()};precondition(f.start(2));f.afterConvergence={f.owner.dispose()}
  for ms in stride(from:0,through:850,by:10){f.deliver(Double(ms))}
  precondition(f.body==1 && f.active==0 && f.finished==1 && f.released==1 && f.soundsStopped==1 && f.restored.isEmpty)
  f.timeoutElapsed?();precondition(f.finished==1 && f.soundsStopped==1)
 }
 static func invalidScopeAndOldTimeoutCannotCloseC(){
  let a=PullFixture(),c=PullFixture();defer{a.dispose();c.dispose()};precondition(a.start());let old=a.timeoutElapsed
  a.valid=false;a.deliver(200);precondition(a.active==0 && a.finished==1 && a.released==1)
  precondition(c.start());old?();precondition(c.active==2 && c.released==0 && c.finished==0 && c.draws==4)
 }
}
#if canImport(UIKit)
@MainActor final class NativeSourceMagnetPullOwnerTests:XCTestCase {
 func testNaturalRootRetainsActivityUntilRealHandlerFinally(){PullCases.naturalRootAndGenuineHandlerFinally()}
 func testGlobalPauseDoesNotPauseActualWallTimeout(){PullCases.sourcePauseWallTimeout()}
 func testFrameAcquisitionReentrantDisposeBeforeAnyRng(){PullCases.acquireReentry()}
 func testProtectionReentrantDisposeRestoresEnteredTarget(){PullCases.protectReentry()}
 func testFirstRandomReentryStopsAllLaterDraws(){PullCases.randomReentry()}
 func testPaintReentryDrainsAllCapturedRootsBeforeBody(){PullCases.paintReentry()}
 func testSynchronousTimeoutReturnsLateHandleWithoutRevival(){PullCases.schedulerLateHandle()}
 func testConvergenceReentryStopsOnlyCapturedSoundOnce(){PullCases.convergenceReentryCannotStartLaterBodyOrRetainSound()}
 func testInvalidScopeDrainsAndOldTimeoutCannotCloseReplacement(){PullCases.invalidScopeAndOldTimeoutCannotCloseC()}
}
#else
@main struct PullOwnerProof {
 @MainActor static func main(){
  PullCases.naturalRootAndGenuineHandlerFinally();PullCases.sourcePauseWallTimeout();PullCases.acquireReentry();PullCases.protectReentry();PullCases.randomReentry();PullCases.paintReentry();PullCases.schedulerLateHandle();PullCases.invalidScopeAndOldTimeoutCannotCloseC();PullCases.convergenceReentryCannotStartLaterBodyOrRetainSound()
  print("PASS 9 actual Source root lifecycle tests: natural tail, pause/wall timeout, acquire/protect/RNG/paint reentry, late scheduler, oldA/newC")
 }
}
#endif
