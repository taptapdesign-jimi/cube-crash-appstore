import XCTest
import StackToSixGameplay
@testable import Stack_to_Six

final class NativeSourceCanonicalSavePhysicalMarkerTests:XCTestCase {
    struct Oracle:Decodable {struct Row:Decodable {let key:String,destroyed:Bool,busy:Bool};let markerRows:[Row]}
    func testAllTenOriginalPhysicalFlagsAreDistinctAndDestroyedTilesNeverBlockSave()throws {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"NativeSourceCanonicalSaveOracle",withExtension:"json"))
        let o=try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:url))
        XCTAssertEqual(o.markerRows.count,20)
        for row in o.markerRows {
            var m=NativeSourceSaveTileMarkers();m.destroyed=row.destroyed
            switch row.key {
            case "_ccWildSpawnDropping":m.wildSpawnDropping=true
            case "_ccWildSpawnHandoffLock":m.wildSpawnHandoffLock=true
            case "_isBeingSpawned":m.isBeingSpawned=true
            case "_pendingRemoval":m.pendingRemoval=true
            case "_beingRemoved":m.beingRemoved=true
            case "_cleanupQueued":m.cleanupQueued=true
            case "_ccSpawnAnimating":m.ccSpawnAnimating=true
            case "_spawnAnimating":m.spawnAnimating=true
            case "_isSpawning":m.isSpawning=true
            case "_spawnTween":m.hasSpawnTween=true
            default:XCTFail("unknown original marker \(row.key)")
            }
            var runtime=NativeSourceSaveRuntime();runtime.tileMarkers=[m]
            XCTAssertEqual(runtime.hasUnsavableTransientGameplayState,row.busy,"\(row.key) destroyed=\(row.destroyed)")
        }
    }
}
