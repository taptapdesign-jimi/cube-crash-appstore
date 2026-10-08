import Foundation

/// Only the literal selected meter warmup paths, not every finale dependency.
nonisolated struct NativeMeterSelectedWarmupPlan:Equatable,Sendable {
 let selection:String
 let preOpen:[NativeMeterWarmupAsset]
 let committed:[NativeMeterWarmupAsset]
}
nonisolated struct NativeMeterWarmupAsset:Hashable,Sendable {
 let candidates:[String]
 init(_ candidates:[String]) {self.candidates=candidates}
 var key:String {candidates.joined(separator:"|")}
}

/// Clockless selected-family promise bridge. Decode/upload belongs to the
/// injected canonical native resource owner; no motion/input/save lease inferred.
@MainActor final class NativeMeterSelectedFinaleWarmup<Asset> {
 nonisolated struct Capture:Hashable,Sendable {let token:UInt64;let generation:UInt64;let selection:String}
 nonisolated enum Outcome:Equatable,Sendable {case settled(unavailable:[String]);case retired}
 typealias Load=(NativeMeterWarmupAsset,@escaping(Asset?)->Void)->Void
 private struct Consumer {let capture:Capture;let current:()->Bool;let preOpen:Bool}
 private struct Item {let spec:NativeMeterWarmupAsset;var consumers:[Consumer]}
 private struct Owner {
  let plan:NativeMeterSelectedWarmupPlan;let current:()->Bool
  var prePending:Set<String>;var postPending:Set<String>=[]
  var missing:Set<String>=[];var tileID:String?
  var callbacks:[(Outcome)->Void]=[]
 }
 private var owners:[Capture:Owner]=[:],pending:[String:Item]=[:],queue:[String]=[]
 private var prepared:[String:Asset]=[:],active=0,disposed=false,draining=false
 private let load:Load,limit:Int
 private(set) var maximumActive=0
 var onPrepareSelectedAudio:((Capture,String)->Void)?
 init(concurrency:Int=4,load:@escaping Load) {limit=max(1,concurrency);self.load=load}
 @discardableResult func beginBeforeOpen(plan:NativeMeterSelectedWarmupPlan,capture:Capture,
                                      isCurrent:@escaping()->Bool)->Bool {
  guard !disposed,owners[capture]==nil,capture.selection==plan.selection,isCurrent() else{return false}
  owners[capture]=Owner(plan:plan,current:isCurrent,prePending:Set(plan.preOpen.map(\.key)))
  enqueue(plan.preOpen,capture:capture,preOpen:true);return true
 }
 /// Capture validity is separate from Source Juice visibility interest.
 /// Hidden Juice skips queued assets but its Promise still settles.
 /// Caller invokes only after successful openAtCell AND captured-token recheck.
 /// Original audio warmup is fire-and-forget; texture Promise remains separate.
 @discardableResult func committed(capture:Capture,tileID:String,texturesCurrent:@escaping()->Bool={true})->Bool {
  guard var owner=owners[capture],owner.tileID==nil,owner.current(),!disposed else{return false}
  owner.tileID=tileID;owner.postPending=Set(owner.plan.committed.map(\.key));owners[capture]=owner
  onPrepareSelectedAudio?(capture,tileID)
  // Reentrant cancellation from the authored audio owner cannot start stale work.
  guard owners[capture] != nil else{return false}
  enqueue(owner.plan.committed,capture:capture,preOpen:false,texturesCurrent:texturesCurrent);return true
 }
 /// Failure settles the Source warmup Promise; merge-time readiness may retry.
 /// This is not a certificate that every native finale resource is available.
 func whenSelectedSettled(capture:Capture,completion:@escaping(Outcome)->Void) {
  guard var owner=owners[capture],!disposed else{completion(.retired);return}
  owner.callbacks.append(completion);owners[capture]=owner;deliverIfReady(capture)
 }
 func cancel(_ capture:Capture) {
  guard let owner=owners.removeValue(forKey:capture) else{return}
  owner.callbacks.forEach{$0(.retired)}
  drain()
 }
 func release(_ capture:Capture) {cancel(capture)}
 func dispose() {
  guard !disposed else{return};disposed=true
  let old=owners.values;owners.removeAll();queue=[];pending.removeAll();prepared.removeAll()
  old.forEach{$0.callbacks.forEach{$0(.retired)}}
 }
 private func enqueue(_ specs:[NativeMeterWarmupAsset],capture:Capture,preOpen:Bool,texturesCurrent:@escaping()->Bool={true}) {
  for spec in specs {
   guard let owner=owners[capture],owner.current() else{cancel(capture);return}
   if prepared[spec.key] != nil {settle(spec.key,asset:prepared[spec.key],captures:[capture]);continue}
   let consumer=Consumer(capture:capture,current:{owner.current() && texturesCurrent()},preOpen:preOpen)
   if pending[spec.key] != nil {pending[spec.key]?.consumers.append(consumer)}
   else {pending[spec.key]=Item(spec:spec,consumers:[consumer]);queue.append(spec.key)}
  }
  drain();deliverIfReady(capture)
 }
 private func drain() {
  guard !disposed,!draining else{return};draining=true;defer{draining=false}
  while active<limit,!queue.isEmpty {
   let key=queue.removeFirst()
   guard let item=pending[key] else{continue}
   // Source preOpen TNT cache requests have no isCurrent predicate.
   // Cancellation retires the borrower, not this finite selected cache fill.
   let current=item.consumers.filter{$0.preOpen || (owners[$0.capture] != nil && $0.current())}
   if current.isEmpty {
    pending.removeValue(forKey:key)
    settle(key,asset:nil,captures:item.consumers.map(\.capture));continue
   }
   active += 1;maximumActive=max(maximumActive,active)
   // Source loader keeps an in-flight request alive for every still-current
   // consumer. One canceled waiter never kills another consumer's asset load.
   var completed=false
   load(item.spec) { [weak self] asset in
    guard !completed else{return};completed=true
    guard let self else{return}
    self.active-=1
    let consumers=self.pending.removeValue(forKey:key)?.consumers ?? []
    if !self.disposed,let asset {self.prepared[key]=asset}
    self.settle(key,asset:asset,captures:consumers.map(\.capture));self.drain()
   }
  }
 }
 private func settle(_ key:String,asset:Asset?,captures:[Capture]) {
  var seen:Set<Capture>=[]
  for capture in captures where seen.insert(capture).inserted {
   guard var owner=owners[capture] else{continue}
   owner.prePending.remove(key);owner.postPending.remove(key)
   if asset==nil {owner.missing.insert(key)}
   owners[capture]=owner;deliverIfReady(capture)
  }
 }
 private func deliverIfReady(_ capture:Capture) {
  guard var owner=owners[capture] else{return}
  if !owner.current(){cancel(capture);return}
  guard owner.tileID != nil,owner.prePending.isEmpty,owner.postPending.isEmpty else{return}
  let callbacks=owner.callbacks;owner.callbacks=[];owners[capture]=owner
  for callback in callbacks {
   guard let current=owners[capture],current.current(),!disposed else{callback(.retired);continue}
   callback(.settled(unavailable:owner.missing.sorted()))
  }
 }
}
