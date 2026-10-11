import Foundation
/// Literal app-core scheduleHudStarHudFeedback: every score mutation is already
/// committed, while all numeric/icon redraws coalesce in one real future RAF.
@MainActor final class NativeSourceHUDStarFeedback {
    typealias Cancel=()->Void
    private let current:()->Bool,schedule:(@escaping()->Void)->Cancel?,paint:()->Void
    private var pending:(id:UUID,cancel:Cancel?)?
    private var disposed=false
    var framePending:Bool{pending != nil}
    init(current:@escaping()->Bool,schedule:@escaping(@escaping()->Void)->Cancel?,paint:@escaping()->Void){self.current=current;self.schedule=schedule;self.paint=paint}
    @discardableResult func scoreChanged()->Bool {
        guard !disposed else{return false};let valid=current();guard valid,!disposed else{return false}
        if pending != nil{return true}
        let id=UUID();pending=(id,nil)
        let cancel=schedule{[weak self] in self?.deliver(id)}
        guard !disposed,pending?.id==id else{cancel?();return false}
        guard let cancel else{pending=nil;return false};pending=(id,cancel);return true
    }
    private func deliver(_ id:UUID) {
        guard !disposed,pending?.id==id else{return}
        let valid=current();guard !disposed,pending?.id==id else{return}
        pending=nil // Source clears its boolean BEFORE animate/bump/bounce.
        if valid{paint()}
    }
    func dispose(){guard !disposed else{return};disposed=true;let cancel=pending?.cancel;pending=nil;cancel?()}
}
