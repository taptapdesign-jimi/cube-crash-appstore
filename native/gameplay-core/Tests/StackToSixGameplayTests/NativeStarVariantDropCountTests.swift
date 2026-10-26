import XCTest
@testable import StackToSixGameplay

final class NativeStarVariantDropCountTests:XCTestCase {
    private let variants=["fish","kanta","cubero"]
    func testMeterVariantsChooseAllThreeCountsAndBeeRemainsSingle() throws {
        for mode in [NativeRunMode.journey,.arcade] {for variant in variants+["bee","kite"] {
            for (roll,count) in [(0.0,1),(0.4,2),(0.99,3)] {
                let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"ordinary",cell:.init(column:0,row:0),value:4)],mode:mode,wildMeter:1.25),recordedRandomChoices:[0,0,roll],rewardPicker:{_,_ in .init(.star,variant:variant)})
                XCTAssertTrue(engine.claimMeterReward().accepted)
                let tile=try XCTUnwrap(engine.state.tiles.first{$0.variant==variant})
                XCTAssertEqual(tile.starOrbitCount,(variant == "bee" || variant == "kite") ? 1:count,variant)
                XCTAssertEqual(tile.effectiveStarDropCount,tile.starOrbitCount)
            }
        }}
    }
    func testHiddenOpenPersistsVariantCountOnceAndPreservesPlainPresentationBoundary() throws {
        for variant in [nil,"fish","kanta","cubero","bee","kite"] as [String?] {
            var draws=0
            let math=NativeSourceMathRandomStream {draws+=1;return 0.8}
            let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"ordinary",cell:.init(column:0,row:0),value:4)],wildMeter:1.25),rewardPicker:{_,_ in .init(.star,variant:variant)},sourceMathRandom:math)
            engine.stagedMeterDrops=true;engine.stagedMeterOpen=true
            engine.sourceStarOrbitCountAtPresentationEnabled=true
            XCTAssertTrue(engine.claimMeterReward().accepted)
            let request=try XCTUnwrap(engine.pendingMeterOpen)
            XCTAssertEqual(request.tile.starOrbitCount,variant == nil ? 0:(variant == "bee" || variant == "kite") ? 1:3)
            XCTAssertEqual(draws,variant == nil || (variant == "bee" || variant == "kite") ? 2:3)
            XCTAssertFalse(engine.claimMeterReward().accepted)
            XCTAssertEqual(engine.pendingMeterOpen,request)
            XCTAssertEqual(draws,variant == nil || (variant == "bee" || variant == "kite") ? 2:3,"A waiting hidden owner must not reroll")
        }
    }
    func testMagnetAbsorptionUsesVariantSavedCountInBothRespawnOwnersAndKeepsBeeBaseline() throws {
        for lazy in [false,true] {for variant in variants+["bee","kite"] {for count in 1...3 {
            let tiles=[NativeTile(id:"magnet",cell:.init(column:0,row:0),value:6,archetype:.magnet),NativeTile(id:"destination",cell:.init(column:1,row:0),value:2),NativeTile(id:"helper",cell:.init(column:2,row:0),value:6,starOrbitCount:count,archetype:.star,variant:variant)]
            var draw=0
            let math=NativeSourceMathRandomStream {defer{draw+=1};return Double((draw*17+3)%97)/97}
            let engine=NativeGameplayEngine(state:.init(tiles:tiles,board:10),recordedRandomChoices:Array(repeating:0.2,count:500),sourceMathRandom:lazy ? math:nil)
            engine.sourceMagnetLazyRespawnEnabled=lazy
            XCTAssertTrue(engine.beginDrag(tileID:"magnet"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
            let plan=try XCTUnwrap(engine.pendingSpecial)
            XCTAssertEqual(plan.targets.map(\.id),["helper"])
            if lazy {
                let receipt=try XCTUnwrap(engine.registerSourceSpecialAbsorbOwner(transactionID:plan.id,generation:plan.generation))
                XCTAssertTrue(engine.commitSourceSpecialAbsorbMain(receiptID:receipt.id,generation:plan.generation).accepted)
                XCTAssertTrue(engine.prepareSourceMagnetLazyRespawn(transactionID:plan.id,generation:plan.generation,sourceCurrent:{true}).accepted)
            } else {XCTAssertTrue(engine.prepareMagnetRespawn(transactionID:plan.id).accepted)}
            XCTAssertEqual(engine.pendingHUDStars.count,(variant == "bee" || variant == "kite") ? 1:min(3,count+1))
        }}}
    }
    private func merge(variant:String?,count:Int,mode:NativeRunMode,final:Bool)->NativeGameplayEngine {
        var tiles=[NativeTile(id:"wild",cell:.init(column:0,row:0),value:6,starOrbitCount:count,archetype:.star,variant:variant),NativeTile(id:"destination",cell:.init(column:1,row:0),value:5)]
        if !final {
            tiles.append(.init(id:"survivor",cell:.init(column:4,row:8),value:2))
            for index in 0..<18 {tiles.append(.init(id:"locked\(index)",cell:.init(column:index%5,row:1+index/5),value:0,locked:true))}
        }
        let engine=NativeGameplayEngine(state:.init(tiles:tiles,mode:mode,board:10),recordedRandomChoices:Array(repeating:0.2,count:500))
        XCTAssertTrue(engine.beginDrag(tileID:"wild"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        return engine
    }
    func testEverySavedCountUsesExactPlainStarSpawnAndHudRulesAcrossJourneyArcadeAndFinal() {
        for mode in [NativeRunMode.journey,.arcade] {for final in [false,true] {for count in 1...3 {
            let plain=merge(variant:nil,count:count,mode:mode,final:final)
            for variant in variants {
                let actual=merge(variant:variant,count:count,mode:mode,final:final)
                XCTAssertEqual(actual.pendingHUDStars.count,count,variant)
                XCTAssertEqual(actual.state.tiles.filter(\.isActive).count,plain.state.tiles.filter(\.isActive).count,variant)
                XCTAssertEqual(actual.state.tiles.filter(\.locked).count,plain.state.tiles.filter(\.locked).count,variant)
                XCTAssertEqual(actual.state.terminal,plain.state.terminal,variant)
                if final {XCTAssertTrue(actual.state.tiles.isEmpty)}
            }
        }}}
        for mode in [NativeRunMode.journey,.arcade] {
            XCTAssertEqual(merge(variant:"bee",count:3,mode:mode,final:false).pendingHUDStars.count,1)
            let finalBee=merge(variant:"bee",count:3,mode:mode,final:true)
            XCTAssertEqual(finalBee.pendingHUDStars.count,1)
            XCTAssertTrue(finalBee.state.tiles.isEmpty)
            XCTAssertEqual(finalBee.state.terminal?.kind,.complete)
        }
    }
    func testArcadeMatchesJourneyForEveryStarVariantSavedCountAndSpawnOwner() throws {
        for variant in [nil,"fish","kanta","cubero","bee","kite"] as [String?] {
            for count in 1...3 {for locked in [0,18] {for staged in [false,true] {
                func run(_ mode:NativeRunMode) throws -> NativeGameplayEngine {
                    var tiles=[NativeTile(id:"wild",cell:.init(column:0,row:0),value:6,starOrbitCount:count,archetype:.star,variant:variant),NativeTile(id:"destination",cell:.init(column:1,row:0),value:5),NativeTile(id:"survivor",cell:.init(column:4,row:8),value:2)]
                    tiles += (0..<locked).map{.init(id:"locked\($0)",cell:.init(column:$0%5,row:1+$0/5),value:0,locked:true)}
                    // Exercise persisted values, including legacy Bee counts, without rerolling.
                    let saved=try JSONDecoder().decode(NativeBoardState.self,from:JSONEncoder().encode(NativeBoardState(tiles:tiles,mode:mode,board:10)))
                    let engine=NativeGameplayEngine(state:saved,recordedRandomChoices:Array(repeating:0.2,count:2000))
                    engine.stagedDirectWildMoves=staged;engine.stagedDirectWildAssignments=staged
                    XCTAssertTrue(engine.beginDrag(tileID:"wild"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
                    if staged {
                        let plan=try XCTUnwrap(engine.pendingDirectWild)
                        XCTAssertTrue(engine.commitDirectWildGameplay(transactionID:plan.id).accepted)
                        var iterations=0
                        while !engine.pendingWildSpawnActions.isEmpty || !engine.pendingWildSpawnArrivals.isEmpty {
                            iterations+=1
                            if iterations>100 {XCTFail("Spawn owner failed to settle");break}
                            if let action=engine.pendingWildSpawnActions.first {
                                XCTAssertTrue(engine.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id).accepted)
                            } else if let arrival=engine.pendingWildSpawnArrivals.first {
                                XCTAssertTrue(engine.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id).accepted)
                            }
                        }
                        XCTAssertTrue(engine.releaseDirectWildPresentation(transactionID:plan.id,generation:plan.generation).accepted)
                        XCTAssertNil(engine.pendingDirectWild)
                    }
                    return engine
                }
                let journey=try run(.journey),arcade=try run(.arcade)
                let tag="\(variant ?? "star")/\(count)/\(locked)/\(staged)"
                XCTAssertEqual(arcade.state.tiles,journey.state.tiles,tag)
                XCTAssertEqual(arcade.pendingHUDStars.count,(variant == "bee" || variant == "kite") ? 1:count,tag)
                XCTAssertEqual(arcade.state.terminal,journey.state.terminal,tag)
                XCTAssertTrue(arcade.state.validationIssues().isEmpty,tag)
                XCTAssertEqual(arcade.state.tiles.filter(\.isActive).count,2+(locked>0 ? 1:0)+((variant == "bee" || variant == "kite") ? 1:count),tag)
            }}}
        }
    }

}
