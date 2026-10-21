import UIKit

/// Twenty-four original balloons with independent broad, winding flights. Contact solving
/// runs only on the shared finite presentation clock; no physics world or timer.
@MainActor
final class NativeBaloonFinalePresentation: NativeFinitePresentation {
    static let colors = ["green", "orange", "pink", "purple", "yellow"]
    static let assets = colors.map { "assets/shop/baloon/\($0).png" }
    struct Balloon {
        let color: String, birth: Double, width: CGFloat, height: CGFloat, phase: CGFloat
        let riseSpeed: CGFloat, depth: CGFloat
        let launch: CGPoint, lane: CGFloat, amplitude: CGFloat, arcCount: Int
        let travelDuration: Double, squeezeCount: Int
        var point: CGPoint, velocity: CGPoint
        var contactOffset: CGFloat = 0, contactVelocity: CGFloat = 0
        var radius: CGFloat { width * 0.36 }
    }
    let assetReady: Bool
    private let resources: NativeBaloonResources
    private let origin: CGPoint, heroScale: CGFloat
    private let hero = UIView(), heroImage = CALayer(), heroNextImage = CALayer(), jet = CAShapeLayer()
    private var glyphs:NativeSplashGlyphField!
    private var images: [UIImageView] = [], balloons: [Balloon] = [], initial: [Balloon] = []
    private var simulated = 0.0, cancelled = false, paintedFrame = -1, paintedNextFrame = -1
    private var emittedAudio = false
    private(set) var collisionCount = 0
    var flightSnapshot: [Balloon] { balloons }
    init(viewport: CGSize, origin: CGPoint, resources: NativeBaloonResources, artwork: JimiV9Artwork, random: () -> Double = { Double.random(in: 0..<1) }) {
        self.resources = resources; self.origin = origin
        heroScale = min(0.52, viewport.width / 750)
        let art = Self.assets.map { artwork.image($0, densityAware: true) }
        assetReady = art.allSatisfy { $0 != nil } && resources.frames.count == 32
        super.init(viewport: viewport, duration: 5.4)
        accessibilityIdentifier = "native-baloon-finale"; clipsToBounds = true
        for index in 0..<24 {
            // Capture randomness once. Each balloon owns its complete path; no
            // shared gust or collision solver may replace its rise/arc timing.
            let color = index % 5
            let sizeDraw = (Double((index * 7) % 24) + random()) / 24
            let width = CGFloat(70 + sizeDraw * 100) * min(1, viewport.width / 390)
            let ratio = art[color].map { $0.size.height / $0.size.width } ?? 1.1
            let height = width * ratio
            let image = UIImageView(image: art[color]); image.bounds = CGRect(x: 0, y: 0, width: width, height: height)
            image.contentMode = .scaleAspectFit; image.isHidden = true; addSubview(image); images.append(image)
            let wave = index / 8
            let stagger = Double((index * 7) % 8) / 8 * 0.28
            let birthJitter=index == 0 ? 0:random() * 0.16
            let originalBirth=index == 0 ? 0:[0.0,0.40,0.90][wave] + stagger + birthJitter
            let birth=index == 0 ? 0:[0.0,0.75,1.50][wave] + stagger + birthJitter
            let depth = CGFloat((index * 17) % 24) + CGFloat(random() * 0.5)
            image.layer.zPosition = depth
            let amplitude = viewport.width * CGFloat(0.17 + random() * 0.14)
            let margin = width * 0.12 + amplitude
            let laneDraw = (Double((index * 11) % 24) + random()) / 24
            let lane = margin + CGFloat(laneDraw) * max(0,viewport.width - 2 * margin)
            let phase = CGFloat(random() * 2 * .pi) + CGFloat(index) * 2.399963
            let arcCount = 2 + min(2,Int(random() * 3))
            let durationDraw = (Double((index * 13) % 24) + random()) / 24
            let travelDuration = min(5.25 - originalBirth,2.65 + durationDraw * 1.65) / 1.30
            // Distinct four-balloon pockets have roughly100pt vertical gaps;
            // wider wave delays keep the faster population from leaving as one sheet.
            let clusterOffset=CGFloat(wave + (index % 8)/4) * 100
            let launchY=viewport.height + height * 0.65 + clusterOffset + CGFloat((index * 47) % 110) + CGFloat(random() * 42)
            let startArc=(viewport.height + height * 0.6 - launchY) / (viewport.height + height * 1.2)
            let launch = CGPoint(x:lane + sin(startArc * CGFloat(arcCount) * .pi + phase) * amplitude,y:launchY)
            let distance = launch.y + height * 1.2 + 40
            balloons.append(Balloon(color: Self.colors[color], birth: birth, width: width, height: height,
                phase:phase,riseSpeed:distance / CGFloat(travelDuration),depth:depth,
                launch:launch,lane:lane,amplitude:amplitude,arcCount:arcCount,
                travelDuration:travelDuration,squeezeCount:2 + min(2,Int(random() * 3)),
                point:launch,velocity:.zero))
        }
        initial = balloons
        let pink=UIColor(red:252.0/255,green:176.0/255,blue:208.0/255,alpha:1)
        let blue=UIColor(red:138.0/255,green:195.0/255,blue:247.0/255,alpha:1)
        let green=UIColor(red:176.0/255,green:227.0/255,blue:166.0/255,alpha:1)
        let orange=UIColor(red:252.0/255,green:187.0/255,blue:135.0/255,alpha:1)
        glyphs=NativeSplashGlyphField(artwork:artwork,text:"BALOONEY",
            colors:[pink,blue,green,orange],splitIndex:8,
            letterColors:[pink,pink,blue,blue,green,green,orange,orange],
            letterOpacityRange:1...1,fitToWidth:true,random:random)
        glyphs.accessibilityIdentifier="native-baloon-caption"
        glyphs.layer.zPosition=100;addSubview(glyphs)
        // SVG starts at(405,440), in its lower-right quadrant. Place that exact
        // authored pivot at the merge, not the center of the600px SVG canvas.
        hero.bounds = CGRect(x: 0, y: 0, width: 320, height: 320)
        hero.layer.anchorPoint = CGPoint(x: 140.0 / 320, y: 140.0 / 320)
        hero.layer.addSublayer(heroImage); heroImage.frame = hero.bounds
        hero.layer.addSublayer(heroNextImage); heroNextImage.frame = hero.bounds
        heroImage.contentsGravity = .resize;heroNextImage.contentsGravity = .resize
        for layer in [heroImage,heroNextImage,jet] {
            layer.actions=["contents":NSNull(),"opacity":NSNull(),"transform":NSNull(),"hidden":NSNull()]
        }
        jet.fillColor = UIColor.clear.cgColor; jet.strokeColor = UIColor(red: 217/255, green: 239/255, blue: 248/255, alpha: 0.5).cgColor
        jet.lineWidth = 1.6; jet.lineCap = .round
        let path = UIBezierPath(); path.move(to: CGPoint(x: 260, y: 135)); path.addQuadCurve(to: CGPoint(x: 289, y: 134), controlPoint: CGPoint(x: 275, y: 129))
        path.move(to: CGPoint(x: 264, y: 149)); path.addQuadCurve(to: CGPoint(x: 289, y: 150), controlPoint: CGPoint(x: 278, y: 154))
        jet.path = path.cgPath; hero.layer.addSublayer(jet); hero.layer.zPosition = 50; addSubview(hero)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func layoutSubviews() {
        super.layoutSubviews();glyphs?.frame=bounds
    }
    override func start() { guard assetReady else { dispose(); return }; super.start() }
    override func paint(seconds: TimeInterval) {
        guard !cancelled else { return }
        if !emittedAudio { emittedAudio = true; onCue?("start",0) }
        let time = max(0, min(duration, seconds))
        if time < simulated { balloons = initial; simulated = 0; collisionCount = 0 }
        let dt = 1.0 / 120
        while simulated + dt <= time + 0.000001 { simulated += dt; step(CGFloat(dt)) }
        for i in balloons.indices {
            let b = balloons[i], image = images[i]
            let visible = time >= b.birth && b.point.y + b.height * 0.6 > -20
            image.isHidden = !visible; guard visible else { continue }
            image.center = CGPoint(x: b.point.x, y: b.point.y + b.height * 0.10)
            let age = CGFloat(time - b.birth)
            let progress=min(1,max(0,age / CGFloat(b.travelDuration)))
            // Repeat a light, area-preserving stretch/squeeze throughout flight,
            // rather than letting the entire effect decay below the viewport.
            let envelope=sin(progress * .pi)
            let squeeze=sin(progress * CGFloat(b.squeezeCount) * 2 * .pi + b.phase) * 0.055 * envelope
            let wobble=sin(progress * CGFloat(b.arcCount) * .pi + b.phase) * 0.055
            let limit=CGFloat(20) * .pi / 180
            let tilt=max(-limit,min(limit,b.velocity.x / 620 + wobble))
            image.transform = CGAffineTransform(rotationAngle:tilt)
                .scaledBy(x:1 / (1 + squeeze),y:1 + squeeze)
        }
        if glyphs.frame != bounds {glyphs.frame=bounds;glyphs.layoutIfNeeded()}
        glyphs.paint(seconds:time)
        let heroDuration = resources.duration * 1.22
        hero.isHidden = time >= heroDuration
        guard !hero.isHidden else { return }
        let rawUnit = min(1,time / heroDuration)
        let unit = rawUnit * rawUnit * (3 - 2 * rawUnit)
        let t = resources.translation.sample(unit), r = resources.rotation.sample(unit), s = resources.scale.sample(unit)
        let keys=resources.cells.times
        var cellIndex=0
        while cellIndex+1<keys.count && keys[cellIndex+1]<=unit {cellIndex+=1}
        func frameIndex(_ index:Int)->Int {
            let cell=resources.cells.values[index]
            return max(0,min(31,Int(-cell[1]/320)*6+Int(-cell[0]/320)))
        }
        let frame=frameIndex(cellIndex),next=frameIndex(min(keys.count-1,cellIndex+1))
        let span=cellIndex+1<keys.count ? keys[cellIndex+1]-keys[cellIndex]:1
        // Hold each authored pose until its brief transition window. Blending
        // across the long opening hold would expose two separated knots.
        let transition=min(span*0.45,0.010)
        let blend=cellIndex+1<keys.count ? Float(min(1,max(0,1-(keys[cellIndex+1]-unit)/transition))):0
        if paintedFrame != frame {heroImage.contents=resources.frames[frame];paintedFrame=frame}
        if paintedNextFrame != next {heroNextImage.contents=resources.frames[next];paintedNextFrame=next}
        heroNextImage.opacity=blend
        let fade=min(1,max(0,(rawUnit-0.90)/0.10))
        hero.alpha=1-CGFloat(fade*fade*(3-2*fade))
        hero.layer.position = CGPoint(x: origin.x + CGFloat(t[0] - 405) * heroScale, y: origin.y + CGFloat(t[1] - 440) * heroScale)
        hero.transform = CGAffineTransform(rotationAngle: CGFloat(r[0]) * .pi / 180).scaledBy(x: CGFloat(s[0]) * heroScale, y: CGFloat(s[1]) * heroScale)
        jet.isHidden = unit < 0.20219769 || unit >= 0.64859013
        jet.setAffineTransform(CGAffineTransform(translationX: sin(CGFloat(time / 0.0625) * .pi) * 9, y: 0))
    }
    private func step(_ dt: CGFloat) {
        for i in balloons.indices where simulated >= balloons[i].birth && balloons[i].point.y > -balloons[i].height - 30 {
            var b=balloons[i]
            let age=simulated-b.birth
            let progress=min(1,max(0,CGFloat(age / b.travelDuration)))
            let previous=b.point
            // One broad sine half-wave is one arc. Independent duration, phase,
            // amplitude and2–4 arcs prevent rows or matching lateral turns.
            let distance=b.launch.y + b.height * 1.2 + 40
            let y=b.launch.y - distance * pow(progress,1.42)
                + sin(progress * 4 * .pi + b.phase) * sin(progress * .pi) * 14
            let arcProgress=(bounds.height + b.height * 0.6 - y) / (bounds.height + b.height * 1.2)
            let x=b.lane + sin(arcProgress * CGFloat(b.arcCount) * .pi + b.phase) * b.amplitude
            b.contactVelocity += (-b.contactOffset * 28 - b.contactVelocity * 9) * dt
            b.contactOffset=max(-24,min(24,b.contactOffset + b.contactVelocity * dt))
            b.point=CGPoint(x:x+b.contactOffset,y:y)
            b.velocity=CGPoint(x:(b.point.x-previous.x)/dt,y:(b.point.y-previous.y)/dt)
            balloons[i]=b
        }
        for i in balloons.indices where simulated >= balloons[i].birth && balloons[i].point.y > -balloons[i].height - 30 {
            for j in (i + 1)..<balloons.count where simulated >= balloons[j].birth && balloons[j].point.y > -balloons[j].height - 30 {
                let dx=balloons[j].point.x-balloons[i].point.x,dy=balloons[j].point.y-balloons[i].point.y
                let required=balloons[i].radius+balloons[j].radius
                guard abs(dx)<required,abs(dy)<required else{continue}
                let distance=max(0.01,hypot(dx,dy))
                guard distance<required else{continue}
                // Soft side contacts are a bounded additive response. They do
                // not exchange vertical speeds or flatten the authored arcs.
                let nx=distance<=0.01 ? CGFloat(1):dx/distance
                let correction=min(1.5,(required-distance)*0.035)
                for (index,direction) in [(i,-nx),(j,nx)] {
                    let old=balloons[index].contactOffset
                    let offset=max(-24,min(24,old+direction*correction))
                    balloons[index].contactOffset=offset
                    balloons[index].point.x += offset-old
                }
                let relative=(balloons[j].velocity.x-balloons[i].velocity.x)*nx
                if relative<0 {
                    let impulse=min(30,-relative*0.20)
                    balloons[i].contactVelocity=max(-70,min(70,balloons[i].contactVelocity-nx*impulse))
                    balloons[j].contactVelocity=max(-70,min(70,balloons[j].contactVelocity+nx*impulse))
                    collisionCount += 1
                }
            }
        }
    }
    override func dispose() { guard !cancelled else { return }; cancelled = true; super.dispose() }
}
