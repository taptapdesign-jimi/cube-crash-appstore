import Foundation

/// Exact bounded phase policy from animated-svg-phase-scheduler.ts. The board
/// ticker samples pending entries; there is no timer or process-global cache.
struct NativeArtworkPhaseScheduler {
    struct Entry {let id:Int,group:String,slot:Int;var plannedStart:Double,started:Bool}
    private var entries:[Int:Entry]=[:],cycles:[String:Double]=[:],sequence=0
    var count:Int {entries.count}
    func entry(_ id:Int)->Entry? {entries[id]}
    private func delay(peers:[Entry],now:Double,cycle:Double)->Double {
        guard !peers.isEmpty else {return 0}
        func positive(_ x:Double)->Double {(x.truncatingRemainder(dividingBy:cycle)+cycle).truncatingRemainder(dividingBy:cycle)}
        let separation=max(100,cycle/12),maxDelay=min(1000,cycle/2)
        var bestDelay=0.0,bestDistance = -Double.infinity
        var candidate=0.0
        while candidate<=maxDelay {
            let distance=peers.map {let direct=abs(positive(now+candidate-$0.plannedStart));return min(direct,cycle-direct)}.min()!
            if distance>bestDistance {bestDistance=distance;bestDelay=candidate}
            if distance+0.001>=separation {return candidate}
            candidate+=5
        }
        return bestDelay
    }
    mutating func reserve(group:String,cycleMilliseconds:Double,now:Double)->Int {
        precondition(!group.isEmpty && cycleMilliseconds.isFinite && cycleMilliseconds>0)
        if let cycle=cycles[group] {precondition(abs(cycle-cycleMilliseconds)<=0.001)}
        let peers=entries.values.filter {$0.group==group},occupied=Set(peers.map(\.slot))
        var slot=0;while occupied.contains(slot) {slot+=1}
        let wait=delay(peers:peers,now:now,cycle:cycleMilliseconds)
        sequence+=1;let id=sequence
        cycles[group]=cycleMilliseconds;entries[id]=Entry(id:id,group:group,slot:slot,plannedStart:now+wait,started:wait==0)
        return id
    }
    mutating func advance(_ id:Int,now:Double)->Bool {
        guard var entry=entries[id] else {return false}
        if entry.started {return true}
        guard now>=entry.plannedStart else {return false}
        if now-entry.plannedStart>50 {
            let peers=entries.values.filter {$0.group==entry.group && $0.id != id && ($0.started || $0.plannedStart>now)}
            let wait=delay(peers:peers,now:now,cycle:cycles[entry.group]!)
            if wait>0 {entry.plannedStart=now+wait;entries[id]=entry;return false}
        }
        entry.started=true;entry.plannedStart=now;entries[id]=entry;return true
    }
    mutating func advancePending(now:Double) {
        let due=entries.values.filter {!$0.started && $0.plannedStart<=now}.sorted {
            $0.plannedStart==$1.plannedStart ? $0.id<$1.id:$0.plannedStart<$1.plannedStart
        }
        for entry in due {_=advance(entry.id,now:now)}
    }
    mutating func release(_ id:Int) {
        guard let entry=entries.removeValue(forKey:id) else {return}
        if !entries.values.contains(where:{$0.group==entry.group}) {cycles.removeValue(forKey:entry.group)}
    }
    mutating func dispose() {entries.removeAll();cycles.removeAll()}
}
