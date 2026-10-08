import Foundation

@MainActor protocol NativeWildMeterConsumptionDriver:AnyObject {
    func start(duration:Double,paint:@escaping(Double)->Void,completed:@escaping()->Void,interrupted:@escaping()->Void)->(() -> Void)?
}

// PRIVATE Source consume owner. Original gain/bounce/smoke presentation remains
// injected. No Scene hook, clock, gameplay charge or fabricated activity lease.
@MainActor final class NativeWildMeterConsumptionOwner {
    private let driver:any NativeWildMeterConsumptionDriver
    private let draw:(NativeWildMeterConsumptionPlan.Pose)->Void
    private let prepareReset:()->Void
    private let resetBounce:()->Void
    private let prepareConsume:(Bool)->Void
    private let stopSmoke:()->Void,stopEmission:()->Void,startSmoke:()->Void,bounce:()->Void
    private(set) var active=false
    private(set) var pending:Double?
    private(set) var queue:[Double]=[]
    private(set) var generation:UInt64=0
    private(set) var width:Double
    private(set) var maximum:Double
    private var cancel:(()->Void)?
    init(driver:any NativeWildMeterConsumptionDriver,maximum:Double,initialWidth:Double,
         draw:@escaping(NativeWildMeterConsumptionPlan.Pose)->Void,
         prepareConsume:@escaping(Bool)->Void = {_ in},resetBounce:@escaping()->Void = {},prepareReset:@escaping()->Void = {},stopSmoke:@escaping()->Void,stopEmission:@escaping()->Void,startSmoke:@escaping()->Void,bounce:@escaping()->Void) {
        self.driver=driver;self.maximum=maximum;self.width=initialWidth
        self.draw=draw;self.prepareConsume=prepareConsume;self.resetBounce=resetBounce;self.prepareReset=prepareReset;self.stopSmoke=stopSmoke;self.stopEmission=stopEmission;self.startSmoke=startSmoke;self.bounce=bounce
    }
    private func clamp(_ value:Double)->Double {value.isFinite ? max(0,min(1,value)):0}
    private func paint(_ pose:NativeWildMeterConsumptionPlan.Pose){width=pose.width;draw(pose)}
    // Returns false when canonical regular-gain owner should take over.
    @discardableResult func acceptProgress(_ ratio:Double,animated:Bool)->Bool {
        let ratio=clamp(ratio)
        if animated && active {
            if !queue.isEmpty {queue[queue.count-1]=ratio}else{pending=ratio}
            return true
        }
        if !animated {reset(ratio:ratio);return true}
        // Original animated setProgress retires the consume owner but captures
        // the currently drawn width for its separate gain animation.
        generation &+= 1;active=false;queue.removeAll();pending=nil
        let old=cancel;cancel=nil;old?();stopSmoke()
        return false
    }
    func reset(ratio:Double,immediateSmoke:Bool=false) {
        generation &+= 1;active=false;queue.removeAll();pending=nil
        let old=cancel;cancel=nil;old?();if !immediateSmoke {prepareReset()}
        if immediateSmoke {stopSmoke()}else{stopEmission()}
        paint(.init(left:0,width:max(0,maximum)*clamp(ratio)))
    }
    func consume(_ ratio:Double,reducedMotion:Bool=false) {
        let ratio=clamp(ratio)
        if reducedMotion {prepareConsume(true);reset(ratio:ratio,immediateSmoke:true);return}
        if active {queue.append(ratio);return}
        active=true;pending=ratio;generation &+= 1
        let captured=generation
        prepareConsume(false)
        guard generation==captured,active else{return}
        let old=cancel;cancel=nil;old?();stopSmoke();resetBounce()
        let plan=NativeWildMeterConsumptionPlan(maximum:maximum,initial:width)
        var startedRefill=false
        let receipt=driver.start(duration:plan.duration,paint:{[weak self] seconds in
            guard let self,self.generation==captured,self.active else{return}
            if !startedRefill && seconds>=plan.refillStart {
                startedRefill=true
                // Original call(drawFill(fill, 0)) precedes the smoke factory.
                self.paint(.init(left:0,width:0))
                guard self.generation==captured,self.active else{return}
                if self.clamp(self.pending ?? ratio)>0 {self.startSmoke()}
            }
            guard self.generation==captured,self.active else{return}
            self.paint(plan.sample(seconds:seconds,pendingRatio:self.pending ?? ratio))
        },completed:{[weak self] in
            guard let self,self.generation==captured,self.active else{return}
            let final=self.clamp(self.pending ?? ratio)
            self.stopEmission();self.paint(.init(left:0,width:plan.maximum*final))
            if final>0 {self.bounce()}
            self.cancel=nil;self.active=false;self.pending=nil
            if !self.queue.isEmpty {let next=self.queue.removeFirst();self.consume(next)}
        },interrupted:{[weak self] in
            guard let self,self.generation==captured else{return}
            self.stopSmoke();self.cancel=nil
            // Literal onInterrupt does NOT reset _consumeActive or its queue.
        })
        if generation==captured && active {cancel=receipt}
        else {receipt?()}
    }
    func adoptPaintedWidth(_ value:Double){width=value}
    func dispose(){generation &+= 1;let old=cancel;cancel=nil;old?();active=false;pending=nil;queue.removeAll();stopSmoke()}
}
