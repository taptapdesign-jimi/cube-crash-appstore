import Foundation

/// Authored TNT skin planners. They receive presentation entropy only and
/// never select gameplay targets or change the persisted gameplay RNG.
enum NativeTntVariantPlanning {
    struct Flower: Equatable {
        let assetIndex: Int
        let depth, size, angle, distance, curve: Double
        let startX, startY, rotation, rotationTravel: Double
        let swirlTurns, swirlPhase, swirlAmplitude, delay, duration: Double
        var oracleValues: [Double] { [Double(assetIndex),depth,size,angle,distance,curve,startX,startY,rotation,rotationTravel,swirlTurns,swirlPhase,swirlAmplitude,delay,duration] }
    }
    struct Pose {
        let x,y,rotation,scale,alpha,depth: Double
    }
    static func flowers(random: () -> Double) -> [Flower] {
        let depths: [[Double]] = [[0.5,2.5,4.5,6.5,7.5,3.5,5.5,1.5,4.5],[1.5,3.5,5.5,7.5,6.5,4.5,2.5,5.5,3.5],[2.5,4.5,6.5,7.5,5.5,3.5,1.5,6.5,4.5]]
        let origins: [(Double,Double)] = [(-34,12),(28,-18),(-22,-32),(38,20),(-42,-6),(18,30),(6,-38),(44,-10)]
        var result: [Flower] = []
        for (wave,time) in [0.1,0.905,1.71].enumerated() {
            for index in 0..<9 {
                let asset = Int(random()*6)+1
                let depth = depths[wave][index]
                let origin = origins[min(7,max(0,Int((depth-0.5).rounded(.toNearestOrAwayFromZero))))]
                let size = (26+random()*42)*1.428
                let angle = Double.pi*2*Double(index)/9+(random()-0.5)*0.9
                let distance = 190+random()*260
                let curve = (random()<0.5 ? -1.0:1.0)*(28+random()*58)
                let x = origin.0+(random()-0.5)*30, y = origin.1+(random()-0.5)*24
                let rotation = (random()-0.5)*0.48, travel = (random()-0.5)*1.05
                let turns = 1.15+random()*0.85, phase = random()*Double.pi*2, amplitude = 13+random()*24
                let delay = time+Double(index)*(0.035+random()*0.01)
                result.append(Flower(assetIndex:asset,depth:depth,size:size,angle:angle,distance:distance,curve:curve,startX:x,startY:y,rotation:rotation,rotationTravel:travel,swirlTurns:turns,swirlPhase:phase,swirlAmplitude:amplitude,delay:delay,duration:1.12*0.92))
            }
        }
        return result
    }
    static func flowerPose(_ plan: Flower,time: Double) -> Pose {
        let p = min(1,max(0,(time-plan.delay)/plan.duration))
        let wind = sin(Double.pi*p), oscillation = sin(p*Double.pi*2*plan.swirlTurns+plan.swirlPhase)
        let side = wind*plan.curve+oscillation*plan.swirlAmplitude*wind
        let enter = min(1,p/0.14), exit = max(0,(p-0.78)/0.22)
        return Pose(x:plan.startX+cos(plan.angle)*plan.distance*p-sin(plan.angle)*side,
                    y:plan.startY+sin(plan.angle)*plan.distance*p+cos(plan.angle)*side,
                    rotation:plan.rotation+plan.rotationTravel*p+oscillation*0.16,
                    scale:(0.82+enter*0.36)*(1-exit*0.36),alpha:min(1,p/0.1)*(1-exit),depth:p>=0.28 ? 8.5:plan.depth)
    }
    static func point(_ plan: NativeTntFinale.DiePlan,_ p: Double) -> (Double,Double) {
        let impulse = 1-pow(1-p,2.35), curve = sin(Double.pi*p)*plan.curve
        return (plan.startX+cos(plan.angle)*plan.distance*impulse-sin(plan.angle)*curve,
                plan.startY+sin(plan.angle)*plan.distance*impulse+cos(plan.angle)*curve+28*p*p)
    }
    static func scale(_ plan: NativeTntFinale.DiePlan,_ p: Double) -> Double {
        let pop = min(1,p/0.12), fade = max(0,(p-0.78)/0.22)
        let live = plan.startScale+(plan.peakScale-plan.startScale)*pop
        return live+(plan.endScale-live)*fade
    }
    @MainActor static func barrelDice(wood: [NativeTntFinale.DiePlan],random: () -> Double) -> [NativeTntFinale.DiePlan] {
        let basePlans = NativeTntFinale.makeDiePlans(random:random)
        let times = (0..<59).map { 0.16+Double($0)*0.035 }
        let lastWood = wood.map { $0.delay+$0.duration }.max() ?? 0
        let samples: [[(Double,Double,Double)]] = times.map { time in
            wood.compactMap { plan in
                let p = (time-plan.delay)/plan.duration
                guard p>0,p<1 else { return nil }
                let point = point(plan,p)
                return (point.0,point.1,plan.size*0.7*scale(plan,p)*0.5)
            }
        }
        var accepted: [NativeTntFinale.DiePlan] = []
        for base in basePlans {
            var selected: NativeTntFinale.DiePlan?,best: NativeTntFinale.DiePlan?
            var bestClearance = -Double.infinity
            for attempt in 0..<256 {
                let bearing = random()*Double.pi*2,radius = 55+random()*135
                var candidate = base
                candidate.startX = cos(bearing)*radius; candidate.startY = sin(bearing)*radius*0.8
                candidate.angle = bearing+(random()-0.5)*0.24
                candidate.delay = max(0.12,base.delay+(random()-0.5)*(attempt<128 ? 0.18:0.9))
                var clearance = accepted.reduce(Double.infinity) { value,die in
                    min(value,hypot(candidate.startX-die.startX,candidate.startY-die.startY)-(candidate.size+die.size)*0.5-3)
                }
                if clearance<0 { continue }
                for (index,time) in times.enumerated() {
                    let p = (time-candidate.delay)/candidate.duration
                    if p<=0 || p>=1 { continue }
                    let xy = point(candidate,p),radius = candidate.size*scale(candidate,p)*0.5
                    for wood in samples[index] {
                        clearance = min(clearance,hypot(xy.0-wood.0,xy.1-wood.1)-radius-wood.2-5)
                        if clearance<0 { break }
                    }
                    if clearance<0 { break }
                }
                if clearance>bestClearance { best=candidate;bestClearance=clearance }
                if clearance>=0 { selected=candidate;break }
            }
            if selected == nil {
                // These two draws are consumed even when a best candidate exists.
                let bearing=random()*Double.pi*2,radius=55+random()*135
                var late=best ?? base
                if best == nil { late.startX=cos(bearing)*radius;late.startY=sin(bearing)*radius*0.8;late.angle=bearing }
                late.delay=max(late.delay,lastWood+0.07);selected=late
            }
            accepted.append(selected!)
        }
        return accepted
    }
    static func woodSourceOrder(random: () -> Double) -> [Int] {
        var result: [Int] = []
        while result.count<16 {
            var batch=Array(1...6)
            for index in stride(from:5,through:1,by:-1) { batch.swapAt(index,min(index,max(0,Int(random()*Double(index+1))))) }
            result.append(contentsOf:batch)
        }
        return Array(result.prefix(16))
    }
}
