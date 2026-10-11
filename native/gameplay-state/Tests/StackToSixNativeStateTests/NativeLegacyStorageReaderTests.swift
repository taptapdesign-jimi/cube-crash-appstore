import XCTest
import Foundation
import SQLite3
@testable import StackToSixNativeState

final class NativeLegacyStorageReaderTests:XCTestCase {
    private func fixture() throws -> URL {
        let url=try XCTUnwrap(Bundle.module.url(forResource:"NativeLegacyStorageDiskProducer",withExtension:"json"))
        let object=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(contentsOf:url)) as? [String:Any])
        let files=try XCTUnwrap(object["files"] as? [[String:String]])
        let root=FileManager.default.temporaryDirectory.appendingPathComponent("NativeLegacyReaderTests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at:root,withIntermediateDirectories:true)
        addTeardownBlock{try? FileManager.default.removeItem(at:root)}
        for file in files {
            let path=try XCTUnwrap(file["path"]),data=try XCTUnwrap(Data(base64Encoded:try XCTUnwrap(file["base64"])))
            XCTAssertFalse(path.hasPrefix("/"));XCTAssertFalse(path.split(separator:"/").contains(".."))
            let target=root.appendingPathComponent(path)
            try FileManager.default.createDirectory(at:target.deletingLastPathComponent(),withIntermediateDirectories:true)
            try data.write(to:target)
        }
        return root
    }
    private func files(_ root:URL) throws -> [String:Data] {
        let enumerator=try XCTUnwrap(FileManager.default.enumerator(at:root,includingPropertiesForKeys:[.isRegularFileKey]))
        var result:[String:Data]=[:]
        while let file=enumerator.nextObject() as? URL {
            guard try file.resourceValues(forKeys:[.isRegularFileKey]).isRegularFile==true else {continue}
            result[String(file.path.dropFirst(root.path.count+1))]=try Data(contentsOf:file)
        }
        return result
    }
    private func originalDirectory(_ root:URL) throws -> URL {
        let enumerator=try XCTUnwrap(FileManager.default.enumerator(at:root,includingPropertiesForKeys:nil))
        while let file=enumerator.nextObject() as? URL {
            if file.lastPathComponent=="origin",try NativeLegacyStorageReader.isOriginalOrigin(Data(contentsOf:file)) {return file.deletingLastPathComponent()}
        }
        throw NativeLegacyStorageReader.ReadError.missingProfile
    }
    private func storage(_ data:Data) throws -> [String:String] {
        let root=try XCTUnwrap(JSONSerialization.jsonObject(with:data) as? [String:Any])
        XCTAssertEqual(root["product"] as? String,"com.taptapdesign.stacktosix.native")
        return try XCTUnwrap(root["storage"] as? [String:String])
    }
    func testActualProducerOriginalOriginWALAndSettingsImportPreserveEverySourceByte() throws {
        let root=try fixture(),before=try files(root)
        let data=try NativeLegacyStorageReader.export(modernRoots:[root.appendingPathComponent("Origins")])
        let contents=try storage(data)
        XCTAssertEqual(contents.count,3);XCTAssertEqual(contents["cc_first_play_tutorial_done"],"true")
        XCTAssertEqual(contents["cc_first_play_tutorial_force_next"],"false");XCTAssertNil(contents["native_qa_unicode"])
        let imported=try NativeHybridImporter.importExport(data,now:10)
        XCTAssertTrue(imported.progression.firstPlayTutorialComplete)
        XCTAssertFalse(imported.settings.gameSoundsEnabled);XCTAssertFalse(imported.settings.musicEnabled);XCTAssertFalse(imported.settings.hapticsEnabled)
        XCTAssertEqual(try files(root),before)
    }
    func testWholeOriginDocumentRejectsForeignTopOrClientPortTruncationAndTrailingBytes() throws {
        let root=try fixture(),dir=try originalDirectory(root),raw=try Data(contentsOf:dir.appendingPathComponent("origin"))
        XCTAssertTrue(try NativeLegacyStorageReader.isOriginalOrigin(raw))
        for count in 0..<raw.count {XCTAssertThrowsError(try NativeLegacyStorageReader.isOriginalOrigin(raw.prefix(count)))}
        var trailing=raw;trailing.append(0);XCTAssertThrowsError(try NativeLegacyStorageReader.isOriginalOrigin(trailing))
        for offset in [13,36] {var foreign=raw;foreign[offset]=UInt8(ascii:"x");XCTAssertFalse(try NativeLegacyStorageReader.isOriginalOrigin(foreign))}
        var port=raw;port[22]=1;port.insert(contentsOf:[0,0],at:23)
        XCTAssertFalse(try NativeLegacyStorageReader.isOriginalOrigin(port))
    }
    func testAmbiguousModernAndLegacyProfilesFailWithoutRepair() throws {
        let root=try fixture(),dir=try originalDirectory(root),db=dir.appendingPathComponent("LocalStorage/localstorage.sqlite3")
        let legacy=root.appendingPathComponent("Legacy");try FileManager.default.createDirectory(at:legacy,withIntermediateDirectories:true)
        try Data(contentsOf:db).write(to:legacy.appendingPathComponent("app_localhost_0.localstorage"))
        let before=try files(root)
        XCTAssertThrowsError(try NativeLegacyStorageReader.export(modernRoots:[root.appendingPathComponent("Origins")],legacyRoots:[legacy])) {XCTAssertEqual($0 as? NativeLegacyStorageReader.ReadError,.ambiguousProfile)}
        XCTAssertEqual(try files(root),before)
    }
    func testForeignOnlyAndCorruptOriginalFailWithoutCreatingFreshProfile() throws {
        let root=try fixture(),dir=try originalDirectory(root)
        try FileManager.default.removeItem(at:dir)
        XCTAssertThrowsError(try NativeLegacyStorageReader.export(modernRoots:[root.appendingPathComponent("Origins")])) {XCTAssertEqual($0 as? NativeLegacyStorageReader.ReadError,.missingProfile)}
        let fresh=try fixture(),original=try originalDirectory(fresh),database=original.appendingPathComponent("LocalStorage/localstorage.sqlite3")
        try Data("invalid SQLite".utf8).write(to:database)
        let before=try files(fresh)
        XCTAssertThrowsError(try NativeLegacyStorageReader.export(modernRoots:[fresh.appendingPathComponent("Origins")]))
        XCTAssertEqual(try files(fresh),before)
    }
    func testSymlinkSourceDatabaseIsRejectedAndTargetBytesStayIntact() throws {
        let root=try fixture(),dir=try originalDirectory(root),database=dir.appendingPathComponent("LocalStorage/localstorage.sqlite3")
        let target=root.appendingPathComponent("outside.sqlite3");try FileManager.default.copyItem(at:database,to:target)
        try FileManager.default.removeItem(at:database);try FileManager.default.createSymbolicLink(at:database,withDestinationURL:target)
        let before=try Data(contentsOf:target)
        XCTAssertThrowsError(try NativeLegacyStorageReader.export(modernRoots:[root.appendingPathComponent("Origins")])) {XCTAssertEqual($0 as? NativeLegacyStorageReader.ReadError,.unsafePath)}
        XCTAssertEqual(try Data(contentsOf:target),before)
    }
    func testCanonicalKeyFilterMatchesOriginalAnchoredDigits() {
        for key in ["cc_saved_game_board_01","cc_saved_game_board_1","cc_journey_completed_board_30","cc_saved_game"] {XCTAssertTrue(NativeLegacyStorageReader.allowsStorageKey(key))}
        for key in ["cc_saved_game_board_","cc_saved_game_board_01evil","prefix_cc_settings","native_qa_unicode","cc_journey_completed_board_1\n"] {XCTAssertFalse(NativeLegacyStorageReader.allowsStorageKey(key))}
    }
    private func writeFixture(_ root:URL,key:String,value:Data) throws {
        let database=try originalDirectory(root).appendingPathComponent("LocalStorage/localstorage.sqlite3")
        var handle:OpaquePointer?;XCTAssertEqual(sqlite3_open(database.path,&handle),SQLITE_OK)
        let db=try XCTUnwrap(handle);defer{sqlite3_close(db)}
        var statement:OpaquePointer?;XCTAssertEqual(sqlite3_prepare_v2(db,"INSERT OR REPLACE INTO ItemTable VALUES (?,?)",-1,&statement,nil),SQLITE_OK)
        let query=try XCTUnwrap(statement);defer{sqlite3_finalize(query)}
        let copied=unsafeBitCast(-1,to:sqlite3_destructor_type.self)
        XCTAssertEqual(key.withCString{sqlite3_bind_text(query,1,$0,-1,copied)},SQLITE_OK)
        XCTAssertEqual(value.withUnsafeBytes{sqlite3_bind_blob(query,2,$0.baseAddress,Int32($0.count),copied)},SQLITE_OK)
        XCTAssertEqual(sqlite3_step(query),SQLITE_DONE)
    }
    func testAllowedUnicodeEmojiAndEmbeddedNULDecodeExactlyWithoutSourceMutation() throws {
        let root=try fixture(),text="Čćž 😀\0尾"
        try writeFixture(root,key:"cc_saved_game_board_01",value:try XCTUnwrap(text.data(using:.utf16LittleEndian)))
        let before=try files(root)
        let data=try NativeLegacyStorageReader.export(modernRoots:[root.appendingPathComponent("Origins")])
        XCTAssertEqual(try storage(data)["cc_saved_game_board_01"],text)
        XCTAssertEqual(try files(root),before)
    }
    func testInvalidUTF16AndUnscopedSaveRefuseImportWithoutChangingSource() throws {
        for invalid in [Data([0,0xD8]),Data([0x41])] {
            let root=try fixture();try writeFixture(root,key:"cc_settings",value:invalid)
            let before=try files(root)
            XCTAssertThrowsError(try NativeLegacyStorageReader.export(modernRoots:[root.appendingPathComponent("Origins")])) {XCTAssertEqual($0 as? NativeLegacyStorageReader.ReadError,.invalidString)}
            XCTAssertEqual(try files(root),before)
        }
        let root=try fixture();try writeFixture(root,key:"cc_saved_game",value:try XCTUnwrap("{}".data(using:.utf16LittleEndian)))
        let before=try files(root)
        XCTAssertThrowsError(try NativeLegacyStorageReader.export(modernRoots:[root.appendingPathComponent("Origins")])) {XCTAssertEqual($0 as? NativeLegacyStorageReader.ReadError,.unscopedSave)}
        XCTAssertEqual(try files(root),before)
    }
    func testExactLegacyFilenameReadsSameWALAndNativeAtomicReopenKeepsSettings() throws {
        let root=try fixture(),source=try originalDirectory(root).appendingPathComponent("LocalStorage/localstorage.sqlite3")
        let legacy=root.appendingPathComponent("legacy-only");try FileManager.default.createDirectory(at:legacy,withIntermediateDirectories:true)
        let destination=legacy.appendingPathComponent("app_localhost_0.localstorage")
        for suffix in ["","-wal"] {let from=URL(fileURLWithPath:source.path+suffix);if FileManager.default.fileExists(atPath:from.path) {try FileManager.default.copyItem(at:from,to:URL(fileURLWithPath:destination.path+suffix))}}
        let before=try files(legacy)
        let data=try NativeLegacyStorageReader.export(modernRoots:[],legacyRoots:[legacy])
        let imported=try NativeHybridImporter.importExport(data,now:20)
        let store=NativeSaveStore(directory:root.appendingPathComponent("native-save"));try store.save(imported)
        XCTAssertEqual(try NativeSaveStore(directory:store.directory).load(),imported)
        XCTAssertEqual(try NativeLegacyStorageReader.export(modernRoots:[],legacyRoots:[legacy]),data)
        XCTAssertEqual(try files(legacy),before)
    }

    private func executeFixture(_ root:URL,sql:String) throws {
        let database=try originalDirectory(root).appendingPathComponent("LocalStorage/localstorage.sqlite3")
        var handle:OpaquePointer?;XCTAssertEqual(sqlite3_open(database.path,&handle),SQLITE_OK)
        let db=try XCTUnwrap(handle);defer{sqlite3_close(db)}
        XCTAssertEqual(sqlite3_exec(db,sql,nil,nil,nil),SQLITE_OK)
    }
    func testViewOrWrongDeclaredValueTypeRefusedEvenWhenRowsHaveValidBlobs() throws {
        for sql in [
            "ALTER TABLE ItemTable RENAME TO Original; CREATE VIEW ItemTable AS SELECT key,value FROM Original;",
            "ALTER TABLE ItemTable RENAME TO Original; CREATE TABLE ItemTable (key TEXT UNIQUE ON CONFLICT REPLACE,value TEXT NOT NULL); INSERT INTO ItemTable SELECT key,value FROM Original; DROP TABLE Original;"
        ] {
            let root=try fixture();try executeFixture(root,sql:sql);let before=try files(root)
            XCTAssertThrowsError(try NativeLegacyStorageReader.export(modernRoots:[root.appendingPathComponent("Origins")])) {XCTAssertEqual($0 as? NativeLegacyStorageReader.ReadError,.invalidDatabase)}
            XCTAssertEqual(try files(root),before)
        }
    }
    func testMissingActualWALCannotBecomeAnEmptyNativeProfile() throws {
        let root=try fixture(),database=try originalDirectory(root).appendingPathComponent("LocalStorage/localstorage.sqlite3")
        let wal=URL(fileURLWithPath:database.path+"-wal");XCTAssertTrue(FileManager.default.fileExists(atPath:wal.path))
        try FileManager.default.removeItem(at:wal);let before=try files(root)
        XCTAssertThrowsError(try NativeLegacyStorageReader.export(modernRoots:[root.appendingPathComponent("Origins")])) {XCTAssertEqual($0 as? NativeLegacyStorageReader.ReadError,.invalidDatabase)}
        XCTAssertEqual(try files(root),before)
    }
    func testEmptyKnownOriginPreservesLegacyDataAndRefusesFreshImport() throws {
        let root=try fixture();try executeFixture(root,sql:"DELETE FROM ItemTable;")
        let before=try files(root)
        XCTAssertThrowsError(try NativeLegacyStorageReader.export(modernRoots:[root.appendingPathComponent("Origins")])) {XCTAssertEqual($0 as? NativeLegacyStorageReader.ReadError,.emptyExport)}
        XCTAssertEqual(try files(root),before)
    }

}
