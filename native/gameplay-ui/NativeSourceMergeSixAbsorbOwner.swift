import Foundation
import CoreGraphics

/// Literal drag-core autoCenter roots are installed before app-core merge
/// mutation. The app main root is installed afterwards. Uses one injected APP
/// default-lazy driver; it never creates a timer, display link or paint-zero.
@MainActor final class NativeSourceMergeSixAbsorbOwner {
    private enum Root {case autoPosition,autoScale,mainPosition}
    private weak var host:(any NativeTileOuterPoseHost)?
    private let driver:NativeDragTweenDriver
    private var entries:[UUID:NativeDragTweenReceipt]=[:]
    private var disposed=false,autoStarted=false,mainStarted=false,mainSettled=false
    init(host:any NativeTileOuterPoseHost,driver:NativeDragTweenDriver){self.host=host;self.driver=driver}
    private func current(tileID:String,generation:UInt64,predicate:()->Bool)->Bool {
        guard !disposed,let captured=host else{return false};let accepted=predicate()
        return accepted && !disposed && host === captured && captured.sourceTileID==tileID && captured.sourceGeneration==generation
    }
    func startAuto(destination:CGPoint,current:@escaping()->Bool,onScaleInitialize:@escaping()->Void)->Bool {
        guard !disposed,!autoStarted,let host else{return false};autoStarted=true
        let tileID=host.sourceTileID,generation=host.sourceGeneration
        for root in [Root.autoPosition,.autoScale] {
            guard install(root,destination:destination,tileID:tileID,generation:generation,current:current,onScaleInitialize:onScaleInitialize,
                onInstalled:{_ in},onCompleted:{},onInterrupted:{}) else{dispose();return false}
        }
        return !disposed
    }
    func startMain(destination:CGPoint,current:@escaping()->Bool,onInstalled:@escaping(NativeDragTweenReceipt)->Void,
                   onCompleted:@escaping()->Void,onInterrupted:@escaping()->Void)->Bool {
        guard !disposed,autoStarted,!mainStarted,let host else{return false};mainStarted=true
        return install(.mainPosition,destination:destination,tileID:host.sourceTileID,generation:host.sourceGeneration,current:current,
            onScaleInitialize:{},onInstalled:onInstalled,onCompleted:onCompleted,onInterrupted:onInterrupted)
    }
    private func install(_ root:Root,destination:CGPoint,tileID:String,generation:UInt64,current:@escaping()->Bool,
        onScaleInitialize:@escaping()->Void,onInstalled:@escaping(NativeDragTweenReceipt)->Void,
        onCompleted:@escaping()->Void,onInterrupted:@escaping()->Void)->Bool {
        guard self.current(tileID:tileID,generation:generation,predicate:current) else{return false}
        let receipt=NativeDragTweenReceipt(id:UUID(),tileID:tileID,generation:generation)
        entries[receipt.id]=receipt;var start:CGPoint?
        let accepted=driver.start(receipt:receipt,duration:0.08,paint:{[weak self] seconds in
            guard let self,self.entries[receipt.id]==receipt,self.current(tileID:tileID,generation:generation,predicate:current),
                  self.entries[receipt.id]==receipt,let host=self.host else{return}
            if start==nil {
                start=root == .autoScale ? host.sourceLocalScale:host.sourceLocalPosition
                if root == .autoScale {onScaleInitialize()}
                guard self.entries[receipt.id]==receipt,self.current(tileID:tileID,generation:generation,predicate:current) else{return}
            }
            let t=max(0,min(1,seconds/0.08)),ease=root == .mainPosition ? 1-pow(1-t,3):sin(t * .pi/2)
            let target=root == .autoScale ? CGPoint(x:1,y:1):destination
            let pose=CGPoint(x:start!.x+(target.x-start!.x)*ease,y:start!.y+(target.y-start!.y)*ease)
            if root == .autoScale {host.paintSourceOuterScale(pose)}else{host.paintSourceOuterPosition(pose)}
        },finished:{[weak self] success in
            guard let self,self.entries.removeValue(forKey:receipt.id) != nil,root == .mainPosition,!self.mainSettled else{return}
            self.mainSettled=true // seal BEFORE actual callback/reentrant disposal
            if success {onCompleted()}else{onInterrupted()}
        })
        guard accepted,entries[receipt.id]==receipt,self.current(tileID:tileID,generation:generation,predicate:current),entries[receipt.id]==receipt else {
            if !accepted {entries.removeValue(forKey:receipt.id)}
            driver.cancel(receipt:receipt);return false
        }
        onInstalled(receipt)
        return entries[receipt.id]==receipt && self.current(tileID:tileID,generation:generation,predicate:current) && entries[receipt.id]==receipt
    }
    func dispose() {
        guard !disposed else{return};disposed=true
        let captured=Array(entries.values)
        for receipt in captured {driver.cancel(receipt:receipt)}
        entries.removeAll();host=nil
    }
    isolated deinit {dispose()}
}
