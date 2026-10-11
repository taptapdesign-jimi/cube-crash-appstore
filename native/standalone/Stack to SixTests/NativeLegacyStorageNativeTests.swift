import XCTest
import UIKit
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeLegacyStorageNativeTests:XCTestCase {
    private func fixture() throws -> (URL,URL,NativeSaveStore) {
        let resource=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"NativeLegacyStorageDiskProducer",withExtension:"json"))
        let object=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(contentsOf:resource)) as? [String:Any])
        let files=try XCTUnwrap(object["files"] as? [[String:String]])
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-legacy-sdk-\(UUID().uuidString)")
        let library=directory.appendingPathComponent("Library"),base=library.appendingPathComponent("WebKit/WebsiteData/Default")
        try FileManager.default.createDirectory(at:base,withIntermediateDirectories:true)
        addTeardownBlock{try? FileManager.default.removeItem(at:directory)}
        for file in files {
            let path=try XCTUnwrap(file["path"]);guard path.hasPrefix("Origins/") else{continue}
            let target=base.appendingPathComponent(String(path.dropFirst("Origins/".count)))
            try FileManager.default.createDirectory(at:target.deletingLastPathComponent(),withIntermediateDirectories:true)
            try XCTUnwrap(Data(base64Encoded:try XCTUnwrap(file["base64"]))).write(to:target)
        }
        return (directory,library,NativeSaveStore(directory:directory.appendingPathComponent("Native"),legacyLibrary:library))
    }
    private func waitUntil(_ condition:()->Bool) async throws {
        let deadline=CACurrentMediaTime()+3
        while !condition(),CACurrentMediaTime()<deadline {try await Task.sleep(nanoseconds:10_000_000)}
        XCTAssertTrue(condition())
    }
    private func containsWeb(_ view:UIView)->Bool {NSStringFromClass(type(of:view)).contains("WKWebView") || view.subviews.contains(where:containsWeb)}
    func testActualBootstrapImportsSameOwnedLibraryAndReopensNativeRootWithoutWebView() async throws {
        let (_,library,store)=try fixture()
        XCTAssertEqual(store.legacyImportLibraryRoot,library)
        XCTAssertThrowsError(try store.load()) {XCTAssertEqual($0 as? NativeSaveError,.requiresLegacyImport)}
        let host=UIViewController();host.loadViewIfNeeded();host.view.frame=CGRect(x:0,y:0,width:390,height:844)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false)
        bootstrap.start(in:host)
        try await waitUntil{host.children.first is NativeAppController}
        XCTAssertFalse(containsWeb(host.view))
        let state=try XCTUnwrap(store.load());XCTAssertTrue(state.importedHybrid);XCTAssertTrue(state.progression.firstPlayTutorialComplete)
        XCTAssertFalse(state.settings.musicEnabled);XCTAssertFalse(state.settings.gameSoundsEnabled)
        bootstrap.dispose()
        let restarted=NativeStandaloneViewController(resourceRoot:NativeTestResources.root,store:NativeSaveStore(directory:store.directory,legacyLibrary:library))
        restarted.loadViewIfNeeded();XCTAssertTrue(restarted.children.first is NativeAppController)
        XCTAssertFalse(containsWeb(restarted.view));XCTAssertEqual(try store.load(),state);restarted.dispose()
    }
    func testImmediateBootstrapDisposalCannotCommitOrMountLateImport() async throws {
        let (_,_,store)=try fixture()
        let host=UIViewController();host.loadViewIfNeeded()
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false)
        bootstrap.start(in:host);bootstrap.dispose()
        try await Task.sleep(nanoseconds:150_000_000)
        XCTAssertTrue(host.children.isEmpty)
        XCTAssertFalse(FileManager.default.fileExists(atPath:store.directory.appendingPathComponent("state-v1.json").path))
        XCTAssertThrowsError(try store.load()) {XCTAssertEqual($0 as? NativeSaveError,.requiresLegacyImport)}
    }
    func testCancelledRunningReadCompletesOnceAndNeverSavesLateSuccess() async throws {
        let (_,library,store)=try fixture(),started=expectation(description:"Real worker entered"),returned=expectation(description:"Worker retired")
        let release=DispatchSemaphore(value:0)
        let payload=try NativeLegacyStorageReader.export(libraryRoot:library)
        let exporter=NativeHybridExport(libraryRoot:library,read:{_ in
            started.fulfill();defer{returned.fulfill()}
            _=release.wait(timeout:.now()+3);return payload
        })
        var count=0
        exporter.importInto(store){result in count+=1;guard case .failure(is CancellationError)=result else {XCTFail("Cancellation must own completion");return}}
        await fulfillment(of:[started],timeout:2)
        exporter.cancel();exporter.cancel();XCTAssertEqual(count,1)
        release.signal();await fulfillment(of:[returned],timeout:2)
        try await Task.sleep(nanoseconds:50_000_000)
        XCTAssertEqual(count,1);XCTAssertFalse(FileManager.default.fileExists(atPath:store.directory.appendingPathComponent("state-v1.json").path))
    }
    func testConcurrentRequestDoesNotReplaceFirstImportAndFailurePreservesExistingNativeBytes() async throws {
        let (_,library,store)=try fixture(),started=expectation(description:"Worker entered"),finished=expectation(description:"Import completed")
        let release=DispatchSemaphore(value:0),payload=try NativeLegacyStorageReader.export(libraryRoot:library)
        let exporter=NativeHybridExport(libraryRoot:library,read:{_ in started.fulfill();_=release.wait(timeout:.now()+3);return payload})
        exporter.importInto(store){result in if case .failure(let error)=result {XCTFail("\(error)")};finished.fulfill()}
        await fulfillment(of:[started],timeout:2)
        var second=0
        exporter.export{result in second+=1;guard case .failure(NativeHybridExport.ExportError.alreadyRunning)=result else {XCTFail("Second request must be refused");return}}
        XCTAssertEqual(second,1);release.signal();await fulfillment(of:[finished],timeout:2)
        let file=store.directory.appendingPathComponent("state-v1.json"),bytes=try Data(contentsOf:file)
        let failure=NativeHybridExport(libraryRoot:library,read:{_ in throw NativeLegacyStorageReader.ReadError.invalidDatabase})
        let refused=expectation(description:"Failure delivered")
        failure.importInto(store){result in if case .success=result {XCTFail("Corrupt source cannot commit")};refused.fulfill()}
        await fulfillment(of:[refused],timeout:2)
        XCTAssertEqual(try Data(contentsOf:file),bytes)
    }
    func testActualWallTimeoutCompletesOnceAndRefusesLateWorkerSave() async throws {
        let (_,library,store)=try fixture(),started=expectation(description:"Worker entered"),returned=expectation(description:"Late worker retired"),timeout=expectation(description:"Original12second timeout")
        let release=DispatchSemaphore(value:0);defer{release.signal()}
        let payload=try NativeLegacyStorageReader.export(libraryRoot:library)
        let exporter=NativeHybridExport(libraryRoot:library,read:{_ in
            started.fulfill();defer{returned.fulfill()};_=release.wait(timeout:.now()+20);return payload
        })
        var completions=0
        exporter.importInto(store){result in
            completions+=1
            guard case .failure(NativeHybridExport.ExportError.timedOut)=result else {XCTFail("Actual fallback must own this completion");timeout.fulfill();return}
            timeout.fulfill()
        }
        await fulfillment(of:[started],timeout:2)
        await fulfillment(of:[timeout],timeout:15)
        XCTAssertEqual(completions,1)
        release.signal();await fulfillment(of:[returned],timeout:2)
        try await Task.sleep(nanoseconds:50_000_000)
        XCTAssertEqual(completions,1)
        XCTAssertFalse(FileManager.default.fileExists(atPath:store.directory.appendingPathComponent("state-v1.json").path))
    }

}
