import AVFoundation
import UIKit
#if !NATIVE_MUSIC_DIRECT_ONLY
import WebKit
#endif

/// File-backed soundtrack transport. Native routes call perform directly; the preserved hybrid target can retain its bridge.
@MainActor
final class JimiNativeMusic: NSObject {
    @MainActor private final class Voice {
        let node = AVAudioPlayerNode()
        let file: AVAudioFile
        let source:String
        var position = 0.0
        var anchor = 0.0
        var loopStart = 0.0
        var loopEnd = 0.0
        var looping = true
        var playing = false
        var generation = 0
        var fade: Timer?
        var fadeCompletion:((Bool)->Void)?
        init(file: AVAudioFile,source:String) { self.file = file;self.source=source }
        var duration: Double { Double(file.length) / file.processingFormat.sampleRate }
        var currentTime: Double {
            guard playing, let time = node.lastRenderTime, let player = node.playerTime(forNodeTime: time) else { return position }
            let value = anchor + Double(player.sampleTime) / player.sampleRate
            return looping && value >= loopEnd ? loopStart + (value - loopEnd).truncatingRemainder(dividingBy: loopEnd - loopStart) : value
        }
    }
    private let diagnosticsEnabled = ProcessInfo.processInfo.arguments.contains("--cc-performance-diagnostics")
    private let engine = AVAudioEngine()
    private let root: URL
    private var voices: [String: Voice] = [:]
    private var observers: [NSObjectProtocol] = []
    private static let sources: Set<String> = [
        "assets/sound/soundtrack/taptap-gameplay-v1/taptap-gameplay-intro-loop.wav",
        "assets/sound/soundtrack/theme-loop-v1/SIx-theme-runtime-intro-loop.wav",
        "assets/sound/soundtrack/adaptive-music-v3/gameplay-bed-calm-01.wav",
        "assets/sound/soundtrack/adaptive-music-v3/gameplay-bed-active-01.wav"
    ]
    init(root: URL) {
        self.root = root
        super.init()
        for name in [UIApplication.willResignActiveNotification, AVAudioSession.interruptionNotification,
                     AVAudioSession.mediaServicesWereResetNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] notification in
                MainActor.assumeIsolated {
                    self?.traceState("notification-before:\(notification.name.rawValue):\(String(describing: notification.userInfo))")
                    if Self.shouldSuspend(for: notification) { self?.suspend() }
                    self?.traceState("notification-after:\(notification.name.rawValue)")
                }
            })
        }
        for name in [Notification.Name.AVAudioEngineConfigurationChange, AVAudioSession.routeChangeNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] notification in
                MainActor.assumeIsolated { self?.traceState("configuration:\(notification.name.rawValue):\(String(describing: notification.userInfo))") }
            })
        }
    }
    // WKWebView sound/ambience has its own audio session. A nonmixable
    // native session lets those cues interrupt the app's persistent theme.
    // Ambient retains the silent-switch/lock-screen policy while allowing both.
    static let sessionCategory: AVAudioSession.Category = .ambient

    static func shouldSuspend(for notification: Notification) -> Bool {
        if notification.name == AVAudioSession.interruptionNotification {
            guard let raw = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt else { return false }
            // Ended is recovery owned by GameViewController + the current JS
            // owner. Suspending here can undo the activation/resume receipt.
            return AVAudioSession.InterruptionType(rawValue: raw) == .began
        }
        return notification.name == UIApplication.willResignActiveNotification ||
            notification.name == AVAudioSession.mediaServicesWereResetNotification
    }

    func traceState(_ reason: String) {
        guard diagnosticsEnabled else { return }
        let session = AVAudioSession.sharedInstance()
        let rows = voices.keys.sorted().map { id -> String in
            guard let voice = voices[id] else { return id }
            return "\(id){logical=\(voice.playing),node=\(voice.node.isPlaying),gain=\(voice.node.volume),position=\(voice.currentTime),generation=\(voice.generation)}"
        }.joined(separator: ";")
        NSLog("[JIMI_NATIVE_MUSIC_STATE] reason=%@ engine=%d appState=%d sampleRate=%.0f category=%@ voices=%@",
              reason, engine.isRunning ? 1 : 0, UIApplication.shared.applicationState.rawValue,
              session.sampleRate, session.category.rawValue, rows)
    }
    /// Direct native route owner entry. No WKWebView or script is required.
    func perform(id: String, op: String, body: [String: Any], replyHandler: @escaping (Any?, String?) -> Void) {
        guard id.hasPrefix("soundtrack-"), id.count < 64 else {
            replyHandler(nil, "Invalid native music voice"); return
        }
        do {
            if op == "play" {try play(id:id,body:body)}
            guard let voice = voices[id] else { replyHandler(["position": 0, "duration": 0], nil); return }
            switch op {
            case "play": break
            case "pause": retireVoice(id+"-outgoing");pause(voice)
            case "resume":
                if body["volume"] != nil {voice.node.volume = Float(min(1, max(0, number(body, "volume"))))}
                if !voice.playing || !engine.isRunning || !voice.node.isPlaying { try start(voice, at: voice.currentTime) }
            case "seek": try start(voice, at: number(body, "position"))
            case "state": break // Read-only phase receipt for Swift soundtrack scheduling.
            case "volume":
                if body["replyOnFadeFinished"] as? Bool == true {
                    fade(voice,to:Float(min(1,max(0,number(body,"volume")))),duration:number(body,"duration")){[weak voice] completed in
                        guard let voice else{replyHandler(nil,"Native fade retired");return}
                        replyHandler(["position":voice.currentTime,"duration":voice.duration],completed ? nil:"Native fade cancelled")
                    }
                    return
                }
                fade(voice,to:Float(min(1,max(0,number(body,"volume")))),duration:number(body,"duration"))
            case "dispose":
                retireVoice(id+"-outgoing");retireVoice(id)
            default: throw failure("Unknown native music operation")
            }
            if !voices.values.contains(where: { $0.playing }) { engine.pause() }
            if op != "volume" { traceState("command:\(op)") }
            else if diagnosticsEnabled && (!engine.isRunning || !voice.node.isPlaying || voice.node.volume <= 0) {
                traceState("volume-command-health")
            }
            if op != "volume" {
                NSLog("[JIMI_NATIVE_MUSIC] op=%@ id=%@ voices=%d playing=%d position=%.3f duration=%.3f", op, id,
                      voices.count, voices.values.filter { $0.playing }.count, voice.currentTime, voice.duration)
            }
            replyHandler(["position": voice.currentTime, "duration": voice.duration,"playing":voice.playing,"gain":Double(voice.node.volume)], nil)
        } catch {
            NSLog("[JIMI_NATIVE_MUSIC] failure op=%@ reason=%@", op, error.localizedDescription)
            replyHandler(nil, error.localizedDescription)
        }
    }
    /// Open and start the incoming file before retiring the audible source.
    /// A single finite outgoing slot per route bounds rapid replacements.
    private func play(id:String,body:[String:Any]) throws {
        guard let source=body["source"] as? String else{throw failure("Missing music source")}
        let path=source.hasPrefix("./") ? String(source.dropFirst(2)):source
        guard Self.sources.contains(path) else{throw failure("Unregistered music source")}
        let previous=voices[id],replacement=previous != nil && previous?.source != path
        let outgoingID=id+"-outgoing"
        let needsFile=previous?.source != path
        if needsFile,voices.count>=4,voices[outgoingID] != nil {retireVoice(outgoingID)}
        if needsFile,voices.count>=4 {throw failure("Voice limit")}
        let voice:Voice
        if !needsFile,let previous {voice=previous}
        else {
            voice=Voice(file:try AVAudioFile(forReading:root.appendingPathComponent(path)),source:path)
            engine.attach(voice.node);engine.connect(voice.node,to:engine.mainMixerNode,format:voice.file.processingFormat)
        }
        let duration=replacement ? min(2,max(0,number(body,"crossfadeDuration"))):0
        do {
            voice.looping=body["loop"] as? Bool ?? true
            voice.loopStart=min(max(0,number(body,"loopStart")),voice.duration)
            let end=number(body,"loopEnd");voice.loopEnd=end>0 ? min(end,voice.duration):voice.duration
            guard voice.loopEnd>voice.loopStart else{throw failure("Invalid loop region")}
            voice.node.volume=duration>0 ? 0:Float(min(1,max(0,number(body,"volume"))))
            try start(voice,at:number(body,"position"))
        } catch {
            if needsFile {pause(voice);engine.detach(voice.node)}
            if !voices.values.contains(where:{$0.playing}) {engine.pause()}
            throw error // The previous source remains live when opening/starting fails.
        }
        if replacement,let previous {
            retireVoice(outgoingID);voices[outgoingID]=previous
            voices[id]=voice
            if duration>0 {
                fade(voice,to:Float(min(1,max(0,number(body,"volume")))),duration:duration)
                fade(previous,to:0,duration:duration){[weak self,weak previous] completed in
                    guard let self,let previous,completed,self.voices[outgoingID] === previous else{return}
                    self.retireVoice(outgoingID)
                }
            } else {retireVoice(outgoingID)}
        } else {voices[id]=voice}
    }
    private func retireVoice(_ id:String) {
        guard let voice=voices.removeValue(forKey:id) else{return}
        pause(voice);engine.detach(voice.node)
        if !voices.values.contains(where:{$0.playing}) {engine.pause()}
    }
    private func start(_ voice: Voice, at position: Double) throws {
        guard UIApplication.shared.applicationState == .active else { throw failure("App inactive") }
        let session=AVAudioSession.sharedInstance()
        try session.setCategory(Self.sessionCategory)
        try session.setActive(true)
        pause(voice)
        var start = max(0, position)
        if start >= voice.loopEnd {
            start = voice.looping ? voice.loopStart + (start - voice.loopEnd).truncatingRemainder(dividingBy: voice.loopEnd - voice.loopStart) : 0
        }
        voice.position = start; voice.anchor = start
        let generation = voice.generation
        // Keep two file segments queued, not whole PCM copies. A consumed
        // segment queues its successor before the already-queued one ends.
        schedule(voice, from: start, generation: generation)
        if voice.looping { schedule(voice, from: voice.loopStart, generation: generation) }
        if !engine.isRunning { try engine.start() }
        voice.playing = true
        voice.node.play()
    }
    private func schedule(_ voice: Voice, from seconds: Double, generation: Int) {
        let rate = voice.file.processingFormat.sampleRate
        let start = AVAudioFramePosition((seconds * rate).rounded())
        let end = AVAudioFramePosition((voice.loopEnd * rate).rounded())
        guard end > start, end - start <= Int64(UInt32.max) else { return }
        let receipt=SegmentReceipt(owner:self,voice:voice,generation:generation)
        voice.node.scheduleSegment(voice.file, startingFrame: start, frameCount: AVAudioFrameCount(end - start), at: nil,
                                   completionCallbackType: .dataConsumed) { _ in
            DispatchQueue.main.async {[receipt] in receipt.consumed()}
        }
    }
    @MainActor private final class SegmentReceipt {
        private weak var owner:JimiNativeMusic?
        private weak var voice:Voice?
        private let generation:Int
        init(owner:JimiNativeMusic,voice:Voice,generation:Int){self.owner=owner;self.voice=voice;self.generation=generation}
        func consumed(){guard let owner,let voice,voice.generation==generation,voice.playing,voice.looping else{return};owner.schedule(voice,from:voice.loopStart,generation:generation)}
    }
    private func pause(_ voice: Voice) {
        voice.position = voice.currentTime
        voice.playing = false; voice.generation += 1
        voice.fade?.invalidate(); voice.fade = nil
        let completion=voice.fadeCompletion;voice.fadeCompletion=nil;completion?(false)
        voice.node.stop()
    }
    private func fade(_ voice: Voice, to target: Float, duration: Double,completion:((Bool)->Void)?=nil) {
        voice.fade?.invalidate(); voice.fade = nil
        let previous=voice.fadeCompletion;voice.fadeCompletion=nil;previous?(false)
        guard duration > 0, voice.playing else {voice.node.volume=target;completion?(true);return}
        voice.fadeCompletion=completion
        let began = CACurrentMediaTime(), initial = voice.node.volume
        // One finite envelope per voice, no timer outside an actual fade.
        let timer = Timer(timeInterval: 1 / 60, repeats: true) { [weak voice] timer in
            MainActor.assumeIsolated {
                guard let voice else { timer.invalidate(); return }
                let t = Float(min(1, (CACurrentMediaTime() - began) / duration))
                voice.node.volume = initial + (target - initial) * t
                if t >= 1 {timer.invalidate();voice.fade=nil;let completion=voice.fadeCompletion;voice.fadeCompletion=nil;completion?(true)}
            }
        }
        voice.fade = timer
        RunLoop.main.add(timer, forMode: .common)
    }
    private func suspend() {
        for id in Array(voices.keys) where id.hasSuffix("-outgoing") {retireVoice(id)}
        Array(voices.values).forEach(pause)
        engine.pause()
    }
    func dispose() {
        suspend()
        voices.values.forEach { engine.detach($0.node) }
        voices.removeAll()
        observers.forEach(NotificationCenter.default.removeObserver)
        observers.removeAll()
        engine.stop()
    }
    private func number(_ body: [String: Any], _ key: String) -> Double {
        // Direct Swift callers may supply integral seconds. Preserve the same
        // numeric domain as the bridged JS NSNumber rather than treating Int1
        // as a zero-duration fade with an immediate completion receipt.
        guard let value=body[key] as? NSNumber,
              CFGetTypeID(value) != CFBooleanGetTypeID(),value.doubleValue.isFinite else{return 0}
        return value.doubleValue
    }
    private func failure(_ message: String) -> NSError { NSError(domain: "JimiNativeMusic", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}

#if !NATIVE_MUSIC_DIRECT_ONLY
@MainActor
extension JimiNativeMusic: WKScriptMessageHandlerWithReply {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.protocol == "app",
              let body = message.body as? [String: Any], let id = body["id"] as? String,
              id.hasPrefix("soundtrack-"), id.count < 64, let op = body["op"] as? String else {
            replyHandler(nil, "Invalid native music request"); return
        }
        perform(id: id, op: op, body: body, replyHandler: replyHandler)
    }

}
#endif
