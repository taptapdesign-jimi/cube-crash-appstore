import UIKit

/// Original Journey footer: fixed paper < footer z2 < transparent canvas z10.
/// Prepare one selected image under coverage; only explicit HUD admission owns
/// its finite visible clock. Bootstrap owns the app-lived Forest choice map.
@MainActor
final class NativeJourneyBottomDecorOwner:UIView {
    enum Phase {case unprepared,prepared,entering,visible,exiting,hidden,disposed}
    let board:Int,generation:UInt64,asset:NativeJourneyBottomDecorAsset
    let selectedPath:String
    private(set) var phase:Phase = .unprepared
    private(set) var pose=NativeJourneyBottomDecorPlan.prepared
    var isForeground:Bool {foreground}
    var isPrepared:Bool {imageView.image != nil && phase != .disposed}
    var hasActiveClock:Bool {clock != nil}
    var decodedBytes:Int {resources.decodedBytes}
    private let resources:NativeJourneyBottomDecorResourcePreparing,current:(UInt64)->Bool
    private let imageView=UIImageView(),clockTarget=NativeJourneyBottomDecorClockTarget()
    private var clock:CADisplayLink?,lastTime:Double?,elapsed=0.0,epoch:UInt64=0
    private var waiters:[(Bool)->Void]=[],pendingPrepare=false,queuedEnter=false,foreground:Bool,suspended=false
    private var observations:[NSObjectProtocol]=[],exitStart=NativeJourneyBottomDecorPlan.visible
    private var exitCompletion:((Bool)->Void)?,shakeOffset=CGPoint.zero
    init(root:URL,board:Int,viewport:CGSize,generation:UInt64,isCurrent:@escaping(UInt64)->Bool,catalog:NativeJourneyBottomDecorCatalog?=nil,resources:NativeJourneyBottomDecorResourcePreparing?=nil,density:Double?=nil,isApplicationActive:(@MainActor()->Bool)?=nil,random:()->Double={Double.random(in:0..<1)}) {
        self.board=board;self.generation=generation;current=isCurrent;foreground=isApplicationActive?() ?? (UIApplication.shared.applicationState == .active)
        self.resources=resources ?? NativeJourneyBottomDecorResources(root:root)
        asset=(catalog ?? .shared).asset(board:board,random:random);selectedPath=asset.path(density:density ?? Double(UIScreen.main.scale))
        super.init(frame:CGRect(origin:.zero,size:viewport))
        backgroundColor = .clear;isOpaque=false;isUserInteractionEnabled=false
        accessibilityIdentifier="native-journey-bottom-decor"
        imageView.contentMode = .scaleToFill;imageView.isUserInteractionEnabled=false
        imageView.layer.anchorPoint=CGPoint(x:0.5,y:1);addSubview(imageView);clockTarget.owner=self
        primeHiddenPose()
        observations=[
            NotificationCenter.default.addObserver(forName:UIApplication.willResignActiveNotification,object:nil,queue:.main){[weak self] _ in MainActor.assumeIsolated{self?.setForeground(false)}},
            NotificationCenter.default.addObserver(forName:UIApplication.didBecomeActiveNotification,object:nil,queue:.main){[weak self] _ in MainActor.assumeIsolated{self?.setForeground(true)}}
        ]
    }
    required init?(coder:NSCoder){fatalError("Use original Journey artwork")}
    func prepare(completion:@escaping(Bool)->Void) {
        guard phase != .disposed,current(generation),foreground else{completion(false);return}
        if isPrepared {completion(true);return}
        waiters.append(completion);guard !pendingPrepare else{return}
        pendingPrepare=true;epoch &+= 1;let token=epoch
        resources.prepare(path:selectedPath){[weak self] image in
            guard let self,self.epoch==token,self.phase != .disposed else{return}
            guard self.foreground,self.current(self.generation) else{self.dispose();return}
            self.pendingPrepare=false
            if let image {
                self.imageView.image=image;self.phase = .prepared;self.primeHiddenPose();self.setNeedsLayout();self.layoutIfNeeded()
            }
            let callbacks=self.waiters;self.waiters.removeAll();callbacks.forEach{$0(image != nil)}
            if image != nil,self.queuedEnter {self.enter()}
        }
    }
    func primeHiddenPose() {
        guard phase == .unprepared || phase == .prepared || phase == .hidden else{return}
        stopClock();elapsed=0;shakeOffset = .zero;pose=NativeJourneyBottomDecorPlan.prepared
        imageView.isHidden=false;applyPose()
    }
    func enter() {
        guard phase != .disposed,current(generation) else{return}
        if phase == .visible || phase == .entering {return}
        queuedEnter=true
        guard isPrepared,foreground,!suspended else {
            if foreground,!pendingPrepare {prepare(completion:{_ in})}
            return
        }
        queuedEnter=false;phase = .entering;elapsed=0;shakeOffset = .zero;pose=NativeJourneyBottomDecorPlan.prepared
        imageView.isHidden=false;applyPose();startClockIfAllowed()
    }
    func exit(completion:@escaping(Bool)->Void) {
        guard phase != .disposed,current(generation) else{completion(false);return}
        guard phase != .exiting else{completion(false);return}
        queuedEnter=false
        if imageView.isHidden || !isPrepared {
            epoch &+= 1;resources.cancelPendingPreparation();pendingPrepare=false
            let callbacks=waiters;waiters.removeAll();callbacks.forEach{$0(false)}
            phase = .hidden;imageView.isHidden=true;completion(true);return
        }
        stopClock();exitCompletion=completion
        exitStart = .init(x:pose.x+Double(shakeOffset.x),y:pose.y+Double(shakeOffset.y),scaleX:pose.scaleX,scaleY:pose.scaleY,opacity:pose.opacity)
        shakeOffset = .zero;phase = .exiting;elapsed=0;startClockIfAllowed()
    }
    func captureShakePose()->CGPoint {shakeOffset}
    func applyShake(sourceOffset:CGPoint,generation:UInt64) {
        guard generation==self.generation,current(generation),phase != .disposed,foreground,!suspended else{return}
        shakeOffset=sourceOffset;applyPose()
    }
    func setSuspended(_ value:Bool) {suspended=value;if value {stopClock()}else{resumeAdmission()}}
    func setForeground(_ value:Bool) {
        guard phase != .disposed else{return};foreground=value
        if !value {
            stopClock();epoch &+= 1;resources.cancelPendingPreparation();pendingPrepare=false
            let callbacks=waiters;waiters.removeAll();callbacks.forEach{$0(false)}
        } else {resumeAdmission()}
    }
    private func resumeAdmission() {
        guard foreground,!suspended,current(generation) else{return}
        if queuedEnter,phase != .entering {enter()}else{startClockIfAllowed()}
    }
    override func didMoveToWindow() {super.didMoveToWindow();if window==nil {stopClock()}else{resumeAdmission()}}
    override func layoutSubviews() {
        super.layoutSubviews()
        if let image=imageView.image,image.size.width>0 {
            let height=bounds.width*image.size.height/image.size.width
            imageView.bounds=CGRect(x:0,y:0,width:bounds.width,height:height)
            imageView.layer.position=CGPoint(x:bounds.width/2,y:bounds.height+1)
        }
        applyPose()
    }
    private func applyPose() {
        imageView.alpha=pose.opacity
        imageView.transform=CGAffineTransform(translationX:pose.x+Double(shakeOffset.x),y:pose.y+Double(shakeOffset.y)).scaledBy(x:pose.scaleX,y:pose.scaleY)
    }
    private func startClockIfAllowed() {
        guard clock==nil,foreground,!suspended,window != nil,current(generation),phase == .entering || phase == .exiting else{return}
        lastTime=nil;let link=CADisplayLink(target:clockTarget,selector:#selector(NativeJourneyBottomDecorClockTarget.tick(_:)))
        link.preferredFrameRateRange=CAFrameRateRange(minimum:30,maximum:60,preferred:60);link.add(to:.main,forMode:.common);clock=link
    }
    private func stopClock(){clock?.invalidate();clock=nil;lastTime=nil}
    fileprivate func tick(_ timestamp:Double) {
        guard foreground,!suspended,window != nil,current(generation),phase != .disposed else{stopClock();return}
        elapsed += lastTime.map{max(0,timestamp-$0)} ?? 0;lastTime=timestamp;paint(seconds:elapsed,generation:generation)
    }
    /// Shared deterministic carrier receipt, also used by actual owner tests.
    func paint(seconds:Double,generation:UInt64) {
        guard generation==self.generation,phase != .disposed else{return}
        guard current(generation) else{dispose();return}
        guard foreground,!suspended else{return}
        elapsed=max(0,seconds)
        CATransaction.begin();CATransaction.setDisableActions(true)
        if phase == .entering {
            pose=NativeJourneyBottomDecorPlan.enter(seconds:elapsed);applyPose()
            if elapsed>=NativeJourneyBottomDecorPlan.enterDuration {phase = .visible;pose=NativeJourneyBottomDecorPlan.visible;applyPose();stopClock()}
        } else if phase == .exiting {
            pose=NativeJourneyBottomDecorPlan.exit(seconds:elapsed,from:exitStart);applyPose()
            if elapsed>=NativeJourneyBottomDecorPlan.exitDuration {
                phase = .hidden;imageView.isHidden=true;stopClock();shakeOffset = .zero
                pose = .init(x:0,y:0,scaleX:1,scaleY:1,opacity:0);applyPose()
                let completion=exitCompletion;exitCompletion=nil;completion?(true)
            }
        }
        CATransaction.commit()
    }
    func dispose() {
        guard phase != .disposed else{return};phase = .disposed;epoch &+= 1;stopClock();queuedEnter=false
        let callbacks=waiters;waiters.removeAll();callbacks.forEach{$0(false)};pendingPrepare=false
        let completion=exitCompletion;exitCompletion=nil;completion?(false)
        resources.release();imageView.image=nil;observations.forEach(NotificationCenter.default.removeObserver);observations.removeAll()
        clockTarget.owner=nil;removeFromSuperview()
    }
}
@MainActor
private final class NativeJourneyBottomDecorClockTarget:NSObject {
    weak var owner:NativeJourneyBottomDecorOwner?
    @objc func tick(_ clock:CADisplayLink){owner?.tick(clock.timestamp)}
}
