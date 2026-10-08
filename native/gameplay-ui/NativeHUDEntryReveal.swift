import Foundation

/// Existing Scene callbacks own delivery; this value owner creates no timer.
struct NativeHUDEntryReveal {
    struct Receipt:Equatable {let id:UInt64;let generation:UInt64}
    private var nextID:UInt64=0
    private var live:Receipt?
    private var halfTotal=1
    private var completed=0
    private var halfFired=false
    private var framesRemaining:Int?
    mutating func begin(generation:UInt64,tileCount:Int)->Receipt {
        nextID &+= 1
        let receipt=Receipt(id:nextID,generation:generation)
        live=receipt;halfTotal=Int(ceil(Double(max(1,tileCount))/2))
        completed=0;halfFired=false;framesRemaining=nil
        return receipt
    }
    mutating func tileCompleted(_ receipt:Receipt) {
        guard live==receipt else{return}
        completed+=1
        if completed>=halfTotal {midpoint(receipt)}
    }
    mutating func midpoint(_ receipt:Receipt) {
        guard live==receipt,!halfFired else{return}
        halfFired=true;framesRemaining=2
    }
    /// Invoke at the start of actual existing Scene.update, before SKActions.
    /// A midpoint produced during the previous action pass first sees the next
    /// update, then its nested callback sees the following update.
    mutating func renderedCallback(_ receipt:Receipt)->Bool {
        guard live==receipt,let remaining=framesRemaining else{return false}
        if remaining>1 {framesRemaining=remaining-1;return false}
        framesRemaining=nil
        return true
    }
    mutating func cancel(_ receipt:Receipt) {
        guard live==receipt else{return}
        live=nil;framesRemaining=nil
    }
}
