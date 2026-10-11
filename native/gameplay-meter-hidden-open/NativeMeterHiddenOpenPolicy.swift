import Foundation

nonisolated struct NativeMeterHiddenHolder:Equatable,Codable {
 let id:String,value:Int,locked:Bool,destroyed:Bool
 var special:String?=nil,wildSpecial:String?=nil,registryArchetype:String?=nil,specialDiceArchetype:String?=nil
 var isWild=false,isWildFace=false
 var wildLike:Bool {[special,wildSpecial,registryArchetype,specialDiceArchetype].contains{$0?.hasPrefix("wild")==true} || isWild || isWildFace}
}
nonisolated enum NativeMeterHiddenOpenPolicy {
 enum Decision:Equatable {case create,reuse(String),replace(String),refuse}
 static func decide(holder:NativeMeterHiddenHolder?,forceFresh:Bool=false)->Decision {
  guard let holder,!holder.destroyed else{return .create}
  guard holder.value<=0,!holder.wildLike,holder.locked else{return .refuse}
  return forceFresh ? .replace(holder.id):.reuse(holder.id)
 }
}
