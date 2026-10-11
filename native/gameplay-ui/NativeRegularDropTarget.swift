import Foundation
import CoreGraphics

/// Immutable v9 drag-core limits hover lookup to one pass per 24ms. The held
/// object still follows every pointer sample; release always performs a fresh
/// lookup. Only this transient drag owns the cached result, never gameplay.
struct NativeDragHoverCadence {
    private var sourceID:String?,generation:UInt64?,revision:UInt64?
    private var lastAt:Double?,result:String?
    mutating func reset(){sourceID=nil;generation=nil;revision=nil;lastAt=nil;result=nil}
    mutating func pick(sourceID:String,generation:UInt64,revision:UInt64,
                       nowMs:Double,force:Bool,resolve:()->String?)->String? {
        if !force,self.sourceID==sourceID,self.generation==generation,self.revision==revision,
           let lastAt,nowMs>=lastAt,nowMs-lastAt<24 {return result}
        self.sourceID=sourceID;self.generation=generation;self.revision=revision
        lastAt=nowMs;result=resolve();return result
    }
}

/// v9 drag-core pickDropTarget: ordinary overlap, followed by release-only
/// pointer grace. Caller supplies live bounds and already-eligible targets;
/// resolver remains the sole owner of stack/merge legality.
struct NativeRegularDropTarget {
    struct Candidate { let id: String; let bounds: CGRect; let pointerBounds: CGRect }
    static func pick(source: CGRect, candidates: [Candidate], pointer: CGPoint?, tileSize: CGFloat) -> String? {
        guard source.width > 0, source.height > 0 else { return nil }
        var best: String?, ratio: CGFloat = 0
        for target in candidates where target.bounds.width > 0 && target.bounds.height > 0 {
            let overlap = source.intersection(target.bounds)
            let area = overlap.isNull ? 0 : overlap.width*overlap.height
            let value = area / (target.bounds.width*target.bounds.height)
            if value > ratio { ratio = value; best = target.id }
        }
        if ratio >= 0.05 { return best }
        guard let pointer else { return nil }
        var distance = CGFloat.infinity, closest: String?
        for target in candidates where target.pointerBounds.width > 0 && target.pointerBounds.height > 0 {
            let rect = target.pointerBounds
            let pad = tileSize*0.26
            guard pointer.x >= rect.minX-pad, pointer.x <= rect.maxX+pad,
                  pointer.y >= rect.minY-pad, pointer.y <= rect.maxY+pad else { continue }
            let value = hypot(pointer.x-rect.midX, pointer.y-rect.midY)
            if value < distance && value <= tileSize*0.68 { distance = value; closest = target.id }
        }
        return closest
    }
}
