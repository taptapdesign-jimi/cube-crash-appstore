import UIKit

/// Four crossfaded hero frames, six direction-stable Honey bees, and forty-two
/// authored gravity leaves share one finite visible clock.
@MainActor
final class NativeBeeFinalePresentation: NativeFinitePresentation {
    var onHaptic:((String)->Void)?
    let assetReady:Bool
    private let route:NativeBeeFinaleMotion,leaves:[NativeBeeLeafPlan],glyphs:NativeSplashGlyphField
    private let field=UIView(),hero=UIView()
    private var heroFrames:[UIImageView]=[],leafHosts:[UIView]=[],leafImages:[UIImageView]=[]
    private struct AmbientOwner {let host:UIView,frames:[UIImageView];var current=0,previous:Int?,pending:Int?,pendingSeconds=0.0,blendSeconds=0.08}
    private var ambient:[AmbientOwner]=[]
    private var facing=1,candidateFacing=1,candidateSince=0.0,priorTime=0.0,cancelled=false,receipts=Set<String>()
    init(resourceRoot:URL,viewport:CGSize,origin:CGPoint?,random:()->Double={Double.random(in:0..<1)}) {
        let roll=random(),phase=(roll.isFinite ? min(1-Double.ulpOfOne,max(0,roll)):0.5)*2 * .pi
        route=NativeBeeFinaleMotion(width:Double(viewport.width),height:Double(viewport.height),origin:origin.map {NativeBeeFinaleMotion.Point(x:Double($0.x),y:Double($0.y))},seed:phase)
        leaves=NativeBeeLeafPlan.make(route:route)
        let artwork=JimiV9Artwork(resourceRoot:resourceRoot)
        glyphs=NativeSplashGlyphField(artwork:artwork,text:"WEEEE!",colors:[UIColor(red:219.0/255,green:118.0/255,blue:84.0/255,alpha:1),UIColor(red:1,green:217.0/255,blue:120.0/255,alpha:1)],splitIndex:3,letterOpacityRange:1...1,random:random)
        let paths=(1...4).map {"assets/shop/bee/bee\($0).png"}+(1...6).map {"assets/shop/bee/leaf\($0).png"}+["assets/shop/honey/bee1.png","assets/shop/honey/bee3.png"]
        assetReady=paths.allSatisfy {artwork.image($0,densityAware:true) != nil}
        super.init(viewport:viewport,duration:max(4.0,glyphs.duration)+0.05)
        clipsToBounds=true;accessibilityIdentifier="native-bee-finale"
        field.frame=bounds;field.isUserInteractionEnabled=false;addSubview(field)
        let width=min(viewport.width*0.322,141.4)
        hero.bounds=CGRect(x:0,y:0,width:width,height:width);hero.layer.anchorPoint=CGPoint(x:0.6,y:0.52);hero.layer.zPosition=2;field.addSubview(hero)
        for index in 1...4 {
            let image=UIImageView(image:artwork.image("assets/shop/bee/bee\(index).png",densityAware:true));image.frame=hero.bounds;image.contentMode = .scaleAspectFit;hero.addSubview(image);heroFrames.append(image)
        }
        for leaf in leaves {
            let host=UIView(frame:CGRect(x:0,y:0,width:leaf.width,height:leaf.height)),image=UIImageView(image:artwork.image(leaf.source,densityAware:true))
            host.isUserInteractionEnabled=false;host.layer.zPosition=1;host.alpha=0;image.frame=host.bounds;image.contentMode = .scaleAspectFit;host.addSubview(image);field.addSubview(host);leafHosts.append(host);leafImages.append(image)
        }
        for plan in NativeBeeFinaleMotion.ambient {
            let size=42*plan.scale,host=UIView(frame:CGRect(x:0,y:0,width:size,height:size));host.layer.zPosition=4;field.addSubview(host)
            let frames=[1,3].map {index->UIImageView in let image=UIImageView(image:artwork.image("assets/shop/honey/bee\(index).png",densityAware:true));image.frame=host.bounds;image.contentMode = .scaleAspectFit;host.addSubview(image);return image}
            ambient.append(AmbientOwner(host:host,frames:frames))
        }
        glyphs.frame=bounds;addSubview(glyphs)
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    override func start() {guard assetReady else {dispose();return};super.start()}
    private func fire(_ key:String,_ callback:()->Void) {if receipts.insert(key).inserted {callback()}}
    private func rounded(_ value:Double,_ digits:Int)->CGFloat {CGFloat(Double(String(format:"%.\(digits)f",value)) ?? value)}
    override func paint(seconds time:TimeInterval) {
        guard !cancelled,assetReady else {return}
        let t=min(4,time),pose=route.sample(seconds:t),delta=max(0,t-priorTime);priorTime=t
        if pose.facing != facing {
            if pose.facing != candidateFacing {candidateFacing=pose.facing;candidateSince=0}
            else {candidateSince+=delta;if candidateSince>=0.05 {facing=candidateFacing}}
        } else {candidateFacing=facing;candidateSince=0}
        let blends=NativeBeeFinaleMotion.idleBlend(seconds:t)
        for index in heroFrames.indices {heroFrames[index].alpha=rounded(blends[index],4)}
        hero.layer.position=CGPoint(x:rounded(pose.point.x,2)+hero.bounds.width*0.1,y:rounded(pose.point.y,2)+hero.bounds.height*0.02)
        hero.transform=CGAffineTransform(rotationAngle:rounded(pose.rotation,2) * .pi/180).scaledBy(x:rounded(pose.scale*Double(facing),4),y:rounded(pose.scale,4))
        for index in ambient.indices {
            let sample=route.sampleAmbient(NativeBeeFinaleMotion.ambient[index],seconds:t)
            let candidate=abs(sample.vx)<0.01 || !sample.vx.isFinite ? ambient[index].current:sample.vx<0 ? 1:0
            if candidate==ambient[index].current {ambient[index].pending=nil;ambient[index].pendingSeconds=0}
            else if candidate != ambient[index].pending {ambient[index].pending=candidate;ambient[index].pendingSeconds=0}
            else {
                ambient[index].pendingSeconds+=delta
                if ambient[index].pendingSeconds>=0.05 {ambient[index].previous=ambient[index].current;ambient[index].current=candidate;ambient[index].pending=nil;ambient[index].pendingSeconds=0;ambient[index].blendSeconds=0}
            }
            ambient[index].blendSeconds=min(0.08,ambient[index].blendSeconds+delta)
            let blend=NativeBeeFinaleMotion.clamp(ambient[index].blendSeconds/0.08)
            for frame in 0..<2 {ambient[index].frames[frame].alpha=rounded(frame==ambient[index].current ? blend:frame==ambient[index].previous ? 1-blend:0,4)}
            if blend>=1 {ambient[index].previous=nil}
            ambient[index].host.layer.position=CGPoint(x:rounded(sample.point.x,2),y:rounded(sample.point.y,2))
            ambient[index].host.transform=CGAffineTransform(rotationAngle:rounded(sample.rotation,2) * .pi/180).scaledBy(x:rounded(sample.scaleX,3),y:rounded(sample.scaleY,3))
        }
        for index in leaves.indices {
            let pose=leaves[index].motion.sample(seconds:t),host=leafHosts[index],image=leafImages[index]
            host.isHidden = !pose.visible;guard pose.visible else {continue}
            host.alpha=rounded(pose.opacity,3);host.layer.position=CGPoint(x:rounded(pose.x,2),y:rounded(pose.y,2));let scale=rounded(pose.scale,3)
            host.transform=CGAffineTransform(rotationAngle:rounded(pose.rotation,2) * .pi/180).scaledBy(x:scale,y:scale)
            let skew=tan(rounded(pose.skewX,2) * .pi/180),sx=rounded(pose.imageScaleX,3),sy=rounded(pose.imageScaleY,3)
            image.transform=CGAffineTransform(a:sx,b:0,c:skew*sy,d:sy,tx:0,ty:0)
        }
        field.alpha=t<=3.88 ? 1:CGFloat(cos(NativeBeeFinaleMotion.clamp((t-3.88)/0.12) * .pi/2))
        if t>=1.6 {fire("finale") {onCue?("finale",0)}}
        let early:[Double]=(0..<7).map {Double($0)*0.095}
        let late:[Double]=(0..<6).map {1.0+Double($0)*0.11}
        let beats=early+late
        for (index,at) in beats.enumerated() where t>=at {fire("haptic-\(index)") {onHaptic?("light")}}
        glyphs.paint(seconds:time)
    }
    override func dispose() {guard !cancelled else {return};cancelled=true;onHaptic=nil;heroFrames.removeAll();leafHosts.removeAll();leafImages.removeAll();ambient.removeAll();super.dispose()}
}
