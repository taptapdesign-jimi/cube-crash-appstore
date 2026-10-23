import Foundation
import CoreGraphics
import StackToSixGameplay

/// Every random choice belongs to this finite presentation, never its paint loop.
struct NativeBloobBallFinaleMotion {
    static let fallPlaybackRate=1.4
    static let shardCount=48
    static let floatingBallCount=8
    struct Profile {
        let x,y,size,entry,riseDuration,holdDuration,phaseX,phaseY,frequencyX,frequencyY:Double
        let tiltPhase,tiltFrequency,tiltAmplitude,tiltDirection,gravity:Double
        let baseRotation:Double,mirrored:Bool,debris:Bool
        let asset:Int,front:Bool
        var earlyExit=false
        var effectiveRise:Double {earlyExit ? min(riseDuration,0.88):riseDuration}
        var settled:Double {entry+effectiveRise}
        var fallStart:Double {settled+(earlyExit ? 0.02:holdDuration)/NativeBloobBallFinaleMotion.fallPlaybackRate}
        var playbackRate:Double {1.3+phaseX / (2 * .pi)*1.5}
        var playbackPhase:Double {phaseY}
        func rise(_ time:Double)->Double {let p=min(1,max(0,(time-entry)/effectiveRise));return 1-pow(1-p,3)}
        func tilt(_ time:Double)->Double {sin(time*tiltFrequency*tiltDirection+tiltPhase)*tiltAmplitude}
    }
    struct Pose {let center:CGPoint,scale,rotation,alpha:Double;let hidden:Bool}
    let balls:[Profile],shards:[Profile],viewport:CGSize
    var duration:Double {
        max(4.1/Self.fallPlaybackRate,(shards+balls).map {p in
            p.fallStart+sqrt(2*(Double(viewport.height)*(1-p.y)+p.size*2+100)/p.gravity)+0.3
        }.max() ?? 0)
    }
    init(viewport:CGSize,random:()->Double={Double.random(in:0..<1)}) {
        self.viewport=viewport
        func roll()->Double {let r=random();return r.isFinite ? min(0.999999,max(0,r)):0.5}
        func shuffle<T>(_ values:[T])->[T] {
            var result=values
            if result.count>1 {for i in stride(from:result.count-1,through:1,by:-1){result.swapAt(i,Int(roll()*Double(i+1)))}}
            return result
        }
        func profile(x:Double,y:Double,size:Double,entry:Double,rise:Double,hold:Double,asset:Int,front:Bool,debris:Bool=false,shard:Bool=false)->Profile {
            Profile(x:x,y:y,size:size,entry:entry,riseDuration:rise,holdDuration:hold,
                phaseX:roll()*2 * .pi,phaseY:roll()*2 * .pi,frequencyX:1.5+roll()*0.8,frequencyY:1.4+roll()*0.8,
                tiltPhase:roll()*2 * .pi,tiltFrequency:(shard ? 0.7:0.55)+roll()*(shard ? 0.6:0.45),tiltAmplitude:(shard ? 14:9)+roll()*(shard ? 10:6),
                tiltDirection:roll()<0.5 ? -1:1,gravity:(950+roll()*350)*Self.fallPlaybackRate*Self.fallPlaybackRate,baseRotation:roll()*90,mirrored:roll()<0.5,debris:debris,asset:asset,front:front)
        }
        let bx=[0.25,0.76,0.47,0.20,0.79,0.36,0.65,0.51],by=[0.76,0.69,0.56,0.43,0.31,0.20,0.86,0.40]
        var floating=(0..<Self.floatingBallCount).map {i in
            profile(x:bx[i]+(roll()-0.5)*0.07,y:by[i],size:(72+roll()*20)*(0.8+roll()*0.7),entry:roll()*0.16,
                rise:0.95+roll()*0.25,hold:0.55+roll()*0.45,asset:0,front:i%2==0)
        }
        for i in floating.indices.sorted(by:{abs(floating[$0].y-0.5)<abs(floating[$1].y-0.5)}).prefix(2) {floating[i].earlyExit=true}
        balls=floating
        let slots=shuffle(Array(0..<Self.shardCount)),assets=shuffle((0..<Self.shardCount).map{$0%7})
        var scattered=slots.enumerated().map {i,slot in
            let debris=slot>=38
            let x=debris ? 0.2+roll()*0.6:0.035+(Double(slot%4)+0.1+roll()*0.8)/4*0.93
            let y=debris ? 0.32+roll()*0.36:0.025+(Double(slot/4)+0.1+roll()*0.8)/10*0.875
            let size=debris ? 46*(0.7+roll()*0.5):46+roll()*58
            return profile(x:x,y:y,size:size,entry:roll()*0.16,rise:0.95+roll()*0.25,
                hold:0.55+roll()*0.45,asset:assets[i],front:roll()<0.35,debris:debris,shard:true)
        }
        for i in scattered.indices.sorted(by:{scattered[$0].y<scattered[$1].y}).prefix(3) {scattered[i].earlyExit=true}
        shards=scattered
    }
    /// A few carriers pop during their exit; the rest keep the gravity fall.
    func popStart(_ index:Int)->Double? {
        index.isMultiple(of:3) ? balls[index].fallStart+0.12/Self.fallPlaybackRate:nil
    }
    func ballPose(_ index:Int,seconds t:Double)->Pose {
        pose(balls[index],seconds:t)
    }
    func shardPose(_ index:Int,seconds t:Double)->Pose {
        pose(shards[index],seconds:t)
    }
    private func pose(_ p:Profile,seconds t:Double)->Pose {
        let e=p.rise(t),fall=max(0,t-p.fallStart)
        let x=Double(viewport.width)*p.x+sin(t*p.frequencyX+p.phaseX)*14*e
        var y=Double(viewport.height)*p.y+(Double(viewport.height)+100-Double(viewport.height)*p.y)*(1-e)
        if t<p.fallStart {y+=sin(t*p.frequencyY+p.phaseY)*16*e}
        else {
            let phase=p.fallStart*p.frequencyY+p.phaseY
            // C1 handoff: retain the floating pose and vertical velocity, then
            // let gravity accelerate the same object down through the viewport.
            y+=sin(phase)*16+cos(phase)*p.frequencyY*16*fall+0.5*p.gravity*fall*fall
        }
        return Pose(center:CGPoint(x:x,y:y),scale:0.25+e*0.75,rotation:p.baseRotation+p.tilt(t),
            alpha:min(1,max(0,(t-p.entry)/0.15)),hidden:t>=p.fallStart && y-p.size>Double(viewport.height))
    }
}
