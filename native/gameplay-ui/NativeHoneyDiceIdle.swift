import SpriteKit

/// Three live source sprites reuse the board ticker and its resource lease.
@MainActor
final class NativeHoneyDiceIdle:SKNode {
    private let behind=SKNode(),front=SKNode()
    private var sprites:[SKSpriteNode]=[],images:[SKTexture]=[]
    private var runtime:NativeHoneyIdleMotion.Runtime
    private let random:()->Double
    private(set) var assetReady=false
    var collectionPresentation=false
    private var elapsed=0.0,disposed=false
    var hasActiveMotion:Bool {!disposed && assetReady && elapsed<3600}
    init(textures:NativeBoardTextures,random:@escaping ()->Double={Double.random(in:0..<1)}) {
        self.random=random;runtime=NativeHoneyIdleMotion.Runtime(profiles:NativeHoneyIdleMotion.make(random:random))
        super.init();name="native-honey-idle-orbit"
        behind.zPosition = -2;front.zPosition=12;addChild(behind);addChild(front)
        images=(1...7).compactMap {textures.texture("assets/shop/honey/bee\($0).png")}
        assetReady=images.count==7
        guard assetReady else {images.removeAll();return}
        for index in 0..<3 {
            let sprite=SKSpriteNode(texture:images[index]);sprite.name="honey-idle-bee-\(index+1)"
            let size=CGFloat(128*0.435456*runtime.profiles[index].sizeScale);sprite.size=CGSize(width:size,height:size)
            front.addChild(sprite);sprites.append(sprite)
        }
        _=runtime.paint(seconds:0,force:true,random:random)
        // Original cached-resource recovery commits once on its initial clock.
        _=runtime.paint(seconds:0,force:true,random:random);apply()
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    func tick(_ delta:Double) {guard hasActiveMotion else {return};elapsed=min(3600,elapsed+max(0,delta));if runtime.paint(seconds:elapsed,idleFPS:collectionPresentation ? 0:30,random:random) {apply()}}
    func setDragging(_ value:Bool) {guard !disposed else {return};runtime.setDragging(value)}
    func updateDrag(offset:CGPoint,velocity:CGPoint) {
        guard !disposed,assetReady else {return}
        runtime.updateDrag(offsetX:Double(offset.x),offsetY:Double(offset.y),velocityX:Double(velocity.x),velocityY:Double(velocity.y));apply()
    }
    private func apply() {
        guard !disposed,assetReady else {return}
        for index in sprites.indices {
            let pose=runtime.bees[index].pose,sprite=sprites[index],layer=pose.front ? front:behind
            if sprite.parent !== layer {sprite.removeFromParent();layer.addChild(sprite)}
            sprite.texture=images[pose.asset-1]
            sprite.position=CGPoint(x:pose.x,y:-pose.y);sprite.alpha=pose.alpha;sprite.setScale(pose.scale)
            if collectionPresentation {
                // Thirty discrete wing beats per second, while orbit positions
                // continue at display cadence. Seven assets encode headings.
                let frame=floor(elapsed*30)
                sprite.yScale *= frame.truncatingRemainder(dividingBy:2)==0 ? 0.94:1.04
            }
        }
    }
    func dispose() {guard !disposed else {return};disposed=true;sprites.removeAll();images.removeAll();removeAllChildren();removeFromParent()}
}

/// Source renderer keeps exactly three captured carriers while the seven-slot
/// resource cohort resolves. A missing slot retains the previous usable image.
@MainActor final class NativeSourceHoneyIdlePresentation:SKNode {
    private let behind=SKNode(),front=SKNode()
    private let current:()->Bool
    private let service:NativeSourceAnimationClockService
    private var resourcePaths:[String]?
    private var resourceScope:NativeSourceMicrotaskFIFO.Scope?
    private var images:[SKTexture?],assets=[Int](repeating:0,count:3)
    private var clock:NativeSourceHoneyIdleClock?
    private(set) var sprites:[SKSpriteNode]=[]
    private(set) var disposed=false
    private var started=false
    private(set) var cohortCommitted=false
    var sizeScales:[Double]{clock?.sizeScales ?? []}
    var isCurrent:Bool{valid() && clock?.disposed==false}
    init?(cachedTextures:[SKTexture?],service:NativeSourceAnimationClockService,
        random:@escaping()->Double,current:@escaping()->Bool,paintable:@escaping()->Bool){
        guard cachedTextures.count==7,current() else{return nil}
        self.images=cachedTextures;self.current=current;self.service=service
        super.init();name="source-honey-idle-orbit"
        behind.zPosition = -2;front.zPosition=12;addChild(behind);addChild(front)
        guard let owner=NativeSourceHoneyIdleClock(service:service,random:random,
            current:{[weak self] in self?.valid() == true},paintable:paintable,
            paint:{[weak self] poses in self?.apply(poses)}) else{return nil}
        clock=owner
        for index in 0..<3 {
            let sprite=SKSpriteNode(texture:images[index],color:.clear,size:.zero)
            sprite.name="honey-idle-bee-\(index+1)"
            let size=CGFloat(128*0.435456*owner.sizeScales[index])
            sprite.size = .init(width:size,height:size);sprite.alpha=0;sprite.setScale(0)
            sprites.append(sprite);front.addChild(sprite)
        }
    }
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    convenience init?(textures:NativeBoardTextures,use2x:Bool,service:NativeSourceAnimationClockService,
        random:@escaping()->Double,current:@escaping()->Bool,paintable:@escaping()->Bool){
        guard current() else{return nil}
        let paths=(1...7).map{"assets/shop/honey/bee\($0)\(use2x ? "@2x":"").png"}
        let cached=paths.map{textures.sourceCachedTexture(candidates:[$0])}
        self.init(cachedTextures:cached,service:service,random:random,current:current,paintable:paintable)
        resourcePaths=paths
    }
    private func valid()->Bool {
        guard !disposed else{return false};let accepted=current();return accepted && !disposed
    }
    @discardableResult func start()->Bool {
        guard !started else{return false};started=true
        guard valid(),let clock,clock.start(),valid() else{dispose();return false};return true
    }
    /// Must be called inside the real APP task. Cached async results queue
    /// Promise-all element reactions; decoding borrows its actual asset task.
    @discardableResult func start(textures:NativeBoardTextures,assetTasks:NativeSourceMicrotaskAdapters)->Bool {
        guard !started,valid(),let paths=resourcePaths,paths.count==7,
            service.sourceMicrotaskTasks === assetTasks,assetTasks.fifo.isAcceptingJobs else{return false}
        guard let scope=assetTasks.fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,
            isCurrent:{[weak self] in self?.valid() == true}) else{return false}
        resourceScope=scope;started=true
        guard let clock,clock.start(beforeRootRegistration:{[weak self] in
            guard let self,self.valid(),scope.admissionOpen else{return false}
            var settled=Array(repeating:false,count:7),results=[SKTexture?](repeating:nil,count:7)
            @MainActor func settle(_ index:Int,_ image:SKTexture?){
                guard self.valid(),scope.admissionOpen,!settled[index] else{return}
                settled[index]=true;results[index]=image
                guard settled.allSatisfy({$0}) else{return}
                _=scope.enqueue{[weak self] in
                    guard let self,self.valid() else{return}
                    // Do not publish retired provider identities as a new result.
                    let live=results.enumerated().map{index,image -> SKTexture? in
                        guard let image,textures.sourceCachedTexture(candidates:[paths[index]]) === image else{return nil}
                        return image
                    }
                    _=self.commitAssetCohort(live)
                    if self.resourceScope === scope {self.resourceScope=nil};scope.dispose()
                }
            }
            for index in paths.indices {
                guard self.valid(),scope.admissionOpen else{return false}
                if let cached=textures.sourceCachedTexture(candidates:[paths[index]]) {
                    guard scope.enqueue({settle(index,cached)}) else{return false}
                } else {
                    let accepted=textures.prepareSourceSpecialTexture(assetPath:paths[index],assetTasks:assetTasks,
                        reactionScope:scope,current:{[weak self] in self?.valid() == true}){handle in
                            _=scope.enqueue{settle(index,handle.flatMap{textures.isSourceTextureHandleCurrent($0) ? $0.texture:nil})}
                        }
                    if !accepted {guard scope.enqueue({settle(index,nil)}) else{return false}}
                }
            }
            return self.valid()
        }),valid() else{dispose();return false}
        return true
    }
    private func apply(_ poses:[NativeHoneyIdleMotion.Pose]){
        guard valid(),poses.count==sprites.count else{return}
        for index in sprites.indices {
            let pose=poses[index],sprite=sprites[index],layer=pose.front ? front:behind
            if assets[index] != pose.asset {
                if let image=images[pose.asset-1] {applyImage(image,index:index)}
                assets[index]=pose.asset
            }
            if sprite.parent !== layer {sprite.removeFromParent();layer.addChild(sprite)}
            sprite.position = .init(x:pose.x,y:-pose.y);sprite.alpha=pose.alpha;sprite.setScale(pose.scale)
        }
    }
    private func applyImage(_ image:SKTexture,index:Int){
        guard let clock else{return}
        let sprite=sprites[index],size=CGFloat(128*0.435456*clock.sizeScales[index])
        sprite.texture=image;sprite.setScale(1);sprite.size = .init(width:size,height:size)
    }
    /// Caller publishes one settled seven-result cohort from its APP reaction.
    /// Nil decode results keep the original slot, never replace usable artwork.
    @discardableResult func commitAssetCohort(_ results:[SKTexture?])->Bool {
        guard valid(),started,!cohortCommitted,results.count==7,let clock,!clock.disposed else{return false}
        cohortCommitted=true
        for index in images.indices {if let image=results[index] {images[index]=image}}
        for index in sprites.indices {
            let selected=assets[index]>0 ? assets[index]-1:index
            if let image=images[selected] {applyImage(image,index:index)}
            // SpriteKit logical dimensions stay authored across texture swaps;
            // placeholder/decoded natural pixels never multiply painted size.
        }
        clock.assetCohortDidCommit();return valid()
    }
    func setDragging(_ value:Bool){clock?.setDragging(value)}
    func updateDrag(offset:CGPoint,velocity:CGPoint){clock?.updateDragMotion(offset:offset,velocity:velocity)}
    func setVisible(_ value:Bool){clock?.setVisible(value)}
    func dispose(){
        guard !disposed else{return};disposed=true
        let scope=resourceScope;resourceScope=nil;scope?.dispose()
        let old=clock;clock=nil;old?.dispose()
        sprites.removeAll();images.removeAll();behind.removeAllChildren();front.removeAllChildren()
        behind.removeFromParent();front.removeFromParent();removeFromParent()
    }
    isolated deinit{dispose()}
}
