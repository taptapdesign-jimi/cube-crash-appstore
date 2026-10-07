import UIKit

/// The original Ball down-drop profile: 29 selected original sprites, two
/// births per sampled update, at most 21 live, and one finite ticker owner.
@MainActor
final class NativeBeachBallPresentation: NativeFinitePresentation {
    var onGameplayReady: (() -> Void)?
    var onVisualSequenceComplete: (() -> Void)?
    private(set) var assetsReady = false
    private struct Live { let view:UIImageView,plan:NativeBeachBallPlanning.Ball,born:Double }
    private let artwork:JimiV9Artwork,glyphs:NativeSplashGlyphField
    private let random:()->Double
    private var live:[Live]=[],pool:[UIImageView]=[]
    private var born=0,frameCount=0,accumulator=0.0,lastUpdate=0.0
    private var released=false,sequenceCompleted=false,cancelled=false
    static let assets=(1...6).map { "assets/shop/ball/ball\($0).png" }
    init(resourceRoot:URL,viewport:CGSize,random:@escaping ()->Double={ Double.random(in:0..<1) }) {
        artwork=JimiV9Artwork(resourceRoot:resourceRoot);self.random=random
        let hexes=[0xDD94EB,0xDD94EB,0xFDEB8C,0xFDEB8C,0x4BC9FC,0x4BC9FC,0xFD979D]
        let colors=hexes.map { UIColor(red:CGFloat(($0>>16)&255)/255,green:CGFloat(($0>>8)&255)/255,blue:CGFloat($0&255)/255,alpha:1) }
        glyphs=NativeSplashGlyphField(artwork:artwork,text:"Boooing",colors:[colors[0]],splitIndex:0,letterColors:colors,random:random)
        super.init(viewport:viewport,duration:5.2)
        accessibilityIdentifier="native-beach-ball-finale";clipsToBounds=true
        // Load only this authored six-image family for the active transaction.
        assetsReady = Self.assets.allSatisfy { artwork.image($0,densityAware:true) != nil }
        glyphs.frame=bounds;glyphs.layer.zPosition=100;addSubview(glyphs)
    }
    required init?(coder:NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func paint(seconds time:TimeInterval) {
        guard !cancelled,assetsReady else { return }
        glyphs.paint(seconds:time)
        if !released { released=true;onGameplayReady?() }
        live.removeAll { item in
            let age=time-item.born
            if age>=item.plan.lifetime { item.view.removeFromSuperview();pool.append(item.view);return true }
            let pose=NativeBeachBallPlanning.pose(item.plan,time:age)
            item.view.center=CGPoint(x:pose.x,y:pose.y);item.view.alpha=pose.alpha
            item.view.transform=CGAffineTransform(rotationAngle:pose.rotation).scaledBy(x:pose.scaleX,y:pose.scaleY)
            return false
        }
        frameCount += 1
        if frameCount%2 == 0 && born<29 {
            let delta=max(0.001,time-lastUpdate);lastUpdate=time
            accumulator += 29/1.3*delta
            let count=min(2,Int(accumulator));accumulator -= Double(count)
            for _ in 0..<count where live.count<21 && born<29 {
                let plan=NativeBeachBallPlanning.ball(width:bounds.width,height:bounds.height,random:random)
                let image=artwork.image("assets/shop/ball/ball\(plan.assetIndex).png",densityAware:true)
                let view=pool.popLast() ?? UIImageView();view.image=image;view.bounds=CGRect(origin:.zero,size:image?.size ?? .zero)
                view.alpha=plan.alpha;view.center=CGPoint(x:plan.x,y:plan.y);view.transform=CGAffineTransform(scaleX:plan.scale,y:plan.scale)
                view.layer.zPosition=0;addSubview(view);live.append(Live(view:view,plan:plan,born:time));born += 1
            }
        }
        if born==29 && live.isEmpty && !sequenceCompleted {
            sequenceCompleted=true;onVisualSequenceComplete?()
            let completion=onFinished;onFinished=nil;dispose();completion?(true)
        } else if time>=duration && !sequenceCompleted {
            // Same authored 5.2s bounded safety receipt; scene revalidates its
            // captured transaction, independent of decorative sprite state.
            sequenceCompleted=true;onVisualSequenceComplete?()
        }
    }
    override func dispose() {
        guard !cancelled else { return };cancelled=true
        onGameplayReady=nil;onVisualSequenceComplete=nil;live.removeAll();pool.removeAll();super.dispose()
    }
    override func start() {guard assetsReady else{dispose();return};super.start()}
}
