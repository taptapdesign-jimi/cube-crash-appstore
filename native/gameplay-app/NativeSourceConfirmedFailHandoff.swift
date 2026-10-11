import Foundation

/// Source confirmedFailFlow only. No clock and no activity lease: borrow the
/// actual Scene app-timeout transport; protected stars are killed, never landed.
@MainActor final class NativeSourceConfirmedFailHandoff {
    private final class Capture {
        let generation:UInt64,token:UInt64
        let current:()->Bool,cleanup:()->Bool,completion:(Bool)->Void
        var phase=0
        var cancel:(()->Void)?
        init(generation:UInt64,token:UInt64,current:@escaping()->Bool,cleanup:@escaping()->Bool,completion:@escaping(Bool)->Void){self.generation=generation;self.token=token;self.current=current;self.cleanup=cleanup;self.completion=completion}
    }
    typealias Wait=(UInt64,Int,@escaping()->Void,@escaping()->Void)->()->Void
    private let wait:Wait
    private var active:Capture?
    private var retired=false
    init(wait:@escaping Wait){self.wait=wait}
    private func valid(_ c:Capture,phase:Int)->Bool {
        guard !retired,active === c,c.phase==phase else{return false}
        let accepted=c.current()
        return accepted && !retired && active === c && c.phase==phase
    }
    @discardableResult func begin(generation:UInt64,planToken:UInt64,isArcade:Bool,current:@escaping()->Bool,cleanup:@escaping()->Bool,completion:@escaping(Bool)->Void)->Bool {
        guard !retired,active==nil else{return false}
        let c=Capture(generation:generation,token:planToken,current:current,cleanup:cleanup,completion:completion);active=c
        guard valid(c,phase:0) else{finish(c,accepted:false);return false}
        let cancel=wait(generation,isArcade ? 40:60,{[weak self,weak c] in guard let self,let c else{return};self.elapsed(c)},{[weak self,weak c] in guard let self,let c else{return};self.finish(c,accepted:false)})
        guard !retired,active === c,c.phase==0 else{cancel();return true}
        c.cancel=cancel;return true
    }
    private func elapsed(_ c:Capture) {
        guard valid(c,phase:0) else{finish(c,accepted:false);return}
        c.phase=1;c.cancel=nil // actual timeout receipt already removed by owner
        let cleaned=c.cleanup()
        guard cleaned,valid(c,phase:1) else{finish(c,accepted:false);return}
        finish(c,accepted:true)
    }
    private func finish(_ c:Capture,accepted:Bool) {
        guard active === c,c.phase<2 else{return}
        active=nil;c.phase=2
        let cancel=c.cancel;c.cancel=nil
        cancel?();c.completion(accepted)
    }
    func retire(){guard !retired else{return};retired=true;if let c=active {finish(c,accepted:false)}}
}
