import UIKit
import SpriteKit
import StackToSixGameplay

@MainActor
final class NativeGameplayViewController: UIViewController {
    let engine: NativeGameplayEngine
    var onExit: (() -> Void)?
    var onStateChange: ((NativeBoardState) -> Void)?
    var onTerminal: ((NativeResolution) -> Void)?
    var onGameplayEvent: ((NativeGameplayEvent) -> Void)?
    var onGameplayReceipt: ((NativeGameplayEvent,NativeTile?,NativeTile?,UInt64) -> Void)?
    var onSpecialFadeCapture: ((String,UInt64) -> ((Double) -> Void)?)?
    var onSpecialMoment: ((String?,String,Int) -> Void)?
    var onHelp: (() -> Void)?
    var onScore: (() -> Void)?
    var onCombo: (() -> Void)?
    var onPointerState: ((Bool) -> Void)?
    var onHaptic: ((String) -> Void)?
    var beforeInitialBoardEntry: ((@escaping () -> Void) -> Void)?
    var onBoardEntry: ((TimeInterval,[TimeInterval]) -> Void)?
    var onBoardArtworkFailure:(()->Void)?
    var journeyDecorCatalog:NativeJourneyBottomDecorCatalog?
    var journeyDecorResources:((URL)->NativeJourneyBottomDecorResourcePreparing)?
    private(set) var journeyBottomDecor:NativeJourneyBottomDecorOwner?
    private var decorWaiters:[(UInt64,(Bool)->Void)]=[]
    private var decorPreparing=false
    private var exitingBoard=false
    private let resourceRoot: URL
    private let spriteView = SKView()
    private let fishIdleOwner:NativeFishIdleOwner
    private let paperSurface:NativeAppPaperSurface
    private var preparedBoardEntryGeneration:UInt64?
    private var initialEntryGateRequested = false,initialEntryGateReleased = false
    private(set) var boardScene: NativeBoardScene?
    private var observations: [NSObjectProtocol] = []
    private var disposed = false
    private var explicitlySuspended = false
    private var backgrounded = false
    private var sourceIdleSuspended=false
    private var hasPresentedScene = false
    private var fishFinale: NativeFishFinalePresentation?
    private var tntGlyphs: [String: NativeSplashGlyphField] = [:]
    private var fishGeneration: UInt64?
    private var bottleFinale: NativeBottleFinalePresentation?
    private var bottleGeneration: UInt64?
    private var honeyFinale: NativeHoneyFinalePresentation?
    private var honeyGeneration: UInt64?
    private var lastRoboExitFrame:Int?
    private var laserResources:NativeLaserGunResources?
    private var finaleVariantReadiness:[String:Bool] = [:]
    private var tntVariantReadiness: [String:Bool] = [:]
    private var area55Finales: [String:NativeFinitePresentation] = [:]
    private var area55Generations: [String:UInt64] = [:]

    init(engine: NativeGameplayEngine, resourceRoot: URL) {
        self.engine = engine; self.resourceRoot = resourceRoot
        fishIdleOwner=NativeFishIdleOwner(resourceRoot:resourceRoot)
        paperSurface=NativeAppPaperSurface(artwork:JimiV9Artwork(resourceRoot:resourceRoot))
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func loadView() {
        let root = UIView(); root.backgroundColor = NativeAppPaperSurface.base
        paperSurface.frame=root.bounds;paperSurface.autoresizingMask=[.flexibleWidth,.flexibleHeight];root.addSubview(paperSurface)
        spriteView.backgroundColor = .clear; spriteView.allowsTransparency = true
        spriteView.ignoresSiblingOrder = false; spriteView.preferredFramesPerSecond = 60
        spriteView.frame = root.bounds; spriteView.autoresizingMask = [.flexibleWidth,.flexibleHeight]
        spriteView.accessibilityIdentifier = "native-gameplay-board"
        root.addSubview(spriteView)
        fishIdleOwner.frame=root.bounds;fishIdleOwner.autoresizingMask=[.flexibleWidth,.flexibleHeight];root.addSubview(fishIdleOwner)
        if beforeInitialBoardEntry != nil || journeyDecorCatalog != nil && engine.state.mode == .journey {
            spriteView.isHidden = true
        }
        view = root
        ensureJourneyBottomDecor()
        startDecorPreparation()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        let scene = NativeBoardScene(engine: engine, resourceRoot: resourceRoot, size: view.bounds.size)
        scene.onExitRequest = { [weak self, weak scene] in
            guard let self, let scene, !self.disposed, !scene.navigationLocked else { return }
            scene.cancelDrag(); self.onStateChange?(self.engine.state); self.onExit?()
        }
        scene.onTntGlyphClock = { [weak self] id,time,finished in
            guard let self else { return }
            if finished { self.tntGlyphs.removeValue(forKey: id)?.removeFromSuperview(); return }
            guard !self.disposed else { return }
            let glyphs: NativeSplashGlyphField
            if let existing = self.tntGlyphs[id] { glyphs = existing }
            else {
                let color = UIColor(red: 241.0/255,green: 132.0/255,blue: 83.0/255,alpha: 1)
                glyphs = NativeSplashGlyphField(artwork: JimiV9Artwork(resourceRoot: self.resourceRoot),text: "BOOM",colors: [color,color],splitIndex: 0)
                glyphs.frame = self.view.bounds; glyphs.autoresizingMask = [.flexibleWidth,.flexibleHeight]
                self.view.addSubview(glyphs); self.tntGlyphs[id] = glyphs; glyphs.layoutIfNeeded()
            }
            glyphs.paint(seconds: time)
        }
        scene.onSplashGlyphClock = { [weak self] variant,id,time,finished in
            guard let self else { return }
            if finished { self.tntGlyphs.removeValue(forKey: id)?.removeFromSuperview(); return }
            guard !self.disposed,variant == "star" || variant == "juice" else { return }
            let glyphs: NativeSplashGlyphField
            if let existing = self.tntGlyphs[id] { glyphs = existing }
            else {
                let color = variant == "juice" ? UIColor(red: 1,green: 166.0/255,blue: 175.0/255,alpha: 1) : UIColor(red: 1,green: 203.0/255,blue: 129.0/255,alpha: 1)
                glyphs = NativeSplashGlyphField(artwork: JimiV9Artwork(resourceRoot: self.resourceRoot),text: variant == "juice" ? "BUBBLY" : "SPARKLE",colors: [color],splitIndex: 0)
                glyphs.frame = self.view.bounds; glyphs.autoresizingMask = [.flexibleWidth,.flexibleHeight]
                self.view.addSubview(glyphs); self.tntGlyphs[id] = glyphs; glyphs.layoutIfNeeded()
            }
            glyphs.paint(seconds: time)
        }
        scene.onFishIdleFrames={ [weak self] frames,generation,force in
            guard let self,!self.disposed else {return}
            self.fishIdleOwner.paint(frames,generation:generation,force:force)
        }
        fishIdleOwner.onPrepared={ [weak self,weak scene] id,generation in
            guard let self,!self.disposed,self.engine.state.generation==generation else {return}
            scene?.prepareFishMedia(tileID:id,generation:generation)
        }
        fishIdleOwner.onMediaReady={ [weak self,weak scene] id,generation,ready in
            guard let self,!self.disposed,self.engine.state.generation==generation else {return}
            scene?.setFishMediaReady(tileID:id,generation:generation,ready:ready)
        }
        scene.onHaptic = { [weak self] style in self?.onHaptic?(style) }
        scene.onSpecialPresentationCancelled = { [weak self] variant in
            guard let variant else { return }; self?.area55Finales[variant]?.dispose()
        }
        scene.authoredFinalePresentationReady = { [weak self] variant in self?.finaleArtworkReady(variant) == true }
        scene.authoredTntPresentationReady = { [weak self] variant in self?.tntArtworkReady(variant) == true }
        scene.onAuthoredLaserImpact = { [weak self] targets,generation,impact,allContacts,completion in
            guard let self,!self.disposed,self.engine.state.generation == generation,self.tntArtworkReady("laser-gun"),let resources=self.laserResources else {return false}
            let owner=NativeLaserGunImpactPresentation(resources:resources,viewport:self.view.bounds.size,targets:targets,generation:generation)
            guard owner.assetReady else {owner.dispose();return false}
            self.area55Finales["laser-gun"]?.dispose();self.area55Finales["laser-gun"]=owner;self.area55Generations["laser-gun"]=generation
            owner.autoresizingMask=[.flexibleWidth,.flexibleHeight];self.view.addSubview(owner)
            owner.onImpact=impact;owner.onImpactsComplete=allContacts
            owner.onCue={ [weak self] moment,index in
                guard self?.engine.state.generation == generation else {return}
                let prefix="laser-gun-",cue=moment.hasPrefix(prefix) ? String(moment.dropFirst(prefix.count)):moment
                self?.onSpecialMoment?("laser-gun",cue,index)
            }
            owner.onFinished={ [weak self,weak owner] _ in
                if self?.area55Finales["laser-gun"] === owner {self?.area55Finales.removeValue(forKey:"laser-gun");self?.area55Generations.removeValue(forKey:"laser-gun")}
                completion()
            }
            owner.start();return true
        }
        scene.onAuthoredTntPresentation = { [weak self] variant,_,generation,ready,completion in
            self?.presentTntVariant(variant,generation:generation,onGameplayReady:ready,completion:completion) == true
        }
        scene.onAuthoredFinale = { [weak self] variant,origin,generation,completion in
            guard let self,!self.disposed,self.engine.state.generation == generation else { return false }
            if ["flower","barell","beach-ball"].contains(variant) {
                return self.presentTntVariant(variant,generation:generation,onGameplayReady:nil,completion:completion)
            }
            if variant == "spaceship" || variant == "laser-gun" {
                let owner: NativeFinitePresentation,ready: Bool
                if variant == "spaceship" {
                    let spaceship = NativeSpaceshipFinalePresentation(resourceRoot: self.resourceRoot,viewport: self.view.bounds.size,origin: origin,generation: generation)
                    owner = spaceship; ready = spaceship.assetReady
                } else {
                    let laser = NativeLaserGunFinalePresentation(resourceRoot: self.resourceRoot,viewport: self.view.bounds.size,origin: origin,generation: generation)
                    owner = laser; ready = laser.assetReady
                }
                guard ready else { owner.dispose(); return false }
                self.area55Finales[variant]?.dispose()
                if variant == "spaceship" { self.bottleFinale?.dispose(); self.honeyFinale?.dispose() }
                self.area55Finales[variant] = owner; self.area55Generations[variant] = generation
                owner.autoresizingMask = [.flexibleWidth,.flexibleHeight]; self.view.addSubview(owner)
                owner.onCue = { [weak self] moment,index in
                    guard self?.engine.state.generation == generation else { return }
                    let prefix = variant+"-",cue = moment.hasPrefix(prefix) ? String(moment.dropFirst(prefix.count)) : moment
                    self?.onSpecialMoment?(variant,cue,index)
                }
                let releaseSource=variant == "laser-gun" ? self.boardScene?.beginSourceMotion(.tntFinale,id:UUID().uuidString,generation:generation):nil
                owner.onFinished = { [weak self,weak owner] _ in
                    releaseSource?()
                    if self?.area55Finales[variant] === owner { self?.area55Finales.removeValue(forKey: variant); self?.area55Generations.removeValue(forKey: variant) }
                    completion()
                }
                owner.start(); return true
            }
            if variant == "mushroom" || variant == "robo-cube" {
                let owner:NativeFinitePresentation
                if variant == "mushroom" {
                    let mushroom=NativeMushroomFinalePresentation(resourceRoot:self.resourceRoot,viewport:self.view.bounds.size)
                    guard mushroom.assetReady else {mushroom.dispose();return false}
                    mushroom.onHaptic={ [weak self] style in guard self?.engine.state.generation == generation else {return};self?.onHaptic?(style)}
                    owner=mushroom
                } else {
                    let robo=NativeRoboFinalePresentation(resourceRoot:self.resourceRoot,viewport:self.view.bounds.size,previousExitFrame:self.lastRoboExitFrame)
                    guard robo.assetReady else {robo.dispose();return false}
                    robo.onHaptic={ [weak self] style in guard self?.engine.state.generation == generation else {return};self?.onHaptic?(style)}
                    robo.onExitFrameSelected={ [weak self] frame in guard self?.engine.state.generation == generation else {return};self?.lastRoboExitFrame=frame}
                    owner=robo
                }
                self.area55Finales[variant]?.dispose();self.area55Finales[variant]=owner;self.area55Generations[variant]=generation
                owner.autoresizingMask=[.flexibleWidth,.flexibleHeight];self.view.addSubview(owner)
                let releaseSource=self.boardScene?.beginSourceMotion(.juiceFinale,id:UUID().uuidString,generation:generation)
                owner.onFinished={ [weak self,weak owner] _ in
                    releaseSource?()
                    (owner as? NativeMushroomFinalePresentation)?.onHaptic=nil
                    (owner as? NativeRoboFinalePresentation)?.onHaptic=nil;(owner as? NativeRoboFinalePresentation)?.onExitFrameSelected=nil
                    if self?.area55Finales[variant] === owner {self?.area55Finales.removeValue(forKey:variant);self?.area55Generations.removeValue(forKey:variant)}
                    completion()
                }
                owner.start();return true
            }
            if variant == "cubero" {
                let owner=NativeCuberoFinalePresentation(resourceRoot:self.resourceRoot,viewport:self.view.bounds.size)
                guard owner.assetReady else {owner.dispose();return false}
                self.area55Finales[variant]?.dispose()
                self.area55Finales[variant]=owner;self.area55Generations[variant]=generation
                owner.autoresizingMask=[.flexibleWidth,.flexibleHeight];self.view.addSubview(owner)
                owner.onHaptic={ [weak self] style in
                    guard self?.engine.state.generation == generation else {return}
                    self?.onHaptic?(style)
                }
                owner.onFinished={ [weak self,weak owner] _ in
                    owner?.onHaptic=nil
                    if self?.area55Finales[variant] === owner {self?.area55Finales.removeValue(forKey:variant);self?.area55Generations.removeValue(forKey:variant)}
                    completion()
                }
                owner.start();return true
            }
            if variant == "bee" {
                let owner=NativeBeeFinalePresentation(resourceRoot:self.resourceRoot,viewport:self.view.bounds.size,origin:origin)
                guard owner.assetReady else {owner.dispose();return false}
                self.area55Finales[variant]?.dispose()
                self.area55Finales[variant]=owner;self.area55Generations[variant]=generation
                owner.autoresizingMask=[.flexibleWidth,.flexibleHeight];self.view.addSubview(owner)
                owner.onCue={ [weak self] moment,index in
                    guard self?.engine.state.generation == generation else {return}
                    self?.onSpecialMoment?(variant,moment,index)
                }
                owner.onHaptic={ [weak self] style in
                    guard self?.engine.state.generation == generation else {return}
                    self?.onHaptic?(style)
                }
                owner.onFinished={ [weak self,weak owner] _ in
                    owner?.onHaptic=nil
                    if self?.area55Finales[variant] === owner {self?.area55Finales.removeValue(forKey:variant);self?.area55Generations.removeValue(forKey:variant)}
                    completion()
                }
                owner.start();return true
            }
            if variant == "kanta" {
                let owner = NativeKantaFinalePresentation(resourceRoot:self.resourceRoot,viewport:self.view.bounds.size)
                guard owner.assetReady else {owner.dispose();return false}
                self.area55Finales[variant]?.dispose()
                self.area55Finales[variant] = owner;self.area55Generations[variant] = generation
                owner.autoresizingMask = [.flexibleWidth,.flexibleHeight];self.view.addSubview(owner)
                owner.onCue = { [weak self,weak owner] moment,index in
                    guard let self,!self.disposed,self.engine.state.generation == generation else {return}
                    self.onSpecialMoment?(variant,moment,index)
                    if moment == "walking" {owner?.onAudioFade = self.onSpecialFadeCapture?(variant,generation)}
                }
                owner.onHaptic = { [weak self] style in
                    guard self?.engine.state.generation == generation else {return}
                    self?.onHaptic?(style)
                }
                owner.onFinished = { [weak self,weak owner] _ in
                    owner?.onAudioFade = nil;owner?.onHaptic = nil
                    if self?.area55Finales[variant] === owner {self?.area55Finales.removeValue(forKey:variant);self?.area55Generations.removeValue(forKey:variant)}
                    completion()
                }
                owner.start();return true
            }
            if variant == "bottle" {
                self.area55Finales["spaceship"]?.dispose()
                self.honeyFinale?.dispose()
                self.bottleFinale?.dispose()
                let owner = NativeBottleFinalePresentation(resourceRoot: self.resourceRoot,viewport: self.view.bounds.size)
                owner.autoresizingMask = [.flexibleWidth,.flexibleHeight]
                self.bottleFinale = owner; self.bottleGeneration = generation; self.view.addSubview(owner)
                owner.onCue = { [weak self] moment,index in
                    guard self?.engine.state.generation == generation else { return }
                    self?.onSpecialMoment?("bottle",moment,index)
                    if moment == "water-waves" { self?.onHaptic?("medium") }
                }
                owner.onFinished = { [weak self,weak owner] _ in
                    if self?.bottleFinale === owner { self?.bottleFinale = nil; self?.bottleGeneration = nil }
                    completion()
                }
                owner.start(); return true
            }
            if variant == "honey" {
                self.area55Finales["spaceship"]?.dispose()
                self.bottleFinale?.dispose(); self.honeyFinale?.dispose()
                let owner = NativeHoneyFinalePresentation(resourceRoot: self.resourceRoot,viewport: self.view.bounds.size)
                owner.autoresizingMask = [.flexibleWidth,.flexibleHeight]
                self.honeyFinale = owner; self.honeyGeneration = generation; self.view.addSubview(owner)
                owner.onCue = { [weak self] moment,index in
                    guard self?.engine.state.generation == generation else { return }
                    self?.onSpecialMoment?("honey",moment,index)
                }
                owner.onFinished = { [weak self,weak owner] _ in
                    if self?.honeyFinale === owner { self?.honeyFinale = nil; self?.honeyGeneration = nil }
                    completion()
                }
                owner.start(); return true
            }
            guard variant == "fish" else { return false }
            self.fishFinale?.dispose()
            let owner = NativeFishFinalePresentation(resourceRoot: self.resourceRoot,origin: origin,viewport: self.view.bounds.size)
            owner.autoresizingMask = [.flexibleWidth,.flexibleHeight]
            self.fishFinale = owner; self.fishGeneration = generation; self.view.addSubview(owner)
            owner.onFinished = { [weak self,weak owner] success in
                if self?.fishFinale === owner { self?.fishFinale = nil; self?.fishGeneration = nil }
                if !success { NSLog("[NativeFishFinale] preserved HEVC rendering did not complete") }
                completion()
            }
            owner.start(); return true
        }
        scene.onHelpRequest = { [weak self] in self?.onHelp?() }
        scene.onScoreRequest = { [weak self] in self?.onScore?() }
        scene.onComboRequest = { [weak self] in self?.onCombo?() }
        scene.onPointerState = { [weak self] active in self?.onPointerState?(active) }
        scene.onStateChange = { [weak self] state in
            if let generation = self?.fishGeneration,generation != state.generation { self?.fishFinale?.dispose() }
            if let generation = self?.bottleGeneration,generation != state.generation { self?.bottleFinale?.dispose() }
            if let generation = self?.honeyGeneration,generation != state.generation { self?.honeyFinale?.dispose() }
            if let self { for (variant,generation) in self.area55Generations where generation != state.generation { self.area55Finales[variant]?.dispose() } }
            self?.onStateChange?(state)
        }
        scene.onTerminal = { [weak self] result in self?.onTerminal?(result) }
        scene.onBoardEntry = { [weak self] duration,beats in self?.onBoardEntry?(duration,beats) }
        scene.onHUDDrop = { [weak self] generation in
            guard let self,!self.disposed,self.engine.state.generation==generation else{return}
            self.journeyBottomDecor?.enter()
        }
        scene.onJourneyBottomDecorShake = { [weak self] offset,generation in
            self?.journeyBottomDecor?.applyShake(sourceOffset:offset,generation:generation)
        }
        scene.onGameplayReceipt = { [weak self] event,source,destination,generation in self?.onGameplayReceipt?(event,source,destination,generation) }
        scene.onSpecialMoment = { [weak self] variant,moment,index in self?.onSpecialMoment?(variant,moment,index) }
        scene.onGameplayEvent = { [weak self] event in self?.onGameplayEvent?(event) }
        scene.onFrameTarget={ [weak self] fps in
            guard let self,!self.disposed,self.spriteView.preferredFramesPerSecond != fps else{return}
            self.spriteView.preferredFramesPerSecond=fps
        }
        scene.onSpecialIdleSuspended={ [weak self] suspended in
            guard let self,!self.disposed else{return};self.sourceIdleSuspended=suspended
            self.fishIdleOwner.setSuspended(suspended || self.backgrounded || self.explicitlySuspended)
        }
        scene.onRenderingDemand = { [weak self] active in
            guard let self, !self.disposed else { return }
            self.spriteView.isPaused = !active || self.backgrounded || (self.explicitlySuspended && !self.exitingBoard)
        }
        boardScene = scene
        observations = [
            NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.backgrounded = true; self?.applySuspension() }
            },
            NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.backgrounded = false; self?.applySuspension() }
            }
        ]
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        guard !disposed,let boardScene,spriteView.bounds.width > 0,spriteView.bounds.height > 0 else { return }
        journeyBottomDecor?.frame=view.bounds
        if !hasPresentedScene,!initialEntryGateReleased,beforeInitialBoardEntry != nil || journeyBottomDecor != nil {
            if !initialEntryGateRequested {
                initialEntryGateRequested = true
                let generation = engine.state.generation
                let release:()->Void = { [weak self] in
                    self?.prepareBoardEntryArtwork { [weak self] ready in
                        guard let self,!self.disposed,!self.initialEntryGateReleased,self.engine.state.generation == generation else {return}
                        guard ready else{self.onBoardArtworkFailure?();return}
                        self.initialEntryGateReleased=true;self.spriteView.isHidden=false
                        self.view.setNeedsLayout();self.view.layoutIfNeeded()
                    }
                }
                if let beforeInitialBoardEntry {beforeInitialBoardEntry(release)}else{release()}
            }
            return
        }
        boardScene.layout(size: spriteView.bounds.size,insets: view.safeAreaInsets,animateEntry: !hasPresentedScene)
        if !hasPresentedScene {
            boardScene.prepareSourceBoardEntry()
            hasPresentedScene=true;spriteView.presentScene(boardScene)
            // Artwork admission is independent of the optional board wave.
            if !boardScene.isHUDRevealPending {journeyBottomDecor?.enter()}
        }
    }
    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        setSuspended(true)
    }
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        if hasPresentedScene { setSuspended(false) }
    }
    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        boardScene?.handleMemoryWarning()
    }

    private func finaleArtworkReady(_ variant:String)->Bool {
        guard !disposed else {return false}
        if let cached=finaleVariantReadiness[variant] {return cached}
        if ["flower","barell","beach-ball"].contains(variant) {return tntArtworkReady(variant)}
        let paths:[String]
        switch variant {
        case "kanta":paths=["assets/journey assets/robo/robo1.png","assets/journey assets/robo/robo frontalni.png"]+["01","03","04","kante-ljevo","kante-sredina","kante-desno"].map {"assets/shop/kanta/\($0).png"}
        case "mushroom":paths=NativeMushroomFinalePresentation.assets
        case "robo-cube":paths=NativeRoboFinalePresentation.assets
        case "cubero":paths=(1...7).map {"assets/shop/cubero/krpa\($0).png"}
        case "bee":paths=(1...4).map {"assets/shop/bee/bee\($0).png"}+(1...6).map {"assets/shop/bee/leaf\($0).png"}+["assets/shop/honey/bee1.png","assets/shop/honey/bee3.png"]
        case "honey":paths=(1...7).map {"assets/shop/honey/bee\($0).png"}
        case "bottle":paths=NativeBottleFinaleMotion.layers.map {"assets/shop/bottle/bottle animation pack/\($0.asset).png"}+(1...6).map {"assets/shop/bottle/bottle animation pack/bubble\($0).png"}
        case "laser-gun":paths=(1...3).map {"assets/shop/gun/lasergun\($0)@2x.png"}
        case "spaceship":paths=(1...4).map {"assets/shop/spaceship/saucer\($0)@2x.png"}+["assets/shop/spaceship/leftbeam@2x.png","assets/shop/spaceship/rightbeam@2x.png","assets/tile@2x.png"]+NativeArea55Motion.debris.compactMap(\.source)
        case "fish":
            let ready=["assets/shop/fish/fish-mobile-hevc.mov","assets/shop/fish/bubbly-fast-hevc.mov"].allSatisfy {FileManager.default.fileExists(atPath:resourceRoot.appendingPathComponent($0).path)}
            finaleVariantReadiness[variant]=ready;return ready
        default:return false
        }
        let artwork=JimiV9Artwork(resourceRoot:resourceRoot)
        let ready=paths.allSatisfy {artwork.image($0,densityAware:true) != nil}
        finaleVariantReadiness[variant]=ready;return ready
    }

    private func tntArtworkReady(_ variant: String) -> Bool {
        if variant == "laser-gun" {
            if laserResources == nil {laserResources=NativeLaserGunResources(resourceRoot:resourceRoot)}
            return laserResources.map {NativeLaserGunImpactPresentation.resourcesReady($0)} == true
        }
        if let cached = tntVariantReadiness[variant] { return cached }
        let paths: [String]
        if variant == "flower" { paths = NativeTntVariantPresentation.assets(.flower) }
        else if variant == "barell" { paths = NativeTntVariantPresentation.assets(.barell) }
        else if variant == "beach-ball" { paths = NativeBeachBallPresentation.assets }
        else { return false }
        let artwork = JimiV9Artwork(resourceRoot:resourceRoot)
        let ready = paths.allSatisfy { artwork.image($0.replacingOccurrences(of:"@2x.png",with:".png"),densityAware:true) != nil }
        tntVariantReadiness[variant] = ready; return ready
    }

    private func presentTntVariant(_ variant: String,generation: UInt64,onGameplayReady: (() -> Void)?,completion: @escaping () -> Void) -> Bool {
        guard !disposed,engine.state.generation == generation,tntArtworkReady(variant) else { return false }
        let owner: NativeFinitePresentation
        if variant == "beach-ball" {
            let ball = NativeBeachBallPresentation(resourceRoot:resourceRoot,viewport:view.bounds.size)
            guard ball.assetsReady else { ball.dispose(); return false }
            ball.onGameplayReady = onGameplayReady; owner = ball
        } else {
            let tnt = NativeTntVariantPresentation(resourceRoot:resourceRoot,variant:variant == "flower" ? .flower:.barell,viewport:view.bounds.size)
            guard tnt.assetsReady else { tnt.dispose(); return false }
            tnt.onSprite6Entered = onGameplayReady; owner = tnt
        }
        // These variants share their source TNT/Flower visual owner.
        for key in ["flower","barell","beach-ball"] { area55Finales[key]?.dispose() }
        area55Finales[variant] = owner;area55Generations[variant] = generation
        owner.autoresizingMask = [.flexibleWidth,.flexibleHeight];view.addSubview(owner)
        owner.onCue = { [weak self] moment,index in
            guard self?.engine.state.generation == generation else { return }
            self?.onSpecialMoment?(variant,moment,index)
        }
        let sourceKind:NativeSourceFrameRuntime.Kind=variant == "beach-ball" ? .juiceFinale:.tntFinale
        let releaseSource=boardScene?.beginSourceMotion(sourceKind,id:UUID().uuidString,generation:generation)
        owner.onFinished = { [weak self,weak owner] _ in
            releaseSource?()
            if self?.area55Finales[variant] === owner {self?.area55Finales.removeValue(forKey:variant);self?.area55Generations.removeValue(forKey:variant)}
            completion()
        }
        owner.start(); return true
    }

    func setSuspended(_ value: Bool) {
        guard !disposed else { return }
        explicitlySuspended = value; applySuspension()
    }

    private func applySuspension() {
        guard !disposed else { return }
        let value = backgrounded || (explicitlySuspended && !exitingBoard)
        fishIdleOwner.setSuspended(value || sourceIdleSuspended)
        boardScene?.setSuspended(value); fishFinale?.setSuspended(value); bottleFinale?.setSuspended(value); honeyFinale?.setSuspended(value)
        area55Finales.values.forEach { $0.setSuspended(value) }
        journeyBottomDecor?.setForeground(!backgrounded)
        journeyBottomDecor?.setSuspended(backgrounded || explicitlySuspended && !exitingBoard)
        if !backgrounded {startDecorPreparation()}
        if value { onStateChange?(engine.state) }
    }

    /// Called after the engine installs a fresh generation beneath the opaque
    /// transition cover. Only this captured release starts its authored wave.
    func prepareNextBoardEntry() -> (() -> Void)? {
        guard !disposed,hasPresentedScene,let boardScene,preparedBoardEntryGeneration != engine.state.generation else {return nil}
        let generation=engine.state.generation
        preparedBoardEntryGeneration=generation
        refreshFromEngine();boardScene.prepareNextBoardEntry()
        var released=false
        return { [weak self,weak boardScene] in
            guard let self,let boardScene,!self.disposed,!released,self.boardScene === boardScene,self.engine.state.generation == generation,self.preparedBoardEntryGeneration == generation else {return}
            released=true;boardScene.releasePreparedBoardEntry(generation:generation)
            if !boardScene.isHUDRevealPending {self.journeyBottomDecor?.enter()}
        }
    }

    func refreshFromEngine() {
        let needsDecorEntry=journeyBottomDecor?.generation != engine.state.generation
        ensureJourneyBottomDecor();startDecorPreparation()
        if needsDecorEntry,hasPresentedScene,preparedBoardEntryGeneration != engine.state.generation {
            let generation=engine.state.generation
            prepareBoardEntryArtwork { [weak self] ready in
                guard let self,!self.disposed,self.engine.state.generation==generation else{return}
                if ready {self.journeyBottomDecor?.enter()}else{self.onBoardArtworkFailure?()}
            }
        }
        if let fishGeneration,fishGeneration != engine.state.generation { fishFinale?.dispose() }
        if let bottleGeneration,bottleGeneration != engine.state.generation { bottleFinale?.dispose() }
        if let honeyGeneration,honeyGeneration != engine.state.generation { honeyFinale?.dispose() }
        for (variant,generation) in area55Generations where generation != engine.state.generation { area55Finales[variant]?.dispose() }
        boardScene?.synchronize(); boardScene?.evaluate()
    }

    func animateBoardExit(completion: @escaping (Bool) -> Void) {
        guard let boardScene,!disposed,!exitingBoard else {completion(false);return}
        exitingBoard=true
        journeyBottomDecor?.setSuspended(backgrounded)
        var remaining=journeyBottomDecor == nil ? 1:2,finished=false
        let generation=engine.state.generation
        let settled:(Bool)->Void = { [weak self] success in
            guard !finished else{return}
            guard let self,!self.disposed,self.engine.state.generation==generation,success else {
                finished=true;self?.exitingBoard=false;completion(false);return
            }
            remaining -= 1
            if remaining==0 {finished=true;self.exitingBoard=false;completion(true)}
        }
        journeyBottomDecor?.exit(completion:settled)
        boardScene.animateExit(completion:settled)
    }

    /// Preparation runs while the themed carrier is moving. Its opaque cover
    /// remains until the selected original footer is ready for the HUD entry.
    func prepareBoardEntryArtwork(completion:@escaping(Bool)->Void) {
        guard !disposed else{completion(false);return}
        loadViewIfNeeded();ensureJourneyBottomDecor()
        guard let owner=journeyBottomDecor else{completion(true);return}
        if owner.isPrepared,!backgrounded,owner.isForeground {completion(true);return}
        decorWaiters.append((engine.state.generation,completion));startDecorPreparation()
    }
    private func ensureJourneyBottomDecor() {
        guard !disposed,isViewLoaded,engine.state.mode == .journey,let catalog=journeyDecorCatalog else{return}
        let generation=engine.state.generation
        if journeyBottomDecor?.generation == generation {return}
        let old=journeyBottomDecor;journeyBottomDecor=nil;decorPreparing=false
        let cancelled=decorWaiters;decorWaiters.removeAll();old?.dispose();cancelled.forEach{$0.1(false)}
        let owner=NativeJourneyBottomDecorOwner(root:resourceRoot,board:engine.state.board,viewport:view.bounds.size,generation:generation,isCurrent:{[weak self] in
            self?.disposed == false && self?.engine.state.generation == $0
        },catalog:catalog,resources:journeyDecorResources?(resourceRoot),isApplicationActive:{[weak self] in self?.backgrounded == false})
        journeyBottomDecor=owner;owner.autoresizingMask=[.flexibleWidth,.flexibleHeight]
        view.insertSubview(owner,aboveSubview:paperSurface)
        owner.setSuspended(explicitlySuspended && !exitingBoard)
    }
    private func startDecorPreparation() {
        guard !disposed,!backgrounded,!decorPreparing,let owner=journeyBottomDecor else{return}
        let generation=owner.generation
        decorPreparing=true
        owner.prepare { [weak self,weak owner] ready in
            guard let self,let owner,!self.disposed,self.journeyBottomDecor === owner,self.engine.state.generation==generation else{return}
            self.decorPreparing=false
            // Background cancellation retains the cover and retries on resume.
            guard !self.backgrounded,owner.isForeground else{return}
            let replies=self.decorWaiters;self.decorWaiters.removeAll()
            replies.forEach{$0.1(ready && $0.0==generation && !self.disposed && self.engine.state.generation==generation)}
        }
    }

    func dispose() {
        guard !disposed else { return }
        disposed = true;laserResources=nil;beforeInitialBoardEntry = nil
        let replies=decorWaiters;decorWaiters.removeAll();decorPreparing=false
        journeyBottomDecor?.dispose();journeyBottomDecor=nil;journeyDecorResources=nil;journeyDecorCatalog=nil;onBoardArtworkFailure=nil
        replies.forEach{$0.1(false)}
        observations.forEach(NotificationCenter.default.removeObserver); observations.removeAll()
        fishIdleOwner.dispose()
        fishFinale?.dispose(); fishFinale = nil; fishGeneration = nil
        bottleFinale?.dispose(); bottleFinale = nil; bottleGeneration = nil
        honeyFinale?.dispose(); honeyFinale = nil; honeyGeneration = nil
        Array(area55Finales.values).forEach { $0.dispose() }; area55Finales.removeAll(); area55Generations.removeAll()
        boardScene?.dispose(); boardScene = nil;
        tntGlyphs.values.forEach { $0.removeFromSuperview() }; tntGlyphs.removeAll(); spriteView.presentScene(nil); spriteView.isPaused = true
        onExit = nil; onStateChange = nil; onTerminal = nil; onGameplayEvent = nil; onHelp = nil; onScore = nil; onCombo = nil; onPointerState = nil; onHaptic = nil; onBoardEntry = nil; onGameplayReceipt = nil; onSpecialMoment = nil; onSpecialFadeCapture = nil
    }
}
