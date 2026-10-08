import SpriteKit
import UIKit

@MainActor
final class NativeDiceNode: SKNode {
    let tileID: String
    private(set) var value: Int
    private(set) var kind: String
    private(set) var variant: String?
    private(set) var depth: Int
    private(set) var locked: Bool
    let visual = SKNode()
    private let face = SKSpriteNode()
    private let pips = SKNode()
    private let stack = SKNode()
    private let shadow = SKSpriteNode()
    private let artwork = SKSpriteNode()
    private let flowerCanvas = SKNode()
    private let flowerRoot = SKNode()
    private let flowerScale = SKNode()
    private let flowerRotation = SKNode()
    private let flowerArt = SKSpriteNode()
    private var kantaIdle: NativeKantaDiceIdle?
    private var mushroomSmoke:NativeMushroomDiceSmoke?
    private var spaceshipEngine:NativeSpaceshipDiceIdle?
    private var honeyIdle:NativeHoneyDiceIdle?
    private var fishMediaReady=false
    private var idleFizz:NativeIdleBubbleField?
    private let spaceshipRoot=SKNode()
    private let textures: NativeBoardTextures
    private var definition: NativeDiceArtwork
    private var frames: [SKTexture] = []
    private var paintedFrame = -1
    private var artworkGeneration = 0
    private var disposed = false
    private var cuberoElapsed:TimeInterval = 0
    private var bottleElapsed:TimeInterval = 0
    private var spaceshipElapsed:TimeInterval = 0
    private var elapsed: TimeInterval = 0
    private var dragging = false
    private var artworkPhaseID:Int?
    private var artworkRunning=false,artworkElapsed:TimeInterval=0
    var onResourceReady: (() -> Void)?

    init(id: String, value: Int, kind: String, variant: String?, depth: Int, locked: Bool,
         textures: NativeBoardTextures) {
        tileID = id; self.value = value; self.kind = kind; self.variant = variant
        self.depth = depth; self.locked = locked; self.textures = textures
        let hash = id.utf8.reduce(UInt64(5381)) { ($0 &* 33) &+ UInt64($1) }
        definition = NativeDiceArtwork.definition(kind: kind, variant: variant, regularSkin: Int(hash % 4))
        super.init()
        name = "native-die-\(id)"
        visual.name = "die-visual"
        shadow.texture = textures.texture("assets/shadow.png")
        shadow.size = CGSize(width: 128 * 1.42 * 0.7 * 1.1, height: 128 * 1.42 * 0.7 * 1.1)
        shadow.alpha = 0; shadow.zPosition = -20
        addChild(shadow); addChild(visual)
        visual.addChild(stack); visual.addChild(face); visual.addChild(pips); visual.addChild(artwork)
        visual.addChild(spaceshipRoot)
        visual.addChild(flowerCanvas); flowerCanvas.zPosition = 2; flowerCanvas.isHidden = true
        flowerCanvas.addChild(flowerRoot); flowerRoot.addChild(flowerScale)
        flowerScale.addChild(flowerRotation); flowerRotation.addChild(flowerArt)
        stack.zPosition = -5; pips.zPosition = 1; artwork.zPosition = 2
        rebuild()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    var hasAnimatedArtwork: Bool {
        !disposed && ((!frames.isEmpty && definition.idleSheet != nil) || variant == "bee" || variant == "flower" || variant == "cubero" || variant == "bottle" || variant == "spaceship" || variant == "fish" && artworkPhaseID != nil && !artworkRunning || honeyIdle?.hasActiveMotion==true || idleFizz?.isRunning==true || mushroomSmoke != nil || kantaIdle?.assetReady == true)
    }
    var hasPresentationActions: Bool { hasActions() || visual.hasActions() || shadow.hasActions() }
    var resourcePaths: Set<String> {
        var paths: Set<String> = [definition.path, "assets/shadow.png"]
        if let sheet = definition.idleSheet { paths.insert(sheet.path) }
        if variant == "kanta" { paths.formUnion(["assets/shop/kanta/02.png","assets/shop/kanta/04.png"]) }
        if variant == "flower" { paths.insert("assets/shop/bush/flower-pixi-source.png") }
        if variant == "spaceship" {paths.formUnion((1...4).map {"assets/shop/spaceship/spaceship-idle\($0).png"})}
        if variant == "honey" {paths.formUnion((1...7).map {"assets/shop/honey/bee\($0).png"})}
        return paths
    }

    func update(value: Int, kind: String, variant: String?, depth: Int, locked: Bool) {
        guard !disposed else { return }
        guard self.value != value || self.kind != kind || self.variant != variant || self.depth != depth || self.locked != locked else { return }
        self.value = value; self.depth = depth; self.locked = locked
        let identityChanged = self.kind != kind || self.variant != variant
        self.kind = kind; self.variant = variant
        if identityChanged {
            if let id=artworkPhaseID {textures.releaseIdlePhase(id)}
            fishMediaReady=false
            artworkPhaseID=nil;artworkRunning=false;artworkElapsed=0
            kantaIdle?.dispose(); kantaIdle = nil;mushroomSmoke?.dispose();mushroomSmoke=nil;spaceshipEngine?.dispose();spaceshipEngine=nil;honeyIdle?.dispose();honeyIdle=nil;idleFizz?.dispose();idleFizz=nil
            let hash = tileID.utf8.reduce(UInt64(5381)) { ($0 &* 33) &+ UInt64($1) }
            definition = NativeDiceArtwork.definition(kind: kind, variant: variant, regularSkin: Int(hash % 4))
            elapsed = 0; cuberoElapsed = 0; bottleElapsed=0;spaceshipElapsed=0;spaceshipRoot.position = .zero;spaceshipRoot.zRotation=0;face.position = .zero; face.zRotation = 0; frames = []; paintedFrame = -1
        }
        rebuild()
    }

    private func rebuild() {
        if idleFizz==nil,let family=NativeIdleBubbleMotion.family(kind:kind,variant:variant) {
            let field=NativeIdleBubbleField(family:family);idleFizz=field;visual.addChild(field)
        }
        face.texture = textures.texture(value == 0 && !isSpecial ? "assets/tile.png" : definition.path)
        face.size = definition.size; face.anchorPoint = definition.anchor
        let faceHost=variant == "spaceship" ? spaceshipRoot:visual
        if face.parent !== faceHost {face.removeFromParent();faceHost.addChild(face)}
        face.isHidden = false; artwork.isHidden = true
        paintFishVisibility()
        flowerCanvas.isHidden = true
        if variant == "spaceship",spaceshipEngine==nil {
            let engine=NativeSpaceshipDiceIdle();spaceshipEngine=engine;spaceshipRoot.addChild(engine);engine.zPosition = -2
        }
        if variant == "honey",honeyIdle==nil {
            let idle=NativeHoneyDiceIdle(textures:textures);honeyIdle=idle;visual.addChild(idle)
        }
        if variant == "mushroom",mushroomSmoke==nil {
            let smoke=NativeMushroomDiceSmoke();mushroomSmoke=smoke;visual.addChild(smoke);smoke.zPosition = -1
        }
        if variant == "kanta" {
            if kantaIdle == nil {
                let idle = NativeKantaDiceIdle(textures:textures,size:definition.size)
                kantaIdle = idle;visual.addChild(idle);idle.zPosition = 2
            }
            face.isHidden = kantaIdle?.assetReady == true
            kantaIdle?.alpha = locked ? 0.18 : 1
        }
        if variant == "flower" {
            let scale: CGFloat = 128 / 108.36
            flowerCanvas.position = CGPoint(x: -79.33*scale, y: 74.78*scale)
            flowerCanvas.setScale(scale)
            flowerScale.position = CGPoint(x: 80, y: -117)
            flowerRotation.position = CGPoint(x: 0, y: 42)
            flowerArt.texture = textures.texture("assets/shop/bush/flower-pixi-source.png")
            flowerArt.anchorPoint = CGPoint(x: 0, y: 1)
            flowerArt.position = CGPoint(x: -80+25.15, y: 75-20.6)
            flowerArt.size = CGSize(width: 108.36, height: 108.36)
            if flowerArt.texture != nil {admitArtworkPhase(group:"flower-bouncy-pixi",cycle:NativeFlowerMotion.duration)}
            paintFlower()
        }
        face.alpha = locked ? 0.18 : 1
        paintBottle()
        pips.removeAllChildren(); stack.removeAllChildren()
        if !isSpecial && !locked && value > 0 {
            let maps = [1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]]
            for index in maps[min(6,max(1,value))] ?? [] {
                let x = CGFloat(index % 3 - 1) * 25.6
                let y = -CGFloat(index / 3 - 1) * 25.6
                let pip = SKShapeNode(rect: CGRect(x: x - 7.5, y: y - 7.5, width: 15, height: 15), cornerRadius: 6)
                pip.fillColor = UIColor(red: 129.0/255, green: 90.0/255, blue: 66.0/255, alpha: 0.9)
                pip.strokeColor = .clear; pip.isAntialiased = true
                pips.addChild(pip)
            }
            for index in 1..<max(1,min(4,depth)) {
                let layer = SKSpriteNode(texture: face.texture)
                let shrink = 1 - CGFloat(index) * 0.05
                layer.size = CGSize(width: 128 * shrink, height: 128 * shrink)
                layer.alpha = 0.9
                // Persisted ID gives independent, stable layer poses on re-render.
                let seed = CGFloat(tileID.utf8.reduce(index * 7) { ($0 * 31 + Int($1)) % 991 })
                layer.position = CGPoint(x: sin(seed) * (6 + CGFloat(index)*1.6), y: cos(seed) * (5 + CGFloat(index)*1.3))
                layer.zRotation = (index % 2 == 0 ? -1 : 1) * (10 + seed.truncatingRemainder(dividingBy: 10)) * .pi / 180
                layer.zPosition = CGFloat(-10 + index)
                layer.color = UIColor(red: 139.0/255, green: 90.0/255, blue: 43.0/255, alpha: 1)
                layer.colorBlendFactor = 0.25
                stack.addChild(layer)
            }
        }
        artworkGeneration += 1
        let token = artworkGeneration
        if let sheet = definition.idleSheet {
            if !frames.isEmpty { paintArtwork(); return }
            textures.prepare(sheet) { [weak self] loaded in
                guard let self, !self.disposed, token == self.artworkGeneration else { return }
                self.frames = loaded
                if !loaded.isEmpty {self.admitArtworkPhase(group:sheet.path,cycle:sheet.cycle)}
                self.paintArtwork()
                self.onResourceReady?()
            }
        }
    }

    var isSpecial: Bool { kind != "regular" && kind != "normal" && kind != "" }

    /// Literal level-flow ensureActiveFullVisual(tile,true): kill only known
    /// carrier scale owners. Position, rotation, shadow and family cues survive.
    func repairSourceLevelFlowVisual() {
        guard !disposed else{return}
        visual.removeAction(forKey:"stack")
        visual.removeAction(forKey:"source-ordinary-six-hero")
        visual.setScale(1)
        alpha=1;visual.alpha=1;face.alpha=1;pips.alpha=1;pips.isHidden=false
    }

    func setDragging(_ active: Bool) {
        guard !disposed else { return }
        dragging = active
        if active {idleFizz?.stopForPointer()}
        if variant == "cubero" {cuberoElapsed = 0;face.position = .zero;face.zRotation = 0}
        kantaIdle?.setDragging(active);mushroomSmoke?.setDragging(active);honeyIdle?.setDragging(active)
        visual.removeAction(forKey: "stack"); visual.removeAction(forKey: "lift")
        visual.setScale(active ? 1.08 : 1)
        shadow.removeAllActions()
        shadow.run(.fadeAlpha(to: active ? 0.35 : 0, duration: 0.08))
        paintArtwork()
        paintFlower()
        if variant == "bottle" {bottleElapsed=0;paintBottle()}
        paintFishVisibility()
    }

    func updateShadow(direction: CGPoint) {
        guard dragging, !disposed else { return }
        let distance = max(1, hypot(direction.x, direction.y))
        shadow.position = CGPoint(x: direction.x / distance * 12, y: direction.y / distance * 12 - 10)
    }

    func resumeIdleAfterLanding() {
        guard !disposed,!dragging else {return}
        idleFizz?.restartAfterLanding();onResourceReady?()
    }

    func updateIdleDrag(offset:CGPoint,velocity:CGPoint) {honeyIdle?.updateDrag(offset:offset,velocity:velocity)}

    func tick(_ delta: TimeInterval, suspended: Bool, viewportCenter: CGFloat, fizzDelta:TimeInterval?=nil) {
        guard !disposed, !isHidden, alpha > 0, !suspended else { return }
        elapsed += delta
        idleFizz?.tick(fizzDelta ?? delta)
        if let id=artworkPhaseID {
            if !artworkRunning {if textures.advanceIdlePhase(id) {artworkRunning=true;artworkElapsed=0}}
            else {artworkElapsed+=delta}
        }
        if variant == "bee" {
            let time = elapsed
            let index = Int(floor(time / (dragging ? 0.032 : 0.04))) % 4 + 1
            if paintedFrame != index {
                face.texture = textures.texture("assets/shop/bee/bee\(index).png"); paintedFrame = index
            }
            face.xScale = position.x > viewportCenter ? -1 : 1
            if !dragging {
                face.position = CGPoint(x: sin(time * .pi * 1.7) * 2.8, y: -sin(time * .pi * 2.3 + .pi * 0.35) * 5)
                face.zRotation = -sin(time * .pi * 1.9 + .pi * 0.2) * 0.025
                let scale = 1 + sin(time * .pi * 2.6 + .pi * 0.6) * 0.018
                face.yScale = scale; face.xScale *= scale
            } else { face.position = .zero; face.zRotation = 0; face.yScale = 1 }
        } else if variant == "cubero" {
            if !dragging {cuberoElapsed += delta}
            let pose=NativeCuberoIdleMotion.sample(seconds:cuberoElapsed)
            face.position=CGPoint(x:pose.x,y:-pose.y);face.zRotation = -pose.rotation
        } else if variant == "bottle" {
            if !dragging {bottleElapsed+=delta};paintBottle()
        } else if variant == "spaceship" {
            spaceshipElapsed+=delta
            let pose=NativeSpaceshipIdleMotion.sample(seconds:spaceshipElapsed)
            spaceshipRoot.position=CGPoint(x:pose.x,y:-pose.y);spaceshipRoot.zRotation = -pose.rotation
            let frame=NativeSpaceshipIdleMotion.frame(seconds:spaceshipElapsed)
            if paintedFrame != frame,let texture=textures.texture("assets/shop/spaceship/spaceship-idle\(frame+1).png") {face.texture=texture;paintedFrame=frame}
            spaceshipEngine?.paint(seconds:spaceshipElapsed)
        } else if variant == "kanta" { kantaIdle?.tick(delta,globalX:position.x,viewportCenter:viewportCenter) }
        else if variant == "honey" {honeyIdle?.tick(delta)}
        else if variant == "mushroom" {mushroomSmoke?.tick(delta);paintArtwork()}
        else if variant == "flower" { paintFlower() }
        else { paintArtwork() }
    }

    func prepareFishMediaPhase() {
        guard !disposed,variant == "fish" else {return}
        admitArtworkPhase(group:"fish-swim-composition",cycle:1.125);onResourceReady?()
    }
    func setFishMediaReady(_ ready:Bool) {
        guard !disposed,variant == "fish" else {return}
        fishMediaReady=ready
        if !ready {if let id=artworkPhaseID {textures.releaseIdlePhase(id)};artworkPhaseID=nil;artworkRunning=false;artworkElapsed=0}
        paintFishVisibility();onResourceReady?()
    }
    private func paintFishVisibility() {
        guard variant == "fish" else {return}
        face.isHidden=fishMediaReady && !dragging
        idleFizz?.isHidden=fishMediaReady && !dragging
        if !dragging {face.xScale=1}
    }
    func fishFrame(in scene:SKScene,visible:Bool)->NativeFishIdleFrame? {
        guard !disposed,variant == "fish" else {return nil}
        let center=visual.convert(CGPoint.zero,to:scene)
        if dragging {face.xScale=center.x>scene.size.width/2 ? -1:1}
        let horizontal=visual.convert(CGPoint(x:1,y:0),to:scene),vertical=visual.convert(CGPoint(x:0,y:-1),to:scene)
        var branchAlpha:CGFloat=face.alpha
        var ancestor:SKNode?=visual
        var branchVisible=visible
        while let node=ancestor {branchAlpha*=node.alpha;branchVisible=branchVisible && !node.isHidden && node.alpha>0.001;ancestor=node.parent}
        return NativeFishIdleFrame.project(center:center,horizontalUnit:horizontal,verticalUnit:vertical,sceneHeight:scene.size.height,alpha:branchAlpha,dragging:dragging,phaseStarted:artworkRunning,visible:branchVisible,bubbles:idleFizz?.fishBubbleSnapshots ?? [],depth:zPosition,paintOrder:parent?.children.firstIndex(where:{$0 === self}) ?? 0)
    }

    private func admitArtworkPhase(group:String,cycle:TimeInterval) {
        guard artworkPhaseID==nil else {return}
        let phase=textures.reserveIdlePhase(group:group,cycle:cycle)
        artworkPhaseID=phase.id;artworkRunning=phase.running;artworkElapsed=0
    }

    private func paintBottle() {
        guard variant == "bottle" else {return}
        if dragging {face.anchorPoint=definition.anchor;face.position = .zero;face.zRotation=0;return}
        let pose=NativeBottleIdleMotion.sample(seconds:bottleElapsed)
        face.anchorPoint=CGPoint(x:0.5,y:0)
        face.position=CGPoint(x:0,y:-definition.size.height*0.5-pose.y);face.zRotation = -pose.rotation
    }

    private func paintFlower() {
        guard variant == "flower", !disposed else { return }
        flowerCanvas.isHidden = dragging || flowerArt.texture == nil || !artworkRunning
        face.isHidden = !flowerCanvas.isHidden
        guard !flowerCanvas.isHidden else { return }
        let pose = NativeFlowerMotion.sample(seconds: artworkElapsed)
        flowerRoot.position.y = -pose.translateY
        flowerScale.xScale = pose.scaleX; flowerScale.yScale = pose.scaleY
        flowerRotation.zRotation = -pose.rotationDegrees * .pi / 180
    }

    private func paintArtwork() {
        guard !disposed, let sheet = definition.idleSheet, !frames.isEmpty else { return }
        let useFrames = artworkRunning && (!dragging || sheet.animateDuringDrag)
        artwork.isHidden = !useFrames; face.isHidden = useFrames
        guard useFrames else { return }
        let frame = sheet.frame(at: artworkElapsed)
        if frame != paintedFrame { artwork.texture = frames[frame]; paintedFrame = frame }
        artwork.anchorPoint = sheet.anchor
        artwork.size = CGSize(width: sheet.cell.width * sheet.displayScale, height: sheet.cell.height * sheet.displayScale)
        artwork.position.y = sheet.offsetY
    }

    /// Capture only the current authored artwork into plain nodes. SpriteKit's
    /// polymorphic copy would instantiate a second custom idle owner.
    func detachedArtworkCarrier() -> SKNode {
        func capture(_ original:SKNode)->SKNode {
            let node:SKNode
            if let sprite=original as? SKSpriteNode {
                let image=SKSpriteNode(texture:sprite.texture,color:sprite.color,size:sprite.size)
                image.anchorPoint=sprite.anchorPoint;image.colorBlendFactor=sprite.colorBlendFactor;image.blendMode=sprite.blendMode;image.shader=sprite.shader
                node=image
            } else if let shape=original as? SKShapeNode {
                let image=SKShapeNode(path:shape.path ?? CGPath(rect:.zero,transform:nil))
                image.fillColor=shape.fillColor;image.strokeColor=shape.strokeColor;image.lineWidth=shape.lineWidth;image.glowWidth=shape.glowWidth
                image.lineCap=shape.lineCap;image.lineJoin=shape.lineJoin;image.isAntialiased=shape.isAntialiased
                node=image
            } else if let label=original as? SKLabelNode {
                let image=SKLabelNode(fontNamed:label.fontName)
                image.text=label.text;image.attributedText=label.attributedText;image.fontSize=label.fontSize;image.fontColor=label.fontColor
                image.horizontalAlignmentMode=label.horizontalAlignmentMode;image.verticalAlignmentMode=label.verticalAlignmentMode
                node=image
            } else {node=SKNode()}
            node.name=original.name;node.position=original.position;node.zPosition=original.zPosition
            node.xScale=original.xScale;node.yScale=original.yScale;node.zRotation=original.zRotation;node.alpha=original.alpha;node.isHidden=original.isHidden
            for child in original.children {node.addChild(capture(child))}
            return node
        }
        return capture(visual)
    }

    func stackFeedback() {
        guard !disposed else { return }
        visual.removeAllActions(); visual.setScale(1)
        visual.run(NativeBoardMotion.stack(squash: depth % 2 == 0), withKey: "stack")
    }

    func dispose() {
        guard !disposed else { return }
        disposed = true; artworkGeneration += 1
        if let id=artworkPhaseID {textures.releaseIdlePhase(id)}
        artworkPhaseID=nil
        kantaIdle?.dispose(); kantaIdle = nil;mushroomSmoke?.dispose();mushroomSmoke=nil;spaceshipEngine?.dispose();spaceshipEngine=nil;honeyIdle?.dispose();honeyIdle=nil;idleFizz?.dispose();idleFizz=nil
        removeAllActions(); visual.removeAllActions(); shadow.removeAllActions()
        frames.removeAll(); onResourceReady = nil
        removeAllChildren(); removeFromParent()
    }
}
