import Foundation
import StackToSixNativeState

/// One-time old Native sandbox transport. Foundation/SQLite reads a private
/// coherent snapshot; no WKWebView, JavaScript, original-store repair or reset.
@MainActor
final class NativeHybridExport {
    enum ExportError:LocalizedError {
        case wrongProduct,alreadyRunning,emptyExport,invalidPayload,timedOut
        var errorDescription:String? {
            switch self {
            case .wrongProduct:return "Native save import belongs to the separate Native application."
            case .alreadyRunning:return "Native save import is already running."
            case .emptyExport:return "The original Native profile was not found at its expected origin. Existing data was preserved."
            case .invalidPayload:return "The original Native save could not be read coherently. Existing data was preserved."
            case .timedOut:return "Reading the original Native profile timed out. Existing data was preserved."
            }
        }
    }
    private static let product="com.taptapdesign.stacktosix.native"
    private let libraryRoot:URL?
    private let read:@Sendable (URL)throws->Data
    private var completion:((Result<Data,Error>)->Void)?
    private var worker:Task<Data,Error>?
    private var delivery:Task<Void,Never>?
    private var timeout:Task<Void,Never>?
    private var generation:UInt64=0
    init(libraryRoot:URL?=nil,read:@escaping @Sendable (URL)throws->Data={try NativeLegacyStorageReader.export(libraryRoot:$0)}) {
        self.libraryRoot=libraryRoot;self.read=read
    }
    func export(completion:@escaping (Result<Data,Error>)->Void) {
        guard Bundle.main.bundleIdentifier==Self.product else {completion(.failure(ExportError.wrongProduct));return}
        guard self.completion==nil else {completion(.failure(ExportError.alreadyRunning));return}
        generation &+= 1;let epoch=generation;self.completion=completion
        let root:URL
        do {root=try libraryRoot ?? FileManager.default.url(for:.libraryDirectory,in:.userDomainMask,appropriateFor:nil,create:false)}
        catch {finish(.failure(ExportError.invalidPayload));return}
        let read=self.read
        let worker=Task.detached(priority:.utility) {try Task.checkCancellation();let data=try read(root);try Task.checkCancellation();return data}
        self.worker=worker
        delivery=Task { [weak self] in
            let result:Result<Data,Error>
            do {result = .success(try await worker.value)} catch {result = .failure(error)}
            guard let self,self.generation==epoch,self.completion != nil else {return}
            switch result {
            case .success(let data):self.finish(.success(data))
            case .failure(is CancellationError):self.finish(.failure(CancellationError()))
            case .failure(NativeLegacyStorageReader.ReadError.missingProfile),.failure(NativeLegacyStorageReader.ReadError.emptyExport):self.finish(.failure(ExportError.emptyExport))
            case .failure:self.finish(.failure(ExportError.invalidPayload))
            }
        }
        timeout=Task { [weak self] in
            do {try await Task.sleep(nanoseconds:12_000_000_000)} catch {return}
            guard let self,self.generation==epoch else {return}
            self.finish(.failure(ExportError.timedOut))
        }
    }
    func importInto(_ store:NativeSaveStore,completion:@escaping (Result<NativeSaveEnvelope,Error>)->Void) {
        export { result in
            switch result {
            case .failure(let error):completion(.failure(error))
            case .success(let data):
                do {let envelope=try NativeHybridImporter.importExport(data);try store.save(envelope);completion(.success(envelope))}
                catch {completion(.failure(error))}
            }
        }
    }
    func cancel() {finish(.failure(CancellationError()))}
    private func finish(_ result:Result<Data,Error>) {
        guard let completion else {return}
        self.completion=nil;generation &+= 1
        worker?.cancel();worker=nil;delivery?.cancel();delivery=nil;timeout?.cancel();timeout=nil
        completion(result)
    }
    isolated deinit {worker?.cancel();delivery?.cancel();timeout?.cancel()}
}
