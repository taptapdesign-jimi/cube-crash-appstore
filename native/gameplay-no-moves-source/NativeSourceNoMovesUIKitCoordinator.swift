import UIKit
import StackToSixGameplay

/// Owns the mounted original UIKit graph, not failure classification or a clock.
/// Both finite app-timeout registrations are delegated to the captured Scene.
@MainActor final class NativeSourceNoMovesUIKitCoordinator {
    static let paths = [
        "assets/board transition/oblak+srednji.png",
        "assets/board transition/oblak mali desno.png",
        "assets/board transition/oblak mali ljevo.png",
        "assets/board transition/oblak veliki ljevo dole.png"
    ]
    private weak var host: UIView?
    private let root: URL
    private let service: NativeSourceAnimationClockService
    private let current: (UInt64) -> Bool
    private let random: () -> Double
    private let onVisibleShow: (UInt64,UInt64) -> Void
    private let fallback: (UInt64, @escaping () -> Void) -> (() -> Void)
    private var images: [UIImage] = []
    private var font: UIFont?
    private var preparing = false
    private var preparationEpoch: UInt64 = 0
    private var waiters: [(Bool) -> Void] = []
    private(set) var presentation: NativeNoMovesSourcePresentation?
    private(set) var disposed = false
    private(set) var preparationCount = 0
    var preparedOriginalCloudImages:[UIImage]?{!disposed && images.count==4 ? images:nil}
    private var exitReply: ((Bool) -> Void)?
    private var presentationEpoch:UInt64=0
    private var suspended=false
    init(host: UIView, root: URL, service: NativeSourceAnimationClockService,
         current: @escaping (UInt64) -> Bool, random: @escaping () -> Double,
         fallback: @escaping (UInt64, @escaping () -> Void) -> (() -> Void),
         onVisibleShow: @escaping (UInt64,UInt64) -> Void) {
        self.host=host; self.root=root; self.service=service
        self.current=current; self.random=random; self.fallback=fallback;self.onVisibleShow=onVisibleShow
    }
    /// Four immutable original PNGs only. Cold decode is coalesced; late replies
    /// cannot repopulate a disposed host or enable a replaced Scene.
    func prepare(_ completion: @escaping (Bool) -> Void) {
        guard !disposed else {completion(false);return}
        if images.count == 4, font != nil {completion(true);return}
        waiters.append(completion);guard !preparing else{return}
        preparing=true; preparationEpoch += 1; preparationCount += 1
        let epoch=preparationEpoch, root=self.root, paths=Self.paths
        Task { @MainActor [weak self] in
            let bytes = await Task.detached(priority: .userInitiated) {
                paths.map {try? Data(contentsOf:root.appendingPathComponent($0))}
            }.value
            guard let self,!self.disposed,self.preparationEpoch==epoch else{return}
            let loaded=bytes.compactMap {bytes in bytes.flatMap {UIImage(data:$0)}?.preparingForDisplay()}
            let candidate=JimiV9Artwork(resourceRoot:root).font(size:48,weight:"ExtraBold")
            let ready=loaded.count==4 && candidate.fontName=="Baloo2-ExtraBold"
            self.preparing=false
            if ready {self.images=loaded;self.font=candidate}
            let replies=self.waiters;self.waiters=[]
            for reply in replies {
                reply(ready && !self.disposed && self.preparationEpoch==epoch)
            }
        }
    }
    /// Called at the real Source showNoMovesText point. Missing original art
    /// is an unavailable show (Source catches), never a fabricated light cloud.
    @discardableResult func show(generation:UInt64,receipt:UInt64) -> Bool {
        let entryEpoch=presentationEpoch
        guard !disposed,current(generation),!disposed,presentationEpoch==entryEpoch,
            let host,let font,images.count==4 else{return false}
        let expected=presentationEpoch &+ 1
        clear()
        guard !disposed,presentationEpoch==expected,current(generation),!disposed,
            presentationEpoch==expected else{return false}
        do {
            let node=try NativeNoMovesSourcePresentation(font:font,images:images,viewport:host.bounds.size,
                generation:generation,service:service,current:{[weak self] gen in
                    guard let self,!self.disposed else{return false}
                    guard self.presentationEpoch==expected else{return false}
                    let valid=self.current(gen);return !self.disposed && self.presentationEpoch==expected && valid
                },random:random,scheduleExitFallback:{[weak self] callback in
                    guard let self,!self.disposed else{return {}}
                    return self.fallback(generation,callback)
                },mountTextAndDispatchCue:{[weak self] node in
                    guard let self,!self.disposed,self.presentationEpoch==expected else{return}
                    self.presentation=node
                    node.onExitFinished={ [weak self,weak node] success in
                        guard let self,let node,self.presentation === node else{return}
                        self.presentation=nil
                        let reply=self.exitReply;self.exitReply=nil
                        let valid=self.current(generation)
                        if !self.disposed && self.presentationEpoch==expected && valid {reply?(success)}
                    }
                    host.addSubview(node)
                    // Original overlay + glyphs now mounted. No cloud RNG yet.
                    self.onVisibleShow(generation,receipt)
                })
            guard !disposed,presentationEpoch==expected,presentation === node,
                current(generation),!disposed,presentationEpoch==expected,presentation === node else {
                node.dispose();return false
            }
            node.setSuspended(suspended)
            return true
        } catch {return false}
    }
    func setSuspended(_ value:Bool){suspended=value;presentation?.setSuspended(value)}
    func beginExit(generation:UInt64,completion:@escaping(Bool)->Void) {
        let expected=presentationEpoch
        guard !disposed,current(generation),!disposed,presentationEpoch==expected,
            let node=presentation,node.generation==generation else {
            completion(false);return
        }
        guard exitReply==nil else{return}
        exitReply=completion;node.beginExit()
    }
    func clear() {
        presentationEpoch &+= 1
        let node=presentation;presentation=nil
        let reply=exitReply;exitReply=nil
        node?.onExitFinished=nil;node?.dispose()
        reply?(false)
    }
    func dispose() {
        guard !disposed else{return};disposed=true;preparationEpoch += 1
        let replies=waiters;waiters=[];preparing=false
        // Retirement must not synthesize a current text-exit callback.
        exitReply=nil;clear();images=[];font=nil;host=nil
        replies.forEach{$0(false)}
    }
}
