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
    mutating func wake(at now:Double,hidden:Bool,dragActive:Bool,availableIDs:[String],random:()->Double,current:()->Bool={true},begin:((Cycle)->Void)?=nil)->Cycle? {
        due=nil;guard active else{return nil}
        if hidden {if hiddenAt==nil {hiddenAt=now};parked=0;return nil}
        if dragActive {lastInteraction=now;schedule(500,at:now,hidden:false);return nil}
        if now-lastInteraction<4000 {schedule(100,at:now,hidden:false);return nil}
        if availableIDs.isEmpty {schedule(800,at:now,hidden:false);return nil}
        let choice=floor(random()*Double(availableIDs.count))
        guard current() else{return nil}
        var cycle:Cycle?
        if choice.isFinite,choice>=0,choice<Double(availableIDs.count) {
            let variant=random();guard current() else{return nil}
            let direction=random();guard current() else{return nil}
            let tilt=random();guard current() else{return nil}
            let motion=NativeRegularIdleMotion(variantDraw:variant,directionDraw:direction,tiltDraw:tilt)
            cycle=Cycle(tileID:availableIDs[Int(choice)],motion:motion)
        }
        if let cycle {begin?(cycle);guard current() else{return nil}}
        let interval=random();guard current() else{return nil}
        schedule(3000+(interval*2-1)*1000,at:now,hidden:false)
        return cycle
    }
}


/// Actual APP wall wake for the literal TILE_IDLE_BOUNCE schedule. The Scene
/// supplies retained node/transform/frame/smoke owners. One pending timeout,
/// no render polling, no separate RNG or clock, and no work while hidden.
@MainActor final class NativeSourceRegularIdleOwner {
    struct Hooks {
        let current:()->Bool,date:()->Double,random:()->Double
        let available:()->[String],dragActive:()->Bool
        let begin:(NativeRegularIdleSchedule.Cycle)->Void,stopAnimations:()->Void
        let schedule:(Int,@escaping()->Void)->(()->Void)
    }
    private let hooks:Hooks
    private var schedule=NativeRegularIdleSchedule(),cancel:(()->Void)?
    private var epoch:UInt64=0,hidden=false,disposed=false
    var active:Bool {!disposed && schedule.active}
    var due:Double? {schedule.due}
    init(hooks:Hooks){self.hooks=hooks}
    private func current(_ e:UInt64)->Bool {
        guard !disposed,epoch==e else{return false};let accepted=hooks.current()
        return accepted && !disposed && epoch==e
    }
    private func invalidate()->UInt64 {
        epoch &+= 1;let e=epoch,old=cancel;cancel=nil;old?();return e
    }
    @discardableResult func start()->Bool {
        stop();let e=epoch;guard current(e) else{return false}
        let now=hooks.date();guard now.isFinite,current(e) else{return false}
        schedule.start(at:now,hidden:hidden);arm(at:now,epoch:e);return current(e)
    }
    func stop(){let e=invalidate();schedule.stop();guard current(e) else{return};hooks.stopAnimations()}
    func interact(){
        let e=invalidate();guard current(e) else{return}
        let now=hooks.date();guard now.isFinite,current(e) else{return}
        schedule.interact(at:now,hidden:hidden);hooks.stopAnimations()
        guard current(e) else{return};arm(at:now,epoch:e)
    }
    func setHidden(_ value:Bool){
        guard hidden != value else{return};let e=invalidate();hidden=value
        guard current(e) else{return};let now=hooks.date();guard now.isFinite,current(e) else{return}
        if value {schedule.park(at:now)}else{schedule.resume(at:now)}
        arm(at:now,epoch:e)
    }
    private func arm(at now:Double,epoch e:UInt64){
        guard current(e),let due=schedule.due,!hidden else{return}
        let delay=max(0,due-now)
        guard delay.isFinite,delay<=Double(Int.max-1) else{return}
        let cancellation=hooks.schedule(Int(ceil(delay)),{[weak self] in self?.wake(epoch:e)})
        guard current(e),cancel==nil else{cancellation();return};cancel=cancellation
    }
    private func wake(epoch e:UInt64){
        guard current(e) else{return};cancel=nil
        let now=hooks.date();guard now.isFinite,current(e) else{return}
        let dragging=hooks.dragActive();guard current(e) else{return}
        let ids=dragging || hidden ? []:hooks.available();guard current(e) else{return}
        // Value copy prevents a reentrant stop/start from overwriting the new
        // schedule. Every Math and actual animation admission is fenced.
        var captured=schedule
        _=captured.wake(at:now,hidden:hidden,dragActive:dragging,availableIDs:ids,
            random:hooks.random,current:{[weak self] in self?.current(e)==true},begin:hooks.begin)
        guard current(e) else{return};schedule=captured;arm(at:now,epoch:e)
    }
    func dispose(){guard !disposed else{return};disposed=true;_=invalidate();schedule.stop();hooks.stopAnimations()}
}
