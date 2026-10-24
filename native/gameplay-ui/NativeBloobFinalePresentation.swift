import UIKit

/// Twenty-two independently phased idle Bloobs and falling rocks.
/// All playback belongs to one finite, pauseable clock.
@MainActor final class NativeBloobFinalePresentation:NativeFinitePresentation {
    static let floatingShardCount=NativeBloobFinaleMotion.shardCount
    nonisolated static var assets:[String] {[NativeBloobArt.path,NativeBloobReverseArt.path]+(1...7).map{"assets/shop/spaceship/rock\($0)@2x.png"}}
    let assetReady:Bool
    private let glyphs:NativeSplashGlyphField
    let motion:NativeBloobFinaleMotion
    private var balls:[UIView]=[],rocks:[UIImageView]=[]
    private var reverseViews:[NativeBloobReverseView]=[]
    private var reverseCarriers:[UIView]=[]
    private var idlePixels:CGImage?
    private var popped=Set<Int>()
    private var startedAir=false,retired=false
    init(resourceRoot:URL,viewport:CGSize,preparedArtwork:JimiV9Artwork?=nil,random:()->Double={Double.random(in:0..<1)}) {
        motion=NativeBloobFinaleMotion(viewport:viewport,random:random)
        let artwork=preparedArtwork ?? JimiV9Artwork(resourceRoot:resourceRoot)
        let idleAtlas=artwork.image(NativeBloobArt.path,densityAware:false)
        let rockImages=(1...7).map {artwork.image("assets/shop/spaceship/rock\($0)@2x.png")}
        assetReady=idleAtlas != nil && artwork.preparedBloobReverse != nil && rockImages.allSatisfy{$0 != nil}
        glyphs=NativeSplashGlyphField.clankStyle(artwork:artwork,text:"BLOOB",random:random)
        super.init(viewport:viewport,duration:max(motion.duration,glyphs.duration))
        accessibilityIdentifier="native-bloob-finale";clipsToBounds=true
        idlePixels=idleAtlas?.cgImage
        for i in 0..<NativeBloobFinaleMotion.floatingBallCount {
            let ball=UIView();ball.isUserInteractionEnabled=false
            ball.bounds=CGRect(x:0,y:0,width:motion.balls[i].size,height:motion.balls[i].size)
            ball.layer.contents=idleAtlas?.cgImage;ball.layer.contentsGravity = .resize
            ball.layer.contentsRect=CGRect(x:0,y:0,width:1.0/8,height:0.2)
            ball.layer.zPosition=motion.balls[i].front ? 7:3;ball.alpha=0;addSubview(ball);balls.append(ball)
            ball.accessibilityIdentifier="native-bloob-regular-\(i)"
        }
        if let recipe=artwork.preparedBloobReverse,let atlas=idleAtlas?.cgImage {
            for (i,plan) in motion.reverseBalls.enumerated() {
                let carrier=UIView();carrier.isUserInteractionEnabled=false
                carrier.accessibilityIdentifier="native-bloob-reverse-\(i)"
                carrier.bounds=CGRect(x:0,y:0,width:plan.size,height:plan.size)
                carrier.layer.contents=atlas;carrier.layer.contentsGravity = .resize
                carrier.layer.contentsRect=CGRect(x:0,y:0,width:1.0/8,height:0.2)
                carrier.layer.zPosition=plan.front ? 7:3;carrier.alpha=0
                let reverse=NativeBloobReverseView(recipe:recipe,atlas:atlas)
                reverse.center=CGPoint(x:carrier.bounds.midX,y:carrier.bounds.midY)
                reverse.transform=CGAffineTransform(scaleX:plan.size/640,y:plan.size/640)
                reverse.isHidden=true;carrier.addSubview(reverse);addSubview(carrier)
                reverseCarriers.append(carrier);reverseViews.append(reverse)
            }
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
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    override func start(){guard assetReady else{dispose();return};super.start()}
    override func paint(seconds t:TimeInterval) {
        guard !retired,assetReady else{return}
        glyphs.paint(seconds:t)
        if !startedAir {startedAir=true;onCue?("rise",0)}
        for (i,ball) in balls.enumerated() {
            let plan=motion.balls[i],pose=motion.ballPose(i,seconds:t)
            if ball.isHidden && pose.hidden {continue}
            ball.isHidden=pose.hidden
            guard !ball.isHidden else{continue}
            let time=t*plan.playbackRate+plan.playbackPhase
            let frame=NativeBloobArt.frame(seconds:plan.playbackRoute?.seconds(at:time) ?? time)
            let breathe=(0.91-0.09*cos(time/5.6*2 * .pi))
            ball.center=pose.center
            let rotation=pose.rotation
            ball.transform=CGAffineTransform(rotationAngle:rotation * .pi/180).scaledBy(x:pose.scale*breathe*(plan.mirrored ? -1:1),y:pose.scale*breathe)
            ball.alpha=pose.alpha
            ball.layer.contentsRect=CGRect(x:Double(frame%8)/8,y:Double(frame/8)/5,width:1.0/8,height:0.2)
        }
        for (i,carrier) in reverseCarriers.enumerated() {
            let plan=motion.reverseBalls[i],pose=motion.reversePose(i,seconds:t)
            if carrier.isHidden && pose.hidden {continue}
            carrier.isHidden=pose.hidden
            guard !pose.hidden else{continue}
            if t>=motion.popStart(i),popped.insert(i).inserted {onCue?("pop",i)}
            let animationStart=motion.reverseAnimationStart(i)
            let age=t-animationStart,reverse=reverseViews[i]
            reverse.isHidden=age<0
            let time:Double,frameTime:Double
            if age>=0 {
                carrier.layer.contents=nil
                time=animationStart*plan.playbackRate+plan.playbackPhase+age*1.635865961197037/NativeBloobReverseArt.bodyCycle
                let handoff=animationStart*plan.playbackRate+plan.playbackPhase
                frameTime=(plan.playbackRoute?.seconds(at:handoff) ?? handoff)+age*1.635865961197037/NativeBloobReverseArt.bodyCycle
                reverse.paint(seconds:age,bodyFrame:NativeBloobArt.frame(seconds:frameTime))
            }else {
                carrier.layer.contents=idlePixels
                time=t*plan.playbackRate+plan.playbackPhase
                frameTime=plan.playbackRoute?.seconds(at:time) ?? time
            }
            let frame=NativeBloobArt.frame(seconds:frameTime)
            let breathe=0.91-0.09*cos(time/5.6*2 * .pi)
            carrier.center=pose.center
            carrier.transform=CGAffineTransform(rotationAngle:pose.rotation * .pi/180).scaledBy(x:pose.scale*breathe*(plan.mirrored ? -1:1),y:pose.scale*breathe)
            carrier.alpha=pose.alpha
            carrier.layer.contentsRect=CGRect(x:Double(frame%8)/8,y:Double(frame/8)/5,width:1.0/8,height:0.2)
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
    override func dispose(){guard !retired else{return};retired=true;reverseViews.forEach{$0.dispose()};reverseViews.removeAll();reverseCarriers.forEach{$0.layer.contents=nil};reverseCarriers.removeAll();idlePixels=nil;balls.forEach{$0.layer.contents=nil};balls.removeAll();rocks.removeAll();super.dispose()}
}
