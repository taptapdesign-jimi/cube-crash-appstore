import SpriteKit

/// One finite SpriteKit screen-blend renderer for the source core Star field.
/// UIKit glyphs sample this same clock, with no independent presentation timer.
@MainActor
final class NativeStarFinale: SKNode {
    var onGlyphClock: ((TimeInterval,Bool) -> Void)?
    let duration: TimeInterval
    private let particles: [(SKSpriteNode,NativeStarBurstMotion.Plan)]
    private let viewport: CGSize
    private var retired = Set<Int>(),disposed = false
    init(textures: NativeBoardTextures,viewport: CGSize,random: () -> Double = { Double.random(in: 0..<1) }) {
        self.viewport = viewport
        let plans = NativeStarBurstMotion.make(viewport: viewport,random: random)
        duration = max(2.15,max(1.2,(plans.map(\.end).max() ?? 0)+0.45)+0.05)
        let texture = textures.texture("assets/small-star.png")
        particles = plans.map { plan in
            let sprite = SKSpriteNode(texture: texture)
            let dimensions = texture?.size() ?? CGSize(width: 1,height: 1),ratio = plan.size/max(1,max(dimensions.width,dimensions.height))
            sprite.size = CGSize(width: dimensions.width*ratio,height: dimensions.height*ratio)
            sprite.blendMode = .screen; sprite.alpha = 0
            return (sprite,plan)
        }
        super.init(); name = "native-core-star-finale"
        particles.forEach { addChild($0.0) }
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    private var completion: (() -> Void)?
    func play(completion: @escaping () -> Void) {
        guard !disposed,self.completion == nil else { return }
        self.completion = completion
        run(.sequence([.customAction(withDuration: duration) { [weak self] _,elapsed in self?.paint(seconds: Double(elapsed)) },
            .run { [weak self] in guard let self,!self.disposed else { return }; self.dispose() }]),withKey: "star-field")
    }
    private func paint(seconds: TimeInterval) {
        guard !disposed else { return }
        onGlyphClock?(seconds,false)
        for (index,particle) in particles.enumerated() where !retired.contains(index) {
            let (sprite,plan) = particle
            if seconds >= plan.end { sprite.alpha = 0; retired.insert(index); continue }
            let pose = plan.sample(seconds: seconds)
            sprite.position = CGPoint(x: pose.point.x,y: viewport.height-pose.point.y)
            sprite.setScale(pose.scale); sprite.alpha = pose.alpha; sprite.zRotation = -pose.rotation * .pi/180
        }
    }
    func dispose() {
        guard !disposed else { return }; disposed = true
        removeAllActions(); removeFromParent(); onGlyphClock?(duration,true); onGlyphClock = nil
        removeAllChildren()
        let finished = completion; completion = nil; finished?()
    }
}

/// One Scene/Scope registry owns the literal shared gsap.ticker listener.
/// Individual halos retain finite intro roots and original local artwork.
@MainActor final class NativeSourceStarHaloTicker:NativeSourceTickerParticipant {
    private final class Record {weak var node:NativeSourceStarHaloPresentation?;init(_ node:NativeSourceStarHaloPresentation){self.node=node}}
    private let service:NativeSourceAnimationClockService,generation:UInt64,current:()->Bool,performanceNow:()->Double
    private let beginRendering:()->(()->Void)?
    private var releaseRendering:(()->Void)?
    private var lease:NativeSourceAnimationClockService.SourceTickerLease?,records:[UInt64:Record]=[:],sequence:UInt64=0,disposed=false
    init(service:NativeSourceAnimationClockService,generation:UInt64,current:@escaping()->Bool,performanceNow:@escaping()->Double,beginRendering:@escaping()->(()->Void)?={nil}){self.service=service;self.generation=generation;self.current=current;self.performanceNow=performanceNow;self.beginRendering=beginRendering}
    var count:Int{records.values.filter{$0.node != nil}.count}
    @discardableResult func add(_ node:NativeSourceStarHaloPresentation)->Bool {
        guard !disposed,current(),node.parent != nil,!records.values.contains(where:{$0.node === node}) else{return false}
        sequence &+= 1;let id=sequence;records[id]=Record(node)
        if lease==nil {
            let candidate=service.registerSourceTickerListener(ownerID:"wild-star-shared-ticker",generation:generation,participant:self,cleanup:{[weak self] in self?.transportRetired()})
            guard !disposed,records[id]?.node === node,let candidate,candidate.active else{records.removeValue(forKey:id);return false}
            lease=candidate
        }
        if releaseRendering==nil {
            let release=beginRendering()
            guard !disposed,current(),records[id]?.node === node else{release?();return false}
            releaseRendering=release
        }
        return !disposed && records[id]?.node === node
    }
    func remove(_ node:NativeSourceStarHaloPresentation){
        for id in records.keys.filter({records[$0]?.node == nil || records[$0]?.node === node}){records.removeValue(forKey:id)}
        if records.isEmpty{retireRendering();let old=lease;lease=nil;old?.cancel()}
    }
    func advanceSourceTicker(seconds:Double,deltaMilliseconds:Double,frame:UInt64){
        guard !disposed,current() else{dispose();return}
        // Live insertion ordering matches activeSystems Set iteration.
        var visited:UInt64=0
        while !disposed,let id=records.keys.filter({$0>visited}).min(){
            visited=id;guard current() else{dispose();return}
            guard let node=records[id]?.node else{records.removeValue(forKey:id);continue}
            let now=performanceNow();guard !disposed,current(),records[id]?.node === node else{continue}
            node.tick(performanceMilliseconds:now)
        }
        if records.isEmpty{retireRendering();let old=lease;lease=nil;old?.cancel()}
    }
    private func retireRendering(){let release=releaseRendering;releaseRendering=nil;release?()}
    private func transportRetired(){lease=nil;retireRendering();let nodes=records.values.compactMap(\.node);records.removeAll();nodes.forEach{$0.dispose()}}
    func dispose(){guard !disposed else{return};disposed=true;retireRendering();let old=lease;lease=nil;let nodes=records.values.compactMap(\.node);records.removeAll();old?.cancel();nodes.forEach{$0.dispose()}}
    isolated deinit{dispose()}
}

/// Ready-texture SpriteKit branch. Native count-before-assets/texture loading,
/// captured host metrics and exact above-HUD foreground projection belong to
/// the genuine caller; this renderer never invents them or draws Math.
@MainActor final class NativeSourceStarHaloPresentation:SKNode {
    private final class Intro:NativeSourceAnimationParticipant {
        weak var owner:NativeSourceStarHaloPresentation?;let index:Int
        init(_ owner:NativeSourceStarHaloPresentation,_ index:Int){self.owner=owner;self.index=index}
        func advanceSourceAnimation(seconds:TimeInterval){owner?.paintIntro(index:index,seconds:seconds)}
    }
    private let service:NativeSourceAnimationClockService,generation:UInt64,current:()->Bool,paintable:()->Bool,metrics:()->CGSize
    private weak var ticker:NativeSourceStarHaloTicker?
    private var foreground:NativeSourceStarHaloForeground?
    private var field:NativeSourceStarHaloMotion.Field,sprites:[SKNode]=[],intros:[Int:(Intro,NativeSourceAnimationClockService.Lease)]=[:],disposed=false,visibleForIntro=true
    var starCount:Int{sprites.count}
    var isDisposed:Bool{disposed}
    var capturedGeneration:UInt64{generation}
    struct CapturedStar {let texture:SKTexture;let position:CGPoint;let scale:CGPoint}
    struct Capture {let stars:[CapturedStar];let systemCount:Int}
    /// Original EARLY snapshot retains texture/value poses, never sprite objects.
    func captureForMerge(in stage:SKScene)->Capture? {
        guard admitted(),scene === stage else{return nil}
        let captured=sprites.compactMap {node->CapturedStar? in
            guard let sprite=node as? SKSpriteNode,let texture=sprite.texture else{return nil}
            return CapturedStar(texture:texture,position:sprite.convert(CGPoint.zero,to:stage),scale:.init(x:sprite.xScale,y:sprite.yScale))
        }
        return Capture(stars:captured,systemCount:sprites.count)
    }
    var paintedPoses:[NativeSourceStarHaloMotion.Pose]{field.stars.map(\.pose)}
    init?(stars:[NativeSourceStarHaloMotion.Star],texture:SKTexture?,introBounce:Bool,performanceMilliseconds:Double,
        service:NativeSourceAnimationClockService,generation:UInt64,current:@escaping()->Bool,
        paintable:@escaping()->Bool,metrics:@escaping()->CGSize){
        guard (1...3).contains(stars.count),generation>0,current(),performanceMilliseconds.isFinite else{return nil}
        guard texture != nil || stars.allSatisfy({$0.normalizer==1}) else{return nil}
        self.service=service;self.generation=generation;self.current=current;self.paintable=paintable;self.metrics=metrics
        field = .init(stars:stars,lastUpdate:performanceMilliseconds-1000/60,introBounce:introBounce)
        super.init();name="native-source-wild-star-orbit"
        for _ in stars {
            let display:SKNode
            if let texture {
                let sprite=SKSpriteNode(texture:texture);sprite.name="wild-baby-star";sprite.anchorPoint = .init(x:0.5,y:0.5)
                // Installed Pixi numeric blendMode 1 falls back to normal.
                sprite.setScale(1);sprite.size=texture.size();sprite.blendMode = .alpha;display=sprite
            } else {
                let path=CGMutablePath()
                for index in 0..<10 {
                    let radius:Double=index % 2 == 0 ? 28:14,angle=Double(index)*Double.pi/5-Double.pi/2
                    let point=CGPoint(x:radius*cos(angle),y:-radius*sin(angle))
                    if index==0 {path.move(to:point)} else {path.addLine(to:point)}
                }
                path.closeSubpath()
                let shape=SKShapeNode(path:path);shape.name="wild-baby-star-placeholder"
                shape.fillColor=UIColor(red:1,green:231/255,blue:181/255,alpha:1);shape.lineWidth=0;display=shape
            }
            sprites.append(display);addChild(display)
        }
        paintSprites()
    }
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    @discardableResult func mountAboveHUD(host:SKNode,layer:SKNode,artworkZIndex:CGFloat=0)->Bool {
        guard admitted(),foreground==nil,
            let owner=NativeSourceStarHaloForeground(orbit:self,host:host,layer:layer,artworkZIndex:artworkZIndex) else{return false}
        foreground=owner;return true
    }
    @discardableResult func start(ticker:NativeSourceStarHaloTicker)->Bool {
        guard admitted(),parent != nil,self.ticker==nil else{return false};self.ticker=ticker
        guard ticker.add(self),admitted() else{dispose();return false};return true
    }
    private func admitted()->Bool{guard !disposed else{return false};let ok=current();return ok && !disposed}
    fileprivate func tick(performanceMilliseconds:Double){
        guard admitted(),parent != nil else{dispose();return}
        let projected=foreground?.sync() ?? true
        let visible=projected && paintable();guard admitted() else{dispose();return}
        if visibleForIntro != visible{visibleForIntro=visible;for entry in Array(intros.values){entry.1.setSuspended(!visible)}}
        let size=visible ? metrics():.zero;guard admitted() else{dispose();return}
        let starts=field.tick(now:performanceMilliseconds,paintable:visible,width:Double(size.width),height:Double(size.height))
        paintSprites()
        for index in starts {
            guard admitted() else{dispose();return}
            let painter=Intro(self,index)
            guard let lease=service.register(participant:painter,duration:0.48,domain:.sourceGSAP(.timeline),cleanup:{[weak self] _ in self?.intros.removeValue(forKey:index)}) else{dispose();return}
            guard admitted(),lease.active else{lease.cancel();dispose();return};intros[index]=(painter,lease)
        }
    }
    private func paintIntro(index:Int,seconds:Double){guard admitted(),parent != nil else{dispose();return};field.paintIntro(index:index,seconds:seconds);paintSprites()}
    private func paintSprites(){
        guard !disposed else{return}
        for index in sprites.indices {
            let pose=field.stars[index].pose,sprite=sprites[index]
            sprite.position = .init(x:pose.x,y:-pose.y);sprite.zRotation = -pose.rotation
            sprite.setScale(pose.scale);sprite.alpha=pose.alpha
        }
    }
    func dispose(){guard !disposed else{return};disposed=true;let old=ticker;ticker=nil;old?.remove(self)
        let oldForeground=foreground;foreground=nil;oldForeground?.dispose()
        let roots=Array(intros.values);intros.removeAll();roots.forEach{$0.1.cancel()};sprites.removeAll();removeAllChildren();removeFromParent()}
    isolated deinit{dispose()}
}

/// Projects the existing orbit above HUD without cloning its children. Two
/// rotations and signed scales preserve affine shear from nested host branches.
typealias NativeSourceStarHaloForeground = NativeSourceAnimatedDiceForeground

/// Shared captured projection for authored sheets and their orbit. One Scene
/// layer; two native rotations preserve even nonuniform reflected ancestry.
@MainActor final class NativeSourceAnimatedDiceForeground {
    private weak var host:SKNode?,layer:SKNode?,displayObject:SKNode?
    private let outer=SKNode(),inner=SKNode()
    private var disposed=false
    private let current:()->Bool
    convenience init?(orbit:NativeSourceStarHaloPresentation,host:SKNode,layer:SKNode,artworkZIndex:CGFloat=0) {
        self.init(displayObject:orbit,host:host,layer:layer,name:"wild-star-orbit-foreground",
            zPosition:max(2600,artworkZIndex)+1,current:{[weak orbit] in orbit?.isDisposed == false})
    }
    init?(displayObject:SKNode,host:SKNode,layer:SKNode,name:String,zPosition:CGFloat,current:@escaping()->Bool) {
        guard let scene=host.scene,layer.scene === scene,current() else{return nil}
        self.host=host;self.layer=layer;self.displayObject=displayObject;self.current=current
        outer.name=name;outer.zPosition=zPosition
        outer.addChild(inner);layer.addChild(outer);displayObject.removeFromParent();inner.addChild(displayObject)
        _ = sync()
    }
    @discardableResult func sync()->Bool {
        guard !disposed,let host,let layer,let scene=host.scene,layer.scene === scene,
            let displayObject,displayObject.parent === inner,current() else{outer.isHidden=true;return false}
        var alpha:CGFloat=1,visible=true,cursor:SKNode?=host
        while let node=cursor,node !== scene {alpha *= node.alpha;visible = visible && !node.isHidden;cursor=node.parent}
        outer.alpha=alpha;outer.isHidden = cursor !== scene || !visible || alpha<=0
        guard !outer.isHidden else{return false}
        let origin=host.convert(CGPoint.zero,to:layer),x=host.convert(CGPoint(x:1,y:0),to:layer),y=host.convert(CGPoint(x:0,y:1),to:layer)
        let a=x.x-origin.x,b=x.y-origin.y,c=y.x-origin.x,d=y.y-origin.y
        let sumAngle=atan2(b-c,a+d),differenceAngle=atan2(b+c,a-d)
        outer.position=origin;outer.zRotation=(sumAngle+differenceAngle)/2
        outer.xScale=(hypot(a+d,b-c)+hypot(a-d,b+c))/2
        outer.yScale=(hypot(a+d,b-c)-hypot(a-d,b+c))/2
        inner.zRotation=(sumAngle-differenceAngle)/2
        return true
    }
    func dispose(restoring:Bool=true){
        guard !disposed else{return};disposed=true
        if restoring,current(),let displayObject,displayObject.parent === inner,let host {displayObject.removeFromParent();host.addChild(displayObject)}
        outer.removeFromParent();outer.removeAllChildren();inner.removeAllChildren()
        host=nil;layer=nil;displayObject=nil
    }
    isolated deinit{dispose()}
}
