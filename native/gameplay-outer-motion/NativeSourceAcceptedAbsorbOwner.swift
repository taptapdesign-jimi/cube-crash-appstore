import Foundation

/// Three original sibling Tween roots against the SAME authoritative native
/// die, including its square shadow and active inner family owners.
@MainActor final class NativeSourceAcceptedAbsorbOwner {
    enum Root {case autoPosition,autoScale,mainPosition}
    private struct Entry {let receipt:NativeDragTweenReceipt;let root:Root}
    private weak var host:(any NativeTileOuterPoseHost)?
    private let driver:NativeDragTweenDriver
    private var entries:[UUID:Entry]=[:]
    private var logicalCompleted=false
    private(set) var started=false
    init(host:any NativeTileOuterPoseHost,driver:NativeDragTweenDriver){self.host=host;self.driver=driver}
    var hasActiveRoots:Bool {!entries.isEmpty}
    func begin(destination:CGPoint,onAutoScaleInitialize:@escaping()->Void,onBeforeMainRegistration:@escaping()->Void={},
        isCurrent:@escaping()->Bool,onMainCompleted:@escaping()->Void,
        onMainInterrupted:@escaping()->Void)->Bool {
        guard !started,let host else{return false};started=true
        let tileID=host.sourceTileID,generation=host.sourceGeneration
        for root in [Root.autoPosition,.autoScale,.mainPosition] {
            if root == .mainPosition {onBeforeMainRegistration()}
            guard let host=self.host,isCurrent(),host.sourceTileID==tileID,host.sourceGeneration==generation else{cancelAll();return false}
            let receipt=NativeDragTweenReceipt(id:UUID(),tileID:tileID,generation:generation)
            entries[receipt.id]=Entry(receipt:receipt,root:root)
            var start:CGPoint?
            let accepted=driver.start(receipt:receipt,duration:0.08,paint:{[weak self] seconds in
                guard let self,self.entries[receipt.id] != nil,isCurrent(),let host=self.host,host.sourceTileID==tileID,host.sourceGeneration==generation else{return}
                // Safe only for the proven accepted-source topology: source
                // position roots retired atDOWN; these roots initialize/flush
                // in original autoPosition→autoScale→mainPosition order.
                if start==nil {
                    start=root == .autoScale ? host.sourceLocalScale:host.sourceLocalPosition
                    if root == .autoScale {onAutoScaleInitialize()}
                }
                let t=CGFloat(max(0,min(1,seconds/0.08)))
                let e=root == .mainPosition ? 1-pow(1-t,3):sin(t * .pi/2)
                let target=root == .autoScale ? CGPoint(x:1,y:1):destination
                let pose=CGPoint(x:start!.x+(target.x-start!.x)*e,y:start!.y+(target.y-start!.y)*e)
                if root == .autoScale {host.paintSourceOuterScale(pose)}
                else {host.paintSourceOuterPosition(pose)}
            },finished:{[weak self] success in
                guard let self,self.entries.removeValue(forKey:receipt.id) != nil,root == .mainPosition,!self.logicalCompleted,isCurrent() else{return}
                self.logicalCompleted=true
                if success {onMainCompleted()}else{onMainInterrupted()}
            })
            if !accepted {
                entries.removeValue(forKey:receipt.id)
                cancelAll();return false
            }
        }
        return true
    }
    // Caller decides whether destruction is an owned regular-stack interruption
    // or stale-generation retirement; the owner never manufactures a six arrival.
    func cancelAll(){let captured=Array(entries.values);for e in captured {driver.cancel(receipt:e.receipt)};entries.removeAll()}
    func dispose(){cancelAll();host=nil}
}
