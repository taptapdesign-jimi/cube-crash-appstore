import Foundation
import StackToSixGameplay
import StackToSixNativeState

// Offline experiment only. Uses the synchronous core, not the mounted Source
// presentation graph. Never reads/writes a player profile or changes thresholds.
struct RNG {
    var state: UInt64
    mutating func next() -> Double {
        state &+= 0x9e3779b97f4a7c15
        var z = state
        z = (z ^ (z >> 30)) &* 0xbf58476d1ce4e5b9
        z = (z ^ (z >> 27)) &* 0x94d049bb133111eb
        return Double((z ^ (z >> 31)) >> 11) / 9007199254740992
    }
}
struct Action: Codable { let source: String; let destination: String }
struct Row: Codable {
    let board: Int; let seed: Int; let policy: String; let cap: Int
    let outcome: String; let reason: String; let actions: Int
    let base: Int; let comboBonus: Int; let efficiency: Int; let final: Int
    let peakCombo: Int; let drops: Int; let movesLeft: Int
    let capOvershoots: Int; let validationErrors: Int; let traceMatched: Bool
    let trace: [Action]
}

func engine(_ state: NativeBoardState) -> NativeGameplayEngine {
    let e = NativeGameplayEngine(state:state,rewardPicker:{ state, roll, next in
        NativeWildRewardPolicy.choose(state:state,roll:roll,plainStarUnlocked:true,nextRoll:next)
    })
    e.comboWindowExtension=1.5; e.comboHUDCoinRewardsEnabled=true
    e.stagedTntActivation=true
    return e
}

// Visible-state heuristic only: no future RNG access. All four timing styles
// replay the identical move trace, isolating combo from luck and route choice.
func choose(_ e: NativeGameplayEngine, variant: Int) -> Action? {
    let tiles=e.state.activeTiles.sorted{$0.id<$1.id}
    var best: (Double,Action)?
    for a in tiles where e.canBeginDrag(tileID:a.id) {
        for b in tiles where NativeGameplayResolver.canDrop(a,onto:b) {
            let wild=a.isWild || b.isWild
            let sum=wild || a.value==6 || b.value==6 ? 6:a.value+b.value
            let depth=min(4,a.stackDepth+b.stackDepth)
            let other=tiles.filter{$0.id != a.id && $0.id != b.id}
            // Avoid stranding large faces; seek complementary pairs and keep
            // special dice for useful clears. Variant sweeps expose policy bias.
            var merit=Double(sum==6 ? 24:8)
            if sum<6 {
                merit += Double(other.filter{!$0.isWild && $0.value+sum==6}.count)*5
                merit -= sum==5 ? 4:0
                merit += Double(depth)*Double(variant==1 ? 5:2)
            } else {merit += Double(depth)*Double(variant==1 ? 4:1)}
            if wild {
                merit += variant==2 ? 30:4
                if variant==0 && other.count>3 {merit -= 80}
                if a.gameplayArchetype == .magnet || b.gameplayArchetype == .magnet {
                    merit += Double(min(4,other.count))*3
                }
            }
            merit += Double(a.value+b.value)*0.01
            let action=Action(source:a.id,destination:b.id)
            if best == nil || merit>best!.0 {best=(merit,action)}
        }
    }
    return best?.1
}

func play(board:Int,seed:Int,cap:Int,policy:String,variant:Int,replay:[Action]?=nil) -> Row {
    var rng=RNG(state:UInt64(seed))
    let recipe=NativeSourceInitialBoardRecipe.capture(mode:.journey,board:board,
        gameplaySeed:UInt64(seed)^0xa0761d6478bd642f,random:{rng.next()})!
    let e=engine(recipe.state)
    var now=0.0, trace:[Action]=[], reason="", outcome="bounded", overshoots=0, errors=0
    var matched=true
    for step in 0..<600 {
        let resolution=e.resolve()
        if resolution.kind == .complete {outcome="complete";reason=resolution.reason;break}
        if resolution.kind == .fail {outcome="fail";reason=resolution.reason;break}
        let action:Action?
        if let replay {
            action=step<replay.count ? replay[step]:nil
        } else {action=choose(e,variant:variant)}
        guard let action,let source=e.state.tiles.first(where:{$0.id==action.source}),
              let destination=e.state.tiles.first(where:{$0.id==action.destination}) else {
            outcome="blocked";reason="missing_legal_or_replay_action";matched=false;break
        }
        var jump=1
        if source.gameplayArchetype == .magnet || destination.gameplayArchetype == .magnet {
            jump += min(4,NativeGameplayResolver.magnetCandidates(e.state.tiles,source:source,destination:destination).count)
        }
        // A wait longer than either actual combo window ends the live streak.
        now += cap<99 && e.state.combo+jump>cap ? 6.0:0.65
        guard e.beginDrag(tileID:action.source) else {outcome="blocked";reason="drag_rejected";break}
        let result=e.drop(target:destination.cell,now:now)
        guard result.accepted else {outcome="blocked";reason=result.events.last?.reason ?? "drop_rejected";break}
        if let special=e.pendingSpecial {
            if special.archetype == .tnt {
                guard e.commitSpecialActivation(transactionID:special.id).accepted,
                      e.reserveTntTargets(transactionID:special.id).accepted,
                      let activated=e.pendingSpecial else {
                    outcome="blocked";reason="tnt_activation_or_reservation_rejected";break
                }
                for target in activated.targets {
                    if !e.commitSpecialImpact(transactionID:special.id,tileID:target.id).accepted {
                        errors += 1
                    }
                }
            }
            if !e.commitSpecialBoard(transactionID:special.id).accepted {
                outcome="blocked";reason="special_commit_rejected";break
            }
        }
        for receipt in e.pendingMeterRewards {
            if !e.commitMeterReward(receiptID:receipt.id,generation:receipt.generation).accepted {errors += 1}
        }
        for receipt in e.pendingHUDStars {
            if !e.commitHUDStarArrival(receiptID:receipt.id,generation:receipt.generation).accepted {errors += 1}
        }
        errors += e.state.validationIssues().count
        if e.state.combo>cap {overshoots += 1}
        trace.append(action)
    }
    let s=e.state, clean=outcome=="complete"
    let efficiency=clean ? NativeRewardMath.efficiencyBonus(baseBonus:500+(board-1)*200,
        remainingMoves:s.moves,maxMoves:s.maxMoves,maxStackDepth:s.maxStackDepth):0
    return Row(board:board,seed:seed,policy:policy,cap:cap,outcome:outcome,reason:reason,
        actions:trace.count,base:s.score,comboBonus:clean ? s.earnedComboBonus:0,
        efficiency:efficiency,final:NativeRewardMath.finalScore(currentScore:s.score,
            comboBonus:clean ? s.earnedComboBonus:0,efficiencyBonus:efficiency),
        peakCombo:s.longestCombo,drops:s.wildSpawnCount,movesLeft:s.moves,
        capOvershoots:overshoots,validationErrors:errors,traceMatched:matched && (replay == nil || trace.count==replay!.count),trace:trace)
}

let seeds=Int(CommandLine.arguments.dropFirst().first ?? "100")!
let encoder=JSONEncoder();encoder.outputFormatting=[.sortedKeys]
for board in 1...10 {
    for seed in 1...seeds {
        for variant in 0..<3 {
            let expert=play(board:board,seed:seed,cap:99,policy:"continuous-v\(variant)",variant:variant)
            let medium=play(board:board,seed:seed,cap:max(2,Int(ceil(Double(expert.peakCombo)/2))),
                policy:"half-v\(variant)",variant:variant,replay:expert.trace)
            let low=play(board:board,seed:seed,cap:4,policy:"cap4-v\(variant)",variant:variant,replay:expert.trace)
            let isolated=play(board:board,seed:seed,cap:1,policy:"single-v\(variant)",variant:variant,replay:expert.trace)
            for row in [expert,medium,low,isolated] {
                print(String(data:try encoder.encode(row),encoding:.utf8)!)
            }
        }
    }
    FileHandle.standardError.write(Data("Finished Forest \(board), \(seeds) seeds, 3 heuristics, 4 timing styles\n".utf8))
}
