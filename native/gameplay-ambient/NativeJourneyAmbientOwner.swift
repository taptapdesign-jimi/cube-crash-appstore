import UIKit
import AVFAudio
import StackToSixGameplay

@MainActor
protocol NativeAmbientLoopTransport:AnyObject {
    func start(id:String,source:String,gain:Double)
    func gain(id:String,to value:Double,duration:Double)
    func pause(id:String)
    func resume(id:String,gain:Double)
    func stop(id:String)
    func dispose()
}
@MainActor
private final class AmbientTimerReceipt:NativeMusicCancellation {
    var timer:Timer?
    func cancel(){timer?.invalidate();timer=nil}
}
@MainActor
private final class AmbientScheduler:NativeMusicScheduler {
    func after(_ seconds:Double,_ callback:@escaping ()->Void)->any NativeMusicCancellation {
        let receipt=AmbientTimerReceipt()
        receipt.timer=Timer.scheduledTimer(withTimeInterval:max(0.001,seconds),repeats:false) { [weak receipt] _ in MainActor.assumeIsolated {receipt?.timer=nil;callback()} }
        return receipt
    }
}

/// Authored native Journey loops. A retained current visit has one absolute World
/// deadline, and background pauses the existing file voice without replaying it.
@MainActor
final class NativeJourneyAmbientOwner {
    enum Route:Equatable {case none,hub,world(Int),gameplay(NativeRunMode,Int)}
    private struct Loop {var source:String;var gain:Double;var started:Bool}
    private let transport:any NativeAmbientLoopTransport
    private let scheduler:any NativeMusicScheduler
    private let now:()->Double
    private var observers:[NSObjectProtocol]=[]
    private var loops:[String:Loop]=[:]
    private var deadlines:[String:Double]=[:]
    private var worldVisitEnd:Double?
    private var tasks:[String:any NativeMusicCancellation]=[:]
    private var lease:UInt64=1
    private var generation:UInt64=1
    private var route:Route = .none
    private var enabled:Bool
    private var foreground=true
    private var interrupted=false
    private var disposed=false
    static let worlds="journey-worlds-ambient-loop"
    static let bees="journey-forest-soft-bees-ambient"
    static let nature="journey-forest-nature-ambient"
    static let gameplay="journey-forest-gameplay-loop"
    init(root:URL,enabled:Bool,transport:(any NativeAmbientLoopTransport)?=nil,scheduler:(any NativeMusicScheduler)?=nil,now:@escaping ()->Double={ProcessInfo.processInfo.systemUptime}) {
        self.transport=transport ?? NativeFileAmbientLoopTransport(root:root);self.enabled=enabled;self.scheduler=scheduler ?? AmbientScheduler();self.now=now
        for name in [UIApplication.willResignActiveNotification,UIApplication.didBecomeActiveNotification,AVAudioSession.interruptionNotification,AVAudioSession.mediaServicesWereResetNotification] {
            observers.append(NotificationCenter.default.addObserver(forName:name,object:nil,queue:.main) { [weak self] notice in MainActor.assumeIsolated{self?.notification(notice)} })
        }
    }
    func setEnabled(_ value:Bool) {
        guard !disposed,enabled != value else{return};enabled=value
        if !value {stopAll();return}
        let current=route,gen=generation,end=worldVisitEnd
        route = .none;setRoute(current,generation:gen)
        if case .world=current,let end {
            worldVisitEnd=end;tasks.removeValue(forKey:Self.worlds)?.cancel();deadlines[Self.worlds]=end
            if end<=now() {stop(Self.worlds)}else{scheduleWorldDeadline()}
        }
    }
    func setRoute(_ value:Route,generation:UInt64) {
        guard !disposed else{return}
        if value==route && self.generation==generation {return} // Duplicate enter never extends World lifetime.
        let old=route;route=value;self.generation=generation;lease &+= 1
        cancelTasks()
        switch value {
        case .none:worldVisitEnd=nil;stopAll()
        case .hub:
            worldVisitEnd=nil
            stop(Self.bees);stop(Self.nature);stop(Self.gameplay)
            retain(Self.worlds,source:"assets/sound/worlds/crumbleworlds.wav",gain:0.45,ramp:old == .hub ? 0 : 1)
            deadlines.removeValue(forKey:Self.worlds)
        case .world(let world):
            stop(Self.gameplay)
            retain(Self.worlds,source:"assets/sound/worlds/crumbleworlds.wav",gain:0.135,ramp:old == .hub ? 1 : 0)
            worldVisitEnd=now()+6;deadlines[Self.worlds]=worldVisitEnd // 5s hold followed by exactly1s fade, one visit deadline.
            if world==1 {
                retain(Self.bees,source:"assets/sound/worlds/Forest/soft bees ambiance.wav",gain:0.612)
                retain(Self.nature,source:"assets/sound/worlds/Forest/forest nature sounds.wav",gain:0.612)
            } else {stop(Self.bees);stop(Self.nature)}
            scheduleWorldDeadline()
        case .gameplay(let mode,let board):
            worldVisitEnd=nil
            stop(Self.worlds)
            for id in [Self.bees,Self.nature] {fadeAndStop(id,duration:1.5)}
            if mode == .journey && (1...10).contains(board) {
                retain(Self.gameplay,source:"assets/sound/worlds/Forest/gameplay/forest-gameplay-sound.wav",gain:0.54)
            } else {stop(Self.gameplay)}
        }
    }
    /// Exact Cleared residual visual completion calls this; entering a modal is not
    /// a substitute. Ordinary exit/reset stops immediately through route retirement.
    func cleanResidualFinished(generation:UInt64) {
        guard !disposed,self.generation==generation else{return};fadeAndStop(Self.gameplay,duration:2)
    }
    func setForeground(_ value:Bool) {
        guard !disposed else{return};foreground=value;lease &+= 1;cancelTasks()
        if !value {for id in loops.keys {transport.pause(id:id)}}
        else if enabled,!interrupted {
            for (id,loop) in loops {
                if let deadline=deadlines[id],deadline<=now() {stop(id);continue}
                if loop.started {transport.resume(id:id,gain:loop.gain)}else{transport.start(id:id,source:loop.source,gain:loop.gain);loops[id]?.started=true}
            }
            restoreDeadlines()
        }
    }
    private func retain(_ id:String,source:String,gain:Double,ramp:Double=0) {
        guard enabled else{return}
        if var loop=loops[id] {loop.gain=gain;loops[id]=loop;if foreground,!interrupted {transport.gain(id:id,to:gain,duration:ramp)}}
        else {loops[id]=Loop(source:source,gain:gain,started:foreground && !interrupted);if foreground,!interrupted {transport.start(id:id,source:source,gain:gain)}}
    }
    private func fadeAndStop(_ id:String,duration:Double) {
        guard loops[id] != nil else{return}
        let deadline=deadlines[id] ?? now()+duration;deadlines[id]=deadline
        if deadline<=now() {stop(id);return}
        guard foreground,!interrupted else{return}
        let remaining=deadline-now();transport.gain(id:id,to:0,duration:min(duration,remaining))
        arm(id,after:remaining) { [weak self] in self?.stop(id) }
    }
    private func scheduleWorldDeadline() {
        guard loops[Self.worlds] != nil,let end=deadlines[Self.worlds] else{return}
        if end<=now() {stop(Self.worlds);return}
        guard foreground,!interrupted else{return}
        let fadeStart=end-1
        if fadeStart<=now() {fadeAndStop(Self.worlds,duration:end-now())}
        else {arm(Self.worlds,after:fadeStart-now()) { [weak self] in self?.fadeAndStop(Self.worlds,duration:1) }}
    }
    private func restoreDeadlines() {
        for id in Array(deadlines.keys) where id != Self.worlds {fadeAndStop(id,duration:max(0,(deadlines[id] ?? now())-now()))}
        if case .world=route {scheduleWorldDeadline()}
    }
    private func arm(_ id:String,after seconds:Double,_ callback:@escaping ()->Void) {
        tasks[id]?.cancel();let current=lease
        tasks[id]=scheduler.after(seconds) { [weak self] in guard let self,!self.disposed,self.lease==current,self.enabled,self.foreground,!self.interrupted else{return};self.tasks.removeValue(forKey:id);callback() }
    }
    private func stop(_ id:String) {tasks.removeValue(forKey:id)?.cancel();deadlines.removeValue(forKey:id);if loops.removeValue(forKey:id) != nil {transport.stop(id:id)}}
    private func cancelTasks() {for task in tasks.values {task.cancel()};tasks.removeAll()}
    func stopAll() {lease &+= 1;cancelTasks();for id in Array(loops.keys) {stop(id)}}
    func dispose() {guard !disposed else{return};disposed=true;stopAll();transport.dispose();for observer in observers {NotificationCenter.default.removeObserver(observer)};observers.removeAll()}
    private func notification(_ notice:Notification) {
        if notice.name==UIApplication.willResignActiveNotification {setForeground(false)}
        else if notice.name==UIApplication.didBecomeActiveNotification {setForeground(true)}
        else if notice.name==AVAudioSession.interruptionNotification {
            guard let raw=notice.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,let type=AVAudioSession.InterruptionType(rawValue:raw) else{return}
            interrupted=type == .began
            if interrupted {lease &+= 1;cancelTasks();for id in loops.keys {transport.pause(id:id)}}
            else if foreground {setForeground(true)}
        } else {let current=route,gen=generation;stopAll();route = .none;setRoute(current,generation:gen)}
    }
}

/// Streaming PCM file loops: four retained voices maximum, only two bounded
/// scheduled segments per voice, no whole-file PCM cache or settled polling.
@MainActor
final class NativeFileAmbientLoopTransport:NativeAmbientLoopTransport {
    @MainActor private final class Voice {
        let node=AVAudioPlayerNode(),file:AVAudioFile
        var generation=0,position=0.0,anchor=0.0,playing=false
        var fade:Timer?
        init(file:AVAudioFile){self.file=file}
        var duration:Double {Double(file.length)/file.processingFormat.sampleRate}
        var currentTime:Double {
            guard playing,let time=node.lastRenderTime,let player=node.playerTime(forNodeTime:time) else{return position}
            return (anchor+Double(player.sampleTime)/player.sampleRate).truncatingRemainder(dividingBy:duration)
        }
    }
    private let root:URL
    private let engine=AVAudioEngine()
    private var voices:[String:Voice]=[:]
    private var disposed=false
    private static let sources:Set<String>=["assets/sound/worlds/crumbleworlds.wav","assets/sound/worlds/Forest/soft bees ambiance.wav","assets/sound/worlds/Forest/forest nature sounds.wav","assets/sound/worlds/Forest/gameplay/forest-gameplay-sound.wav"]
    var onError:((String)->Void)?
    init(root:URL){self.root=root}
    func start(id:String,source:String,gain:Double) {
        guard !disposed,Self.sources.contains(source),voices.count<4 || voices[id] != nil else{return}
        do {
            if let voice=voices[id] {voice.node.volume=Float(gain);if !voice.playing {try start(voice)};return}
            let voice=Voice(file:try AVAudioFile(forReading:root.appendingPathComponent(source)))
            guard voice.file.length>0,voice.file.length<=Int64(UInt32.max) else {throw NSError(domain:"NativeAmbient",code:1,userInfo:[NSLocalizedDescriptionKey:"Unsupported authored loop duration"])}
            engine.attach(voice.node);engine.connect(voice.node,to:engine.mainMixerNode,format:voice.file.processingFormat);voices[id]=voice
            voice.node.volume=Float(max(0,min(1,gain)));try start(voice)
        } catch {onError?(error.localizedDescription);stop(id:id)}
    }
    private func start(_ voice:Voice) throws {
        voice.generation += 1;let generation=voice.generation
        voice.node.stop();voice.anchor=max(0,voice.position).truncatingRemainder(dividingBy:voice.duration)
        schedule(voice,from:voice.anchor,generation:generation);schedule(voice,from:0,generation:generation)
        if !engine.isRunning {try engine.start()};voice.playing=true;voice.node.play()
    }
    /// A constant actor-isolated receipt crosses the AV render callback. Mutable
    /// weak capture boxes never cross from that callback into a concurrent Task.
    @MainActor private final class SegmentReceipt {
        private weak var owner:NativeFileAmbientLoopTransport?
        private weak var voice:Voice?
        private let generation:Int
        init(owner:NativeFileAmbientLoopTransport,voice:Voice,generation:Int){self.owner=owner;self.voice=voice;self.generation=generation}
        func consumed(){guard let owner,let voice,voice.generation==generation,voice.playing,!owner.disposed else{return};owner.schedule(voice,from:0,generation:generation)}
    }
    private func schedule(_ voice:Voice,from seconds:Double,generation:Int) {
        let frame=AVAudioFramePosition((seconds*voice.file.processingFormat.sampleRate).rounded())
        let count=AVAudioFrameCount(max(0,voice.file.length-frame));guard count>0 else{return}
        let receipt=SegmentReceipt(owner:self,voice:voice,generation:generation)
        voice.node.scheduleSegment(voice.file,startingFrame:frame,frameCount:count,at:nil,completionCallbackType:.dataConsumed) { _ in
            Task { @MainActor [receipt] in receipt.consumed() }
        }
    }
    func gain(id:String,to value:Double,duration:Double) {
        guard let voice=voices[id] else{return};voice.fade?.invalidate();voice.fade=nil
        let target=Float(max(0,min(1,value))),from=voice.node.volume
        guard duration>0,voice.playing else {voice.node.volume=target;return}
        let began=ProcessInfo.processInfo.systemUptime,generation=voice.generation
        voice.fade=Timer.scheduledTimer(withTimeInterval:1/30,repeats:true) { [weak voice] _ in MainActor.assumeIsolated {
            guard let voice,voice.generation==generation else{return}
            let progress=min(1,max(0,(ProcessInfo.processInfo.systemUptime-began)/duration));voice.node.volume=from+(target-from)*Float(progress)
            if progress>=1 {voice.fade?.invalidate();voice.fade=nil}
        } }
    }
    func pause(id:String) {guard let voice=voices[id] else{return};voice.fade?.invalidate();voice.fade=nil;voice.position=voice.currentTime;voice.playing=false;voice.generation += 1;voice.node.stop();if !voices.values.contains(where:{$0.playing}) {engine.pause()}}
    func resume(id:String,gain:Double) {guard let voice=voices[id],!disposed else{return};voice.node.volume=Float(max(0,min(1,gain)));if !voice.playing {do {try start(voice)}catch {onError?(error.localizedDescription);stop(id:id)}}}
    func stop(id:String) {guard let voice=voices[id] else{return};pause(id:id);engine.detach(voice.node);voices.removeValue(forKey:id)}
    func dispose() {guard !disposed else{return};disposed=true;for id in Array(voices.keys) {stop(id:id)};engine.stop()}
}
