import UIKit
import StackToSixGameplay

/// One travelling explosion, eight independently phased idle Bloobs and falling rocks.
/// All playback belongs to one finite, pauseable clock.
@MainActor final class NativeBloobBallFinalePresentation:NativeFinitePresentation {
    static let svgPlaybackRate=4.0
    static let floatingShardCount=NativeBloobBallFinaleMotion.shardCount
    static var assets:[String] {[NativeBloobBallArt.finalePath,NativeBloobBallArt.floatingPath]+(1...7).map{"assets/shop/spaceship/rock\($0)@2x.png"}}
    var onExplosion:((Int,CGPoint)->Void)?
    let assetReady:Bool
    private let glyphs:NativeSplashGlyphField
    let motion:NativeBloobBallFinaleMotion
    let origin:CGPoint
    static let flightDuration=0.6
    static let burstTime=flightDuration+1/svgPlaybackRate
    static let explosionDuration=flightDuration+1.57808309828/svgPlaybackRate
    let burstOrigin:CGPoint
    private let explosion=UIView()
    private var balls:[UIView]=[],rocks:[UIImageView]=[]
    private var popped=Set<Int>()
    private var receipts=Set<Int>(),startedAir=false,retired=false
    init(resourceRoot:URL,viewport:CGSize,origin:CGPoint?=nil,preparedArtwork:JimiV9Artwork?=nil,random:()->Double={Double.random(in:0..<1)}) {
        let start=origin ?? CGPoint(x:viewport.width/2,y:viewport.height/2)
        self.origin=start
        // Depart toward the opposite quadrant, travelling thirty percent of
        // the vector to its inset corner before the original SVG begins.
        burstOrigin=Self.burstPoint(origin:start,viewport:viewport)
        motion=NativeBloobBallFinaleMotion(viewport:viewport,random:random)
        let artwork=preparedArtwork ?? JimiV9Artwork(resourceRoot:resourceRoot)
        let atlas=artwork.image(NativeBloobBallArt.finalePath,densityAware:false)
        let idleAtlas=artwork.image(NativeBloobBallArt.floatingPath,densityAware:false)
        let rockImages=(1...7).map {artwork.image("assets/shop/spaceship/rock\($0)@2x.png")}
        assetReady=atlas != nil && idleAtlas != nil && rockImages.allSatisfy{$0 != nil}
        glyphs=NativeSplashGlyphField.clankStyle(artwork:artwork,text:"BLOOOB!",random:random)
        super.init(viewport:viewport,duration:max(motion.duration,glyphs.duration))
        accessibilityIdentifier="native-bloob-ball-finale";clipsToBounds=true
        explosion.bounds=CGRect(x:0,y:0,width:224,height:224)
        explosion.layer.anchorPoint=CGPoint(x:0.5,y:380.0/640)
        explosion.layer.position=self.origin
        explosion.layer.contents=atlas?.cgImage;explosion.layer.contentsGravity = .resize
        explosion.layer.zPosition=8;explosion.isUserInteractionEnabled=false;addSubview(explosion)
        for i in 0..<NativeBloobBallFinaleMotion.floatingBallCount {
            let ball=UIView();ball.isUserInteractionEnabled=false
            ball.bounds=CGRect(x:0,y:0,width:motion.balls[i].size,height:motion.balls[i].size)
            ball.layer.contents=idleAtlas?.cgImage;ball.layer.contentsGravity = .resize
            ball.layer.contentsRect=CGRect(x:0,y:0,width:1.0/8,height:0.2)
            ball.layer.zPosition=motion.balls[i].front ? 7:3;ball.alpha=0;addSubview(ball);balls.append(ball)
        }
        for i in 0..<Self.floatingShardCount {
            let plan=motion.shards[i]
            let rock=UIImageView(image:rockImages[plan.asset]);rock.contentMode = .scaleAspectFit
            let side:CGFloat=CGFloat(plan.size)
            rock.bounds=CGRect(x:0,y:0,width:side,height:side);rock.alpha=0
            rock.layer.zPosition=plan.front ? 6:1;addSubview(rock);rocks.append(rock)
        }
        glyphs.frame=bounds;glyphs.layer.zPosition=10;addSubview(glyphs)
    }
    static func burstPoint(origin start:CGPoint,viewport:CGSize)->CGPoint {
        let corner=CGPoint(x:start.x<viewport.width/2 ? viewport.width-64:64,
            y:start.y<viewport.height/2 ? viewport.height-120:120)
        return CGPoint(x:start.x+(corner.x-start.x)*0.3,y:start.y+(corner.y-start.y)*0.3)
    }
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    override func start(){guard assetReady else{dispose();return};super.start()}
    private static func track(_ time:Double,_ keys:[Double],_ values:[Double])->Double {
        let i=keys.indices.dropLast().first(where:{time<keys[$0+1]}) ?? keys.count-2
        let p=NativeArea55Motion.clamp((time-keys[i])/(keys[i+1]-keys[i]))
        // SVG ease-in-out (.42,0,.58,1), solved against x.
        var lo=0.0,hi=1.0
        for _ in 0..<20 {let u=(lo+hi)/2,x=3*(1-u)*(1-u)*u*0.42+3*(1-u)*u*u*0.58+u*u*u;if x<p{lo=u}else{hi=u}}
        let u=(lo+hi)/2,e=3*(1-u)*u*u+u*u*u
        return values[i]+(values[i+1]-values[i])*e
    }
    /// Finite frequency ramp sampled by the same pauseable clock; never scales the ball.
    static func preBurstShake(seconds t:Double)->CGPoint {
        guard t>=0,t<burstTime else{return .zero}
        let p=t/burstTime,phase=2 * Double.pi*(3*t+5.5*t*t/burstTime)
        let amplitude=p*(1+5*p*p)
        return CGPoint(x:sin(phase)*amplitude,y:sin(phase*0.83+1.1)*amplitude*0.65)
    }
    override func paint(seconds t:TimeInterval) {
        guard !retired,assetReady else{return}
        glyphs.paint(seconds:t)
        if !startedAir {startedAir=true;onCue?("rise",0)}
        let flight=min(1,max(0,t/Self.flightDuration))
        let travel=flight*flight*(3-2*flight)
        let flying=t<Self.flightDuration
        let svgTime=max(0,t-Self.flightDuration)*Self.svgPlaybackRate
        if t>=Self.burstTime,!receipts.contains(-1) {
            receipts.insert(-1);onCue?("burst",0)
        }
        if t>=Self.explosionDuration,!receipts.contains(0) {
            for i in 0..<NativeBloobBallRewardPolicy.ballCount {
                receipts.insert(i);onExplosion?(i,burstOrigin)
            }
        }
        explosion.isHidden=t>=Self.explosionDuration
        if !explosion.isHidden {
            let y=Self.track(svgTime,[0,0.125,0.375,0.65625,1,1.08518518519,1.23566529492,1.30719547971,1.38386121785,1.47075232896,1.52697352038,1.57808309828],[25,25,45,-20,-65,-60,-30,-10,-12,-16,-16,25])
            let sx=Self.track(svgTime,[0,0.125,0.375,0.65625,1,1.1136,1.23566529492,1.29697,1.3123,1.52697352038,1.57808309828],[0.98,1,1.09,0.915,1,1.06,1.02,1.045,1.02,1.02,0.98])
            let sy=Self.track(svgTime,[0,0.125,0.375,0.65625,1,1.1136,1.23566529492,1.29697,1.3123,1.52697352038,1.57808309828],[0.98,1,0.89,1.1,1,1.045,1.02,1.04,1.02,1.02,0.98])
            let dx=burstOrigin.x-origin.x,dy=burstOrigin.y-origin.y
            let shake=Self.preBurstShake(seconds:t)
            explosion.layer.position=CGPoint(x:origin.x+dx*travel+shake.x,
                y:origin.y+dy*travel+(flying ? -sin(flight * .pi)*24:(y-25)*explosion.bounds.width/640)+shake.y)
            if t<Self.burstTime {
                explosion.transform=CGAffineTransform(rotationAngle:shake.x*0.004)
            }else{explosion.transform=CGAffineTransform(scaleX:sx,y:sy)}
            let frame=svgTime<1 ? 0:svgTime<1.0882104 ? 1:svgTime<1.205833 ? 2:svgTime<1.294044 ? 3:svgTime<1.365495 ? 4:5
            explosion.layer.contentsRect=CGRect(x:Double(frame%3)/3,y:Double(frame/3)/2,width:1.0/3,height:0.5)
        }
        for (i,ball) in balls.enumerated() {
            let plan=motion.balls[i],pose=motion.ballPose(i,seconds:t)
            if ball.isHidden && pose.hidden {continue}
            let popStart=motion.popStart(i)
            let popProgress=popStart.map{min(1,max(0,(t-$0)/0.14))} ?? 0
            if popProgress>=1,popped.insert(i).inserted {onCue?("pop",i)}
            ball.isHidden=pose.hidden || popProgress>=1
            guard !ball.isHidden else{continue}
            let time=t*plan.playbackRate+plan.playbackPhase
            let frame=NativeBloobBallArt.floatingFrame(seconds:time)
            let breathe=(0.91-0.09*cos(time/5.6*2 * .pi))*(1+0.38*popProgress*popProgress)
            ball.center=pose.center
            let rotation=pose.rotation
            ball.transform=CGAffineTransform(rotationAngle:rotation * .pi/180).scaledBy(x:pose.scale*breathe*(plan.mirrored ? -1:1),y:pose.scale*breathe)
            ball.alpha=pose.alpha
            ball.layer.contentsRect=CGRect(x:Double(frame%8)/8,y:Double(frame/8)/5,width:1.0/8,height:0.2)
        }
        for (i,rock) in rocks.enumerated() {
            let pose=motion.shardPose(i,seconds:t),plan=motion.shards[i]
            if rock.isHidden && pose.hidden {continue}
            rock.isHidden=pose.hidden
            guard !pose.hidden else{continue}
            rock.center=pose.center
            rock.transform=CGAffineTransform(rotationAngle:pose.rotation * .pi/180).scaledBy(x:pose.scale*(plan.mirrored ? -1:1),y:pose.scale)
            rock.alpha=pose.alpha
        }
    }
    override func dispose(){guard !retired else{return};retired=true;onExplosion=nil;balls.removeAll();rocks.removeAll();super.dispose()}
}
