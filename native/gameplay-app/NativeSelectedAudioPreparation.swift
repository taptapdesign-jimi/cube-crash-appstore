import Foundation

/// Resource preparation only: never creates a voice or audio clock. The semantic
/// NativeGameplayAudioOwner selects one exact committed original family.
@MainActor final class NativeSelectedAudioPreparation<Asset> {
 nonisolated struct Loaded {let asset:Asset,bytes:Int}
 nonisolated enum Outcome:Equatable {case settled(unavailable:[String]),retired}
 typealias Completion=@MainActor (Loaded?)->Void
 typealias Load=@MainActor (String,@escaping Completion)->Void
 private struct Request {let generation:UInt64;let selected:Set<String>;var pending:Set<String>,unavailable:Set<String>=[];let done:(Outcome)->Void}
 private struct Job {let source:String,epoch:UInt64;var consumers:Set<String>}
 private struct Entry {let loaded:Loaded;var used:UInt64}
 private var requests:[String:Request]=[:],jobs:[String:Job]=[:],queue:[String]=[]
 private var ready:[String:Entry]=[:],epoch:UInt64=1,generation:UInt64=1,use:UInt64=0
 private var active=0,disposed=false,enabled=true,foreground=true,draining=false
 private let load:Load,limit:Int,budget:Int
 private(set) var maximumActive=0,preparedBytes=0
 var preparedCount:Int {ready.count}
 init(concurrency:Int=4,budgetBytes:Int=28*1024*1024,load:@escaping Load) {limit=max(1,concurrency);budget=max(0,budgetBytes);self.load=load}
 func beginGeneration(_ value:UInt64) {guard !disposed,value != generation else{return};generation=value;cancelPending()}
 func setEnabled(_ value:Bool) {guard !disposed else{return};enabled=value;if !value {cancelPending();clearReady()}}
 func setForeground(_ value:Bool) {guard !disposed else{return};foreground=value;if !value {cancelPending()}}
 /// Sound OFF/current/visibility must be checked before any selected decode.
 @discardableResult func prepare(sources:[String],requestID:String,generation:UInt64,done:@escaping(Outcome)->Void={_ in})->Bool {
  guard !disposed,enabled,foreground,generation==self.generation,requests[requestID]==nil else{return false}
  var seen=Set<String>();let selected=sources.filter{seen.insert($0).inserted}
  requests[requestID]=Request(generation:generation,selected:Set(selected),pending:Set(selected),done:done)
  for source in selected {
   if ready[source] != nil {touch(source);requests[requestID]?.pending.remove(source);continue}
   if var job=jobs[source] {job.consumers.insert(requestID);jobs[source]=job}
   else {jobs[source]=Job(source:source,epoch:epoch,consumers:[requestID]);queue.append(source)}
  }
  deliver(requestID);drain();return true
 }
 /// Consumed prepared player joins the EXISTING one-shot voice owner. No duplicate
 /// prepared media remains parked after its real cue asks for this source.
 func take(_ source:String)->Asset? {
  guard !disposed,enabled,foreground,let entry=ready.removeValue(forKey:source) else{return nil}
  preparedBytes-=entry.loaded.bytes;return entry.loaded.asset
 }
 func cancelPending() {
  epoch &+= 1;queue=[];jobs.removeAll()
  let old=Array(requests.values);requests.removeAll();old.forEach{$0.done(.retired)}
 }
 func dispose() {guard !disposed else{return};disposed=true;cancelPending();clearReady()}
 private func clearReady() {ready.removeAll();preparedBytes=0}
 private func touch(_ source:String) {use &+= 1;ready[source]?.used=use}
 private func deliver(_ id:String) {
  guard let r=requests[id],r.pending.isEmpty else{return};requests.removeValue(forKey:id)
  r.done(.settled(unavailable:r.unavailable.sorted()))
 }
 private func drain() {
  guard !draining,!disposed,enabled,foreground else{return};draining=true;defer{draining=false}
  while active<limit,!queue.isEmpty {
   let source=queue.removeFirst();guard let job=jobs[source],job.epoch==epoch else{continue}
   active+=1;maximumActive=max(maximumActive,active);var replied=false
   load(source){[weak self] loaded in
    guard !replied else{return};replied=true
    guard let self else{return};self.active-=1
    guard !self.disposed,job.epoch==self.epoch,self.jobs[source]?.epoch==job.epoch else{self.drain();return}
    let current=self.jobs.removeValue(forKey:source)!
    var available=false
    if let loaded,loaded.bytes>=0,loaded.bytes<=self.budget {
     // Pending selected siblings remain protected. Evict only former idle entries.
     let protected=Set(self.requests.values.flatMap{$0.selected})
     for candidate in self.ready.sorted(by:{$0.value.used<$1.value.used}) where self.preparedBytes+loaded.bytes>self.budget && !protected.contains(candidate.key) {
      self.preparedBytes-=candidate.value.loaded.bytes;self.ready.removeValue(forKey:candidate.key)
     }
     if self.preparedBytes+loaded.bytes<=self.budget {self.use &+= 1;self.ready[source]=Entry(loaded:loaded,used:self.use);self.preparedBytes+=loaded.bytes;available=true}
    }
    // Reentrant caller retirement cannot turn the remaining consumers into stale
    // success; each request is consulted separately at its actual callback.
    for id in current.consumers.sorted() {
     guard var r=self.requests[id],r.generation==self.generation else{continue}
     r.pending.remove(source);if !available {r.unavailable.insert(source)};self.requests[id]=r;self.deliver(id)
    }
    self.drain()
   }
  }
 }
}
