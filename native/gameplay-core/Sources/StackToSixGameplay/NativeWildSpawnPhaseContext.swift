import Foundation

/// Exact accepted owner of the shared non-regular spawn coroutine. A Special
/// plan is never converted into a fabricated Direct Wild transaction.
enum NativeWildSpawnPhaseContext {
    case direct(NativeDirectWildMovePlan)
    case tnt(NativeSpecialMovePlan)
    var id:String {switch self {case .direct(let p):p.id;case .tnt(let p):p.id}}
    var generation:UInt64 {switch self {case .direct(let p):p.generation;case .tnt(let p):p.generation}}
    var archetype:NativeWildArchetype {switch self {case .direct(let p):p.archetype;case .tnt(let p):p.archetype}}
    var source:NativeTile {switch self {case .direct(let p):p.source;case .tnt(let p):p.source}}
    var destination:NativeTile {switch self {case .direct(let p):p.destination;case .tnt(let p):p.destination}}
    var tntOwner:NativeSpecialMovePlan? {if case .tnt(let plan)=self{return plan};return nil}
    var isDirect:Bool {if case .direct=self{return true};return false}
}
