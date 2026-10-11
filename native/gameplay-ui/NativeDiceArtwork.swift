import SpriteKit
import UIKit
import ImageIO
import StackToSixGameplay

/// Presentation identities match special-dice-registry.ts. Gameplay kind is
/// supplied by the engine; this registry never infers rules from artwork.
struct NativeDiceArtwork {
    let path: String
    var size = CGSize(width: 128, height: 128)
    var anchor = CGPoint(x: 0.5, y: 0.5)
    var idleSheet: NativeDiceSheet? = nil

    static func definition(kind: String, variant: String?, regularSkin: Int = 0) -> Self {
        if let variant, let skin = variants[variant] { return skin }
        switch kind {
        case "wild", "wild-star", "star":
            return Self(path: "assets/wild.png", idleSheet: .star)
        case "wild-juice", "juice":
            return Self(path: "assets/wild-juice.png", idleSheet: .juice)
        case "wild-magnet", "magnet":
            return Self(path: "assets/wild-magnet.png", size: CGSize(width: 122.88, height: 122.88))
        case "wild-tnt", "tnt": return Self(path: "assets/shop/explosion pack/tnt.png")
        default:
            let suffix = regularSkin % 4 == 0 ? "" : String(regularSkin % 4 + 1)
            return Self(path: "assets/tile_numbers\(suffix).png")
        }
    }

    /// Exact mobile app-core-wild-skin static recipe. Generic Raw artwork
    /// defaults are not the Source Magnet variant defaults.
    static func sourceWildSkinDefinition(kind:String,variant:String?)->Self? {
        guard let archetype=NativeWildArchetype(rawValue:kind) else{return nil}
        let raw=definition(kind:kind,variant:variant)
        let path:String
        if let variant {
            guard let identity=NativeSpecialDiceRegistry.compatibleVariant(variant,core:archetype) else{return nil}
            path=identity.texture
        } else {path=raw.path}
        let explicit:Set<String>=["fish","kanta","laser-gun","spaceship","barell","cubero"]
        let side:CGFloat=archetype == .magnet ? 128*0.96:128
        let size=variant.map{explicit.contains($0)}==true ? raw.size:CGSize(width:side,height:side)
        // Plain Juice retains the authored bounce frames after Source
        // construction/restore; variant-specific Source owners stay separate.
        return Self(path:path,size:size,anchor:raw.anchor,idleSheet:archetype == .juice && variant == nil ? .juice:nil)
    }
    static let variants: [String: Self] = [
        "fish": Self(path: "assets/shop/fish/fish.png"),
        "kanta": Self(path: "assets/shop/kanta/04.png", size: CGSize(width: 128.0 * 128.0 / 171.0, height: 128)),
        "bee": Self(path: "assets/shop/bee/bee1.png"),
        "laser-gun": Self(path: "assets/shop/gun/right gun.png", size: CGSize(width: 184.32, height: 184.32)),
        "spaceship": Self(path: "assets/shop/spaceship/spaceship.png", size: CGSize(width: 147.456, height: 147.456)),
        "bottle": Self(path: "assets/shop/bottle/glass bottle.png"),
        "honey": Self(path: "assets/shop/honey/honey.png"),
        "flower": Self(path: "assets/shop/bush/flower.png"),
        "barell": Self(path: "assets/shop/barell/barell-static.png", size: CGSize(width: 160.2, height: 207.9),
                       anchor: CGPoint(x: 0.5, y: 1 - 221.0 / 351.0), idleSheet: .barrel),
        "mushroom": Self(path: "assets/shop/mushroom/mushroom.png", idleSheet: .mushroom),
        "robo-cube": Self(path: "assets/shop/robo/robo-cube1.png", idleSheet: .robo),
        "cubero": Self(path: "assets/shop/cubero/cubero.png", size: CGSize(width: 170, height: 128)),
        "beach-ball": Self(path: "assets/shop/ball/ball.png", idleSheet: .ball)
    ]
}

/// Existing immutable WebP atlases retain the exact authored animation frames.
/// SKTexture rects are bottom-left coordinates; source atlases are top-left.
struct NativeDiceSheet {
    let path: String
    let atlas: CGSize
    let cell: CGSize
    let columns: Int
    let frameCount: Int
    let cycle: TimeInterval
    let anchor: CGPoint
    var activeDuration: TimeInterval? = nil
    var activeLoops = 1
    var restingDuration: TimeInterval = 0
    var displayScale: CGFloat = 1
    var offsetY: CGFloat = 0
    var animateDuringDrag = false

    func frame(at elapsed: TimeInterval) -> Int {
        let sequence = cycle * Double(activeLoops) + restingDuration
        let time = max(0, elapsed).truncatingRemainder(dividingBy: sequence)
        if time >= cycle * Double(activeLoops) { return 0 }
        let local = time.truncatingRemainder(dividingBy: cycle)
        let active = activeDuration ?? cycle
        if local >= active { return 0 }
        return min(frameCount - 1, Int(floor(local / active * Double(frameCount))))
    }

    static let star = Self(path: "assets/shop/star/star-pixi-sheet.webp", atlas: CGSize(width: 4077, height: 735),
        cell: CGSize(width: 151, height: 147), columns: 27, frameCount: 120, cycle: 2,
        anchor: CGPoint(x: 75.5 / 151, y: 1 - 86.39 / 147), animateDuringDrag: true)
    static let juice = Self(path: "assets/shop/juice/juice-pixi-sheet.webp", atlas: CGSize(width: 3999, height: 561),
        cell: CGSize(width: 129, height: 187), columns: 31, frameCount: 84, cycle: 2,
        anchor: CGPoint(x: 67.326 / 129, y: 1 - 119.38 / 187), activeDuration: 1.4, animateDuringDrag: true)
    static let mushroom = Self(path: "assets/shop/mushroom/mushroom-pixi-sheet.webp", atlas: CGSize(width: 3990, height: 608),
        cell: CGSize(width: 133, height: 152), columns: 30, frameCount: 120, cycle: 2,
        anchor: CGPoint(x: 69.0 / 133, y: 1 - 86.0 / 152))
    static let robo = Self(path: "assets/shop/robo/robo-pixi-sheet.webp", atlas: CGSize(width: 4077, height: 1032),
        cell: CGSize(width: 151, height: 172), columns: 27, frameCount: 144, cycle: 2.4,
        anchor: CGPoint(x: 79.5 / 151, y: 1 - 104.5 / 172))
    static let ball = Self(path: "assets/shop/ball/ball-pixi-sheet.webp", atlas: CGSize(width: 4048, height: 840),
        cell: CGSize(width: 176, height: 210), columns: 23, frameCount: 84, cycle: 1.4,
        anchor: CGPoint(x: 88.5 / 176, y: 1 - 149.65 / 210), offsetY: -56)
    static let barrel = Self(path: "assets/shop/barell/barell-pixi-sheet.webp", atlas: CGSize(width: 2430, height: 2106),
        cell: CGSize(width: 270, height: 351), columns: 9, frameCount: 54, cycle: 0.821428571,
        anchor: CGPoint(x: 0.5, y: 1 - 221.0 / 351), activeLoops: 2, restingDuration: 1,
        displayScale: 115.2 / 194)
}

@MainActor
final class NativeBoardTextures {
    let sourceWildShimmerGradients=NativeSourceWildShimmerGradientCache()
    private let root: URL
    private var textures: [String: SKTexture] = [:]
    private var logicalSizes: [String: CGSize] = [:]
    private var sourceRasterPixels:[ObjectIdentifier:CGSize]=[:]
    private var sourceRasterLogicalWidths:[ObjectIdentifier:CGFloat]=[:]
    private var sheets: [String: [SKTexture]] = [:]
    private var sourceSheetHandles:[String:SourceTextureHandle]=[:]
    private var waiting: [String: [([SKTexture]) -> Void]] = [:]
    private var pip:SKTexture?
    private var generation = 0
    private let sourceTextureProviderID=UUID()
    private var disposed = false
    @MainActor private final class SelectedFinaleRequest {
        let generation:Int
        var callbacks:[(SKTexture?)->Void]
        init(generation:Int,completion:@escaping(SKTexture?)->Void) {
            self.generation=generation;callbacks=[completion]
        }
    }
    typealias SelectedFinalePreload=@MainActor ([SKTexture],@escaping @Sendable()->Void)->Void
    private var finaleWarmupWaiting:[String:SelectedFinaleRequest]=[:]
    private let selectedFinalePreload:SelectedFinalePreload
    private var phaseScheduler=NativeArtworkPhaseScheduler()
    private let io = DispatchQueue(label: "com.taptapdesign.stacktosix.native-board-art", qos: .userInitiated)

    init(root: URL,selectedFinalePreload:@escaping SelectedFinalePreload={textures,done in
        SKTexture.preload(textures,withCompletionHandler:done)
    }) {self.root=root;self.selectedFinalePreload=selectedFinalePreload}

    func reserveIdlePhase(group:String,cycle:TimeInterval,nowMilliseconds:Double?=nil)->(id:Int,running:Bool) {
        let now=nowMilliseconds ?? (CACurrentMediaTime()*1000).rounded(.down)
        let id=phaseScheduler.reserve(group:group,cycleMilliseconds:cycle*1000,now:now)
        return (id,phaseScheduler.entry(id)?.started==true)
    }
    func advanceIdlePhase(_ id:Int,nowMilliseconds:Double?=nil)->Bool {phaseScheduler.advance(id,now:nowMilliseconds ?? (CACurrentMediaTime()*1000).rounded(.down))}
    func advanceIdlePhases() {phaseScheduler.advancePending(now:(CACurrentMediaTime()*1000).rounded(.down))}
    func releaseIdlePhase(_ id:Int) {phaseScheduler.release(id)}

    /// One shared raster of the original rounded15px pip, not one vector
    /// render surface per pip per die. Source fill/alpha/corner remain exact.
    func pipTexture()->SKTexture {
        if let pip{return pip}
        let format=UIGraphicsImageRendererFormat();format.scale=UIGraphicsImageRendererFormat.preferred().scale;format.opaque=false
        let image=UIGraphicsImageRenderer(size:CGSize(width:15,height:15),format:format).image { _ in
            UIColor(red:129.0/255,green:90.0/255,blue:66.0/255,alpha:0.9).setFill()
            UIBezierPath(roundedRect:CGRect(x:0,y:0,width:15,height:15),cornerRadius:6).fill()
        }
        let texture=SKTexture(image:image);texture.filteringMode = .linear;pip=texture;return texture
    }

    /// True only for retained original texture identities. Admission must not
    /// call texture() to decode a missing resource or infer readiness by count.
    static var sourceInitialFoundationPaths:[String] {
        ["assets/tile.png","assets/shadow.png"]+NativeRegularStackLayout.Skin.allCases.map{String($0.rawValue.dropFirst(2))}
    }
    var sourceRetainedRegularOpenTexturesReady:Bool {
        guard !disposed else{return false}
        return Self.sourceInitialFoundationPaths.allSatisfy{textures[$0] != nil}
    }
    /// Prepare the selected entry's existing texture barrier before its
    /// synchronous constructor. The caller transfers this same resource owner
    /// into the future Scene; preparation draws no gameplay/visual RNG.
    func prepareSourceInitialResources(additionalPaths:[String]=[],current:@escaping()->Bool,
        completion:@escaping(Bool)->Void) {
        guard !disposed,current() else{completion(false);return}
        let captured=generation
        var paths=Self.sourceInitialFoundationPaths
        for path in additionalPaths {
            let normalized=path.hasPrefix("./") ? String(path.dropFirst(2)):path
            if !paths.contains(normalized){paths.append(normalized)}
        }
        var remaining=paths.count,ready=true,settled=false
        for path in paths {
            guard !settled else{break}
            prepareSelectedFinaleAsset(.init([path])) {[weak self] texture in
                guard !settled else{return}
                guard let self,!self.disposed,self.generation==captured,current() else {
                    settled=true;completion(false);return
                }
                ready = ready && texture != nil;remaining-=1
                if remaining==0 {settled=true;completion(ready)}
            }
        }
    }
    /// Source ensureTextureSync branch: retained identities only, with no decode,
    /// upload, density substitution or deferred callback.
    func sourceCachedTexture(candidates:[String])->SKTexture? {
        guard !disposed else{return nil}
        for candidate in candidates {
            let path=candidate.hasPrefix("./") ? String(candidate.dropFirst(2)):candidate
            if let texture=textures[path] {return texture}
        }
        return nil
    }
    /// Sequential Source asset attempts; caller owns the APP Promise/FIFO boundary.
    /// Reuses canonical decode/upload ownership, never loads all candidates at once.
    func prepareSourceStarTexture(candidates:[String],current:@escaping()->Bool,
        assetTasks:NativeSourceMicrotaskAdapters?=nil,reactionScope:NativeSourceMicrotaskFIFO.Scope?=nil,
        completion:@escaping(SKTexture?)->Void) {
        guard (assetTasks == nil) == (reactionScope == nil) else{completion(nil);return}
        if let assetTasks,let reactionScope {guard reactionScope.isBound(to:assetTasks.fifo) else{completion(nil);return}}
        let captured=generation
        func attempt(_ index:Int) {
            guard !disposed,generation==captured,current(),!disposed,generation==captured else{completion(nil);return}
            guard index<candidates.count else{completion(nil);return}
            let candidate=candidates[index]
            if let cached=sourceCachedTexture(candidates:[candidate]) {completion(cached);return}
            prepareSelectedFinaleAsset(.init([candidate])) { [weak self] texture in
                let receive = {
                    guard let self,!self.disposed,self.generation==captured,current(),
                        !self.disposed,self.generation==captured else{completion(nil);return}
                    if let texture {completion(texture)} else {attempt(index+1)}
                }
                if let assetTasks,let reactionScope {
                    assetTasks.assetCompletionTask {_ = reactionScope.enqueue(receive)}
                } else {receive()}
            }
        }
        attempt(0)
    }
    struct SourceTextureHandle {
        let assetPath:String
        let texture:SKTexture
        fileprivate let providerID:UUID
        fileprivate let preparationGeneration:Int
    }
    /// Captures only a retained texture; never decodes or substitutes a path.
    func captureSourceCachedTextureHandle(path:String)->SourceTextureHandle? {
        guard !disposed,let texture=textures[path] else{return nil}
        return .init(assetPath:path,texture:texture,providerID:sourceTextureProviderID,preparationGeneration:generation)
    }
    /// Receipt belongs to this actual cache/provider epoch and uploaded texture.
    /// This epoch is not a claim about SpriteKit renderer-context recovery.
    func isSourceTextureHandleCurrent(_ handle:SourceTextureHandle)->Bool {
        !disposed && handle.providerID==sourceTextureProviderID &&
            handle.preparationGeneration==generation && textures[handle.assetPath] === handle.texture
    }
    private func sourceTextureRequestCurrent(_ captured:Int,current:()->Bool)->Bool {
        guard !disposed,generation==captured else{return false}
        let accepted=current()
        return accepted && !disposed && generation==captured
    }
    /// Source Special asset request borrows existing deduplicated decode/upload
    /// owner, including a real preload receipt for a cached texture. Only the
    /// bound APP asset task/FIFO reaction may publish the resulting handle.
    @discardableResult func prepareSourceSpecialTexture(assetPath:String,
        assetTasks:NativeSourceMicrotaskAdapters,reactionScope:NativeSourceMicrotaskFIFO.Scope,
        current:@escaping()->Bool,completion:@escaping(SourceTextureHandle?)->Void)->Bool {
        let path=assetPath.hasPrefix("./") ? String(assetPath.dropFirst(2)):assetPath
        let captured=generation
        guard !path.isEmpty,reactionScope.isBound(to:assetTasks.fifo),reactionScope.admissionOpen,
              sourceTextureRequestCurrent(captured,current:current),reactionScope.admissionOpen,
              !disposed,generation==captured,reactionScope.isBound(to:assetTasks.fifo) else{return false}
        func acquire(recoveryRemaining:Bool) {
            prepareSelectedFinaleAsset(.init([path])) {[weak self] texture in
                assetTasks.assetCompletionTask {
                    _=reactionScope.enqueue {[weak self] in
                        guard reactionScope.isBound(to:assetTasks.fifo) else{return}
                        guard let self else{completion(nil);return}
                        let accepted=self.sourceTextureRequestCurrent(captured,current:current)
                        guard reactionScope.isBound(to:assetTasks.fifo) else{return}
                        guard accepted else{completion(nil);return}
                        // A nil result with this exact live provider epoch is a
                        // decode failure. Retirement also settles nil, but the
                        // epoch/current checks above prohibit its recovery.
                        // Asset checkpoints may drain inline while the failed
                        // request still owns its waiter list. Borrow the existing
                        // I/O -> MainActor boundary before reacquiring, otherwise
                        // the retry would join that same settled failure cohort.
                        if texture == nil,recoveryRemaining {
                            self.io.async {
                                Task { @MainActor in
                                    assetTasks.assetCompletionTask {
                                        _=reactionScope.enqueue {
                                            guard reactionScope.isBound(to:assetTasks.fifo),
                                                  self.sourceTextureRequestCurrent(captured,current:current),
                                                  reactionScope.isBound(to:assetTasks.fifo) else{return}
                                            acquire(recoveryRemaining:false)
                                        }
                                    }
                                }
                            }
                            return
                        }
                        guard let texture,self.textures[path] === texture else{completion(nil);return}
                        let handle=SourceTextureHandle(assetPath:path,texture:texture,
                            providerID:self.sourceTextureProviderID,preparationGeneration:captured)
                        guard self.isSourceTextureHandleCurrent(handle) else{completion(nil);return}
                        completion(handle)
                    }
                }
            }
        }
        acquire(recoveryRemaining:true)
        return true
    }
    func texture(_ path: String, densityAware: Bool = true) -> SKTexture? {
        guard !disposed else { return nil }
        if let texture = textures[path] { return texture }
        let url = root.appendingPathComponent(path)
        var candidates: [(URL, CGFloat)] = [(url,1)]
        if densityAware {
            let density = min(3, max(1, Int(UIScreen.main.scale.rounded(.up))))
            if density > 1 {
                candidates = stride(from: density, through: 2, by: -1).map { scale in
                    (url.deletingLastPathComponent().appendingPathComponent(url.deletingPathExtension().lastPathComponent + "@\(scale)x." + url.pathExtension),CGFloat(scale))
                } + candidates
            }
        }
        for (candidate, density) in candidates {
            if let image = UIImage(contentsOfFile: candidate.path) {
                let texture = SKTexture(image: image)
                texture.filteringMode = .linear
                textures[path] = texture
                if let cg=image.cgImage {
                    sourceRasterPixels[ObjectIdentifier(texture)]=CGSize(width:cg.width,height:cg.height)
                    sourceRasterLogicalWidths[ObjectIdentifier(texture)]=CGFloat(cg.width)/Self.sourceRasterResolution(path:candidate.path)
                }
                logicalSizes[path] = CGSize(width: image.size.width / density,height: image.size.height / density)
                return texture
            }
        }
        NSLog("[NATIVE_BOARD_ART] Missing image %@", path)
        return nil
    }

    /// Original Pixi getResolutionOfUrl uses this retina suffix for PNG loads.
    static func sourceRasterResolution(path:String)->CGFloat {
        guard let range=path.range(of:#"@([0-9\.]+)x"#,options:.regularExpression) else{return 1}
        let scanner=Scanner(string:String(path[range].dropFirst().dropLast()))
        scanner.locale=Locale(identifier:"en_US_POSIX")
        guard let value=scanner.scanDouble(),value.isFinite,value>0 else{return 1}
        return CGFloat(value)
    }
    func sourceRasterLogicalWidth(for texture:SKTexture)->CGFloat? {
        guard !disposed else{return nil};return sourceRasterLogicalWidths[ObjectIdentifier(texture)]
    }

    /// Retained decode metadata only; never causes another decode/readback.
    func sourceRasterPixelSize(for texture:SKTexture)->CGSize? {
        guard !disposed else{return nil};return sourceRasterPixels[ObjectIdentifier(texture)]
    }

    func logicalSize(_ path: String) -> CGSize? {
        if let size = logicalSizes[path] { return size }
        _ = texture(path)
        return logicalSizes[path]
    }

    /// Source shared-sheet loadFrames: frame cache is shared with Raw. A
    /// retained atlas without frames builds synchronously, then adopts its
    /// guarded Promise before the mount reaction. A later frames hit mounts
    /// first. Cold real upload/coalesced receipts retain caller order.
    @discardableResult func prepareSourceSharedSheet(_ spec:NativeDiceSheet,
        tasks:NativeSourceMicrotaskAdapters,scope:NativeSourceMicrotaskFIFO.Scope,
        current:@escaping()->Bool,completion:@escaping([SKTexture]?)->Void)->Bool {
        guard !disposed,tasks.fifo.isAcceptingJobs,scope.isBound(to:tasks.fifo),scope.admissionOpen,current() else{return false}
        let epoch=generation
        func valid()->Bool {!disposed && generation==epoch && scope.admissionOpen && current()}
        func frames(_ handle:SourceTextureHandle)->[SKTexture]? {
            guard valid(),isSourceTextureHandleCurrent(handle),sourceRasterPixelSize(for:handle.texture)==spec.atlas else{return nil}
            if sourceSheetHandles[spec.path]?.texture === handle.texture,let existing=sheets[spec.path] {
                sourceSheetHandles[spec.path]=handle
                return existing
            }
            let result=(0..<spec.frameCount).map {index -> SKTexture in
                let rect=CGRect(x:CGFloat(index%spec.columns)*spec.cell.width/spec.atlas.width,
                    y:1-CGFloat(index/spec.columns+1)*spec.cell.height/spec.atlas.height,
                    width:spec.cell.width/spec.atlas.width,height:spec.cell.height/spec.atlas.height)
                let texture=SKTexture(rect:rect,in:handle.texture);texture.filteringMode = .linear;return texture
            }
            sheets[spec.path]=result;sourceSheetHandles[spec.path]=handle;return result
        }
        if let handle=sourceSheetHandles[spec.path],isSourceTextureHandleCurrent(handle),let ready=sheets[spec.path] {
            return scope.enqueue{if valid(){completion(ready)}}
        }
        if let cached=sourceCachedTexture(candidates:[spec.path]) {
            let handle=SourceTextureHandle(assetPath:spec.path,texture:cached,providerID:sourceTextureProviderID,preparationGeneration:epoch)
            if sourceSheetHandles[spec.path]?.texture === cached,let ready=frames(handle) {
                return scope.enqueue{if valid(){completion(ready)}}
            }
            let ready=frames(handle)
            return scope.enqueue{if valid(){_ = scope.enqueue{if valid(){completion(ready)}}}}
        }
        return prepareSourceSpecialTexture(assetPath:spec.path,assetTasks:tasks,reactionScope:scope,current:valid) {handle in
            guard valid() else{return};let ready=handle.flatMap{frames($0)}
            _ = scope.enqueue{if valid(){completion(ready)}}
        }
    }

    /// One serial decoder, one source per eligible family. No future variants
    /// are warmed. Disposed/stale completions cannot repopulate the cache.
    func prepare(_ spec: NativeDiceSheet, completion: @escaping ([SKTexture]) -> Void) {
        guard !disposed else { return }
        if let frames = sheets[spec.path] { completion(frames); return }
        if waiting[spec.path] != nil { waiting[spec.path, default: []].append(completion); return }
        waiting[spec.path] = [completion]
        let token = generation
        let url = root.appendingPathComponent(spec.path)
        io.async { [weak self] in
            let image = UIImage(contentsOfFile: url.path)
            DispatchQueue.main.async { [weak self] in
                guard let self, !self.disposed, token == self.generation else { return }
                let callbacks = self.waiting.removeValue(forKey: spec.path) ?? []
                guard let image, let cgImage = image.cgImage,
                      cgImage.width == Int(spec.atlas.width), cgImage.height == Int(spec.atlas.height) else {
                    NSLog("[NATIVE_BOARD_ART] Missing/invalid atlas %@", spec.path)
                    callbacks.forEach { $0([]) }
                    return
                }
                let source = SKTexture(cgImage: cgImage)
                source.filteringMode = .linear
                let frames = (0..<spec.frameCount).map { index -> SKTexture in
                    let x = CGFloat(index % spec.columns) * spec.cell.width / spec.atlas.width
                    let y = 1 - CGFloat(index / spec.columns + 1) * spec.cell.height / spec.atlas.height
                    let frame = SKTexture(rect: CGRect(x: x, y: y, width: spec.cell.width / spec.atlas.width,
                                                      height: spec.cell.height / spec.atlas.height), in: source)
                    frame.filteringMode = .linear
                    return frame
                }
                self.sheets[spec.path] = frames
                callbacks.forEach { $0(frames) }
            }
        }
    }

    /// Selected original Source asset only. BOTH cached and decoded paths remain
    /// captured until actual native upload completion or explicit host retirement.
    func prepareSelectedFinaleAsset(_ spec:NativeMeterWarmupAsset,completion:@escaping(SKTexture?)->Void) {
        guard !disposed else{completion(nil);return}
        if let request=finaleWarmupWaiting[spec.key] {
            request.callbacks.append(completion);return
        }
        let request=SelectedFinaleRequest(generation:generation,completion:completion)
        finaleWarmupWaiting[spec.key]=request
        // Source attempts preferred before a cached fallback. A cached preferred
        // still needs the same captured upload receipt; no unguarded fast path.
        if let path=spec.candidates.first {
            let relative=path.hasPrefix("./") ? String(path.dropFirst(2)):path
            if let texture=textures[relative] {
                selectedFinalePreload([texture]) {Task{@MainActor [weak self] in
                    self?.finishSelectedFinale(key:spec.key,request:request,texture:texture)
                }}
                return
            }
        }
        let root=self.root
        io.async { [weak self] in
            let decoded=NativeSelectedFinaleRaster.decode(root:root,candidates:spec.candidates)
            Task { @MainActor [weak self] in
                guard let self,self.selectedFinaleIsCurrent(key:spec.key,request:request) else{return}
                guard let decoded else {
                    self.finishSelectedFinale(key:spec.key,request:request,texture:nil);return
                }
                let texture=SKTexture(cgImage:decoded.image);texture.filteringMode = .linear
                self.selectedFinalePreload([texture]) {Task{@MainActor [weak self] in
                    guard let self,self.selectedFinaleIsCurrent(key:spec.key,request:request) else{return}
                    self.textures[decoded.path]=texture
                    self.sourceRasterPixels[ObjectIdentifier(texture)]=CGSize(width:decoded.image.width,height:decoded.image.height)
                    self.sourceRasterLogicalWidths[ObjectIdentifier(texture)]=CGFloat(decoded.image.width)/Self.sourceRasterResolution(path:decoded.path)
                    let density:CGFloat=decoded.path.contains("@2x.") ? 2:1
                    self.logicalSizes[decoded.path]=CGSize(width:CGFloat(decoded.image.width)/density,height:CGFloat(decoded.image.height)/density)
                    self.finishSelectedFinale(key:spec.key,request:request,texture:texture)
                }}
            }
        }
    }

    private func selectedFinaleIsCurrent(key:String,request:SelectedFinaleRequest)->Bool {
        !disposed && request.generation==generation && finaleWarmupWaiting[key] === request
    }
    private func finishSelectedFinale(key:String,request:SelectedFinaleRequest,texture:SKTexture?) {
        // Keep remaining consumers registered while invoking EACH callback. A
        // reentrant invalidate/dispose then settles the rest nil exactly once.
        while selectedFinaleIsCurrent(key:key,request:request),!request.callbacks.isEmpty {
            let callback=request.callbacks.removeFirst();callback(texture)
        }
        if selectedFinaleIsCurrent(key:key,request:request) {finaleWarmupWaiting.removeValue(forKey:key)}
    }
    private func cancelSelectedFinaleWaiters() {
        let requests=Array(finaleWarmupWaiting.values);finaleWarmupWaiting.removeAll()
        let callbacks=requests.flatMap{request -> [(SKTexture?)->Void] in
            let callbacks=request.callbacks;request.callbacks.removeAll();return callbacks
        }
        // Removal precedes callbacks: new-generation requests created reentrantly
        // by invalidation listeners cannot be stolen by an obsolete upload.
        callbacks.forEach{$0(nil)}
    }

    func purgeUnused(retaining paths: Set<String>) {
        guard waiting.isEmpty,finaleWarmupWaiting.isEmpty else { return }
        textures = textures.filter { paths.contains($0.key) }
        logicalSizes = logicalSizes.filter { paths.contains($0.key) }
        sheets = sheets.filter { paths.contains($0.key) };sourceSheetHandles=sourceSheetHandles.filter{paths.contains($0.key)}
    }

    func invalidatePendingPreparation() {
        guard !disposed else { return }
        generation += 1; waiting.removeAll()
        cancelSelectedFinaleWaiters()
    }

    func dispose() {
        guard !disposed else { return }
        disposed = true
        sourceWildShimmerGradients.dispose()
        pip=nil
        generation += 1
        waiting.removeAll(); sheets.removeAll();sourceSheetHandles.removeAll(); textures.removeAll(); logicalSizes.removeAll();sourceRasterPixels.removeAll();sourceRasterLogicalWidths.removeAll()
        pip=nil;cancelSelectedFinaleWaiters()
        phaseScheduler.dispose()
    }
}
