import Foundation
import CoreGraphics
import StackToSixGameplay

/// Every random choice belongs to this finite presentation, never its paint loop.
struct NativeBloobFinaleMotion {
    static let fallPlaybackRate=1.4
    static let shardCount=29
    static let originalFloatingBallCount=14
    static let floatingBallCount=22
    static let reverseBallCount=5
    static let reverseGravityLead=0.12
    struct Profile {
        var x,y:Double
        let size,entry,riseDuration,holdDuration,phaseX,phaseY,frequencyX,frequencyY:Double
        let tiltPhase,tiltFrequency,tiltAmplitude,tiltDirection,gravity:Double
        let sizeMultiplier:Double
        let playbackRoute:NativeBloobArt.PlaybackRoute?
        let baseRotation:Double,mirrored:Bool,debris:Bool
        let asset:Int,front:Bool
        var earlyExit=false
        var fallOverride:Double?
        var effectiveRise:Double {earlyExit ? min(riseDuration,0.88):riseDuration}
        var settled:Double {entry+effectiveRise}
        var fallStart:Double {fallOverride ?? (settled+(earlyExit ? 0.02:holdDuration)/NativeBloobFinaleMotion.fallPlaybackRate)}
        var playbackRate:Double {1.3+phaseX / (2 * .pi)*1.5}
        var playbackPhase:Double {phaseY}
        func rise(_ time:Double)->Double {let p=min(1,max(0,(time-entry)/effectiveRise));return 1-pow(1-p,3)}
        func tilt(_ time:Double)->Double {sin(time*tiltFrequency*tiltDirection+tiltPhase)*tiltAmplitude}
    }
    struct Pose {let center:CGPoint,scale,rotation,alpha:Double;let hidden:Bool}
    let balls:[Profile],reverseBalls:[Profile],shards:[Profile],viewport:CGSize
    var reverseStart:Double {shards.map(\.fallStart).min() ?? 0}
    var duration:Double {
        var gravityEnd:Double=0
        for p in shards+balls {
            let distance=Double(viewport.height)*(1-p.y)+p.size*2+100
            let end=p.fallStart+sqrt(2*distance/p.gravity)+0.3
            gravityEnd=max(gravityEnd,end)
        }
        let reverseEnd=(reverseBalls.map(\.fallStart).max() ?? reverseStart)-Self.reverseGravityLead+NativeBloobReverseArt.duration
        return max(4.1/Self.fallPlaybackRate,gravityEnd,reverseEnd)
    }
    init(viewport:CGSize,random:()->Double={Double.random(in:0..<1)}) {
        self.viewport=viewport
        func roll()->Double {let r=random();return r.isFinite ? min(0.999999,max(0,r)):0.5}
        func shuffle<T>(_ values:[T])->[T] {
            var result=values
            if result.count>1 {for i in stride(from:result.count-1,through:1,by:-1){result.swapAt(i,Int(roll()*Double(i+1)))}}
            return result
        }
        func profile(x:Double,y:Double,size:Double,entry:Double,rise:Double,hold:Double,asset:Int,front:Bool,debris:Bool=false,shard:Bool=false,enlarged:Bool=false,extraScale:Double=1)->Profile {
            let phaseX=roll()*2 * .pi
            let sizeMultiplier=(shard ? 0.8:(enlarged ? 1.4+phaseX/(2 * .pi)*0.2:1))*extraScale
            let route:NativeBloobArt.PlaybackRoute?=shard ? nil:.init(seed:phaseX.bitPattern ^ size.bitPattern)
            return Profile(x:x,y:y,size:size*sizeMultiplier,entry:entry,riseDuration:rise,holdDuration:hold,
                phaseX:phaseX,phaseY:roll()*2 * .pi,frequencyX:1.5+roll()*0.8,frequencyY:1.4+roll()*0.8,
                tiltPhase:roll()*2 * .pi,tiltFrequency:(shard ? 0.7:0.55)+roll()*(shard ? 0.6:0.45),tiltAmplitude:(shard ? 14:9)+roll()*(shard ? 10:6),
                tiltDirection:roll()<0.5 ? -1:1,gravity:(950+roll()*350)*Self.fallPlaybackRate*Self.fallPlaybackRate,sizeMultiplier:sizeMultiplier,playbackRoute:route,baseRotation:roll()*360,mirrored:roll()<0.5,debris:debris,asset:asset,front:front)
        }
        func gentlyCentered(_ original:Profile)->Profile {
            var p=original
            // Keep the original horizontal spread; bring only the vertical
            // distance from centre inward by a modest twenty percent.
            p.y=0.5+(p.y-0.5)*0.8
            return p
        }
        let bx=[0.25,0.76,0.47,0.20,0.79,0.36,0.65,0.51,0.15,0.88,0.42,0.67,0.24,0.82],by=[0.76,0.69,0.56,0.43,0.31,0.20,0.86,0.40,0.60,0.49,0.33,0.16,0.88,0.80]
        var floating=(0..<Self.originalFloatingBallCount).map {i in
            profile(x:bx[i]+(roll()-0.5)*0.07,y:by[i],size:(72+roll()*20)*(0.8+roll()*0.7),entry:roll()*0.16,
                rise:0.95+roll()*0.25,hold:0.55+roll()*0.45,asset:0,front:i%2==0,enlarged:i%2==0)
        }
        for i in floating.indices.sorted(by:{abs(floating[$0].y-0.5)<abs(floating[$1].y-0.5)}).prefix(2) {floating[i].earlyExit=true}
        let slots=Array(shuffle(Array(0..<48)).prefix(Self.shardCount)),assets=shuffle((0..<Self.shardCount).map{$0%7})
        var scattered=slots.enumerated().map {i,slot in
            let debris=slot>=38
            let x=debris ? 0.2+roll()*0.6:0.035+(Double(slot%4)+0.1+roll()*0.8)/4*0.93
            let y=debris ? 0.32+roll()*0.36:0.025+(Double(slot/4)+0.1+roll()*0.8)/10*0.875
            let size=debris ? 46*(0.7+roll()*0.5):46+roll()*58
            return profile(x:x,y:y,size:size,entry:roll()*0.16,rise:0.95+roll()*0.25,
                hold:0.55+roll()*0.45,asset:assets[i],front:roll()<0.35,debris:debris,shard:true)
        }
        for i in scattered.indices.sorted(by:{scattered[$0].y<scattered[$1].y}).prefix(3) {scattered[i].earlyExit=true}
        shards=scattered.map{gentlyCentered($0)}
        // Capture the additive population after the original profiles so the
        // existing Bloobs and rocks retain their exact random recipe.
        for i in Self.originalFloatingBallCount..<Self.floatingBallCount {
            floating.append(profile(x:0.12+roll()*0.76,y:0.12+roll()*0.73,
                size:(72+roll()*20)*(0.8+roll()*0.7),entry:roll()*0.16,
                rise:0.95+roll()*0.25,hold:0.55+roll()*0.45,asset:0,front:i%2==0,extraScale:1.5))
        }
        balls=floating.map{gentlyCentered($0)}
        let shardFall=scattered.map(\.fallStart).min() ?? 0
        reverseBalls=(0..<Self.reverseBallCount).map {i in
            var p=profile(x:0.15+roll()*0.7,y:0.15+roll()*0.5,
                size:(72+roll()*20)*(0.8+roll()*0.7),entry:roll()*0.08,
                rise:0.65+roll()*0.1,hold:0,asset:0,front:i%2==0,extraScale:1.4)
            p.fallOverride=shardFall+Double(i)*0.22+(p.phaseY/(2 * .pi))*0.06+Self.reverseGravityLead
            return gentlyCentered(p)
        }
    }
    func reverseAnimationStart(_ index:Int)->Double {reverseBalls[index].fallStart-Self.reverseGravityLead}
    func popStart(_ index:Int)->Double {reverseAnimationStart(index)+NativeBloobReverseArt.burstOffset}
    func ballPose(_ index:Int,seconds t:Double)->Pose {pose(balls[index],seconds:t)}
    func reversePose(_ index:Int,seconds t:Double)->Pose {
        let p=reverseBalls[index],sample=pose(p,seconds:t,gravityFactor:0.08)
        return Pose(center:sample.center,scale:sample.scale,rotation:sample.rotation,alpha:sample.alpha,
            hidden:t>=reverseAnimationStart(index)+NativeBloobReverseArt.duration)
    }
    func shardPose(_ index:Int,seconds t:Double)->Pose {
        pose(shards[index],seconds:t)
    }
    private func pose(_ p:Profile,seconds t:Double,gravityFactor:Double=1)->Pose {
        let e=p.rise(t),fall=max(0,t-p.fallStart)
        let x=Double(viewport.width)*p.x+sin(t*p.frequencyX+p.phaseX)*14*e
        var y=Double(viewport.height)*p.y+(Double(viewport.height)+100-Double(viewport.height)*p.y)*(1-e)
        if t<p.fallStart {y+=sin(t*p.frequencyY+p.phaseY)*16*e}
        else {
            let phase=p.fallStart*p.frequencyY+p.phaseY
            // C1 handoff: retain the floating pose and vertical velocity, then
            // let gravity accelerate the same object down through the viewport.
            y+=sin(phase)*16+cos(phase)*p.frequencyY*16*fall+0.5*p.gravity*gravityFactor*fall*fall
        }
        return Pose(center:CGPoint(x:x,y:y),scale:0.25+e*0.75,rotation:p.baseRotation+p.tilt(t),
            alpha:min(1,max(0,(t-p.entry)/0.15)),hidden:t>=p.fallStart && y-p.size>Double(viewport.height))
    }
}
