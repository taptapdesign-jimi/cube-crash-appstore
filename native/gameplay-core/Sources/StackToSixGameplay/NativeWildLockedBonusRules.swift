import Foundation

/// Original spawnLockedTilesWithPop allocation and per-created-die rotation RNG.
/// Decoration direction belongs to this captured owner, so later face draws keep source order.
enum NativeWildLockedBonusRules {
    struct Allocation:Equatable {let cell:NativeCell;let alpha:Double;let direction:Int;let delayMilliseconds:Int}
    static func allocate(count:Int,emptyCells:[NativeCell],referenceAlpha:Double?,admitted:()->Bool,isEmpty:(NativeCell)->Bool,random:()->Double)->[Allocation] {
        guard count>0 else{return []}
        var cells=emptyCells
        if cells.count>1 {for i in stride(from:cells.count-1,through:1,by:-1){cells.swapAt(i,min(i,max(0,Int(random()*Double(i+1)))))} }
        let alpha=referenceAlpha.flatMap{$0.isFinite ? $0:nil} ?? 0.2
        var result:[Allocation]=[]
        for (index,cell) in cells.prefix(count).enumerated() {
            guard isEmpty(cell),admitted() else{continue}
            result.append(Allocation(cell:cell,alpha:alpha,direction:random()<0.5 ? 1:-1,delayMilliseconds:index*150))
        }
        return result
    }
}
public struct NativeWildLockedBonusPresentation:Equatable,Sendable {
    public let tileID:String
    public let transactionID:String
    public let generation:UInt64
    public let alpha:Double
    public let direction:Int
    public let delayMilliseconds:Int
}
