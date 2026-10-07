import Foundation

/// Result component exits remain separate from the board exit and route receipt.
/// Source CTA pair completes at .38; authored stars retire from right to left.
enum NativeResultExitPlan {
    typealias Pose=NativeResultPresentationPlan.Pose
    enum CleanPath {case replay,journeyReturn}
    struct Sample {
        let hero,card,primary,secondary:Pose
        let content:[Pose]
        let paperOpacity:Double,completionSeconds:Double
    }
    static func cleanStar(seconds:Double,index:Int,earned:Int,capturedScale:Double)->Pose {
        guard index<earned else{return Pose(opacity:0,scale:0)}
        let age=seconds-Double(max(0,earned-1-index))*0.07
        if age<0{return Pose(scale:capturedScale)}
        if age<0.1 {let p=backOut(age/0.1,strength:2.7);return Pose(scale:capturedScale+(1.22-capturedScale)*p)}
        if age<0.5 {return Pose(scale:1.22*(1-backIn((age-0.1)/0.4,strength:1.7)))}
        return Pose(opacity:0,scale:0)
    }
    static func clean(seconds:Double,earned:Int,path:CleanPath,clickedPrimary:Bool)->Sample {
        let t=max(0,seconds),starEnd=earned==0 ? 0:0.5+Double(max(0,earned-1))*0.07
        let journey=path == .journeyReturn,start=journey ? 0:max(0.38,starEnd)
        let offsets=[-22.0,-18,-14,-10,-6],targets=[0.0,0.08,-0.04,0.05,-0.02]
        let duration=journey ? 0.42:0.58,step=journey ? 0.045:0.06
        let content=offsets.indices.map {i -> Pose in
            let p=NativeResultPresentationPlan.bezier(bound((t-start-Double(i+1)*step)/duration),0.68,-0.8,0.265,1.8)
            return Pose(opacity:bound(1-p),scale:1+(targets[i]-1)*p,y:offsets[i]*p,scaleBeforeTranslation:true)
        }
        let cardStart=journey ? starEnd:start+0.4,cardDuration=journey ? 0.22:0.65
        let collapse=journey ? max(0.645,starEnd+0.22,0.38):start+0.3+0.07+0.31+0.2
        let fadeDuration=journey ? 0.14:0.3
        let p=NativeResultPresentationPlan.bezier(bound((t-cardStart)/cardDuration),0.68,-0.8,0.265,1.8)
        let fade=NativeResultPresentationPlan.bezier(bound((t-collapse)/fadeDuration),0.25,0.1,0.25,1)
        return Sample(hero:Pose(opacity:earned==0 ? 0:1),card:Pose(opacity:1-fade,scale:1-0.14*p),
            primary:cta(seconds:t,delay:clickedPrimary ? 0:0.07),secondary:cta(seconds:t,delay:clickedPrimary ? 0.07:0),
            content:content,paperOpacity:1-fade,completionSeconds:collapse+fadeDuration)
    }
    static func failed(seconds:Double,clickedPrimary:Bool)->Sample {
        let t=max(0,seconds),after=t-0.38
        let hero=popOut(age:after,duration:0.28,y:-8)
        let content=[popOut(age:after-0.06,duration:0.28,y:-18),popOut(age:after-0.12,duration:0.28,y:-10)]
        // Collapse interrupts the .24 settle before its endpoint. Retain the
        // actual .20/.24 rendered scale, as GSAP's killed tween does.
        let cardScale=1-0.14*backIn(bound((min(after,0.36)-0.16)/0.24),strength:1.7)
        let collapse=backIn(bound((after-0.36)/0.22),strength:1.7)
        let paper=1-pow(1-bound((after-0.36)/0.2),2)
        return Sample(hero:hero,card:Pose(opacity:bound(1-collapse),scale:cardScale*(1-collapse)),
            primary:cta(seconds:t,delay:clickedPrimary ? 0:0.07),secondary:cta(seconds:t,delay:clickedPrimary ? 0.07:0),
            content:content,paperOpacity:1-paper,completionSeconds:1)
    }
    static func failedEmptyStar(seconds:Double,index:Int)->Pose {popOut(age:seconds-0.38-Double(index)*0.035,duration:0.24,y:-4)}
    private static func popOut(age:Double,duration:Double,y:Double)->Pose {
        let p=backIn(bound(age/duration),strength:1.7)
        return Pose(opacity:bound(1-p),scale:1-p,y:y*p)
    }
    private static func cta(seconds:Double,delay:Double)->Pose {
        let p=backIn(bound((seconds-delay)/0.31),strength:1.75)
        return Pose(opacity:bound(1-p),scale:1-p,y:18*p)
    }
    private static func bound(_ p:Double)->Double{min(1,max(0,p))}
    private static func backIn(_ p:Double,strength:Double)->Double{if p==0 || p==1{return p};return p*p*((strength+1)*p-strength)}
    private static func backOut(_ p:Double,strength:Double)->Double{if p==0 || p==1{return p};let x=p-1;return 1+x*x*((strength+1)*x+strength)}
}
