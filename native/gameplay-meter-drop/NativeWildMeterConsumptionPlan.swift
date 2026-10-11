import Foundation

// Clockless original-v9 consumption geometry. The real Source timeline owner
// supplies callback time and latest pending ratio; this plan owns no queue,
// completion, clock, activity, save, input, bounce or smoke transport.
struct NativeWildMeterConsumptionPlan {
    struct Pose { let left:Double; let width:Double }
    let maximum:Double
    let initial:Double
    var fillDuration:Double { initial >= maximum-0.5 ? 0.01 : 0.18 }
    var drainStart:Double { fillDuration+0.1 }
    var refillStart:Double { drainStart+0.38 }
    var duration:Double { ((refillStart+0.34)*1e7).rounded()/1e7 }
    init(maximum:Double,initial:Double) {
        self.maximum=max(0,maximum.isFinite ? maximum:0)
        self.initial=max(0,min(self.maximum,initial.isFinite ? initial:0))
    }
    private func clamp(_ x:Double)->Double {x.isFinite ? max(0,min(1,x)):0}
    private func r6(_ x:Double)->Double{floor(x*1e6+0.5)/1e6}
    func sample(seconds:Double,pendingRatio:Double)->Pose {
        let t=max(0,seconds),ratio=clamp(pendingRatio)
        var left=0.0,width=initial
        if t<fillDuration {
            let p=clamp(t/fillDuration)
            width=r6(initial+(maximum-initial)*(1-pow(1-p,4)))
        } else if t<drainStart {width=maximum}
        else if t<refillStart {
            let p=clamp((t-drainStart)/0.38)
            let e=p<0.5 ? 4*p*p*p:1-pow(-2*p+2,3)/2
            left=maximum*r6(e);width=maximum-left
        } else if t<duration {
            let p=clamp((t-refillStart)/0.34),q=p-1,c=1.35
            let e=1+(c+1)*q*q*q+c*q*q
            width=maximum*ratio*r6(e)
        } else {width=maximum*ratio}
        return .init(left:max(0,min(maximum,left)),width:max(0,min(maximum*1.05,width)))
    }
}
