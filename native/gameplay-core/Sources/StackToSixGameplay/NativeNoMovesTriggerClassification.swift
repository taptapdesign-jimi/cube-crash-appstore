import Foundation

public struct NativeNoMovesStackContext:Equatable,Sendable {
    public let destinationID:String
    public let effectiveSum:Int
    public let sourceDepth:Int
    public let physicalBefore:Int
    public let combinedCountBeforeWait:Int
    public let regularPair:Bool
    public let bothCapturedActive:Bool
    public let visibleBefore:Int
    public init(before:NativeBoardState,source:NativeTile,destination:NativeTile,effectiveSum:Int,destinationDepthAfterCommit:Int?=nil) {
        let active=before.tiles.filter{NativeSourceEndgameChecker.active($0)}
        destinationID=destination.id;self.effectiveSum=effectiveSum;sourceDepth=source.stackDepth
        combinedCountBeforeWait=source.stackDepth+(destinationDepthAfterCommit ?? destination.stackDepth)
        physicalBefore=active.reduce(0){$0+max(1,$1.stackDepth)};visibleBefore=active.count
        regularPair = !source.isWild && !destination.isWild && source.value>0 && destination.value>0
        bothCapturedActive=active.contains{$0.id==source.id} && active.contains{$0.id==destination.id}
    }
}
public enum NativeNoMovesOrigin:Equatable,Sendable {
    case ordinaryPostcheck(NativeNoMovesStackContext)
    case mergeMovesDepleted
    case movesDepleted
    case levelEnd
}
public enum NativeNoMovesTriggerClassifier {
    public static func classify(state:NativeBoardState,origin:NativeNoMovesOrigin,runtime:[String:NativeNoMovesTileRuntime]=[:])->NativeNoMovesCandidateOwner.Trigger? {
        guard NativeSourceEndgameChecker.check(state:state,runtime:runtime).kind == .fail else{return nil}
        switch origin {
        case .mergeMovesDepleted:return state.moves<=0 ? .mergeMovesDepleted:nil
        case .movesDepleted:return state.moves<=0 ? .movesDepleted:nil
        case .levelEnd:return .levelEnd
        case .ordinaryPostcheck(let c):
            let active=state.tiles.filter{NativeSourceEndgameChecker.active($0,runtime:runtime[$0.id] ?? .init())}
            if c.regularPair && c.effectiveSum<6 && c.bothCapturedActive,active.count==1,let dst=active.first,dst.id==c.destinationID,
               !state.tiles.contains(where:{!($0.id==dst.id) && !(runtime[$0.id]?.destroyed ?? false) && $0.locked && $0.value>0}) {
                let depth=max(1,dst.stackDepth),canReach=dst.value*2<=6 && depth>=2
                let lastTwo=c.visibleBefore==2
                let lastThree=c.physicalBefore>=3 && c.combinedCountBeforeWait>=c.physicalBefore
                if lastTwo {
                    if !canReach{return .lastTwoRegular}
                    if dst.value*2==6 && depth-1==1{return .lastTwoSelf}
                }
                if lastThree {
                    if !canReach{return .lastThreeRegular}
                    if dst.value*2==6 && depth-1==1{return .lastThreeSelf}
                }
            }
            if active.count==1,let t=active.first,!t.isWild,!(t.stackDepth>=2 && t.value*2<=6){return .singleRegular}
            return .postMerge
        }
    }
}
