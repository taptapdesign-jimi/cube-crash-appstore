import Foundation

public enum NativeLaserShooter: String, Equatable, Sendable { case left, right }
public struct NativeLaserShot: Equatable, Sendable {
    public let tileID: String
    public let shooter: NativeLaserShooter
    public init(tileID: String,shooter: NativeLaserShooter) { self.tileID = tileID; self.shooter = shooter }
}
/// Exact source crossfire planner. Targets are immutable; geometry chooses only order and shooter.
public enum NativeLaserGunRules {
    public static func muzzleX(_ side: NativeLaserShooter,width: Double) -> Double {
        let width = max(320,width),inset = max(72,min(84,width*0.21))
        return side == .left ? inset : width-inset
    }
    public static func plan(targets: [NativeTile],viewportWidth: Double,x: (NativeTile) -> Double,random: () -> Double) -> [NativeLaserShot] {
        guard !targets.isEmpty,targets.count <= 4 else { return [] }
        let width = max(1,viewportWidth),epsilon = max(0.5,width*0.01)
        func position(_ tile: NativeTile) -> Double { let value = x(tile); return value.isFinite ? value : width*0.5 }
        func distance(_ tile: NativeTile,_ side: NativeLaserShooter) -> Double { abs(position(tile)-muzzleX(side,width:width)) }
        if targets.count == 1 {
            let left = distance(targets[0],.left),right = distance(targets[0],.right)
            let side: NativeLaserShooter = abs(left-right) <= epsilon ? (random() < 0.5 ? .left : .right) : left > right ? .left : .right
            return [NativeLaserShot(tileID:targets[0].id,shooter:side)]
        }
        func permutations(_ values: [NativeTile]) -> [[NativeTile]] {
            if values.count <= 1 { return [values] }
            return values.enumerated().flatMap { index,value in permutations(values.enumerated().filter{$0.offset != index}.map(\.element)).map{[value]+$0} }
        }
        func patterns(_ count: Int) -> [[NativeLaserShooter]] {
            if count == 0 { return [[]] }
            return patterns(count-1).flatMap{[$0+[.left],$0+[.right]]}
        }
        struct Candidate { let shots: [NativeLaserShot]; let minimum: Double; let total: Double; let ordinal: Int }
        let tails = permutations(Array(targets.dropFirst()))
        var candidates: [Candidate] = []
        for pattern in patterns(targets.count) { for tail in tails {
            let order = [targets[0]]+tail,distances = zip(order,pattern).map{distance($0.0,$0.1)}
            candidates.append(Candidate(shots:zip(order,pattern).map{NativeLaserShot(tileID:$0.0.id,shooter:$0.1)},minimum:distances.min()!,total:distances.reduce(0,+),ordinal:candidates.count))
        } }
        // JavaScript sort is stable; an explicit ordinal preserves its tie ordering in Swift.
        candidates.sort { a,b in a.minimum != b.minimum ? a.minimum > b.minimum : a.total != b.total ? a.total > b.total : a.ordinal < b.ordinal }
        let best = candidates[0]
        let near = candidates.filter{best.minimum-$0.minimum <= epsilon && best.total-$0.total <= epsilon*Double(targets.count)}
        let switchbacks = near.filter{ candidate in candidate.shots.count <= 2 || !zip(candidate.shots.dropFirst(),candidate.shots).allSatisfy{$0.shooter != $1.shooter} }
        let selectable = switchbacks.isEmpty ? near : switchbacks
        if selectable.count == 1 { return selectable[0].shots }
        return selectable[min(selectable.count-1,max(0,Int(floor(random()*Double(selectable.count)))))].shots
    }
}
