import UIKit

/// Fourteen original cloths, each with independent finite deformation, sampled
/// by one visible clock together with the authored Hiyaa! glyph sequence.
@MainActor
final class NativeCuberoFinalePresentation:NativeFinitePresentation {
    var onHaptic:((String)->Void)?
    let assetReady:Bool
    private let plans:[NativeCuberoFinaleMotion.Plan],glyphs:NativeSplashGlyphField
    private var hosts:[UIView]=[],images:[UIImageView]=[],beats=Set<Int>(),cancelled=false
    init(resourceRoot:URL,viewport:CGSize,random:()->Double={Double.random(in:0..<1)}) {
        plans=NativeCuberoFinaleMotion.make(viewport:viewport,random:random)
        let artwork=JimiV9Artwork(resourceRoot:resourceRoot)
        let color=UIColor(red:254.0/255,green:145.0/255,blue:48.0/255,alpha:1)
        glyphs=NativeSplashGlyphField(artwork:artwork,text:"Hiyaa!",colors:[color],splitIndex:0,deferExitRotationCapture:true,random:random)
        glyphs.captureExitRotations(random:random)
        let paths=(1...7).map {"assets/shop/cubero/krpa\($0).png"},textures=paths.map {artwork.image($0,densityAware:true)}
        assetReady=textures.allSatisfy {$0 != nil}
        let childLifetime=max(1.2,(plans.map(\.end).max() ?? 0)+0.45)
        super.init(viewport:viewport,duration:max(glyphs.duration,childLifetime+0.05))
        accessibilityIdentifier="native-cubero-finale"
        for (index,plan) in plans.enumerated() {
            let host=UIView(frame:CGRect(x:0,y:0,width:plan.burst.size,height:plan.burst.size)),image=UIImageView(image:textures[index%7])
            host.alpha=0;host.isUserInteractionEnabled=false;host.layer.zPosition=2;addSubview(host)
            image.contentMode = .scaleAspectFit;image.bounds=host.bounds;image.layer.anchorPoint=CGPoint(x:0.22,y:0.5);image.layer.position=CGPoint(x:host.bounds.width*0.22,y:host.bounds.height*0.5);host.addSubview(image)
            hosts.append(host);images.append(image)
        }
        glyphs.frame=bounds;glyphs.layer.zPosition=3;addSubview(glyphs)
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    override func start() {guard assetReady else {dispose();return};super.start()}
    override func layoutSubviews() {super.layoutSubviews();glyphs.frame=bounds}
    override func paint(seconds:TimeInterval) {
        guard !cancelled,assetReady else {return}
        for index in plans.indices {
            let plan=plans[index],pose=plan.burst.sample(seconds:seconds),wave=plan.wave.sample(seconds:seconds)
            hosts[index].layer.position=pose.point;hosts[index].alpha=pose.alpha
            hosts[index].transform=CGAffineTransform(rotationAngle:pose.rotation * .pi/180).scaledBy(x:pose.scale,y:pose.scale)
            // CSS order: translate → rotate → skewX → independent scale.
            images[index].transform=CGAffineTransform(translationX:wave.x,y:0).rotated(by:wave.rotation * .pi/180).concatenating(CGAffineTransform(a:1,b:0,c:tan(wave.skew * .pi/180),d:1,tx:0,ty:0)).scaledBy(x:wave.scaleX,y:wave.scaleY)
        }
        let early:[Double]=(0..<7).map {Double($0)*0.095}
        let late:[Double]=(0..<6).map {1.0+Double($0)*0.11}
        let times=early+late
        for (index,time) in times.enumerated() where seconds>=time && beats.insert(index).inserted {onHaptic?("light")}
        glyphs.paint(seconds:seconds)
    }
    override func dispose() {guard !cancelled else {return};cancelled=true;onHaptic=nil;hosts.removeAll();images.removeAll();super.dispose()}
}
