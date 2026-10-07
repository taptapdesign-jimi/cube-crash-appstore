import UIKit

/// Source text-bolts.ts Honey-specific balanced artwork and eight uneven pairs.
struct NativeHoneyFinaleMotion {
    struct Pose { var point: CGPoint; var scale: CGFloat; var alpha: CGFloat; var rotation: CGFloat }
    struct Plan {
        let assetIndex: Int,birth: CGPoint,size: CGFloat,delay: TimeInterval,enter: TimeInterval,travel: TimeInterval,exit: TimeInterval
        let startRotation: CGFloat,buzzA: CGFloat,buzzB: CGFloat,waypoints: [Pose],edge: CGPoint,outside: CGPoint
        var end: TimeInterval { delay+enter+0.08+travel+0.09+exit }
        func sample(seconds: TimeInterval) -> Pose {
            let t = seconds-delay
            guard t >= 0,t < end-delay else { return Pose(point: birth,scale: 0,alpha: 0,rotation: 0) }
            func interpolate(_ a: Pose,_ b: Pose,_ p: CGFloat) -> Pose {
                Pose(point: CGPoint(x: a.point.x+(b.point.x-a.point.x)*p,y: a.point.y+(b.point.y-a.point.y)*p),
                     scale: a.scale+(b.scale-a.scale)*p,alpha: a.alpha+(b.alpha-a.alpha)*p,rotation: a.rotation+(b.rotation-a.rotation)*p)
            }
            var pose: Pose
            if t < enter {
                pose = interpolate(Pose(point: .zero,scale: 0.2,alpha: 0,rotation: startRotation),Pose(point: .zero,scale: 1.24,alpha: 1,rotation: buzzA),NativeBoardMotion.Ease.backOut(2.8).sample(CGFloat(t/enter)))
            } else if t < enter+0.08 {
                pose = interpolate(Pose(point: .zero,scale: 1.24,alpha: 1,rotation: buzzA),waypoints[0],NativeBoardMotion.Ease.backOut(1.8).sample(CGFloat((t-enter)/0.08)))
            } else if t < enter+0.08+travel {
                let clock = NativeBoardMotion.Ease.sineInOut.sample(CGFloat((t-enter-0.08)/travel))*5
                let index = min(4,Int(clock)); pose = interpolate(waypoints[index],waypoints[index+1],clock-CGFloat(index))
            } else if t < enter+0.08+travel+0.09 {
                pose = interpolate(waypoints[5],Pose(point: CGPoint(x: edge.x*0.96,y: edge.y*0.96),scale: 1.16,alpha: 1,rotation: buzzB),NativeBoardMotion.Ease.power2Out.sample(CGFloat((t-enter-0.08-travel)/0.09)))
            } else {
                pose = interpolate(Pose(point: CGPoint(x: edge.x*0.96,y: edge.y*0.96),scale: 1.16,alpha: 1,rotation: buzzB),Pose(point: outside,scale: 0,alpha: 0,rotation: buzzA),NativeBoardMotion.Ease.backIn(2.4).sample(CGFloat((t-enter-0.08-travel-0.09)/exit)))
            }
            pose.point.x += birth.x; pose.point.y += birth.y; pose.alpha = min(1,max(0,pose.alpha)); return pose
        }
    }
    static func make(viewport: CGSize,random: () -> Double = { Double.random(in: 0..<1) }) -> [Plan] {
        func roll() -> CGFloat { CGFloat(min(1-Double.ulpOfOne,max(0,random()))) }
        let width = max(320,viewport.width),height = max(520,viewport.height),count = 16
        var assets = (0..<count).map { $0%7+1 }
        for index in stride(from: count-1,through: 1,by: -1) { assets.swapAt(index,min(index,Int(roll()*CGFloat(index+1)))) }
        let angles: [CGFloat] = [.pi*0.25,-.pi*0.25,.pi,-.pi*0.75,-.pi*0.56,.pi*0.08,.pi*0.75]
        let pairWeights: [CGFloat] = [0.2,0.2,0.1,0.05,0.1,0.2,0.15]
        return (0..<count).map { index in
            let asset = assets[index],theta = angles[asset-1]+(roll()-0.5)*0.16
            _ = roll() // Authored shared radiusJitter draw is preserved even in beeFlight.
            let forward = 18+roll()*88,lateral = (roll()-0.5)*190
            let x = width/2+cos(theta)*forward-sin(theta)*lateral,y = height/2+sin(theta)*forward+cos(theta)*lateral
            let size = 58+roll()*17,dx = cos(theta),dy = sin(theta)
            _ = roll(); _ = roll(); _ = roll(); _ = roll(); _ = roll() // shared drift unused by Honey
            let jitterX = (2.5+roll()*5)*1.05,jitterY = (2+roll()*4)*1.05
            let startRotation = (roll()-0.5)*20
            _ = roll(); _ = roll(); _ = roll(); _ = roll() // shared jitter/flash draws unused by Honey
            let pair = index/2,delay = pairWeights.prefix(pair).reduce(0,+)*0.72+CGFloat(index%2)*0.018+roll()*0.008
            let side: CGFloat = roll() < 0.5 ? -1 : 1,perpendicularX = -dy,perpendicularY = dx
            let waypoints = [70.0,105.0,120.0,105.0,72.0].map { (roll()-0.5)*CGFloat($0)*2 }
            let rotations = (0..<5).map { _ in (roll()-0.5)*15 }
            let margin = size*0.72
            let horizontal = dx > 0.001 ? (width+margin-x)/dx : dx < -0.001 ? (-margin-x)/dx : .infinity
            let vertical = dy > 0.001 ? (height+margin-y)/dy : dy < -0.001 ? (-margin-y)/dy : .infinity
            let distance = max(120,min(horizontal,vertical)),edge = CGPoint(x: dx*distance,y: dy*distance)
            let outsideDistance = distance+size*(0.72+roll()*0.35),outside = CGPoint(x: dx*outsideDistance,y: dy*outsideDistance)
            let buzzA = side*(6+roll()*2.5),buzzB = -side*(6+roll()*2.5),enter = 0.13+roll()*0.035
            var poses = [Pose(point: .zero,scale: 1,alpha: 1,rotation: buzzB)]
            let factors: [CGFloat] = [0.2,0.38,0.56,0.72,0.86],scales: [CGFloat] = [1.03,1.08,1.13,1.18,1.24]
            for waypoint in 0..<5 {
                let sign: CGFloat = waypoint%2 == 0 ? 1 : -1
                let jx = waypoint == 4 ? 0 : sign*side*jitterX,jy = waypoint == 4 ? 0 : -sign*side*jitterY
                poses.append(Pose(point: CGPoint(x: edge.x*factors[waypoint]+perpendicularX*waypoints[waypoint]+jx,
                                                y: edge.y*factors[waypoint]+perpendicularY*waypoints[waypoint]+jy),scale: scales[waypoint],alpha: 1,rotation: rotations[waypoint]))
            }
            let travel = 1.2+roll()*0.12,exit = 0.2+roll()*0.04
            return Plan(assetIndex: asset,birth: CGPoint(x: x.rounded(),y: y.rounded()),size: size,delay: Double(delay),enter: Double(enter),travel: Double(travel),exit: Double(exit),
                        startRotation: startRotation,buzzA: buzzA,buzzB: buzzB,waypoints: poses,edge: edge,outside: outside)
        }
    }
    /// Same bounded relaxation, pair/pass update order and additive offsets.
    static func relax(plans: [Plan],poses: [Pose],offsets: inout [CGPoint]) {
        let visible = poses.indices.filter { poses[$0].alpha > 0.02 }
        for index in offsets.indices { offsets[index].x *= 0.9; offsets[index].y *= 0.9 }
        for _ in 0..<8 { for (visibleIndex,first) in visible.enumerated() {
            let firstX = poses[first].point.x+offsets[first].x,firstY = poses[first].point.y+offsets[first].y
            for secondVisible in (visibleIndex+1)..<visible.count {
                let second = visible[secondVisible],minimum = (plans[first].size*max(0,poses[first].scale)+plans[second].size*max(0,poses[second].scale))*0.5*1.6
                var dx = poses[second].point.x+offsets[second].x-firstX,dy = poses[second].point.y+offsets[second].y-firstY
                var distance = hypot(dx,dy)
                if distance >= minimum { continue }
                if distance < 0.001 { let angle = CGFloat(visibleIndex)*2.399963229728653+CGFloat(secondVisible)*0.71; dx = cos(angle); dy = sin(angle); distance = 1 }
                let correction = (minimum-distance)*0.51,cx = dx/distance*correction,cy = dy/distance*correction
                offsets[first].x -= cx; offsets[first].y -= cy; offsets[second].x += cx; offsets[second].y += cy
            }
        } }
    }
}
