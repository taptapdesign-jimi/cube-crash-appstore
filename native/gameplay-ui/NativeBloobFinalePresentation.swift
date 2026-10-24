import UIKit

/// One finite clock owns the hero reverse, ordinary escape sprites and decorative magnetic dice.
@MainActor final class NativeBloobFinalePresentation:NativeFinitePresentation {
    nonisolated static var assets:[String] {[NativeBloobArt.path,NativeBloobReverseArt.path,"assets/tile.png"]}
    let assetReady:Bool
    private let glyphs:NativeSplashGlyphField
    let motion:NativeBloobFinaleMotion
    private let intakeDieSize:CGFloat
    private var dice:[Int:UIView]=[:]
    private var dieImage:UIImage?
    private var carriers:[Int:UIView]=[:]
    private var heroReverse:NativeBloobReverseView?
    private var reverseRecipe:NativeBloobReverseArt?
    private var idlePixels:CGImage?
    private var popped=false,startedAir=false,retired=false
    private var lastTime:Double?
    init(resourceRoot:URL,viewport:CGSize,origin:CGPoint?=nil,boardRect:CGRect?=nil,boardTileSize:CGFloat?=nil,preparedArtwork:JimiV9Artwork?=nil,random:()->Double={Double.random(in:0..<1)}) {
        intakeDieSize=boardTileSize ?? 64
        motion=NativeBloobFinaleMotion(viewport:viewport,origin:origin,boardRect:boardRect,random:random)
        let artwork=preparedArtwork ?? JimiV9Artwork(resourceRoot:resourceRoot)
        let idleAtlas=artwork.image(NativeBloobArt.path,densityAware:false)
        let tileImage=artwork.image("assets/tile.png",densityAware:true)
        assetReady=idleAtlas != nil && artwork.preparedBloobReverse != nil && tileImage != nil
        glyphs=NativeSplashGlyphField.clankStyle(artwork:artwork,text:"BLOOB",random:random)
        super.init(viewport:viewport,duration:max(motion.duration,glyphs.duration))
        accessibilityIdentifier="native-bloob-finale";clipsToBounds=true
        idlePixels=idleAtlas?.cgImage;reverseRecipe=artwork.preparedBloobReverse;dieImage=tileImage
        for i in motion.reverseBalls.indices {makeCarrier(i)}
        for i in motion.fakeDice.indices {makeFakeDie(i)}
        glyphs.frame=bounds;glyphs.layer.zPosition=10;addSubview(glyphs)
    }
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    private func makeCarrier(_ index:Int) {
        guard carriers[index]==nil,let atlas=idlePixels else{return}
        let plan=motion.reverseBalls[index],carrier=UIView()
        carrier.isUserInteractionEnabled=false
        carrier.accessibilityIdentifier=index==0 ? "native-bloob-hero":"native-bloob-ordinary-\(index)"
        carrier.bounds=CGRect(x:0,y:0,width:plan.size,height:plan.size)
        carrier.layer.contents=atlas;carrier.layer.contentsGravity = .resize
        carrier.layer.contentsRect=CGRect(x:0,y:0,width:1.0/8,height:0.2)
        carrier.layer.zPosition=index==0 ? 8:(plan.front ? 7:3);carrier.alpha=0
        if index==0,let recipe=reverseRecipe {
            let reverse=NativeBloobReverseView(recipe:recipe,atlas:atlas)
            reverse.center=CGPoint(x:carrier.bounds.midX,y:carrier.bounds.midY)
            reverse.transform=CGAffineTransform(scaleX:plan.size/640,y:plan.size/640)
            reverse.isHidden=true;carrier.addSubview(reverse);heroReverse=reverse
        }
        addSubview(carrier);carriers[index]=carrier
    }
    private func makeFakeDie(_ index:Int) {
        guard dice[index]==nil,let image=dieImage else{return}
        let plan=motion.fakeDice[index]
        // Same preserved tile and pip recipe as Barrel's decorative dice.
        let die=UIView(frame:CGRect(x:0,y:0,width:64,height:64));die.isUserInteractionEnabled=false
        die.accessibilityIdentifier="native-bloob-fake-die-\(index)"
        let tile=UIImageView(image:image);tile.frame=die.bounds;die.addSubview(tile)
        let pips=[1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]][plan.value] ?? []
        for index in pips {
            let pip=UIView(frame:CGRect(x:32+CGFloat(index%3-1)*15-3.75,y:32+CGFloat(index/3-1)*15-3.75,width:7.5,height:7.5))
            pip.backgroundColor=UIColor(red:129.0/255,green:90.0/255,blue:66.0/255,alpha:0.9)
            pip.layer.cornerRadius=2.2;die.addSubview(pip)
        }
        die.alpha=0;die.layer.zPosition=7;addSubview(die);dice[index]=die
    }
    private func removeFakeDie(_ index:Int) {
        guard let die=dice.removeValue(forKey:index) else{return}
        die.subviews.compactMap{$0 as? UIImageView}.forEach{$0.image=nil}
        die.removeFromSuperview()
    }
    private func removeCarrier(_ index:Int) {
        guard let carrier=carriers.removeValue(forKey:index) else{return}
        carrier.layer.contents=nil;carrier.removeFromSuperview()
        if index==0 {heroReverse?.dispose();heroReverse=nil}
    }
    override func start(){guard assetReady else{dispose();return};super.start()}
    override func paint(seconds t:TimeInterval) {
        guard !retired,assetReady else{return}
        if let lastTime,t<lastTime {
            // Explicit seek only: recreate retired sprites from shared prepared pixels.
            for i in motion.reverseBalls.indices where t<motion.exitTimes[i] {makeCarrier(i)}
            for i in motion.fakeDice.indices where t<motion.fakeDice[i].exit {makeFakeDie(i)}
        }
        lastTime=t;glyphs.paint(seconds:t)
        if !startedAir {startedAir=true;onCue?("rise",0)}
        if !popped,t>=motion.popStart(0) {popped=true;onCue?("pop",0)}
        for i in motion.reverseBalls.indices {
            guard let carrier=carriers[i] else{continue}
            if t>=motion.exitTimes[i] {removeCarrier(i);continue}
            let pose=motion.reversePose(i,seconds:t)
            carrier.isHidden=pose.hidden
            guard !pose.hidden else{continue}
            let plan=motion.reverseBalls[i]
            let artworkClock=i==0 ? NativeBloobFinaleMotion.heroArtworkClock(t):t
            let time=artworkClock*plan.playbackRate+plan.playbackPhase
            var frameTime=plan.playbackRoute?.seconds(at:time) ?? time
            if i==0,let reverse=heroReverse {
                let age=NativeBloobFinaleMotion.heroReverseSeconds(t)
                reverse.isHidden=age<0
                if age>=0 {
                    carrier.layer.contents=nil
                    let handoff=NativeBloobFinaleMotion.heroArtworkClock(motion.reverseStart)*plan.playbackRate+plan.playbackPhase
                    frameTime=(plan.playbackRoute?.seconds(at:handoff) ?? handoff)+age*1.635865961197037/NativeBloobReverseArt.bodyCycle
                    reverse.paint(seconds:age,bodyFrame:NativeBloobArt.frame(seconds:frameTime))
                } else {carrier.layer.contents=idlePixels}
            }
            let frame=NativeBloobArt.frame(seconds:frameTime),stretch=motion.stretch(i,seconds:t)
            carrier.center=pose.center
            carrier.transform=CGAffineTransform(rotationAngle:pose.rotation * .pi/180).scaledBy(x:pose.scale*stretch.width*(plan.mirrored ? -1:1),y:pose.scale*stretch.height)
            carrier.alpha=pose.alpha
            carrier.layer.contentsRect=CGRect(x:Double(frame%8)/8,y:Double(frame/8)/5,width:1.0/8,height:0.2)
        }
        for i in motion.fakeDice.indices {
            guard let die=dice[i] else{continue}
            let plan=motion.fakeDice[i]
            if t>=plan.exit {removeFakeDie(i);continue}
            let depth:CGFloat=t<NativeBloobFinaleMotion.scatterStart ? 7:CGFloat(plan.scatterDepth)
            if die.layer.zPosition != depth {die.layer.zPosition=depth}
            let pose=motion.fakeDiePose(i,seconds:t)
            die.isHidden=pose.hidden
            if die.alpha != pose.alpha {die.alpha=pose.alpha}
            guard !pose.hidden,pose.alpha>0 else{continue}
            die.center=pose.center
            let side=t<NativeBloobFinaleMotion.scatterStart ? Double(intakeDieSize):plan.flight.size
            let scale=pose.scale*side/64
            die.transform=CGAffineTransform(rotationAngle:pose.rotation * .pi/180).scaledBy(x:scale,y:scale)
        }
    }
    override func dispose() {
        guard !retired else{return};retired=true
        for i in Array(carriers.keys) {removeCarrier(i)}
        idlePixels=nil;reverseRecipe=nil
        for i in Array(dice.keys) {removeFakeDie(i)}
        dieImage=nil
        super.dispose()
    }
}
