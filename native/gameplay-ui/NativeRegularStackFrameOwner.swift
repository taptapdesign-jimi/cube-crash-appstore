import Foundation

@MainActor protocol NativeRegularStackFrameHost:AnyObject {
 var sourceTileID:String {get}
 var sourceGeneration:UInt64 {get}
 var sourceAlive:Bool {get}
 var sourceValue:Int {get set}
 var sourceAlpha:Double {get set}
 var sourceLocked:Bool {get}
 var sourceStackDepth:Int {get set}
 var sourceMaxStackDepth:Int {get set}
 var sourceBaseScaleX:Double {get}
 var sourceBaseScaleY:Double {get}
 func prepareSourceStackSkin(_ skin:NativeRegularStackLayout.Skin)
 var sourceBaseAnchorX:Double {get}
 var sourceBaseAnchorY:Double {get}
 var sourceBaseX:Double {get}
 var sourceBaseY:Double {get}
 func installSourceStackFace(_ layout:NativeRegularStackLayout)
}
extension NativeRegularStackFrameHost {
 func prepareSourceStackSkin(_ skin:NativeRegularStackLayout.Skin){}
 var sourceBaseAnchorX:Double {0.5}
 var sourceBaseAnchorY:Double {0.5}
 var sourceBaseX:Double {0}
 var sourceBaseY:Double {0}
}
struct NativeRegularStackFrameReceipt:Hashable {let id:UInt64,tileID:String,generation:UInt64}

/// No clock/RAF emulation/activity label. APP must supply an actual one-shot
/// source-frame callback transport; globalTimeline pause is not its pause domain.
@MainActor final class NativeRegularStackFrameOwner {
 typealias Schedule = (NativeRegularStackFrameReceipt,@escaping @MainActor ()->Void)->Void
 private struct Entry {let receipt:NativeRegularStackFrameReceipt,value:Int,add:Int}
 private weak var host:(any NativeRegularStackFrameHost)?
 private let schedule:Schedule,random:()->Double,available:Set<NativeRegularStackLayout.Skin>
 private var entries:[UInt64:Entry]=[:],sequence:UInt64=0,disposed=false
 var pendingReceipts:[NativeRegularStackFrameReceipt] {entries.values.map(\.receipt).sorted{$0.id<$1.id}}
 init(host:any NativeRegularStackFrameHost,schedule:@escaping Schedule,available:Set<NativeRegularStackLayout.Skin>=Set(NativeRegularStackLayout.Skin.allCases),random:@escaping()->Double){self.host=host;self.schedule=schedule;self.available=available;self.random=random}
 @discardableResult func setValue(_ value:Int,addStack:Int)->NativeRegularStackFrameReceipt? {
  guard !disposed,let host,host.sourceAlive else{return nil}
  host.sourceValue=value
  guard !disposed,host.sourceAlive else{return nil}
  if !host.sourceLocked {host.sourceAlpha=1}
  guard !disposed,host.sourceAlive else{return nil}
  sequence+=1;let receipt=NativeRegularStackFrameReceipt(id:sequence,tileID:host.sourceTileID,generation:host.sourceGeneration)
  entries[receipt.id]=Entry(receipt:receipt,value:value,add:addStack)
  schedule(receipt,{[weak self] in self?.deliver(receipt)})
  return receipt
 }
 private func deliver(_ receipt:NativeRegularStackFrameReceipt) {
  guard !disposed,let entry=entries.removeValue(forKey:receipt.id),entry.receipt==receipt,let host,host.sourceAlive,host.sourceTileID==receipt.tileID,host.sourceGeneration==receipt.generation else{return}
  host.sourceValue=entry.value
  guard current(host,receipt) else{return}
  let skin=NativeRegularStackLayout.chooseSkin(available:available,random:random)
  guard current(host,receipt) else{return}
  host.prepareSourceStackSkin(skin)
  guard current(host,receipt) else{return}
  if entry.add != 0 {
   host.sourceStackDepth=min(4,max(1,host.sourceStackDepth)+entry.add)
   host.sourceMaxStackDepth=max(host.sourceMaxStackDepth,host.sourceStackDepth)
  }
  let layout=NativeRegularStackLayout.captureLayers(depth:max(1,host.sourceStackDepth),skin:skin,baseX:host.sourceBaseX,baseY:host.sourceBaseY,baseScaleX:host.sourceBaseScaleX,baseScaleY:host.sourceBaseScaleY,anchorX:host.sourceBaseAnchorX,anchorY:host.sourceBaseAnchorY,random:random)
  guard current(host,receipt) else{return}
  host.installSourceStackFace(layout)
 }
 private func current(_ captured:any NativeRegularStackFrameHost,_ receipt:NativeRegularStackFrameReceipt)->Bool {!disposed && host === captured && captured.sourceAlive && captured.sourceTileID==receipt.tileID && captured.sourceGeneration==receipt.generation}
 func cancel(_ receipt:NativeRegularStackFrameReceipt){if entries[receipt.id]?.receipt==receipt {entries.removeValue(forKey:receipt.id)}}
 func dispose(){guard !disposed else{return};disposed=true;entries=[:];host=nil}
 isolated deinit {dispose()}
}
