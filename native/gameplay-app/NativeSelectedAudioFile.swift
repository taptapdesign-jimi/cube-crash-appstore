import Foundation
import AVFAudio

nonisolated struct NativeSelectedAudioMetadata {
 let relativePath:String,estimatedDecodedBytes:Int,duration:Double
}
/// One original prepared AVAudioPlayer transfers to the existing Native voice
/// transport; it never plays during preload. Wrapper crosses the serial decode
/// queue once, then is used only by its MainActor owner.
nonisolated final class NativeSelectedAudioFile:@unchecked Sendable {
 let player:AVAudioPlayer,estimatedDecodedBytes:Int,source:String
 private init(player:AVAudioPlayer,bytes:Int,source:String) {self.player=player;estimatedDecodedBytes=bytes;self.source=source}
 static func canonicalPath(_ source:String)->String? {
  guard let decoded=source.removingPercentEncoding else{return nil}
  let relative=decoded.hasPrefix("./") ? String(decoded.dropFirst(2)):decoded
  guard relative.hasPrefix("assets/sound/"),!relative.split(separator:"/").contains(".."),!relative.contains("\\"),!relative.hasPrefix("/") else{return nil}
  return relative
 }
 /// Original file validation is separate from an actual native preload receipt.
 static func inspect(root:URL,source:String)->NativeSelectedAudioMetadata? {
  guard let relative=canonicalPath(source),let file=try? AVAudioFile(forReading:root.appendingPathComponent(relative)) else{return nil}
  let estimate=Double(file.length)*Double(file.processingFormat.channelCount)*4
  guard estimate.isFinite,estimate>=0,estimate<=Double(Int.max),file.processingFormat.sampleRate>0 else{return nil}
  return .init(relativePath:relative,estimatedDecodedBytes:Int(estimate),duration:Double(file.length)/file.processingFormat.sampleRate)
 }
 static func decode(root:URL,source:String,maximumBytes:Int=28*1024*1024)->NativeSelectedAudioFile? {
  guard let metadata=inspect(root:root,source:source),metadata.estimatedDecodedBytes<=maximumBytes,
        let player=try? AVAudioPlayer(contentsOf:root.appendingPathComponent(metadata.relativePath)),player.prepareToPlay() else{return nil}
  return NativeSelectedAudioFile(player:player,bytes:metadata.estimatedDecodedBytes,source:source)
 }
}
@MainActor enum NativeSelectedAudioNativePreparation {
 static func make(root:URL)->NativeSelectedAudioPreparation<NativeSelectedAudioFile> {
  let io=DispatchQueue(label:"com.taptapdesign.stacktosix.selected-sfx",qos:.userInitiated)
  return NativeSelectedAudioPreparation(concurrency:2,load:{source,done in
   io.async {
    let decoded=NativeSelectedAudioFile.decode(root:root,source:source)
    Task{@MainActor in done(decoded.map{.init(asset:$0,bytes:$0.estimatedDecodedBytes)})}
   }
  })
 }
}
