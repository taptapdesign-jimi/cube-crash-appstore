import UIKit

/// Original12-frame head and30 independently captured neon PNGs keep their
/// authored live orbit during the shuffled gravity exit; one finite owner
/// waits both real visual exits before returning its receipt.
@MainActor
final class NativeRoboFinalePresentation:NativeFinitePresentation {
    var onHaptic:((String)->Void)?
    var onExitFrameSelected:((Int)->Void)?
    let assetReady:Bool
    static let assets=(1...12).map {"assets/shop/robo/robo\($0).png"}+(1...4).map {"assets/shop/robo/neon\($0).png"}
    private let viewport:CGSize,plan:NativeRoboFinaleMotion.Plan,glyphs:NativeSplashGlyphField,random:()->Double,previousExit:Int?
    private var runtime:NativeRoboFinaleMotion.Runtime,headFrames:[UIImage],neonImages:[UIImageView]=[],head=UIImageView(),beats=Set<Int>(),exitFrame:Int?,paintedFrame = -1,cancelled=false
    init(resourceRoot:URL,viewport:CGSize,previousExitFrame:Int?=nil,random:@escaping ()->Double={Double.random(in:0..<1)}) {
        self.viewport=viewport;self.random=random;previousExit=previousExitFrame
        let artwork=JimiV9Artwork(resourceRoot:resourceRoot),color=UIColor(red:166.0/255,green:139.0/255,blue:124.0/255,alpha:1)
        glyphs=NativeSplashGlyphField(artwork:artwork,text:"BIBI - RIBI",colors:[color],splitIndex:0,deferExitRotationCapture:true,random:random)
        let images=Self.assets.map {artwork.image($0,densityAware:true)}
        headFrames=images.prefix(12).compactMap {$0};let neonFrames=Array(images.suffix(4))
        assetReady=images.allSatisfy {$0 != nil}
        let aspects=neonFrames.map {$0.map {Double($0.size.height/max(1,$0.size.width))} ?? 1}
        plan=NativeRoboFinaleMotion.make(viewport:viewport,aspects:aspects,random:random)
        runtime=NativeRoboFinaleMotion.Runtime(plan,viewport:viewport)
        glyphs.captureExitRotations(random:random)
        super.init(viewport:viewport,duration:6)
        clipsToBounds=true;accessibilityIdentifier="native-robo-finale"
        head.layer.zPosition=10000;head.contentMode = .scaleToFill;addSubview(head)
        for n in plan.neons {
            let image=UIImageView(image:neonFrames[n.asset]);image.contentMode = .scaleToFill;image.bounds=CGRect(x:0,y:0,width:n.width,height:n.width*n.aspect)
            image.layer.zPosition=CGFloat(240+n.index);addSubview(image);neonImages.append(image)
        }
        glyphs.frame=bounds;glyphs.layer.zPosition=10001;addSubview(glyphs)
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    override func start() {guard assetReady else {dispose();return};super.start()}
    override func layoutSubviews() {super.layoutSubviews();glyphs.frame=bounds}
    override func paint(seconds:Double) {
        guard !cancelled,assetReady else {return}
        let poses=runtime.sample(seconds:seconds,viewport:viewport,random:random)
        if exitFrame==nil,seconds>=NativeRoboFinaleMotion.headExitStart+0.1 {
            exitFrame=NativeRoboFinaleMotion.selectExitFrame(current:NativeRoboFinaleMotion.frameIndex(seconds:seconds),previous:previousExit,random:random())
            if let exitFrame {onExitFrameSelected?(exitFrame)}
        }
        let pose=NativeRoboFinaleMotion.head(viewport:viewport,drift:plan.drift,seconds:seconds,exitFrame:exitFrame)
        if pose.frame != paintedFrame {
            let image=headFrames[pose.frame],width=min(viewport.width*0.576,288)
            head.image=image;head.bounds=CGRect(x:0,y:0,width:width,height:width*image.size.height/max(1,image.size.width));paintedFrame=pose.frame
        }
        head.layer.position=CGPoint(x:pose.x,y:pose.y);head.isHidden = !pose.visible
        head.transform=CGAffineTransform(rotationAngle:pose.rotation).scaledBy(x:pose.scaleX,y:pose.scaleY)
        for (index,p) in poses.enumerated() {let image=neonImages[index];image.layer.position=CGPoint(x:p.x,y:p.y);image.alpha=CGFloat(p.alpha);image.transform=CGAffineTransform(rotationAngle:p.rotation).scaledBy(x:p.scale,y:p.scale)}
        let beats:[Double]=[0.08,0.175,0.27,1.78,1.86,1.94]
        for (index,time) in beats.enumerated() where seconds>=time && self.beats.insert(index).inserted {onHaptic?("light")}
        glyphs.paint(seconds:seconds)
        if seconds>=NativeRoboFinaleMotion.headEnd,let motionEnd=runtime.motionEnd,seconds>=motionEnd {onHaptic=nil;onExitFrameSelected=nil;completePresentation()}
    }
    override func dispose() {guard !cancelled else {return};cancelled=true;onHaptic=nil;onExitFrameSelected=nil;headFrames.removeAll();neonImages.removeAll();super.dispose()}
}
