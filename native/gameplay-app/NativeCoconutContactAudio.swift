import Foundation
import AVFAudio

/// Coconut's frequent mini2 contacts alone use a shared PCM buffer and fixed
/// player nodes. No AVAudioPlayer natural-finish callback enters the main loop.
@MainActor final class NativeCoconutContactAudio {
    nonisolated static let source="assets/sound/mini explozije/mini2.mp3"
    nonisolated static let capacity=32
    private struct Voice {
        let token:UUID,lease:NativeSelectedAudioFile.ControlLease
        let completion:(NativeAudioCompletion)->Void
    }
    private let worker:Worker
    private var lifetime=NativeSelectedAudioFile.ControlLease()
    private var voices:[String:Voice]=[:]
    private var disposed=false
    var count:Int {voices.count}
    init(root:URL){worker=Worker(root:root)}
    static func accepts(_ cue:NativeAudioCue)->Bool {
        cue.voice.hasPrefix("coconut-contact-") && NativeSelectedAudioFile.canonicalPath(cue.source)==source &&
        cue.rate==1 && cue.delay==0 && cue.stopAfter==nil && cue.fadeOut==0 && !cue.looping
    }
    struct Snapshot:Sendable {let nodes:Int,active:Int,decodedBuffers:Int,running:Bool}
    func snapshot()async->Snapshot{await withCheckedContinuation{worker.snapshot($0)}}
    func prepare(){guard !disposed else{return};worker.prepare(lifetime)}
    func play(_ cue:NativeAudioCue,completion:@escaping(NativeAudioCompletion)->Void){
        guard !disposed,Self.accepts(cue) else{completion(.unavailable);return}
        stop([cue.voice])
        guard count<Self.capacity else{completion(.unavailable);return}
        let token=UUID(),lease=NativeSelectedAudioFile.ControlLease()
        voices[cue.voice]=Voice(token:token,lease:lease,completion:completion)
        worker.play(token:token,lifetime:lifetime,lease:lease,gain:cue.gain){[weak self] success in
            guard let self,let voice=self.voices[cue.voice],voice.token==token else{return}
            self.voices.removeValue(forKey:cue.voice);voice.lease.retire()
            voice.completion(success ? .ended:.unavailable)
        }
    }
    func stop(_ ids:Set<String>){
        for id in ids {
            guard let voice=voices.removeValue(forKey:id) else{continue}
            voice.lease.retire();worker.stop(voice.token);voice.completion(.stopped)
        }
    }
    func stopAll(){
        lifetime.retire();lifetime=NativeSelectedAudioFile.ControlLease()
        let old=Array(voices.values);voices.removeAll()
        old.forEach{$0.lease.retire()};worker.stopAll()
        old.forEach{$0.completion(.stopped)}
    }
    func dispose(){guard !disposed else{return};disposed=true;stopAll();lifetime.retire();worker.dispose()}
    isolated deinit {lifetime.retire();voices.values.forEach{$0.lease.retire()};worker.dispose()}

    /// Every engine/node/file operation and final release stays on this queue.
    /// Queued obsolete work checks lifetime BEFORE decoding/allocating resources.
    nonisolated private final class Worker:@unchecked Sendable {
        private struct Slot {let node:AVAudioPlayerNode;var token:UUID?}
        private let queue=DispatchQueue(label:"com.taptapdesign.stacktosix.coconut-contact",qos:.userInitiated)
        private let root:URL
        private var engine:AVAudioEngine?,buffer:AVAudioPCMBuffer?,slots:[Slot]=[]
        private var disposed=false
        init(root:URL){self.root=root}
        private func load()->Bool {
            guard !disposed else{return false}
            if buffer != nil{return true}
            guard let file=try? AVAudioFile(forReading:root.appendingPathComponent(NativeCoconutContactAudio.source)),
                  file.length>0,file.length<=Int64(AVAudioFrameCount.max),
                  Double(file.length)*Double(file.processingFormat.channelCount)*4<=1_048_576,
                  let pcm=AVAudioPCMBuffer(pcmFormat:file.processingFormat,frameCapacity:AVAudioFrameCount(file.length)) else{return false}
            do{try file.read(into:pcm)}catch{return false}
            let engine=AVAudioEngine()
            for _ in 0..<NativeCoconutContactAudio.capacity {
                let node=AVAudioPlayerNode();engine.attach(node);engine.connect(node,to:engine.mainMixerNode,format:pcm.format)
                slots.append(Slot(node:node))
            }
            self.engine=engine;buffer=pcm;return true
        }
        func snapshot(_ receipt:CheckedContinuation<Snapshot,Never>){queue.async{[self] in receipt.resume(returning:Snapshot(nodes:slots.count,active:slots.filter{$0.token != nil}.count,decodedBuffers:buffer==nil ? 0:1,running:engine?.isRunning ?? false))}}
        func prepare(_ lifetime:NativeSelectedAudioFile.ControlLease){queue.async{[self] in
            guard lifetime.current,!disposed else{return};_=load()
        }}
        func play(token:UUID,lifetime:NativeSelectedAudioFile.ControlLease,lease:NativeSelectedAudioFile.ControlLease,gain:Double,done:@escaping @MainActor @Sendable(Bool)->Void){queue.async{[self] in
            guard lifetime.current,lease.current,!disposed else{return}
            guard load(),let engine,let buffer,let index=slots.firstIndex(where:{$0.token==nil}) else{Task{@MainActor in done(false)};return}
            guard lifetime.current,lease.current else{return}
            do{if !engine.isRunning{try engine.start()}}catch{Task{@MainActor in done(false)};return}
            guard lifetime.current,lease.current else{pauseIfFinished();return}
            slots[index].token=token
            let node=slots[index].node;node.volume=Float(max(0,min(1,gain)))
            node.scheduleBuffer(buffer,completionCallbackType:.dataPlayedBack){[weak self] _ in
                guard let self else{return}
                self.queue.async{[self] in
                    guard !disposed,slots.indices.contains(index),slots[index].token==token else{return}
                    slots[index].token=nil;slots[index].node.stop();pauseIfFinished()
                    guard lease.current else{return};Task{@MainActor in done(true)}
                }
            }
            node.play()
            if !lease.current{node.stop();slots[index].token=nil;pauseIfFinished()}
        }}
        private func pauseIfFinished(){if slots.allSatisfy({$0.token==nil}){engine?.pause()}}
        func stop(_ token:UUID){queue.async{[self] in
            guard let i=slots.firstIndex(where:{$0.token==token}) else{return}
            slots[i].token=nil;slots[i].node.stop();pauseIfFinished()
        }}
        func stopAll(){queue.async{[self] in stopNow()}}
        private func stopNow(){for i in slots.indices{slots[i].token=nil;slots[i].node.stop()};engine?.pause()}
        func dispose(){queue.async{[self] in
            guard !disposed else{return};disposed=true;stopNow();engine?.stop();slots.removeAll();buffer=nil;engine=nil
        }}
    }
}
