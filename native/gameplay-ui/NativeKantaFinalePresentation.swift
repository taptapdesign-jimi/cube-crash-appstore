import UIKit

/// Eighteen preserved images paint the source four-robot/eleven-can/three-pile
/// collection, with pickup cues attached to their actual captured playheads.
@MainActor
final class NativeKantaFinalePresentation: NativeFinitePresentation {
    var onHaptic: ((String) -> Void)?
    var onAudioFade: ((Double) -> Void)?
    let assetReady: Bool
    private let motion: NativeKantaFinaleMotion,glyphs: NativeSplashGlyphField
    private var robots:[UIImageView]=[],cans:[UIImageView]=[],composites:[UIImageView]=[]
    private var receipts=Set<String>(),cancelled=false
    init(resourceRoot:URL,viewport:CGSize,random:()->Double={Double.random(in:0..<1)}) {
        motion=NativeKantaFinaleMotion.make(viewport:viewport,random:random)
        let artwork=JimiV9Artwork(resourceRoot:resourceRoot)
        glyphs=NativeSplashGlyphField(artwork:artwork,text:"SPLAT!",colors:[UIColor(red:123.0/255,green:211.0/255,blue:224.0/255,alpha:1)],splitIndex:0,letterOpacityRange:1...1,neonGlow:true,random:random)
        let sources=Set(motion.robots.map(\.source)+motion.cans.map(\.source)+motion.composites.map(\.source))
        assetReady=sources.allSatisfy {artwork.image($0,densityAware:true) != nil}
        super.init(viewport:viewport,duration:max(glyphs.duration,NativeKantaFinaleMotion.sceneDuration+0.05))
        clipsToBounds=true;accessibilityIdentifier="native-kanta-finale"
        func image(_ source:String,_ width:Double)->UIImageView {
            let bitmap=artwork.image(source,densityAware:true),view=UIImageView(image:bitmap),ratio=CGFloat(width)/max(1,bitmap?.size.width ?? 1)
            view.bounds=CGRect(x:0,y:0,width:CGFloat(width),height:(bitmap?.size.height ?? 0)*ratio)
            view.layer.anchorPoint=CGPoint(x:0.5,y:1);view.alpha=0;view.isUserInteractionEnabled=false;addSubview(view);return view
        }
        robots=motion.robots.map {image($0.source,$0.width)};cans=motion.cans.map {image($0.source,$0.width)};composites=motion.composites.map {image($0.source,$0.width)}
        glyphs.frame=bounds;glyphs.layer.zPosition=100;addSubview(glyphs)
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    override func start() {guard assetReady else {dispose();return};super.start()}
    private func fire(_ token:String,_ callback:()->Void) {if receipts.insert(token).inserted {callback()}}
    private func paint(_ view:UIImageView,_ pose:NativeKantaFinaleMotion.Pose) {
        view.layer.position=CGPoint(x:bounds.width/2+CGFloat(pose.x),y:bounds.height/2+CGFloat(pose.y)+view.bounds.height/2)
        view.transform=CGAffineTransform(rotationAngle:CGFloat(pose.rotation) * .pi/180).scaledBy(x:CGFloat(pose.scaleX),y:CGFloat(pose.scaleY))
        view.alpha=CGFloat(pose.alpha);view.layer.zPosition=CGFloat(pose.depth)
    }
    override func paint(seconds time:TimeInterval) {
        guard !cancelled,assetReady else {return}
        glyphs.paint(seconds:time)
        for index in robots.indices {
            if time>=motion.robots[index].entry {fire("walking") {onCue?("walking",0)}}
            paint(robots[index],motion.robotPose(index,seconds:time))
        }
        for index in cans.indices {
            if time>=motion.cans[index].pickupStart {fire("can-\(index)") {onCue?("exit",index);onHaptic?("light")}}
            paint(cans[index],motion.canPose(index,seconds:time))
        }
        for index in composites.indices {
            if time>=NativeKantaFinaleMotion.exitStart {fire("composite-\(index)") {onCue?("exit",11+index)}}
            paint(composites[index],motion.compositePose(index,seconds:time))
        }
        for (index,threshold) in [0.62,0.8,0.98].enumerated() where (time-NativeKantaFinaleMotion.exitStart)/NativeKantaFinaleMotion.exitDuration>=threshold {
            fire("composite-haptic-\(index)") {onHaptic?("light")}
        }
        let early:[Double]=(0..<7).map {Double($0)*0.095}
        let late:[Double]=(0..<6).map {1.0+Double($0)*0.11}
        let train=early+late
        for (index,at) in train.enumerated() where time>=at {fire("sparkle-haptic-\(index)") {onHaptic?("light")}}
        let fadeStart=NativeKantaFinaleMotion.sceneDuration-0.5
        if time>=fadeStart {onAudioFade?(min(1,max(0,(time-fadeStart)/0.5)))}
    }
    override func dispose() {guard !cancelled else {return};cancelled=true;onHaptic=nil;onAudioFade=nil;robots.removeAll();cans.removeAll();composites.removeAll();super.dispose()}
}
