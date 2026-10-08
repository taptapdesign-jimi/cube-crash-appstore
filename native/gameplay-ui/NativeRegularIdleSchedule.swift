import Foundation

/// Source Date.now/visibility ownership as values. The admitting caller supplies
/// wall delivery and current source-eligible IDs; this owner installs no clock.
struct NativeRegularIdleSchedule {
    struct Cycle {let tileID:String,motion:NativeRegularIdleMotion}
    private(set) var active=false
    private(set) var lastInteraction=0.0
    private(set) var due:Double?
    private var hiddenAt:Double?
    private var parked:Double?
    mutating func start(at now:Double,hidden:Bool=false) {
        stop();active=true;lastInteraction=now;schedule(4000,at:now,hidden:hidden)
    }
    mutating func stop(){active=false;due=nil;hiddenAt=nil;parked=nil}
    mutating func interact(at now:Double,hidden:Bool) {
        lastInteraction=now;due=nil
        if active {schedule(4000,at:now,hidden:hidden)}
    }
    private mutating func schedule(_ delay:Double,at now:Double,hidden:Bool) {
        due=nil;guard active else{return}
        if hidden {if hiddenAt==nil {hiddenAt=now};parked=max(0,delay);return}
        parked=nil;due=now+max(0,delay)
    }
    mutating func park(at now:Double) {
        guard active,hiddenAt==nil else{return}
        hiddenAt=now
        if let due {parked=max(0,due-now)}
        due=nil
    }
    mutating func resume(at now:Double,hidden:Bool=false) {
        guard active,!hidden,hiddenAt != nil || parked != nil else{return}
        if let hiddenAt {lastInteraction=lastInteraction<=hiddenAt ? lastInteraction+(now-hiddenAt):now}
        hiddenAt=nil;let delay=parked ?? 4000;parked=nil;schedule(delay,at:now,hidden:false)
    }
    mutating func wake(at now:Double,hidden:Bool,dragActive:Bool,availableIDs:[String],random:()->Double)->Cycle? {
        due=nil;guard active else{return nil}
        if hidden {if hiddenAt==nil {hiddenAt=now};parked=0;return nil}
        if dragActive {lastInteraction=now;schedule(500,at:now,hidden:false);return nil}
        if now-lastInteraction<4000 {schedule(100,at:now,hidden:false);return nil}
        if availableIDs.isEmpty {schedule(800,at:now,hidden:false);return nil}
        let choice=floor(random()*Double(availableIDs.count))
        var cycle:Cycle?
        if choice.isFinite,choice>=0,choice<Double(availableIDs.count) {
            let motion=NativeRegularIdleMotion(variantDraw:random(),directionDraw:random(),tiltDraw:random())
            cycle=Cycle(tileID:availableIDs[Int(choice)],motion:motion)
        }
        schedule(3000+(random()*2-1)*1000,at:now,hidden:false)
        return cycle
    }
}
