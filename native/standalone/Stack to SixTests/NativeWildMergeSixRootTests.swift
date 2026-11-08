import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
import StackToSixGameplay
@testable import Stack_to_Six

/// Actual complete Native root, normal restored canonical Wild ownership. This
/// matrix checks visual admission separately from the earned-reward policy.
@MainActor
final class NativeWildMergeSixRootTests:XCTestCase {
    private var timeoutDiagnostic:(()->String)?
    private var boardScaleAudit:(()->Void)?
    private func wait(_ label:String,_ predicate:()->Bool)async throws {
        let deadline=Date().addingTimeInterval(40)
        while !predicate(){
            boardScaleAudit?()
            guard Date()<deadline else{XCTFail("WildMergeSixRoot timeout=\(label) \(timeoutDiagnostic?() ?? "")");throw NSError(domain:label,code:1)}
            try await Task.sleep(for:.milliseconds(20))
        }
        boardScaleAudit?()
    }
    func testConsumedBottleDestinationDisposalAfterMainRetiresOldScene()async throws {
        try await exercise(archetype:.magnet,variant:"bottle",reverse:true,disposeDuringMain:true,moves:49)
    }
    func testConsumedBottleDestinationRetiresDuringFourTargetPull()async throws {
        try await exercise(archetype:.magnet,variant:"bottle",reverse:true,disposeDuringMain:false,moves:49)
    }
    func testBottleBothDirectionsRetireArtworkInNormalAndFinalActualAppFlows()async throws {
        for final in [false,true] {for reverse in [false,true] {
            try await exercise(archetype:.magnet,variant:"bottle",reverse:reverse,disposeDuringMain:false,moves:49,finalOnly:final)
        }}
    }
    func testBeachBallMergeKeepsUnrelatedBoardDiceFullSize()async throws {
        try await exercise(archetype:.juice,variant:"beach-ball",reverse:false,disposeDuringMain:false,moves:49,verifyBoardScale:true)
    }
    func testBloobFourToSixBonusDiceSettleInActualJourneyAndArcadeSourceRoots()async throws {
        for arcade in [false,true] {for reverse in [false,true] {
            try await exercise(archetype:.star,variant:"bloob",reverse:reverse,disposeDuringMain:false,moves:49,arcadeRun:arcade)
        }}
    }
    func testBeachBallMushroomRefillSettlesInActualJourneyAndArcadeSourceRoots()async throws {
        for arcade in [false,true] {for reverse in [false,true] {
            try await exercise(archetype:.juice,variant:"beach-ball",reverse:reverse,disposeDuringMain:false,moves:49,arcadeRun:arcade)
        }}
    }
    func testMushroomFourToSixBonusDiceSettleInActualJourneyAndArcadeSourceRoots()async throws {
        for arcade in [false,true] {for reverse in [false,true] {
            try await exercise(archetype:.juice,variant:"mushroom",reverse:reverse,disposeDuringMain:false,moves:49,arcadeRun:arcade)
        }}
    }
    func testMushroomQueuedClosedDiceStayInvisibleBeforeTheirOwnPop()async throws {
        let sparse=NativeBoardState(tiles:[
            .init(id:"m",cell:.init(column:0,row:0),value:6,archetype:.juice,variant:"mushroom"),
            .init(id:"d",cell:.init(column:1,row:0),value:2),
            .init(id:"other",cell:.init(column:4,row:8),value:3)
        ],mode:.journey,board:6,generation:9,moves:49)
        try await exercise(archetype:.juice,variant:"mushroom",reverse:false,disposeDuringMain:false,moves:49,capturedBoard:sparse,verifyQueuedBonus:true)
    }
    func testEveryTntAndStarQueuedClosedPopUsesTheSameHiddenWaitingPose()async throws {
        let choices:[(NativeWildArchetype,String?)]=[(.tnt,nil),(.tnt,"barell"),(.tnt,"flower"),(.tnt,"laser-gun"),(.tnt,"beach-ball"),(.star,nil)]
        for (archetype,variant) in choices {
            let sparse=NativeBoardState(tiles:[
                .init(id:"wild",cell:.init(column:0,row:0),value:6,archetype:archetype,variant:variant),
                .init(id:"d",cell:.init(column:1,row:0),value:2),
                .init(id:"other",cell:.init(column:4,row:8),value:3)
            ],mode:.journey,board:7,generation:9,moves:49)
            // Plain TNT's actual Arcade route has no closed bonus batch.
            // Check its real replacement path; all other rows audit the queue.
            let plainTnt=archetype == .tnt && variant == nil
            try await exercise(archetype:archetype,variant:variant,reverse:false,disposeDuringMain:false,moves:49,capturedBoard:sparse,arcadeRun:plainTnt,verifyQueuedBonus:!plainTnt)
        }
    }
    func testBarrelImmediateImpactsSettleInActualSourceRoot()async throws {
        try await exercise(archetype:.tnt,variant:"barell",reverse:false,disposeDuringMain:false,moves:49)
    }
    func testAllArchetypesAndVariantsKeepUnrelatedBoardDiceFullSizeBothDirections()async throws {
        let choices=NativeWildArchetype.allCases.map{($0,Optional<String>.none)} +
            NativeSpecialDiceRegistry.variants.values.sorted{$0.id<$1.id}.map{($0.archetype,Optional($0.id))}
        for (archetype,variant) in choices {
            for reverse in [false,true] {
                try await exercise(archetype:archetype,variant:variant,reverse:reverse,disposeDuringMain:false,moves:49,verifyBoardScale:true)
            }
        }
    }
    func testAllSeventeenCoreAndVariantWildsUseActualSourceMainPullAndImpactParticlesInBothDirections()async throws {
        let core=NativeWildArchetype.allCases.map{($0,Optional<String>.none)}
        let variants=NativeSpecialDiceRegistry.variants.values.sorted{$0.id<$1.id}.map{($0.archetype,Optional($0.id))}
        for (archetype,variant) in core+variants {
            try await exercise(archetype:archetype,variant:variant,reverse:false)
            try await exercise(archetype:archetype,variant:variant,reverse:true)
        }
    }
    func testBaloonJourneyBlockerSource()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:false,disposeDuringMain:false,moves:49,finalOnly:false,arcadeRun:false)
    }
    func testBaloonJourneyBlockerDestination()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:true,disposeDuringMain:false,moves:49,finalOnly:false,arcadeRun:false)
    }
    func testBaloonJourneyFinalSource()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:false,disposeDuringMain:false,moves:49,finalOnly:true,arcadeRun:false)
    }
    func testBaloonJourneyFinalDestination()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:true,disposeDuringMain:false,moves:49,finalOnly:true,arcadeRun:false)
    }
    func testBaloonArcadeBlockerSource()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:false,disposeDuringMain:false,moves:49,finalOnly:false,arcadeRun:true)
    }
    func testBaloonArcadeBlockerDestination()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:true,disposeDuringMain:false,moves:49,finalOnly:false,arcadeRun:true)
    }
    func testBaloonArcadeFinalSource()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:false,disposeDuringMain:false,moves:49,finalOnly:true,arcadeRun:true)
    }
    func testBaloonArcadeFinalDestination()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:true,disposeDuringMain:false,moves:49,finalOnly:true,arcadeRun:true)
    }
    func testSoleBaloonDestinationActualArcadeMergeMountsSVGAndBalloons()async throws {
        try await exercise(archetype:.juice,variant:"baloon",reverse:true,disposeDuringMain:false,moves:49,arcadeRun:true,verifyBaloonRetirement:true)
    }
    func testSpaceshipDestinationActualSourceParticlesSettleAndContinue()async throws {
        try await exercise(archetype:.magnet,variant:"spaceship",reverse:true)
    }
    func testSpriteSizeAndConvertedCornersMeasureTheSameScaledFootprint() {
        let parent=SKNode(),sprite=SKSpriteNode(color:.white,size:CGSize(width:128,height:128))
        parent.addChild(sprite);sprite.xScale=0.25;sprite.yScale=0.5
        let local=CGSize(width:sprite.size.width/abs(sprite.xScale),height:sprite.size.height/abs(sprite.yScale))
        let origin=sprite.convert(CGPoint.zero,to:parent)
        let right=sprite.convert(CGPoint(x:local.width,y:0),to:parent)
        let top=sprite.convert(CGPoint(x:0,y:local.height),to:parent)
        XCTAssertEqual(sprite.size.width,32,accuracy:0.0001,"SpriteKit size includes its local xScale")
        XCTAssertEqual(sprite.size.height,64,accuracy:0.0001,"SpriteKit size includes its local yScale")
        XCTAssertEqual(hypot(right.x-origin.x,right.y-origin.y),sprite.size.width,accuracy:0.0001)
        XCTAssertEqual(hypot(top.x-origin.x,top.y-origin.y),sprite.size.height,accuracy:0.0001)
    }
    func testCapturedPreIncidentBoard24PreservesComposedFootprints()async throws {
        // Exact read-only incident previous-save board; no external fixture path.
        let json="""
        {
          "generation": 3,
          "mode": "journey",
          "wildMeter": 0.002000000000000224,
          "longestCombo": 27,
          "moves": 7,
          "luckyDropUsed": false,
          "earnedJourneyDice": ["laser-gun","bloob-ball","bloob"],
          "revision": 43,
          "wildDropTypeStreak": 3,
          "rngState": 1,
          "lastSpecialMergeWorld": "area55",
          "bestScore": 191363,
          "wildSpawnCount": 6,
          "columns": 5,
          "starsCount": 0,
          "combo": 1,
          "earnedComboBonus": 23568,
          "board": 24,
          "stage": 24,
          "maxMoves": 50,
          "maxStackDepth": 4,
          "lastWildDropType": "wild-tnt",
          "cubesCracked": 31,
          "score": 7458,
          "rows": 9,
          "tiles": [
            {"variant":"bloob-ball","transientSpawn":false,"resolutionOwned":false,"magnetOwned":false,"id":"native:3:12:3:1:die:2","nonFinalMerge6":false,"locked":false,"visible":true,"merge6CleanupOwned":false,"sourceResidualWildPresence":false,"archetype":"wild-tnt","cell":{"row":1,"column":3},"stackDepth":1,"alpha":1,"pendingRemoval":false,"starOrbitCount":3,"sourceWildStateCleared":false,"value":6},
            {"transientSpawn":false,"resolutionOwned":false,"magnetOwned":false,"id":"native:3:38:2:3:die:30:locked","nonFinalMerge6":false,"locked":true,"visible":true,"merge6CleanupOwned":false,"sourceResidualWildPresence":false,"cell":{"row":3,"column":2},"stackDepth":1,"pendingRemoval":false,"alpha":0.2,"starOrbitCount":3,"sourceWildStateCleared":false,"value":0},
            {"transientSpawn":false,"resolutionOwned":false,"magnetOwned":false,"id":"native:3:38:3:4:die:31:locked","nonFinalMerge6":false,"locked":false,"visible":true,"merge6CleanupOwned":false,"sourceResidualWildPresence":false,"cell":{"row":4,"column":3},"stackDepth":1,"pendingRemoval":false,"alpha":1,"starOrbitCount":3,"sourceWildStateCleared":false,"value":1},
            {"transientSpawn":false,"resolutionOwned":false,"magnetOwned":false,"id":"native:3:38:2:1:die:32:locked","nonFinalMerge6":false,"locked":true,"visible":true,"merge6CleanupOwned":false,"sourceResidualWildPresence":false,"cell":{"row":1,"column":2},"stackDepth":1,"pendingRemoval":false,"alpha":0.2,"starOrbitCount":3,"sourceWildStateCleared":false,"value":0},
            {"transientSpawn":false,"resolutionOwned":false,"magnetOwned":false,"id":"native:3:38:4:2:die:33:locked","nonFinalMerge6":false,"locked":true,"visible":true,"merge6CleanupOwned":false,"sourceResidualWildPresence":false,"cell":{"row":2,"column":4},"stackDepth":1,"pendingRemoval":false,"alpha":0.2,"starOrbitCount":3,"sourceWildStateCleared":false,"value":0},
            {"transientSpawn":false,"resolutionOwned":false,"magnetOwned":false,"id":"native:3:38:4:3:die:35:locked","nonFinalMerge6":false,"locked":true,"visible":true,"merge6CleanupOwned":false,"sourceResidualWildPresence":false,"cell":{"row":3,"column":4},"stackDepth":1,"pendingRemoval":false,"alpha":0.2,"starOrbitCount":3,"sourceWildStateCleared":false,"value":0},
            {"transientSpawn":false,"resolutionOwned":false,"magnetOwned":false,"id":"native:3:38:4:6:die:36:locked","nonFinalMerge6":false,"locked":false,"visible":true,"merge6CleanupOwned":false,"sourceResidualWildPresence":false,"cell":{"column":4,"row":6},"stackDepth":1,"pendingRemoval":false,"alpha":1,"starOrbitCount":3,"sourceWildStateCleared":false,"value":2},
            {"transientSpawn":false,"resolutionOwned":false,"magnetOwned":false,"id":"native:3:42:1:3:die:41","nonFinalMerge6":false,"locked":false,"visible":true,"merge6CleanupOwned":false,"sourceResidualWildPresence":false,"cell":{"column":1,"row":3},"stackDepth":1,"pendingRemoval":false,"alpha":1,"starOrbitCount":3,"sourceWildStateCleared":false,"value":4},
            {"resolutionOwned":false,"transientSpawn":false,"sourceResidualWildPresence":false,"cell":{"column":0,"row":1},"id":"native:3:42:0:1:die:42:locked","sourceWildStateCleared":false,"alpha":1,"starOrbitCount":3,"stackDepth":1,"visible":true,"value":1,"pendingRemoval":false,"locked":false,"nonFinalMerge6":false,"merge6CleanupOwned":false,"magnetOwned":false},
            {"resolutionOwned":false,"transientSpawn":false,"sourceResidualWildPresence":false,"cell":{"column":1,"row":8},"id":"native:3:42:1:8:die:43:locked","sourceWildStateCleared":false,"alpha":0.20000000298023224,"starOrbitCount":3,"stackDepth":1,"visible":true,"value":0,"pendingRemoval":false,"locked":true,"nonFinalMerge6":false,"merge6CleanupOwned":false,"magnetOwned":false},
            {"resolutionOwned":false,"transientSpawn":false,"sourceResidualWildPresence":false,"cell":{"column":1,"row":1},"id":"native:3:42:1:1:die:44:locked","sourceWildStateCleared":false,"alpha":0.20000000298023224,"starOrbitCount":3,"stackDepth":1,"visible":true,"value":0,"pendingRemoval":false,"locked":true,"nonFinalMerge6":false,"merge6CleanupOwned":false,"magnetOwned":false},
            {"resolutionOwned":false,"transientSpawn":false,"sourceResidualWildPresence":false,"cell":{"column":4,"row":1},"id":"native:3:42:4:1:die:45:locked","sourceWildStateCleared":false,"alpha":0.20000000298023224,"starOrbitCount":3,"stackDepth":1,"visible":true,"value":0,"pendingRemoval":false,"locked":true,"nonFinalMerge6":false,"merge6CleanupOwned":false,"magnetOwned":false},
            {"resolutionOwned":false,"transientSpawn":false,"sourceResidualWildPresence":false,"cell":{"column":3,"row":3},"id":"native:3:42:3:3:die:46:locked","sourceWildStateCleared":false,"alpha":0.20000000298023224,"starOrbitCount":3,"stackDepth":1,"visible":true,"value":0,"pendingRemoval":false,"locked":true,"nonFinalMerge6":false,"merge6CleanupOwned":false,"magnetOwned":false},
            {"resolutionOwned":false,"transientSpawn":false,"sourceResidualWildPresence":false,"cell":{"column":4,"row":5},"id":"native:3:42:4:5:die:47:locked","sourceWildStateCleared":false,"alpha":0.20000000298023224,"starOrbitCount":3,"stackDepth":1,"visible":true,"value":0,"pendingRemoval":false,"locked":true,"nonFinalMerge6":false,"merge6CleanupOwned":false,"magnetOwned":false},
            {"resolutionOwned":false,"transientSpawn":false,"sourceResidualWildPresence":false,"cell":{"column":0,"row":6},"id":"native:3:42:0:6:die:48:locked","sourceWildStateCleared":false,"alpha":0.20000000298023224,"starOrbitCount":3,"stackDepth":1,"visible":true,"value":0,"pendingRemoval":false,"locked":true,"nonFinalMerge6":false,"merge6CleanupOwned":false,"magnetOwned":false},
            {"resolutionOwned":false,"transientSpawn":false,"sourceResidualWildPresence":false,"cell":{"column":1,"row":6},"id":"native:3:42:1:6:die:49:locked","sourceWildStateCleared":false,"alpha":0.20000000298023224,"starOrbitCount":3,"stackDepth":1,"visible":true,"value":0,"pendingRemoval":false,"locked":true,"nonFinalMerge6":false,"merge6CleanupOwned":false,"magnetOwned":false},
            {"resolutionOwned":false,"transientSpawn":false,"sourceResidualWildPresence":false,"cell":{"column":0,"row":7},"id":"native:3:42:0:7:die:50:locked","sourceWildStateCleared":false,"alpha":1,"starOrbitCount":3,"stackDepth":1,"visible":true,"value":3,"pendingRemoval":false,"locked":false,"nonFinalMerge6":false,"merge6CleanupOwned":false,"magnetOwned":false},
            {"resolutionOwned":false,"variant":"laser-gun","sourceResidualWildPresence":false,"cell":{"column":2,"row":6},"id":"native:3:38:2:6:die:28:locked","sourceWildStateCleared":false,"alpha":1,"transientSpawn":false,"starOrbitCount":3,"stackDepth":1,"visible":true,"value":6,"pendingRemoval":false,"locked":false,"nonFinalMerge6":false,"merge6CleanupOwned":false,"magnetOwned":false,"archetype":"wild-tnt"}
          ]
        }
        """
        var board=try JSONDecoder().decode(NativeBoardState.self,from:Data(json.utf8))
        let laser=try XCTUnwrap(board.tiles.first{$0.variant=="laser-gun"})
        let target=try XCTUnwrap(board.tiles.first{$0.cell==NativeCell(column:1,row:3)})
        board.tiles=[laser,target]+board.tiles.filter{$0.id != laser.id && $0.id != target.id}
        XCTAssertEqual(board.tiles.count,18);XCTAssertEqual(board.tiles.filter(\.locked).count,11)
        XCTAssertEqual(board.revision,43);XCTAssertEqual(board.score,7458)
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:false,disposeDuringMain:false,moves:board.moves,capturedBoard:board,verifyFilmLaserFootprints:true)
    }
    func testFilmBoard24TopologyPreservesComposedLockedAndActiveFootprints()async throws {
        try await exerciseFilmBoard24Topology(disableRegularMipmaps:false)
    }
    func testFilmBoard24TopologyWithoutRegularMipmapsPreservesComposedFootprints()async throws {
        try await exerciseFilmBoard24Topology(disableRegularMipmaps:true)
    }
    func testFilmBoard24AfterRepeatedActualMovesPreservesComposedFootprints()async throws {
        try await exerciseFilmBoard24Topology(disableRegularMipmaps:false,warmMoves:true)
    }
    func testFilmBoard24WithPendingSourceSafetySweepPreservesComposedFootprints()async throws {
        try await exerciseFilmBoard24Topology(disableRegularMipmaps:false,pendingSafetySweep:true)
    }
    func testSparseEndgameAfterRepeatedActualMovesPreservesComposedFootprints()async throws {
        for locked in [0,1] {
            try await exerciseFilmBoard24Topology(disableRegularMipmaps:false,warmMoves:true,sparseWarmLocked:locked)
        }
    }
    func testSparseEndgameAfterThreeActualLasersPreservesComposedFootprints()async throws {
        for locked in [0,1] {
            try await exerciseFilmBoard24Topology(disableRegularMipmaps:false,sparseWarmLocked:locked,warmLaserRepeats:true)
        }
    }
    private func exerciseFilmBoard24Topology(disableRegularMipmaps:Bool,warmMoves:Bool=false,pendingSafetySweep:Bool=false,sparseWarmLocked:Int?=nil,warmLaserRepeats:Bool=false)async throws {
        // Movie-derived pre-shot roster. The post-shot save's locked(2,6)
        // replaces the consumed Laser; retaining both would duplicate a cell.
        let fullLocked:[(Int,Int)]=[(2,3),(2,1),(4,2),(4,3),(1,8),(1,1),(4,1),(3,3),(4,5),(0,6),(0,0),(1,4),(2,0),(4,0),(0,4),(2,8),(4,7),(4,8)]
        let locked=sparseWarmLocked.map{Array(fullLocked.prefix($0))} ?? fullLocked
        var tiles:[NativeTile]=[
            .init(id:"film24-laser",cell:.init(column:2,row:6),value:6,archetype:.tnt,variant:"laser-gun"),
            .init(id:"film24-target",cell:.init(column:1,row:3),value:4),
            .init(id:"film24-a",cell:.init(column:0,row:1),value:1),
            .init(id:"film24-b",cell:.init(column:3,row:4),value:1),
            .init(id:"film24-c",cell:.init(column:4,row:6),value:2),
            .init(id:"film24-d",cell:.init(column:0,row:7),value:3),
            .init(id:"film24-orb",cell:.init(column:3,row:1),value:6,archetype:.tnt,variant:"bloob-ball")
        ]
        tiles += locked.map{column,row in NativeTile(id:"film24-locked-\(column)-\(row)",cell:.init(column:column,row:row),value:0,locked:true,alpha:0.2)}
        if warmMoves {
            for (id,column,row,value) in [("warm-six-a",0,8,3),("warm-six-b",3,8,3),("warm-one-a",2,7,1),("warm-one-b",3,7,1),("warm-one-c",1,7,1),("warm-one-d",0,2,1)] {
                tiles.append(.init(id:id,cell:.init(column:column,row:row),value:value))
            }
        }
        if warmLaserRepeats {
            for (index,positions) in [[(0,8),(3,8)],[(2,7),(3,7)],[(4,4),(4,5)]].enumerated() {
                tiles.append(.init(id:"warm-laser-\(index)",cell:.init(column:positions[0].0,row:positions[0].1),value:6,archetype:.tnt,variant:"laser-gun"))
                tiles.append(.init(id:"warm-laser-target-\(index)",cell:.init(column:positions[1].0,row:positions[1].1),value:2))
            }
        }
        let board=NativeBoardState(tiles:tiles,mode:.journey,board:24,stage:24,generation:3,moves:warmMoves || warmLaserRepeats ? 49:5,score:7458)
        XCTAssertEqual(board.tiles.count,7+locked.count+(warmMoves ? 6:0)+(warmLaserRepeats ? 6:0));XCTAssertEqual(board.tiles.filter(\.locked).count,locked.count)
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:false,disposeDuringMain:false,moves:board.moves,capturedBoard:board,verifyFilmLaserFootprints:true,disableFilmRegularMipmaps:disableRegularMipmaps,warmFilmMoves:warmMoves,pendingFilmSafetySweep:pendingSafetySweep,warmFilmLaserRepeats:warmLaserRepeats)
    }
    func testFilmLaserPreservesComposedBoardFootprintsThroughFirstAndLaterContacts()async throws {
        let live:[NativeCell:Int]=[.init(column:0,row:1):1,.init(column:1,row:3):4,.init(column:3,row:4):1,.init(column:4,row:6):2,.init(column:0,row:7):3]
        let laser=NativeTile(id:"film-laser",cell:.init(column:2,row:6),value:6,archetype:.tnt,variant:"laser-gun")
        let target=NativeTile(id:"film-target",cell:.init(column:1,row:3),value:4)
        var tiles=[laser,target]
        for row in 0..<9 {for column in 0..<5 {
            let cell=NativeCell(column:column,row:row)
            if cell==laser.cell || cell==target.cell {continue}
            if column==3 && row==1 {tiles.append(.init(id:"film-orb",cell:cell,value:6,archetype:.star,variant:"bloob-ball"))}
            else if let value=live[cell] {tiles.append(.init(id:"film-\(column)-\(row)",cell:cell,value:value))}
            else {tiles.append(.init(id:"film-\(column)-\(row)",cell:cell,value:0,locked:true,alpha:0.25))}
        }}
        let board=NativeBoardState(tiles:tiles,mode:.journey,board:26,generation:9,moves:49)
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:false,disposeDuringMain:false,moves:49,capturedBoard:board,verifyFilmLaserFootprints:true)
    }
    func testSparseLaserKeepsUncontactedDiceContinuousWithAndWithoutLockedHolders()async throws {
        try await exerciseSparseLaserMatrix(verifyContactBody:false)
    }
    func testSparseLaserHitKeepsExistingBodyVisibleThroughoutReplacementBounce()async throws {
        try await exerciseSparseLaserMatrix(verifyContactBody:true)
    }
    private func exerciseSparseLaserMatrix(verifyContactBody:Bool)async throws {
        for locked in [false,true] {for arcade in [false,true] {for reverse in [false,true] {
            var sparse=NativeBoardState(tiles:[
                .init(id:"sparse-laser",cell:.init(column:0,row:0),value:6,archetype:.tnt,variant:"laser-gun"),
                .init(id:"sparse-destination",cell:.init(column:1,row:0),value:2),
                .init(id:"sparse-a",cell:.init(column:2,row:1),value:1),
                .init(id:"sparse-b",cell:.init(column:4,row:3),value:3),
                .init(id:"sparse-c",cell:.init(column:0,row:5),value:4),
                .init(id:"sparse-d",cell:.init(column:2,row:7),value:2)
            ],mode:.journey,board:26,generation:9,moves:49)
            if locked {sparse.tiles.append(.init(id:"sparse-locked",cell:.init(column:4,row:8),value:0,locked:true,alpha:0.25))}
            try await exercise(archetype:.tnt,variant:"laser-gun",reverse:reverse,disposeDuringMain:false,moves:49,capturedBoard:sparse,arcadeRun:arcade,verifySparseLaserContinuity:true,verifyLaserContactBodyContinuity:verifyContactBody)
        }}}
    }
    func testLaserUntouchedAndLaterTargetsStayVisibleUntilTheirOwnContact()async throws {
        for arcade in [false,true] {for reverse in [false,true] {
            try await exercise(archetype:.tnt,variant:"laser-gun",reverse:reverse,disposeDuringMain:false,moves:49,arcadeRun:arcade,verifyLaserContinuity:true)
        }}
    }
    func testLaserEveryActualContactUsesOrdinaryMergeSixSmokeAndShardsAndSettlesBothDirections()async throws {
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:false,disposeDuringMain:false)
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:true,disposeDuringMain:false)
    }
    func testLaserReplacementStackDuringBounceSettlesAndAdmitsNextMove()async throws {
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:false,disposeDuringMain:false,laserInterveningStack:true)
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:true,disposeDuringMain:false,laserInterveningStack:true)
    }
    func testLaserReplacementMergeSixDuringBounceSettlesAndAdmitsNextMove()async throws {
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:false,disposeDuringMain:false,moves:49,laserInterveningStack:true,laserInterveningSix:true)
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:true,disposeDuringMain:false,moves:49,laserInterveningStack:true,laserInterveningSix:true)
    }
    func testLaserLastMoveReplacementMergeSixSettlesAndAdmitsNextMove()async throws {
        for arcade in [false,true] {for reverse in [false,true] {
            try await exercise(archetype:.tnt,variant:"laser-gun",reverse:reverse,disposeDuringMain:false,moves:1,laserInterveningStack:true,laserInterveningSix:true,arcadeRun:arcade)
        }}
    }
    func testArcadeLaserReplacementStackDuringBounceSettlesAndAdmitsNextMove()async throws {
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:false,disposeDuringMain:false,laserInterveningStack:true,arcadeRun:true)
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:true,disposeDuringMain:false,laserInterveningStack:true,arcadeRun:true)
    }
    func testChargedLaserReplacementInterruptionReleasesMeterQueueAndContinues()async throws {
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:false,disposeDuringMain:false,laserInterveningStack:true,initialMeter:0.8)
        try await exercise(archetype:.tnt,variant:"laser-gun",reverse:true,disposeDuringMain:false,laserInterveningStack:true,arcadeRun:true,initialMeter:0.8)
    }
    func testCoreTNTArcadeDestinationActualImpactSharedLayersSettleAndContinue()async throws {
        try await exercise(archetype:.tnt,variant:nil,reverse:true,disposeDuringMain:false,moves:49,arcadeRun:true)
    }
    func testCoreTNTDestinationActualImpactSharedLayersSettleAndContinue()async throws {
        // A restored fixture must contain a committed move;50/50 is correctly
        // treated as unplayed and replaced before any TNT presentation exists.
        try await exercise(archetype:.tnt,variant:nil,reverse:true,disposeDuringMain:false,moves:49)
    }
    func testTutorialAssistFinalStarMergeShowsCompletionAndContinue()async throws {
        try await exercise(archetype:.star,variant:nil,reverse:true,disposeDuringMain:false,finalOnly:true,starCount:0,tutorialAssist:true)
    }
    func testArcadeTutorialResultContinueReplacesSourceGenerationAndAdmitsNextMove()async throws {
        try await exercise(archetype:.star,variant:nil,reverse:true,disposeDuringMain:false,finalOnly:true,starCount:0,tutorialAssist:true,arcadeTutorial:true)
    }
    func testArcadeStarArchetypesUseJourneyDropsAndAdmitNextActualDrag()async throws {
        for (index,variant) in ([nil,"fish","kanta","cubero","bee"] as [String?]).enumerated() {
            try await exercise(archetype:.star,variant:variant,reverse:index%2==1,disposeDuringMain:false,starCount:1+index%3,arcadeRun:true)
        }
    }
    func testStarSourceAndDestinationSettleAndAdmitNextActualDrag()async throws {
        // A restored fixture must contain a committed move; untouched50/50
        // layouts correctly restart with ordinary opening dice.
        try await exercise(archetype:.star,variant:nil,reverse:false,disposeDuringMain:false,moves:49)
        try await exercise(archetype:.star,variant:nil,reverse:true,disposeDuringMain:false,moves:49)
    }
    func testActualStarFinaleKeepsSixtyHzAfterMainParticlesRetire()async throws {
        try await exercise(archetype:.star,variant:nil,reverse:false,disposeDuringMain:false,verifyStarTail:true)
        try await exercise(archetype:.star,variant:nil,reverse:true,disposeDuringMain:false,verifyStarTail:true)
    }
    func testFinalOnlyStarSourceAndDestinationCompleteInsteadOfReturningToMenu()async throws {
        for count in [0,3] {
            try await exercise(archetype:.star,variant:nil,reverse:false,disposeDuringMain:false,moves:49,finalOnly:true,starCount:count)
            try await exercise(archetype:.star,variant:nil,reverse:true,disposeDuringMain:false,moves:49,finalOnly:true,starCount:count)
        }
    }
    func testZeroOrbitStarDestinationNonFinalRetainsGameplayAndContinues()async throws {
        try await exercise(archetype:.star,variant:nil,reverse:true,disposeDuringMain:false,starCount:0)
    }
    func testCapturedPhoneFinalStarDestinationWithZeroMovesCompletes()async throws {
        // Read-only GOTOVO capture: exact durable final pair before the refused
        // last Star merge, including moves0, revision52 and source identities.
        let data=Data(#"{"bestScore":20397,"board":2,"columns":5,"combo":4,"cubesCracked":28,"earnedComboBonus":23025,"generation":19,"lastWildDropType":"wild","longestCombo":43,"maxMoves":50,"maxStackDepth":3,"mode":"journey","moves":0,"revision":52,"rngState":1,"rows":9,"score":9173,"stage":2,"starsCount":0,"tiles":[{"alpha":1,"archetype":"wild","cell":{"column":2,"row":3},"id":"native:18:43:2:3:die:29","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":0,"transientSpawn":false,"value":6,"visible":true},{"alpha":1,"cell":{"column":0,"row":8},"id":"native:19:52:0:8:die:3","locked":false,"magnetOwned":false,"merge6CleanupOwned":false,"nonFinalMerge6":false,"pendingRemoval":false,"resolutionOwned":false,"sourceResidualWildPresence":false,"sourceWildStateCleared":false,"stackDepth":1,"starOrbitCount":3,"transientSpawn":false,"value":3,"visible":true}],"wildDropTypeStreak":5,"wildMeter":0.9519999999999996,"wildSpawnCount":5}"#.utf8)
        let board=try JSONDecoder().decode(NativeBoardState.self,from:data)
        try await exercise(archetype:.star,variant:nil,reverse:true,disposeDuringMain:false,finalOnly:true,starCount:0,capturedBoard:board)
    }
    func testFreshMeterStarDestinationAfterOrdinaryMergeRetainsGameplay()async throws {
        try await exercise(archetype:.star,variant:nil,reverse:true,disposeDuringMain:false,starCount:0,freshStar:true)
    }
    func testBloobGasBarrelSettlesBothDirectionsAndModes()async throws {
        for arcade in [false,true] {for reverse in [false,true] {
            try await exercise(archetype:.tnt,variant:"bloob-ball",reverse:reverse,disposeDuringMain:false,moves:49,starCount:2,arcadeRun:arcade)
        }}
        for reverse in [false,true] {
            try await exercise(archetype:.tnt,variant:"bloob-ball",reverse:reverse,disposeDuringMain:false,moves:49,finalOnly:true,starCount:2)
        }
    }
    func testKiteCalmHeroIsVisibleInActualMerge()async throws {
        try await exercise(archetype:.star,variant:"kite",reverse:false,disposeDuringMain:false,moves:49)
    }
    func testKiteSourceDestinationAndFinalFlowsInBothModes()async throws {
        for arcade in [false,true] {for final in [false,true] {for reverse in [false,true] {
            try await exercise(archetype:.star,variant:"kite",reverse:reverse,disposeDuringMain:false,moves:49,finalOnly:final,arcadeRun:arcade)
        }}}
    }
    func testBeeSourceAndDestinationSettleAndAdmitNextActualDrag()async throws {
        try await exercise(archetype:.star,variant:"bee",reverse:false,disposeDuringMain:false,moves:49)
        try await exercise(archetype:.star,variant:"bee",reverse:true,disposeDuringMain:false,moves:49)
    }
    func testHiddenVariantDropCountsSettleWithoutOrbitPresentation()async throws {
        for (variant,count) in [("fish",1),("kanta",2),("cubero",3)] {
            for reverse in [false,true] {
                try await exercise(archetype:.star,variant:variant,reverse:reverse,disposeDuringMain:false,starCount:count)
            }
        }
    }
    func testFishSourceAndDestinationSettleAndAdmitNextActualDrag()async throws {
        try await exercise(archetype:.star,variant:"fish",reverse:false,disposeDuringMain:false)
        try await exercise(archetype:.star,variant:"fish",reverse:true,disposeDuringMain:false)
    }
    func testSpaceshipOrdinaryContactDuringPullAndAfterBoardCommitReleasesAllOwners()async throws {
        try await exercise(archetype:.magnet,variant:"spaceship",reverse:false,disposeDuringMain:false,interveningOrdinary:true)
        try await exercise(archetype:.magnet,variant:"spaceship",reverse:true,disposeDuringMain:false,interveningOrdinary:true)
    }
    func testSpaceshipOrdinaryMergeSixAfterBoardCommitReleasesAllOwners()async throws {
        try await exercise(archetype:.magnet,variant:"spaceship",reverse:false,disposeDuringMain:false,interveningOrdinary:true,interveningSix:true)
        try await exercise(archetype:.magnet,variant:"spaceship",reverse:true,disposeDuringMain:false,interveningOrdinary:true,interveningSix:true)
    }
    func testSpaceshipHeldOrdinaryDragAcrossHelperFinallyAndRapidContactsRemainPlayable()async throws {
        for reverse in [false,true] {
            try await exercise(archetype:.magnet,variant:"spaceship",reverse:reverse,disposeDuringMain:false,
                interveningOrdinary:true,heldOrdinaryMilliseconds:1600,rapidOrdinaryContacts:5)
            try await exercise(archetype:.magnet,variant:"spaceship",reverse:reverse,disposeDuringMain:false,
                interveningOrdinary:true,interveningSix:true,rapidOrdinaryContacts:5)
        }
    }
    func testBottleGridKeepsPullAndSurvivorBouncePlayableBothDirections()async throws {
        for reverse in [false,true] {
            try await exercise(archetype:.magnet,variant:"bottle",reverse:reverse,disposeDuringMain:false,moves:49,verifySurvivorEntry:true)
        }
    }
    func testEveryMagnetFamilySurvivorHasVisibleFreshFaceBounceBothDirections()async throws {
        for variant in [String?.none,"spaceship","bottle","honey"] {
            for reverse in [false,true] {
                try await exercise(archetype:.magnet,variant:variant,reverse:reverse,disposeDuringMain:false,moves:49,verifySurvivorEntry:true)
            }
        }
    }
    func testSpaceshipSourceActualSourceParticlesSettleAndContinue()async throws {
        try await exercise(archetype:.magnet,variant:"spaceship",reverse:false,disposeDuringMain:false)
    }
    func testMagnetSourcePullsVisibleKantaAndCompletesItsActualRestoredMove()async throws {
        try await exercise(archetype:.magnet,variant:nil,reverse:false,disposeDuringMain:false,pulledKanta:true,moves:34)
    }
    func testMagnetDestinationPullsVisibleKantaAndCompletesItsActualRestoredMove()async throws {
        try await exercise(archetype:.magnet,variant:nil,reverse:true,disposeDuringMain:false,pulledKanta:true,moves:34)
    }
    func testBloobBallActualSourceBothModesFinalAndNonfinal()async throws {
        for arcade in [false,true] {for final in [false,true] {
            try await exercise(archetype:.tnt,variant:"bloob-ball",reverse:arcade,disposeDuringMain:false,moves:49,finalOnly:final,arcadeRun:arcade)
        }}
    }
    func testCoconutJourneyFinalSource()async throws {
        try await exercise(archetype:.tnt,variant:"coconut",reverse:false,disposeDuringMain:false,moves:49,finalOnly:true,arcadeRun:false)
    }
    func testCoconutArcadeFinalDestination()async throws {
        try await exercise(archetype:.tnt,variant:"coconut",reverse:true,disposeDuringMain:false,moves:49,finalOnly:true,arcadeRun:true)
    }
    func testBloobJourneyBlockerSource()async throws {
        try await exercise(archetype:.star,variant:"bloob",reverse:false,disposeDuringMain:false,moves:49,finalOnly:false,starCount:1,arcadeRun:false)
    }
    func testBloobJourneyBlockerDestination()async throws {
        try await exercise(archetype:.star,variant:"bloob",reverse:true,disposeDuringMain:false,moves:49,finalOnly:false,starCount:1,arcadeRun:false)
    }
    func testBloobJourneyFinalSource()async throws {
        try await exercise(archetype:.star,variant:"bloob",reverse:false,disposeDuringMain:false,moves:49,finalOnly:true,starCount:1,arcadeRun:false)
    }
    func testBloobJourneyFinalDestination()async throws {
        try await exercise(archetype:.star,variant:"bloob",reverse:true,disposeDuringMain:false,moves:49,finalOnly:true,starCount:1,arcadeRun:false)
    }
    func testBloobArcadeBlockerSource()async throws {
        try await exercise(archetype:.star,variant:"bloob",reverse:false,disposeDuringMain:false,moves:49,finalOnly:false,starCount:1,arcadeRun:true)
    }
    func testBloobArcadeBlockerDestination()async throws {
        try await exercise(archetype:.star,variant:"bloob",reverse:true,disposeDuringMain:false,moves:49,finalOnly:false,starCount:1,arcadeRun:true)
    }
    func testBloobArcadeFinalSource()async throws {
        try await exercise(archetype:.star,variant:"bloob",reverse:false,disposeDuringMain:false,moves:49,finalOnly:true,starCount:1,arcadeRun:true)
    }
    func testBloobArcadeFinalDestination()async throws {
        try await exercise(archetype:.star,variant:"bloob",reverse:true,disposeDuringMain:false,moves:49,finalOnly:true,starCount:1,arcadeRun:true)
    }
    func testFinalBoardClearCelebrationUsesBoundedVisualTailAcrossAllFamilies()async throws {
        let bases:[(NativeWildArchetype,String?)]=NativeWildArchetype.allCases.map{($0,nil)}
        let variants=NativeSpecialDiceRegistry.variants.values.sorted{$0.id<$1.id}.map{($0.archetype,Optional($0.id))}
        let cases=bases + variants
        for (index,item) in cases.enumerated() {
            try await exercise(archetype:item.0,variant:item.1,reverse:index % 2 == 0,
                disposeDuringMain:false,moves:49,finalOnly:true,arcadeRun:true,verifyBoardCleared:true)
        }
    }

    func testKiteAndJourneyBarrelUseTheSharedVisualTail()async throws {
        try await exercise(archetype:.star,variant:"kite",reverse:false,disposeDuringMain:false,moves:49,finalOnly:true,arcadeRun:true,verifyBoardCleared:true)
        try await exercise(archetype:.star,variant:"kite",reverse:true,disposeDuringMain:false,moves:49,finalOnly:true,verifyBoardCleared:true)
        try await exercise(archetype:.tnt,variant:"barell",reverse:true,disposeDuringMain:false,moves:49,finalOnly:true,verifyBoardCleared:true)
    }

    func testBeachBallBoardClearFollowsActualLastBallInBothModesAndDirections()async throws {
        for (arcade,reverse) in [(true,false),(true,true),(false,false)] {
            try await exercise(archetype:.juice,variant:"beach-ball",reverse:reverse,disposeDuringMain:false,
                moves:49,finalOnly:true,arcadeRun:arcade,verifyBoardCleared:true)
        }
    }
    func testJourneyBoardClearProgressForBottleAndCoconut()async throws {
        try await exercise(archetype:.magnet,variant:"bottle",reverse:true,disposeDuringMain:false,moves:49,finalOnly:true,verifyBoardCleared:true)
        try await exercise(archetype:.tnt,variant:"coconut",reverse:false,disposeDuringMain:false,moves:49,finalOnly:true,verifyBoardCleared:true)
    }
    private func exercise(archetype:NativeWildArchetype,variant:String?,reverse:Bool,disposeDuringMain:Bool=true,pulledKanta:Bool=false,moves:Int=49,finalOnly:Bool=false,starCount:Int=3,capturedBoard:NativeBoardState?=nil,freshStar:Bool=false,verifyStarTail:Bool=false,interveningOrdinary:Bool=false,interveningSix:Bool=false,heldOrdinaryMilliseconds:Int=160,rapidOrdinaryContacts:Int=0,tutorialAssist:Bool=false,arcadeTutorial:Bool=false,laserInterveningStack:Bool=false,laserInterveningSix:Bool=false,arcadeRun:Bool=false,initialMeter:Double?=nil,verifyBaloonRetirement:Bool=false,verifyBoardScale:Bool=false,verifyQueuedBonus:Bool=false,verifyLaserContinuity:Bool=false,verifySparseLaserContinuity:Bool=false,verifyLaserContactBodyContinuity:Bool=false,verifyFilmLaserFootprints:Bool=false,disableFilmRegularMipmaps:Bool=false,warmFilmMoves:Bool=false,pendingFilmSafetySweep:Bool=false,warmFilmLaserRepeats:Bool=false,verifySurvivorEntry:Bool=false,verifyBoardCleared:Bool=false)async throws {
        let label=(variant ?? archetype.rawValue)+(reverse ? ":destination":":source")
        print("[WildMergeSixRoot] start \(label)")
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("wild-six-particles-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        envelope.progression.firstPlayTutorialComplete=true;envelope.progression.completedJourneyBoards=Set(1..<(variant=="bloob" ? 27:26))
        var board=NativeBoardFactory.make(mode:.journey,board:variant=="bloob" ? 27:26,generation:9,seed:7)
        for i in board.tiles.indices {board.tiles[i].value=0;board.tiles[i].locked=true;board.tiles[i].alpha=0.25}
        for (i,value) in (finalOnly ? [(0,6),(1,2)]:[(0,6),(1,2),(2,1),(3,1),(40,1)]) {
            board.tiles[i].value=value;board.tiles[i].locked=false;board.tiles[i].alpha=1
        }
        if variant=="bottle",!finalOnly,capturedBoard==nil {
            board.tiles[4].value=1;board.tiles[4].locked=false;board.tiles[4].alpha=1
        }
        if interveningOrdinary || laserInterveningStack {
            for i in [2,3,4,5,40,41] {board.tiles[i].value=1;board.tiles[i].locked=false;board.tiles[i].alpha=1}
            if interveningSix {board.tiles[40].value=3;board.tiles[41].value=3}
        }
        if laserInterveningSix {
            for i in 2..<25 {board.tiles[i].value=1+(i % 5);board.tiles[i].locked=false;board.tiles[i].alpha=1}
        }
        if verifyLaserContinuity {
            for i in 2..<40 {board.tiles[i].value=1+(i % 4);board.tiles[i].locked=false;board.tiles[i].alpha=1}
            for (index,kind,name) in [(10,NativeWildArchetype.tnt,"laser-gun"),(20,.tnt,"flower"),(30,.star,"")] {
                board.tiles[index].value=6;board.tiles[index].archetype=kind;board.tiles[index].variant=name.isEmpty ? nil:name
            }
        }
        board.tiles[0].archetype=archetype;board.tiles[0].variant=variant;board.tiles[0].starOrbitCount=starCount
        if tutorialAssist {var tutorial=NativeTutorialState();tutorial.active=false;tutorial.guideCompleted=true;tutorial.completionAssist=true;tutorial.step = .freePlay;board.tutorial=tutorial}
        board.moves=laserInterveningStack ? min(moves,49):moves
        if let initialMeter {board.wildMeter=initialMeter}
        if freshStar {board.tiles[0].archetype=nil;board.tiles[0].variant=nil;board.tiles[0].value=1;board.wildMeter=0.99}
        if pulledKanta {board.tiles[2].value=6;board.tiles[2].archetype = .star;board.tiles[2].variant="kanta"}
        if let capturedBoard {board=capturedBoard;envelope.progression.completedJourneyBoards=Set(1..<board.board)}
        if arcadeTutorial || arcadeRun {board.mode = .arcade;board.board=1}
        let boardNumber=board.board
        if arcadeTutorial || arcadeRun {envelope.arcadeRun=board;envelope.arcadeRunSavedAt=Date().timeIntervalSince1970}
        else {envelope.journeyRuns[boardNumber]=board}
        try store.save(envelope)
        weak var drawingScene:NativeBoardScene?
        var drawPhases:[String]=[],drawCount=0
        if variant=="bloob-ball" || variant=="bloob" || variant=="coconut" || variant=="kite" {
            // Component rendering can let the ordinary test-host intro begin.
            // Wait for its finite shared clock; never bypass transport ownership.
            try await wait(label+":host-transport-idle") {
                let clock=NativeSourceAnimationClockService.shared
                return clock.activeParticipantCount==0 && clock.pendingSourceAnimationFrameCount==0 && clock.sourceTickerListenerCount==0
            }
        }
        let host=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:store,
            sourceVisualRandom:{
                if let phase=drawingScene?.sourceWildFXDrawingPhase {drawPhases.append(phase)}
                defer{drawCount+=1}
                return 0.1+Double(drawCount % 7)*0.01
            },completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        if interveningOrdinary || verifyLaserContinuity || verifySparseLaserContinuity || verifyFilmLaserFootprints {window.windowScene=try XCTUnwrap(previous?.windowScene,"Overlap/Laser continuity fixture must mount on the actual Simulator UIWindowScene")}
        window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory);timeoutDiagnostic=nil;boardScaleAudit=nil}
        host.loadViewIfNeeded();let app=try XCTUnwrap(host.children.first as? NativeAppController)
        func game()->NativeGameplayViewController? {app.children.compactMap{$0 as? NativeGameplayViewController}.first}
        timeoutDiagnostic={"route=\(app.route) homeHidden=\(app.home.isHidden) worldReady=\(app.world?.isReadyForInput==true) gameplay=\(game() != nil)"}
        try await wait(label+":home"){!app.home.isHidden}
        app.navigate(arcadeTutorial || arcadeRun ? .gameplay:.world(boardNumber < 26 ? 1:3),interrupt:true)
        try await wait(label+":world") {
            if game() != nil{return true}
            app.world?.onRequest?("continue",boardNumber)
            return false
        }
        try await wait(label+":entry"){game()?.boardScene?.isBoardEntryComplete==true && game()?.beforeSourceGameplayAdmission==nil}
        let gameplay=try XCTUnwrap(game()),scene=try XCTUnwrap(gameplay.boardScene),scope=try XCTUnwrap(gameplay.sourceScope)
        drawingScene=scene
        var clearProgress:[Double]=[],clearVoices=0
        if verifyBoardCleared {
            let previousProgress=scene.onFinalMergeProgress,previousVoice=gameplay.onRoundWon
            scene.onFinalMergeProgress={seconds,duration,generation in
                clearProgress.append(seconds/duration);previousProgress?(seconds,duration,generation)
            }
            gameplay.onRoundWon={generation in clearVoices += 1;previousVoice?(generation)}
        }
        timeoutDiagnostic={"route=\(app.route) failureScope=\(scope.current) unsavable=\(gameplay.engine.hasUnsavableSourceGameplayState) HUD=\(gameplay.engine.pendingHUDStars) pullOwners=\(scene.sourceMagnetActualPullOwnerCount) survivorInput=\(scene.sourceMagnetSurvivorPendingInputIDs) revision=\(gameplay.engine.state.revision) flags=\(gameplay.engine.flags) mainEntered=\(gameplay.engine.sourceSpecialAbsorbMainEntered) lazy=\(String(describing:gameplay.engine.pendingSourceMagnetLazyRespawn)) special=\(String(describing:gameplay.engine.pendingSpecial)) direct=\(String(describing:gameplay.engine.pendingDirectWild)) shards=\(scene.sourceWildSixShardOwnerCount) smoke=\(scope.smoke.activeOwnerCount)"}
        var wildID=board.tiles[0].id,targetID=board.tiles[1].id
        if !freshStar {
            XCTAssertEqual(gameplay.engine.state.tiles.first{$0.id==wildID}?.variant,variant)
            XCTAssertEqual(gameplay.engine.state.tiles.first{$0.id==wildID}?.gameplayArchetype,archetype)
        }
        if warmFilmMoves {
            for (source,target) in [("warm-six-a","warm-six-b"),("warm-one-a","warm-one-b"),("warm-one-c","warm-one-b"),("warm-one-d","warm-one-b")] {
                try await drag(source,target,holdMilliseconds:20)
                try await wait(label+":warm-history-"+source){!gameplay.engine.hasUnsavableSourceGameplayState && !gameplay.engine.isDragging}
                print("[LaserFilmWarm] actual accepted move \(source)->\(target) revision=\(gameplay.engine.state.revision)")
            }
        }
        if warmFilmLaserRepeats {
            for index in 0..<3 {
                try await drag("warm-laser-\(index)","warm-laser-target-\(index)",holdMilliseconds:20)
                try await wait(label+":warm-Laser-\(index)"){
                    !gameplay.engine.hasUnsavableSourceGameplayState && !gameplay.engine.isDragging && gameplay.engine.pendingSpecial==nil && gameplay.engine.pendingHUDStars.isEmpty && !gameplay.view.subviews.compactMap{$0 as? NativeLaserGunImpactPresentation}.contains(where:{$0.hasActiveClock})
                }
                print("[LaserFilmWarm] actual complete Laser \(index+1) same scene generation=\(gameplay.engine.state.generation) revision=\(gameplay.engine.state.revision) tiles=\(gameplay.engine.state.tiles.count)")
            }
        }
        var survivorEntrySamples:[CGFloat]=[]
        if verifySurvivorEntry {
            let previous=scene.onRenderSurfacePreparation
            scene.onRenderSurfacePreparation={ [weak scene] in
                previous?()
                guard let scene else{return}
                for id in [wildID,targetID] {
                    guard let tile=scene.engine.state.tiles.first(where:{$0.id==id}),!tile.isWild,!tile.locked,tile.value>0,
                          let node=scene.sourceNativeTileNode(id),!node.isSpecial,node.sourceAppSpawnOwnsOuterScale else{continue}
                    survivorEntrySamples.append(node.sourceLocalScale.x)
                }
            }
        }
        if verifyBoardScale {
            let mergedPair=Set(board.tiles.prefix(2).map(\.id))
            var reported=Set<String>()
            boardScaleAudit={
                for tile in gameplay.engine.state.tiles where !mergedPair.contains(tile.id) && !tile.isWild {
                    guard !tile.magnetOwned,!tile.pendingRemoval,!tile.resolutionOwned,
                          let node=scene.sourceNativeTileNode(tile.id),!node.isSpecial,!node.sourceMagnetPullProtected,node.parent != nil,
                          !node.isHidden,node.alpha>0.01,!node.visual.isHidden,
                          let face=node.visual.children.compactMap({$0 as? SKSpriteNode}).first(where:{$0.texture === node.sourcePaintedNumbersTexture}) else{continue}
                    let message="\(label) tile=\(tile.id) value=\(tile.value) locked=\(tile.locked) face=\(face.frame.size) outer=\(node.sourceLocalScale) visual=\(node.visual.xScale),\(node.visual.yScale) owners=\(node.sourceOuterOwners) appBounce=\(node.sourceAppSpawnOwnsOuterScale)"
                    if abs(face.frame.width-128)>0.001 || abs(face.frame.height-128)>0.001 {
                        if reported.insert(tile.id+":face").inserted {XCTFail(message)}
                    }
                    if scene.sourceOwnsNewFaceEntry(tile.id) {
                        let outerUnit=abs(node.sourceLocalScale.x-1)<0.001 && abs(node.sourceLocalScale.y-1)<0.001
                        let innerUnit=abs(node.visual.xScale-1)<0.001 && abs(node.visual.yScale-1)<0.001
                        XCTAssertTrue(outerUnit || innerUnit,"Exactly one carrier may scale a fresh face: "+message)
                        let effective=min(node.sourceLocalScale.x*node.visual.xScale,node.sourceLocalScale.y*node.visual.yScale)
                        XCTAssertTrue(effective.isFinite && effective>=0 && effective<1.3,"Fresh entry must remain bounded: "+message)
                    }
                    if !node.sourceOuterOwners.competes && !node.sourceIsBeingSpawned && !node.sourceSkipIdleScaleReset && !scene.sourceOwnsNewFaceEntry(tile.id) && !node.visual.hasActions() {
                        if min(node.sourceLocalScale.x,node.sourceLocalScale.y)<0.94 || min(node.visual.xScale,node.visual.yScale)<0.94 {
                            if reported.insert(tile.id+":scale").inserted {XCTFail(message)}
                        }
                    }
                }
            }
            boardScaleAudit?()
        }
        var filmFootprintSamples=0,filmContactCount=0
        if verifyFilmLaserFootprints {
            let renderHost=try XCTUnwrap(scene.gameplayRenderHost)
            if disableFilmRegularMipmaps {
                var count=0
                for model in gameplay.engine.state.tiles where !model.isWild {
                    if let texture=scene.sourceNativeTileNode(model.id)?.sourcePaintedNumbersTexture {texture.usesMipmaps=false;count+=1}
                }
                XCTAssertGreaterThan(count,0,"Diagnostic A/B must change actual prepared regular textures before drag")
                print("[LaserFilmMipmaps] disabled on \(count) actual regular/locked faces")
            }
            let consumed=Set([wildID,targetID])
            let originals=Dictionary(uniqueKeysWithValues:gameplay.engine.state.tiles.filter{!consumed.contains($0.id)}.compactMap{tile in
                scene.sourceNativeTileNode(tile.id).map{(tile.id,(node:$0,model:tile))}
            })
            func face(_ node:NativeDiceNode)->SKSpriteNode? {
                // Stack layers borrow the same number texture. The actual
                // face is a direct visual child and must win over descendants.
                if let direct=node.visual.children.compactMap({$0 as? SKSpriteNode}).first(where:{$0.texture === node.sourcePaintedNumbersTexture}) {return direct}
                func search(_ root:SKNode)->SKSpriteNode? {
                    if let sprite=root as? SKSpriteNode,sprite.texture === node.sourcePaintedNumbersTexture {return sprite}
                    for child in root.children {if let found=search(child){return found}}
                    return nil
                }
                return search(node.visual)
            }
            func footprint(_ sprite:SKSpriteNode)->CGSize {
                // SpriteKit size already includes the sprite's own scale;
                // convert(to:) needs unscaled local coordinates.
                let local=CGSize(width:sprite.size.width/max(0.0001,abs(sprite.xScale)),height:sprite.size.height/max(0.0001,abs(sprite.yScale)))
                let left = -local.width*sprite.anchorPoint.x,bottom = -local.height*sprite.anchorPoint.y
                let corners=[CGPoint(x:left,y:bottom),CGPoint(x:left+local.width,y:bottom),CGPoint(x:left,y:bottom+local.height)].map{point in
                    renderHost.renderView.convert(renderHost.scenePointToView(sprite.convert(point,to:scene),scene:scene),to:window)
                }
                return CGSize(width:hypot(corners[1].x-corners[0].x,corners[1].y-corners[0].y),height:hypot(corners[2].x-corners[0].x,corners[2].y-corners[0].y))
            }
            func ancestry(_ node:SKNode)->String {
                var rows:[String]=[],current:SKNode?=node
                while let n=current {rows.append("\(n.name ?? String(describing:type(of:n))):s=\(n.xScale),\(n.yScale):a=\(n.alpha):hidden=\(n.isHidden)");current=n.parent}
                return rows.joined(separator:" / ")
            }
            func effectiveAlpha(_ sprite:SKNode)->(hidden:Bool,alpha:CGFloat) {
                var hidden=false,alpha:CGFloat=1,node:SKNode?=sprite
                while let current=node {hidden = hidden || current.isHidden;alpha *= current.alpha;node=current.parent}
                var view:UIView?=renderHost.renderView
                while let current=view {hidden = hidden || current.isHidden;alpha *= current.layer.presentation().map{CGFloat($0.opacity)} ?? current.alpha;view=current.superview}
                return (hidden,alpha)
            }
            var baseline:[String:CGSize]=[:],baselineAlpha:[String:CGFloat]=[:],reported=Set<String>(),contacted=Set<String>()
            for (id,original) in originals where !original.model.isWild {
                let sprite=try XCTUnwrap(face(original.node),"Initial film board face missing: \(id)")
                let intrinsic=sprite.size
                // Existing verifyBoardScale contract already requires a128pt
                // canonical face; distinguish its initial violation from Laser.
                XCTAssertEqual(intrinsic.width,128,accuracy:0.1,"INITIAL before any Laser: canonical face width \(id) \(ancestry(sprite))")
                XCTAssertEqual(intrinsic.height,128,accuracy:0.1,"INITIAL before any Laser: canonical face height \(id) \(ancestry(sprite))")
                let capturedFootprint=footprint(sprite)
                // Capture canonical rest while an accepted prior stack's
                // local pulse is still settling; do not wait past safety timers.
                let pulseX=max(0.0001,abs(original.node.sourceLocalScale.x*original.node.visual.xScale))
                let pulseY=max(0.0001,abs(original.node.sourceLocalScale.y*original.node.visual.yScale))
                baseline[id]=CGSize(width:capturedFootprint.width/pulseX,height:capturedFootprint.height/pulseY)
                let initialAlpha=effectiveAlpha(sprite)
                XCTAssertFalse(initialAlpha.hidden,"INITIAL before any Laser: hidden face \(id)")
                XCTAssertGreaterThan(initialAlpha.alpha,0,"INITIAL before any Laser: transparent face \(id)")
                baselineAlpha[id]=initialAlpha.alpha
            }
            XCTAssertEqual(originals.count,gameplay.engine.state.tiles.filter{!consumed.contains($0.id)}.count)
            let previousPrepare=scene.onRenderSurfacePreparation
            scene.onRenderSurfacePreparation={ [weak self] in previousPrepare?();self?.boardScaleAudit?() }
            boardScaleAudit={
                for (id,original) in originals where !original.model.isWild && !contacted.contains(id) {
                    filmFootprintSamples+=1
                    guard let current=scene.sourceNativeTileNode(id),current === original.node,
                          let canonical=gameplay.engine.state.tiles.first(where:{$0.id==id}),let sprite=face(current),let prior=baseline[id] else {
                        if reported.insert(id+":identity").inserted {XCTFail("Film Laser changed unhit object/face identity: \(id) contacts=\(filmContactCount)")};continue
                    }
                    // A genuinely opened holder may enter its new numbered
                    // face. A still-locked historical holder must never replay
                    // an old bonus pop merely because a later Laser allocated.

                    if original.model.locked && !canonical.locked && canonical.value>0 && scene.sourceOwnsNewFaceEntry(id) {continue}
                    let now=footprint(sprite),width=now.width/max(prior.width,0.0001),height=now.height/max(prior.height,0.0001)
                    let alpha=effectiveAlpha(sprite)
                    if alpha.hidden || alpha.alpha<(baselineAlpha[id] ?? 0)*0.90 || width<0.90 || height<0.90 || width>1.20 || height>1.20 {
                        if reported.insert(id+":footprint").inserted {XCTFail("Film Laser composed footprint changed: \(id) contacts=\(filmContactCount) locked=\(original.model.locked) baseline=\(prior) now=\(now) texture=\(String(describing:sprite.texture?.size())) size=\(sprite.size) stackChildren=\(current.sourceStackLayerNodes.count) ancestry=\(ancestry(sprite)) sceneSize=\(scene.size) hostBounds=\(renderHost.renderView.bounds)")}
                    }
                }
            }
            boardScaleAudit?()
            let present=try XCTUnwrap(scene.onAuthoredLaserImpact)
            scene.onAuthoredLaserImpact={targets,generation,impact,allContacts,completion in
                return present(targets,generation,{index,id in
                    self.boardScaleAudit?();contacted.insert(id);filmContactCount+=1
                    let accepted=impact(index,id);self.boardScaleAudit?();return accepted
                },allContacts,completion)
            }
        }
        var laserContinuitySamples=0,laserContactCount=0,laserLaterTargetSamples=0,laserPresentationCount=0
        if verifyLaserContinuity || verifySparseLaserContinuity {
            let prepareSurface=scene.onRenderSurfacePreparation
            scene.onRenderSurfacePreparation={ [weak self] in
                prepareSurface?();self?.boardScaleAudit?()
            }
            let mergedPair=Set([wildID,targetID])
            let beforeDrag=Dictionary(uniqueKeysWithValues:gameplay.engine.state.tiles.filter{!$0.locked && !$0.isWild && !mergedPair.contains($0.id)}.compactMap{tile in
                scene.sourceNativeTileNode(tile.id).map{(tile.id,($0,tile.value))}
            })
            let beforeDragFaceSizes=beforeDrag.compactMapValues{entry -> CGSize? in
                guard let face=entry.0.visual.children.compactMap({$0 as? SKSpriteNode}).first(where:{$0.texture === entry.0.sourcePaintedNumbersTexture}) else{return nil}
                return face.size
            }
            var sparseContacted=Set<String>(),sparseFailures=Set<String>()
            if verifySparseLaserContinuity {
                XCTAssertEqual(beforeDrag.count,4)
                XCTAssertEqual(beforeDragFaceSizes.count,beforeDrag.count,"Capture every original painted face before drag")
                self.boardScaleAudit={
                    for (id,(original,value)) in beforeDrag where !sparseContacted.contains(id) {
                        laserContinuitySamples+=1
                        guard let tile=gameplay.engine.state.tiles.first(where:{$0.id==id}),let node=scene.sourceNativeTileNode(id) else {
                            if sparseFailures.insert(id+":missing").inserted {XCTFail("Sparse Laser removed untouched tile before its own hit: \(id)")};continue
                        }
                        let face=node.visual.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === node.sourcePaintedNumbersTexture}
                        let intrinsicFaceSize=face.map{$0.size}
                        if face==nil,sparseFailures.insert(id+":missing-face").inserted {XCTFail("Sparse Laser untouched tile \(id) has no painted number face")}
                        let faceContinuous=intrinsicFaceSize.flatMap{size in beforeDragFaceSizes[id].map{abs(size.width-$0.width)<0.1 && abs(size.height-$0.height)<0.1}} ?? false
                        let continuous=node === original && node.parent != nil && !node.isHidden && !node.visual.isHidden && node.alpha>0.99 && node.visual.alpha>0.99 && tile.value==value && node.sourceValue==value && !scene.sourceOwnsNewFaceEntry(id) && !node.sourceIsBeingSpawned && min(node.sourceLocalScale.x,node.sourceLocalScale.y)>0.90 && min(node.visual.xScale,node.visual.yScale)>0.90 && faceContinuous
                        if !continuous,sparseFailures.insert(id+":continuity").inserted {XCTFail("Sparse Laser untouched tile \(id) changed before contact: value=\(tile.value)/\(value) scale=\(node.sourceLocalScale) visual=\(node.visual.xScale),\(node.visual.yScale) face=\(String(describing:intrinsicFaceSize)) lockedHolders=\(board.tiles.filter(\.locked).count)")}
                    }
                    if verifyLaserContactBodyContinuity {
                        for id in sparseContacted {
                            guard let (original,_)=beforeDrag[id] else {continue}
                            guard let node=scene.sourceNativeTileNode(id) else {
                                if sparseFailures.insert(id+":hit-missing").inserted {XCTFail("Laser hit removed same-ID body: \(id)")};continue
                            }
                            let continuous=node === original && node.parent != nil && !node.isHidden && !node.visual.isHidden && node.alpha>0.99 && node.visual.alpha>0.99 && min(node.sourceLocalScale.x,node.sourceLocalScale.y)>0.90 && min(node.visual.xScale,node.visual.yScale)>0.90
                            if !continuous,sparseFailures.insert(id+":hit-body").inserted {XCTFail("Laser hit collapsed same-ID body: \(id) outer=\(node.sourceLocalScale) inner=\(node.visual.xScale),\(node.visual.yScale) alpha=\(node.alpha),\(node.visual.alpha)")}
                        }
                    }
                }
                self.boardScaleAudit?()
            }
            let present=try XCTUnwrap(scene.onAuthoredLaserImpact)
            scene.onAuthoredLaserImpact={targets,generation,impact,allContacts,completion in
                laserPresentationCount+=1
                let originals=Dictionary(uniqueKeysWithValues:gameplay.engine.state.tiles.filter{!$0.locked && !$0.isWild}.compactMap{tile in
                    scene.sourceNativeTileNode(tile.id).map{(tile.id,($0,tile.value))}
                })
                if !verifySparseLaserContinuity {XCTAssertGreaterThan(originals.count,4,"Must include unhit tiles as well as four targets")}
                var contacted=Set<String>(),failures=Set<String>()
                let reserved=Set(targets.map(\.tileID));XCTAssertEqual(targets.count,4)
                if !verifySparseLaserContinuity {self.boardScaleAudit={
                    for (id,(original,value)) in originals where !contacted.contains(id) {
                        laserContinuitySamples+=1
                        if reserved.contains(id){laserLaterTargetSamples+=1}
                        guard let tile=gameplay.engine.state.tiles.first(where:{$0.id==id}),
                              let node=scene.sourceNativeTileNode(id) else{
                            if failures.insert(id+":missing").inserted{XCTFail("Laser removed untouched tile \(id)")};continue
                        }
                        let message="Laser pre-contact pass=\(laserPresentationCount) id=\(id) value=\(value) reserved=\(reserved.contains(id)) contacts=\(laserContactCount) outer=\(node.sourceLocalScale) inner=\(node.visual.xScale),\(node.visual.yScale) hidden=\(node.isHidden),\(node.visual.isHidden) alpha=\(node.alpha),\(node.visual.alpha)"
                        let continuous=node === original && node.parent != nil && !node.isHidden && !node.visual.isHidden && node.alpha>0.99 && node.visual.alpha>0.99 && tile.value==value && node.sourceValue==value && !scene.sourceOwnsNewFaceEntry(id) && !node.sourceIsBeingSpawned && min(node.sourceLocalScale.x,node.sourceLocalScale.y)>0.90 && min(node.visual.xScale,node.visual.yScale)>0.90
                        if !continuous,failures.insert(id+":continuity").inserted{XCTFail(message)}
                    }
                }
                }
                self.boardScaleAudit?()
                return present(targets,generation,{index,id in
                    self.boardScaleAudit?()
                    contacted.insert(id);sparseContacted.insert(id);laserContactCount+=1
                    let accepted=impact(index,id)
                    self.boardScaleAudit?()
                    return accepted
                },allContacts,completion)
            }
        }
        var queuedBonus:[String:(TimeInterval,Int)]=[:],queuedSamples=0
        if verifyQueuedBonus {
            let originalBonus=gameplay.engine.sourceWildLockedBonusPop
            gameplay.engine.sourceWildLockedBonusPop={bonus in
                let accepted=originalBonus?(bonus) ?? false
                guard accepted,let node=scene.sourceNativeTileNode(bonus.tileID) else{return false}
                print("[LockedPopDiag] prepare id=\(bonus.tileID) delay=\(bonus.delayMilliseconds) scale=\(node.sourceLocalScale.x)")
                if bonus.delayMilliseconds>0 {
                    queuedBonus[bonus.tileID]=(CACurrentMediaTime(),bonus.delayMilliseconds)
                    XCTAssertEqual(node.sourceLocalScale.x,0,"Queued real holder must not show a partial pop")
                }
                return true
            }
            boardScaleAudit={
                let now=CACurrentMediaTime()
                for (id,(start,delay)) in queuedBonus where now-start<Double(delay)/1000-0.04 {
                    guard let node=scene.sourceNativeTileNode(id),node.locked,node.sourceValue==0 else{continue}
                    queuedSamples+=1
                    XCTAssertEqual(node.sourceLocalScale.x,0,"Waiting rendered holder: \(id)")
                }
            }
        }
        var failure:String?
        let original=scene.onSourcePresentationFailure
        scene.onSourcePresentationFailure={reason,generation in failure=reason;print("[WildMergeSixRoot] \(label) failure=\(reason)");original?(reason,generation)}
        let originalPlainFailure=scene.onPresentationFailure
        scene.onPresentationFailure={reason in
            failure="plain:"+reason
            print("[WildMergeSixRoot] \(label) failure=\(reason) \(self.timeoutDiagnostic?() ?? "")")
            originalPlainFailure?(reason)
        }
        var baloonDestinationPrefixObservations=0
        if variant=="baloon" {
            let originalStateChange=scene.onStateChange
            scene.onStateChange={ [weak gameplay,weak scene] state in
                originalStateChange?(state)
                guard let gameplay,let scene,
                      let plan=gameplay.engine.pendingDirectWild,plan.generation==state.generation,plan.variant=="baloon",
                      let prefix=gameplay.engine.sourceDirectWildPrefix,prefix.id==plan.id,prefix.generation==state.generation,
                      let destination=state.tiles.first(where:{$0.id==plan.destination.id}),
                      destination.variant=="baloon",!destination.isWild else{return}
                baloonDestinationPrefixObservations+=1
                XCTAssertTrue(scene.authoredFinalePresentationReady?("baloon")==true,
                    "Cleared destination prefix must retain transaction-owned Baloon resources: "+label)
            }
        }
        func drag(_ source:String,_ target:String,holdMilliseconds:Int=160,requireLiveLaserBounce:Bool=false)async throws {
            let inputTasks=try XCTUnwrap(scope.sourceMicrotaskTasks)
            let a=try XCTUnwrap(scene.sourceNativeTileNode(source)),b=try XCTUnwrap(scene.sourceNativeTileNode(target))
            let from=scene.convert(a.position,from:try XCTUnwrap(a.parent)),to=scene.convert(b.position,from:try XCTUnwrap(b.parent))
            if requireLiveLaserBounce {XCTAssertNotNil(a.visual.action(forKey:"special-impact-spawn"),"Merge-six interruption must begin during the actual Laser replacement bounce")}
            var beginAccepted=false
            inputTasks.inputTask {
                beginAccepted=scene.beginDrag(at:from)
                XCTAssertTrue(beginAccepted,"\(label) begin source=\(source) target=\(target) from=\(from) to=\(to)")
                if requireLiveLaserBounce {XCTAssertNil(a.visual.action(forKey:"special-impact-spawn"),"Actual pickup must retire the interrupted Laser replacement bounce")}
                scene.moveDrag(to:to,now:CACurrentMediaTime())
            }
            try await Task.sleep(for:.milliseconds(holdMilliseconds))
            var result:NativeMoveResult?
            inputTasks.inputTask {
                if requireLiveLaserBounce {XCTAssertNil(a.visual.action(forKey:"special-impact-spawn"),"Interrupted Laser replacement bounce must stay retired through pointer release")}
                result=scene.finishDrag(at:to,now:CACurrentMediaTime())
            }
            let resolved=try XCTUnwrap(result)
            let details="\(label) begin=\(beginAccepted) source=\(source) target=\(target) from=\(from) to=\(to) sourceNow=\(a.position) targetNow=\(b.position) sourceFrame=\(a.calculateAccumulatedFrame()) targetFrame=\(b.calculateAccumulatedFrame()) sourceScale=\(a.sourceLocalScale)/\(a.visual.xScale),\(a.visual.yScale) targetScale=\(b.sourceLocalScale)/\(b.visual.xScale),\(b.visual.yScale) sourceCurrent=\(scene.sourceNativeTileNode(source) === a) targetCurrent=\(scene.sourceNativeTileNode(target) === b) sourceModel=\(String(describing:gameplay.engine.state.tiles.first{$0.id==source})) targetModel=\(String(describing:gameplay.engine.state.tiles.first{$0.id==target})) events=\(resolved.events) resolution=\(resolved.resolution)"
            XCTAssertTrue(resolved.accepted,details)
            guard resolved.accepted else {throw NSError(domain:"NativeLaserOverlapRejected",code:1,userInfo:[NSLocalizedDescriptionKey:details])}
        }
        var laserOverlapAccepted=false,laserOverlapStarted=false
        if laserInterveningStack {
            let previousMoment=scene.onSpecialMoment
            scene.onSpecialMoment={kind,moment,index in
                previousMoment?(kind,moment,index)
                guard kind=="laser-gun",moment=="impact",!laserOverlapStarted,
                      let plan=gameplay.engine.pendingSpecial,plan.targets.indices.contains(index) else{return}
                // Ordinary merge-six is intentionally blocked while the Source
                // initial spawn coroutine is pending. Exercise the first actual
                // contact after its settled receipt, still during that target's
                // live replacement bounce. Sub-six keeps the first-shot path.
                if laserInterveningSix {
                    guard gameplay.engine.hasSettledSourceTntSpawnCoroutine(transactionID:plan.id,generation:plan.generation) else{return}
                } else {guard index==0 else{return}}
                let hit=plan.targets[index]
                guard let source=gameplay.engine.state.tiles.first(where:{$0.id==hit.id}),
                      let target=gameplay.engine.state.activeTiles.first(where:{$0.id != hit.id && !$0.isWild && !$0.resolutionOwned && (laserInterveningSix ? $0.value+source.value==6:$0.value+source.value<6)}) else{return}
                laserOverlapStarted=true
                Task { @MainActor in
                    do {
                        try await drag(source.id,target.id,holdMilliseconds:20,requireLiveLaserBounce:laserInterveningSix)
                        laserOverlapAccepted=true
                        print("[LaserOverlap] accepted during replacement bounce \(label)")
                    } catch {XCTFail("Laser overlap failed: \(error)")}
                }
            }
        }
        if freshStar {
            try await drag(board.tiles[0].id,board.tiles[1].id)
            try await wait(label+":earned-Star-landing") {
                failure != nil || (!gameplay.engine.sourceMeterSpawnInProgress && !gameplay.engine.sourceMeterHandoffInProgress &&
                    gameplay.engine.state.activeTiles.contains{$0.archetype == .star && $0.variant==nil && scene.sourceNativeTileNode($0.id)?.sourcePlainStarArtworkSprite != nil})
            }
            XCTAssertNil(failure,label)
            let earned=try XCTUnwrap(gameplay.engine.state.activeTiles.first{$0.archetype == .star && $0.variant==nil})
            wildID=earned.id;targetID=board.tiles[2].id
            XCTAssertEqual(scene.sourceWildDropTileMarkers(try XCTUnwrap(scene.sourceNativeTileNode(wildID))),.init(dropping:false,handoffLocked:false))
        }
        var bottleTracePhases=Set<String>()
        if variant=="bottle",!finalOnly {
            let consumedBottle=try XCTUnwrap(scene.sourceNativeTileNode(wildID))
            let consumedID=wildID,origin=CACurrentMediaTime()
            let previousAudit=boardScaleAudit
            var reportedVisibleFailure=false
            boardScaleAudit={
                previousAudit?()
                let key="bottle:main"
                guard scene.sourceWildSixParticleAdmissions[key]==1 else{return}
                let converted=consumedBottle.kind=="regular" && consumedBottle.variant==nil && (1...5).contains(consumedBottle.sourceValue)
                let phase=converted || gameplay.engine.pendingSpecial==nil ? "settle":gameplay.engine.pendingSourceMagnetLazyRespawn != nil ? "respawn":scene.sourceMagnetActualPullOwnerCount>0 ? "preconvergence":"first-main"
                if bottleTracePhases.insert("first-main").inserted {
                    print("[BottleMergeTrace] ms=\(Int((CACurrentMediaTime()-origin)*1000)) direction=\(reverse ? "destination":"source") phase=first-main id=\(consumedID) childrenHidden=\(consumedBottle.sourceFinalResultChildrenHidden) idle=\(consumedBottle.hasSourceBottleIdle) pending=\(gameplay.engine.pendingSpecial?.id ?? "none")")
                }
                if bottleTracePhases.insert(phase).inserted {
                    print("[BottleMergeTrace] ms=\(Int((CACurrentMediaTime()-origin)*1000)) direction=\(reverse ? "destination":"source") phase=\(phase) id=\(consumedID) parent=\(consumedBottle.parent != nil) hidden=\(consumedBottle.isHidden) childrenHidden=\(consumedBottle.sourceFinalResultChildrenHidden) idle=\(consumedBottle.hasSourceBottleIdle) modelValue=\(gameplay.engine.state.tiles.first{$0.id==consumedID}?.value ?? -1) pending=\(gameplay.engine.pendingSpecial?.id ?? "none") pull=\(scene.sourceMagnetActualPullOwnerCount)")
                }
                guard !converted else{return}
                let retired=reverse
                    ? consumedBottle.sourceFinalResultChildrenHidden && !consumedBottle.hasSourceBottleIdle
                    : consumedBottle.parent==nil || consumedBottle.isHidden || consumedBottle.sourceFinalResultChildrenHidden
                if !retired,!reportedVisibleFailure {
                    reportedVisibleFailure=true
                    XCTFail("Consumed Bottle artwork must retire at actual main80, throughout pull and replacements: \(label)")
                }
                if reverse,gameplay.engine.pendingSpecial != nil {
                    XCTAssertTrue(scene.sourceNativeTileNode(consumedID) === consumedBottle,"Retire only old visual children, preserving the exact protected destination root: \(label)")
                }
            }
        }
        let mainKey=(variant ?? archetype.rawValue)+":main"
        let priorMainCount=scene.sourceWildSixParticleAdmissions[mainKey] ?? 0
        let expectedMainCount=priorMainCount+1
        let priorMainShardCount=scene.sourceWildOrdinaryMergeSixShardCounts[mainKey]?.count ?? 0
        let priorMainSmokeCount=scene.sourceWildOrdinaryMergeSixSmokeRecipes[mainKey]?.count ?? 0
        if pendingFilmSafetySweep {
            XCTAssertTrue(scene.scheduleSourceSpawnVisualSafetySweep(),"Film regression requires actual Source600/1200ms safety work pending before Laser")
            print("[LaserFilmSafety] scheduled actual Source safety sweep immediately before Laser")
        }
        try await drag(reverse ? targetID:wildID,reverse ? wildID:targetID)
        if interveningOrdinary {print("[SpaceshipOverlap] visible-scene-entry direction=\(reverse ? "destination":"source")")}
        let pulledNodes=archetype == .magnet && !finalOnly ? try XCTUnwrap(gameplay.engine.pendingSpecial).targets.compactMap{scene.sourceNativeTileNode($0.id)}:[]
        if variant=="bottle",!finalOnly,capturedBoard==nil {
            XCTAssertEqual(gameplay.engine.pendingSpecial?.targets.count,4,"Consumed Bottle regression requires four actual pull targets")
        }
        let pulledPositions=pulledNodes.map(\.position)
        try await wait(label+":main"){failure != nil || scene.sourceWildSixParticleAdmissions[mainKey]==expectedMainCount}
        XCTAssertNil(failure,label);XCTAssertEqual(app.route,.gameplay,label);XCTAssertTrue(game() === gameplay,label)
        XCTAssertEqual(scene.sourceWildSixParticleAdmissions[mainKey],expectedMainCount,label)
        XCTAssertEqual(scene.sourceWildOrdinaryMergeSixShardCounts[mainKey].map{Array($0.dropFirst(priorMainShardCount))},[12],label)
        let ordinarySmoke=NativeSharedSmokeRecipes.regularSix(tileDepth:9993,reduced:false)
        let encoder=JSONEncoder();encoder.outputFormatting=[.sortedKeys]
        XCTAssertEqual(try scene.sourceWildOrdinaryMergeSixSmokeRecipes[mainKey]?.dropFirst(priorMainSmokeCount).map{try encoder.encode($0)},
            [try encoder.encode(ordinarySmoke)],"Every actual Wild/Special main borrows ordinary merge6 clouds: "+label)
        if variant=="kite" {
            let kite=try XCTUnwrap(gameplay.view.subviews.first{$0.accessibilityIdentifier=="native-kite-finale"} as? NativeBeeFinalePresentation,"Actual Kite merge mounts its selected SVG finale")
            XCTAssertTrue(kite.assetReady);XCTAssertTrue(kite.hasActiveClock)
            let hero=try XCTUnwrap(kite.subviews.first{$0.accessibilityIdentifier=="native-kite-hero"})
            XCTAssertEqual(hero.bounds.size,CGSize(width:324,height:324));XCTAssertTrue(kite.subviews.last === hero)
        }
        weak var mountedBaloon:NativeBaloonFinalePresentation?
        if variant=="baloon" {
            if reverse {
                XCTAssertGreaterThan(baloonDestinationPrefixObservations,0,
                    "Actual ordinary-to-Baloon merge must observe its Wild-clearing prefix: "+label)
            }
            // Main particles can succeed while the selected UIKit resources have
            // been retired by the destination's earlier Wild-clearing prefix.
            // Require the actual merge to mount and paint the complete finale.
            let baloon=try XCTUnwrap(gameplay.view.subviews.compactMap{$0 as? NativeBaloonFinalePresentation}.first,
                "Actual Baloon merge must mount its SVG and balloon finale: "+label)
            mountedBaloon=baloon
            XCTAssertTrue(baloon.assetReady,label)
            XCTAssertTrue(baloon.hasActiveClock,label)
            XCTAssertEqual(baloon.flightSnapshot.count,24,label)
            let bodies=baloon.subviews.compactMap{$0 as? UIImageView}
            XCTAssertEqual(bodies.count,24,label)
            XCTAssertTrue(bodies.allSatisfy{$0.image != nil},label)
            XCTAssertNotNil(baloon.subviews.first{$0.accessibilityIdentifier=="native-baloon-caption"},label)
            let hero=try XCTUnwrap(baloon.subviews.last,label)
            try await wait(label+":baloon-SVG-painted") {hero.layer.sublayers?.first?.contents != nil}
            XCTAssertTrue(baloon.superview === gameplay.view,label)
            XCTAssertFalse(hero.isHidden,label)
            XCTAssertGreaterThan(hero.alpha,0,label)
        }
        if variant=="spaceship" {
            let ship=try XCTUnwrap(gameplay.view.subviews.compactMap{$0 as? NativeSpaceshipFinalePresentation}.first,
                "The actual Magnet main must mount WOOMBUU's ship, beams and debris")
            XCTAssertTrue(ship.assetReady);XCTAssertEqual(ship.generation,gameplay.engine.state.generation)
        }
        if pulledKanta {
            let kanta=try XCTUnwrap(pulledNodes.first{$0.tileID==board.tiles[2].id})
            let texture=try XCTUnwrap(kanta.sourcePaintedNumbersTexture)
            func paintedBase(_ node:SKNode)->Bool {
                guard !node.isHidden,node.alpha>0.001 else{return false}
                if let sprite=node as? SKSpriteNode,sprite.texture === texture{return true}
                return node.children.contains(where:paintedBase)
            }
            XCTAssertTrue(kanta.sourceMagnetPullProtected)
            XCTAssertTrue(paintedBase(kanta),"Retiring Kanta's idle must retain a visible original base during actual pull")
            try await Task.sleep(for:.milliseconds(250))
            XCTAssertTrue(zip(pulledNodes,pulledPositions).contains{$0.0.parent != nil && $0.0.position != $0.1},"Actual Source pull roots must move their visible captured dice")
        }
        if !finalOnly {
        let mainShake=try XCTUnwrap(drawPhases.firstIndex(of:"main-shake"),label)
        do {
            let mainParticles=try XCTUnwrap(drawPhases.firstIndex(of:"main-shards"),label)
            XCTAssertLessThan(mainShake,mainParticles,"v9 creates shake before main particle RNG: "+label)
            if archetype == .star || archetype == .juice {
                let blast=try XCTUnwrap(drawPhases.firstIndex(of:"board-blast"),label)
                XCTAssertLessThan(mainShake,blast,label);XCTAssertLessThan(blast,mainParticles,label)
            }
        }
        }
        XCTAssertGreaterThan(scene.sourceWildSixShardOwnerCount,0,label)
        XCTAssertGreaterThan(scope.smoke.activeOwnerCount,0,label)
        if finalOnly,variant=="baloon" {
            try await Task.sleep(for:.seconds(2))
            XCTAssertTrue(gameplay.engine.pendingHUDStars.isEmpty,
                "Final coins arrive at normal speed while the5.4s Baloon finale continues: "+label)
            XCTAssertEqual(app.route,.gameplay,label)
        }
        if interveningOrdinary {
            let farID=board.tiles[40].id
            XCTAssertFalse(try XCTUnwrap(gameplay.engine.pendingSpecial).targets.contains{$0.id==farID})
            let far=try XCTUnwrap(scene.sourceNativeTileNode(farID))
            let point=scene.convert(far.position,from:try XCTUnwrap(far.parent))
            XCTAssertFalse(scene.beginDrag(at:point),"Actual pull mutation must reject unrelated pickup without cancelling its cleanup")
            for _ in 0..<10 where gameplay.engine.pendingSpecial != nil && failure==nil {
                XCTAssertFalse(scene.beginDrag(at:point),"Repeated pickup during captured pull must not acquire stale drag ownership")
                try await Task.sleep(for:.milliseconds(20))
            }
            try await wait(label+":special-board-commit") {failure != nil || gameplay.engine.pendingSpecial==nil}
            XCTAssertNil(failure,label)
            XCTAssertNotNil(gameplay.engine.sourceMagnetPostCommit,"Ordinary contact must occur before captured helper finally")
            let revision=scope.contactMutations.revision
            try await drag(board.tiles[40].id,board.tiles[41].id,holdMilliseconds:heldOrdinaryMilliseconds)
            try await wait(label+":intervening-ordinary-commit") {failure != nil || scope.contactMutations.revision>revision}
            XCTAssertNil(failure,label)
        }
        if !finalOnly,(archetype == .star || archetype == .juice) {
            let mainSmoke=try XCTUnwrap(drawPhases.firstIndex(of:"main-smoke"),label)
            let mainShards=try XCTUnwrap(drawPhases.firstIndex(of:"main-shards"),label)
            XCTAssertLessThan(mainShards,mainSmoke,label)
            XCTAssertEqual(Array(scene.sourceWildSixMainPhases.values),[[.shards,.presentation,.smoke]],
                "Actual Direct consume places hero/HUD admission between shards and smoke: "+label)
        }
        if (!reverse || variant=="bottle"),disposeDuringMain {
            // Disposal during the genuine main burst must revoke its exact old
            // Scope resources; the next matrix root must not inherit them.
            host.dispose()
            XCTAssertFalse(scope.current,label);XCTAssertEqual(scene.sourceWildSixShardOwnerCount,0,label)
            XCTAssertEqual(scope.smoke.activeOwnerCount,0,label)
            print("[WildMergeSixRoot] active disposal PASS \(label)")
            return
        }
        if verifyBaloonRetirement {
            var retiringBaloon:NativeBaloonFinalePresentation?=try XCTUnwrap(mountedBaloon,label)
            try await wait(label+":baloon-natural-retirement") {
                retiringBaloon?.superview == nil && retiringBaloon?.hasActiveClock == false
            }
            XCTAssertNil(retiringBaloon?.superview,label)
            XCTAssertFalse(retiringBaloon?.hasActiveClock ?? true,label)
            XCTAssertFalse(gameplay.engine.state.tiles.contains{$0.isWild && $0.variant=="baloon"},label)
            XCTAssertNil(gameplay.engine.pendingDirectWild,label)
            XCTAssertNil(gameplay.engine.pendingSpecial,label)
            XCTAssertNil(gameplay.engine.pendingSourceLateFinalMerge,label)
            XCTAssertFalse(scene.authoredFinalePresentationReady?("baloon") ?? true,
                "Completed transaction and finite finale must retire selected Baloon resources: "+label)
            retiringBaloon=nil
            try await wait(label+":baloon-deallocated") {mountedBaloon == nil}
            XCTAssertNil(mountedBaloon,label)
        }
        if verifyStarTail {
            try await Task.sleep(for:.milliseconds(1500))
            XCTAssertNil(failure,label)
            XCTAssertEqual(scene.sourceWildSixShardOwnerCount,0,label)
            XCTAssertNotNil(scene.childNode(withName:"//native-core-star-finale"),"The actual Star field remains alive after its ordinary shards retire")
            XCTAssertEqual(scene.sourceFrameSnapshot.maxFPS,60,"The live Star field must own render cadence after merge settlement: "+label)
        }
        if verifyBoardCleared {
            try await wait(label+":board-cleared-overlay"){failure != nil || clearVoices>0}
            XCTAssertNil(failure,label);XCTAssertEqual(clearVoices,1,label)
            if let first=clearProgress.first {
                XCTAssertGreaterThanOrEqual(first,0.85,label);XCTAssertLessThan(first,1.05,label)
            } else {
                XCTAssertEqual(gameplay.engine.state.terminal?.kind,.complete,"Owners retiring before a100percent sample must use the completed terminal fallback: "+label)
            }
            XCTAssertTrue(gameplay.hasPresentedBoardCleared,label)
            let overlay=gameplay.view.subviews.first{$0.accessibilityIdentifier=="native-board-cleared-presentation"}
            XCTAssertNotNil(overlay,label);XCTAssertEqual(overlay?.layer.zPosition,1000,label)
            XCTAssertGreaterThan(scene.childNode(withName:"//native-game-hud")?.alpha ?? 0,0.9,label)
        }
        if finalOnly {
            try await wait(label+":clean-result") {
                failure != nil || gameplay.engine.state.terminal?.kind == .complete
            }
            XCTAssertNil(failure,label)
            XCTAssertEqual(gameplay.engine.state.terminal?.kind,.complete,label)
            XCTAssertEqual(app.route,.gameplay,"Final Wild must retain gameplay for Clean Board: "+label)
            XCTAssertTrue(game() === gameplay,label)
            if tutorialAssist {
                try await wait(label+":tutorial-completion") {failure != nil || app.children.contains{$0 is NativeTutorialCompleteController}}
                XCTAssertNil(failure,label)
                let sheet=try XCTUnwrap(app.children.compactMap{$0 as? NativeTutorialCompleteController}.first)
                try await wait(label+":tutorial-ready"){sheet.phase == .ready}
                sheet.requestContinue()
                if arcadeTutorial {
                    try await wait(label+":fresh-arcade"){failure != nil || (game() !== gameplay && game()?.boardScene?.isBoardEntryComplete==true)}
                    XCTAssertNil(failure)
                    let incoming=try XCTUnwrap(game())
                    XCTAssertFalse(incoming === gameplay)
                    XCTAssertFalse(scope.current)
                    XCTAssertTrue(incoming.sourceScope?.current==true)
                    XCTAssertNil(incoming.sourcePresentationFailure)
                    XCTAssertNil(incoming.engine.state.tutorial)
                    let nextScene=try XCTUnwrap(incoming.boardScene)
                    var moved=false
                    try await wait(label+":next-arcade-move") {
                        for a in incoming.engine.state.activeTiles where !moved {
                            for b in incoming.engine.state.activeTiles where !moved && a.id != b.id && NativeGameplayResolver.canDrop(a,onto:b) {
                                guard let source=nextScene.sourceNativeTileNode(a.id),let target=nextScene.sourceNativeTileNode(b.id),let parent=source.parent else{continue}
                                let from=parent.convert(source.position,to:nextScene),to=parent.convert(target.position,to:nextScene)
                                guard nextScene.beginDrag(at:from) else{continue}
                                nextScene.moveDrag(to:to)
                                moved=nextScene.finishDrag(at:to,now:CACurrentMediaTime())?.accepted==true
                            }
                        }
                        return moved || incoming.sourcePresentationFailure != nil
                    }
                    XCTAssertTrue(moved)
                    try await wait(label+":next-arcade-settlement"){incoming.sourcePresentationFailure != nil || !incoming.engine.hasUnsavableSourceGameplayState}
                    XCTAssertNil(incoming.sourcePresentationFailure)
                    return
                }
                try await wait(label+":tutorial-continue"){app.route == .home}
                XCTAssertNil(failure,label)
                XCTAssertTrue(try XCTUnwrap(store.load()).progression.firstPlayTutorialComplete)
                return
            }
            try await wait(label+":clean-presentation") {
                failure != nil || gameplay.visibleJourneyRewardController != nil || gameplay.presentedViewController is NativeResultController
            }
            XCTAssertNil(failure,label)
            try await wait(label+":completion-committed") {
                failure != nil || ((try? store.load()?.progression.completedJourneyBoards.contains(boardNumber)) == true)
            }
            XCTAssertNil(failure,label)
            if let reward=gameplay.visibleJourneyRewardController {reward.activate()}
            XCTAssertEqual(try store.load()?.progression.completedJourneyBoards.contains(boardNumber),true,label)
            XCTAssertEqual(app.route,.gameplay,label)
            if variant=="bottle",let retained=scene.sourceNativeTileNode(wildID) {
                XCTAssertTrue(retained.isHidden || retained.sourceFinalResultChildrenHidden,"Final Bottle must not retain visible old artwork")
                XCTAssertFalse(retained.hasSourceBottleIdle)
            }
            return
        }
        try await wait(label+":gameplay-settled") {
            failure != nil || (!gameplay.engine.hasUnsavableSourceGameplayState && gameplay.engine.pendingHUDStars.isEmpty &&
                scene.sourceMagnetActualPullOwnerCount==0 && scene.sourceMagnetSurvivorPendingInputIDs.isEmpty)
        }
        XCTAssertFalse(gameplay.hasPresentedBoardCleared,"Non-final merge must not celebrate: "+label)
        if verifyQueuedBonus {
            XCTAssertGreaterThan(queuedBonus.count,variant=="mushroom" ? 5:0)
            XCTAssertGreaterThan(queuedSamples,0)
            print("[LockedPopDiag] settled queued=\(queuedBonus.count) samples=\(queuedSamples)")
        }
        if variant=="mushroom" || variant=="bloob" || variant=="beach-ball" {
            let before=board.activeTiles.count
            XCTAssertTrue((before+3...before+5).contains(gameplay.engine.state.activeTiles.count),"One primary plus4–6 extras replaces the consumed pair: "+label)
        }
        if variant=="bottle" {
            if !finalOnly {
                XCTAssertTrue(bottleTracePhases.contains("preconvergence"),"Must sample actual four-target pull before convergence")
                XCTAssertTrue(bottleTracePhases.contains("respawn"),"Must sample reserved carrier during replacement cascade")
            }
            if let retained=scene.sourceNativeTileNode(wildID) {
                XCTAssertNil(retained.variant,"Consumed Bottle becomes ordinary or is removed")
                XCTAssertFalse(retained.hasSourceBottleIdle)
            }
            XCTAssertFalse(gameplay.engine.state.activeTiles.contains{$0.variant=="bottle"})
        }
        if verifyFilmLaserFootprints {
            XCTAssertEqual(filmContactCount,4)
            XCTAssertGreaterThan(filmFootprintSamples,100)
            boardScaleAudit=nil
        }
        if verifySparseLaserContinuity {
            XCTAssertEqual(laserContactCount,4)
            XCTAssertEqual(laserPresentationCount,1)
            XCTAssertGreaterThan(laserContinuitySamples,100)
            boardScaleAudit=nil
        }
        if verifyLaserContinuity {
            XCTAssertEqual(laserContactCount,4)
            XCTAssertGreaterThan(laserContinuitySamples,100)
            XCTAssertGreaterThan(laserLaterTargetSamples,20)
            print("[LaserContinuity] \(label) samples=\(laserContinuitySamples) laterTargetSamples=\(laserLaterTargetSamples) contacts=\(laserContactCount)")
            boardScaleAudit=nil // Later user moves intentionally replace untouched dice.
        }
        if laserInterveningStack {XCTAssertTrue(laserOverlapStarted,"Must start actual replacement interruption");XCTAssertTrue(laserOverlapAccepted,"Must exercise replacement interruption")}
        if initialMeter != nil {
            try await wait(label+":charged-meter-release") {
                failure != nil || (gameplay.engine.state.wildSpawnCount>board.wildSpawnCount && !gameplay.engine.hasUnsavableSourceGameplayState)
            }
            XCTAssertNil(failure,label)
            XCTAssertGreaterThan(gameplay.engine.state.wildSpawnCount,board.wildSpawnCount)
        }
        XCTAssertNil(failure,label);XCTAssertEqual(app.route,.gameplay,label);XCTAssertTrue(game() === gameplay,label)
        if interveningOrdinary {XCTAssertFalse(gameplay.engine.flags.wildMagnetPullInProgress);XCTAssertNil(gameplay.engine.sourceMagnetPostCommit)}
        XCTAssertEqual(scene.sourceWildSixParticleAdmissions[mainKey],expectedMainCount,"Late-final or pull must not repeat the main burst: "+label)
        if archetype == .magnet {
            let pullKey=(variant ?? archetype.rawValue)+":pull"
            XCTAssertEqual(scene.sourceWildSixParticleAdmissions[pullKey],1,label)
            XCTAssertEqual(scene.sourceWildOrdinaryMergeSixShardCounts[pullKey],[12],label)
            XCTAssertEqual(try scene.sourceWildOrdinaryMergeSixSmokeRecipes[pullKey]?.map{try encoder.encode($0)},
                [try encoder.encode(ordinarySmoke)],"Pull convergence borrows the same ordinary clouds: "+label)
            XCTAssertEqual(scene.sourceWildScreenShakeInvocations.count,2,label)
            let pullParticles=try XCTUnwrap(drawPhases.firstIndex(of:"pull-particles"),label)
            let pullShake=try XCTUnwrap(drawPhases.firstIndex(of:"pull-shake"),label)
            XCTAssertLessThan(pullParticles,pullShake,"v9 pull convergence creates shards before shake: "+label)
        } else if archetype == .tnt {
            XCTAssertNil(scene.sourceSpecialImpactParticleRejection,label)
            XCTAssertGreaterThan(scene.sourceSpecialImpactParticleAdmissions[variant ?? "tnt"] ?? 0,0,label)
            let contactCounts=try XCTUnwrap(scene.sourceSpecialImpactMergeSixShardCounts[variant ?? "tnt"],label)
            XCTAssertEqual(contactCounts.count,scene.sourceSpecialImpactParticleAdmissions[variant ?? "tnt"],label)
            XCTAssertTrue(contactCounts.allSatisfy{$0==12},"Every actual Special contact borrows ordinary wooden shards: "+label)
            if variant == "laser-gun" {
                XCTAssertEqual(scene.sourceLaserImpactMergeSixShardCounts.count,scene.sourceSpecialImpactParticleAdmissions["laser-gun"],label)
                XCTAssertTrue(scene.sourceLaserImpactMergeSixShardCounts.allSatisfy{$0==12},"Each actual Laser contact admits the existing ordinary merge6 shard profile: "+label)
                for tile in gameplay.engine.state.activeTiles where !tile.isWild && !tile.locked {
                    let node=try XCTUnwrap(scene.sourceNativeTileNode(tile.id),label)
                    XCTAssertEqual(node.sourceValue,tile.value,label)
                    XCTAssertEqual(node.sourceEventMode,"static",label)
                    XCTAssertTrue(gameplay.engine.canBeginDrag(tileID:tile.id),"Laser replacement must admit pickup: \(tile.id) flags=\(gameplay.engine.flags)")
                    let point=scene.convert(node.position,from:try XCTUnwrap(node.parent))
                    XCTAssertTrue(scene.beginDrag(at:point),"Actual laser replacement pickup: \(tile.id)")
                    scene.cancelDrag()
                }
            }
        } else {XCTAssertEqual(scene.sourceWildScreenShakeInvocations.count,1,label)}
        try await wait(label+":shards-retired"){scene.sourceWildSixShardOwnerCount==0}
        if laserInterveningStack && !laserInterveningSix {
            let playable=gameplay.engine.state.activeTiles.filter{!$0.isWild && !$0.locked && $0.value>0 && $0.value<6}
            let six=try XCTUnwrap(playable.lazy.flatMap{a in playable.filter{$0.id != a.id && a.value+$0.value==6}.map{(a,$0)}}.first,
                "Laser interruption fixture must retain a real merge-six pair")
            try await drag(six.0.id,six.1.id)
            try await wait(label+":post-laser-merge-six"){failure != nil || !gameplay.engine.hasUnsavableSourceGameplayState}
            XCTAssertNil(failure,label);XCTAssertNil(gameplay.sourcePresentationFailure)
        }
        if verifySurvivorEntry {
            try await wait(label+":survivor-bounce-settled") {
                [wildID,targetID].compactMap{scene.sourceNativeTileNode($0)}.allSatisfy{!$0.sourceAppSpawnOwnsOuterScale}
            }
            XCTAssertGreaterThanOrEqual(survivorEntrySamples.filter{$0>0.02 && $0<0.9}.count,3,"Must render visible growth, not instantaneous full size: "+label)
            XCTAssertGreaterThan(survivorEntrySamples.max() ?? 0,1.04,"Must render the standard overshoot: "+label)
        }
        let ordinary=gameplay.engine.state.activeTiles.filter{!$0.isWild && !$0.locked && $0.value>0 && $0.value<6}
        let pair=ordinary.lazy.flatMap{a in ordinary.filter{$0.id != a.id && a.value+$0.value<=6}.map{(a,$0)}}.first
        if let pair {
            try await drag(pair.0.id,pair.1.id)
            try await wait(label+":next-drag"){failure != nil || !gameplay.engine.hasUnsavableSourceGameplayState}
            XCTAssertNil(failure,label);XCTAssertEqual(app.route,.gameplay,label)
        }
        for index in 0..<rapidOrdinaryContacts {
            try await wait(label+":rapid-ready-\(index)") {failure != nil || !gameplay.engine.hasUnsavableSourceGameplayState}
            XCTAssertNil(failure,label)
            let playable=gameplay.engine.state.activeTiles.filter{!$0.isWild && !$0.locked && $0.value>0 && $0.value<6}
            let pair=try XCTUnwrap(playable.lazy.flatMap{a in playable.filter{$0.id != a.id && a.value+$0.value<=6}.map{(a,$0)}}.first,"Rapid continuation must retain a legal pair")
            try await drag(pair.0.id,pair.1.id,holdMilliseconds:20)
            print("[SpaceshipOverlap] direction=\(reverse ? "destination":"source") hold=\(heldOrdinaryMilliseconds) six=\(interveningSix) contact=\(index) revision=\(gameplay.engine.state.revision) pull=\(scene.sourceMagnetActualPullOwnerCount) failure=\(failure ?? "none")")
        }
        if rapidOrdinaryContacts>0 {
            try await wait(label+":rapid-final-settle") {failure != nil || (!gameplay.engine.hasUnsavableSourceGameplayState && gameplay.engine.pendingHUDStars.isEmpty)}
            XCTAssertNil(failure,label);XCTAssertNil(gameplay.sourcePresentationFailure)
            XCTAssertFalse(gameplay.engine.flags.wildMagnetPullInProgress)
            XCTAssertEqual(scene.sourceMagnetActualPullOwnerCount,0)
            XCTAssertTrue(scene.sourceMagnetSurvivorPendingInputIDs.isEmpty)
            XCTAssertEqual(app.route,.gameplay)
        }
        if verifyLaserContinuity {
            boardScaleAudit=nil
            // Actual input/history on this SAME board/root: two other Wilds,
            // several ordinary moves, then a second pre-existing Laser.
            for specialID in [board.tiles[20].id,board.tiles[30].id] {
                let target=try XCTUnwrap(gameplay.engine.state.activeTiles.first{!$0.isWild && !$0.locked && $0.value>0 && $0.value<6 && gameplay.engine.canBeginDrag(tileID:$0.id)})
                try await drag(specialID,target.id)
                try await wait(label+":history-special"){failure != nil || (!gameplay.engine.hasUnsavableSourceGameplayState && gameplay.engine.pendingHUDStars.isEmpty)}
                XCTAssertNil(failure)
            }
            for index in 0..<6 {
                let playable=gameplay.engine.state.activeTiles.filter{!$0.isWild && !$0.locked && $0.value>0 && $0.value<6}
                let pair=try XCTUnwrap(playable.lazy.flatMap{a in playable.filter{$0.id != a.id && a.value+$0.value<6}.map{(a,$0)}}.first)
                try await drag(pair.0.id,pair.1.id,holdMilliseconds:20)
                try await wait(label+":history-move-\(index)"){failure != nil || !gameplay.engine.hasUnsavableSourceGameplayState}
                XCTAssertNil(failure)
            }
            let second=board.tiles[10].id
            let target=try XCTUnwrap(gameplay.engine.state.activeTiles.first{!$0.isWild && !$0.locked && $0.value>0 && $0.value<6 && gameplay.engine.canBeginDrag(tileID:$0.id)})
            try await drag(reverse ? target.id:second,reverse ? second:target.id)
            try await wait(label+":second-laser"){failure != nil || (!gameplay.engine.hasUnsavableSourceGameplayState && gameplay.engine.pendingHUDStars.isEmpty)}
            XCTAssertNil(failure);XCTAssertEqual(laserPresentationCount,2);XCTAssertEqual(laserContactCount,8)
            print("[LaserContinuity] history \(label) arcade=\(arcadeRun) presentations=\(laserPresentationCount) contacts=\(laserContactCount) samples=\(laserContinuitySamples) laterTargetSamples=\(laserLaterTargetSamples)")
            boardScaleAudit=nil
        }
        host.dispose();XCTAssertFalse(scope.current,label);XCTAssertEqual(scope.smoke.activeOwnerCount,0,label)
        print("[WildMergeSixRoot] settled continuation PASS \(label)")
    }
}
