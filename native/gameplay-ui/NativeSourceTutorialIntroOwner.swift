import Foundation

/// Shared Native tutorial sheet entrance: one overshoot and a soft return.
/// The paper surface must extend below the viewport by at least 25% of its height.
enum NativeTutorialSheetMotion {
    static let duration=0.78
    static func progress(_ seconds:Double)->Double {
        let t=max(0,min(1,seconds/duration))
        func smooth(_ value:Double)->Double {let p=max(0,min(1,value));return p*p*p*(p*(p*6-15)+10)}
        // Spend two thirds on readable travel, then a small, soft rebound.
        if t<0.66{return 1-1.045*smooth(t/0.66)}
        if t<0.86{return -0.045+0.053*smooth((t-0.66)/0.20)}
        return 0.008*(1-smooth((t-0.86)/0.14))
    }
}

/// Original renderOverlay intro only. The two wall timers are independent of
/// each other and of paused GSAP. Sheet/image roots borrow the APP transport;
/// the later pointer hint, HUD and step monitor remain separate owners.
@MainActor final class NativeSourceTutorialIntroOwner {
    struct PointerPose:Equatable {let alpha:Double,scale:Double,rotation:Double}
    @MainActor private final class Paint:NativeSourceAnimationParticipant {
        let update:(Double)->Void
        init(_ update:@escaping(Double)->Void){self.update=update}
        func advanceSourceAnimation(seconds:Double){update(seconds)}
    }
    private let service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner
    private let immediateSheet:Bool,nativeSheetMotion:Bool
    private let deferInitialPointer:Bool
    private let generation:UInt64,current:()->Bool,sheet:(Double)->Void,pointer:(PointerPose)->Void,reveal:()->Void,focus:()->Void
    private var timers:[NativeSourceAppTimeoutOwner.Receipt]=[]
    private var sheetPaint:Paint?,pointerPaint:Paint?,hintPaint:Paint?
    private var hintLease:NativeSourceAnimationClockService.Lease?,hintEpoch:UInt64=0
    private var sheetLease:NativeSourceAnimationClockService.Lease?,pointerLease:NativeSourceAnimationClockService.Lease?
    private var frame:NativeSourceAnimationClockService.SourceFrameLease?
    private var started=false,disposed=false,pointerEpoch:UInt64=0,sheetEpoch:UInt64=0
    private var paintedPointer=PointerPose(alpha:0,scale:0,rotation:-8),paintedSheet=1.0
    private let conceal:()->Void,dim:(Double)->Void
    private var dimPaint:Paint?,dimLease:NativeSourceAnimationClockService.Lease?,dimEpoch:UInt64=0,paintedDim=1.0
    private(set) var sheetStarted=false,pointerStarted=false
    var pendingTimerCount:Int{timers.count}
    init?(service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,generation:UInt64,
          immediateSheet:Bool=false,nativeSheetMotion:Bool=false,deferInitialPointer:Bool=false,current:@escaping()->Bool,sheet:@escaping(Double)->Void,pointer:@escaping(PointerPose)->Void,
          reveal:@escaping()->Void,focus:@escaping()->Void,conceal:@escaping()->Void={},dim:@escaping(Double)->Void={_ in}) {
        guard generation>0,service.sourceMicrotaskRAFBoundaryInstalled,
              let tasks=service.sourceMicrotaskTasks,timeouts.sourceMicrotaskTasks === tasks,current() else{return nil}
        self.immediateSheet=immediateSheet;self.nativeSheetMotion=nativeSheetMotion
        self.deferInitialPointer=deferInitialPointer
        self.service=service;self.timeouts=timeouts;self.generation=generation
        self.current=current;self.sheet=sheet;self.pointer=pointer;self.reveal=reveal;self.focus=focus;self.conceal=conceal;self.dim=dim
    }
    private func admitted()->Bool {guard !disposed else{return false};let valid=current();return valid && !disposed}
    @discardableResult func start()->Bool {
        guard !started,admitted() else{return false};started=true
        paintSheet(1);guard admitted() else{return false}
        paintPointer(.init(alpha:0,scale:0,rotation:-8));guard admitted() else{return false}
        // Source pushes pointer1200 before sheet800. Keep insertion order too.
        if immediateSheet {
            // Preserve the pointer's 400ms offset from the sheet entry.
            if !deferInitialPointer{schedule("tutorial-pointer400",400){[weak self] in self?.startPointer(scheduleFocus:true)}}
            startSheet()
        } else {
            schedule("tutorial-pointer1200",1200){[weak self] in self?.startPointer(scheduleFocus:true)}
            schedule("tutorial-sheet800",800){[weak self] in self?.startSheet()}
        }
        return admitted()
    }
    private func schedule(_ name:String,_ delay:Int,_ callback:@escaping()->Void) {
        guard admitted() else{return}
        var receipt:NativeSourceAppTimeoutOwner.Receipt?
        receipt=timeouts.schedule(sourceID:name,generation:generation,delayMilliseconds:delay,elapsed:{[weak self] in
            guard let self else{return};if let receipt{self.timers.removeAll{$0==receipt}}
            guard self.admitted() else{self.dispose();return};callback()
        })
        if let receipt {if admitted(){timers.append(receipt)}else{_=timeouts.cancel(receipt)}}
    }
    private func startSheet() {
        guard admitted(),!sheetStarted else{return};sheetStarted=true
        cancelSheet();let epoch=sheetEpoch
        let paint=Paint{[weak self] seconds in guard let self else{return};guard self.admitted() else{self.dispose();return};guard self.sheetEpoch==epoch else{return};self.paintSheet(self.entranceProgress(seconds))}
        sheetPaint=paint
        sheetLease=service.register(participant:paint,duration:entranceDuration,domain:.sourceGSAP(.defaultLazyTween),cleanup:{[weak self] _ in guard let self,self.sheetEpoch==epoch else{return};self.sheetLease=nil;self.sheetPaint=nil})
        if sheetLease==nil{dispose()}
    }
    private func startPointer(scheduleFocus:Bool) {
        guard admitted() else{return};cancelPointer();pointerStarted=true
        let epoch=pointerEpoch
        reveal();guard admitted(),pointerEpoch==epoch else{return}
        paintPointer(Self.pointerPose(0));guard admitted(),pointerEpoch==epoch else{return}
        let paint=Paint{[weak self] seconds in guard let self else{return};guard self.admitted() else{self.dispose();return};guard self.pointerEpoch==epoch else{return};self.paintPointer(Self.pointerPose(seconds))}
        pointerPaint=paint
        pointerLease=service.register(participant:paint,duration:0.49,domain:.sourceGSAP(.timeline),cleanup:{[weak self] _ in
            guard let self,self.pointerEpoch==epoch else{return};self.pointerLease=nil;self.pointerPaint=nil
        })
        guard pointerLease != nil,admitted(),pointerEpoch==epoch else{dispose();return}
        if scheduleFocus {
            frame=service.requestSourceAnimationFrame(ownerID:"tutorial-intro-focus:\(generation)",generation:generation,callback:{[weak self] in
                guard let self else{return};self.frame=nil;guard self.admitted() else{return};self.focus()
            },onCancelled:{[weak self] in self?.frame=nil})
            if frame==nil{dispose()}
        }
    }
    @discardableResult func startGuidedHint(paint:@escaping(Double)->Void)->Bool {
        guard admitted() else{return false};cancelHint();let epoch=hintEpoch
        let participant=Paint{[weak self] seconds in guard let self else{return};guard self.admitted() else{self.dispose();return};guard self.hintEpoch==epoch else{return};paint(Self.hintProgress(seconds))}
        hintPaint=participant
        hintLease=service.registerTutorialGuidedPointerHint(participant:participant,cleanup:{[weak self] _ in
            guard let self,self.hintEpoch==epoch else{return};self.hintLease=nil;self.hintPaint=nil
        })
        return hintLease != nil && admitted() && hintEpoch==epoch
    }
    private func cancelHint(){hintEpoch &+= 1;let old=hintLease;hintLease=nil;hintPaint=nil;old?.cancel(success:false)}
    static func hintProgress(_ seconds:Double)->Double {
        let cycle=max(0,seconds)/1.3,index=floor(cycle),local=(cycle-index)*1.3
        let t=min(1,local/1.18),eased=t<0.5 ? 2*t*t:1-pow(-2*t+2,2)/2
        return Int(index)%2==0 ? eased:1-eased
    }
    func cancelPointer() {cancelHint();pointerEpoch &+= 1;let old=pointerLease;pointerLease=nil;pointerPaint=nil;old?.cancel(success:false)}
    private func paintPointer(_ pose:PointerPose){paintedPointer=pose;pointer(pose)}
    private func paintSheet(_ progress:Double){paintedSheet=progress;sheet(progress)}
    private func cancelSheet(){sheetEpoch &+= 1;let old=sheetLease;sheetLease=nil;sheetPaint=nil;old?.cancel(success:false)}
    /// These are real finite APP roots. Only their successful captured cleanup
    /// may advance a tutorial phase; cancellation/overwrite never completes it.
    /// Reference intro wall timers retain Source behavior. Native step exits
    /// retire delayed hand entrances which could overwrite their completion.
    @discardableResult func popOutPointer(completed:@escaping()->Void)->Bool {
        guard admitted() else{return false}
        if nativeSheetMotion {
            // A fast real merge can beat the delayed hand entrance. That old
            // entrance must not overwrite the exit which owns step completion.
            let delayed=timers.filter{["tutorial-pointer400","tutorial-pointer1200","tutorial-second-pointer400"].contains($0.sourceID)}
            timers.removeAll{delayed.contains($0)}
            for receipt in delayed{_=timeouts.cancel(receipt)}
        }
        cancelPointer();let epoch=pointerEpoch,from=paintedPointer
        let paint=Paint{[weak self] seconds in
            guard let self else{return};guard self.admitted() else{self.dispose();return};guard self.pointerEpoch==epoch else{return}
            let t=Self.backIn(seconds/0.2,1.7)
            self.paintPointer(.init(alpha:from.alpha*(1-t),scale:from.scale*(1-t),rotation:from.rotation+(-8-from.rotation)*t))
        }
        pointerPaint=paint
        pointerLease=service.register(participant:paint,duration:0.2,domain:.sourceGSAP(.defaultLazyTween),cleanup:{[weak self] success in
            guard let self,self.pointerEpoch==epoch else{return};self.pointerLease=nil;self.pointerPaint=nil
            guard success,self.admitted() else{return};self.conceal();guard self.admitted(),self.pointerEpoch==epoch else{return};completed()
        })
        return pointerLease != nil
    }
    @discardableResult func exitSheet(completed:@escaping()->Void)->Bool {exitSheet(duration:0.28,completed:completed)}
    @discardableResult func exitThirdSheetForWild(completed:@escaping()->Void)->Bool {exitSheet(duration:0.34,completed:completed)}
    private func exitSheet(duration:Double,completed:@escaping()->Void)->Bool {
        guard admitted() else{return false};cancelSheet();let epoch=sheetEpoch,from=paintedSheet
        let paint=Paint{[weak self] seconds in
            guard let self else{return};guard self.admitted() else{self.dispose();return};guard self.sheetEpoch==epoch else{return}
            let t=pow(max(0,min(1,seconds/duration)),3);self.paintSheet(from+(1-from)*t)
        }
        sheetPaint=paint
        sheetLease=service.register(participant:paint,duration:duration,domain:.sourceGSAP(.defaultLazyTween),cleanup:{[weak self] success in
            guard let self,self.sheetEpoch==epoch else{return};self.sheetLease=nil;self.sheetPaint=nil
            guard success,self.admitted() else{return};completed()
        })
        return sheetLease != nil
    }
    @discardableResult func enterSheet(completed:@escaping()->Void)->Bool {
        guard admitted() else{return false};cancelSheet();let epoch=sheetEpoch,from=paintedSheet
        let paint=Paint{[weak self] seconds in
            guard let self else{return};guard self.admitted() else{self.dispose();return};guard self.sheetEpoch==epoch else{return}
            self.paintSheet(from*self.entranceProgress(seconds))
        }
        sheetPaint=paint
        sheetLease=service.register(participant:paint,duration:entranceDuration,domain:.sourceGSAP(.defaultLazyTween),cleanup:{[weak self] success in
            guard let self,self.sheetEpoch==epoch else{return};self.sheetLease=nil;self.sheetPaint=nil
            guard success,self.admitted() else{return};completed()
        })
        return sheetLease != nil
    }
    /// Adjacent lessons retain their paper; only the copy/CTA crossfade.
    @discardableResult func replaceSheetContent(prepare:@escaping()->Void,paint:@escaping(Double,Double)->Void,completed:@escaping()->Void)->Bool {
        guard admitted() else{return false};cancelSheet();let epoch=sheetEpoch
        var replaced=false
        let participant=Paint{[weak self] seconds in
            guard let self,self.admitted(),self.sheetEpoch==epoch else{return}
            if seconds>=0.14 && !replaced {replaced=true;prepare()}
            guard self.admitted(),self.sheetEpoch==epoch else{return}
            if seconds<0.14 {let t=min(1,seconds/0.14);paint(1-t*t*(3-2*t),-6*t)}
            else {let t=min(1,(seconds-0.14)/0.24),e=t*t*(3-2*t);paint(e,6*(1-e))}
        }
        sheetPaint=participant
        sheetLease=service.register(participant:participant,duration:0.38,domain:.sourceGSAP(.timeline),cleanup:{[weak self] success in
            guard let self,self.sheetEpoch==epoch else{return};self.sheetLease=nil;self.sheetPaint=nil
            guard success,self.admitted() else{return};paint(1,0);completed()
        })
        return sheetLease != nil
    }
    func scheduleSecondStepPointer(current:@escaping()->Bool,updateFocus:@escaping()->Void){
        schedule("tutorial-second-pointer400",400){[weak self] in guard let self,self.admitted(),current() else{return};updateFocus();guard self.admitted(),current() else{return};self.restorePointer()}
    }
    private static func backIn(_ value:Double,_ amount:Double)->Double {let t=max(0,min(1,value));return (amount+1)*t*t*t-amount*t*t}
    /// Source gsap.set(image) before the free-play shell timeline also updates
    /// the captured image pose used by the later independent image pop-out.
    func primePointerImage(_ pose:PointerPose){guard admitted() else{return};cancelPointer();paintPointer(pose)}
    @discardableResult func setDimVisible(_ visible:Bool)->Bool {
        guard admitted() else{return false};cancelDim();let epoch=dimEpoch,from=paintedDim,to=visible ? 1.0:0.0
        let paint=Paint{[weak self] seconds in
            guard let self,self.admitted(),self.dimEpoch==epoch else{return}
            let t=0.5-0.5*cos(max(0,min(1,seconds/0.2))*Double.pi)
            self.paintedDim=from+(to-from)*t;self.dim(self.paintedDim)
        }
        dimPaint=paint
        dimLease=service.register(participant:paint,duration:0.2,domain:.sourceGSAP(.defaultLazyTween),cleanup:{[weak self] _ in
            guard let self,self.dimEpoch==epoch else{return};self.dimPaint=nil;self.dimLease=nil
        })
        return dimLease != nil
    }
    private func cancelDim(){dimEpoch &+= 1;let old=dimLease;dimLease=nil;dimPaint=nil;old?.cancel(success:false)}
    func hidePointerImage(){guard admitted() else{return};cancelPointer();paintPointer(.init(alpha:0,scale:0,rotation:paintedPointer.rotation))}
    func restorePointer(){startPointer(scheduleFocus:false)}
    func dispose() {
        guard !disposed else{return};disposed=true
        let oldTimers=timers;timers.removeAll();for timer in oldTimers{_=timeouts.cancel(timer)}
        cancelSheet();cancelDim()
        cancelPointer();let oldFrame=frame;frame=nil;oldFrame?.cancel()
    }
    private var entranceDuration:Double{nativeSheetMotion ? NativeTutorialSheetMotion.duration:0.42}
    private func entranceProgress(_ seconds:Double)->Double{nativeSheetMotion ? NativeTutorialSheetMotion.progress(seconds):Self.sheetProgress(seconds)}
    static func sheetProgress(_ seconds:Double)->Double {1-backOut(seconds/0.42,1.25)}
    static func pointerPose(_ seconds:Double)->PointerPose {
        let time=max(0,seconds),alpha=sin(min(1,time/0.08)*Double.pi/2)
        if time<=0.22 {let t=backOut(time/0.22,2.2);return .init(alpha:alpha,scale:1.14*t,rotation:-8+10*t)}
        if time<=0.33 {let t=1-pow(1-min(1,(time-0.22)/0.11),3);return .init(alpha:alpha,scale:1.14-0.2*t,rotation:2-4*t)}
        let t=backOut((time-0.33)/0.16,1.7);return .init(alpha:alpha,scale:0.94+0.06*t,rotation:-2+2*t)
    }
    private static func backOut(_ value:Double,_ amount:Double)->Double {
        let t=max(0,min(1,value))-1;return 1+(amount+1)*t*t*t+amount*t*t
    }
    isolated deinit{dispose()}
}
