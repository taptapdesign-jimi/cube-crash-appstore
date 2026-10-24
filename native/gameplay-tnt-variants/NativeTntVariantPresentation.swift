import UIKit

/// Flower's layered canopy/petal flight and Barrel's smoke/wood/die flight.
/// The frame-six receipt releases the scene's captured board-return plan;
/// this owner never decides targets, replacements, score or input admission.
@MainActor
final class NativeTntVariantPresentation: NativeFinitePresentation {
    static let animationDuration: TimeInterval = 4.2
    enum Variant: String { case coconut,flower,barell,bloobGas = "bloob-ball" }
    var onSprite6Entered: (() -> Void)?
    var onVisualSequenceComplete: (() -> Void)?
    private(set) var assetsReady = false
    private struct Cloud { let view: UIImageView,index: Int,size: Double,bounce: Double,y: Double,rotation: Double,rotationTravel: Double,squeezePhase: Double,opacityFloor: Double,opacityPeriod: Double }
    private struct Petal { let view: UIImageView,plan: NativeTntVariantPlanning.Flower }
    private struct Debris { let view: UIView,plan: NativeTntFinale.DiePlan,sizeScale: Double }
    private let palmUnit=UIView(),rearPalmUnit=UIView()
    private var frontPalms:[UIImageView]=[],rearPalms:[NativeCoconutPalmView]=[]
    private var coconutMotion:NativeCoconutFinaleMotion?
    private var wholeCoconuts:[UIView]=[]
    private let variant: Variant
    private let glyphs: NativeSplashGlyphField
    private let effectCenter: CGPoint
    private var clouds: [Cloud] = [],petals: [Petal] = [],debris: [Debris] = []
    private var receipts = Set<String>()
    private var finishedClouds=Set<Int>(),finishedPetals=Set<Int>(),finishedDebris=Set<Int>()
    private var lastPaintTime:TimeInterval?
    private var boardReaction:NativeBloobBoardReactionBinding?
    func bindBoardReaction(_ binding:NativeBloobBoardReactionBinding?) {boardReaction?.dispose();boardReaction=binding}
    override func setSuspended(_ value:Bool){super.setSuspended(value);if value {boardReaction?.reset()}}
    override func didMoveToWindow(){super.didMoveToWindow();if window==nil {boardReaction?.reset()}}
    private var cancelled = false
    static func assets(_ variant: Variant) -> [String] {
        if variant == .coconut {return (1...8).map{"assets/shop/coconut/palm\($0)@2x.png"}+["assets/shop/coconut/coconut.png"]}
        if variant == .flower {
            return (1...9).map { "assets/shop/bush/bush\($0)@2x.png" }+(1...6).map { "assets/shop/bush/flowr\($0)@2x.png" }
        }
        return (1...12).map { variant == .bloobGas ? "assets/shop/bloog ball/gas animation/gas\($0)@2x.png":"assets/shop/explosion pack/animation/tnt\($0)@2x.png" }+(1...6).map { "assets/shop/barell/wood\($0).png" }+["assets/tile.png"]
    }
    init(resourceRoot: URL,variant: Variant,viewport: CGSize,preparedArtwork:JimiV9Artwork?=nil,coconutBoardBodySize:CGFloat?=nil,random: @escaping () -> Double = { Double.random(in:0..<1) }) {
        self.variant = variant; effectCenter = CGPoint(x:viewport.width/2,y:viewport.height/2)
        let artwork = preparedArtwork ?? JimiV9Artwork(resourceRoot:resourceRoot)
        if variant == .coconut || variant == .flower {
            // Flower petals sampled from the preserved flying flowr3/flowr2 art.
            let glowColors: [UIColor] = variant == .flower
                ? [UIColor(red:1,green:156.0/255,blue:171.0/255,alpha:1),UIColor(red:253.0/255,green:233.0/255,blue:177.0/255,alpha:1)]
                : [UIColor(red:101.0/255,green:119.0/255,blue:30.0/255,alpha:1),UIColor(red:130.0/255,green:148.0/255,blue:36.0/255,alpha:1)]
            glyphs = NativeSplashGlyphField.clankStyle(artwork:artwork,text:variant == .flower ? "BLOSSOM":"COCO-LOCO",backgroundColors:glowColors,random:random)
        } else if variant == .bloobGas {
            glyphs = NativeSplashGlyphField.clankStyle(artwork:artwork,text:"GASSS!",random:random)
        } else {
            glyphs = NativeSplashGlyphField(artwork:artwork,text:"POOOF",colors:[UIColor(red:244.0/255,green:141.0/255,blue:89.0/255,alpha:1)],splitIndex:0,letterOpacityRange:1...1,random:random)
        }
        let coconutPlan=variant == .coconut ? NativeCoconutFinaleMotion(viewport:viewport,boardBodySize:coconutBoardBodySize ?? 48,random:random):nil
        super.init(viewport:viewport,duration:max(Self.animationDuration,(coconutPlan?.endTime ?? 0)+0.3))
        accessibilityIdentifier = "native-\(variant.rawValue)-finale"
        assetsReady = Self.assets(variant).allSatisfy { artwork.image($0.replacingOccurrences(of:"@2x.png",with:".png"),densityAware:true) != nil }
        // Source native-skin burst/debris is allocated before the smoke clock.
        if variant == .coconut,let motion=coconutPlan {
            rearPalmUnit.frame=bounds;rearPalmUnit.layer.zPosition = -0.5;addSubview(rearPalmUnit)
            palmUnit.frame=bounds;addSubview(palmUnit)
            coconutMotion=motion
            let image=artwork.image("assets/shop/coconut/coconut.png",densityAware:true)
            for _ in motion.whole {
                let view=UIImageView(image:image);setNaturalBounds(view)
                view.alpha=0;view.accessibilityIdentifier="native-coconut-whole";view.layer.zPosition=20
                addSubview(view);wholeCoconuts.append(view)
            }
        } else if variant == .flower {
            for plan in NativeTntVariantPlanning.flowers(random:random) {
                let view = UIImageView(image:artwork.image("assets/shop/bush/flowr\(plan.assetIndex).png",densityAware:true))
                setNaturalBounds(view); view.center = effectCenter; view.alpha = 0; view.layer.zPosition = plan.depth; addSubview(view)
                petals.append(Petal(view:view,plan:plan))
            }
        } else {
            let woods = NativeTntFinale.makeDiePlans(random:random)
            let dice = NativeTntVariantPlanning.barrelDice(wood:woods,random:random)
            let sourceOrder = NativeTntVariantPlanning.woodSourceOrder(random:random)
            for (index,plan) in woods.enumerated() {
                let view = UIImageView(image:artwork.image("assets/shop/barell/wood\(sourceOrder[index]).png",densityAware:true))
                setNaturalBounds(view); view.alpha=0;view.layer.zPosition=plan.depth;addSubview(view)
                debris.append(Debris(view:view,plan:plan,sizeScale:0.7))
            }
            for plan in dice {
                let die = UIView(frame:CGRect(x:0,y:0,width:64,height:64));die.backgroundColor = .clear
                let tile = UIImageView(image:artwork.image("assets/tile.png",densityAware:true));tile.frame=die.bounds;die.addSubview(tile)
                let pips = [1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]][plan.value] ?? []
                for index in pips {
                    let pip=UIView(frame:CGRect(x:32+CGFloat(index%3-1)*15-3.75,y:32+CGFloat(index/3-1)*15-3.75,width:7.5,height:7.5))
                    pip.backgroundColor=UIColor(red:129.0/255,green:90.0/255,blue:66.0/255,alpha:0.9);pip.layer.cornerRadius=2.2;die.addSubview(pip)
                }
                die.alpha=0;die.layer.zPosition=plan.depth;addSubview(die);debris.append(Debris(view:die,plan:plan,sizeScale:1))
            }
        }
        for index in 0..<(variant == .coconut ? 8:variant == .flower ? 9:12) {
            let path = variant == .coconut ? "assets/shop/coconut/palm\(index+1).png":variant == .flower ? "assets/shop/bush/bush\(index+1).png":(variant == .bloobGas ? "assets/shop/bloog ball/gas animation/gas\(index+1).png":"assets/shop/explosion pack/animation/tnt\(index+1).png")
            let image=artwork.image(path,densityAware:true)
            let view:UIImageView=variant == .coconut ? NativeCoconutPalmView(image:image):UIImageView(image:image)
            if variant != .coconut {setNaturalBounds(view)};view.center=effectCenter;view.alpha=0;view.layer.zPosition=CGFloat(index)
            let rotation=(random()-0.5)*20 * .pi/180
            view.transform=CGAffineTransform(rotationAngle:rotation)
            if variant == .coconut {view.layer.zPosition=index==4 ? 12:CGFloat(index);view.accessibilityIdentifier="native-coconut-palm\(index+1)";palmUnit.addSubview(view);frontPalms.append(view)
                let rear=NativeCoconutPalmView(image:image);rear.center=effectCenter;rear.alpha=0
                rear.accessibilityIdentifier="native-coconut-rear-palm\(index+1)"
                rearPalmUnit.addSubview(rear);rearPalms.append(rear)
            }else{addSubview(view)}
            let size=(1+random()*0.52)*(variant == .flower ? 0.9775:1)
            let bounce=size*(1.02+random()*0.06),y=(random()-0.5)*4
            // Capture gas variation once; repaint/background resume never draws RNG.
            let travel=variant == .bloobGas ? (10+random()*10) * .pi/180 * (random()<0.5 ? -1:1):0
            let squeezePhase=variant == .bloobGas ? random()*2 * .pi:0
            let opacityFloor=variant == .bloobGas ? [0.3,0.4,0.5,0.8][(index+min(3,Int(random()*4)))%4]:1
            let opacityPeriod=variant == .bloobGas ? 0.75+random()*0.4:0.8
            clouds.append(Cloud(view:view,index:index,size:size,bounce:bounce,y:y,rotation:rotation,rotationTravel:travel,squeezePhase:squeezePhase,opacityFloor:opacityFloor,opacityPeriod:opacityPeriod))
        }
        glyphs.frame=bounds;glyphs.layer.zPosition=100;addSubview(glyphs)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    private func setNaturalBounds(_ view: UIImageView) { view.bounds=CGRect(origin:.zero,size:view.image?.size ?? .zero);view.contentMode = .scaleToFill }
    private func fire(_ name:String,_ callback:(() -> Void)?) { if receipts.insert(name).inserted { callback?() } }
    override func paint(seconds time: TimeInterval) {
        guard !cancelled,assetsReady else { return }
        if variant == .bloobGas {boardReaction?.paint(seconds:time,startTime:0.07,returnTime:1.45,vibrates:false)}
        // Retain final hidden poses but stop evaluating/mutating retired art.
        // Explicit backward sampling restores the original authored pose.
        if let previous=lastPaintTime,time<previous {
            finishedClouds.removeAll();finishedPetals.removeAll();finishedDebris.removeAll()
        }
        lastPaintTime=time
        glyphs.paint(seconds:time,glowOpacity:variant == .coconut || variant == .flower ? CGFloat(1-Self.smoothUnit((time-1.40)/0.57)):1)
        if variant == .bloobGas,receipts.insert("rise").inserted {onCue?("rise",0)}
        if time>=0.51 { fire("frame6",onSprite6Entered) }
        let sequenceEnd=variant == .coconut ? 1.77+NativeCoconutFinaleMotion.palmHoldExtension:1.01+Double(clouds.count-1)*0.04+0.30
        if time>=sequenceEnd {
            if variant == .flower || variant == .coconut,receipts.insert("spark").inserted { onCue?("spark",0) }
            fire("sequence",onVisualSequenceComplete)
        }
        if variant != .flower,variant != .coconut,time>=0.91,receipts.insert("poof").inserted { onCue?("smoke",0) }
        let leavesTime=variant == .coconut ? 1.77*0.9+NativeCoconutFinaleMotion.palmHoldExtension:sequenceEnd*0.9
        if variant == .flower || variant == .coconut,time>=leavesTime,receipts.insert("leaves").inserted { onCue?("leaves",0) }
        if variant == .coconut {
            paintPalmUnit(palmUnit,poses:frontPalms,seconds:time,reverse:false)
            paintPalmUnit(rearPalmUnit,poses:rearPalms,seconds:time-0.200,reverse:true)
            paintCoconuts(seconds:time)
        }
        for cloud in clouds where !finishedClouds.contains(cloud.index) {
            if variant == .coconut {
                continue
            }
            let enter=0.07+Double(cloud.index)*0.04,settle=enter+0.24,exit=1.01+Double(cloud.index)*0.04
            if time<enter { continue }
            if time>=exit+0.30 || (variant == .flower && cloud.index<2 && time>=1.01) { cloud.view.alpha=0;finishedClouds.insert(cloud.index);continue }
            var scale:Double=0,alpha:Double=1,y:Double=0
            if time<settle { let p=Double(NativeBoardMotion.Ease.backOut(2).sample((time-enter)/0.24));scale=cloud.size*1.2*p;alpha=p }
            else if time<settle+0.1 { let p=Double(NativeBoardMotion.Ease.power2Out.sample((time-settle)/0.1));scale=cloud.size*(1.2-0.2*p) }
            else {
                let phase=max(0,min(time,exit)-settle-0.1).truncatingRemainder(dividingBy:0.8)/0.4
                let p=Self.elastic(phase<=1 ? phase:2-phase)
                scale=cloud.size+(cloud.bounce-cloud.size)*p;y=cloud.y*p
                if time>=exit+0.13 { let p=Double(NativeBoardMotion.Ease.backIn(2).sample((time-exit-0.13)/0.17));scale *= 1-p;alpha=1-p }
            }
            cloud.view.center=CGPoint(x:effectCenter.x,y:effectCenter.y+CGFloat(y))
            let gas=variant == .bloobGas
            let progress=max(0,min(1,(time-enter)/(exit+0.30-enter)))
            let rotation=cloud.rotation+cloud.rotationTravel*progress*progress*(3-2*progress)
            let squeeze=gas ? 0.20*sin((time-enter)*2 * .pi/0.9+cloud.squeezePhase)*sin(.pi*progress):0
            // Sample finite gas breathing on the same clock; stagger layers to reveal depth.
            let wave=0.5+0.5*cos((time-enter)*2 * .pi/cloud.opacityPeriod+Double(cloud.index)*0.63+cloud.squeezePhase)
            let fade=cloud.opacityFloor+min(0.2,1-cloud.opacityFloor)*wave
            var opacity=gas ? 1-Self.smoothUnit((time-enter)/0.2)*(1-fade):1
            // The pointed gas6 layer softens before its captured exit boundary.
            if gas,cloud.index==5 {
                let exitBlend=Self.smoothUnit((time-(exit-0.12))/0.12)
                opacity += (min(opacity,0.4)-opacity)*exitBlend
            }
            let hold=gas ? Self.smoothUnit((time-settle-0.1)/0.18)*(1-Self.smoothUnit((time-exit)/0.13)):0
            let base=scale*(gas ? 0.7*(1+0.4*hold):1)
            cloud.view.alpha=CGFloat(min(1,max(0,alpha))*opacity)
            cloud.view.transform=CGAffineTransform(rotationAngle:rotation).scaledBy(x:CGFloat(base*(1+squeeze))*(variant == .flower ? 0.84:1),y:CGFloat(base*(1-squeeze))*(variant == .barell ? 1.4:1))
        }
        for (index,petal) in petals.enumerated() where !finishedPetals.contains(index) {
            if time<petal.plan.delay {if petal.view.alpha != 0 {petal.view.alpha=0};continue}
            let pose=NativeTntVariantPlanning.flowerPose(petal.plan,time:time)
            let extent=max(1,max(petal.view.bounds.width,petal.view.bounds.height))
            let scale=CGFloat(petal.plan.size*pose.scale)/extent
            petal.view.center=CGPoint(x:effectCenter.x+CGFloat(pose.x),y:effectCenter.y+CGFloat(pose.y));petal.view.alpha=CGFloat(pose.alpha)
            petal.view.transform=CGAffineTransform(rotationAngle:pose.rotation).scaledBy(x:scale,y:scale);petal.view.layer.zPosition=pose.depth
            if time>=petal.plan.delay+petal.plan.duration {finishedPetals.insert(index)}
        }
        for (index,item) in debris.enumerated() where !finishedDebris.contains(index) {
            if time<item.plan.delay {if item.view.alpha != 0 {item.view.alpha=0};continue}
            let plan=item.plan,p=min(1,max(0,(time-plan.delay)/plan.duration)),point=NativeTntVariantPlanning.point(plan,p)
            let extent=max(1,max(item.view.bounds.width,item.view.bounds.height))
            let scale=CGFloat(plan.size*item.sizeScale*NativeTntVariantPlanning.scale(plan,p))/extent
            item.view.center=CGPoint(x:effectCenter.x+CGFloat(point.0),y:effectCenter.y+CGFloat(point.1));item.view.alpha=CGFloat(min(1,p/0.12)*(1-max(0,(p-0.78)/0.22)))
            item.view.transform=CGAffineTransform(rotationAngle:plan.startRotation+plan.rotationTravel*(1-pow(1-p,2.35))).scaledBy(x:scale,y:scale)
            if time>=plan.delay+plan.duration {finishedDebris.insert(index)}
        }
    }
    /// Two finite samples of the same prepared originals; no additional clock.
    private func paintPalmUnit(_ unit:UIView,poses:[UIImageView],seconds time:Double,reverse:Bool) {
        let hold=NativeCoconutFinaleMotion.palmHoldExtension
        let visible=time>=0.07 && time<1.77+hold
        if unit.isHidden == visible {unit.isHidden = !visible}
        guard visible else {
            poses.forEach{($0 as? NativeCoconutPalmView)?.setBendingVisible(false)}
            return
        }
        let smooth:(Double)->Double={let p=min(1,max(0,$0));return p*p*(3-2*p)}
        let damping=1-smooth((time-1.10-hold)/0.67)
        let wave=sin(time * .pi*2/0.24)*damping,breath=sin(time * .pi*2/0.41)*damping
        let direction:Double=reverse ? -1:1
        unit.transform=CGAffineTransform(translationX:9*wave*direction,y:3*breath)
            .rotated(by:direction*NativeCoconutFinaleMotion.palmAngle(seconds:time))
            .scaledBy(x:1+0.09*breath,y:1-0.09*breath)
        let enter=min(1,max(0,(time-0.07)/0.24)),exit=smooth((time-1.40-hold)/0.37)
        let size=1.5*(reverse ? 1.10:1)*(0.75+0.25*NativeBoardMotion.Ease.backOut(2).sample(enter))*(1-exit)
        let starts:[Double]=[0.07,0.16,0.25,0.34,0.43,1.16+hold,1.28+hold,1.40+hold]
        for (index,view) in poses.enumerated() {
            // Crossfade neighbouring poses instead of snapping the final leaves.
            let fadeIn=index==0 ? 1:smooth((time-starts[index])/0.08)
            let fadeOut=index==7 ? 1:1-smooth((time-starts[index+1])/0.08)
            let alpha=fadeIn*fadeOut
            if view.alpha != alpha {view.alpha=alpha}
            (view as? NativeCoconutPalmView)?.setBendingVisible(alpha>0)
            guard view.alpha>0 else{continue}
            view.center=CGPoint(x:effectCenter.x+sin(time * .pi*2/0.17)*6*damping*direction,y:effectCenter.y)
            view.transform=CGAffineTransform(scaleX:size,y:size)
            (view as? NativeCoconutPalmView)?.bend(seconds:time,amplitude:damping)
        }
    }

    private func paintCoconuts(seconds time:Double) {
        guard let motion=coconutMotion else{return}
        if time>=0.07,receipts.insert("coconut-palm-shards").inserted {onCue?("coconut-palm-shards",1900+Int(NativeCoconutFinaleMotion.palmHoldExtension*1000))}
        if time>=(motion.whole.map(\.delay).min() ?? 0),receipts.insert("coconut-loop").inserted {onCue?("coconut-loop",Int(max(0,motion.endTime-time)*1000))}
        for contact in motion.contacts where time>=contact.time {
            if receipts.insert("coconut-contact-\(contact.id)").inserted {onCue?("coconut-contact",contact.id)}
        }
        for (i,flight) in motion.whole.enumerated() {
            let view=wholeCoconuts[i]
            let active=time>=flight.delay && time<flight.endTime
            let alpha:CGFloat=active ? 1:0
            if view.alpha != alpha {view.alpha=alpha}
            guard active else{continue}
            view.layer.zPosition = -0.25
            view.center=motion.position(flight,seconds:time)
            let scale=flight.size/max(1,max(view.bounds.width,view.bounds.height))
            let squash=motion.squash(body:i,seconds:time)
            view.transform=CGAffineTransform(scaleX:squash.x,y:squash.y).rotated(by:motion.rotation(body:i,seconds:time)).scaledBy(x:scale,y:scale)
        }
    }
    private static func smoothUnit(_ value:Double)->Double {
        let p=min(1,max(0,value));return p*p*(3-2*p)
    }
    private static func elastic(_ p:Double)->Double {
        func out(_ x:Double)->Double { x==0 ? 0:x==1 ? 1:pow(2,-10*x)*sin((x-0.0625)*(.pi*2/0.25))+1 }
        return p<0.5 ? (1-out(1-p*2))/2:0.5+out((p-0.5)*2)/2
    }
    override func start() { guard assetsReady else {dispose();return};super.start() }
    override func dispose() { guard !cancelled else{return};cancelled=true;boardReaction?.dispose();boardReaction=nil;if variant == .coconut {onCue?("coconut-stop",0)};if variant == .coconut {rearPalms.forEach{$0.retire();$0.removeFromSuperview()};rearPalms.removeAll();frontPalms.removeAll();palmUnit.subviews.forEach{($0 as? NativeCoconutPalmView)?.retire();($0 as? UIImageView)?.image=nil;$0.removeFromSuperview()};debris.forEach{($0.view as? UIImageView)?.image=nil;$0.view.removeFromSuperview()}};wholeCoconuts.forEach{($0 as? UIImageView)?.image=nil;$0.removeFromSuperview()};wholeCoconuts.removeAll();coconutMotion=nil;onSprite6Entered=nil;onVisualSequenceComplete=nil;clouds.removeAll();petals.removeAll();debris.removeAll();super.dispose() }
}
