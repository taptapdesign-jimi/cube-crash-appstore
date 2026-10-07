import Foundation
import CoreGraphics

enum NativeIdleBubbleMotion {
    enum Family {case honey,bottle,juice,fish,beachBall
        var motionScale:Double {self == .honey ? 1.3:self == .bottle ? 1:1.4}
        var colors:[UInt32] {self == .honey ? [0xF7D58A,0xF2BB4F]:self == .bottle ? [0xCCF3F1,0xFFFFFF]:[0xFFE6E1,0xFFF2E9,0xFFD5D6]}
    }
    static func family(kind:String,variant:String?)->Family? {
        switch variant {
        case "honey":return .honey
        case "bottle":return .bottle
        case "fish":return .fish
        case "beach-ball":return .beachBall
        case "mushroom","robo-cube":return nil
        default:return kind=="juice" || kind=="wild-juice" ? .juice:nil
        }
    }
    struct Pose {let x,y,scaleX,scaleY,alpha:Double;let tint:UInt32}
    struct Plan {
        let family:Family,radius:Double,color:UInt32,startX,startScale,startAlpha,duration,scaleX,scaleY,nextDelay:Double,points:[CGPoint]
        func sample(seconds:Double)->Pose {
            let progress=min(1,max(0,seconds/duration))
            let growth=1-pow(1-min(1,progress/0.3),3)
            let alpha=startAlpha*(1-pow(min(1,max(0,(progress-0.6)/0.4)),3))
            let x,y:Double
            if family == .honey {
                let p=1-pow(1-progress,2)
                x=startX+(Double(points.last!.x)-startX)*p;y=64+(Double(points.last!.y)-64)*p
            } else {
                let master=0.5-0.5*cos(Double.pi*progress),fraction=master*Double(points.count),index=min(points.count-1,Int(floor(fraction))),raw=min(1,fraction-Double(index)),p=raw
                let a=index==0 ? CGPoint(x:startX,y:64):points[index-1],b=points[index]
                x=Double(a.x)+(Double(b.x)-Double(a.x))*p;y=Double(a.y)+(Double(b.y)-Double(a.y))*p
            }
            let tint:UInt32
            if family == .bottle {
                // GSAP's numeric PropertyTween writes its target field at six
                // decimal places before the authored onUpdate RGB quantization.
                let p=((0.5-0.5*cos(Double.pi*progress))*1_000_000).rounded()/1_000_000
                tint=UInt32((204+51*p).rounded())<<16|UInt32((243+12*p).rounded())<<8|UInt32((241+14*p).rounded())
            } else {tint=0xFFFFFF}
            return Pose(x:x,y:y,scaleX:startScale+(scaleX-startScale)*growth,scaleY:startScale+(scaleY-startScale)*growth,alpha:alpha,tint:tint)
        }
    }
    static func make(family:Family,random:()->Double)->Plan {
        let radius=(15+random()*25)/2,color=family == .bottle ? UInt32(0xFFFFFF):family.colors[min(family.colors.count-1,Int(floor(random()*Double(family.colors.count))))]
        let startX=(random()-0.5)*128*0.8,startScale=0.2+random()*0.2,startAlpha=0.7+random()*0.3,endX=startX+(random()-0.5)*20,duration=(0.8+random()*0.7)*family.motionScale
        let scaleX=0.6+random()*0.4,scaleY=0.6+random()*0.4,direction:Double=random()<0.5 ? -1:1,distance=family == .bottle ? 10+random()*8:(12+random()*10)*0.7
        let juiceEnd=endX-direction*distance*(0.2+random()*0.25),rise=128*1.3,points:[CGPoint]
        if family == .bottle {points=[CGPoint(x:startX+direction*distance,y:64-rise*0.25),CGPoint(x:startX-direction*distance,y:64-rise*0.5),CGPoint(x:startX+direction*distance*0.75,y:64-rise*0.75),CGPoint(x:endX,y:64-rise)]}
        else if family == .honey {points=[CGPoint(x:endX,y:64-rise)]}
        else {points=[CGPoint(x:startX+direction*distance*0.7,y:64-rise*0.16),CGPoint(x:startX-direction*distance,y:64-rise*0.37),CGPoint(x:startX+direction*distance*0.85,y:64-rise*0.58),CGPoint(x:startX-direction*distance*0.65,y:64-rise*0.79),CGPoint(x:juiceEnd,y:64-rise)]}
        return Plan(family:family,radius:radius,color:color,startX:startX,startScale:startScale,startAlpha:startAlpha,duration:duration,scaleX:scaleX,scaleY:scaleY,nextDelay:(0.3+random()*0.3)*family.motionScale,points:points)
    }
}


extension NativeIdleBubbleMotion {
    /// Source delayed callbacks use their actual arrival as the next producer
    /// origin. The finite six-slot pool follows the maximum authored lifetime.
    final class Runtime {
        struct Bubble {let id:Int,slot:Int,born:Double,plan:Plan}
        private let family:Family,random:()->Double
        private(set) var bubbles:[Bubble]=[],elapsed=0.0,running=true
        private var nextBirth=0.0,sequence=0,cursor=0
        init(family:Family,random:@escaping()->Double) {self.family=family;self.random=random;emit()}
        func advance(_ delta:Double) {
            guard running else {return}
            elapsed+=max(0,delta)
            bubbles.removeAll {elapsed-$0.born >= $0.plan.duration}
            if elapsed>=nextBirth {emit()}
        }
        private func emit() {
            guard let slot=(0..<6).map({(cursor+$0)%6}).first(where:{candidate in !bubbles.contains {$0.slot==candidate}}) else {return}
            cursor=(slot+1)%6;sequence+=1
            let plan=NativeIdleBubbleMotion.make(family:family,random:random)
            bubbles.append(Bubble(id:sequence,slot:slot,born:elapsed,plan:plan));nextBirth=elapsed+plan.nextDelay
        }
        func stopForPointer() {running=false;bubbles.removeAll()}
        func restartAfterLanding() {guard !running else {return};running=true;elapsed=0;nextBirth=0;emit()}
    }
}
