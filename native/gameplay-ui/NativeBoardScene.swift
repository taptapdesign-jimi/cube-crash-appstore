import SpriteKit
import UIKit
import StackToSixGameplay

/// One native renderer/input owner. The engine is the only decision owner;
/// animation completion never computes a merge, spawn, reward or terminal.
@MainActor
final class NativeBoardScene: SKScene {
    let engine: NativeGameplayEngine
    var onStateChange: ((NativeBoardState) -> Void)?
    var onTerminal: ((NativeResolution) -> Void)?
    var onGameplayEvent: ((NativeGameplayEvent) -> Void)?
    var onGameplayReceipt: ((NativeGameplayEvent,NativeTile?,NativeTile?,UInt64) -> Void)?
    var onSpecialMoment: ((String?,String,Int) -> Void)?
    var onTntGlyphClock: ((String,TimeInterval,Bool) -> Void)?
    var onSplashGlyphClock: ((String,String,TimeInterval,Bool) -> Void)?
    var onHaptic: ((String) -> Void)?
    var onSpecialPresentationCancelled: ((String?) -> Void)?
    var authoredFinalePresentationReady: ((String) -> Bool)?
    var authoredTntPresentationReady: ((String) -> Bool)?
    var onAuthoredLaserImpact: (([NativeLaserVisualTarget],UInt64,@escaping (Int,String) -> Bool,@escaping () -> Void,@escaping () -> Void) -> Bool)?
    var onAuthoredTntPresentation: ((String,CGPoint,UInt64,@escaping () -> Void,@escaping () -> Void) -> Bool)?
    var onAuthoredFinale: ((String,CGPoint,UInt64,@escaping () -> Void) -> Bool)?
    var onExitRequest: (() -> Void)?
    var onHelpRequest: (() -> Void)?
    var onScoreRequest: (() -> Void)?
    var onComboRequest: (() -> Void)?
    var onPointerState: ((Bool) -> Void)?
    var onRenderingDemand: ((Bool) -> Void)?
    var onBoardEntry: ((TimeInterval, [TimeInterval]) -> Void)?
    private let textures: NativeBoardTextures
    private let closeStageFont:UIFont
    private var closeButton:NativeHUDCloseNode?
    private let fontName: String
    private let finaleFontName: String
    private var nodesByID: [String: NativeDiceNode] = [:]
    private let canvasRoot = SKNode()
    private let ghosts = SKNode()
    private let hud = SKNode()
    private let effects = SKNode()
    private let hudStarFlights = SKNode()
    private var hudStarIDs = Set<String>()
    private var meterVisuals: [String:(SKNode,UInt64)] = [:]
    private var hudStarVisualReceipts: [String:UInt64] = [:]
    private let score = SKLabelNode()
    private let scoreArt = SKSpriteNode()
    private let comboArt = SKSpriteNode()
    private let comboX = SKLabelNode()
    private let comboNumber = SKLabelNode()
    private var scoreHitRect = CGRect.zero
    private var comboHitRect = CGRect.zero
    private let roundIndicator: NativeRoundIndicator
    private let noMoves = SKLabelNode()
    private let meter = SKShapeNode()
    private let meterBackground = SKShapeNode()
    private let hover = SKShapeNode()
    private var hoverTargetID: String?
    private var geometry: NativeBoardGeometry?
    var boardGeometry: NativeBoardGeometry? { geometry }
    private var safeInsets = UIEdgeInsets.zero
    private var activeTouch: UITouch?
    private var draggedID: String?
    private var fingerOffset = CGPoint.zero
    private var touchStart = CGPoint.zero
    private var lastTouchPoint = CGPoint.zero
    private var lastPointerTime:TimeInterval=0
    private var pointerVelocity=CGPoint.zero
    private var lastFrame: TimeInterval?
    private var lastGeneration: UInt64?
    private var terminalPresentedGeneration: UInt64?
    private var pendingTerminal: NativeResolution?
    private var pendingTerminalGeneration: UInt64?
    private var visualLifetime: UInt64 = 0
    private var visualOwners = 0
    private var ordinaryAbsorbs:[String:(SKNode,UInt64)] = [:]
    private var ordinaryPostchecks:[String:(SKNode,UInt64)] = [:]
    private var ordinarySpawnVisuals:[String:UInt64] = [:]
    private var ordinaryDeferred:[String:(SKNode,UInt64)] = [:]
    private var ordinaryPrimaryVisuals:[String:(String,String,UInt64)] = [:]
    private struct OrdinarySixVisual {
        let id:String,generation:UInt64,receipt:UInt64
        var committed=false,consuming=false
    }
    var onFishIdleFrames:(([String:NativeFishIdleFrame],UInt64,Bool)->Void)?
    var onJourneyBottomDecorShake:((CGPoint,UInt64)->Void)?
    var reducedBoardEffects=false
    var onPresentationFailure:((String)->Void)?
    private var regularSixPresentations:[String:NativeRegularSixSpritePresentation]=[:]
    private var regularSixShakeID:String?
    private var boardShake=NativeRegularSixSpritePresentation.ShakeReceipt(canvas:.zero,indicator:.zero,bottomDecor:.zero)
    private var ordinarySixVisual:OrdinarySixVisual?
    private var specialPresentationIDs = Set<String>()
    private var laserSpawnCallbacks:[String:() -> Void] = [:]
    private var directFinalReceipt:(String,UInt64,UInt64)?
    private var directPresentationID:String?
    private var directPresentationVariant:String?
    private var specialPresentationID: String?
    private var specialPresentationVariant: String?
    private var candidateSignature: String?
    private(set) var navigationLocked = false
    var isBoardEntryComplete:Bool {!disposed && !entryInProgress && inputAdmitted}
    private var preparedEntryGeneration:UInt64?
    private var inputAdmitted = false
    private var entryInProgress = false
    private var entryOwners = 0
    private var suspended = false
    private var disposed = false
    private var exitInProgress = false
    private var exitCompletion: ((Bool) -> Void)?
    private var exitOwners = 0

    init(engine: NativeGameplayEngine, resourceRoot: URL, size: CGSize) {
        self.engine = engine
        engine.stagedTntActivation = true
        engine.stagedDirectWildMoves = true
        engine.stagedOrdinaryMoves = true
        engine.stagedOrdinaryAssignments = true
        engine.ordinarySixPresentationAdmitted = {UIFont(name:"Arial-BoldMT",size:33) != nil}
        // Reject an unavailable choreography before RNG/reservation/mutation.
        textures = NativeBoardTextures(root: resourceRoot)
        let fonts = JimiV9Artwork(resourceRoot: resourceRoot)
        closeStageFont=fonts.font(size:16)
        fontName = fonts.font(size: 24).fontName
        finaleFontName = fonts.font(size: 24,weight: "ExtraBold").fontName
        roundIndicator = NativeRoundIndicator(font: fonts.font(size: 18,weight: "SemiBold"))
        super.init(size: size)
        scaleMode = .resizeFill; backgroundColor = .clear
        canvasRoot.name="native-gameplay-canvas";addChild(canvasRoot)
        canvasRoot.addChild(ghosts);canvasRoot.addChild(effects);canvasRoot.addChild(hud);canvasRoot.addChild(hudStarFlights)
        hudStarFlights.zPosition = 999999
        hover.fillColor = .clear
        hover.strokeColor = UIColor(red: 138.0/255,green: 110.0/255,blue: 87.0/255,alpha: 0.15)
        hover.zPosition = 14000; hover.isHidden = true; canvasRoot.addChild(hover)
        ghosts.zPosition = -10000; effects.zPosition = 15000; hud.zPosition = 10000
        setupHUD()
        engine.laserTargetX = { [weak self] tile in self?.geometry.map {Double($0.center(row:tile.cell.row,column:tile.cell.column).x)} ?? .nan }
        engine.specialPresentationAdmitted = { [weak self] archetype,variant in
            guard let self else {return false}
            if archetype == .magnet {return true}
            if archetype == .star || archetype == .juice {return self.directArtworkReady(archetype,variant:variant)}
            guard archetype == .tnt else {return false}
            guard let variant else {return true}
            return self.authoredTntPresentationReady?(variant) == true
        }
        engine.finalePresentationAdmitted = { [weak self] archetype,variant in
            guard let self else {return false}
            if let variant {return self.authoredFinalePresentationReady?(variant) == true}
            if archetype == .star || archetype == .juice {return self.directArtworkReady(archetype,variant:nil)}
            return true
        }
    }

    private func directArtworkReady(_ archetype:NativeWildArchetype,variant:String?)->Bool {
        if let variant {return authoredFinalePresentationReady?(variant) == true}
        if archetype == .star {return textures.texture("assets/small-star.png") != nil}
        if archetype == .juice {
            let paths=NativeJuiceBubbleMotion.sources+["casa","poklopac","slamka"].map {"assets/shop/juice/\($0).png"}+(1...8).map {"assets/animations/bubble\($0).png"}
            return paths.allSatisfy {textures.texture($0) != nil}
        }
        return false
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func didMove(to view: SKView) {
        view.isMultipleTouchEnabled = true
        synchronize(animateEntry: lastGeneration == nil)
    }

    func layout(size: CGSize, insets: UIEdgeInsets, animateEntry: Bool = false) {
        guard !disposed else { return }
        guard self.size != size || safeInsets != insets || geometry == nil else { return }
        if exitInProgress { finishExit(completed: false) }
        cancelEntry()
        self.size = size; safeInsets = insets
        cancelDrag()
        geometry = nil
        synchronize(animateEntry: animateEntry)
    }

    func prepareNextBoardEntry() {
        guard !disposed else {return}
        cancelEntry();cancelDrag();cancelCandidate();synchronize()
        preparedEntryGeneration=engine.state.generation
        engine.setInputLock("native-board-entry-handoff",active:true)
        inputAdmitted=false;navigationLocked=true
    }

    func releasePreparedBoardEntry(generation:UInt64) {
        guard !disposed,preparedEntryGeneration == generation,engine.state.generation == generation else {return}
        preparedEntryGeneration=nil;engine.setInputLock("native-board-entry-handoff",active:false)
        synchronize(animateEntry:true)
        navigationLocked=engine.state.terminal != nil || pendingTerminal != nil
        if !entryInProgress {evaluate()}
    }

    private func setupHUD() {
        let brown = UIColor(red: 0.42, green: 0.35, blue: 0.29, alpha: 1)
        for label in [score, noMoves] {
            label.fontName = fontName; label.fontColor = brown
            label.verticalAlignmentMode = .center; hud.addChild(label)
        }
        score.fontSize = 18
        score.horizontalAlignmentMode = .left
        score.fontColor = UIColor(red: 181.0/255,green: 133.0/255,blue: 115.0/255,alpha: 1)
        for label in [comboX,comboNumber] {
            label.fontName = fontName; label.horizontalAlignmentMode = .left; label.verticalAlignmentMode = .center
            label.fontColor = UIColor(red: 231.0/255,green: 116.0/255,blue: 73.0/255,alpha: 1); hud.addChild(label)
        }
        comboX.text = "x"; comboX.fontSize = 14; comboNumber.fontSize = 18
        noMoves.fontSize = 42; noMoves.zPosition = 20000; noMoves.isHidden = true
        let close=NativeHUDCloseNode(texture:textures.texture("assets/close-icon.png"),stageFont:closeStageFont)
        closeButton=close;hud.addChild(close)
        let help = SKSpriteNode(texture: textures.texture("assets/hud/help.png"))
        help.name = "native-game-help"; help.size = CGSize(width: 44, height: 44); hud.addChild(help)
        scoreArt.texture = textures.texture("assets/hud/score-hud.png")
        scoreArt.name = "native-game-score-art"; hud.addChild(scoreArt)
        comboArt.name = "native-game-combo-art"; hud.addChild(comboArt)
        meterBackground.name = "native-game-wild-meter-track"
        meterBackground.fillColor = UIColor(red:234.0/255,green:223.0/255,blue:214.0/255,alpha:1)
        meterBackground.strokeColor = .clear;hud.addChild(meterBackground)
        meter.name = "native-game-wild-meter-fill"
        meter.fillColor = UIColor(red:231.0/255,green:116.0/255,blue:74.0/255,alpha:1)
        meter.strokeColor = .clear; hud.addChild(meter)
        addChild(roundIndicator)
    }

    private func layoutHUD() {
        let chrome = NativeGameplayChromePlan.make(viewport:size,safeTop:safeInsets.top)
        let top = chrome.valueRowY
        closeButton?.layout(valueRowY:top)
        let shift = (size.width*0.05).rounded()
        let spacing: CGFloat = size.width >= 768 ? 110 : 92
        let scoreX = size.width-24-62-spacing-shift
        hud.childNode(withName: "native-game-help")?.position = CGPoint(x: size.width >= 768 ? scoreX-spacing : 118, y: top)
        for icon in [scoreArt,comboArt] {
            let dimensions = icon.texture?.size() ?? CGSize(width: 28,height: 28)
            let scale = 28/max(1,max(dimensions.width,dimensions.height))
            icon.size = CGSize(width: dimensions.width*scale,height: dimensions.height*scale)
        }
        scoreArt.position = CGPoint(x: scoreX,y: top)
        score.position = CGPoint(x: scoreX+scoreArt.size.width/2+6,y: top)
        let comboWidth = comboArt.size.width+4+comboX.frame.width+comboNumber.frame.width
        let comboCenter = size.width-36-comboWidth/2-shift
        comboArt.position = CGPoint(x: comboCenter,y: top)
        comboX.position = CGPoint(x: comboCenter+comboArt.size.width/2+4,y: top)
        comboNumber.position = CGPoint(x: comboX.position.x+comboX.frame.width,y: top)
        scoreHitRect = CGRect(x: scoreX-33,y: top-30,width: 70,height: 60)
        comboHitRect = CGRect(x: comboCenter-53,y: top-30,width: 106,height: 60)
        noMoves.position = CGPoint(x: size.width / 2, y: size.height / 2)
        let rect=chrome.meterRect
        meterBackground.path=CGPath(roundedRect:CGRect(origin:.zero,size:rect.size),cornerWidth:5,cornerHeight:5,transform:nil)
        meterBackground.position=rect.origin;meter.position=rect.origin
        let ratio=NativeGameplayChromePlan.visibleMeterRatio(engine.state.wildMeter)
        meter.isHidden=ratio<=0
        meter.path=CGPath(roundedRect:CGRect(x:0,y:0,width:rect.width*ratio,height:rect.height),cornerWidth:5,cornerHeight:5,transform:nil)
        roundIndicator.position=chrome.roundCenter

    }

    func synchronize(animateEntry: Bool = false) {
        guard !disposed else { return }
        onRenderingDemand?(true)
        let state = engine.state
        if lastGeneration != state.generation {
            retireRegularSixPresentations()
            finishExit(completed: false)
            cancelEntry()
            removeAllActions(); retireEffects(); meterVisuals.removeAll();laserSpawnCallbacks.removeAll();cancelCandidate()
            textures.invalidatePendingPreparation()
            nodesByID.values.forEach { $0.dispose() }; nodesByID.removeAll()
            hudStarFlights.removeAllChildren(); hudStarIDs.removeAll(); hudStarVisualReceipts.removeAll()
            specialPresentationIDs.removeAll(); specialPresentationID = nil;directPresentationID=nil;directPresentationVariant=nil;directFinalReceipt=nil
            ordinaryAbsorbs.removeAll();ordinaryPostchecks.removeAll();ordinarySpawnVisuals.removeAll();ordinaryDeferred.removeAll();ordinaryPrimaryVisuals.removeAll();ordinarySixVisual=nil
            terminalPresentedGeneration = nil; inputAdmitted = !animateEntry
            pendingTerminal = nil; pendingTerminalGeneration = nil; visualLifetime += 1; visualOwners = 0
            navigationLocked = state.terminal != nil
            lastGeneration = state.generation; lastFrame = nil
        }
        if geometry == nil || geometry?.columns != state.columns || geometry?.rows != state.rows {
            geometry = NativeBoardGeometry(columns: state.columns, rows: state.rows,
                bounds: CGRect(x: 24, y: safeInsets.bottom + 73, width: max(1,size.width - 48),
                               height: max(1,size.height - safeInsets.top - safeInsets.bottom - 192)))
        }
        guard let geometry else { return }
        engine.laserViewportWidth=Double(size.width)
        let live = state.tiles.filter { $0.visible && !$0.pendingRemoval && $0.alpha > 0.01 }
        let liveIDs = Set(live.map(\.id))
        for id in Array(nodesByID.keys) where !liveIDs.contains(id) {
            finishOrdinarySpawnVisual(id)
            nodesByID.removeValue(forKey: id)?.dispose()
        }
        for tile in live {
            let node: NativeDiceNode
            if let existing = nodesByID[tile.id] {
                node = existing
                node.update(value: tile.value, kind: tile.gameplayArchetype?.rawValue ?? "regular", variant: tile.variant,
                            depth: tile.stackDepth, locked: tile.locked)
            } else {
                node = NativeDiceNode(id: tile.id, value: tile.value, kind: tile.gameplayArchetype?.rawValue ?? "regular",
                    variant: tile.variant, depth: tile.stackDepth, locked: tile.locked, textures: textures)
                node.onResourceReady = { [weak self] in
                    guard let self, !self.disposed else { return }
                    self.onRenderingDemand?(!self.suspended)
                }
                nodesByID[tile.id] = node; canvasRoot.addChild(node)
            }
            if !entryInProgress || node.action(forKey: "entry") == nil {
                node.setScale(geometry.scale)
                node.alpha = presentationAlpha(tile,state: state)
                if tile.id != draggedID && !specialPresentationIDs.contains(tile.id) { node.position = geometry.center(row: tile.cell.row, column: tile.cell.column) }
            }
            node.zPosition = tile.isWild ? 12001 : CGFloat(tile.cell.row * state.columns + tile.cell.column)
        }
        renderGhosts(state: state, geometry: geometry)
        score.text = String(state.score)
        comboNumber.text = String(state.combo)
        comboArt.texture = textures.texture(state.combo >= 10 ? "assets/hud/mega-combo-hud.png" : state.combo >= 5 ? "assets/hud/extra-combo-hud.png" : "assets/hud/combo-hud.png")
        roundIndicator.synchronize(round:state.stage,arcade:state.mode == .arcade,viewport:size,alpha:state.tutorial?.shouldLockHUD == true ? 0.2:1)
        layoutHUD()
        applyBoardShake(boardShake)
        for child in hud.children where child !== noMoves { child.alpha = state.tutorial?.shouldLockHUD == true ? 0.2 : 1 }
        if animateEntry && !UIAccessibility.isReduceMotionEnabled {
            animateBoardEntry(tiles: live,geometry: geometry)
        } else if !entryInProgress { inputAdmitted = state.terminal == nil && pendingTerminal == nil;roundIndicator.enter(animated:false) }
        if preparedEntryGeneration == state.generation {inputAdmitted=false;navigationLocked=true}
        publishFishIdleFrames(force:true)
    }

    private func presentationAlpha(_ tile: NativeTile,state: NativeBoardState) -> CGFloat {
        guard let tutorial = state.tutorial,tutorial.active,
              tutorial.step == .stack || tutorial.step == .mergeSix,
              !tutorial.guidedPair.contains(tile.id),!tile.isWild else { return CGFloat(tile.alpha) }
        return CGFloat(tile.alpha)*0.2
    }

    private func animateBoardEntry(tiles: [NativeTile],geometry: NativeBoardGeometry) {
        roundIndicator.enter(animated:true)
        let targets = tiles.compactMap { nodesByID[$0.id] }
        let positions = targets.map { CGPoint(x: $0.position.x,y: size.height-$0.position.y) }
        let plans = NativeBoardEntryPlan.make(positions: positions,maxOffset: geometry.tileSize*0.42)
        guard !plans.isEmpty else { inputAdmitted = true; evaluate(); return }
        entryInProgress = true; entryOwners = plans.count; inputAdmitted = false
        let generation = engine.state.generation
        onBoardEntry?((plans.map(\.end).max() ?? 0)+0.03,NativeBoardEntryPlan.hapticBeats(plans))
        for plan in plans {
            let node = targets[plan.tileIndex]
            let rest = node.position, rotation = node.zRotation, alpha = node.alpha
            let start = CGPoint(x: rest.x+plan.offset.x,y: rest.y-plan.offset.y)
            node.position = start; node.zRotation = rotation-plan.rotation; node.setScale(0); node.alpha = 0
            node.run(.sequence([.wait(forDuration: plan.delay),.group([
                NativeBoardMotion.move(from: start,to: rest,duration: 0.42,ease: .backOut(1.7)),
                NativeBoardMotion.rotate(from: rotation-plan.rotation,to: rotation,duration: 0.42,ease: .backOut(1.7)),
                NativeBoardMotion.fade(from: 0,to: alpha,duration: 0.08,ease: .power2Out),
                NativeBoardMotion.enter(base: geometry.scale)
            ]),.run { [weak self,weak node] in
                guard let self,!self.disposed,self.entryInProgress,self.engine.state.generation == generation else { return }
                node?.position = rest; node?.zRotation = rotation; node?.setScale(geometry.scale)
                self.entryOwners = max(0,self.entryOwners-1)
                if self.entryOwners == 0 {
                    self.run(.sequence([.wait(forDuration: 0.03),.run { [weak self] in
                        guard let self,!self.disposed,self.entryInProgress,self.engine.state.generation == generation else { return }
                        self.entryInProgress = false; self.inputAdmitted = true; self.evaluate()
                    }]),withKey: "entry-admission")
                }
            }]),withKey: "entry")
        }
    }

    private func cancelEntry() {
        roundIndicator.cancelExit()
        guard entryInProgress else { return }
        entryInProgress = false; entryOwners = 0; removeAction(forKey: "entry-admission")
        for node in nodesByID.values {
            node.removeAction(forKey: "entry"); node.zRotation = 0
            if let geometry { node.setScale(geometry.scale) }
        }
    }

    private func renderGhosts(state: NativeBoardState, geometry: NativeBoardGeometry) {
        ghosts.removeAllChildren()
        let occupied = Set(state.tiles.filter { !$0.pendingRemoval && $0.visible && $0.alpha > 0.01 }.map(\.cell))
        let texture = textures.texture("assets/tile.png")
        for row in 0..<state.rows {
            for column in 0..<state.columns where !occupied.contains(NativeCell(column: column, row: row)) {
                let ghost = SKSpriteNode(texture: texture)
                ghost.size = CGSize(width: geometry.tileSize, height: geometry.tileSize)
                ghost.alpha = 0.08; ghost.position = geometry.center(row: row, column: column)
                ghosts.addChild(ghost)
            }
        }
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard !disposed, !suspended, activeTouch == nil, draggedID == nil, let touch = touches.first else { return }
        onRenderingDemand?(true)
        let point = touch.location(in: self)
        let canvasPoint=canvasRoot.convert(point,from:self)
        if closeButton?.hitRect.contains(canvasPoint)==true {
            guard inputAdmitted,!navigationLocked,engine.state.tutorial?.shouldLockHUD != true else{return}
            onExitRequest?();return
        }
        if nodes(at:point).contains(where:{$0.name == "native-game-help"}) {
            guard inputAdmitted,!navigationLocked,engine.state.tutorial?.shouldLockHUD != true else {return}
            onHelpRequest?()
            return
        }
        if scoreHitRect.contains(canvasPoint) || comboHitRect.contains(canvasPoint) {
            guard inputAdmitted,!navigationLocked,engine.state.tutorial?.shouldLockHUD != true else { return }
            if comboHitRect.contains(canvasPoint) { onComboRequest?() } else { onScoreRequest?() }
            return
        }
        if beginDrag(at: point) { activeTouch = touch }
    }

    @discardableResult
    func beginDrag(at point: CGPoint) -> Bool {
        let point=canvasRoot.convert(point,from:self)
        guard !disposed, !suspended, !exitInProgress, draggedID == nil, inputAdmitted, let hit = geometry?.cell(at: point),
              let tile = engine.state.tile(at: NativeCell(column: hit.column, row: hit.row)),
              let node = nodesByID[tile.id], engine.beginDrag(tileID: tile.id, pointerID: 1) else { return false }
        onRenderingDemand?(true)
        cancelCandidate()
        draggedID = tile.id; touchStart = point; lastTouchPoint = point
        lastPointerTime=CACurrentMediaTime();pointerVelocity = .zero
        fingerOffset = CGPoint(x: node.position.x - point.x, y: node.position.y - point.y)
        finishOrdinarySpawnVisual(tile.id)
        node.removeAllActions(); node.visual.removeAllActions(); node.zPosition = 18000
        node.setDragging(true)
        publishFishIdleFrames(force:true)
        onPointerState?(true)
        onGameplayEvent?(NativeGameplayEvent(.dragBegan, tileIDs: [tile.id], archetype: tile.gameplayArchetype))
        return true
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = activeTouch, touches.contains(touch) else { return }
        moveDrag(to: touch.location(in: self))
    }

    func moveDrag(to point: CGPoint,now:TimeInterval=CACurrentMediaTime()) {
        let point=canvasRoot.convert(point,from:self)
        guard let id = draggedID, let node = nodesByID[id] else { return }
        node.position = CGPoint(x: point.x + fingerOffset.x, y: point.y + fingerOffset.y)
        let milliseconds=max(1,(now-lastPointerTime)*1000)
        pointerVelocity.x+=((point.x-lastTouchPoint.x)/milliseconds-pointerVelocity.x)*0.10
        pointerVelocity.y+=((lastTouchPoint.y-point.y)/milliseconds-pointerVelocity.y)*0.10
        let scale=max(0.0001,geometry?.scale ?? 1)
        node.updateIdleDrag(offset:CGPoint(x:(point.x-touchStart.x)/scale,y:(touchStart.y-point.y)/scale),velocity:pointerVelocity)
        lastPointerTime=now
        node.updateShadow(direction: CGPoint(x: point.x-lastTouchPoint.x, y: point.y-lastTouchPoint.y))
        lastTouchPoint = point
        guard let geometry, let source = engine.state.tiles.first(where: { $0.id == id }),
              let hit = geometry.cell(at: point),
              let target = engine.state.tile(at: NativeCell(column: hit.column,row: hit.row)),
              NativeGameplayResolver.canDrop(source,onto: target),
              NativeTutorialRules.allowsDrop(source: source,destination: target,tutorial: engine.state.tutorial,rows: engine.state.rows) else { clearHover(); return }
        if hoverTargetID != target.id {
            hoverTargetID = target.id; hover.isHidden = false
            let side = geometry.tileSize
            hover.path = CGPath(roundedRect: CGRect(x: -side/2,y: -side/2,width: side,height: side),
                                cornerWidth: 22*geometry.scale,cornerHeight: 22*geometry.scale,transform: nil)
            hover.lineWidth = 4*geometry.scale
            hover.position = geometry.center(row: target.cell.row,column: target.cell.column)
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = activeTouch, touches.contains(touch) else { return }
        finishDrag(at: touch.location(in: self), now: CACurrentMediaTime())
    }

    @discardableResult
    func finishDrag(at point: CGPoint, now: TimeInterval) -> NativeMoveResult? {
        let point=canvasRoot.convert(point,from:self)
        guard !disposed, let id = draggedID else { return nil }
        let moved = hypot(point.x-touchStart.x, point.y-touchStart.y) >= 5
        let hit = moved ? geometry?.cell(at: point) : nil
        let target = hit.map { NativeCell(column: $0.column, row: $0.row) }
        let oldState = engine.state
        let source = nodesByID[id]
        let sourcePosition = source?.position
        let sourceVisual = source?.detachedArtworkCarrier()
        activeTouch = nil; draggedID = nil; source?.setDragging(false)
        publishFishIdleFrames(force:true)
        onPointerState?(false)
        clearHover()
        let result = engine.drop(target: target, pointerID: 1, now: now)
        if !result.accepted {
            if let tile = oldState.tiles.first(where: { $0.id == id }), let geometry, let source {
                let destination = geometry.center(row: tile.cell.row, column: tile.cell.column)
                let action = NativeBoardMotion.move(from: source.position, to: destination, duration: 0.18, ease: .backOut(1.65))
                source.run(action, withKey: "snapback")
                let generation=engine.state.generation
                source.visual.run(.sequence([NativeBoardMotion.rejectedLanding(),.run { [weak self,weak source] in
                    guard let self,self.engine.state.generation==generation,!self.disposed else {return}
                    source?.resumeIdleAfterLanding()
                }]),withKey:"rejected-landing")
            }
            consume(result, previous: oldState, preserveRejectedPosition: id)
        } else {
            if let sourceVisual, let sourcePosition, let target, let geometry {
                sourceVisual.removeAllActions()
                sourceVisual.position = sourcePosition; sourceVisual.setScale(geometry.scale)
                sourceVisual.zPosition = 18000; effects.addChild(sourceVisual)
                let receipt = beginVisual()
                let destination = geometry.center(row: target.row,column: target.column)
                let ordinaryPlan=[engine.pendingOrdinaryStack,engine.pendingOrdinarySix].compactMap {$0}.first {$0.source.id==id}
                if let ordinaryPlan {ordinaryAbsorbs[ordinaryPlan.id]=(sourceVisual,receipt)}
                sourceVisual.run(.sequence([NativeBoardMotion.move(from: sourcePosition,to: destination,duration: 0.08,ease: .power2Out),
                    .run { [weak self] in
                        if let ordinaryPlan {self?.finishOrdinaryAbsorb(ordinaryPlan)}
                        self?.finishVisual(receipt)
                    }, .removeFromParent()]))
            }
            consume(result, previous: oldState)
        }
        return result
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        if let touch = activeTouch, touches.contains(touch) { cancelDrag(); evaluate() }
    }

    func cancelDrag() {
        let id = draggedID
        activeTouch = nil; draggedID = nil; engine.cancelDrag()
        if id != nil { onPointerState?(false) }
        clearHover()
        if let id, let node = nodesByID[id], let tile = engine.state.tiles.first(where: { $0.id == id }), let geometry {
            node.removeAllActions(); node.setDragging(false)
            node.position = geometry.center(row: tile.cell.row, column: tile.cell.column)
            node.zPosition = tile.isWild ? 12001 : CGFloat(tile.cell.row * engine.state.columns + tile.cell.column)
        }
        publishFishIdleFrames(force:true)
    }

    func prepareFishMedia(tileID:String,generation:UInt64) {
        guard !disposed,engine.state.generation==generation else {return}
        nodesByID[tileID]?.prepareFishMediaPhase();publishFishIdleFrames(force:true)
    }
    func setFishMediaReady(tileID:String,generation:UInt64,ready:Bool) {
        guard !disposed,engine.state.generation==generation else {return}
        nodesByID[tileID]?.setFishMediaReady(ready);publishFishIdleFrames(force:true)
    }
    private func publishFishIdleFrames(force:Bool=false) {
        guard !disposed else {return}
        var frames:[String:NativeFishIdleFrame]=[:]
        for (id,node) in nodesByID {
            if let frame=node.fishFrame(in:self,visible:view != nil && !suspended && !exitInProgress && engine.state.terminal==nil && !specialPresentationIDs.contains(id)) {frames[id]=frame}
        }
        onFishIdleFrames?(frames,engine.state.generation,force)
    }

    private func clearHover() {
        guard hoverTargetID != nil || !hover.isHidden else { return }
        hoverTargetID = nil; hover.isHidden = true
    }

    private func consume(_ result: NativeMoveResult, previous: NativeBoardState, preserveRejectedPosition: String? = nil) {
        cancelCandidate()
        let rejectedPosition = preserveRejectedPosition.flatMap { nodesByID[$0]?.position }
        synchronize()
        if let id = preserveRejectedPosition, let rejectedPosition { nodesByID[id]?.position = rejectedPosition }
        for event in result.events {
            onGameplayEvent?(event)
            let source = event.tileIDs.first.flatMap { id in previous.tiles.first { $0.id == id } }
            let destination = event.tileIDs.dropFirst().first.flatMap { id in previous.tiles.first { $0.id == id } }
            onGameplayReceipt?(event,source,destination,previous.generation)
            switch event.kind {
            case .ordinarySpawnsPrepareRequested:
                if let plan=engine.pendingOrdinarySix,event.reason==plan.id {
                    scheduleOrdinaryCommand(key:"prepare:"+plan.id,generation:plan.generation,delay:Double(event.value ?? 50)/1000) { [weak self] in
                        guard let self else {return}
                        let previous=self.engine.state
                        self.consume(self.engine.prepareOrdinarySpawns(receiptID:plan.id,generation:plan.generation),previous:previous)
                        self.releaseOrdinarySixIfReady()
                    }
                }
            case .ordinaryAssignmentsPrepared:
                startOrdinaryAssignments(ids:event.tileIDs)
            case .ordinaryDestinationCleanupPrepared:
                if let plan=engine.pendingOrdinarySix,event.reason==plan.id {
                    scheduleOrdinaryCommand(key:"cleanup:"+plan.id,generation:plan.generation,delay:Double(event.value ?? 100)/1000) { [weak self] in
                        guard let self,self.engine.pendingOrdinaryDestinationCleanup?.id == plan.id else {return}
                        let previous=self.engine.state
                        self.consume(self.engine.commitOrdinaryDestinationCleanup(receiptID:plan.id,generation:plan.generation),previous:previous)
                        self.releaseOrdinarySixIfReady()
                    }
                }
            case .ordinaryStackReserved: break // Captured source ghost owns the actual absorb completion.
            case .ordinarySixReserved:
                if let plan=engine.pendingOrdinarySix,ordinarySixVisual==nil {
                    ordinarySixVisual=OrdinarySixVisual(id:plan.id,generation:plan.generation,receipt:beginVisual())
                    playRegularSixHero(plan)
                }
            case .ordinaryPostcheckPrepared:
                if let id=event.reason {startOrdinaryPostcheck(id:id)}
            case .merged:
                let regularSix=event.value==6 && event.reason==engine.pendingOrdinarySix?.id
                for id in event.tileIDs {finishOrdinarySpawnVisual(id);if !regularSix {nodesByID[id]?.stackFeedback()}}
                if regularSix,let plan=engine.pendingOrdinarySix {playRegularSixMain(plan)}
                else if event.value == 6 && engine.pendingSpecial == nil {
                    let tile = event.tileIDs.reversed().compactMap { id in previous.tiles.first { $0.id == id } }.first
                    let carrier = event.tileIDs.compactMap { id in previous.tiles.first { $0.id == id } }.first { $0.isWild }
                    if let variant = event.variant,["fish","bottle","honey","spaceship","laser-gun","flower","barell","beach-ball","kanta","bee","cubero","mushroom","robo-cube"].contains(variant),let tile,let geometry,
                       authoredFinale(variant,at: geometry.center(row: tile.cell.row,column: tile.cell.column)) {
                        // Native media/glyph owner holds its own visible receipt.
                    } else if event.archetype == .tnt && carrier?.variant == nil {
                        coreTntFinale()
                    } else if event.archetype == .star && carrier?.variant == nil {
                        coreStarFinale()
                    } else if event.archetype == .juice && carrier?.variant == nil {
                        coreJuiceFinale()
                    } else if let tile, let geometry {
                        smoke(at: geometry.center(row: tile.cell.row, column: tile.cell.column), special: event.archetype != nil)
                    }
                }
            case .directWildReserved:
                if let plan=engine.pendingDirectWild {playDirectWild(plan)}
            case .meterRewardPrepared:
                startMeterRewards(ids: event.tileIDs)
            case .hudStarsPrepared:
                startHUDStarFlights(ids: event.tileIDs,lead: event.archetype == .magnet && engine.pendingSpecial != nil ? 0.2 : 0)
            case .specialReserved:
                if let plan = engine.pendingSpecial { playReservedSpecial(plan) }
            case .specialImpact:
                var paintedIDs=Set<String>()
                for id in event.tileIDs where paintedIDs.insert(id).inserted { if let node = nodesByID[id] {
                    node.visual.setScale(0.30)
                    if let completed=laserSpawnCallbacks.removeValue(forKey:id) {
                        node.visual.run(.sequence([NativeBoardMotion.spawnBounce(),.wait(forDuration:0.05),.run(completed)]),withKey:"special-impact-spawn")
                    } else {node.visual.run(NativeBoardMotion.spawnBounce(),withKey:"special-impact-spawn")}
                } }
            case .spawned:
                for id in event.tileIDs {
                    guard let node=nodesByID[id] else {continue}
                    node.visual.setScale(0.30)
                    if let ordinary=ordinarySixVisual,ordinary.committed,
                       event.reason != nil || ordinary.consuming {
                        if engine.pendingOrdinarySpawns.contains(id) {
                            _ = engine.commitOrdinarySpawnArrival(receiptID:ordinary.id,generation:ordinary.generation,tileID:id)
                        }
                        finishOrdinarySpawnVisual(id)
                        ordinarySpawnVisuals[id]=beginVisual()
                        if let primary=engine.pendingOrdinaryPrimaryArrival,primary.id==event.reason {
                            ordinaryPrimaryVisuals[id]=(ordinary.id,primary.id,primary.generation)
                        }
                        node.visual.run(.sequence([NativeBoardMotion.spawnBounce(),.run { [weak self] in
                            guard let self,self.engine.state.generation==ordinary.generation else {return}
                            self.finishOrdinarySpawnVisual(id,interrupted:false)
                        }]),withKey:"spawn")
                    } else {node.visual.run(NativeBoardMotion.spawnBounce(),withKey:"spawn")}
                }
            default: break
            }
        }
        onStateChange?(engine.state)
        handleResolution(result.resolution)
    }

    func evaluate() { guard !disposed else { return }; handleResolution(engine.resolve()) }

    private func finishOrdinaryAbsorb(_ plan:NativeOrdinaryMovePlan) {
        guard !disposed,!suspended,engine.state.generation==plan.generation,
              ordinaryAbsorbs.removeValue(forKey:plan.id) != nil else {return}
        let previous=engine.state
        if engine.pendingOrdinaryStack?.id==plan.id {
            consume(engine.finishOrdinaryStackAbsorb(receiptID:plan.id,generation:plan.generation),previous:previous)
        } else if engine.pendingOrdinarySix?.id==plan.id {
            ordinarySixVisual?.committed=true;ordinarySixVisual?.consuming=true
            let result=engine.commitOrdinarySix(receiptID:plan.id,generation:plan.generation)
            consume(result,previous:previous)
            ordinarySixVisual?.consuming=false
            if !result.accepted {retireOrdinarySixVisual()}
            else {releaseOrdinarySixIfReady()}
        }
    }

    private func startOrdinaryPostcheck(id:String) {
        guard !disposed,ordinaryPostchecks[id]==nil,
              let pending=engine.pendingOrdinaryPostchecks.first(where:{$0.id==id && $0.generation==engine.state.generation}) else {return}
        let owner=SKNode(),receipt=beginVisual()
        effects.addChild(owner);ordinaryPostchecks[id]=(owner,receipt);onRenderingDemand?(true)
        owner.run(.sequence([.wait(forDuration:Double(pending.delayMilliseconds)/1000),.run { [weak self,weak owner] in
            guard let self,!self.disposed,!self.suspended,self.engine.state.generation==pending.generation,
                  self.ordinaryPostchecks.removeValue(forKey:id) != nil else {owner?.removeFromParent();return}
            let previous=self.engine.state,result=self.engine.commitOrdinaryPostcheck(receiptID:id,generation:pending.generation)
            self.consume(result,previous:previous);self.finishVisual(receipt);owner?.removeFromParent()
        }]),withKey:"native-ordinary-postcheck")
    }

    private func playRegularSixHero(_ plan:NativeOrdinaryMovePlan) {
        let node=nodesByID[plan.destination.id],start=CGPoint(x:node?.visual.xScale ?? 1,y:node?.visual.yScale ?? 1)
        // The source hidden final carrier still consumes the authored peak draw.
        let motion=NativeRegularSixHeroMotion(random:{Double.random(in:0..<1)})
        guard let node else {return}
        node.visual.removeAllActions()
        node.visual.run(.customAction(withDuration:0.275) { [weak node] _,time in
            node?.visual.xScale=motion.sample(seconds:Double(time),startingScale:Double(start.x))
            node?.visual.yScale=motion.sample(seconds:Double(time),startingScale:Double(start.y))
        },withKey:"source-ordinary-six-hero")
    }

    private func playRegularSixMain(_ plan:NativeOrdinaryMovePlan) {
        guard let geometry,regularSixPresentations[plan.id]==nil else {return}
        let cadence=NativeRegularSixFxCadence.shared
        let reduced=reducedBoardEffects
        let captured=boardShake
        let owner:NativeRegularSixSpritePresentation
        do {
            owner=try NativeRegularSixSpritePresentation(origin:geometry.center(row:plan.destination.cell.row,column:plan.destination.cell.column),tileSize:geometry.tileSize,
                destinationDepth:CGFloat(plan.destination.cell.row*engine.state.columns+plan.destination.cell.column),combinedDepth:plan.source.stackDepth+plan.destination.stackDepth,
                generation:plan.generation,reduced:reduced,hotFactor:cadence.hotFactor(nowMilliseconds:CACurrentMediaTime()*1000,reducedBoardFx:reduced),patternIndex:cadence.nextPattern(),initialShake:captured,
                isCurrent:{ [weak self] generation in self?.disposed == false && self?.engine.state.generation == generation },random:{Double.random(in:0..<1)})
        } catch {
            // The same process-stable source font was checked before capture.
            // Report an unexpected native renderer failure without substituting
            // an unrelated effect for the authored source receipt.
            onPresentationFailure?("ordinary_six_source_font_missing")
            return
        }
        if let previous=regularSixShakeID {regularSixPresentations[previous]?.detachShake()}
        regularSixShakeID=plan.id;regularSixPresentations[plan.id]=owner
        let receipt=beginVisual()
        owner.onShake={ [weak self] pose,generation in
            guard let self,self.regularSixShakeID==plan.id,self.engine.state.generation==generation else {return}
            self.applyBoardShake(pose)
        }
        owner.onFinished={ [weak self] _ in
            guard let self else {return}
            self.regularSixPresentations.removeValue(forKey:plan.id)
            if self.regularSixShakeID==plan.id {self.regularSixShakeID=nil;self.applyBoardShake(.init(canvas:.zero,indicator:.zero,bottomDecor:.zero))}
            self.finishVisual(receipt)
        }
        owner.mount(in:canvasRoot)
    }

    private func applyBoardShake(_ pose:NativeRegularSixSpritePresentation.ShakeReceipt) {
        onJourneyBottomDecorShake?(pose.bottomDecor,engine.state.generation)
        boardShake=pose;canvasRoot.position=CGPoint(x:pose.canvas.x,y:-pose.canvas.y)
        let base=NativeGameplayChromePlan.make(viewport:size,safeTop:safeInsets.top).roundCenter
        roundIndicator.position=CGPoint(x:base.x+pose.indicator.x,y:base.y-pose.indicator.y)
    }

    private func retireRegularSixPresentations() {
        for owner in Array(regularSixPresentations.values) {owner.dispose()}
        regularSixPresentations.removeAll();regularSixShakeID=nil;applyBoardShake(.init(canvas:.zero,indicator:.zero,bottomDecor:.zero))
    }

    private func scheduleOrdinaryCommand(key:String,generation:UInt64,delay:Double,command:@escaping ()->Void) {
        guard !disposed,ordinaryDeferred[key]==nil else {return}
        let owner=SKNode(),receipt=beginVisual()
        ordinaryDeferred[key]=(owner,receipt);effects.addChild(owner);onRenderingDemand?(true)
        owner.run(.sequence([.wait(forDuration:max(0,delay)),.run { [weak self,weak owner] in
            guard let self,!self.disposed,!self.suspended,self.engine.state.generation==generation,
                  self.ordinaryDeferred.removeValue(forKey:key) != nil else {owner?.removeFromParent();return}
            command();self.finishVisual(receipt);owner?.removeFromParent()
        }]))
    }

    private func startOrdinaryAssignments(ids:[String]) {
        guard let plan=engine.pendingOrdinarySix else {return}
        let slots=engine.pendingOrdinaryAssignments.filter {ids.contains($0.id)}
        guard !slots.isEmpty else {releaseOrdinarySixIfReady();return}
        let key="assignments:"+slots[0].id
        guard ordinaryDeferred[key]==nil else {return}
        let owner=SKNode(),receipt=beginVisual()
        ordinaryDeferred[key]=(owner,receipt);effects.addChild(owner);onRenderingDemand?(true)
        var index=0
        let duration=Double(slots.map(\.delayMilliseconds).max() ?? 0)/1000
        // All selected timers share their source preparation clock. A stalled
        // frame consumes due immutable slots in captured order, without adding
        // an extra per-slot delay or choosing a new face in the renderer.
        owner.run(.sequence([.customAction(withDuration:max(0.000001,duration)) { [weak self] _,elapsed in
            guard let self,!self.disposed,!self.suspended,self.engine.state.generation==plan.generation else {return}
            while index<slots.count && Double(elapsed)+0.000001>=Double(slots[index].delayMilliseconds)/1000 {
                let slot=slots[index];index+=1
                let previous=self.engine.state
                let result=self.engine.commitOrdinaryAssignment(receiptID:plan.id,generation:plan.generation,assignmentID:slot.id)
                self.consume(result,previous:previous)
                self.releaseOrdinarySixIfReady()
            }
        },.run { [weak self,weak owner] in
            guard let self,self.ordinaryDeferred.removeValue(forKey:key) != nil else {owner?.removeFromParent();return}
            self.finishVisual(receipt);owner?.removeFromParent();self.releaseOrdinarySixIfReady()
        }]))
    }

    private func releaseOrdinarySixIfReady() {
        guard !disposed,!suspended,let owner=ordinarySixVisual,owner.committed,!owner.consuming,
              engine.state.generation==owner.generation,engine.pendingOrdinarySpawns.isEmpty,
              engine.pendingOrdinarySix?.id==owner.id else {return}
        let previous=engine.state,result=engine.releaseOrdinarySixHandoff(receiptID:owner.id,generation:owner.generation)
        guard result.accepted else {return}
        ordinarySixVisual=nil
        consume(result,previous:previous);finishVisual(owner.receipt)
    }
    private func retireOrdinarySixVisual() {
        if let owner=ordinarySixVisual {ordinarySixVisual=nil;finishVisual(owner.receipt)}
    }
    private func finishOrdinarySpawnVisual(_ id:String,interrupted:Bool=true) {
        if let receipt=ordinarySpawnVisuals.removeValue(forKey:id) {finishVisual(receipt)}
        if let primary=ordinaryPrimaryVisuals.removeValue(forKey:id),engine.state.generation==primary.2,
           engine.pendingOrdinaryPrimaryArrival?.id==primary.1 {
            let previous=engine.state
            consume(engine.finishOrdinaryPrimarySpawn(receiptID:primary.0,generation:primary.2,assignmentID:primary.1,interrupted:interrupted),previous:previous)
            releaseOrdinarySixIfReady()
        }
    }

    private func handleResolution(_ resolution: NativeResolution) {
        guard !disposed else { return }
        if resolution.kind == .wait,resolution.reason == "wild_continuation_pending" {
            cancelCandidate()
            let previous = engine.state,result = engine.claimMeterReward()
            if result.accepted { consume(result,previous:previous) }
            return
        }
        if resolution.kind == .wait,resolution.reason == "tutorial_final_chance_pending" {
            cancelCandidate()
            let previous = engine.state,result = engine.claimTutorialFinalChance()
            if result.accepted { consume(result,previous: previous) }
            return
        }
        switch resolution.kind {
        case .fail:
            if engine.state.terminal?.kind == .fail { presentTerminal(resolution) }
            else { scheduleCandidate() }
        case .complete: presentTerminal(resolution)
        default: if candidateSignature != nil { cancelCandidate() }
        }
    }

    private func scheduleCandidate() {
        let state = engine.state
        if candidateSignature == state.signature { return }
        cancelCandidate()
        guard engine.beginNoMovesConfirmation() == state.signature else { cancelCandidate(); return }
        candidateSignature = state.signature; navigationLocked = true
        noMoves.isHidden = false; noMoves.text = "NO MOVES"
        onRenderingDemand?(true)
        let signature = state.signature, generation = state.generation
        onGameplayEvent?(NativeGameplayEvent(.noMovesCandidate))
        run(.sequence([.wait(forDuration: 1.5), .run { [weak self] in
            guard let self, !self.disposed, self.candidateSignature == signature else { return }
            let result = self.engine.confirmNoMoves(signature: signature, generation: generation)
            self.cancelCandidate(); self.consume(result, previous: state)
        }]), withKey: "no-moves-confirm")
    }

    private func cancelCandidate() {
        removeAction(forKey: "no-moves-confirm"); candidateSignature = nil
        engine.cancelNoMovesConfirmation()
        noMoves.isHidden = true; navigationLocked = engine.state.terminal != nil || pendingTerminal != nil || exitInProgress
    }

    private func presentTerminal(_ resolution: NativeResolution) {
        let generation = engine.state.generation
        guard terminalPresentedGeneration != generation, pendingTerminalGeneration != generation else { return }
        inputAdmitted = false; navigationLocked = true
        cancelDrag(); removeAction(forKey: "no-moves-confirm"); candidateSignature = nil
        onStateChange?(engine.state)
        pendingTerminal = resolution
        pendingTerminalGeneration = generation
        publishPendingTerminal()
    }

    private func beginVisual() -> UInt64 { visualOwners += 1; return visualLifetime }
    private func finishVisual(_ receipt: UInt64) {
        guard !disposed, receipt == visualLifetime else { return }
        visualOwners = max(0,visualOwners-1)
        releaseFinalDirectIfReady()
        publishPendingTerminal()
    }
    private func releaseFinalDirectIfReady() {
        guard !disposed,!suspended,visualOwners == 1,engine.pendingHUDStars.isEmpty,engine.pendingMeterRewards.isEmpty,
              let (id,generation,receipt)=directFinalReceipt,engine.pendingDirectWild?.id == id,engine.pendingDirectWild?.isFinal == true,engine.directWildGameplayCommitted else {return}
        directFinalReceipt=nil;directPresentationID=nil;directPresentationVariant=nil;directFinalReceipt=nil
        let previous=engine.state,result=engine.releaseDirectWildPresentation(transactionID:id,generation:generation)
        consume(result,previous:previous);finishVisual(receipt)
    }
    private func publishPendingTerminal() {
        guard !disposed, !suspended, visualOwners == 0, engine.pendingHUDStars.isEmpty, engine.pendingMeterRewards.isEmpty, let pendingTerminal, pendingTerminalGeneration == engine.state.generation,
              terminalPresentedGeneration != engine.state.generation else { return }
        self.pendingTerminal = nil; pendingTerminalGeneration = nil; terminalPresentedGeneration = engine.state.generation
        onTerminal?(pendingTerminal)
    }

    private func smoke(at point: CGPoint, special: Bool,completion:(() -> Void)?=nil) {
        guard let geometry else { return }
        onRenderingDemand?(true)
        let receipt = beginVisual()
        for index in 0..<6 {
            let puff = SKSpriteNode(texture: textures.texture("assets/smoke/smoke\(index % 5 + 1).png"))
            puff.position = point
            let size = geometry.tileSize * (special ? 1.7 : 1.35)
            puff.size = CGSize(width: size, height: size); puff.alpha = 0.8
            puff.zRotation = CGFloat(index) * .pi / 3
            effects.addChild(puff)
            let angle = CGFloat(index) * .pi / 3
            let move = SKAction.moveBy(x: cos(angle)*geometry.tileSize*0.6, y: sin(angle)*geometry.tileSize*0.6, duration: 0.65)
            move.timingMode = .easeOut
            var actions: [SKAction] = [.group([move, .scale(to: 1.45, duration: 0.65), .fadeOut(withDuration: 0.65)])]
            if index == 5 { actions.append(.run { [weak self] in self?.finishVisual(receipt);completion?() }) }
            actions.append(.removeFromParent())
            puff.run(.sequence(actions))
        }
    }

    private func authoredFinale(_ variant: String,at point: CGPoint) -> Bool {
        guard let onAuthoredFinale else { return false }
        let receipt = beginVisual()
        let accepted = onAuthoredFinale(variant,CGPoint(x: point.x,y: size.height-point.y),engine.state.generation) { [weak self] in
            self?.finishVisual(receipt)
        }
        if !accepted { finishVisual(receipt) }
        return accepted
    }

    private func playDirectWild(_ plan:NativeDirectWildMovePlan) {
        guard !disposed,directPresentationID != plan.id else {return}
        directPresentationID=plan.id;directPresentationVariant=plan.variant
        specialPresentationIDs.formUnion([plan.source.id,plan.destination.id])
        nodesByID[plan.source.id]?.alpha=0
        let owner=SKNode(),receipt=beginVisual()
        effects.addChild(owner);navigationLocked=true;onRenderingDemand?(true)
        owner.run(.sequence([.wait(forDuration:0.08),.run { [weak self,weak owner] in
            guard let self,!self.disposed,self.engine.state.generation == plan.generation,self.engine.pendingDirectWild?.id == plan.id else {owner?.removeFromParent();return}
            let previous=self.engine.state,result=self.engine.commitDirectWildGameplay(transactionID:plan.id)
            self.specialPresentationIDs.remove(plan.source.id);self.specialPresentationIDs.remove(plan.destination.id)
            self.consume(result,previous:previous)
            guard result.accepted else {
                self.directPresentationID=nil;self.directPresentationVariant=nil;self.finishVisual(receipt);owner?.removeFromParent();return
            }
            self.navigationLocked=self.engine.state.terminal != nil || self.pendingTerminal != nil
            if plan.isFinal {
                self.directFinalReceipt=(plan.id,plan.generation,receipt);owner?.removeFromParent();self.releaseFinalDirectIfReady();return
            }
            owner?.run(.sequence([.wait(forDuration:plan.archetype == .juice ? 1.86:0.9),.run { [weak self,weak owner] in
                guard let self,!self.disposed,self.engine.state.generation == plan.generation,self.engine.pendingDirectWild?.id == plan.id else {owner?.removeFromParent();return}
                let previous=self.engine.state,result=self.engine.releaseDirectWildPresentation(transactionID:plan.id,generation:plan.generation)
                self.directPresentationID=nil;self.directPresentationVariant=nil
                self.consume(result,previous:previous);self.finishVisual(receipt);owner?.removeFromParent()
            }]),withKey:"native-direct-wild-release")
        }]),withKey:"native-direct-wild-absorb")
    }

    private func configureTntGlyphClock(_ owner: NativeTntFinale) {
        guard onTntGlyphClock != nil else { return }
        let id = UUID().uuidString,generation = engine.state.generation
        owner.onGlyphClock = { [weak self] time,finished in
            guard let self,finished || !self.disposed && self.engine.state.generation == generation else { return }
            self.onTntGlyphClock?(id,time,finished)
        }
    }

    private func coreTntFinale() {
        let owner = NativeTntFinale(textures: textures,fontName: finaleFontName,viewport: size,showsTitle: onTntGlyphClock == nil)
        configureTntGlyphClock(owner)
        owner.zPosition = 999998; effects.addChild(owner)
        let receipt = beginVisual(); onRenderingDemand?(true)
        owner.play { [weak self] in self?.finishVisual(receipt) }
    }

    private func coreStarFinale() {
        let owner = NativeStarFinale(textures: textures,viewport: size)
        let id = UUID().uuidString,generation = engine.state.generation
        var haptics = Set<Int>()
        let earlyBeats: [TimeInterval] = (0..<7).map { Double($0)*0.095 }
        let lateBeats: [TimeInterval] = (0..<6).map { 1.0+Double($0)*0.11 }
        let beats = earlyBeats+lateBeats
        owner.onGlyphClock = { [weak self] time,finished in
            guard let self,finished || !self.disposed && self.engine.state.generation == generation else { return }
            self.onSplashGlyphClock?("star",id,time,finished)
            if !finished { for (index,at) in beats.enumerated() where time >= at && !haptics.contains(index) {
                haptics.insert(index); self.onHaptic?("light")
            } }
        }
        owner.zPosition = 999998; effects.addChild(owner)
        let receipt = beginVisual(); onRenderingDemand?(true)
        owner.play { [weak self] in self?.finishVisual(receipt) }
    }

    @discardableResult
    private func coreJuiceFinale(onGameplayReady: (() -> Void)? = nil) -> Bool {
        let owner = NativeJuiceFinale(textures: textures,viewport: size)
        guard owner.assetReady else { owner.dispose(); return false }
        for previous in effects.children.compactMap({ $0 as? NativeJuiceFinale }) { previous.dispose() }
        let token = UUID().uuidString,generation = engine.state.generation
        let beats: [TimeInterval] = [0.2,0.27,0.34,0.52,0.78,1.04,1.325,1.425,1.525,1.625,2.225,2.405,2.585,2.725]
        var haptics = Set<Int>()
        owner.onGlyphClock = { [weak self] time,finished in
            guard let self,finished || !self.disposed && self.engine.state.generation == generation else { return }
            self.onSplashGlyphClock?("juice",token,time,finished)
            if !finished { for (index,at) in beats.enumerated() where time >= at && !haptics.contains(index) {
                haptics.insert(index); self.onHaptic?("light")
            } }
        }
        owner.onCue = { [weak self] moment,index in
            guard let self,!self.disposed,self.engine.state.generation == generation else { return }
            self.onSpecialMoment?("juice",moment,index)
        }
        owner.onGameplayReady = onGameplayReady
        owner.zPosition = 999998; effects.addChild(owner)
        let receipt = beginVisual(); onRenderingDemand?(true)
        owner.play { [weak self] in self?.finishVisual(receipt) }
        return true
    }

    private func retireEffects() {
        for child in effects.children {
            if let tnt = child as? NativeTntFinale { tnt.dispose() }
            else if let star = child as? NativeStarFinale { star.dispose() }
            else if let juice = child as? NativeJuiceFinale { juice.dispose() }
            else { child.removeAllActions(); child.removeAllChildren(); child.removeFromParent() }
        }
    }

    private func startMeterRewards(ids: [String]) {
        for meterReceipt in engine.pendingMeterRewards where ids.contains(meterReceipt.id) && meterVisuals[meterReceipt.id] == nil {
            let owner = SKNode(),visualReceipt = beginVisual(); effects.addChild(owner)
            meterVisuals[meterReceipt.id] = (owner,visualReceipt); onRenderingDemand?(true)
            owner.run(.sequence([.wait(forDuration:meterReceipt.delay),.run { [weak self,weak owner] in
                guard let self,!self.disposed,self.engine.state.generation == meterReceipt.generation,
                      self.meterVisuals.removeValue(forKey:meterReceipt.id) != nil else { owner?.removeFromParent(); return }
                let previous = self.engine.state
                self.consume(self.engine.commitMeterReward(receiptID:meterReceipt.id,generation:meterReceipt.generation),previous:previous)
                self.finishVisual(visualReceipt); owner?.removeFromParent()
            }]),withKey:"native-captured-meter-reward")
        }
    }

    private func startHUDStarFlights(ids: [String],lead: TimeInterval = 0) {
        guard let geometry else { return }
        let receipts = ids.compactMap { id in engine.pendingHUDStars.first { $0.id == id } }.filter { !hudStarIDs.contains($0.id) }
        guard !receipts.isEmpty else { return }
        let origins = receipts.map { receipt -> CGPoint in
            let point = geometry.center(row: receipt.origin.row,column: receipt.origin.column)
            return CGPoint(x: point.x,y: size.height-point.y)
        }
        let target = CGPoint(x: scoreArt.position.x,y: size.height-scoreArt.position.y)
        let plans = NativeHUDStarMotion.batch(origins: origins,target: target)
        for (receipt,plan) in zip(receipts,plans) {
            hudStarIDs.insert(receipt.id)
            let star = SKSpriteNode(texture: textures.texture("assets/small-star.png"))
            star.size = CGSize(width: plan.size,height: plan.size)
            let origin = plan.points[0]; star.position = CGPoint(x: origin.x,y: size.height-origin.y)
            hudStarFlights.addChild(star)
            let visualReceipt = beginVisual(); hudStarVisualReceipts[receipt.id] = visualReceipt; var arrived = false
            onRenderingDemand?(true)
            star.run(.sequence([.wait(forDuration: lead),.customAction(withDuration: plan.end) { [weak self,weak star] _,elapsed in
                guard let self,!self.disposed,self.engine.state.generation == receipt.generation,!arrived else { return }
                let pose = plan.sample(seconds: Double(elapsed))
                star?.position = CGPoint(x: pose.point.x,y: self.size.height-pose.point.y)
                star?.size = CGSize(width: pose.size,height: pose.size); star?.zRotation = -pose.rotation
                if pose.arrived {
                    arrived = true; star?.alpha = 0; star?.removeFromParent(); self.hudStarIDs.remove(receipt.id)
                    let previous = self.engine.state
                    let result = self.engine.commitHUDStarArrival(receiptID: receipt.id,generation: receipt.generation)
                    self.consume(result,previous: previous)
                    self.onSpecialMoment?(receipt.variant,"hud-star-arrived",receipt.ordinal)
                    self.hudStarVisualReceipts.removeValue(forKey: receipt.id)
                    self.finishVisual(visualReceipt)
                }
            },.removeFromParent()]),withKey: "native-protected-hud-star")
        }
    }

    private func specialIsCurrent(_ plan: NativeSpecialMovePlan) -> Bool {
        !disposed && engine.state.generation == plan.generation && engine.pendingSpecial?.id == plan.id
            && specialPresentationID == plan.id
    }

    private func playReservedSpecial(_ plan: NativeSpecialMovePlan) {
        guard specialPresentationID != plan.id,let geometry else { return }
        specialPresentationID = plan.id;specialPresentationVariant = plan.variant
        specialPresentationIDs = Set(plan.targets.map(\.id))
        let receipt = beginVisual(); navigationLocked = true; onRenderingDemand?(true)
        if plan.archetype == .magnet {
            let target = geometry.center(row: plan.destination.cell.row,column: plan.destination.cell.column)
            let pairs = plan.targets.enumerated().compactMap { index,tile -> (NativeDiceNode,NativeMagnetPullMotion)? in
                guard let node = nodesByID[tile.id] else { return nil }
                node.removeAllActions(); node.visual.removeAllActions()
                return (node,NativeMagnetPullMotion(start: node.position,destination: target,tileSize: geometry.tileSize,
                                                   baseScale: geometry.scale,index: index,count: plan.targets.count))
            }
            var arrived = Set<String>()
            let owner = SKNode(); effects.addChild(owner)
            let duration = pairs.map { $0.1.end }.max() ?? 0
            owner.run(.sequence([.customAction(withDuration: max(0.001,duration)) { [weak self,weak owner] _,elapsed in
                guard let self,self.specialIsCurrent(plan) else { owner?.removeAllActions(); owner?.removeFromParent(); return }
                for (node,motion) in pairs where !arrived.contains(node.tileID) {
                    let pose = motion.sample(time: Double(elapsed))
                    node.position = pose.point; node.setScale(pose.scale); node.visual.zRotation = pose.rotation
                    if pose.converged { arrived.insert(node.tileID) }
                }
                if arrived.count == pairs.count {
                    owner?.removeAllActions()
                    self.onSpecialMoment?(plan.variant ?? "magnet","pull",plan.targets.count)
                    self.smoke(at: target,special: true)
                    self.specialPresentationIDs.removeAll()
                    let previous = self.engine.state
                    let prepared = self.engine.prepareMagnetRespawn(transactionID: plan.id)
                    self.consume(prepared,previous: previous)
                    self.startMagnetRespawn(plan,receipt: receipt,owner: owner)

                }
            },.removeFromParent()]))
        } else if plan.archetype == .tnt {
            let blastIDs=Set(engine.state.tiles.filter {$0.id != plan.destination.id && ($0.value>0 || $0.isWild) && !$0.locked}.map(\.id))
            // The already-painted source absorb owns the same 80ms boundary.
            run(.sequence([.wait(forDuration:0.08),.run { [weak self] in
                guard let self,self.specialIsCurrent(plan) else {return}
                let previous=self.engine.state
                let activated=self.engine.commitSpecialActivation(transactionID:plan.id)
                self.consume(activated,previous:previous)
                guard activated.accepted else {return}
                if plan.variant == "laser-gun" {self.startLaserImpacts(plan,receipt:receipt)}
                else {self.playCoreTntTransaction(plan,receipt:receipt,geometry:geometry,blastIDs:blastIDs)}
            }]),withKey:"native-special-activation")
        }
    }

    private func startMagnetRespawn(_ plan: NativeSpecialMovePlan,receipt: UInt64,owner: SKNode?) {
        guard specialIsCurrent(plan) else { return }
        let count = engine.pendingMagnetRespawn?.replacements.count ?? 0
        var actions: [SKAction] = [.wait(forDuration: 0.05)]
        for index in 0..<count {
            if index > 0 { actions.append(.wait(forDuration: 0.15)) }
            actions.append(.run { [weak self] in
                guard let self,self.specialIsCurrent(plan) else { return }
                let previous = self.engine.state
                let result = self.engine.commitMagnetReplacement(transactionID: plan.id,index: index)
                self.consume(result,previous: previous)
            })
        }
        // Exact openAtCell scale timeline .56 plus source per-spawn validation
        // wait .05; only the survivor bounce is a post-commit decorative tail.
        actions += [.wait(forDuration: 0.56+0.05),.run { [weak self,weak owner] in
            guard let self,self.specialIsCurrent(plan) else { owner?.removeFromParent(); return }
            let previous = self.engine.state
            let result = self.engine.commitSpecialBoard(transactionID: plan.id)
            self.specialPresentationID = nil
            self.consume(result,previous: previous)
            self.navigationLocked = self.engine.state.terminal != nil || self.pendingTerminal != nil
            self.finishVisual(receipt); owner?.removeFromParent()
        }]
        owner?.run(.sequence(actions),withKey: "captured-magnet-respawn")
    }

    private func playCoreTntTransaction(_ plan: NativeSpecialMovePlan,receipt: UInt64,geometry: NativeBoardGeometry,blastIDs:Set<String>) {
        let center = geometry.center(row: plan.destination.cell.row,column: plan.destination.cell.column)
        let blastNodes = engine.state.tiles.compactMap { tile -> NativeDiceNode? in
            guard blastIDs.contains(tile.id),tile.id != plan.source.id,tile.id != plan.destination.id,tile.value > 0 || tile.isWild,
                  !tile.locked || plan.targets.contains(where: { $0.id == tile.id }) else { return nil }
            return nodesByID[tile.id]
        }
        specialPresentationIDs.formUnion(blastNodes.map(\.tileID))
        let returnPlans = blastNodes.map { node -> (NativeDiceNode,CGPoint,Double,Double) in
            let rest = node.position,dx = rest.x-center.x,dy = rest.y-center.y,distance = hypot(dx,dy)
            let angle = distance < 1 ? CGFloat.random(in: 0..<(2 * .pi)) : atan2(dy,dx)
            let strength = geometry.tileSize*0.4*CGFloat.random(in: 1..<1.3)
            let destination = CGPoint(x: rest.x+cos(angle)*strength,y: rest.y+sin(angle)*strength)
            let backDuration = Double.random(in: 0.58..<0.7),elastic = Double.random(in: 0.14..<0.22)
            let outDuration = Double.random(in: 0.62..<0.76)
            node.removeAllActions()
            node.run(NativeBoardMotion.move(from: rest,to: destination,duration: outDuration,ease: .elasticOut(1,elastic)),withKey: "tnt-blast")
            return (node,rest,backDuration,elastic)
        }
        var returned = false
        let beginReturn: () -> Void = { [weak self] in
            guard let self,self.specialIsCurrent(plan),!returned else { return }; returned = true
            var pending = returnPlans.count
            let returnFinished: () -> Void = { [weak self] in
                guard let self,self.specialIsCurrent(plan) else { return }
                pending -= 1
                if pending <= 0 { self.specialPresentationIDs.removeAll(); self.startCoreTntImpacts(plan,receipt: receipt) }
            }
            if returnPlans.isEmpty { self.specialPresentationIDs.removeAll(); self.startCoreTntImpacts(plan,receipt: receipt) }
            for (node,rest,duration,elastic) in returnPlans {
                node.removeAction(forKey: "tnt-blast")
                node.run(.sequence([NativeBoardMotion.move(from: node.position,to: rest,duration: duration,ease: .elasticOut(0.6,elastic)),
                    .run(returnFinished)]),withKey: "tnt-return")
            }
        }
        if let variant = plan.variant,let onAuthoredTntPresentation {
            let finaleReceipt = beginVisual()
            let accepted = onAuthoredTntPresentation(variant,CGPoint(x:center.x,y:size.height-center.y),plan.generation,beginReturn) { [weak self] in self?.finishVisual(finaleReceipt) }
            if !accepted { finishVisual(finaleReceipt) }
            // An unavailable renderer cannot fabricate a zero-duration phase.
            // Admission rejects this path before reservation; defensive failure
            // remains observable until background settlement cancels its plan.
            if !accepted { NSLog("[NativeTNT] authored owner unavailable %@",variant) }
        } else {
            let owner = NativeTntFinale(textures: textures,fontName: finaleFontName,viewport: size,showsTitle: onTntGlyphClock == nil)
            configureTntGlyphClock(owner); owner.zPosition = 999998; effects.addChild(owner)
            let finaleReceipt = beginVisual(); owner.play { [weak self] in self?.finishVisual(finaleReceipt) }
            // Source frame 6 completes at .07 + 5*.04 + .24 = .51.
            run(.sequence([.wait(forDuration:0.51),.run(beginReturn)]),withKey:"special-tnt-frame6")
        }
    }

    private func startLaserImpacts(_ initial:NativeSpecialMovePlan,receipt:UInt64) {
        guard specialIsCurrent(initial),let geometry,let onAuthoredLaserImpact else {return}
        let previous=engine.state,reserved=engine.reserveTntTargets(transactionID:initial.id)
        consume(reserved,previous:previous)
        guard reserved.accepted,let plan=engine.pendingSpecial else {return}
        let targets=engine.pendingLaserShots.compactMap {shot->NativeLaserVisualTarget? in
            guard let tile=plan.targets.first(where:{$0.id == shot.tileID}) else {return nil}
            let point=geometry.center(row:tile.cell.row,column:tile.cell.column)
            return NativeLaserVisualTarget(tileID:tile.id,point:CGPoint(x:point.x,y:size.height-point.y),shooter:shot.shooter)
        }
        guard targets.count == plan.targets.count,!targets.isEmpty else {return}
        specialPresentationIDs=Set(plan.targets.map(\.id))
        var pendingSpawns=Set<String>(),allContacts=false,committed=false
        let completeGameplay:() -> Void = { [weak self] in
            guard let self,self.specialIsCurrent(plan),allContacts,pendingSpawns.isEmpty,!committed else {return}
            committed=true
            let previous=self.engine.state,result=self.engine.commitSpecialBoard(transactionID:plan.id)
            self.specialPresentationID=nil;self.specialPresentationIDs.removeAll();self.laserSpawnCallbacks.removeAll()
            self.consume(result,previous:previous)
            self.navigationLocked=self.engine.state.terminal != nil || self.pendingTerminal != nil
            self.finishVisual(receipt)
        }
        let impact:(Int,String) -> Bool = { [weak self] index,id in
            guard let self,self.specialIsCurrent(plan),targets.indices.contains(index),targets[index].tileID == id else {return false}
            pendingSpawns.insert(id)
            self.laserSpawnCallbacks[id] = { [weak self] in
                guard let self,self.specialIsCurrent(plan) else {return}
                pendingSpawns.remove(id);completeGameplay()
            }
            let previous=self.engine.state,result=self.engine.commitSpecialImpact(transactionID:plan.id,tileID:id)
            self.consume(result,previous:previous)
            guard result.accepted else {self.laserSpawnCallbacks.removeValue(forKey:id);pendingSpawns.remove(id);return false}
            self.onSpecialMoment?("laser-gun","impact",index)
            if index==0 || index==targets.count-1 {self.onHaptic?("heavy")}
            if let tile=plan.targets.first(where:{$0.id==id}) {self.smoke(at:geometry.center(row:tile.cell.row,column:tile.cell.column),special:false)}
            return true
        }
        let visualReceipt=beginVisual()
        let mounted=onAuthoredLaserImpact(targets,plan.generation,impact,{allContacts=true;completeGameplay()}) { [weak self] in self?.finishVisual(visualReceipt) }
        guard mounted else {finishVisual(visualReceipt);return}
        let beforeRelease=engine.state,released=engine.releaseTntReservation(transactionID:plan.id)
        consume(released,previous:beforeRelease)
    }

    private func startCoreTntImpacts(_ initial: NativeSpecialMovePlan,receipt: UInt64) {
        guard specialIsCurrent(initial) else { return }
        let beforeReserve=engine.state
        let reserved=engine.reserveTntTargets(transactionID:initial.id)
        consume(reserved,previous:beforeReserve)
        guard reserved.accepted,let plan=engine.pendingSpecial else {return}
        specialPresentationIDs=Set(plan.targets.map(\.id))
        let beforeRelease = engine.state
        let released = engine.releaseTntReservation(transactionID:plan.id)
        consume(released,previous:beforeRelease)
        let owner = SKNode(); effects.addChild(owner)
        let delays = plan.variant == "beach-ball" ? [0.0,0.26,0.56,0.9] : [0.0,0.2,0.4,0.6]
        let initialDelay = plan.variant == "flower" ? 0.7 : plan.variant == "barell" ? 0.2 : 0
        var actions: [SKAction] = initialDelay > 0 ? [.wait(forDuration:initialDelay)] : []
        for (index,tile) in plan.targets.enumerated() {
            if index > 0 { actions.append(.wait(forDuration:delays[index]-delays[index-1])) }
            actions.append(.run { [weak self] in
                guard let self,self.specialIsCurrent(plan) else { return }
                let previous = self.engine.state
                let result = self.engine.commitSpecialImpact(transactionID: plan.id,tileID: tile.id)
                self.consume(result,previous: previous)
                if result.accepted,let geometry = self.geometry {
                    self.onSpecialMoment?(plan.variant ?? "tnt","impact",index)
                    if index == 0 || index == plan.targets.count-1 { self.onHaptic?("heavy") }
                    self.smoke(at: geometry.center(row: tile.cell.row,column: tile.cell.column),special: false)
                }
            })
        }
        actions += [.wait(forDuration: 0.56+0.08),.run { [weak self,weak owner] in
            guard let self,self.specialIsCurrent(plan) else { owner?.removeFromParent(); return }
            let previous = self.engine.state
            let result = self.engine.commitSpecialBoard(transactionID: plan.id)
            self.specialPresentationID = nil; self.specialPresentationIDs.removeAll()
            self.consume(result,previous: previous)
            self.navigationLocked = self.engine.state.terminal != nil || self.pendingTerminal != nil
            self.finishVisual(receipt); owner?.removeFromParent()
        }]
        owner.run(.sequence(actions),withKey: "tnt-captured-impacts")
    }

    override func update(_ currentTime: TimeInterval) {
        guard !disposed, !suspended else { lastFrame = nil; return }
        let elapsedDelta=lastFrame.map {max(0,currentTime-$0)} ?? 0
        let delta=min(0.05,elapsedDelta)
        // GSAP's source ticker uses full elapsed time for sub500ms hitches,
        // and its default lag smoothing substitutes33ms after larger stalls.
        let fizzDelta=elapsedDelta>0.5 ? 0.033:elapsedDelta
        lastFrame = currentTime
        textures.advanceIdlePhases()
        for node in nodesByID.values where node.hasAnimatedArtwork {
            node.tick(delta, suspended: engine.state.terminal != nil || exitInProgress || specialPresentationIDs.contains(node.tileID), viewportCenter: size.width / 2,fizzDelta:fizzDelta)
        }
    }

    override func didFinishUpdate() {
        guard !disposed, !suspended else { return }
        publishFishIdleFrames()
        let hasIdle = engine.state.terminal == nil && !exitInProgress && nodesByID.values.contains { $0.hasAnimatedArtwork }
        let actions = hasActions() || nodesByID.values.contains { $0.hasPresentationActions }
            || effects.children.contains { $0.hasActions() } || hudStarFlights.children.contains { $0.hasActions() } || !regularSixPresentations.isEmpty || hud.hasActions() || roundIndicator.hasAnimatedPresentation || ghosts.children.contains { $0.hasActions() }
        if !hasIdle && !actions && activeTouch == nil { onRenderingDemand?(false); lastFrame = nil }
    }

    func setSuspended(_ value: Bool) {
        guard !disposed else { return }
        suspended = value; lastFrame = nil
        for owner in regularSixPresentations.values {owner.setSuspended(value)}
        if value {
            let hadOrdinary = !ordinaryAbsorbs.isEmpty || !ordinaryPostchecks.isEmpty || !ordinarySpawnVisuals.isEmpty || !ordinaryDeferred.isEmpty || ordinarySixVisual != nil
            cancelDrag(); cancelCandidate(); engine.cancelForBackground()
            let pendingMeters = Array(meterVisuals.values); meterVisuals.removeAll()
            for (owner,receipt) in pendingMeters { owner.removeAllActions();owner.removeFromParent();finishVisual(receipt) }
            for star in hudStarFlights.children { star.removeAllActions(); star.removeFromParent() }
            hudStarIDs.removeAll()
            let receipts = Array(hudStarVisualReceipts.values); hudStarVisualReceipts.removeAll()
            for receipt in receipts { finishVisual(receipt) }
            if specialPresentationID != nil || directPresentationID != nil || hadOrdinary {
                ordinaryAbsorbs.removeAll();ordinaryPostchecks.removeAll();ordinarySpawnVisuals.removeAll();ordinaryDeferred.removeAll();ordinaryPrimaryVisuals.removeAll();ordinarySixVisual=nil
                laserSpawnCallbacks.removeAll()
                if let variant=directPresentationVariant {onSpecialPresentationCancelled?(variant)}
                directPresentationID=nil;directPresentationVariant=nil;directFinalReceipt=nil
                onSpecialPresentationCancelled?(specialPresentationVariant);specialPresentationVariant = nil
                removeAction(forKey: "special-tnt-frame6");removeAction(forKey:"native-special-activation"); retireEffects()
                for id in specialPresentationIDs { nodesByID[id]?.removeAllActions(); nodesByID[id]?.visual.zRotation = 0 }
                specialPresentationIDs.removeAll(); specialPresentationID = nil;directPresentationID=nil;directPresentationVariant=nil;directFinalReceipt=nil
                visualLifetime += 1; visualOwners = 0
                synchronize()
                navigationLocked = engine.state.terminal != nil || pendingTerminal != nil || exitInProgress
            }
        }
        isPaused = value; onRenderingDemand?(!value)
        if !value && !exitInProgress { synchronize();releaseFinalDirectIfReady(); startHUDStarFlights(ids: engine.pendingHUDStars.map(\.id)); evaluate(); publishPendingTerminal() }
    }

    func handleMemoryWarning() {
        guard !disposed, activeTouch == nil, !hasActions(), effects.children.isEmpty,
              !nodesByID.values.contains(where: { $0.hasPresentationActions }) else { return }
        var paths: Set<String> = ["assets/tile.png", "assets/shadow.png", "assets/paper-bg.png", "assets/close-icon.png", "assets/hud/help.png", "assets/hud/score-hud.png","assets/hud/combo-hud.png","assets/hud/extra-combo-hud.png","assets/hud/mega-combo-hud.png"]
        for node in nodesByID.values { paths.formUnion(node.resourcePaths) }
        textures.purgeUnused(retaining: paths)
    }

    func animateExit(completion: @escaping (Bool) -> Void) {
        guard !disposed, !exitInProgress else { completion(false); return }
        cancelEntry(); cancelDrag(); cancelCandidate(); inputAdmitted = false; navigationLocked = true
        roundIndicator.exit()
        exitInProgress = true; exitCompletion = completion
        engine.setInputLock("native-board-exit",active: true)
        suspended = false; isPaused = false; onRenderingDemand?(true)
        let generation = engine.state.generation
        let targets: [SKNode] = nodesByID.values.sorted { $0.tileID < $1.tileID } + ghosts.children
        let plans = NativeBoardExitPlan.make(count: targets.count)
        exitOwners = targets.count + 1
        for plan in plans {
            let node = targets[plan.tileIndex]
            node.removeAllActions()
            if let die = node as? NativeDiceNode { die.visual.removeAllActions(); die.visual.setScale(1) }
            let base = CGPoint(x: node.xScale,y: node.yScale)
            let small = CGPoint(x: base.x*0.88,y: base.y*0.88)
            let peak = CGPoint(x: base.x*plan.peak,y: base.y*plan.peak)
            node.run(.sequence([.wait(forDuration: plan.delay),
                NativeBoardMotion.scale(from: base,to: small,duration: plan.settle,ease: .backIn(1.5)),
                .group([
                    .sequence([NativeBoardMotion.scale(from: small,to: peak,duration: plan.compress,ease: .power2In),
                        NativeBoardMotion.scale(from: peak,to: .zero,duration: plan.collapse,ease: .backIn(2))]),
                    .fadeOut(withDuration: max(0.12,plan.collapse*0.68))
                ]),.run { [weak self] in self?.finishExitOwner(generation: generation) }]),withKey: "board-exit")
        }
        hud.run(.sequence([.group([NativeBoardMotion.move(from: hud.position,to: CGPoint(x: 0,y: 100),duration: 0.3,ease: .power2In),
                        .fadeOut(withDuration: 0.3)]),.run { [weak self] in self?.finishExitOwner(generation: generation) }]),withKey: "hud-exit")
    }

    private func finishExitOwner(generation: UInt64) {
        guard !disposed, exitInProgress, engine.state.generation == generation else { return }
        exitOwners = max(0,exitOwners-1)
        if exitOwners == 0 { finishExit(completed: true) }
    }

    private func finishExit(completed: Bool) {
        guard exitInProgress else { return }
        exitInProgress = false; exitOwners = 0
        engine.setInputLock("native-board-exit",active: false)
        if !completed {
            roundIndicator.cancelExit()
            for node in nodesByID.values { node.removeAllActions(); node.visual.setScale(1) }
            for ghost in ghosts.children { ghost.removeAllActions(); ghost.setScale(1) }
            hud.removeAllActions(); hud.position = .zero; hud.alpha = 1
        }
        let completion = exitCompletion; exitCompletion = nil
        completion?(completed)
    }

    func dispose() {
        guard !disposed else { return }
        retireRegularSixPresentations()
        finishExit(completed: false)
        cancelEntry(); cancelDrag(); cancelCandidate(); disposed = true
        engine.setInputLock("native-board-entry-handoff",active:false);preparedEntryGeneration=nil
        specialPresentationIDs.removeAll(); specialPresentationID = nil;directPresentationID=nil;directPresentationVariant=nil;directFinalReceipt=nil
        ordinaryAbsorbs.removeAll();ordinaryPostchecks.removeAll();ordinarySpawnVisuals.removeAll();ordinaryDeferred.removeAll();ordinaryPrimaryVisuals.removeAll();ordinarySixVisual=nil
        pendingTerminal = nil; pendingTerminalGeneration = nil; visualLifetime += 1; visualOwners = 0
        removeAllActions(); retireEffects(); nodesByID.values.forEach { $0.dispose() }
        nodesByID.removeAll();meterVisuals.removeAll(); removeAllChildren(); textures.dispose()
        onFishIdleFrames?([:],engine.state.generation,true);onFishIdleFrames=nil
        onJourneyBottomDecorShake=nil;onPresentationFailure=nil;onStateChange = nil; onTerminal = nil; onGameplayEvent = nil; onGameplayReceipt = nil; onSpecialMoment = nil; onAuthoredFinale = nil;onAuthoredTntPresentation = nil;onAuthoredLaserImpact=nil;authoredTntPresentationReady = nil;authoredFinalePresentationReady=nil;onSpecialPresentationCancelled = nil; onTntGlyphClock = nil; onSplashGlyphClock = nil; onHaptic = nil
        onExitRequest = nil; onHelpRequest = nil; onScoreRequest = nil; onComboRequest = nil; onPointerState = nil; onRenderingDemand = nil; onBoardEntry = nil
    }
}
