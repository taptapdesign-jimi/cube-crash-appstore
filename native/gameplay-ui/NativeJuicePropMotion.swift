import UIKit

/// src/modules/juice-finale-prop-flight.ts: independent three-part flight plans.
struct NativeJuicePropMotion {
    enum Prop: String,CaseIterable { case cup,lid,straw
        var asset: String { switch self { case .cup:return "casa";case .lid:return "poklopac";case .straw:return "slamka" } }
        var profile: (y: CGFloat,size: CGFloat,depth: CGFloat) {
            switch self { case .cup:return (1.11,144,-20);case .lid:return (1.07,135,20);case .straw:return (1.025,76,30) }
        }
    }
    var prop: Prop
    var startX: CGFloat,startY: CGFloat,endY: CGFloat,horizontalMargin: CGFloat,size: CGFloat,depth: CGFloat
    var delay: TimeInterval,duration: TimeInterval,riseAcceleration: CGFloat,driftX: CGFloat,weaveAmplitude: CGFloat
    var weaveCycles: CGFloat,weavePhase: CGFloat,weaveDirection: CGFloat,secondaryCycles: CGFloat,secondaryPhase: CGFloat
    var rotationAmplitude: CGFloat,rotationCycles: CGFloat,rotationPhase: CGFloat,rotationDirection: CGFloat
    func sample(progress: CGFloat) -> (point: CGPoint,rotation: CGFloat) {
        let p = min(1,max(0,progress)),upward = p+riseAcceleration*p*(p-1),envelope = sin(min(1,p*5) * .pi/2)
        let main = sin(weavePhase+p*2 * .pi*weaveCycles),secondary = sin(secondaryPhase+p*2 * .pi*secondaryCycles)
        return (CGPoint(x: startX+driftX*p+weaveDirection*weaveAmplitude*(main*0.75+secondary*0.25)*envelope,
                        y: startY+(endY-startY)*upward),rotationDirection*rotationAmplitude*sin(rotationPhase+p*2 * .pi*rotationCycles)*envelope)
    }
    static func make(viewport: CGSize,random: () -> Double = { Double.random(in: 0..<1) }) -> [Self] {
        func roll() -> CGFloat { CGFloat(min(1-Double.ulpOfOne,max(0,random()))) }
        func shuffledSlots() -> [Int] {
            var slots = [0,1,2]
            for index in stride(from: 2,through: 1,by: -1) { slots.swapAt(index,min(index,Int(roll()*CGFloat(index+1)))) }
            return slots
        }
        let lanes = shuffledSlots(),orders = shuffledSlots(),width = viewport.width,height = viewport.height
        return Prop.allCases.enumerated().map { index,prop in
            let profile = prop.profile,margin = min(width/2,profile.size/2+6)
            let startX = max(margin,min(width-margin,width*(0.25+roll()*0.5)))
            let room = max(0,min(startX-margin,width-margin-startX)),drift = (roll()-0.5)*min(width*0.06,room*2)
            let amplitude = min(width*(0.09+roll()*0.035),max(0,room-abs(drift))),rotation = 30+roll()*10
            var plan = Self(prop: prop,startX: startX,startY: height*profile.y,endY: -height*(0.15+roll()*0.06),
                horizontalMargin: margin,size: profile.size,depth: profile.depth,delay: Double(roll()*0.55),duration: Double(1.88+roll()*1.02),
                riseAcceleration: 0.12+roll()*0.16,driftX: drift,weaveAmplitude: amplitude,weaveCycles: 2+roll()*2.1,weavePhase: roll()*2 * .pi,
                weaveDirection: roll() < 0.5 ? -1 : 1,secondaryCycles: 0.65+roll()*1.35,secondaryPhase: roll()*2 * .pi,
                rotationAmplitude: rotation * .pi/180,rotationCycles: 2+roll()*2,rotationPhase: roll()*2 * .pi,rotationDirection: roll() < 0.5 ? -1 : 1)
            let lane = 0.05+CGFloat(lanes[index])*0.4+roll()*0.1
            plan.startX = margin+max(0,width-margin*2)*lane
            let laneRoom = max(0,min(plan.startX-margin,width-margin-plan.startX))
            plan.driftX = max(-laneRoom*0.25,min(laneRoom*0.25,plan.driftX)); plan.weaveAmplitude = min(plan.weaveAmplitude,laneRoom-abs(plan.driftX))
            let order = CGFloat(orders[index]); plan.delay = Double(order*0.255+roll()*0.04); plan.duration = Double(1.88+order*0.46+roll()*0.1)
            plan.riseAcceleration = 0.12+order*0.06+roll()*0.04
            return plan
        }
    }
}
