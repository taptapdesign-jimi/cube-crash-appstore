import Foundation

/// Actual native node creation/borrow is a separate receipt from selected asset
/// preparation. No texture, timer, motion, input, save or audio owner here.
@MainActor final class NativeMeterHiddenOpenOwner<Node:AnyObject> {
 nonisolated struct Capture:Hashable {let id:String,generation:UInt64,spawnToken:UInt64,column:Int,row:Int}
 nonisolated struct Selection:Equatable {let special:String,variant:String?}
 @MainActor struct Lease {
  let node:Node,id:String
  /// Native Scene owns node epoch; stale cleanup may never retire its new borrower.
  let isOwned:()->Bool,holder:()->NativeMeterHiddenHolder,retire:()->Void
 }
 enum Outcome {case created(Lease,reused:Bool),refused,creationFailed,retired}
 struct Hooks {
  let readGrid:(Capture)->Lease?
  let createPlaceholder:(Capture)->Lease?
  let unlockAndBind:(Lease)->Void,resetNormal:(Lease)->Void
  let deferIdle:(Lease,Bool)->Void,setCoreValue:(Lease,String)->Void
  let applyVariant:(Lease,Selection)->Void,hide:(Lease)->Void,activateIdle:(Lease)->Void
  /// Asynchronous actual-created receipt dispatch, not delay/readiness guessing.
  let enqueue:(@escaping @MainActor ()->Void)->Void
  let generationCurrent:(Capture)->Bool
 }
 private struct Operation {
  let selection:Selection,done:(Outcome)->Void
  var lease:Lease?,reused=false,receiptDelivered=false,prepared=false,landed=false
 }
 private let hooks:Hooks
 private var operations:[Capture:Operation]=[:],disposed=false
 init(hooks:Hooks){self.hooks=hooks}
 var retainedNodeIDs:Set<String> {Set(Array(operations.values).compactMap{$0.lease}.filter{$0.isOwned()}.map(\.id))}
 @discardableResult func open(capture:Capture,selection:Selection,forceFresh:Bool=false,done:@escaping(Outcome)->Void)->Bool {
  guard !disposed,operations[capture]==nil,hooks.generationCurrent(capture),selection.special.hasPrefix("wild") else{return false}
  operations[capture]=Operation(selection:selection,done:done)
  let first=hooks.readGrid(capture)
  guard captureCurrent(capture) else{return true}
  guard NativeMeterHiddenOpenPolicy.decide(holder:first?.holder(),forceFresh:forceFresh) != .refuse else{enqueue(capture,.refused);return true}
  // Source rereads the actual cell before reusing/creating, independently of the
  // first holder or the Core will-open request's former expected-holder hint.
  var current=hooks.readGrid(capture)
  guard captureCurrent(capture) else{return true}
  let decision=NativeMeterHiddenOpenPolicy.decide(holder:current?.holder(),forceFresh:forceFresh)
  guard decision != .refuse else{enqueue(capture,.refused);return true}
  let reused:Bool
  switch decision {
  case .replace:current?.retire();current=nil;reused=false
  case .reuse:reused=true
  case .create:current=nil;reused=false
  case .refuse:preconditionFailure("Admission already checked")
  }
  guard captureCurrent(capture) else{return true}
  let lease=current ?? hooks.createPlaceholder(capture)
  guard let lease else{enqueue(capture,.creationFailed);return true}
  guard var operation=operations[capture],!disposed,hooks.generationCurrent(capture),lease.isOwned() else {
   if lease.isOwned(){lease.retire()};return true
  }
  operation.lease=lease;operation.reused=reused;operations[capture]=operation
  hooks.unlockAndBind(lease)
  guard valid(capture,lease) else{enqueue(capture,.refused);return true}
  hooks.resetNormal(lease)
  guard valid(capture,lease) else{enqueue(capture,.refused);return true}
  // BEFORE setValue/rebuild: an initial core Wild or later selected variant can
  // paint its static original face without allocating its idle/media phase.
  hooks.deferIdle(lease,true)
  guard valid(capture,lease),!lease.holder().destroyed else{enqueue(capture,.refused);return true}
  hooks.setCoreValue(lease,selection.special)
  guard valid(capture,lease),!lease.holder().destroyed else{enqueue(capture,.refused);return true}
  hooks.hide(lease)
  enqueue(capture,.created(lease,reused:reused));return true
 }
 /// Called by real Core post-open first-cancellation check, before charge.
 /// No selected variant/idle/media allocation occurs simply from will-open.
 @discardableResult func prepareCommitted(capture:Capture,tileID:String)->Bool {
  guard var op=operations[capture],op.receiptDelivered,!op.prepared,let lease=op.lease,lease.id==tileID,valid(capture,lease) else{return false}
  op.prepared=true;operations[capture]=op;hooks.applyVariant(lease,op.selection);return valid(capture,lease)
 }
 /// Caller supplies Source isSpawnCancelled check at the actual landed callback.
 /// Warmup success/PNG readiness/render ticks never invoke this transition.
 @discardableResult func landed(capture:Capture,allowsSourceIdle:Bool)->Bool {
  guard allowsSourceIdle,var op=operations[capture],op.prepared,!op.landed,let lease=op.lease,valid(capture,lease) else{return false}
  op.landed=true;operations[capture]=op;hooks.deferIdle(lease,false)
  guard valid(capture,lease) else{return false};hooks.activateIdle(lease);return true
 }
 /// Actual board handoff follows the real landed receipt; an early caller
 /// cannot silently discard the pending created callback or idle continuation.
 @discardableResult func releaseToScene(_ capture:Capture)->Bool {
  guard let op=operations[capture],op.receiptDelivered,op.landed,let lease=op.lease,valid(capture,lease) else{return false}
  operations.removeValue(forKey:capture);return true
 }
 func retire(_ capture:Capture) {
  guard let op=operations.removeValue(forKey:capture) else{return}
  if let lease=op.lease,lease.isOwned(){lease.retire()}
  if !op.receiptDelivered {op.done(.retired)}
 }
 func dispose() {guard !disposed else{return};disposed=true;for capture in Array(operations.keys){retire(capture)}}
 private func captureCurrent(_ capture:Capture)->Bool {
  guard !disposed,operations[capture] != nil else{return false}
  guard hooks.generationCurrent(capture) else{retire(capture);return false}
  return true
 }
 private func valid(_ capture:Capture,_ lease:Lease)->Bool { !disposed && operations[capture]?.lease?.node === lease.node && hooks.generationCurrent(capture) && lease.isOwned() && !lease.holder().destroyed }
 private func enqueue(_ capture:Capture,_ outcome:Outcome) {
  hooks.enqueue{[weak self] in
   guard let self,var op=self.operations[capture],!op.receiptDelivered else{return}
   guard !self.disposed,self.hooks.generationCurrent(capture) else{self.retire(capture);return}
   if case .created(let lease,_)=outcome,!self.valid(capture,lease){self.retire(capture);return}
   op.receiptDelivered=true;self.operations[capture]=op;op.done(outcome)
   // Failed open has no newly-admitted wild node to retain; Source's existing
   // destroyed holder cleanup remains with its original owner.
   if case .created=outcome {} else {self.operations.removeValue(forKey:capture)}
  }
 }
}
