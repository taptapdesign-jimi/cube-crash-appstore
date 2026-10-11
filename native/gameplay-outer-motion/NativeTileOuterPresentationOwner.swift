import Foundation

@MainActor protocol NativeTileOuterTimelineDriver:AnyObject {
    func start(receipt:NativeTileOuterReceipt,duration:Double,paint:@escaping(Double)->Void,completed:@escaping()->Void,interrupted:@escaping()->Void)->Bool
    func interrupt(receipt:NativeTileOuterReceipt)
    /// Actual Source clock delivery after target-channel removal shortens a
    /// surviving root. This is not an elapsed wall timer or fake interruption.
    func completeAtSourceBoundary(receipt:NativeTileOuterReceipt)
}

@MainActor final class NativeTileOuterPresentationOwner {
    private final class Entry {
        let receipt:NativeTileOuterReceipt,release:()->Void,restore:()->Void
        let scaleEnds:[Double],unscaledEnd:Double
        var killedScale:Set<Int>=[],lastElapsed=0.0
        init(receipt:NativeTileOuterReceipt,release:@escaping()->Void,restore:@escaping()->Void,scaleEnds:[Double],unscaledEnd:Double){self.receipt=receipt;self.release=release;self.restore=restore;self.scaleEnds=scaleEnds;self.unscaledEnd=unscaledEnd}
        var survivingEnd:Double {max(unscaledEnd,scaleEnds.enumerated().filter{!killedScale.contains($0.offset)}.map(\.element).max() ?? 0)}
        func scaleSurvives(_ seconds:Double)->Bool {let index=scaleEnds.firstIndex(where:{seconds <= $0}) ?? max(0,scaleEnds.count-1);return !killedScale.contains(index)}
    }
    private let driver:NativeTileOuterTimelineDriver
    private var entries:[NativeTileOuterReceipt.Kind:Entry]=[:]
    private var latest:NativeTileOuterReceipt?
    private(set) var ownership=NativeTileOuterOwnership()
    init(driver:NativeTileOuterTimelineDriver){self.driver=driver}
    var receipt:NativeTileOuterReceipt? {latest.flatMap{entries[$0.kind]?.receipt==$0 ? $0:nil} ?? entries[.idle]?.receipt}
    var activeIdle:Bool {entries[.idle] != nil}

    private func install(_ entry:Entry,duration:Double,isCurrent:@escaping()->Bool,paint:@escaping(Double,Bool)->Void,onCompleted:@escaping()->Void,onInterrupted:@escaping()->Void={})->Bool {
        let receipt=entry.receipt;entries[receipt.kind]=entry;latest=receipt;_ = ownership.replace(receipt)
        let accepted=driver.start(receipt:receipt,duration:duration,paint:{[weak self,weak entry] seconds in
            guard let self,let entry,self.entries[receipt.kind] === entry,isCurrent() else{return}
            entry.lastElapsed=seconds
            paint(min(seconds,entry.survivingEnd),entry.scaleSurvives(seconds))
            if self.entries[receipt.kind] === entry,entry.survivingEnd<duration,seconds>=entry.survivingEnd {self.driver.completeAtSourceBoundary(receipt:receipt)}
        },completed:{[weak self] in
            guard let self else{entry.release();return}
            guard self.finish(receipt,restore:true),isCurrent() else{return};onCompleted()
        },interrupted:{[weak self] in
            guard let self else{entry.release();return}
            if self.finish(receipt,restore:true) {onInterrupted()}
        })
        if !accepted {_ = finish(receipt,restore:false)}
        return accepted
    }
    @discardableResult func beginMotion(tileID:String,generation:UInt64,motion:NativeTileOuterMotion,isCurrent:@escaping()->Bool,
        paint:@escaping(NativeTileOuterMotion.Pose)->Void,paintWithoutScale:((NativeTileOuterMotion.Pose)->Void)?=nil,
        restoreInterruptedScale:@escaping(CGPoint)->Void,onCompleted:@escaping()->Void={})->Bool {
        interrupt()
        let receipt=NativeTileOuterReceipt(id:UUID(),tileID:tileID,generation:generation,kind:motion.kind == .pickup ? .pickupScale:.snapBack)
        let restore={guard isCurrent(),motion.kind == .snapBack else{return};restoreInterruptedScale(motion.base)}
        let entry=Entry(receipt:receipt,release:{},restore:restore,scaleEnds:motion.kind == .pickup ? [0.055,0.13]:[0.13,0.285],unscaledEnd:motion.kind == .pickup ? 0:0.18)
        return install(entry,duration:motion.duration,isCurrent:isCurrent,paint:{seconds,scaleAlive in
            let p=motion.sample(seconds)
            if scaleAlive {paint(p)}else if motion.kind == .snapBack {paintWithoutScale?(p)}
        },onCompleted:onCompleted)
    }
    @discardableResult func beginIdle(tileID:String,generation:UInt64,motion:NativeRegularIdleMotion,releaseSourceFrames:@escaping()->Void,
        isCurrent:@escaping()->Bool,mayRestore:@escaping()->Bool,paint:@escaping(NativeRegularIdleMotion.Pose)->Void,
        paintRotationOnly:((CGFloat)->Void)?=nil,onSmoke:@escaping()->Void,onFinished:@escaping()->Void)->Bool {
        interrupt()
        let receipt=NativeTileOuterReceipt(id:UUID(),tileID:tileID,generation:generation,kind:.idle)
        var released=false,emittedSmoke=false
        let release={if !released {released=true;releaseSourceFrames()}}
        let restore={if isCurrent(),mayRestore() {paint(.init(x:1,y:1,rotation:0))}}
        let entry=Entry(receipt:receipt,release:release,restore:restore,scaleEnds:[0.09,0.23,0.35,0.52],unscaledEnd:0.35)
        return install(entry,duration:0.52,isCurrent:isCurrent,paint:{seconds,scaleAlive in
            let p=motion.sample(seconds);if scaleAlive {paint(p)}else{paintRotationOnly?(p.rotation)}
            if !emittedSmoke,seconds>=0.23 {emittedSmoke=true;onSmoke()}
        },onCompleted:onFinished,onInterrupted:onFinished)
    }
    @discardableResult func beginMergeImpact(tileID:String,generation:UInt64,motion:NativeMergeImpactMotion,isCurrent:@escaping()->Bool,
        paintScale:@escaping(CGPoint)->Void,onCompleted:@escaping()->Void={})->Bool {
        // Literal gsap.killTweensOf(target.scale): all future scale children are
        // removed. Parent idle/snap roots retain their unrelated motion/tails.
        killScaleChildren(onlyActive:false)
        if let previous=entries[.mergeImpact]?.receipt {interrupt(receipt:previous)}
        paintScale(CGPoint(x:1,y:1))
        let receipt=NativeTileOuterReceipt(id:UUID(),tileID:tileID,generation:generation,kind:.mergeImpact)
        let restore={if isCurrent(){paintScale(CGPoint(x:1,y:1))}}
        let v=motion.variation,entry=Entry(receipt:receipt,release:{},restore:restore,scaleEnds:[0.065*v,0.155*v,0.285*v,0.465*v],unscaledEnd:0)
        return install(entry,duration:motion.duration,isCurrent:isCurrent,paint:{seconds,alive in if alive{paintScale(motion.sample(seconds))}},onCompleted:onCompleted)
    }
    func killScaleChildren(onlyActive:Bool) {
        for entry in entries.values {
            if onlyActive {
                var start=0.0
                for (index,end) in entry.scaleEnds.enumerated() {if entry.lastElapsed>=start && entry.lastElapsed<end {entry.killedScale.insert(index)};start=end}
            } else {entry.killedScale.formUnion(entry.scaleEnds.indices)}
        }
    }
    private func finish(_ receipt:NativeTileOuterReceipt,restore:Bool)->Bool {
        guard let entry=entries[receipt.kind],entry.receipt==receipt else{return false}
        entries.removeValue(forKey:receipt.kind);_ = ownership.retire(receipt)
        if latest==receipt {latest=nil}
        // Retire before release. Unchanged independent mergeImpact may coexist;
        // a reentrant new pickup must not be reset by an old idle cleanup.
        let before=latest;entry.release()
        if restore,latest==before {entry.restore()};return true
    }
    func interrupt(receipt:NativeTileOuterReceipt) {
        guard entries[receipt.kind]?.receipt==receipt else{return}
        driver.interrupt(receipt:receipt);_ = finish(receipt,restore:true)
    }
    func interrupt(){let captured=entries.values.map(\.receipt);for r in captured{interrupt(receipt:r)}}
}
