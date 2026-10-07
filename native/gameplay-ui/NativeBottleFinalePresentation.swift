import UIKit

/// Five preserved PNG bottles, 60 captured emitters and 40 foreground bubbles.
/// Every trajectory is sampled from the authored source; no gameplay mutation
/// or audio transport lives in this finite renderer.
@MainActor
final class NativeBottleFinalePresentation: NativeFinitePresentation {
    private struct Bottle {
        let mover: UIView,image: UIImageView,spec: NativeBottleFinaleMotion.Layer,angles: [CGFloat]
    }
    private final class Trail {
        let image: UIImageView,bottleIndex: Int,delay: CGFloat,size: CGFloat,direction: CGFloat,push: CGFloat
        let startScale: CGFloat,endScale: CGFloat,alpha: CGFloat,travel: CGFloat,port: CGFloat
        var origin: CGPoint?,rise: CGFloat = 60,retired = false
        init(image: UIImageView,bottleIndex: Int,delay: CGFloat,size: CGFloat,direction: CGFloat,push: CGFloat,
             startScale: CGFloat,endScale: CGFloat,alpha: CGFloat,travel: CGFloat,port: CGFloat) {
            self.image = image; self.bottleIndex = bottleIndex; self.delay = delay; self.size = size; self.direction = direction
            self.push = push; self.startScale = startScale; self.endScale = endScale; self.alpha = alpha; self.travel = travel; self.port = port
        }
    }
    private struct Bubble {
        let image: UIImageView,origin: CGPoint,size: CGFloat,rise: CGFloat,direction: CGFloat,weave: CGFloat
        let pause: Bool,travel: CGFloat,delay: CGFloat,pop: CGFloat,alpha: CGFloat,startScale: CGFloat
    }
    private var bottles: [Bottle] = [],trails: [Trail] = [],bubbles: [Bubble] = []
    private var retiredBubbles = Set<Int>(),fired = Set<String>()
    private let glyphs: NativeSplashGlyphField
    private let random: () -> Double
    private let viewport: CGSize
    private let pack = "assets/shop/bottle/bottle animation pack/"
    private func roll() -> CGFloat { CGFloat(min(1-Double.ulpOfOne,max(0,random()))) }
    init(resourceRoot: URL,viewport: CGSize,random: @escaping () -> Double = { Double.random(in: 0..<1) }) {
        self.random = random
        self.viewport = CGSize(width: max(320,viewport.width),height: max(520,viewport.height))
        let artwork = JimiV9Artwork(resourceRoot: resourceRoot)
        let color = UIColor(red: 117.0/255,green: 221.0/255,blue: 223.0/255,alpha: 1)
        glyphs = NativeSplashGlyphField(artwork: artwork,text: "S.O.S.",colors: [color],splitIndex: 0,random: random)
        // Source particle completion 0.30 + 5.35, followed by 0.05 cleanup.
        super.init(viewport: viewport,duration: 5.70)
        clipsToBounds = true; accessibilityIdentifier = "native-bottle-finale"
        let trailAlpha = NativeBottleFinaleMotion.mixedOpacities(count: 60,random: random)
        let mainAlpha = NativeBottleFinaleMotion.mixedOpacities(count: 40,random: random)
        for (index,spec) in NativeBottleFinaleMotion.layers.enumerated() {
            let mover = UIView(); mover.backgroundColor = .clear; mover.layer.zPosition = spec.z; addSubview(mover)
            let image = UIImageView(image: artwork.image(pack+spec.asset+".png",densityAware: true))
            image.contentMode = .scaleToFill; image.layer.anchorPoint = CGPoint(x: 0.5,y: 0.82); mover.addSubview(image)
            let direction: CGFloat = roll() < 0.5 ? -1 : 1
            var angles = [direction*(6+roll()*4)*1.3]
            for phase in 0..<4 { angles.append((phase%2 == 0 ? -direction : direction)*(10+roll()*4)*1.3) }
            bottles.append(Bottle(mover: mover,image: image,spec: spec,angles: angles))
            for ordinal in 0..<12 {
                let bubble = makeBubble(artwork: artwork,index: index*8+ordinal,z: spec.z-1)
                let size = (8+pow(roll(),0.72)*48).rounded(),direction: CGFloat = roll() < 0.5 ? -1 : 1
                let push = 8+roll()*14,startScale = 0.35+roll()*0.2,endScale = 0.9+roll()*0.25
                let emission = ordinal*5+index,delay = CGFloat(emission)/59*(3.2-0.72),travel = 0.32+roll()*0.18
                trails.append(Trail(image: bubble,bottleIndex: index,delay: delay,size: size,direction: direction,push: push,
                    startScale: startScale,endScale: endScale,alpha: trailAlpha[emission],travel: travel,port: [0.32,0.5,0.68][ordinal%3]))
            }
        }
        let waveSizes = [6,10,7,7,5,5],waveStarts: [CGFloat] = [0,0.4,0.9,1.4,1.9,2.35]
        for index in 0..<40 {
            let image = makeBubble(artwork: artwork,index: index,z: CGFloat(120+index%3))
            let size = (18+pow(roll(),1.6)*42)*(index >= 25 ? 1.08 : 2.4)
            var wave = 0,start = 0
            while wave < 5 && index >= start+waveSizes[wave] { start += waveSizes[wave]; wave += 1 }
            let slot = index-start,lane = (CGFloat(slot)+0.12+roll()*0.76)/CGFloat(waveSizes[wave])
            let x = (2+lane*96)/100*self.viewport.width,gap = 50+roll()*50
            let y = self.viewport.height*(1.03+roll()*0.08)+CGFloat(slot%4)*gap
            let rise = y+size*(1.1+roll()*1.4),direction: CGFloat = roll() < 0.5 ? -1 : 1
            let weave = max(20,viewport.width*(0.04+roll()*0.16)),pause = roll() < 0.16,travel = 1.45+roll()*0.45
            let ratio = pause ? 0.46+roll()*0.18 : 0.68+roll()*0.28
            let withinDelay = CGFloat(slot)*(0.045+roll()*0.035),delay = index == 0 ? 0 : waveStarts[wave]+withinDelay
            let naturalPop = 0.12+travel*ratio,pop = wave >= 4 ? min(naturalPop,3.75-delay) : naturalPop
            bubbles.append(Bubble(image: image,origin: CGPoint(x: x,y: y.rounded()),size: size.rounded(),rise: rise,direction: direction,
                weave: weave,pause: pause,travel: travel,delay: delay,pop: pop,alpha: mainAlpha[index],startScale: 0.75+roll()*0.35))
        }
        glyphs.layer.zPosition = 1000; addSubview(glyphs)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    private func makeBubble(artwork: JimiV9Artwork,index: Int,z: CGFloat) -> UIImageView {
        let image = UIImageView(image: artwork.image(pack+"bubble\(index%6+1).png",densityAware: true))
        image.contentMode = .scaleToFill; image.alpha = 0; image.layer.zPosition = z; addSubview(image); return image
    }
    override func layoutSubviews() {
        super.layoutSubviews(); glyphs.frame = bounds
        for bottle in bottles {
            let width = bounds.width*bottle.spec.widthPercent/100
            let aspect = bottle.image.image.map { $0.size.height/max(1,$0.size.width) } ?? 1
            bottle.mover.bounds = CGRect(x: 0,y: 0,width: width,height: width*aspect)
            bottle.image.bounds = bottle.mover.bounds
        }
    }
    override func paint(seconds: TimeInterval) {
        let time = CGFloat(seconds)
        let cueTimes: [(String,CGFloat)] = [("water-waves",0),("bottle1",0.3),("bottle2",0.94),("bublesi",1.26),("cling",2.06),("cling2",2.70)]
        for (cue,at) in cueTimes where time >= at && !fired.contains(cue) { fired.insert(cue); onCue?(cue,0) }
        if time >= 5.40 { bottles.forEach { $0.mover.alpha = 0 }; trails.forEach { $0.image.alpha = 0 }; bubbles.forEach { $0.image.alpha = 0 }; glyphs.paint(seconds: seconds); return }
        for bottle in bottles {
            let t = min(1,max(0,(time-0.3)/3.2)),scale = 0.9+0.36*t*t
            let y = bottle.spec.startYRatio*viewport.height+(viewport.height*1.24-bottle.spec.startYRatio*viewport.height)*t*t
            bottle.mover.center = CGPoint(x: bottle.spec.path[0]/100*bounds.width,y: -0.09*bounds.height+bottle.mover.bounds.height/2+y)
            bottle.mover.transform = CGAffineTransform(scaleX: scale,y: scale)
            bottle.mover.alpha = time >= 0.3 && time < 3.5 ? 1 : 0
            let weave = (NativeBottleFinaleMotion.crossing(bottle.spec.path,progress: t)-bottle.spec.path[0])/100*viewport.width
            let segment = min(3,Int(t*4)),p = NativeBoardMotion.Ease.sineInOut.sample(t*4-CGFloat(segment))
            let rotation = bottle.angles[segment]+(bottle.angles[segment+1]-bottle.angles[segment])*p
            bottle.image.layer.position = CGPoint(x: bottle.mover.bounds.width/2+weave,y: bottle.mover.bounds.height*0.82)
            bottle.image.transform = CGAffineTransform(rotationAngle: rotation * .pi/180)
        }
        for trail in trails where !trail.retired {
            let local = time-0.3-trail.delay
            guard local >= 0 else { continue }
            if local >= 0.06+trail.travel { trail.image.alpha = 0; trail.retired = true; continue }
            if trail.origin == nil {
                let bottle = bottles[trail.bottleIndex]
                let rect = bottle.image.convert(bottle.image.bounds,to: self)
                guard rect.width > 1,rect.height > 1 else { continue }
                trail.origin = CGPoint(x: (rect.minX+rect.width*trail.port+(roll()-0.5)*6).rounded(),
                                       y: (rect.minY+rect.height*(0.72+roll()*0.18)).rounded())
                trail.rise = rect.height*(0.16+roll()*0.08)
            }
            let origin = trail.origin!,enter = NativeBoardMotion.Ease.backOut(2).sample(local/0.06)
            let p = min(1,max(0,(local-0.06)/trail.travel))
            let x = NativeBottleFinaleMotion.keyframes([0,trail.direction*5,-trail.direction*9,trail.direction*12,trail.direction*6],progress: p)
            let y = NativeBottleFinaleMotion.keyframes([0,trail.push,-trail.rise*0.28,-trail.rise*0.68,-trail.rise],progress: p)
            var scale = local < 0.06 ? trail.startScale*enter : NativeBottleFinaleMotion.keyframes([trail.startScale,trail.startScale*1.08,trail.startScale*1.35,trail.endScale*0.88,trail.endScale],progress: p)
            var alpha = trail.alpha*min(1,max(0,enter))
            let popStart = 0.06+trail.travel-0.08
            if local >= popStart {
                let initial = NativeBottleFinaleMotion.keyframes([trail.startScale,trail.startScale*1.08,trail.startScale*1.35,trail.endScale*0.88,trail.endScale],progress: (popStart-0.06)/trail.travel)
                let collapse = NativeBoardMotion.Ease.backIn(3).sample((local-popStart)/0.08)
                scale = initial*(1-collapse); alpha = trail.alpha*(1-collapse)
            }
            pose(trail.image,size: trail.size,center: CGPoint(x: origin.x+x,y: origin.y+y),scale: scale,alpha: alpha)
        }
        for (index,bubble) in bubbles.enumerated() where !retiredBubbles.contains(index) {
            let local = time-bubble.delay
            guard local >= 0 else { continue }
            if local >= bubble.pop+0.14 { bubble.image.alpha = 0; retiredBubbles.insert(index); continue }
            let grow = NativeBoardMotion.Ease.backOut(2).sample(local/0.12)
            let p = min(1,max(0,(local-0.12)/bubble.travel))
            let x = NativeBottleFinaleMotion.keyframes([0,bubble.direction*bubble.weave*0.55,-bubble.direction*bubble.weave*0.8,bubble.direction*bubble.weave,-bubble.direction*bubble.weave*0.7,bubble.direction*bubble.weave*0.3],progress: p)
            let y = NativeBottleFinaleMotion.keyframes([0,-bubble.rise*0.18,-bubble.rise*(bubble.pause ? 0.43 : 0.38),-bubble.rise*(bubble.pause ? 0.49 : 0.6),-bubble.rise*(bubble.pause ? 0.7 : 0.8),-bubble.rise],progress: p)
            var scale = bubble.startScale*grow,alpha = bubble.alpha*min(1,max(0,grow))
            let popAlpha = min(0.7,bubble.alpha+0.06)
            if local >= bubble.pop && local < bubble.pop+0.06 {
                let p = NativeBoardMotion.Ease.power2Out.sample((local-bubble.pop)/0.06)
                scale = bubble.startScale+(1.2-bubble.startScale)*p; alpha = bubble.alpha+(popAlpha-bubble.alpha)*p
            } else if local >= bubble.pop+0.06 {
                let p = NativeBoardMotion.Ease.backIn(3).sample((local-bubble.pop-0.06)/0.08)
                scale = 1.2*(1-p); alpha = popAlpha*(1-p)
            }
            pose(bubble.image,size: bubble.size,center: CGPoint(x: bubble.origin.x+x,y: bubble.origin.y+y),scale: scale,alpha: alpha)
        }
        glyphs.paint(seconds: seconds)
    }
    private func pose(_ image: UIImageView,size: CGFloat,center: CGPoint,scale: CGFloat,alpha: CGFloat) {
        image.bounds = CGRect(x: 0,y: 0,width: size,height: size); image.layer.position = center
        image.transform = CGAffineTransform(scaleX: scale,y: scale); image.alpha = min(1,max(0,alpha))
    }
}
