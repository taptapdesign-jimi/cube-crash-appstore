import Foundation
import StackToSixGameplay

/// All reads are supplied by actual Source owners. No false marker defaults,
/// Core-revision substitution, UI random draw or implicit resource await.
@MainActor final class NativeSourceMagnetSceneBindings {
    let admitted:()->Bool
    let ownsLifecycle:(NativeSpecialMovePlan)->Bool
    let simulate:()->Bool
    let observation:(NativeSpecialMovePlan)->NativeSourceMagnetCoroutineOwner.Observation?
    let fallback:(NativeSpecialMovePlan,Int,@escaping(Bool)->Void)->Bool
    let fxStatus:()->Bool?
    let clearLastMerge:(NativeSpecialMovePlan)->Void
    let updateGhostVisibility:()->Void
    let centralCheck:(String)->Void
    let cleanupPullAnimations:(NativeSpecialMovePlan)->Void
    let releasePullFlag:(NativeSpecialMovePlan)->Void
    init(admitted:@escaping()->Bool,ownsLifecycle:@escaping(NativeSpecialMovePlan)->Bool,
        simulate:@escaping()->Bool,observation:@escaping(NativeSpecialMovePlan)->NativeSourceMagnetCoroutineOwner.Observation?,
        fallback:@escaping(NativeSpecialMovePlan,Int,@escaping(Bool)->Void)->Bool,fxStatus:@escaping()->Bool?,
        clearLastMerge:@escaping(NativeSpecialMovePlan)->Void,updateGhostVisibility:@escaping()->Void,
        centralCheck:@escaping(String)->Void,cleanupPullAnimations:@escaping(NativeSpecialMovePlan)->Void,
        releasePullFlag:@escaping(NativeSpecialMovePlan)->Void){self.admitted=admitted;self.ownsLifecycle=ownsLifecycle;self.simulate=simulate;self.observation=observation;self.fallback=fallback;self.fxStatus=fxStatus;self.clearLastMerge=clearLastMerge;self.updateGhostVisibility=updateGhostVisibility;self.centralCheck=centralCheck;self.cleanupPullAnimations=cleanupPullAnimations;self.releasePullFlag=releasePullFlag}
}
