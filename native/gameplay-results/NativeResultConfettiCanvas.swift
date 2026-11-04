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
    private var coins:[NativeResultConfettiPlan.Coin]=[]
    private var coinLayers:[CALayer]=[]
    private var coinField:NativeResultConfettiPlan.CoinField?
    private let reducedMotion:Bool
    var arcadeCoinLayerCount:Int {coinLayers.count}
    private static let colors:[UIColor] = [0xFBE3C5,0xFA8C00,0xE5C7AD,0xECD7C2,0xFDBA00,0xFADEC0].map { (value:Int) in
        let red=CGFloat((value>>16)&255)/255,green=CGFloat((value>>8)&255)/255,blue=CGFloat(value&255)/255
        return UIColor(red:red,green:green,blue:blue,alpha:1)
    }
    private var elapsed=0.0,foreground=true,disposed=false,finished=false,released=false
    private(set) var assetsReady=false
    var onFinished:(()->Void)?
    var onAssetFailure:(()->Void)?
    var plannedParticleCount:Int {area.count+leaves.count+bubbles.count+coins.count}
    var activeParticleCount:Int {
        guard !disposed,!finished else{return 0}
        return area.filter {$0.sample(seconds:elapsed).visible}.count+leaves.filter {$0.motion.sample(seconds:elapsed).visible && elapsed<$0.motion.birth+$0.motion.lifetime}.count+bubbles.filter {$0.sample(seconds:elapsed).visible}.count+(coinField.map{field in coins.indices.filter{field.pose($0,at:elapsed).visible}.count} ?? 0)
    }
    init(root:URL,theme:NativeResultCelebrationTheme,viewport:CGSize,generation:UInt64,resources:(any NativeResultConfettiResources)?=nil,reducedMotion:Bool?=nil,random:()->Double={Double.random(in:0..<1)}) {
        self.theme=theme;self.generation=generation;self.resources=resources ?? JimiNativeWorldResources(root:root)
        self.reducedMotion=reducedMotion ?? UIAccessibility.isReduceMotionEnabled
        resourceOwner = -90000-Int(generation%10000)
        super.init(frame:CGRect(origin:.zero,size:viewport))
        backgroundColor = .clear;isOpaque=false;isUserInteractionEnabled=false;clipsToBounds=true
        // Source mobile canvas deliberately renders one pixel per logical point.
        contentScaleFactor=1
        switch theme {
        case .area55:area=NativeResultConfettiPlan.area(width:viewport.width,height:viewport.height,random:random);assetsReady=true
        case .forest:leaves=NativeResultConfettiPlan.forest(width:viewport.width,height:viewport.height,random:random)
        case .beach:bubbles=NativeResultConfettiPlan.beach(width:viewport.width,height:viewport.height,random:random)
        case .arcade:
            if !self.reducedMotion {coins=NativeResultConfettiPlan.arcade(width:viewport.width,height:viewport.height,random:random)}
            coinField=NativeResultConfettiPlan.CoinField(coins:coins)
        }
        let paths=theme == .arcade && self.reducedMotion ? []:Self.assets(theme)
        guard !paths.isEmpty else{assetsReady=true;return}
        self.resources.prepare(paths,owner:resourceOwner,required:false) { [weak self] accepted in
            guard let self,!self.disposed,!self.finished else{return}
            let prepared=paths.compactMap {self.resources.image($0,owner:self.resourceOwner)}
            self.assetsReady=accepted && prepared.count==paths.count
            if self.assetsReady {
                if self.theme == .arcade {
                    self.images=prepared;self.mountArcadeLayers()
                } else {self.images=prepared}
            } else {self.images=[];self.onAssetFailure?()}
            if self.foreground {if self.theme == .arcade {self.paintArcade()}else{self.setNeedsDisplay()}}
        }
    }
    required init?(coder:NSCoder){fatalError("Use native confetti initializer")}
    static func assets(_ theme:NativeResultCelebrationTheme)->[String] {
        switch theme {
        case .area55:return []
        case .forest:return (1...6).map {"./assets/shop/bee/leaf\($0)@2x.png"}
        case .beach:return (1...6).map {"./assets/shop/bottle/bottle animation pack/bubble\($0)@2x.png"}
        case .arcade:return NativeHUDCoinAnimation.names.map {"assets/hud/native-coin-animation/\($0).webp"}
        }
    }
    func paint(seconds:Double,generation:UInt64) {
        guard !disposed,!finished,foreground,generation==self.generation,seconds.isFinite,seconds>=elapsed else{return}
        elapsed=max(0,seconds)
        if elapsed>=NativeResultConfettiPlan.maximumRuntime {
            finished=true;area=[];leaves=[];bubbles=[];images=[];clearArcade();releaseResources()
            setNeedsDisplay();let complete=onFinished;onFinished=nil;complete?();return
        }
        if theme == .arcade {paintArcade()}else{setNeedsDisplay()}
    }
    func setForeground(_ value:Bool){guard !disposed else{return};foreground=value;if value{if theme == .arcade {paintArcade()}else{setNeedsDisplay()}}}
    private func releaseResources(){guard !released else{return};released=true;resources.release(resourceOwner)}
    func dispose(){guard !disposed else{return};disposed=true;area=[];leaves=[];bubbles=[];images=[];clearArcade();releaseResources();onFinished=nil;onAssetFailure=nil;setNeedsDisplay()}
    // One shared result clock and image lease; only the compositing plane differs.
    private let rearCoinLayer=CALayer()
    override func didMoveToSuperview() {
        super.didMoveToSuperview()
        rearCoinLayer.removeFromSuperlayer()
        guard theme == .arcade,!disposed,!finished,let host=superview else{return}
        rearCoinLayer.frame=frame;rearCoinLayer.zPosition=0.5
        host.layer.addSublayer(rearCoinLayer)
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        CATransaction.begin();CATransaction.setDisableActions(true)
        rearCoinLayer.frame=frame
        CATransaction.commit()
    }
    var arcadeRearCoinLayerCount:Int {rearCoinLayer.sublayers?.count ?? 0}
    private func mountArcadeLayers() {
        guard coinLayers.isEmpty,!disposed,!finished else{return}
        CATransaction.begin();CATransaction.setDisableActions(true)
        for (index,coin) in coins.enumerated() {
            let sprite=CALayer();sprite.contents=images[coin.asset].cgImage;sprite.contentsGravity = .resize
            sprite.bounds=CGRect(x:0,y:0,width:coin.size,height:coin.size)
            sprite.opacity=0
            let plane=index%5<2 ? rearCoinLayer:layer
            plane.addSublayer(sprite);coinLayers.append(sprite)
        }
        CATransaction.commit()
    }
    private func paintArcade() {
        guard assetsReady,!disposed,!finished,foreground else{return}
        CATransaction.begin();CATransaction.setDisableActions(true)
        coinField?.advance(to:elapsed)
        for (index,sprite) in coinLayers.enumerated() {
            let coin=coins[index],p=coinField?.pose(index,at:elapsed) ?? coin.sample(seconds:elapsed)
            sprite.opacity=p.visible ? Float(p.opacity):0
            guard p.visible else{continue}
            sprite.position=CGPoint(x:p.x,y:p.y)
            sprite.transform=CATransform3DScale(CATransform3DMakeRotation(p.rotation * .pi/180,0,0,1),p.scale,p.scale,1)
            let count=coin.asset<3 ? 30:120,rows=coin.asset<3 ? 3:12
            let age=max(0,elapsed-coin.birth)+coin.phase/360*Double(count)/60
            let frame=Int(floor(age*60))%count
            sprite.contentsRect=CGRect(x:Double(frame%10)/10,y:Double(frame/10)/Double(rows),width:0.1,height:1/Double(rows))
        }
        CATransaction.commit()
    }
    private func clearArcade() {
        coinLayers.forEach{$0.contents=nil;$0.removeFromSuperlayer()}
        coinLayers=[];coins=[];coinField=nil;rearCoinLayer.removeFromSuperlayer()
    }
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
        let bubbleScale=NativeTabletLayout.applies(bounds.size) ? 1.20:1.0
        for p in bubbles {
            let size=p.size*bubbleScale
            let pose=p.sample(seconds:elapsed);guard pose.visible else{continue}
            c.saveGState();c.translateBy(x:pose.x,y:pose.y);c.scaleBy(x:pose.scale,y:pose.scale)
            images[p.asset].draw(in:CGRect(x:-size/2,y:-size/2,width:size,height:size),blendMode:.normal,alpha:pose.opacity);c.restoreGState()
        }
    }
}
