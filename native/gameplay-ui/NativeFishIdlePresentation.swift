import UIKit
import AVFoundation

/// A pose receipt from the accepted native die, without gameplay callbacks.
struct NativeFishIdleFrame {
    struct Bubble {
        let id:Int,slot:Int,radius:CGFloat,color:UInt32,point:CGPoint,scale:CGPoint,alpha:CGFloat
    }
    let point:CGPoint,transform:CGAffineTransform,alpha:CGFloat,dragging:Bool,phaseStarted:Bool,visible:Bool,bubbles:[Bubble]
    let depth:CGFloat,paintOrder:Int
    /// Convert the accepted SpriteKit branch to the original CSS-y-down
    /// world matrix. The movie view is centred at the authored .5/.5 anchor.
    static func project(center:CGPoint,horizontalUnit:CGPoint,verticalUnit:CGPoint,sceneHeight:CGFloat,alpha:CGFloat,dragging:Bool,phaseStarted:Bool,visible:Bool,bubbles:[Bubble],depth:CGFloat=0,paintOrder:Int=0)->Self {
        let x=CGPoint(x:horizontalUnit.x-center.x,y:horizontalUnit.y-center.y)
        let y=CGPoint(x:verticalUnit.x-center.x,y:verticalUnit.y-center.y)
        return Self(point:CGPoint(x:center.x,y:sceneHeight-center.y),transform:CGAffineTransform(a:x.x,b:-x.y,c:y.x,d:-y.y,tx:0,ty:0),alpha:alpha,dragging:dragging,phaseStarted:phaseStarted,visible:visible,bubbles:bubbles,depth:depth,paintOrder:paintOrder)
    }
}

@MainActor
final class NativeFishIdlePresentation:UIView {
    static let logicalMediaSize=CGSize(width:272.0*128.0/224.0,height:280.0*128.0/224.0)
    var onPrepared:(()->Void)?
    var onMediaReady:((Bool)->Void)?
    private let video=UIView(),bubbleHost=UIView(),mediaLayer=AVPlayerLayer()
    private let player=AVQueuePlayer()
    private var looper:AVPlayerLooper?
    private var readiness:[NSKeyValueObservation]=[]
    private var itemObservation:NSKeyValueObservation?
    private var notifiedPrepared=false,prepared=false,started=false,seeking=false,ready=false,disposed=false,suspended=false,failed=false
    private var displayedFrame:NativeFishIdleFrame?
    private var lastPaint:Double?
    private let assetURL:URL
    private var carriers:[NativeFishIdleBubbleCarrier]=[]
    init(resourceRoot:URL) {
        assetURL=resourceRoot.appendingPathComponent("assets/shop/fish/fish-mobile-hevc.mov")
        super.init(frame:CGRect(origin:.zero,size:Self.logicalMediaSize))
        accessibilityIdentifier="native-fish-idle-original-hevc"
        isOpaque=false;backgroundColor = .clear;isUserInteractionEnabled=false;clipsToBounds=false
        video.frame=bounds;video.clipsToBounds=true;video.backgroundColor = .clear;addSubview(video)
        video.layer.addSublayer(mediaLayer);mediaLayer.frame=video.bounds;mediaLayer.videoGravity = .resizeAspect
        mediaLayer.backgroundColor=UIColor.clear.cgColor;mediaLayer.player=player
        bubbleHost.frame = .zero;addSubview(bubbleHost)
        for _ in 0..<6 {let item=NativeFishIdleBubbleCarrier();bubbleHost.addSubview(item);carriers.append(item)}
        player.isMuted=true;player.automaticallyWaitsToMinimizeStalling=false
        isHidden=true
    }
    required init?(coder:NSCoder){fatalError("Use the original media resource")}
    func prepare() {
        guard !prepared,!disposed else {return};prepared=true
        guard FileManager.default.fileExists(atPath:assetURL.path) else {fail();return}
        let item=AVPlayerItem(url:assetURL)
        looper=AVPlayerLooper(player:player,templateItem:item)
        readiness=[
            mediaLayer.observe(\.isReadyForDisplay,options:[.new]) { [weak self] _,_ in
                Task { @MainActor [weak self] in self?.preparedFrame() }
            },player.observe(\.currentItem,options:[.new,.initial]) { [weak self] _,_ in
                Task { @MainActor [weak self] in self?.observeCurrentItem() }
            },player.observe(\.status,options:[.new]) { [weak self] player,_ in
                let didFail=player.status == .failed
                Task { @MainActor [weak self] in if didFail {self?.fail()} }
            }
        ]
        // Decode under the original static fallback. Phase admission rewinds
        // the prepared media rather than exposing an arbitrary decoded frame.
        player.playImmediately(atRate:1)
    }
    private func observeCurrentItem() {
        guard !disposed,!failed else {return}
        itemObservation?.invalidate()
        itemObservation=player.currentItem?.observe(\.status,options:[.new,.initial]) { [weak self] item,_ in
            let didFail=item.status == .failed
            Task { @MainActor [weak self] in if didFail {self?.fail()} }
        }
    }
    private func preparedFrame() {
        guard !disposed,!failed,!notifiedPrepared,mediaLayer.isReadyForDisplay else {return}
        notifiedPrepared=true;player.pause();onPrepared?()
    }
    func paint(_ frame:NativeFishIdleFrame,now:Double,force:Bool=false) {
        guard !disposed else {return};displayedFrame=frame
        if !force,let lastPaint,now-lastPaint<1/30 {return};lastPaint=now
        CATransaction.begin();CATransaction.setDisableActions(true)
        center=frame.point;transform=frame.transform;alpha=frame.alpha
        bubbleHost.center=CGPoint(x:bounds.midX,y:bounds.midY)
        CATransaction.commit()
        if frame.phaseStarted,!started,!seeking,!failed {startAdmittedMedia()}
        let visible=ready && frame.visible && !frame.dragging && !suspended && window != nil
        isHidden = !visible
        if visible {
            if player.rate != 1 {player.playImmediately(atRate:1)}
            paintBubbles(frame.bubbles)
        } else {player.pause();carriers.forEach {$0.isHidden=true}}
    }
    private func startAdmittedMedia() {
        guard mediaLayer.isReadyForDisplay else {return};seeking=true
        player.seek(to:.zero,toleranceBefore:.zero,toleranceAfter:.zero) { [weak self] success in
            Task { @MainActor [weak self] in
                guard let self,!self.disposed,self.seeking else {return}
                self.seeking=false
                guard success else {self.fail();return}
                self.started=true;self.ready=true;self.onMediaReady?(true)
                if let frame=self.displayedFrame {self.paint(frame,now:self.lastPaint ?? 0,force:true)}
            }
        }
    }
    private func paintBubbles(_ bubbles:[NativeFishIdleFrame.Bubble]) {
        carriers.forEach {$0.isHidden=true}
        for bubble in bubbles where carriers.indices.contains(bubble.slot) {
            let carrier=carriers[bubble.slot]
            if carrier.paint(bubble) {bubbleHost.bringSubviewToFront(carrier)}
        }
    }
    func setSuspended(_ value:Bool) {
        suspended=value
        if value {player.pause();isHidden=true;lastPaint=nil}
        else if let frame=displayedFrame {paint(frame,now:lastPaint ?? 0,force:true)}
    }
    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window==nil {player.pause();isHidden=true;lastPaint=nil}
        else if let frame=displayedFrame {paint(frame,now:lastPaint ?? 0,force:true)}
    }
    private func fail() {
        guard !disposed,!failed else {return};failed=true;ready=false;player.pause();isHidden=true
        itemObservation?.invalidate();itemObservation=nil
        readiness.forEach {$0.invalidate()};readiness.removeAll();looper?.disableLooping();looper=nil
        player.removeAllItems();mediaLayer.player=nil;onMediaReady?(false)
    }
    var mediaReady:Bool {ready && !disposed && !failed}
    var retainedItemCount:Int {player.items().count}
    var playbackRate:Float {player.rate}
    var bubbleCarrierCount:Int {carriers.count}
    func dispose() {
        guard !disposed else {return};disposed=true;onPrepared=nil;onMediaReady=nil
        itemObservation?.invalidate();itemObservation=nil
        readiness.forEach {$0.invalidate()};readiness.removeAll();looper?.disableLooping();looper=nil
        player.pause();player.removeAllItems();mediaLayer.player=nil;displayedFrame=nil
        carriers.removeAll();removeFromSuperview()
    }
}

@MainActor
private final class NativeFishIdleBubbleCarrier:UIView {
    private let body=CAShapeLayer(),highlight=CAShapeLayer(),border=CAShapeLayer()
    private var paintedID:Int?
    override init(frame:CGRect) {super.init(frame:frame);isUserInteractionEnabled=false;backgroundColor = .clear;isHidden=true;layer.addSublayer(body);layer.addSublayer(highlight);layer.addSublayer(border);border.fillColor=UIColor.clear.cgColor;border.lineWidth=1}
    convenience init(){self.init(frame:.zero)}
    required init?(coder:NSCoder){fatalError("Use a native vector carrier")}
    @discardableResult
    func paint(_ bubble:NativeFishIdleFrame.Bubble)->Bool {
        func color(_ alpha:CGFloat)->CGColor {UIColor(red:CGFloat((bubble.color>>16)&255)/255,green:CGFloat((bubble.color>>8)&255)/255,blue:CGFloat(bubble.color&255)/255,alpha:alpha).cgColor}
        func circle(_ radius:CGFloat)->CGPath {CGPath(ellipseIn:CGRect(x:-radius,y:-radius,width:radius*2,height:radius*2),transform:nil)}
        CATransaction.begin();CATransaction.setDisableActions(true)
        center=bubble.point;transform=CGAffineTransform(scaleX:bubble.scale.x,y:bubble.scale.y);alpha=bubble.alpha
        let newBirth=paintedID != bubble.id
        if newBirth {
            paintedID=bubble.id
            body.path=circle(bubble.radius);body.fillColor=color(0.6)
            highlight.path=circle(bubble.radius*0.3);highlight.position=CGPoint(x:-bubble.radius*0.2,y:-bubble.radius*0.2);highlight.fillColor=color(0.8)
            border.path=circle(bubble.radius);border.strokeColor=color(0.4)
        }
        isHidden=false;CATransaction.commit();return newBirth
    }
}
