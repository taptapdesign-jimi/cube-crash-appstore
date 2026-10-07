import UIKit

/// Flower's layered canopy/petal flight and Barrel's smoke/wood/die flight.
/// The frame-six receipt releases the scene's captured board-return plan;
/// this owner never decides targets, replacements, score or input admission.
@MainActor
final class NativeTntVariantPresentation: NativeFinitePresentation {
    enum Variant: String { case flower,barell }
    var onSprite6Entered: (() -> Void)?
    var onVisualSequenceComplete: (() -> Void)?
    private(set) var assetsReady = false
    private struct Cloud { let view: UIImageView,index: Int,size: Double,bounce: Double,y: Double,rotation: Double }
    private struct Petal { let view: UIImageView,plan: NativeTntVariantPlanning.Flower }
    private struct Debris { let view: UIView,plan: NativeTntFinale.DiePlan,sizeScale: Double }
    private let variant: Variant
    private let glyphs: NativeSplashGlyphField
    private let effectCenter: CGPoint
    private var clouds: [Cloud] = [],petals: [Petal] = [],debris: [Debris] = []
    private var receipts = Set<String>()
    private var cancelled = false
    static func assets(_ variant: Variant) -> [String] {
        if variant == .flower {
            return (1...9).map { "assets/shop/bush/bush\($0)@2x.png" }+(1...6).map { "assets/shop/bush/flowr\($0)@2x.png" }
        }
        return (1...12).map { "assets/shop/explosion pack/animation/tnt\($0)@2x.png" }+(1...6).map { "assets/shop/barell/wood\($0).png" }+["assets/tile.png"]
    }
    init(resourceRoot: URL,variant: Variant,viewport: CGSize,random: @escaping () -> Double = { Double.random(in:0..<1) }) {
        self.variant = variant; effectCenter = CGPoint(x:viewport.width/2,y:viewport.height/2)
        let artwork = JimiV9Artwork(resourceRoot:resourceRoot)
        let colors: [UIColor] = variant == .flower ? [UIColor(red:1,green:254.0/255,blue:250.0/255,alpha:1),UIColor(red:254.0/255,green:248.0/255,blue:234.0/255,alpha:1)] : [UIColor(red:244.0/255,green:141.0/255,blue:89.0/255,alpha:1)]
        glyphs = NativeSplashGlyphField(artwork:artwork,text:variant == .flower ? "BLOOMING!":"POOOF",colors:colors,splitIndex:variant == .flower ? 3.5:0,letterOpacityRange:variant == .barell ? 1...1:nil,random:random)
        super.init(viewport:viewport,duration:4.2)
        accessibilityIdentifier = "native-\(variant.rawValue)-finale"
        assetsReady = Self.assets(variant).allSatisfy { artwork.image($0.replacingOccurrences(of:"@2x.png",with:".png"),densityAware:true) != nil }
        // Source native-skin burst/debris is allocated before the smoke clock.
        if variant == .flower {
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
        for index in 0..<(variant == .flower ? 9:12) {
            let path = variant == .flower ? "assets/shop/bush/bush\(index+1).png":"assets/shop/explosion pack/animation/tnt\(index+1).png"
            let view=UIImageView(image:artwork.image(path,densityAware:true));setNaturalBounds(view);view.center=effectCenter;view.alpha=0;view.layer.zPosition=CGFloat(index)
            let rotation=(random()-0.5)*20 * .pi/180
            view.transform=CGAffineTransform(rotationAngle:rotation);addSubview(view)
            let size=(1+random()*0.52)*(variant == .flower ? 0.9775:1)
            clouds.append(Cloud(view:view,index:index,size:size,bounce:size*(1.02+random()*0.06),y:(random()-0.5)*4,rotation:rotation))
        }
        glyphs.frame=bounds;glyphs.layer.zPosition=100;addSubview(glyphs)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    private func setNaturalBounds(_ view: UIImageView) { view.bounds=CGRect(origin:.zero,size:view.image?.size ?? .zero);view.contentMode = .scaleToFill }
    private func fire(_ name:String,_ callback:(() -> Void)?) { if receipts.insert(name).inserted { callback?() } }
    override func paint(seconds time: TimeInterval) {
        guard !cancelled,assetsReady else { return }
        glyphs.paint(seconds:time)
        if time>=0.51 { fire("frame6",onSprite6Entered) }
        let sequenceEnd=1.01+Double(clouds.count-1)*0.04+0.30
        if time>=sequenceEnd {
            if variant == .flower,receipts.insert("spark").inserted { onCue?("spark",0) }
            fire("sequence",onVisualSequenceComplete)
        }
        if variant == .barell,time>=0.91,receipts.insert("poof").inserted { onCue?("smoke",0) }
        if variant == .flower,time>=sequenceEnd*0.9,receipts.insert("leaves").inserted { onCue?("leaves",0) }
        for cloud in clouds {
            let enter=0.07+Double(cloud.index)*0.04,settle=enter+0.24,exit=1.01+Double(cloud.index)*0.04
            if time<enter { continue }
            if time>=exit+0.30 || (variant == .flower && cloud.index<2 && time>=1.01) { cloud.view.alpha=0;continue }
            var scale:Double=0,alpha:Double=1,y:Double=0
            if time<settle { let p=Double(NativeBoardMotion.Ease.backOut(2).sample((time-enter)/0.24));scale=cloud.size*1.2*p;alpha=p }
            else if time<settle+0.1 { let p=Double(NativeBoardMotion.Ease.power2Out.sample((time-settle)/0.1));scale=cloud.size*(1.2-0.2*p) }
            else {
                let phase=max(0,min(time,exit)-settle-0.1).truncatingRemainder(dividingBy:0.8)/0.4
                let p=Self.elastic(phase<=1 ? phase:2-phase)
                scale=cloud.size+(cloud.bounce-cloud.size)*p;y=cloud.y*p
                if time>=exit+0.13 { let p=Double(NativeBoardMotion.Ease.backIn(2).sample((time-exit-0.13)/0.17));scale *= 1-p;alpha=1-p }
            }
            cloud.view.center=CGPoint(x:effectCenter.x,y:effectCenter.y+CGFloat(y));cloud.view.alpha=CGFloat(min(1,max(0,alpha)))
            cloud.view.transform=CGAffineTransform(rotationAngle:cloud.rotation).scaledBy(x:CGFloat(scale)*(variant == .flower ? 0.84:1),y:CGFloat(scale)*(variant == .flower ? 1:1.4))
        }
        for petal in petals {
            let pose=NativeTntVariantPlanning.flowerPose(petal.plan,time:time)
            let extent=max(1,max(petal.view.bounds.width,petal.view.bounds.height))
            let scale=CGFloat(petal.plan.size*pose.scale)/extent
            petal.view.center=CGPoint(x:effectCenter.x+CGFloat(pose.x),y:effectCenter.y+CGFloat(pose.y));petal.view.alpha=CGFloat(pose.alpha)
            petal.view.transform=CGAffineTransform(rotationAngle:pose.rotation).scaledBy(x:scale,y:scale);petal.view.layer.zPosition=pose.depth
        }
        for item in debris {
            let plan=item.plan,p=min(1,max(0,(time-plan.delay)/plan.duration)),point=NativeTntVariantPlanning.point(plan,p)
            let extent=max(1,max(item.view.bounds.width,item.view.bounds.height))
            let scale=CGFloat(plan.size*item.sizeScale*NativeTntVariantPlanning.scale(plan,p))/extent
            item.view.center=CGPoint(x:effectCenter.x+CGFloat(point.0),y:effectCenter.y+CGFloat(point.1));item.view.alpha=CGFloat(min(1,p/0.12)*(1-max(0,(p-0.78)/0.22)))
            item.view.transform=CGAffineTransform(rotationAngle:plan.startRotation+plan.rotationTravel*(1-pow(1-p,2.35))).scaledBy(x:scale,y:scale)
        }
    }
    private static func elastic(_ p:Double)->Double {
        func out(_ x:Double)->Double { x==0 ? 0:x==1 ? 1:pow(2,-10*x)*sin((x-0.0625)*(.pi*2/0.25))+1 }
        return p<0.5 ? (1-out(1-p*2))/2:0.5+out((p-0.5)*2)/2
    }
    override func start() { guard assetsReady else {dispose();return};super.start() }
    override func dispose() { guard !cancelled else{return};cancelled=true;onSprite6Entered=nil;onVisualSequenceComplete=nil;clouds.removeAll();petals.removeAll();debris.removeAll();super.dispose() }
}
