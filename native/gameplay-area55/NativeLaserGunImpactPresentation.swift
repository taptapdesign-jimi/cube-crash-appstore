import UIKit
import CoreImage
import StackToSixGameplay

struct NativeLaserVisualTarget {
    let tileID: String
    let point: CGPoint
    let shooter: NativeLaserShooter
}

/// One eligible controller owns preparation and retains these bitmaps through its exact presentation lease.
@MainActor
final class NativeLaserGunResources {
    let frames: [UIImage]
    let leftBeam: UIImage?
    let rightBeam: UIImage?
    var assetReady: Bool { frames.count == 6 && leftBeam != nil && rightBeam != nil }
    init(resourceRoot: URL) {
        let artwork = JimiV9Artwork(resourceRoot:resourceRoot)
        frames = (1...6).compactMap{artwork.image("assets/shop/gun/lasergun\($0)@2x.png")}
        leftBeam = artwork.image("assets/shop/gun/left laser@2x.png").flatMap(NativeLaserGunImpactPresentation.prepareBeam)
        rightBeam = artwork.image("assets/shop/gun/right laser@2x.png").flatMap(NativeLaserGunImpactPresentation.prepareBeam)
    }
}

/// Source relay choreography. One accepted contact advances the scheduler; elapsed stalls cannot batch shots.
@MainActor
final class NativeLaserGunImpactPresentation: NativeFinitePresentation {
    let generation: UInt64
    let assetReady: Bool
    var onImpact: ((Int,String) -> Bool)?
    var onImpactsComplete: (() -> Void)?
    let resources: NativeLaserGunResources
    private let frames: [UIImage]
    @MainActor private final class Shot {
        let target: NativeLaserVisualTarget
        let pose: NativeLaserGunGeometry.Pose
        let gun = UIView(),orientation = UIView(),aim = UIView(),image = UIImageView()
        let beam = UIView(),stretch = UIView(),beamImage = UIImageView()
        var entryAt: Double?,entryCompleted = false,posePaints = 0,fireAt: Double?,launchAt: Double?
        var frameSixPainted = false,contact = false,retired = false,bitmap = -1
        init(target: NativeLaserVisualTarget,pose: NativeLaserGunGeometry.Pose) { self.target = target; self.pose = pose }
    }
    private let shots: [Shot]
    private var scenePaints = 0,nextIndex = 0,earliestFire = 0.0,preflightAt = 0.0,completedImpacts = false
    private static let entry = 0.325,firstLead = 0.621,flight = 0.095,exitDelay = 0.405,exitDuration = 0.273
    convenience init(resourceRoot: URL,viewport: CGSize,targets: [NativeLaserVisualTarget],generation: UInt64,
         random: () -> Double = { Double.random(in:0..<1) }) {
        self.init(resources:NativeLaserGunResources(resourceRoot:resourceRoot),viewport:viewport,targets:targets,generation:generation,random:random)
    }
    static func resourcesReady(_ resources: NativeLaserGunResources) -> Bool { resources.assetReady }
    init(resources: NativeLaserGunResources,viewport: CGSize,targets: [NativeLaserVisualTarget],generation: UInt64,
         random: () -> Double = { Double.random(in:0..<1) }) {
        self.generation = generation; self.resources = resources; frames = resources.frames
        assetReady = resources.assetReady && !targets.isEmpty && targets.count <= 4 &&
            Set(targets.map(\.tileID)).count == targets.count && targets.allSatisfy{$0.point.x.isFinite && $0.point.y.isFinite} && viewport.width > 0 && viewport.height > 0
        var scales = [1.0,0.875,0.75]
        for i in stride(from:2,through:1,by:-1) { scales.swapAt(i,min(i,max(0,Int(random()*Double(i+1))))) }
        let leftY = NativeLaserGunGeometry.sidePositions(count:targets.filter{$0.shooter == .left}.count,height:Double(viewport.height),side:.left)
        let rightY = NativeLaserGunGeometry.sidePositions(count:targets.filter{$0.shooter == .right}.count,height:Double(viewport.height),side:.right)
        var leftUsed = 0,rightUsed = 0
        shots = targets.enumerated().map { index,target in
            let y: Double
            if target.shooter == .left { y = leftY[leftUsed]; leftUsed += 1 } else { y = rightY[rightUsed]; rightUsed += 1 }
            return Shot(target:target,pose:NativeLaserGunGeometry.solve(side:target.shooter,target:target.point,viewport:viewport,scale:scales[index%3],nominalY:y))
        }
        super.init(viewport:viewport,duration:.infinity)
        clipsToBounds = false
        for shot in shots {
            addSubview(shot.beam); shot.beam.addSubview(shot.stretch); shot.stretch.addSubview(shot.beamImage)
            addSubview(shot.gun); shot.gun.addSubview(shot.orientation); shot.orientation.addSubview(shot.aim); shot.aim.addSubview(shot.image)
            shot.gun.layer.zPosition = shot.target.shooter == .right ? 5 : 4; shot.beam.layer.zPosition = 3
            shot.image.contentMode = .scaleAspectFit; shot.image.layer.anchorPoint = CGPoint(x:0.24,y:0.32)
            shot.image.image = frames.first
            shot.beamImage.image = shot.target.shooter == .left ? resources.leftBeam : resources.rightBeam
            shot.gun.isHidden = true; shot.beam.isHidden = true
        }
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func start() { guard assetReady else { dispose(); return }; super.start() }
    override func dispose() { onImpact = nil; onImpactsComplete = nil; super.dispose() }
    fileprivate static func prepareBeam(_ image: UIImage) -> UIImage? {
        guard let cg = image.cgImage else { return nil }
        let original = CIImage(cgImage:cg),factor = 1.416
        let bright = original.applyingFilter("CIColorMatrix",parameters:["inputRVector":CIVector(x:factor,y:0,z:0,w:0),"inputGVector":CIVector(x:0,y:factor,z:0,w:0),"inputBVector":CIVector(x:0,y:0,z:factor,w:0)])
        let vivid = bright.applyingFilter("CIColorControls",parameters:[kCIInputSaturationKey:1.344])
        // Native-only prepared glow; original assets remain untouched. Padding is tracked in layout.
        let shadow = vivid.applyingFilter("CIColorMatrix",parameters:["inputRVector":CIVector(x:0,y:0,z:0,w:117/255),"inputGVector":CIVector(x:0,y:0,z:0,w:232/255),"inputBVector":CIVector(x:0,y:0,z:0,w:1),"inputAVector":CIVector(x:0,y:0,z:0,w:0.984)])
            .applyingFilter("CIGaussianBlur",parameters:[kCIInputRadiusKey:8.4])
        let output = vivid.composited(over:shadow),extent = original.extent.insetBy(dx:-26,dy:-26)
        guard let rendered = CIContext(options:[.cacheIntermediates:false]).createCGImage(output,from:extent) else { return nil }
        return UIImage(cgImage:rendered,scale:2,orientation:.up)
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        for shot in shots {
            let p = shot.pose,size = CGSize(width:p.width,height:p.width*183/200)
            shot.gun.bounds = CGRect(origin:.zero,size:size)
            shot.orientation.bounds = shot.gun.bounds; shot.orientation.center = CGPoint(x:size.width/2,y:size.height/2)
            shot.orientation.transform = shot.target.shooter == .left ? CGAffineTransform(rotationAngle:.pi/4).scaledBy(x:-1,y:1) : .identity
            shot.aim.bounds = shot.gun.bounds; shot.aim.center = CGPoint(x:size.width/2,y:size.height/2); shot.aim.transform = CGAffineTransform(rotationAngle:p.aim * .pi / 180)
            shot.image.bounds = shot.gun.bounds; shot.image.layer.position = CGPoint(x:size.width*0.24,y:size.height*0.32)
            let left = shot.target.shooter == .left,source = CGPoint(x:left ? 60 : 360,y:left ? 157 : 313)
            let impact = CGPoint(x:left ? 340.5 : 65.5,y:left ? 345.5 : 143)
            let rawSize = CGSize(width:left ? 439 : 430,height:left ? 495 : 496)
            // Assets are @2x bytes rendered at the source geometry CSS dimensions.
            let padding = 26 / (shot.beamImage.image?.scale ?? 1)
            shot.beamImage.bounds = CGRect(x:0,y:0,width:rawSize.width+padding*2,height:rawSize.height+padding*2)
            shot.beamImage.layer.anchorPoint = CGPoint(x:(source.x+padding)/shot.beamImage.bounds.width,y:(source.y+padding)/shot.beamImage.bounds.height)
            shot.beamImage.layer.position = .zero
            let intrinsic = atan2(Double(impact.y-source.y),Double(impact.x-source.x))
            shot.beamImage.transform = CGAffineTransform(rotationAngle:-intrinsic)
            shot.beam.bounds = .zero; shot.stretch.bounds = .zero; shot.beam.layer.anchorPoint = .zero; shot.stretch.layer.anchorPoint = .zero
            shot.stretch.layer.position = .zero; shot.beam.layer.position = p.barrel
            shot.beam.transform = CGAffineTransform(rotationAngle:p.beam * .pi / 180)
        }
    }
    override func paint(seconds: TimeInterval) {
        guard assetReady else { return }
        // Two distinct mounted samples provide the source's initial paint barrier.
        if scenePaints < 2 { scenePaints += 1; return }
        if nextIndex == 0 && shots[0].entryAt == nil { earliestFire = seconds+Self.firstLead; preflightAt = seconds }
        if nextIndex < shots.count {
            let shot = shots[nextIndex]
            if shot.entryAt == nil && seconds >= preflightAt { shot.entryAt = seconds; onCue?("laser-gun-prepare",nextIndex) }
            if let entryAt = shot.entryAt,shot.fireAt == nil,seconds-entryAt >= Self.entry {
                if !shot.entryCompleted { shot.entryCompleted = true }
                else { shot.posePaints += 1 }
                if shot.posePaints >= 2 && seconds >= earliestFire { shot.fireAt = seconds }
            }
        }
        for (index,shot) in shots.enumerated() {
            guard !shot.retired,let entryAt = shot.entryAt else { continue }
            let p = shot.pose,entryProgress = min(1,max(0,(seconds-entryAt)/Self.entry))
            let entryEase = Double(NativeBoardMotion.Ease.backOut(2.35).sample(CGFloat(entryProgress)))
            var translation = p.offscreen*(1-entryEase),scale = 0.65+(p.scale-0.65)*entryEase,opacity = min(1,max(0,entryEase))
            let elasticP = max(0,min(1,(seconds-entryAt-0.091)/0.221)),period = 0.30,amplitude = 1.05,shift = period/(2 * .pi)*asin(1/amplitude)
            let elastic = elasticP == 0 ? 0 : elasticP == 1 ? 1 : amplitude*pow(2,-10*elasticP)*sin((elasticP-shift)*2 * .pi/period)+1
            shot.image.transform = CGAffineTransform(scaleX:0.88+0.12*elastic,y:0.88+0.12*elastic)
            var frame = 0
            if let fire = shot.fireAt {
                let t = seconds-fire
                if t < 0.2833333333333333 { frame = min(4,max(0,Int(t/0.06))) }
                else if t < 0.36 { frame = 5 }
                else { frame = max(0,4-Int((t-0.36)/0.06)) }
                if t >= 0.3 && shot.launchAt == nil {
                    if !shot.frameSixPainted { frame = 5; shot.frameSixPainted = true }
                    else { shot.launchAt = seconds; onCue?("laser-gun-beam",index) }
                } else if frame == 5 { shot.frameSixPainted = true }
            }
            if let launch = shot.launchAt {
                let t = seconds-launch,travel = min(1,max(0,t/Self.flight)),left = shot.target.shooter == .left
                let baseline = hypot(left ? 280.5 : -294.5,left ? 188.5 : -170)
                let length = max(1,hypot(Double(shot.target.point.x-p.barrel.x),Double(shot.target.point.y-p.barrel.y))),long = length/baseline
                shot.stretch.transform = CGAffineTransform(scaleX:long*(0.06+0.94*(1-pow(1-travel,3))),y:long*2.34)
                shot.beam.isHidden = shot.contact
                if !shot.contact && t >= Self.flight {
                    shot.beam.isHidden = true; shot.contact = true
                    guard onImpact?(index,shot.target.tileID) != false else { dispose(); return }
                    nextIndex += 1; earliestFire = seconds+0.3; preflightAt = earliestFire-0.154
                    if nextIndex == shots.count && !completedImpacts { completedImpacts = true; let done = onImpactsComplete; onImpactsComplete = nil; done?() }
                }
                let exit = max(0,min(1,(t-Self.exitDelay)/Self.exitDuration)),exitEase = pow(exit,3)
                translation = p.offscreen*exitEase; scale = p.scale; opacity = 1-exitEase
                shot.gun.isHidden = exit >= 1; shot.retired = exit >= 1
            } else { shot.gun.isHidden = false }
            shot.gun.center = CGPoint(x:p.center.x+translation,y:p.center.y)
            shot.gun.transform = CGAffineTransform(rotationAngle:shot.target.shooter == .left ? 0 : -8 * .pi/180).scaledBy(x:scale,y:scale)
            shot.gun.alpha = opacity
            if frame != shot.bitmap { shot.image.image = frames[frame]; shot.bitmap = frame }
        }
        if completedImpacts && shots.allSatisfy({$0.gun.isHidden}) { onImpact = nil; completePresentation() }
    }
}
