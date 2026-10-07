import UIKit

/// Exact core Star radial field from src/modules/text-sparkles.ts.
struct NativeStarBurstMotion {
    struct Pose { let point: CGPoint,scale: CGFloat,alpha: CGFloat,rotation: CGFloat }
    struct Plan {
        let birth: CGPoint,size: CGFloat,delay: TimeInterval,launch: TimeInterval,travel: TimeInterval,poses: [Pose]
        var end: TimeInterval { delay+launch+travel }
        func sample(seconds: TimeInterval) -> Pose {
            let local = seconds-delay
            guard local >= 0,local < launch+travel else { return Pose(point: birth,scale: 0,alpha: 0,rotation: 0) }
            let a: Pose,b: Pose,p: CGFloat
            if local < launch { a = poses[0]; b = poses[1]; p = CGFloat(local/launch) }
            else {
                let clock = NativeBoardMotion.Ease.sineInOut.sample(CGFloat((local-launch)/travel))*4
                let index = min(3,Int(clock)); p = clock-CGFloat(index); a = poses[index+1]; b = poses[index+2]
            }
            return Pose(point: CGPoint(x: birth.x+a.point.x+(b.point.x-a.point.x)*p,y: birth.y+a.point.y+(b.point.y-a.point.y)*p),
                scale: a.scale+(b.scale-a.scale)*p,alpha: a.alpha+(b.alpha-a.alpha)*p,rotation: a.rotation+(b.rotation-a.rotation)*p)
        }
    }
    static func make(viewport: CGSize,count: Int = 26,random: () -> Double = { Double.random(in: 0..<1) }) -> [Plan] {
        func roll() -> CGFloat { CGFloat(min(1-Double.ulpOfOne,max(0,random()))) }
        let count = min(40,max(4,count)),width = max(320,viewport.width),height = max(520,viewport.height)
        return (0..<count).map { index in
            let angle = CGFloat(index)/CGFloat(count)*2 * .pi+(roll()-0.5)*0.95
            let dx = cos(angle),dy = sin(angle),lane = 28+roll()*min(105,width*0.22)
            let birthX = width/2+dx*lane+(roll()-0.5)*36,birthY = height/2+dy*lane+(roll()-0.5)*36
            let spread = min(max(width,height)*(0.38+roll()*0.28),500+roll()*190)
            let distanceA = spread*(0.22+roll()*0.08),distanceB = spread*(0.54+roll()*0.1)
            let lateScale = 1-CGFloat(index)/CGFloat(count-1)*0.24
            _ = roll() // Source's sizeBoost admission draw remains independent.
            let size = (26+roll()*42)*lateScale,scale = 0.85+roll()*0.5,alpha = 0.42+roll()*0.58
            let blink = min(1,alpha+0.22+roll()*0.28),rotation = roll()*360-180,outRotation = rotation+(roll()-0.5)*28
            let delay = min(1.35,CGFloat(index)*1.3/CGFloat(count-1)+roll()*0.05),fast = roll() < 0.55
            let launch = fast ? 0.04+roll()*0.02 : 0.06+roll()*0.025,travel = fast ? 0.58+roll()*0.18 : 0.78+roll()*0.24
            let perpendicularX = cos(angle + .pi/2),perpendicularY = sin(angle + .pi/2)
            let wobbleA: CGFloat = (roll() > 0.5 ? 1 : -1)*(22+roll()*42),wobbleB = -wobbleA*(0.45+roll()*0.35),lift = (roll()-0.5)*90
            let x1 = dx*distanceA+perpendicularX*wobbleA,y1 = dy*distanceA+perpendicularY*wobbleA+lift*0.35
            let x2 = dx*distanceB+perpendicularX*wobbleB,y2 = dy*distanceB+perpendicularY*wobbleB-lift*0.2
            let exit = hypot(width/2,height/2)+size+110+roll()*110
            let x4 = dx*exit+perpendicularX*(roll()-0.5)*86,y4 = dy*exit+perpendicularY*(roll()-0.5)*86
            let x3 = x2+(x4-x2)*0.62+perpendicularX * -wobbleB*0.35,y3 = y2+(y4-y2)*0.62+perpendicularY * -wobbleB*0.35
            let low = alpha*(0.38+roll()*0.22)
            let launchScale = scale*(1.04+roll()*0.06)
            let poses = [
                Pose(point: .zero,scale: 0,alpha: 0,rotation: rotation),
                Pose(point: CGPoint(x: dx*14,y: dy*14),scale: launchScale,alpha: blink,rotation: outRotation),
                Pose(point: CGPoint(x: x1,y: y1),scale: scale*0.92,alpha: blink,rotation: outRotation+(roll()-0.5)*18),
                Pose(point: CGPoint(x: x2,y: y2),scale: scale*1.02,alpha: blink,rotation: outRotation+(roll()-0.5)*28),
                Pose(point: CGPoint(x: x3,y: y3),scale: scale*0.92,alpha: low,rotation: outRotation+(roll()-0.5)*24),
                Pose(point: CGPoint(x: x4,y: y4),scale: scale*0.72,alpha: 0,rotation: outRotation+(roll()-0.5)*28)
            ]
            return Plan(birth: CGPoint(x: birthX.rounded(),y: birthY.rounded()),size: size.rounded(),delay: Double(delay),launch: Double(launch),travel: Double(travel),poses: poses)
        }
    }
}
