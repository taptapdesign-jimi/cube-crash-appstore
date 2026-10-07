import UIKit

@MainActor
protocol NativeResultConfettiResources:AnyObject {
    func image(_ path:String,owner:Int)->UIImage?
    func prepare(_ paths:[String],owner:Int,required:Bool,completion:@escaping (Bool)->Void)
    func release(_ owner:Int)
}
extension JimiNativeWorldResources:NativeResultConfettiResources {}

/// A single bounded native canvas, driven by the result owner's paused clock.
/// No timers, gameplay state, navigation, or competing sound/haptic owners.
@MainActor
final class NativeResultConfettiCanvas:UIView {
    let theme:NativeResultCelebrationTheme,generation:UInt64
    private let resources:any NativeResultConfettiResources
    private let resourceOwner:Int
    private var area:[NativeResultConfettiPlan.Area]=[],leaves:[NativeResultConfettiPlan.Leaf]=[],bubbles:[NativeResultConfettiPlan.Bubble]=[]
    private var images:[UIImage]=[]
    private static let colors:[UIColor] = [0xFBE3C5,0xFA8C00,0xE5C7AD,0xECD7C2,0xFDBA00,0xFADEC0].map { (value:Int) in
        let red=CGFloat((value>>16)&255)/255,green=CGFloat((value>>8)&255)/255,blue=CGFloat(value&255)/255
        return UIColor(red:red,green:green,blue:blue,alpha:1)
    }
    private var elapsed=0.0,foreground=true,disposed=false,finished=false,released=false
    private(set) var assetsReady=false
    var onFinished:(()->Void)?
    var onAssetFailure:(()->Void)?
    var plannedParticleCount:Int {area.count+leaves.count+bubbles.count}
    var activeParticleCount:Int {
        guard !disposed,!finished else{return 0}
        return area.filter {$0.sample(seconds:elapsed).visible}.count+leaves.filter {$0.motion.sample(seconds:elapsed).visible && elapsed<$0.motion.birth+$0.motion.lifetime}.count+bubbles.filter {$0.sample(seconds:elapsed).visible}.count
    }
    init(root:URL,theme:NativeResultCelebrationTheme,viewport:CGSize,generation:UInt64,resources:(any NativeResultConfettiResources)?=nil,random:()->Double={Double.random(in:0..<1)}) {
        self.theme=theme;self.generation=generation;self.resources=resources ?? JimiNativeWorldResources(root:root)
        resourceOwner = -90000-Int(generation%10000)
        super.init(frame:CGRect(origin:.zero,size:viewport))
        backgroundColor = .clear;isOpaque=false;isUserInteractionEnabled=false;clipsToBounds=true
        // Source mobile canvas deliberately renders one pixel per logical point.
        contentScaleFactor=1
        switch theme {
        case .area55:area=NativeResultConfettiPlan.area(width:viewport.width,height:viewport.height,random:random);assetsReady=true
        case .forest:leaves=NativeResultConfettiPlan.forest(width:viewport.width,height:viewport.height,random:random)
        case .beach:bubbles=NativeResultConfettiPlan.beach(width:viewport.width,height:viewport.height,random:random)
        }
        let paths=Self.assets(theme)
        guard !paths.isEmpty else{return}
        self.resources.prepare(paths,owner:resourceOwner,required:false) { [weak self] accepted in
            guard let self,!self.disposed,!self.finished else{return}
            self.images=paths.compactMap {self.resources.image($0,owner:self.resourceOwner)}
            self.assetsReady=accepted && self.images.count==6
            if !self.assetsReady {self.images=[];self.onAssetFailure?()}
            if self.foreground {self.setNeedsDisplay()}
        }
    }
    required init?(coder:NSCoder){fatalError("Use native confetti initializer")}
    static func assets(_ theme:NativeResultCelebrationTheme)->[String] {
        switch theme {
        case .area55:return []
        case .forest:return (1...6).map {"./assets/shop/bee/leaf\($0)@2x.png"}
        case .beach:return (1...6).map {"./assets/shop/bottle/bottle animation pack/bubble\($0)@2x.png"}
        }
    }
    func paint(seconds:Double,generation:UInt64) {
        guard !disposed,!finished,foreground,generation==self.generation,seconds.isFinite,seconds>=elapsed else{return}
        elapsed=max(0,seconds)
        if elapsed>=NativeResultConfettiPlan.maximumRuntime {
            finished=true;area=[];leaves=[];bubbles=[];images=[];releaseResources()
            setNeedsDisplay();let complete=onFinished;onFinished=nil;complete?();return
        }
        setNeedsDisplay()
    }
    func setForeground(_ value:Bool){guard !disposed else{return};foreground=value;if value{setNeedsDisplay()}}
    private func releaseResources(){guard !released else{return};released=true;resources.release(resourceOwner)}
    func dispose(){guard !disposed else{return};disposed=true;area=[];leaves=[];bubbles=[];images=[];releaseResources();onFinished=nil;onAssetFailure=nil;setNeedsDisplay()}
    override func draw(_ rect:CGRect) {
        guard !disposed,!finished,foreground,let c=UIGraphicsGetCurrentContext() else{return}
        for p in area {
            let pose=p.sample(seconds:elapsed);guard pose.visible else{continue}
            c.saveGState();c.translateBy(x:pose.x,y:pose.y);c.rotate(by:pose.rotation * .pi/180);c.setAlpha(pose.opacity);c.setFillColor(Self.colors[p.color].cgColor)
            c.addPath(UIBezierPath(roundedRect:CGRect(x:-p.width/2,y:-p.height/2,width:p.width,height:p.height),cornerRadius:p.radius).cgPath);c.fillPath();c.restoreGState()
        }
        guard images.count==6 else{return}
        for p in leaves {
            let pose=p.motion.sample(seconds:elapsed);guard pose.visible,elapsed<p.motion.birth+p.motion.lifetime else{continue}
            c.saveGState();c.translateBy(x:pose.x,y:pose.y);c.rotate(by:pose.rotation * .pi/180);c.scaleBy(x:pose.scale,y:pose.scale)
            c.concatenate(CGAffineTransform(a:1,b:0,c:tan(pose.skewX * .pi/180),d:1,tx:0,ty:0));c.scaleBy(x:pose.imageScaleX,y:pose.imageScaleY);c.setAlpha(pose.opacity)
            images[p.asset].draw(in:CGRect(x:-p.width/2,y:-p.height/2,width:p.width,height:p.height));c.restoreGState()
        }
        for p in bubbles {
            let pose=p.sample(seconds:elapsed);guard pose.visible else{continue}
            c.saveGState();c.translateBy(x:pose.x,y:pose.y);c.scaleBy(x:pose.scale,y:pose.scale);c.setAlpha(pose.opacity)
            images[p.asset].draw(in:CGRect(x:-p.size/2,y:-p.size/2,width:p.size,height:p.size));c.restoreGState()
        }
    }
}
