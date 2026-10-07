import UIKit

/// Cubero cloth field from text-sparkles.ts, with captured flag deformation.
struct NativeCuberoFinaleMotion {
    struct WavePose { let skew,scaleX,scaleY,rotation,x: CGFloat }
    struct Wave {
        let delay,duration: Double,repeats: Int
        let target: WavePose
        func sample(seconds: Double) -> WavePose {
            let local = seconds-delay,tail = 0.14*1.05,cycle = duration+tail
            guard local >= 0,local < cycle*Double(repeats+1) else { return WavePose(skew:0,scaleX:1,scaleY:1,rotation:0,x:0) }
            let iteration = Int(local/cycle)
            var clock = local-Double(iteration)*cycle
            if iteration%2 == 1 { clock = cycle-clock }
            let p:CGFloat = clock < duration
                ? NativeBoardMotion.Ease.sineInOut.sample(CGFloat(clock/duration))
                : 1-sin(CGFloat((clock-duration)/tail) * .pi/2)
            return WavePose(skew:target.skew*p,scaleX:1+(target.scaleX-1)*p,scaleY:1+(target.scaleY-1)*p,rotation:target.rotation*p,x:target.x*p)
        }
    }
    struct Plan {
        let burst: NativeStarBurstMotion.Plan,wave: Wave
        var end: Double {burst.end}
    }
    static func make(viewport: CGSize,count: Int = 14,random: () -> Double = { Double.random(in: 0..<1) }) -> [Plan] {
        func roll() -> CGFloat { CGFloat(min(1-Double.ulpOfOne,max(0,random()))) }
        let count = min(40,max(4,count)),width = max(320,viewport.width),height = max(520,viewport.height)
        return (0..<count).map { index in
            let angle = CGFloat(index)/CGFloat(count)*2 * .pi+(roll()-0.5)*0.95
            let dx = cos(angle),dy = sin(angle),lane = 28+roll()*min(105,width*0.22)
            let birthX = width/2+dx*lane+(roll()-0.5)*36,birthY = height/2+dy*lane+(roll()-0.5)*36
            let spread = min(max(width,height)*(0.38+roll()*0.28),500+roll()*190)
            let distanceA = spread*(0.22+roll()*0.08),distanceB = spread*(0.54+roll()*0.1)
            let lateScale = 1-CGFloat(index)/CGFloat(count-1)*0.24
            let boostRoll = roll(),boost:CGFloat = boostRoll < 0.55 ? 1+roll()*0.4:1
            let size = (26+roll()*42)*lateScale*boost,scale = 0.85+roll()*0.5,alpha = 0.42+roll()*0.58
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
            let poses: [NativeStarBurstMotion.Pose] = [
                NativeStarBurstMotion.Pose(point: .zero,scale: 0,alpha: 0,rotation: rotation),
                NativeStarBurstMotion.Pose(point: CGPoint(x: dx*14,y: dy*14),scale: launchScale,alpha: blink,rotation: outRotation),
                NativeStarBurstMotion.Pose(point: CGPoint(x: x1,y: y1),scale: scale*0.92,alpha: blink,rotation: outRotation+(roll()-0.5)*18),
                NativeStarBurstMotion.Pose(point: CGPoint(x: x2,y: y2),scale: scale*1.02,alpha: blink,rotation: outRotation+(roll()-0.5)*28),
                NativeStarBurstMotion.Pose(point: CGPoint(x: x3,y: y3),scale: scale*0.92,alpha: low,rotation: outRotation+(roll()-0.5)*24),
                NativeStarBurstMotion.Pose(point: CGPoint(x: x4,y: y4),scale: scale*0.72,alpha: 0,rotation: outRotation+(roll()-0.5)*28)
            ]
            let phaseDelay = delay+roll()*0.16
            let visualLifetime = (launch+travel)*1.55
            let repeats = max(1,min(7,Int((visualLifetime/(0.36*1.05)).rounded())))
            let skew:CGFloat = (roll()>0.5 ? 1:-1)*(5+roll()*5)*1.35
            let waveX = 1-(0.045+roll()*0.035)*1.35,waveY = 1+(0.035+roll()*0.045)*1.35
            let waveRotation:CGFloat = (roll()>0.5 ? 1:-1)*(2+roll()*3)*1.35
            let waveTranslation:CGFloat = (roll()>0.5 ? 1:-1)*(1+roll()*2)*1.35
            let waveDuration = (0.24+roll()*0.12)*1.05
            let wave = Wave(delay:Double(phaseDelay),duration:Double(waveDuration),repeats:repeats,target:WavePose(skew:skew,scaleX:waveX,scaleY:waveY,rotation:waveRotation,x:waveTranslation))
            let burst = NativeStarBurstMotion.Plan(birth: CGPoint(x: birthX.rounded(),y: birthY.rounded()),size: size.rounded(),delay: Double(delay),launch: Double(launch)*1.55,travel: Double(travel)*1.55,poses: poses)
            return Plan(burst:burst,wave:wave)
        }
    }
}
