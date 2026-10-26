import UIKit

/// Four crossfaded hero frames, six direction-stable Honey bees, and forty-two
/// authored gravity leaves share one finite visible clock.
@MainActor
final class NativeBeeFinalePresentation: NativeFinitePresentation {
    var onHaptic:((String)->Void)?
    let assetReady:Bool
    private let kite:Bool
    private let flagAngles:[Double]
    private let kiteMotion:NativeKiteFinaleMotion?
    private let backgroundPlans:[NativeKiteBackgroundPlan]
    private let route:NativeBeeFinaleMotion,leaves:[NativeBeeLeafPlan],glyphs:NativeSplashGlyphField
    private let field=UIView(),hero=UIView()
    private var heroFrames:[UIImageView]=[],leafHosts:[UIView]=[],leafImages:[UIImageView]=[]
    private struct AmbientOwner {let host:UIView,frames:[UIImageView];var current=0,previous:Int?,pending:Int?,pendingSeconds=0.0,blendSeconds=0.08}
    private var ambient:[AmbientOwner]=[]
    private static let hapticBeats:[(key:String,at:Double)] = {
        let early=(0..<7).map {Double($0)*0.095}
        let late=(0..<6).map {1.0+Double($0)*0.11}
        return (early+late).enumerated().map {("haptic-\($0.offset)",$0.element)}
    }()
    private var facing=1,candidateFacing=1,candidateSince=0.0,priorTime=0.0,cancelled=false,receipts=Set<String>()
    init(resourceRoot:URL,viewport:CGSize,origin:CGPoint?,preparedArtwork:JimiV9Artwork?=nil,kite:Bool=false,random:()->Double={Double.random(in:0..<1)}) {
        self.kite=kite
        let roll=random(),phase=(roll.isFinite ? min(1-Double.ulpOfOne,max(0,roll)):0.5)*2 * .pi
        route=NativeBeeFinaleMotion(width:Double(viewport.width),height:Double(viewport.height),origin:origin.map {NativeBeeFinaleMotion.Point(x:Double($0.x),y:Double($0.y))},seed:phase)
        let kiteMotion=kite ? NativeKiteFinaleMotion(route:route,random:random):nil
        self.kiteMotion=kiteMotion
        let backgrounds:[NativeKiteBackgroundPlan]
        if let kiteMotion {
            backgrounds=(0..<2).map {NativeKiteBackgroundPlan(main:kiteMotion,width:Double(viewport.width),height:Double(viewport.height),flagCount:8,index:$0,random:random)}
        }else {backgrounds=[]}
        backgroundPlans=backgrounds
        var plans=NativeBeeLeafPlan.make(route:route,heroPosition:kiteMotion.map{motion in {motion.sample(seconds:$0).point}},emissionEnd:kite ? 3.15:2.9,retireAt:kite ? NativeKiteFinaleMotion.flightDuration:3.86)
        if let kiteMotion {
            let secondRoute=NativeBeeFinaleMotion(width:Double(viewport.width),height:Double(viewport.height),origin:origin.map{.init(x:Double($0.x),y:Double($0.y))},seed:phase+1.7)
            plans += NativeBeeLeafPlan.make(route:secondRoute,heroPosition:{kiteMotion.sample(seconds:$0).point},emissionEnd:3.15,retireAt:NativeKiteFinaleMotion.flightDuration)
        }
        let mainLeaves=kite ? plans.map {plan in
            let index=1+min(1,max(0,Int(random()*2)))
            let main=kiteMotion!,pose=main.sample(seconds:plan.motion.birth)
            let origin=NativeKiteFinaleMotion.flagOrigin(pose:pose,size:NativeKiteFinaleMotion.heroSize,stretch:main.stretch(seconds:plan.motion.birth))
            let motion=NativeKiteFlagMotion.make(from:plan.motion,origin:origin,viewportHeight:Double(viewport.height))
            return NativeBeeLeafPlan(source:"assets/shop/kite/zastavica\(index+1).png",width:plan.width*0.6,height:plan.height*0.6,front:plan.front,motion:motion)
        }:plans
        var extraLeaves:[NativeBeeLeafPlan]=[]
        for plan in backgrounds {
            var flagOrder=[1,2,3,4]
            for i in stride(from:3,through:1,by:-1) {let draw=random();flagOrder.swapAt(i,min(i,max(0,Int((draw.isFinite ? draw:0.5)*Double(i+1)))))}
            for index in 0..<plan.flagCount {
                let birth=plan.delay+0.6+Double(index)*0.3+random()*0.075
                let pose=plan.sample(seconds:birth),point=NativeKiteFinaleMotion.flagOrigin(pose:pose,size:plan.size,stretch:plan.stretch(seconds:birth)),life=min(1.5,NativeKiteBackgroundPlan.flightDuration-birth)
                let reference=mainLeaves[(plan.index*plan.flagCount+index)%mainLeaves.count]
                let motion=NativeBeeLeafMotion(birth:birth,lifetime:life,birthX:point.x,birthY:point.y,velocityX:-plan.side*(24+random()*30),velocityY:15,gravity:NativeBeeLeafMotion.gravity(viewportHeight:Double(viewport.height),birthY:point.y,velocityY:15,lifetime:life),flutter:random()*6,spin:(random()-0.5)*180,scale:reference.motion.scale,peakOpacity:0.9)
                extraLeaves.append(.init(source:"assets/shop/kite/zastavica\(flagOrder[index%4]).png",width:reference.width*0.5,height:reference.height*0.5,front:true,motion:NativeKiteFlagMotion.make(from:motion,origin:point,viewportHeight:Double(viewport.height))))
            }
        }
        leaves=mainLeaves+extraLeaves
        flagAngles=kite ? leaves.map{_ in random()*360}:Array(repeating:0,count:plans.count)
        let artwork=preparedArtwork ?? JimiV9Artwork(resourceRoot:resourceRoot)
        glyphs=NativeSplashGlyphField(artwork:artwork,text:kite ? "FLY AWAY":"WEEEE!",colors:kite ? [UIColor(red:143.0/255,green:213.0/255,blue:147.0/255,alpha:1),UIColor(red:223.0/255,green:235.0/255,blue:137.0/255,alpha:1)]:[UIColor(red:219.0/255,green:118.0/255,blue:84.0/255,alpha:1),UIColor(red:1,green:217.0/255,blue:120.0/255,alpha:1)],splitIndex:3,letterOpacityRange:1...1,random:random)
        let paths=kite ? NativeKiteArt.assets:(1...4).map {"assets/shop/bee/bee\($0).png"}+(1...6).map {"assets/shop/bee/leaf\($0).png"}+["assets/shop/honey/bee1.png","assets/shop/honey/bee3.png"]
        assetReady=paths.allSatisfy {artwork.image($0,densityAware:true) != nil}
        super.init(viewport:viewport,duration:max(kite ? NativeKiteBackgroundPlan.flightDuration:4.0,glyphs.duration)+0.05)
        clipsToBounds=true;accessibilityIdentifier=kite ? "native-kite-finale":"native-bee-finale"
        field.frame=bounds;field.isUserInteractionEnabled=false;addSubview(field)
        let width=kite ? CGFloat(NativeKiteFinaleMotion.heroSize):min(viewport.width*0.322,141.4)
        hero.bounds=CGRect(x:0,y:0,width:width,height:width);hero.layer.anchorPoint=kite ? CGPoint(x:0.5,y:0.5):CGPoint(x:0.6,y:0.52);hero.layer.zPosition=2;field.addSubview(hero)
        for index in 1...(kite ? 1:4) {
            let image=UIImageView(image:artwork.image(kite ? NativeKiteArt.path:"assets/shop/bee/bee\(index).png",densityAware:true));image.frame=hero.bounds;image.contentMode = kite ? .scaleToFill:.scaleAspectFit;hero.addSubview(image);heroFrames.append(image)
        }
        for (index,leaf) in leaves.enumerated() {
            let host=UIView(frame:CGRect(x:0,y:0,width:leaf.width,height:leaf.height)),image=UIImageView(image:artwork.image(leaf.source,densityAware:true))
            let companionFlag=kite && index>=plans.count
            if companionFlag {host.accessibilityIdentifier="native-kite-companion-flag-\(index-plans.count)"}
            host.isUserInteractionEnabled=false;host.layer.zPosition=companionFlag ? 5:1;host.alpha=0;image.frame=host.bounds;image.contentMode = .scaleAspectFit;host.addSubview(image);field.addSubview(host);leafHosts.append(host);leafImages.append(image)
        }
        for index in 0..<(kite ? backgrounds.count:NativeBeeFinaleMotion.ambient.count) {
            let size=kite ? backgrounds[index].size:42*1.5*NativeBeeFinaleMotion.ambient[index].scale,host=UIView(frame:CGRect(x:0,y:0,width:size,height:size));host.layer.zPosition=4;if kite {host.accessibilityIdentifier="native-kite-background-\(index)"};field.addSubview(host)
            let frames=(kite ? [1]:[1,3]).map {frameIndex->UIImageView in let image=UIImageView(image:artwork.image(kite ? NativeKiteArt.backgroundPath:"assets/shop/honey/bee\(frameIndex).png",densityAware:true));image.frame=host.bounds;image.contentMode = kite ? .scaleToFill:.scaleAspectFit;host.addSubview(image);return image}
            ambient.append(AmbientOwner(host:host,frames:frames))
        }
        glyphs.frame=bounds;addSubview(glyphs)
        if kite {hero.accessibilityIdentifier="native-kite-hero";hero.removeFromSuperview();addSubview(hero);glyphs.layer.zPosition=3;bringSubviewToFront(glyphs)}
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    override func start() {guard assetReady else {dispose();return};super.start()}
    private func fire(_ key:String,_ callback:()->Void) {if receipts.insert(key).inserted {callback()}}
    private func rounded(_ value:Double,_ digits:Int)->CGFloat {CGFloat(NativeFinaleDecimal.rounded(value,digits:digits))}
    override func paint(seconds time:TimeInterval) {
        guard !cancelled,assetReady else {return}
        let t=min(kite ? NativeKiteFinaleMotion.flightDuration:4,time),pose=kiteMotion?.sample(seconds:t) ?? route.sample(seconds:t,hovering:true),delta=max(0,t-priorTime);priorTime=t
        if pose.facing != facing {
            if pose.facing != candidateFacing {candidateFacing=pose.facing;candidateSince=0}
            else {candidateSince+=delta;if candidateSince>=0.05 {facing=candidateFacing}}
        } else {candidateFacing=facing;candidateSince=0}
        let blends=NativeBeeFinaleMotion.idleBlend(seconds:t)
        for index in heroFrames.indices {heroFrames[index].alpha=kite ? 1:rounded(blends[index],4);if kite {NativeKiteArt.paint(heroFrames[index],seconds:t,canvas:hero.bounds,fillsCanvas:true,driftStrength:0)}}
        hero.layer.position=CGPoint(x:rounded(pose.point.x,2)+(kite ? 0:hero.bounds.width*0.1),y:rounded(pose.point.y,2)+(kite ? 0:hero.bounds.height*0.02))
        let bank=pose.rotation
        let stretch=kiteMotion?.stretch(seconds:t) ?? (x:1.0,y:1.0)
        hero.transform=CGAffineTransform(rotationAngle:rounded(bank,2) * .pi/180).scaledBy(x:rounded(pose.scale*stretch.x*Double(kite ? pose.facing:facing),4),y:rounded(pose.scale*stretch.y,4))
        for index in ambient.indices {
            if kite {
                let plan=backgroundPlans[index],sample=plan.sample(seconds:time),host=ambient[index].host
                let local=max(0,time-plan.delay)
                host.isHidden=time<plan.delay
                NativeKiteArt.paint(ambient[index].frames[0],seconds:local,canvas:host.bounds,fillsCanvas:true,driftStrength:0,background:true,previousHero:false)
                host.center=CGPoint(x:sample.point.x,y:sample.point.y)
                let stretch=plan.stretch(seconds:time)
                host.transform=CGAffineTransform(rotationAngle:sample.rotation * .pi/180).scaledBy(x:Double(sample.facing)*sample.scale*stretch.x,y:sample.scale*stretch.y)
                continue
            }
            let sample=route.sampleAmbient(NativeBeeFinaleMotion.ambient[index],seconds:t,hovering:true)
            let candidate=abs(sample.vx)<0.01 || !sample.vx.isFinite ? ambient[index].current:sample.vx<0 ? 1:0
            if candidate==ambient[index].current {ambient[index].pending=nil;ambient[index].pendingSeconds=0}
            else if candidate != ambient[index].pending {ambient[index].pending=candidate;ambient[index].pendingSeconds=0}
            else {
                ambient[index].pendingSeconds+=delta
                if ambient[index].pendingSeconds>=0.05 {ambient[index].previous=ambient[index].current;ambient[index].current=candidate;ambient[index].pending=nil;ambient[index].pendingSeconds=0;ambient[index].blendSeconds=0}
            }
            ambient[index].blendSeconds=min(0.08,ambient[index].blendSeconds+delta)
            let blend=NativeBeeFinaleMotion.clamp(ambient[index].blendSeconds/0.08)
            for frame in ambient[index].frames.indices {ambient[index].frames[frame].alpha=rounded(frame==ambient[index].current ? blend:frame==ambient[index].previous ? 1-blend:0,4)}
            if blend>=1 {ambient[index].previous=nil}
            ambient[index].host.layer.position=CGPoint(x:rounded(sample.point.x,2),y:rounded(sample.point.y,2))
            ambient[index].host.transform=CGAffineTransform(rotationAngle:rounded(sample.rotation,2) * .pi/180).scaledBy(x:rounded(sample.scaleX,3),y:rounded(sample.scaleY,3))
        }
        for index in leaves.indices {
            let pose=leaves[index].motion.sample(seconds:time),host=leafHosts[index],image=leafImages[index]
            host.isHidden = !pose.visible;guard pose.visible else {continue}
            host.alpha=rounded(pose.opacity,3);host.layer.position=CGPoint(x:rounded(pose.x,2),y:rounded(pose.y,2));let scale=rounded(pose.scale,3)
            host.transform=CGAffineTransform(rotationAngle:rounded(pose.rotation+flagAngles[index],2) * .pi/180).scaledBy(x:scale,y:scale)
            let skew=tan(rounded(pose.skewX,2) * .pi/180),sx=rounded(pose.imageScaleX,3),sy=rounded(pose.imageScaleY,3)
            image.transform=CGAffineTransform(a:sx,b:0,c:skew*sy,d:sy,tx:0,ty:0)
        }
        field.alpha=1 // Both families leave fully offscreen on their finite routes; no field fade.
        if t>=1.6 {fire("finale") {onCue?("finale",0)}}
        for beat in Self.hapticBeats where t>=beat.at {fire(beat.key) {onHaptic?("light")}}
        glyphs.paint(seconds:time)
    }
    override func dispose() {guard !cancelled else {return};cancelled=true;onHaptic=nil;heroFrames.removeAll();leafHosts.removeAll();leafImages.removeAll();ambient.removeAll();super.dispose()}
}
