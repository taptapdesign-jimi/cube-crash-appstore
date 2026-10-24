import Foundation
import AVFAudio

nonisolated struct NativeSelectedAudioMetadata {
 let relativePath:String,estimatedDecodedBytes:Int,duration:Double
}
/// One original prepared AVAudioPlayer transfers to the existing Native voice
/// transport; it never plays during preload. MainActor owns logical voices;
/// the existing serial SFX queue owns every player operation and final release.
nonisolated final class NativeSelectedAudioFile:@unchecked Sendable {
 typealias Completion=@MainActor @Sendable (Bool,String?)->Void
 /// The lock protects tiny logical admission only; AV calls never hold it.
 final class ControlLease:@unchecked Sendable {
  private let lock=NSLock()
  private var retired=false,claimed=false,gainQueued=false
  private var latestGain:Double?
  func retire(){lock.withLock{retired=true;latestGain=nil}}
  func claim()->Bool{lock.withLock{guard !retired,!claimed else{return false};claimed=true;return true}}
  var current:Bool{lock.withLock{!retired}}
  func queueGain(_ gain:Double)->Bool{lock.withLock{guard !retired else{return false};latestGain=gain;guard !gainQueued else{return false};gainQueued=true;return true}}
  func takeGain()->Double?{lock.withLock{gainQueued=false;let value=latestGain;latestGain=nil;return retired ? nil:value}}
 }
 struct Operations:Sendable {
  let start:@Sendable (Double,Double,@escaping Completion)->Bool
  let stop:@Sendable ()->Void
  let gain:@Sendable (Double,Double)->Void
  let reset:@Sendable ()->Bool
  var state:@Sendable ()->(Bool,Double) = {(false,0)}
  var looping:@Sendable (Bool)->Void = {_ in}
 }
 private final class Delegate:NSObject,AVAudioPlayerDelegate {
  let completion:Completion
  init(_ completion:@escaping Completion){self.completion=completion}
  func audioPlayerDidFinishPlaying(_ player:AVAudioPlayer,successfully flag:Bool){Task{@MainActor [completion] in completion(flag,nil)}}
  func audioPlayerDecodeErrorDidOccur(_ player:AVAudioPlayer,error:Error?){let message=error?.localizedDescription ?? "Authored SFX decode failed";Task{@MainActor [completion] in completion(false,message)}}
 }
 private final class PlayerBox:@unchecked Sendable {
  let player:AVAudioPlayer
  var delegate:Delegate?
  init(_ player:AVAudioPlayer){self.player=player}
 }
 let estimatedDecodedBytes:Int,source:String,duration:Double
 private let io:DispatchQueue,operations:Operations
 private var bound:ControlLease? // Serial queue only.
 init(source:String,bytes:Int,duration:Double,queue:DispatchQueue,operations:Operations){self.source=source;estimatedDecodedBytes=bytes;self.duration=duration;io=queue;self.operations=operations}
 func start(_ lease:ControlLease,rate:Double,gain:Double,looping:Bool=false,completion:@escaping Completion,started:@escaping @MainActor @Sendable (Bool)->Void){
  io.async{[self] in
   guard lease.claim(),bound==nil else{Task{@MainActor in started(false)};return}
   bound=lease
   operations.looping(looping)
   let success=operations.start(rate,gain,completion)
   // Main retirement can overlap an already claimed AudioQueue call. Finish
   // it, then stop the same lease before delivering any successful start.
   if !lease.current {operations.stop();bound=nil}
   Task{@MainActor in started(success && lease.current)}
  }
 }
 func stop(_ lease:ControlLease,done:@escaping @MainActor @Sendable (Bool)->Void){
  lease.retire()
  io.async{[self] in
   guard bound==nil || bound===lease else{Task{@MainActor in done(false)};return}
   if bound===lease {operations.stop();bound=nil}
   Task{@MainActor in done(true)}
  }
 }
 func setGain(_ gain:Double,lease:ControlLease){
  guard lease.queueGain(gain) else{return}
  io.async{[self] in guard let value=lease.takeGain(),bound===lease,lease.current else{return};operations.gain(value,0)}
 }
 func fadeOut(duration:Double,lease:ControlLease){io.async{[self] in guard bound===lease,lease.current else{return};operations.gain(0,duration)}}
 func reset(done:@escaping @MainActor @Sendable (Bool)->Void){io.async{[self] in let success=bound==nil && operations.reset();Task{@MainActor in done(success)}}}
 func inspectPreparedState(done:@escaping @MainActor @Sendable (Bool,Double)->Void){io.async{[self] in let state=operations.state();Task{@MainActor in done(state.0,state.1)}}}
 deinit {let retired=operations;io.async{retired.stop()}} // Last player release occurs on its queue.
 static func canonicalPath(_ source:String)->String? {
  guard let decoded=source.removingPercentEncoding else{return nil}
  let relative=decoded.hasPrefix("./") ? String(decoded.dropFirst(2)):decoded
  guard relative.hasPrefix("assets/sound/"),!relative.split(separator:"/").contains(".."),!relative.contains("\\"),!relative.hasPrefix("/") else{return nil}
  return relative
 }
 static func inspect(root:URL,source:String)->NativeSelectedAudioMetadata? {
  guard let relative=canonicalPath(source),let file=try? AVAudioFile(forReading:root.appendingPathComponent(relative)) else{return nil}
  let estimate=Double(file.length)*Double(file.processingFormat.channelCount)*4
  guard estimate.isFinite,estimate>=0,estimate<=Double(Int.max),file.processingFormat.sampleRate>0 else{return nil}
  return .init(relativePath:relative,estimatedDecodedBytes:Int(estimate),duration:Double(file.length)/file.processingFormat.sampleRate)
 }
 static func decode(root:URL,source:String,maximumBytes:Int=28*1024*1024,queue:DispatchQueue=DispatchQueue(label:"com.taptapdesign.stacktosix.selected-sfx-test"))->NativeSelectedAudioFile? {
  guard let metadata=inspect(root:root,source:source),metadata.estimatedDecodedBytes<=maximumBytes,
        let player=try? AVAudioPlayer(contentsOf:root.appendingPathComponent(metadata.relativePath)),player.prepareToPlay() else{return nil}
  let box=PlayerBox(player)
  let operations=Operations(start:{rate,gain,completion in
   let delegate=Delegate(completion);box.delegate=delegate;box.player.delegate=delegate
   box.player.enableRate=true;box.player.rate=Float(rate);box.player.volume=Float(gain)
   return box.player.play()
  },stop:{box.player.delegate=nil;box.delegate=nil;box.player.stop()},gain:{gain,duration in
   if duration>0 {box.player.setVolume(Float(gain),fadeDuration:duration)}else{box.player.volume=Float(gain)}
  },reset:{box.player.currentTime=0;return box.player.prepareToPlay()},state:{(box.player.isPlaying,box.player.currentTime)},looping:{box.player.numberOfLoops=$0 ? -1:0})
  return NativeSelectedAudioFile(source:source,bytes:metadata.estimatedDecodedBytes,duration:player.duration,queue:queue,operations:operations)
 }
}
@MainActor enum NativeSelectedAudioNativePreparation {
 static func make(root:URL)->NativeSelectedAudioPreparation<NativeSelectedAudioFile> {
  let io=DispatchQueue(label:"com.taptapdesign.stacktosix.selected-sfx",qos:.userInitiated)
  return NativeSelectedAudioPreparation(concurrency:2,recycle:{loaded,done in
   let asset=loaded.asset,bytes=loaded.bytes
   asset.reset{prepared in done(prepared ? .init(asset:asset,bytes:bytes):nil)}
  },load:{source,done in
   io.async {
    let decoded=NativeSelectedAudioFile.decode(root:root,source:source,queue:io)
    Task{@MainActor in done(decoded.map{.init(asset:$0,bytes:$0.estimatedDecodedBytes)})}
   }
  })
 }
}
