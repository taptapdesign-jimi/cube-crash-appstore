import UIKit

struct NativeResultArea55FlightPlan {
    enum Depth: String { case behind,front }
    struct Pose { let x,y,rotation,scale,opacity: Double }
    let depth: Depth,startEdge: String,endEdge: String
    let keyframes: [Pose]
    static let duration = 6.7
    func sample(seconds: Double) -> Pose {
        let progress = min(1,max(0,seconds/Self.duration))*Double(keyframes.count-1)
        let index = min(keyframes.count-1,Int(progress)),next = min(keyframes.count-1,index+1),mix = progress-Double(index)
        let a = keyframes[index],b = keyframes[next]
        func blend(_ first: Double,_ second: Double) -> Double { first+(second-first)*mix }
        return Pose(x:blend(a.x,b.x),y:blend(a.y,b.y),rotation:blend(a.rotation,b.rotation),scale:blend(a.scale,b.scale),opacity:a.opacity)
    }
    static func make(depth: Depth,viewport: CGSize,random: () -> Double) -> Self {
        let width = max(1,Double(viewport.width)),height = max(1,Double(viewport.height)),left = depth == .behind
        func bounded(_ value: Double) -> Double { max(0,min(1,value.isFinite ? value : 0.5)) }
        func draw(_ lo: Double,_ hi: Double) -> Double { lo+bounded(random())*(hi-lo) }
        let edges = left ? ["top","left","bottom"] : ["top","right","bottom"]
        let startIndex = min(2,Int(floor(bounded(random())*3))),endOffset = 1+min(1,Int(floor(bounded(random())*2)))
        let startEdge = edges[startIndex],endEdge = edges[(startIndex+endOffset)%3]
        func edge(_ name: String) -> CGPoint {
            let x = left ? draw(width*0.06,width*0.22) : draw(width*0.68,width*0.82)
            if name == "top" { return CGPoint(x:x,y:-112) }
            if name == "bottom" { return CGPoint(x:x,y:height+112) }
            if name == "right" { return CGPoint(x:width+112,y:draw(0,height)) }
            return CGPoint(x:-112,y:draw(0,height))
        }
        let start = edge(startEdge),end = edge(endEdge),amplitude = draw(30,60)
        let phaseX = draw(0,.pi*2),phaseY = draw(0,.pi*2),bank = draw(0.8,1.2)
        let driftX = left ? draw(0.55,0.72) : draw(0.82,0.99),driftY = left ? draw(0.48,0.66) : draw(0.72,0.91)
        let hoverX = left ? draw(3,3.7) : draw(4.1,4.9),hoverY = left ? draw(3.8,4.5) : draw(4.8,5.6)
        let direction = random() < 0.5 ? -1.0 : 1.0,tau = Double.pi*2
        func smooth(_ value: Double) -> Double { let t = bounded(value); return t*t*t*(t*(t*6-15)+10) }
        func position(_ value: Double) -> CGPoint {
            let t = bounded(value),motion = t*6.7/9.8
            let x = width*(left ? 0.16 : 0.70)+width*0.08*sin(direction*motion*tau*driftX+phaseX)+min(amplitude*0.45,width*0.027)*sin(motion*tau*hoverX+phaseY)
            let y = height*(left ? 0.34 : 0.58)+height*0.15*sin(motion*tau*driftY+phaseY)+min(amplitude*0.75,height*0.045)*sin(motion*tau*hoverY+phaseX)
            let enter = smooth(t/0.16),leave = smooth((t-0.76)/0.24)
            return CGPoint(x:(Double(start.x)+(x-Double(start.x))*enter)*(1-leave)+Double(end.x)*leave,y:(Double(start.y)+(y-Double(start.y))*enter)*(1-leave)+Double(end.y)*leave)
        }
        // Source WAAPI receives 202 samples rounded to three decimals, then interpolates linearly.
        func rounded(_ value: Double) -> Double { (value*1000).rounded()/1000 }
        let poses = (0...201).map { index -> Pose in
            let t = Double(index)/201,motion = t*6.7/9.8,p = position(t),before = position(t-0.0001),after = position(t+0.0001)
            let velocityX = Double(after.x-before.x)/(2*0.0001*6.7)
            let rotation = max(-30,min(30,6*tanh(velocityX/110)+24*sin(motion*tau*bank+phaseX)))
            let scale = (1+0.025*sin(motion*tau*hoverX+phaseY))*(left ? 0.92 : 1.04)
            return Pose(x:rounded(Double(p.x)),y:rounded(Double(p.y)),rotation:rounded(rotation),scale:rounded(scale),opacity:left ? 0.7 : 0.9)
        }
        return Self(depth:depth,startEdge:startEdge,endEdge:endEdge,keyframes:poses)
    }
}

/// Two original ships, mounted on opposite sides of result content and driven only by its parent clock.
@MainActor
final class NativeResultArea55Flybys {
    static let asset = "./assets/journey assets/robo/ship1@2x.png"
    let generation: UInt64
    private let resources: any NativeResultConfettiResources
    private let resourceOwner: Int
    private var plans: [NativeResultArea55FlightPlan] = []
    private var ships: [UIImageView] = []
    private var elapsed = 0.0,foreground = true,released = false,resourceRequested = false
    private(set) var disposed = false,assetsReady = false
    var onFinished: (() -> Void)?
    var onAssetFailure: (() -> Void)?
    var shipCount: Int { ships.filter{$0.superview != nil}.count }
    init(root: URL,viewport: CGSize,generation: UInt64,resources: (any NativeResultConfettiResources)? = nil,
         reducedMotion: Bool? = nil,random: () -> Double = {Double.random(in:0..<1)}) {
        self.generation = generation; self.resources = resources ?? JimiNativeWorldResources(root:root)
        resourceOwner = -110000000-Int(generation%10000)
        guard !(reducedMotion ?? UIAccessibility.isReduceMotionEnabled) else { assetsReady = true; return }
        plans = [NativeResultArea55FlightPlan.Depth.behind,.front].map{NativeResultArea55FlightPlan.make(depth:$0,viewport:viewport,random:random)}
        ships = plans.map { plan in
            let image = UIImageView(); image.isUserInteractionEnabled = false; image.layer.zPosition = plan.depth == .behind ? 0 : 2
            return image
        }
        resourceRequested = true
        self.resources.prepare([Self.asset],owner:resourceOwner,required:false) { [weak self] accepted in
            guard let self,!self.disposed else { return }
            guard accepted,let image = self.resources.image(Self.asset,owner:self.resourceOwner) else { self.onAssetFailure?(); self.dispose(); return }
            self.assetsReady = true
            for (index,ship) in self.ships.enumerated() {
                let width = self.plans[index].depth == .behind ? 62.0 : 74.0
                ship.image = image; ship.bounds = CGRect(x:0,y:0,width:width,height:width*Double(image.size.height/image.size.width))
            }
            if self.foreground { self.paintCurrent() }
        }
    }
    func mount(overlay: UIView,content: UIView) {
        guard !disposed,ships.count == 2,content.superview === overlay else { return }
        content.layer.zPosition = 1
        overlay.insertSubview(ships[0],belowSubview:content); overlay.addSubview(ships[1])
        if assetsReady && foreground { paintCurrent() }
    }
    func paint(seconds: Double,generation: UInt64) {
        guard !disposed,!plans.isEmpty,foreground,generation == self.generation,seconds.isFinite,seconds >= elapsed else { return }
        elapsed = max(0,seconds)
        if elapsed >= NativeResultArea55FlightPlan.duration {
            let complete = onFinished; onFinished = nil; dispose(); complete?(); return
        }
        if assetsReady { paintCurrent() }
    }
    private func paintCurrent() {
        for (ship,plan) in zip(ships,plans) {
            let pose = plan.sample(seconds:elapsed)
            ship.center = CGPoint(x:pose.x+Double(ship.bounds.width)/2,y:pose.y+Double(ship.bounds.height)/2)
            ship.transform = CGAffineTransform(rotationAngle:pose.rotation * .pi/180).scaledBy(x:pose.scale,y:pose.scale)
            ship.alpha = pose.opacity
        }
    }
    func setForeground(_ value: Bool) { guard !disposed else { return }; foreground = value; if value && assetsReady { paintCurrent() } }
    func dispose() {
        guard !disposed else { return }; disposed = true; ships.forEach{$0.image = nil; $0.removeFromSuperview()}; ships = []; plans = []
        if !released { released = true; if resourceRequested { resources.release(resourceOwner) } }; onFinished = nil; onAssetFailure = nil
    }
}
