import Foundation
import StackToSixGameplay

/// No defaults. Missing full physical marker/caller endpoints refuse publication;
/// marker observation must preserve Source STATE order, not collect/dedup roster.
@MainActor struct NativeSourceOrdinaryPreDebitBindings {
    let markerCapabilities:Set<NativeSourceNoMovesRuntimeSnapshot.Capability>
    /// Presence/identity only; must not prune TTLs or execute a fresh checker early.
    var admitted:(UInt64)->Bool
    var captureBefore:()->NativeSourcePostcheckRoster?
    var stateRoster:()->NativeSourcePostcheckRoster?
    var reread:(NativeSourcePostcheckTile)->NativeSourcePostcheckTile?
    var busyEnding:()->Bool?
    var forceFresh:(NativeSourceOrdinaryPreDebitFlow.FreshRequest)->NativeResolution?
    var clearEndGameCache:()->Void
    var resetHint:()->Void
    var deferStackWild:(String)->Bool?
    var ensureTutorialSingleTile:(String,@escaping(Bool?)->Void)->Void
    var tutorialFinalChance:(String,@escaping(Bool?)->Void)->Void
}
