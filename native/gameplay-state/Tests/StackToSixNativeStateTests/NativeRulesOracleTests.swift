import XCTest
import Foundation
import StackToSixGameplay
@testable import StackToSixNativeState

final class NativeRulesOracleTests:XCTestCase {
    private func tile(_ raw:[String:Any])->NativeTile {
        NativeTile(id:raw["id"] as! String,cell:NativeCell(column:raw["gridX"] as! Int,row:raw["gridY"] as! Int),value:raw["value"] as! Int,stackDepth:raw["stackDepth"] as? Int ?? 1,archetype:(raw["special"] as? String).flatMap(NativeWildArchetype.init(rawValue:)),locked:raw["locked"] as? Bool ?? false,visible:raw["visible"] as? Bool ?? true,alpha:raw["alpha"] as? Double ?? 1)
    }
    func testPureNativeDecisionPortsAgainstIndependentTypeScript308CaseOracle() throws {
        let url=try XCTUnwrap(Bundle.module.url(forResource:"NativeRulesOracle",withExtension:"json"))
        let root=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(contentsOf:url)) as? [String:Any])
        let fixtures=root["cases"] as! [[String:Any]]
        XCTAssertEqual(fixtures.count,308)
        for (index,fixture) in fixtures.enumerated() {
            let kind=fixture["kind"] as! String,input=fixture["input"] as! [String:Any],expected=fixture["expected"]
            let dict=expected as? [String:Any] ?? [:]
            func integer(_ key:String,_ fallback:Int=0)->Int {input[key] as? Int ?? fallback}
            func boolean(_ key:String,_ fallback:Bool=false)->Bool {input[key] as? Bool ?? fallback}
            let label="fixture=\(index) kind=\(kind)"
            switch kind {
            case "finalMerge","resolver":
                let tiles=(input["tiles"] as! [[String:Any]]).map(tile)
                let src=tiles.first {$0.id==input["sourceID"] as? String}!,dst=tiles.first {$0.id==input["destinationID"] as? String}!
                let final=NativeGameplayResolver.finalMerge(tiles,source:src,destination:dst,effectiveSum:integer("effSum"),hasTilesToPull:boolean("hasTilesToPull"))
                if kind=="finalMerge" {
                    XCTAssertEqual(final.activeSnapshotWasOnlyMergePair,dict["activeSnapshotWasOnlyMergePair"] as! Bool,label)
                    XCTAssertEqual(final.activePhysicalTileCount,dict["activePhysicalTileCount"] as! Int,label)
                    XCTAssertEqual(final.mergePhysicalTileCount,dict["mergePhysicalTileCount"] as! Int,label)
                    XCTAssertEqual(final.isFinalRegularMerge6,dict["isFinalRegularMerge6"] as! Bool,label)
                    XCTAssertEqual(final.isFinalWildLastTwo,dict["isFinalWildLastTwo"] as! Bool,label)
                    XCTAssertEqual(final.isFinalMerge,dict["isFinalMerge"] as! Bool,label)
                } else {
                    var flags=NativeGameplayRuntimeFlags();flags.hasTilesToPull=boolean("hasTilesToPull")
                    let state=NativeBoardState(columns:5,rows:9,tiles:tiles,mode:input["mode"] as? String=="arcade" ? .arcade : .journey)
                    let decision=NativeGameplayResolver.resolve(state:state,flags:flags,phase:input["phase"] as! String,finalMerge:final,effectiveSum:integer("effSum"))
                    XCTAssertEqual(decision.kind.rawValue,dict["type"] as! String,label)
                    XCTAssertEqual(decision.target,dict["target"] as? String,label)
                }
            case "efficiencyBonus":XCTAssertEqual(NativeRewardMath.efficiencyBonus(baseBonus:integer("bonus"),remainingMoves:integer("movesRemaining"),maxMoves:integer("maxMoves"),maxStackDepth:integer("maxStackDepth")),expected as! Int,label)
            case "finalScore":XCTAssertEqual(NativeRewardMath.finalScore(currentScore:integer("currentScore"),comboBonus:integer("comboBonus"),efficiencyBonus:integer("efficiencyBonus"),scoreCap:integer("scoreCap")),expected as! Int,label)
            case "regularSpawnCount":XCTAssertEqual(NativeSpawnRules.regularMerge6SpawnCount(integer("spawnMult")),expected as! Int,label)
            case "wildBonus":
                let archetype=NativeWildArchetype(rawValue:input["archetype"] as! String)
                let result=NativeSpawnRules.wildBonus(archetype:archetype,isLastMerge:boolean("isLastMerge"),isArcadeSimpleWild:false,isFinalWildSnapshot:false,starOrbitCount:integer("starOrbitCount"))
                XCTAssertEqual(result.locked,dict["lockedBonusCount"] as! Int,label);XCTAssertEqual(result.active,dict["extraActiveCount"] as! Int,label)
            case "wildEndgameMult":
                let result=NativeSpawnRules.wildEndgameMultiplier(integer("spawnMult"),isWild:boolean("isWildMerge"),lockedEmptyCount:integer("lockedEmptyPlaceholderCount"),isLastMerge:boolean("isLastMerge"))
                XCTAssertEqual(result,dict["spawnMult"] as! Int,label)
            case "magnetRespawn":XCTAssertEqual(NativeMagnetRules.respawnCount(pulledCount:integer("pulledCellCount"),hasTilesToRespawn:boolean("hasTilesToRespawn")),dict["spawnCount"] as! Int,label)
            case "magnetDelays":XCTAssertEqual(NativeMagnetRules.respawnDelays(count:integer("count")),(expected as! [NSNumber]).map(\.doubleValue),label)
            case "magnetProgress":
                let tiles=(input["tiles"] as! [[String:Any]]).map(tile),merge=tiles.first {$0.id==input["mergeID"] as? String}!
                let result=NativeMagnetRules.pullProgress(activeBeforePull:tiles,mergeTile:merge,pulledCount:integer("pulledTileCount"))
                XCTAssertEqual(result.addProgress,dict["shouldAddWildProgress"] as! Bool,label);XCTAssertEqual(result.isLastMergeBeforePull,dict["isLastMergeBeforePull"] as! Bool,label)
            case "tntSeparated":
                let tiles=(input["tiles"] as! [[String:Any]]).map(tile),roll=input["roll"] as! Double
                XCTAssertEqual(NativeTntRules.separatedTargets(tiles,count:integer("count"),random:{roll}).map(\.id),expected as! [String],label)
            case "wildPermission":
                let last=((input["tiles"] as? [[String:Any]]) ?? []).count==1 && ((input["tiles"] as? [[String:Any]])?.first?["value"] as? Int)==6
                let permission=NativeWildMeterRules.permission(meter:input["wildMeter"] as! Double,meterEnabled:boolean("boardWildMeterEnabled",true),spawnEnabled:boolean("boardWildSpawnEnabled",true),spawnInProgress:boolean("wildSpawnInProgress"),busyEnding:boolean("busyEnding"),boardTransition:boolean("boardTransitionActive"),failPending:boolean("failScreenPending"),lastMerge:last,animationBlock:input["activeAnimationBlockReason"] as? String)
                XCTAssertEqual(permission.action.rawValue,dict["action"] as! String,label);XCTAssertEqual(permission.reason,dict["reason"] as! String,label);XCTAssertEqual(permission.retryDelayMs,dict["retryDelayMs"] as? Int,label)
            case "wildProgress":
                let raw=input["permission"] as! [String:Any],permission=NativeWildMeterRules.Permission(.init(rawValue:raw["action"] as! String)!,raw["reason"] as! String,retryDelayMs:raw["retryDelayMs"] as? Int)
                let result=NativeWildMeterRules.progressAction(permission:permission,confirmedNonFinal:boolean("confirmedNonFinal"))
                XCTAssertEqual(result.action,dict["action"] as! String,label);XCTAssertEqual(result.reason,dict["reason"] as! String,label)
            default:XCTFail("Unknown source oracle kind \(kind)")
            }
        }
    }
}
