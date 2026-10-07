import Foundation

/// Pure authored transition components. The scene-specific carrier owns the
/// finite clock; this plan cannot commit a run or release gameplay input.
enum NativeBoardTransitionPlan {
    enum Theme:String,CaseIterable {case forest,beach,area55
        init(board:Int) {self=board>20 ? .area55:board>10 ? .beach:.forest}
    }
    struct Pose:Equatable {
        var scale=1.0,alpha=1.0,rotation=0.0,rotationX=0.0,rotationY=0.0,z=0.0
        static let hidden=Pose(scale:0,alpha:0)
    }
    static func localStage(_ board:Int)->String {String(format:"%02d",(max(1,min(30,board))-1)%10+1)}
    static func digitEnterStart(theme:Theme,index:Int)->Double {(theme == .area55 ? 1.30:0.30)+Double(index)*0.30}
    static func digitEnter(_ seconds:Double,rotation:Double)->Pose {
        guard seconds>=0 else {return Pose(scale:0,alpha:0,rotation:rotation)}
        if seconds<0.4 {
            let t=backOut(seconds/0.4,2)
            return Pose(scale:1.2*t,alpha:t,rotation:rotation,rotationX:-5*t,z:20*t)
        }
        if seconds<0.55 {
            let t=powerOut((seconds-0.4)/0.15,2)
            return Pose(scale:1.2-0.25*t,rotation:rotation,rotationX:-5*(1-t),z:20*(1-t))
        }
        let t=backOut((seconds-0.55)/0.2,1.5)
        return Pose(scale:0.95+0.05*t,rotation:rotation)
    }
    static func digitExit(_ seconds:Double,index:Int,rotation:Double)->Pose {
        guard seconds>=0 else {return Pose(rotation:rotation)}
        if seconds<0.15 {let t=powerOut(seconds/0.15,2);return Pose(scale:1+0.1*t,rotation:rotation,z:30*t)}
        let t=powerIn((seconds-0.15)/0.3,2),sign=index%2==0 ? 1.0:-1.0
        return Pose(scale:1.1*(1-t),alpha:1-t,rotation:rotation+(sign*15-rotation)*t,rotationX:sign*45*t,rotationY:sign*30*t,z:30-130*t)
    }
    static func enterHaptic(theme:Theme,index:Int)->Double {digitEnterStart(theme:theme,index:index)+(index==0 ? 0.1:0.25)}
    static func exitHaptic(index:Int)->Double {0.35+0.3+Double(index)*0.3}
    struct ExitEntry:Equatable {let key:String,start:Double,end:Double,orderIndex:Int}
    enum PlanError:Error {case duplicateLayer,missingDependency,cyclicDependency}
    /// Source schedule preserves authored order while dependencies delay only
    /// the affected layer. A cycle fails before any presentation is mounted.
    static func exitSchedule(keys:[String],base:Double,stagger:Double,duration:Double,
                             dependencies:[String:String]=[:],offsets:[String:Double]=[:]) throws->[ExitEntry] {
        guard Set(keys).count==keys.count else{throw PlanError.duplicateLayer}
        let all=Set(keys)
        guard dependencies.allSatisfy({all.contains($0.key)&&all.contains($0.value)}) else{throw PlanError.missingDependency}
        var pending=all,entries:[String:ExitEntry]=[:]
        while !pending.isEmpty {
            var scheduled=0
            for (index,key) in keys.enumerated() where pending.contains(key) {
                if let prerequisite=dependencies[key],entries[prerequisite]==nil {continue}
                let start=max(base+Double(index)*stagger+(offsets[key] ?? 0),dependencies[key].flatMap{entries[$0]?.end} ?? 0)
                entries[key]=ExitEntry(key:key,start:start,end:start+duration,orderIndex:index)
                pending.remove(key);scheduled += 1
            }
            guard scheduled>0 else{throw PlanError.cyclicDependency}
        }
        return keys.compactMap{entries[$0]}
    }
    static func fighterFinaleWindow(start:Double,end:Double)->(start:Double,end:Double,duration:Double) {
        let low=max(0,start.isFinite ? start:0),high=max(low+0.001,end.isFinite ? end:low+0.001)
        let available=high-low,duration=min(available,max(0.12,available-1.5))
        return (max(low,high-duration),high,duration)
    }
    static func airCombatHold(minimum:Double,duration:Double,elapsed:Double)->Double {max(minimum,max(0,duration-elapsed)+0.08-0.40)}
    static func clamped(_ t:Double)->Double {max(0,min(1,t))}
    static func powerOut(_ t:Double,_ power:Int)->Double {1-pow(1-clamped(t),Double(power+1))}
    static func powerIn(_ t:Double,_ power:Int)->Double {pow(clamped(t),Double(power+1))}
    static func backOut(_ value:Double,_ s:Double)->Double {let t=clamped(value)-1;return 1+(s+1)*t*t*t+s*t*t}
}
