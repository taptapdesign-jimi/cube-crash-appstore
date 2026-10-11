import Foundation
import StackToSixGameplay

/// Mandatory actual Source endpoints. Presence/admission reads are NOT runtime
/// snapshots, never lazy-prune Special/InputGate before the original caller.
@MainActor struct NativeSourceNoMovesDepletedCallerBindings {
    var kinds:Set<NativeSourceNoMovesCallerReceipt.Kind>
    var admitted:(UInt64,Set<NativeSourceNoMovesCallerReceipt.Kind>)->Bool
    var busyEnding:()->Bool?
    var ensureTutorialSingleTile:(NativeSourceNoMovesCallerReceipt,@escaping(Bool?)->Void)->Void
    var forceFresh:(NativeSourceNoMovesDepletedCallerFlow.FreshRequest)->NativeResolution?
    var resetHint:()->Void
    var deferWild:(String)->Bool?
    var tutorialFinalChance:(String,@escaping(Bool?)->Void)->Void
    var cleanVisibility:()->(home:Bool,journey:Bool)?
    var clean:(String)->Void
}
