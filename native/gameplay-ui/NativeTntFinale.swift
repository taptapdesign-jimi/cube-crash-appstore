import SpriteKit
import UIKit

/// Core TNT's accepted layered smoke and all sixteen authored die lanes.
/// Native skin-specific scenes use their own owners; they never silently
/// inherit this core presentation. Source: src/modules/tnt-animation.ts.
@MainActor
final class NativeTntFinale: SKNode, NativeSourceAnimationParticipant {
    static let duration: TimeInterval = 4.2
    static let smokeScale: Double = 1.4 * 1.2
    var onGlyphClock: ((TimeInterval,Bool) -> Void)?
    private struct Frame {
        let sprite: SKSpriteNode
        let index: Int
        let size: CGFloat
        var bounceSize: CGFloat?
        var bounceY: CGFloat?
    }
    struct DiePlan {
        var value: Int; var size: Double; var depth: Double
        var angle: Double; var distance: Double; var curve: Double
        var startX: Double; var startY: Double; var startRotation: Double; var rotationTravel: Double
        var startScale: Double; var peakScale: Double; var endScale: Double
        var delay: Double; var duration: Double
    }
    struct SourceConstruction {
        struct FrameRecipe {
            let index:Int,handle:NativeBoardTextures.SourceTextureHandle,logicalSize:CGSize
            let rotation:Double,scale:Double
        }
        let frames:[FrameRecipe]
        let dice:[DiePlan]
    }
    /// Actual resources precede entropy; UIKit glyphs then authored dice plans
    /// then per-frame initial draws. Later bounce/exit draws stay with callbacks.
    static func captureSourceConstruction(textures:NativeBoardTextures,current:()->Bool,
        random:()->Double,prepareGlyphs:()->Bool)->SourceConstruction? {
        enum Refused:Error {case retired}
        var retained:[(Int,NativeBoardTextures.SourceTextureHandle,CGSize)]=[]
        for index in 0..<12 {
            guard current() else{return nil}
            let path="assets/shop/explosion pack/animation/tnt\(index+1).png"
            guard textures.texture(path) != nil,current(),let logical=textures.logicalSize(path),
                  let handle=textures.captureSourceCachedTextureHandle(path:path),
                  textures.isSourceTextureHandleCurrent(handle),current() else{return nil}
            retained.append((index,handle,logical))
        }
        func admitted()->Bool {current() && retained.allSatisfy{textures.isSourceTextureHandleCurrent($0.1)}}
        func draw()throws->Double {
            guard admitted() else{throw Refused.retired};let roll=random()
            guard admitted(),roll.isFinite,roll>=0,roll<1 else{throw Refused.retired};return roll
        }
        guard admitted(),prepareGlyphs(),admitted() else{return nil}
        do {
            let dice=try makeDiePlans(next:draw)
            var frames:[SourceConstruction.FrameRecipe]=[]
            for (index,handle,size) in retained {
                let rotation=(try draw()-0.5)*20 * .pi/180
                // Preserve the accepted Native smoke-only enlargement.
                let scale=(1+0.52*(try draw()))*smokeScale
                frames.append(.init(index:index,handle:handle,logicalSize:size,rotation:rotation,scale:scale))
            }
            guard admitted() else{return nil};return .init(frames:frames,dice:dice)
        } catch {return nil}
    }
    private struct Die { let node: SKNode; let plan: DiePlan }
    private struct Letter {
        let node: SKLabelNode; let index: Int
        let bounceSize: CGFloat; let exitRotation: CGFloat
    }
    private var sourceRecipeEnabled=false
    private var sourceRecipeRandom:(()->Double)?
    private var frames: [Frame] = []
    private var dice: [Die] = []
    private var letters: [Letter] = []
    private let title = SKNode()
    private let center: CGPoint
    private let frameExitStart = 1.01
    private let titleExitStart: TimeInterval
    private var disposed = false
    private var finishedFrames = Set<Int>()
    private var finishedDice = Set<Int>()
    private var finishedLetters = Set<Int>()

    init(textures: NativeBoardTextures, fontName: String, viewport: CGSize, showsTitle: Bool = true,sourceConstruction:SourceConstruction?=nil,sourceRandom:(()->Double)?=nil, random: () -> Double = { Double.random(in: 0..<1) }) {
        center = CGPoint(x: viewport.width/2,y: viewport.height/2)
        titleExitStart = 0.3 + 3*0.05 + 0.3 + 0.12 + 0.12
        super.init()
        name = "native-core-tnt-finale"
        title.isHidden = !showsTitle
        sourceRecipeEnabled=sourceConstruction != nil;sourceRecipeRandom=sourceRandom
        if sourceConstruction == nil {
        let text = "BOOM"
        let buckets: [[Double]] = [[92,98,104],[66,72,80],[30,36,44,50],[66,72,80],[92,98,104],[30,36,44,50],[66,72,80],[30,36,44,50],[92,98,104]]
        let offset = Int(random()*Double(buckets.count)) % buckets.count
        title.position = center; title.zPosition = 100
        title.zRotation = -(random()-0.5)*30 * .pi/180; addChild(title)
        var x: CGFloat = 0
        for (index, character) in text.enumerated() {
            let bucket = buckets[(index+offset)%buckets.count]
            let size = max(index == 0 ? 75 : 28, bucket[min(bucket.count-1,Int(random()*Double(bucket.count)))] + random()*10-5)
            let letter = SKLabelNode(fontNamed: fontName)
            letter.text = String(character); letter.fontSize = size
            letter.fontColor = UIColor(red: 241.0/255,green: 132.0/255,blue: 83.0/255,alpha: 1)
            letter.verticalAlignmentMode = .center; letter.horizontalAlignmentMode = .center
            let width = letter.frame.width
            letter.position.x = x + width/2
            x += width - 4.2
            letter.alpha = 0; title.addChild(letter)
            letters.append(Letter(node: letter,index: index,bounceSize: 1.02+random()*0.06,exitRotation: -(12+random()*8) * .pi / 180))
        }
        for letter in letters { letter.node.position.x -= (x+4.2)/2 }
        }
        if let sourceConstruction {
            for recipe in sourceConstruction.frames {
                let sprite=SKSpriteNode(texture:recipe.handle.texture)
                sprite.size=recipe.logicalSize;sprite.position=center;sprite.zPosition=CGFloat(recipe.index)
                sprite.zRotation = -recipe.rotation;sprite.alpha=0;sprite.setScale(0);addChild(sprite)
                frames.append(.init(sprite:sprite,index:recipe.index,size:CGFloat(recipe.scale),bounceSize:nil,bounceY:nil))
            }
        } else {for index in 0..<12 {
            let path = "assets/shop/explosion pack/animation/tnt\(index+1).png"
            guard let texture = textures.texture(path), let size = textures.logicalSize(path) else { continue }
            let sprite = SKSpriteNode(texture: texture)
            sprite.size = size; sprite.position = center; sprite.zPosition = CGFloat(index)
            sprite.zRotation = -(random()-0.5)*20 * .pi/180
            sprite.alpha = 0; sprite.setScale(0); addChild(sprite)
            // User-approved smoke-only enlargement; dice/title retain their original scale.
            let scale = (1 + random()*0.52)*Self.smokeScale
            frames.append(Frame(sprite: sprite,index: index,size: scale,bounceSize: scale*(1.02+random()*0.06),bounceY: (random()-0.5)*4))
        }
        }
        let tileTexture = textures.texture("assets/tile.png")
        let maps = [1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]]
        for plan in sourceConstruction?.dice ?? Self.makeDiePlans(random: random) {
            let die = SKNode(); die.zPosition = plan.depth; die.alpha = 0
            let face = SKSpriteNode(texture: tileTexture); face.size = CGSize(width: 64,height: 64); die.addChild(face)
            for index in maps[plan.value] ?? [] {
                let x = CGFloat(index%3-1)*15, y = -CGFloat(index/3-1)*15
                let pip = SKShapeNode(rect: CGRect(x: x-3.75,y: y-3.75,width: 7.5,height: 7.5),cornerRadius: 2.2)
                pip.fillColor = UIColor(red: 129.0/255,green: 90.0/255,blue: 66.0/255,alpha: 0.9); pip.strokeColor = .clear
                die.addChild(pip)
            }
            addChild(die); dice.append(Die(node: die,plan: plan))
        }
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private var completion: (() -> Void)?
    private var sourceLease: NativeSourceAnimationClockService.Lease?
    private var sourceCurrent: (() -> Bool)?
    private var sourceFrameSix: (() -> Void)?
    private var sourceFrameSixEnterCompleted=false
    private var sourceSequenceComplete:(()->Void)?
    private var sourceSequenceCompleted=false
    private var sourceCancelled: (() -> Void)?
    private var sourceInstallation = UUID()
    /// The actual Source parent timeline owns both composition sampling and
    /// frame-six completion. No SpriteKit wait races this APP clock.
    func playSource(service: NativeSourceAnimationClockService, current: @escaping () -> Bool,
                    frameSix: @escaping () -> Void, sequenceComplete:(()->Void)?=nil,cancelled: (() -> Void)? = nil,
                    completion: @escaping () -> Void) -> Bool {
        guard !disposed, self.completion == nil, current(), !disposed else { return false }
        self.completion = completion; sourceCurrent = current; sourceFrameSix = frameSix;sourceSequenceComplete=sequenceComplete; sourceCancelled = cancelled
        let installation = UUID(); sourceInstallation = installation
        guard let lease = service.register(participant: self, duration: Self.duration,
            domain: .sourceGSAP(.timeline), cleanup: { [weak self] success in
                guard let self, self.sourceInstallation == installation else { return }
                self.sourceLease = nil
                let completed = success && self.sourceCurrent?() == true && !self.disposed
                if completed { self.sourceCancelled = nil }
                if !completed { self.completion = nil }
                self.dispose()
            }) else {
            self.completion = nil; sourceCurrent = nil; sourceFrameSix = nil; sourceCancelled = nil; return false
        }
        guard sourceInstallation == installation, !disposed, current(), !disposed else {
            lease.cancel(success: false); return false
        }
        sourceLease = lease; return true
    }
    func advanceSourceAnimation(seconds: Double) {
        guard !disposed, sourceCurrent?() == true, !disposed else { return }
        paint(time: seconds)
        guard !disposed,sourceCurrent?()==true else{return}
        if sourceFrameSixEnterCompleted {
            let callback=sourceFrameSix;sourceFrameSix=nil;callback?()
        }
        guard !disposed,sourceCurrent?()==true else{return}
        if sourceSequenceCompleted {
            let callback=sourceSequenceComplete;sourceSequenceComplete=nil;callback?()
        }
    }
    func play(completion: @escaping () -> Void) {
        guard !disposed,self.completion == nil else { return }
        self.completion = completion
        run(.sequence([.customAction(withDuration: Self.duration) { [weak self] _, elapsed in self?.paint(time: Double(elapsed)) },
            .run { [weak self] in guard let self, !self.disposed else { return }; self.dispose() }]),withKey: "tnt-composition")
    }

    private func paint(time: TimeInterval) {
        guard !disposed else { return }
        onGlyphClock?(time,false)
        guard !disposed,!sourceRecipeEnabled || sourceCurrent?()==true else{return}
        for frameOffset in frames.indices where !finishedFrames.contains(frames[frameOffset].index) {
            var frame=frames[frameOffset]
            if sourceRecipeEnabled,time>=0.07+Double(frame.index)*0.04+0.34,frame.bounceSize==nil {
                guard let random=sourceRecipeRandom,sourceCurrent?()==true else{return}
                let scaleRoll=random()
                guard !disposed,sourceCurrent?()==true,scaleRoll.isFinite,scaleRoll>=0,scaleRoll<1,
                      frames.indices.contains(frameOffset),frames[frameOffset].sprite === frame.sprite else{return}
                let yRoll=random()
                guard !disposed,sourceCurrent?()==true,yRoll.isFinite,yRoll>=0,yRoll<1,
                      frames.indices.contains(frameOffset),frames[frameOffset].sprite === frame.sprite else{return}
                frame.bounceSize=frame.size*CGFloat(1.02+scaleRoll*0.06);frame.bounceY=CGFloat((yRoll-0.5)*4)
                frames[frameOffset]=frame
            }
            let enter = 0.07+Double(frame.index)*0.04, settle = enter+0.24
            let exit = frameExitStart+Double(frame.index)*0.04
            if time < enter { continue }
            // .51 is frame-six ENTER completion; settle follows at .61.
            if frame.index == 5,time >= settle,frame.sprite.parent === self {sourceFrameSixEnterCompleted=true}
            if time >= exit+0.30 {
                frame.sprite.alpha = 0; frame.sprite.setScale(0); finishedFrames.insert(frame.index)
                if frame.index==11,frame.sprite.parent === self {sourceSequenceCompleted=true}
                continue
            }
            var scale: CGFloat = 0, alpha: CGFloat = 0, y = center.y
            if time >= enter && time < settle {
                let eased = NativeBoardMotion.Ease.backOut(2).sample((time-enter)/0.24)
                scale = frame.size*1.2*eased; alpha = eased
            } else if time >= settle && time < settle+0.1 {
                let eased = NativeBoardMotion.Ease.power2Out.sample((time-settle)/0.1)
                scale = frame.size*(1.2-0.2*eased); alpha = 1
            } else if time >= settle+0.1 {
                // Killing idle tweens at the authored exit retains the final
                // sampled scale/y throughout the alpha-only .13s lead.
                let phase = (min(time,exit)-settle-0.1).truncatingRemainder(dividingBy: 0.8)/0.4
                let progress = phase <= 1 ? phase : 2-phase
                let held = Self.elasticInOut(progress,period: 0.25)
                scale = frame.size+((frame.bounceSize ?? frame.size)-frame.size)*held; alpha = 1
                y -= (frame.bounceY ?? 0)*held
                if time >= exit+0.13 {
                    let local = (time-exit-0.13)/0.17
                    let eased = NativeBoardMotion.Ease.backIn(2).sample(local)
                    scale *= 1-eased; alpha = 1-eased
                }
            }
            frame.sprite.xScale = scale; frame.sprite.yScale = scale*1.4
            frame.sprite.alpha = min(1,max(0,alpha)); frame.sprite.position.y = y
        }
        for (index,die) in dice.enumerated() where !finishedDice.contains(index) {
            let plan = die.plan
            if time < plan.delay { continue }
            if time >= plan.delay+plan.duration { die.node.alpha = 0; finishedDice.insert(index); continue }
            let p = (time-plan.delay)/plan.duration
            let impulse = 1-pow(1-p,2.35), envelope = sin(.pi*p)*plan.curve
            die.node.position = CGPoint(x: center.x+plan.startX+cos(plan.angle)*plan.distance*impulse-sin(plan.angle)*envelope,
                y: center.y-plan.startY-sin(plan.angle)*plan.distance*impulse-cos(plan.angle)*envelope-28*p*p)
            die.node.zRotation = -(plan.startRotation+plan.rotationTravel*impulse)
            let pop = min(1,p/0.12), fade = max(0,(p-0.78)/0.22)
            let live = plan.startScale+(plan.peakScale-plan.startScale)*pop
            die.node.setScale(plan.size/64*(live+(plan.endScale-live)*fade)); die.node.alpha = pop*(1-fade)
        }
        for letter in letters where !finishedLetters.contains(letter.index) {
            let enter = 0.3+Double(letter.index)*0.05
            let exit = titleExitStart+Double(letter.index)*0.06
            if time < enter { continue }
            if time >= exit+0.60 { letter.node.alpha = 0; letter.node.setScale(0); finishedLetters.insert(letter.index); continue }
            var scale: CGFloat = 0, alpha: CGFloat = 0
            if time >= enter && time < enter+0.3 {
                let eased = NativeBoardMotion.Ease.backOut(2).sample((time-enter)/0.3)
                scale = 1.2*eased; alpha = eased
            } else if time >= enter+0.3 && time < enter+0.42 {
                scale = 1.2-0.25*NativeBoardMotion.Ease.power2Out.sample((time-enter-0.3)/0.12); alpha = 1
            } else if time >= enter+0.42 && time < enter+0.54 {
                scale = 0.95+0.05*NativeBoardMotion.Ease.backOut(1.5).sample((time-enter-0.42)/0.12); alpha = 1
            } else if time >= enter+0.54 && time < exit {
                let phase = (time-enter-0.54).truncatingRemainder(dividingBy: 0.7)/0.35
                scale = 1+(letter.bounceSize-1)*Self.elasticInOut(phase <= 1 ? phase : 2-phase,period: 0.2); alpha = 1
            } else if time >= exit && time < exit+0.19 {
                scale = 1+0.1*NativeBoardMotion.Ease.power2Out.sample((time-exit)/0.19); alpha = 1
            } else if time >= exit+0.19 && time < exit+0.60 {
                let eased = NativeBoardMotion.Ease.power2In.sample((time-exit-0.19)/0.41)
                scale = 1.1*(1-eased); alpha = 1-eased; letter.node.zRotation = letter.exitRotation*eased
            }
            letter.node.setScale(scale); letter.node.alpha = min(1,max(0,alpha))
        }
    }

    private static func elasticInOut(_ progress: Double, period: Double) -> CGFloat {
        func out(_ p: Double) -> Double { p == 1 ? 1 : pow(2,-10*p)*sin((p-period/4)*(.pi*2/period))+1 }
        return progress < 0.5 ? (1-out(1-progress*2))/2 : 0.5+out((progress-0.5)*2)/2
    }

    static func makeDiePlans(random: () -> Double) -> [DiePlan] {
        // Raw callers cannot throw; Source uses the guarded overload below.
        try! makeDiePlans(next:random)
    }
    static func makeDiePlans(next random:()throws->Double)throws->[DiePlan] {
        let slots: [(Double,Double)] = [(-120,-90),(-35,-135),(55,-130),(130,-75),(-155,5),(155,10),(-120,95),(120,100),
            (-35,145),(55,150),(-175,145),(175,155),(-185,-150),(185,-145),(-222,126),(-148,84)]
        let delays = [0.14,0.18,0.22,0.26,0.36,0.42,0.48,0.54,0.60,0.66,0.72,0.78,0.84,0.90,0.34,0.42]
        let depths = [11.5,10.5,9.5,8.5,7.5,6.5,5.5,4.5,3.5,2.5,1.5,0.5,11.25,6.25,11.4,11.3]
        var entropy: [Double] = []
        var plans: [DiePlan] = try slots.enumerated().map { index, slot in
            let x = slot.0*0.5+((try random())-0.5)*6, y = slot.1*0.5+((try random())-0.5)*6, jitter = ((try random())-0.5)*0.2
            entropy.append(jitter)
            return DiePlan(value: 1+Int(min(0.999999,max(0,(try random())))*6),size: 36+(try random())*22,depth: depths[index],
                angle: atan2(y,x)+jitter,distance: 95+(try random())*70,curve: (index%2 == 0 ? -1 : 1)*(10+(try random())*16),
                startX: x,startY: y,startRotation: ((try random())-0.5)*0.78,rotationTravel: ((try random())<0.5 ? -1 : 1)*(1.25+(try random())*2.15),
                startScale: 0.44+(try random())*0.28,peakScale: 0.88+(try random())*0.42,endScale: 0.38+(try random())*0.38,
                delay: delays[index]+(try random())*0.018,duration: (0.82+(try random())*0.22)*0.88)
        }
        func pin(_ index: Int,_ x: Double,_ y: Double,_ delay: Double,_ duration: Double,_ distance: Double,_ curve: Double) {
            plans[index].startX = x; plans[index].startY = y; plans[index].delay = delay
            plans[index].duration = duration; plans[index].distance = distance; plans[index].curve = curve
        }
        pin(0,-38,4,0.32,0.88,72,-12); pin(12,38,-4,0.40,0.96*0.88,72,12); pin(1,0,48,0.36,0.98*0.88,78,10)
        pin(14,-111,63,0.34,0.94*0.88/1.35,76,-10); pin(15,-74,42,0.42,0.94*0.88/1.35,76,-10)
        plans[14].size = 36; plans[15].size = 36; entropy[14] = 0; entropy[15] = 0
        let pinned: Set<Int> = [0,1,12,14,15]
        for _ in 0..<24 { for first in 0..<14 { for second in (first+1)..<14 {
            let dx = plans[second].startX-plans[first].startX, dy = plans[second].startY-plans[first].startY
            let distance = max(0.001,hypot(dx,dy)), minimum = (plans[first].size+plans[second].size)*0.5+3
            if distance >= minimum || (pinned.contains(first) && pinned.contains(second)) { continue }
            let push = minimum-distance
            if !pinned.contains(first) {
                let amount = pinned.contains(second) ? push : push*0.5
                plans[first].startX -= dx/distance*amount; plans[first].startY -= dy/distance*amount
            }
            if !pinned.contains(second) {
                let amount = pinned.contains(first) ? push : push*0.5
                plans[second].startX += dx/distance*amount; plans[second].startY += dy/distance*amount
            }
        } } }
        for index in plans.indices { plans[index].angle = atan2(plans[index].startY,plans[index].startX)+entropy[index] }
        return plans
    }

    func dispose() {
        guard !disposed else { return }
        // Explicit destruction is cancellation, never a positive APP finish.
        if sourceLease != nil { completion = nil }
        sourceInstallation = UUID()
        let captured = sourceLease; sourceLease = nil
        sourceCurrent = nil; sourceFrameSix = nil;sourceSequenceComplete=nil;sourceRecipeRandom=nil; captured?.cancel(success: false)
        disposed = true; onGlyphClock?(Self.duration,true); onGlyphClock = nil; removeAllActions(); removeAllChildren(); removeFromParent()
        frames.removeAll(); dice.removeAll(); letters.removeAll()
        let cancelled = sourceCancelled; sourceCancelled = nil
        let finished = completion; completion = nil; cancelled?(); finished?()
    }
}
