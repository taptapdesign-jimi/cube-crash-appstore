import Foundation
import StackToSixGameplay

/// These are CALLER prerequisites, separate from Core's fresh endgame check.
/// There is deliberately no initializer which guesses them from resolve().
@MainActor struct NativeSourceNoMovesLevelEndPreflight {
    let generation: UInt64
    let signature: String
    let stableStuckRechecksCompleted: Bool
    let tutorialRescueDeclined: Bool
    let recentTntMutationRecheckCompleted: Bool
    let sourceCallerWaitsCompleted: Bool
    let extraWaitMilliseconds: Int
    func admits(_ engine: NativeGameplayEngine) -> Bool {
        generation == engine.state.generation && signature == engine.sourceGameplaySignature.key &&
        stableStuckRechecksCompleted && tutorialRescueDeclined && recentTntMutationRecheckCompleted &&
        sourceCallerWaitsCompleted && extraWaitMilliseconds == 0 && engine.state.tutorial == nil
    }
}

/// Exact idle registry/tag/guard queue/terminal fields belong to their actual
/// native owners. All callbacks are mandatory; no generic visual cleanup or
/// all-children interruption is substituted for TILE_IDLE_BOUNCE.stop().
@MainActor struct NativeSourceNoMovesSceneBindings {
    /// nil preserves existing conservative Core guard; complete captured owner only.
    var runtimeAuthority:NativeSourceNoMovesRuntimeAuthority?=nil
    var visibleShowCue: (UInt64,UInt64) -> Void
    var admitted: (UInt64) -> Bool
    var refreshRuntime: () -> Void
    var ordinaryCallerReady: (String, UInt64) -> Bool
    var levelEndPreflight: () -> NativeSourceNoMovesLevelEndPreflight?
    var stopIdleAndIdleSmoke: () -> Void
    var restartIdle: () -> Void
    var persistStuckState: () -> Void
    var resetHint: () -> Void
    var terminalFields: (Bool, Int) -> Void
    var queueGuardRelease: (String) -> Void
    var scheduleGSAPRecheck: (Int, String) -> Void
    var exitFailure: () -> Void
}

enum NativeSourceNoMovesUnsupportedCaller {
    case mergeMovesDepleted, movesDepleted, tutorialOrRescue
}
