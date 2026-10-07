import Foundation
import CoreGraphics

/// Port of board-popin-scheduler.ts. Presentation randomness is independent of
/// the engine's recorded random stream. Coordinates are source top-left space.
struct NativeBoardEntryPlan {
    enum Preset: String, CaseIterable { case inward, outward, diagonal, burst }
    let preset: Preset
    let tileIndex: Int
    let delay: TimeInterval
    let offset: CGPoint
    let rotation: CGFloat
    static let grow = 0.18, compress = 0.12, rebound = 0.12, settle = 0.14
    var end: TimeInterval { delay + Self.grow + Self.compress + Self.rebound + Self.settle }

    static func make(positions: [CGPoint], maxOffset: CGFloat,
                     preset requestedPreset: Preset? = nil,
                     random: () -> Double = { Double.random(in: 0..<1) }) -> [Self] {
        guard !positions.isEmpty else { return [] }
        func unit() -> Double { let value = random(); return min(0.999999,max(0,value.isFinite ? value : 0)) }
        let preset = requestedPreset ?? Preset.allCases[Int(unit()*4)]
        let corner = Int(unit()*4)
        let minX = positions.map(\.x).min()!, maxX = positions.map(\.x).max()!
        let minY = positions.map(\.y).min()!, maxY = positions.map(\.y).max()!
        let center = CGPoint(x: (minX+maxX)/2,y: (minY+maxY)/2)
        let cornerPoint = CGPoint(x: corner % 2 == 0 ? minX : maxX,y: corner < 2 ? minY : maxY)
        let radius = max(1,positions.map { hypot($0.x-center.x,$0.y-center.y) }.max()!)
        func score(_ index: Int) -> CGFloat {
            let point = positions[index]
            if preset == .diagonal { return abs(point.x-cornerPoint.x)+abs(point.y-cornerPoint.y) }
            let distance = hypot(point.x-center.x,point.y-center.y)
            return preset == .inward ? -distance : distance
        }
        let order = positions.indices.sorted { score($0) == score($1) ? $0 < $1 : score($0) < score($1) }
        let stagger = positions.count > 1 ? min(0.018,0.36/Double(positions.count-1)) : 0
        let distance = max(0,maxOffset)
        return order.enumerated().map { index,tileIndex in
            let radial = CGPoint(x: (positions[tileIndex].x-center.x)/radius,y: (positions[tileIndex].y-center.y)/radius)
            let direction: CGFloat = preset == .inward ? 1 : (preset == .outward || preset == .burst ? -1 : 0)
            let offsetScale: CGFloat = preset == .burst ? 0.72 : preset == .outward ? 0.58 : 1
            let offset = preset == .diagonal
                ? CGPoint(x: (corner % 2 == 0 ? -1 : 1)*distance*0.52,y: (corner < 2 ? -1 : 1)*distance*0.52)
                : CGPoint(x: radial.x*distance*direction*offsetScale,y: radial.y*distance*direction*offsetScale)
            return Self(preset: preset,tileIndex: tileIndex,delay: 0.02+Double(index)*stagger,offset: offset,
                        rotation: CGFloat(unit()*2-1)*(preset == .burst ? 8 : 6)*CGFloat.pi/180)
        }
    }

    static func hapticBeats(_ plans: [Self], requestedCount: Int = 6) -> [TimeInterval] {
        let delays = plans.map(\.delay).sorted()
        guard let first = delays.first, let last = delays.last else { return [] }
        let count = min(max(1,requestedCount),delays.count,Int(floor(max(0,last-first)/0.05))+1)
        guard count > 1 else { return [first] }
        var beats: [TimeInterval] = []
        for index in 0..<count {
            let quantile = Int((Double(index)*Double(delays.count-1)/Double(count-1)).rounded())
            let actual = delays[quantile]
            beats.append(beats.last.map { min(last,max(actual,$0+0.05)) } ?? actual)
        }
        return beats
    }
}
