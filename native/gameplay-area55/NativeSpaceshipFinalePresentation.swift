import UIKit

/// Source-authored 3.8-second saucer, beams and 25 individual debris owners.
/// A single finite clock samples all tracks. Retired debris/beam owners stop receiving paint work.
@MainActor
final class NativeSpaceshipFinalePresentation: NativeFinitePresentation {
    private struct Debris {
        let plan: NativeArea55Motion.DebrisPlan,scatter: NativeArea55Motion.Scatter,mover: UIView,visual: UIView
        var retired = false
    }
    private struct BeamStep { let start,duration,target: Double; let ease: Int }
    let generation: UInt64
    let assetReady: Bool
    private let saucerRig = UIView(),beamRig = UIView(),saucer = UIImageView(),leftBeam = UIImageView(),rightBeam = UIImageView()
    private let glyphs: NativeSplashGlyphField
    private let frames: [UIImage]
    private let entry: Int,lane: Double
    private let leftSteps,rightSteps: [BeamStep]
    private var debris: [Debris] = [],bitmapIndex = -1,beamRetired = false
    private var deliveredCues = Set<String>()
    init(resourceRoot: URL,viewport: CGSize,origin: CGPoint,generation: UInt64,
         random: () -> Double = { Double.random(in: 0..<1) }) {
        self.generation = generation
        let artwork = JimiV9Artwork(resourceRoot: resourceRoot)
        entry = max(0,min(3,Int(NativeArea55Motion.clamp(random(),0,0.999999)*4)))
        lane = random() < 0.5 ? -1 : 1
        frames = (1...4).compactMap { artwork.image("assets/shop/spaceship/saucer\($0)@2x.png") }
        leftBeam.image = artwork.image("assets/shop/spaceship/leftbeam@2x.png")
        rightBeam.image = artwork.image("assets/shop/spaceship/rightbeam@2x.png")
        glyphs = NativeSplashGlyphField(artwork: artwork,text: "WOOMBUU",
            colors: [UIColor(red: 117/255,green: 196/255,blue: 195/255,alpha: 1),UIColor(red: 88/255,green: 217/255,blue: 234/255,alpha: 1)],
            splitIndex: 3,letterOpacityRange: 0.8...1,random: random)
        var prepared: [Debris] = [],allAssets = frames.count == 4 && leftBeam.image != nil && rightBeam.image != nil
        for plan in NativeArea55Motion.debris {
            let mover = UIView(),visual: UIView
            mover.isUserInteractionEnabled = false; mover.layer.zPosition = plan.z
            if plan.value > 0 {
                let die = UIView(),base = UIImageView(image: artwork.image("assets/tile@2x.png"))
                allAssets = allAssets && base.image != nil
                base.contentMode = .scaleAspectFit; base.frame = CGRect(x: 0,y: 0,width: plan.size,height: plan.size); die.addSubview(base)
                let points: [[CGPoint]] = [[],[.init(x: 50,y: 50)],[.init(x: 32,y: 32),.init(x: 68,y: 68)],[.init(x: 32,y: 32),.init(x: 50,y: 50),.init(x: 68,y: 68)],[.init(x: 32,y: 32),.init(x: 68,y: 32),.init(x: 32,y: 68),.init(x: 68,y: 68)],[.init(x: 32,y: 32),.init(x: 68,y: 32),.init(x: 50,y: 50),.init(x: 32,y: 68),.init(x: 68,y: 68)]]
                for point in points[plan.value] {
                    let pip = UIView(); pip.backgroundColor = UIColor(red: 129/255,green: 90/255,blue: 66/255,alpha: 0.9)
                    pip.bounds = CGRect(x: 0,y: 0,width: plan.size*0.12,height: plan.size*0.12)
                    pip.center = CGPoint(x: Double(point.x)*plan.size/100,y: Double(point.y)*plan.size/100)
                    pip.layer.cornerRadius = plan.size*0.12*0.24; die.addSubview(pip)
                }
                visual = die
            } else {
                let image = UIImageView(image: artwork.image(plan.source!)); image.contentMode = .scaleAspectFit
                allAssets = allAssets && image.image != nil; visual = image
            }
            mover.bounds = CGRect(x: 0,y: 0,width: plan.size,height: plan.size)
            visual.frame = mover.bounds; mover.addSubview(visual)
            prepared.append(.init(plan: plan,scatter: NativeArea55Motion.scatter(plan,random: random),mover: mover,visual: visual))
        }
        debris = prepared
        // The source schedules the right lead and its shuffled cycles before left shimmer.
        rightSteps = Self.makeBeamSteps(left: false,random: random); leftSteps = Self.makeBeamSteps(left: true,random: random)
        assetReady = allAssets && FileManager.default.fileExists(atPath: resourceRoot.appendingPathComponent("assets/fonts/Baloo2-ExtraBold.ttf").path)
        super.init(viewport: viewport,duration: 3.8)
        clipsToBounds = true
        beamRig.layer.zPosition = 2; saucerRig.layer.zPosition = 5; glyphs.layer.zPosition = 6
        beamRig.layer.anchorPoint = CGPoint(x: 0.5,y: 0.45); saucerRig.layer.anchorPoint = beamRig.layer.anchorPoint
        addSubview(beamRig); beamRig.addSubview(leftBeam); beamRig.addSubview(rightBeam)
        addSubview(saucerRig); saucerRig.addSubview(saucer)
        for item in debris { addSubview(item.mover) }; addSubview(glyphs)
        leftBeam.layer.anchorPoint = CGPoint(x: 0.5,y: 0); rightBeam.layer.anchorPoint = leftBeam.layer.anchorPoint
        leftBeam.contentMode = .scaleToFill; rightBeam.contentMode = .scaleToFill; saucer.contentMode = .scaleAspectFit
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func start() { guard assetReady else { dispose(); return }; super.start() }
    override func layoutSubviews() {
        super.layoutSubviews()
        let w = min(bounds.width*0.76,297),h = w*202/297
        for rig in [beamRig,saucerRig] { rig.bounds = CGRect(x: 0,y: 0,width: w,height: h) }
        saucer.frame = saucerRig.bounds
        for (beam,x,width) in [(leftBeam,-0.40*w,1.32*w),(rightBeam,-0.0225*w,1.455*w)] {
            let imageSize = beam.image?.size ?? .init(width: 1,height: 1),height = width*imageSize.height/imageSize.width
            beam.bounds = CGRect(x: 0,y: 0,width: width,height: height)
            beam.layer.position = CGPoint(x: x+width/2,y: h*0.66-40)
            beam.transform = CGAffineTransform(scaleX: 1,y: 0.96)
        }
        glyphs.frame = bounds; glyphs.layoutIfNeeded()
    }
    override func paint(seconds: TimeInterval) {
        let pose = NativeArea55Motion.rigPose(seconds: seconds,entry: entry,lane: lane,viewport: bounds.size)
        apply(pose,to: saucerRig)
        if seconds >= 2.94 {
            if !beamRetired { beamRig.removeFromSuperview(); beamRetired = true }
        } else {
            if beamRetired { addSubview(beamRig); beamRetired = false }
            apply(pose,to: beamRig); leftBeam.alpha = CGFloat(Self.beamAlpha(leftSteps,seconds)); rightBeam.alpha = CGFloat(Self.beamAlpha(rightSteps,seconds))
        }
        let frame = seconds < 0.20 ? 0 : Int(floor((seconds-0.20)/0.11))%4
        if frame != bitmapIndex && frames.indices.contains(frame) { saucer.image = frames[frame]; bitmapIndex = frame }
        for i in debris.indices {
            let item = debris[i],plan = item.plan,s = item.scatter
            if seconds >= plan.arrival+0.01 {
                if !item.retired { item.mover.isHidden = true; debris[i].retired = true }
                continue
            }
            if item.retired { item.mover.isHidden = false; debris[i].retired = false }
            let elapsed = max(0,seconds-plan.delay),p = NativeArea55Motion.clamp(elapsed/(1.95+plan.order*0.04)),m = NativeArea55Motion.magnetic(p)
            let target = NativeArea55Motion.intake(pose: pose,order: plan.order,viewport: bounds.size)
            let wobble = sin(p * .pi*2*(2.2+plan.order.truncatingRemainder(dividingBy: 4)*0.32))*sin(.pi*m)
            item.mover.center = CGPoint(x: NativeArea55Motion.bezier(Double(bounds.width)*s.x/100,Double(bounds.width)*s.c1/100,Double(bounds.width)*s.c2/100,Double(target.x),m),y: Double(bounds.height)*s.y/100+(Double(target.y)-Double(bounds.height)*s.y/100)*m)
            let scale = 1.4-0.8*pow(m,1.18); item.mover.transform = CGAffineTransform(scaleX: scale,y: scale)
            var rotation = s.rotation*(1-m)+plan.wobble*wobble
            if plan.value > 0 { rotation = NativeArea55Motion.clamp(rotation,-60,60) }
            item.visual.transform = CGAffineTransform(translationX: s.drift*wobble,y: 0).rotated(by: rotation * .pi/180)
            item.mover.alpha = seconds < plan.delay ? 0 : plan.delay > 0 ? CGFloat(1-pow(1-min(1,elapsed/0.12),2)) : 1
        }
        glyphs.paint(seconds: seconds)
        for (time,name) in [(0.0,"spaceship-start"),(0.34,"spaceship-beam"),(2.62,"spaceship-exit")] where seconds >= time && !deliveredCues.contains(name) {
            deliveredCues.insert(name); onCue?(name,0)
        }
    }
    private func apply(_ pose: NativeArea55Motion.RigPose,to rig: UIView) {
        rig.layer.position = CGPoint(x: Double(bounds.width)/2+pose.x,y: Double(rig.bounds.height)*0.45+pose.y)
        rig.transform = CGAffineTransform(rotationAngle: pose.rotation * .pi/180).scaledBy(x: pose.sx,y: pose.sy)
    }
    private static func makeBeamSteps(left: Bool,random: () -> Double) -> [BeamStep] {
        var result: [BeamStep] = left ? [.init(start: 0.34,duration: 0.20,target: 1,ease: 1)] : []
        var cursor = left ? 0.54 : 0.34
        if !left { for level in [0.5,0.6,0.4,1] { result.append(.init(start: cursor,duration: 0.068,target: level,ease: 0)); cursor += 0.075 } }
        while cursor <= 2.780 {
            var cycle = [1.0,0.9,0.5,0.6,0.3]
            for i in stride(from: cycle.count-1,through: 1,by: -1) { let j = max(0,min(i,Int(random()*Double(i+1)))); cycle.swapAt(i,j) }
            for level in cycle where cursor <= 2.780 { result.append(.init(start: cursor,duration: 0.068,target: level,ease: 0)); cursor += 0.075 }
        }
        let starts = [2.855,2.866,2.877,2.888,2.899,2.910,2.921,2.930]
        let levels = left ? [1.0,0,0.85,0,0.65,0,0.4,0] : [0.0,1,0,0.75,0,0.55,0,0]
        for i in starts.indices { result.append(.init(start: starts[i],duration: 0.009,target: levels[i],ease: i == 7 ? 3 : 2)) }
        return result
    }
    private static func beamAlpha(_ steps: [BeamStep],_ seconds: Double) -> Double {
        if seconds >= 2.94 { return 0 }
        var from = 0.0
        for step in steps {
            if seconds < step.start { break }
            let p = NativeArea55Motion.clamp((seconds-step.start)/step.duration),e: Double
            switch step.ease {
            case 1: e = pow(p,3)
            case 2: e = p < 0.5 ? 2*p*p : 1-pow(-2*p+2,2)/2
            case 3: e = 1-pow(1-p,3)
            default: e = (1-cos(.pi*p))/2
            }
            let value = from+(step.target-from)*e
            if p < 1 { return value }; from = step.target
        }
        return from
    }
}
