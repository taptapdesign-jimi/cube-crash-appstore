import Foundation
import CoreGraphics

/// v9 drag-core onMove stores the latest sample under one actual Source RAF.
/// Owns no ticker: pickup and release remain synchronous input tasks.
@MainActor final class NativeSourceDragMoveQueue {
    private let service:NativeSourceAnimationClockService
    private let ownerID:String,generation:UInt64,current:()->Bool,paint:(CGPoint)->Void
    private var pending:CGPoint?,frameID:UUID?,frame:NativeSourceAnimationClockService.SourceFrameLease?
    private var closed=false
    var hasPendingSample:Bool {pending != nil}
    init(service:NativeSourceAnimationClockService,ownerID:String,generation:UInt64,
         current:@escaping()->Bool,paint:@escaping(CGPoint)->Void) {
        self.service=service;self.ownerID=ownerID;self.generation=generation;self.current=current;self.paint=paint
    }
    func enqueue(_ point:CGPoint) {
        guard !closed,current(),!closed else{return}
        pending=point
        guard frameID==nil else{return}
        let id=UUID();frameID=id
        let captured=service.requestSourceAnimationFrame(ownerID:ownerID,generation:generation,callback:{[weak self] in
            guard let self,!self.closed,self.frameID==id else{return}
            let point=self.pending;self.pending=nil;self.frameID=nil;self.frame=nil
            guard self.current(),!self.closed,let point else{return}
            self.paint(point)
        },onCancelled:{[weak self] in
            guard let self,self.frameID==id else{return}
            self.pending=nil;self.frameID=nil;self.frame=nil
        })
        guard !closed,frameID==id else{captured?.cancel();return}
        guard let captured else{pending=nil;frameID=nil;return}
        frame=captured
    }
    func dispose() {
        guard !closed else{return};closed=true
        let captured=frame;frame=nil;frameID=nil;pending=nil;captured?.cancel()
    }
    isolated deinit {dispose()}
}
