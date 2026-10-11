import Foundation

/// Physical Source fields, read from the retained Node object, not a pending
/// plan, visibility count, or general NativeTile.isActive classification.
struct NativeSourceMagnetPhysicalTile: Codable, Equatable {
    enum Kind:String,Codable {case regular,star,juice,magnet,tnt}
    let id:String
    var value:Int,depth:Int,locked:Bool,visible:Bool,alpha:Double,eventMode:String
    let kind:Kind
    var destroyed:Bool,magnetAffected:Bool,pendingRemoval:Bool,beingRemoved:Bool,cleanupQueued:Bool
    var wildHandoff:Bool,isBeingSpawned:Bool,spawnTweenActive:Bool?,lastMerge:Bool
    var wild:Bool {kind != .regular}
    var gameplayResolving:Bool {kind == .magnet || kind == .tnt}
}

/// Literal v9 app-merge active/simulation, board.anyMergePossible and
/// post-magnet-resolution have DIFFERENT filters. Kept explicit here.
enum NativeSourceMagnetPhysicalState {
    struct Result:Equatable {
        let lockedActiveCount,stillSpawningCount,activeCount,playableLockedCount:Int
        let reason:String,clearLastMerge:Bool
        /// Actual defensive marker mutations requested by getTransientSpawnState
        /// autoClearStaleFlag:true. Caller writes ONLY the same captured Node.
        let clearBeingSpawnedIDs:[String],clearSpawnTweenIDs:[String]
    }
    static func active(_ t:NativeSourceMagnetPhysicalTile)->Bool {
        !t.destroyed && t.visible && t.alpha>0.01 && (t.value>0 || t.wild)
    }
    static func playable(_ t:NativeSourceMagnetPhysicalTile)->Bool {
        !t.destroyed && t.visible && t.alpha>0.01 && (t.wild || !t.locked) && (t.value>0 || t.wild)
    }
    static func transient(_ t:NativeSourceMagnetPhysicalTile)->Bool {
        if t.destroyed{return false};if t.wildHandoff{return true};if t.kind == .juice{return false}
        if t.locked && t.value>0 && (t.magnetAffected || t.spawnTweenActive==true){return true}
        if t.isBeingSpawned {
            let interactive = !t.locked && (t.value>0 || t.wild) && t.visible && t.eventMode != "none" && t.eventMode != "passive"
            return !interactive
        }
        return false
    }
    static func boardActive(_ t:NativeSourceMagnetPhysicalTile)->Bool {
        if t.destroyed || !t.visible || t.magnetAffected || t.pendingRemoval || t.beingRemoved || t.cleanupQueued{return false}
        if t.wild {
            if t.locked && t.alpha>0.35{return true}
            if t.eventMode=="none" || t.eventMode=="passive" {
                if t.gameplayResolving && t.alpha>0.35{return true}
                return transient(t)
            }
            return t.alpha>0.01
        }
        return !t.locked && t.value>0
    }
    static func anyMergePossible(_ tiles:[NativeSourceMagnetPhysicalTile])->Bool {
        let open=tiles.filter(boardActive),direct=open.filter{$0.wild && $0.kind != .magnet},magnets=open.filter{$0.kind == .magnet}
        let regular=open.filter{!$0.wild && $0.value>0 && $0.value<=6}
        if !direct.isEmpty && !regular.isEmpty{return true}
        if direct.count>=2 && regular.isEmpty && magnets.isEmpty{return false}
        if !magnets.isEmpty && (!regular.isEmpty || !direct.isEmpty){return true}
        let total=open.reduce(0){$0+($1.depth==0 ? 1:$1.depth)}
        if total<2 || open.count==1{return false}
        for i in open.indices {
            for j in open.indices where j>i {
                let a=open[i],b=open[j];if a.wild || b.wild{continue}
                let sum=a.value+b.value
                if a.value==b.value && a.value>0 && a.value<=3 ||
                   a.value==6 && (1...5).contains(b.value) || b.value==6 && (1...5).contains(a.value) || (2...6).contains(sum){return true}
            }
        }
        return false
    }
    static func simulate(_ tiles:[NativeSourceMagnetPhysicalTile])->Bool {
        var current=tiles.filter(active).map{($0.value,$0.wild)}
        if current.isEmpty{return true};if current.count==1{return current[0].0==6};if current.count>15{return false}
        var iterations=0
        while current.count>1 && iterations<50 {
            var pair:(Int,Int)?
            for i in 0..<min(current.count,10) {
                for j in (i+1)..<current.count {
                    if current[i].1 || current[j].1 || (2...6).contains(current[i].0+current[j].0){pair=(i,j);break}
                }
                if pair != nil{break}
            }
            guard let (i,j)=pair else{break}
            let value=(current[i].1 || current[j].1) ? 6:min(6,current[i].0+current[j].0)
            current.remove(at:j);current.remove(at:i);current.append((value,false));iterations+=1
        }
        return current.count==1 && current[0].0==6
    }
    static func read(_ tiles:[NativeSourceMagnetPhysicalTile],spawnCount:Int,successfulSpawnCount:Int,lastMerge:Bool)->Result {
        let spawning=tiles.filter(transient)
        let locked=spawning.filter{$0.locked && $0.kind != .juice && $0.value>0}
        let activeCount=tiles.filter(active).count,playable=tiles.filter(playable),unlocked=playable.filter{!$0.locked}
        let spawned=successfulSpawnCount>0 || spawnCount>0 && playable.count>1
        let clear=lastMerge && spawned,potential = !playable.isEmpty && anyMergePossible(playable)
        let clean=playable.count==1 && playable[0].value==6
        let reason:String
        if potential{reason="merge-or-stack-potential"}
        else if spawned && playable.count<=1{reason="spawned-tiles-settling"}
        else if clean && unlocked.count<=1{reason="clean-merge6-only"}
        else if !unlocked.isEmpty{reason="stuck-unlocked-tiles"}
        else if !playable.isEmpty{reason="stuck-active-tiles"}
        else{reason="no-active-tiles"}
        // getTransientSpawnState auto-clears only fields actually present and
        // reached before its early-return branches. A root-active boolean is
        // never substituted for the literal _spawnTween field.
        let reachable=tiles.filter{!$0.destroyed && !$0.wildHandoff && $0.kind != .juice}
        let clearTween=reachable.filter{$0.locked && $0.value>0 && !$0.magnetAffected && $0.spawnTweenActive==false}.map(\.id)
        let clearBeing=reachable.filter{t in
            if t.locked && t.value>0 && (t.magnetAffected || t.spawnTweenActive==true){return false}
            return t.isBeingSpawned && !t.locked && (t.value>0 || t.wild) && t.visible && t.eventMode != "none" && t.eventMode != "passive"
        }.map(\.id)
        return .init(lockedActiveCount:locked.count,stillSpawningCount:spawning.count,activeCount:activeCount,
            playableLockedCount:playable.filter{$0.locked && $0.value>0}.count,reason:reason,clearLastMerge:clear,
            clearBeingSpawnedIDs:clearBeing,clearSpawnTweenIDs:clearTween)
    }
}
