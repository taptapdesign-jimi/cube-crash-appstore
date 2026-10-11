import Foundation
// Clockless Source regular gain and spring values; transported as two distinct
// original timeline roots by future adapter. No Scene, input or charge ownership.
struct NativeWildMeterGainPlan {
    let maximum:Double,initial:Double,ratio:Double,isPad:Bool
    var target:Double {maximum*ratio}
    var growing:Bool {target>initial+0.5}
    var full:Bool {ratio>=0.999}
    var baseDuration:Double {isPad ? 0.32:0.4}
    var firstDuration:Double {baseDuration*0.68}
    var secondDuration:Double {full ? 0.13:0.11}
    var thirdDuration:Double {full ? 0.15:0.13}
    var fourthDuration:Double {full ? 0.26:0.22}
    var duration:Double {((growing ? firstDuration+secondDuration+thirdDuration+fourthDuration:baseDuration)*1e7).rounded()/1e7}
    enum BounceTrigger { case none, atStart, afterActualCompletion }
    var bounceTrigger:BounceTrigger { full ? .afterActualCompletion : growing ? .atStart : .none }
    init(maximum:Double,initial:Double,ratio:Double,isPad:Bool) {
        self.maximum=max(0,maximum);self.initial=initial
        self.ratio=ratio.isFinite ? max(0,min(1,ratio)):0;self.isPad=isPad
    }
    private func clamp(_ v:Double)->Double {max(0,min(1,v))}
    private func elastic(_ p:Double,_ period:Double)->Double {
        if p==0 || p==1{return p}
        return pow(2,-10*p)*sin((p-period/4)*2 * .pi/period)+1
    }
    func width(seconds:Double)->Double {
        let t=max(0,seconds);var width=target
        if !growing {
            let p=clamp(t/baseDuration);width=initial+(target-initial)*(1-pow(1-p,3))
        } else if t<duration {
            let distance=max(3.5,target*0.05),over=target+distance
            let under=max(0,target-max(1.5,distance*0.36)),over2=target+max(2,distance*0.58)
            if t<firstDuration {let p=clamp(t/firstDuration);width=initial+(over-initial)*(1-pow(1-p,5))}
            else if t<firstDuration+secondDuration {let p=clamp((t-firstDuration)/secondDuration);width=over+(under-over)*(1-cos(.pi*p))/2}
            else if t<firstDuration+secondDuration+thirdDuration {let p=clamp((t-firstDuration-secondDuration)/thirdDuration);width=under+(over2-under)*sin(.pi*p/2)}
            else {let p=clamp((t-firstDuration-secondDuration-thirdDuration)/fourthDuration),q=p-1;let e=full ? elastic(p,0.74):1+2.15*q*q*q+1.15*q*q;width=over2+(target-over2)*e}
        }
        return max(0,min(maximum*1.05,r6(width)))
    }
    private func r6(_ x:Double)->Double{floor(x*1e6+0.5)/1e6}
    func bounce(secondsSinceBirth t:Double)->Double {
        if t<=0 || t>=0.58{return 0}
        if t<0.16{return r6(-2.5*sin(.pi*t/0.16/2))}
        if t<0.34 {let p=(t-0.16)/0.18;return r6(-2.5+3.8*(1-cos(.pi*p))/2)}
        return r6(1.3*(1-elastic((t-0.34)/0.24,0.82)))
    }
}
