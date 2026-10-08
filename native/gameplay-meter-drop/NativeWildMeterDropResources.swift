import SpriteKit
import ImageIO

/// App-lived, finite original30PNG preload, matching Source's memoized Assets.load.
/// Canceled Scene waiters never cancel another waiter or receive stale success.
@MainActor
final class NativeWildMeterDropResources {
    nonisolated enum Failure:Error,Equatable {case missingOriginal([String]),retired}
    nonisolated struct Request:Hashable {let capture:NativeWildMeterDropRuntime.Capture;let sequence:UInt64}
    private struct Waiter {let arcade:Bool;let completion:(Result<[String:SKTexture],Failure>)->Void}
    private nonisolated final class StopToken:@unchecked Sendable {
        private let lock=NSLock();private var stopped=false
        func stop(){lock.lock();stopped=true;lock.unlock()}
        func isStopped()->Bool {lock.lock();defer{lock.unlock()};return stopped}
    }
    // CGImage is immutable; only these decoded images cross from serial I/O to MainActor.
    private nonisolated struct Raster:@unchecked Sendable {let path:String;let image:CGImage}
    private let root:URL,io=DispatchQueue(label:"stacktosix.native-meter-original30",qos:.userInitiated)
    private var waiters:[Request:Waiter]=[:],sequence:UInt64=0,loading=false,disposed=false
    private var textures:[String:SKTexture]=[:],loadFailure:Failure?,stopToken=StopToken()
    private let preload:([SKTexture],@escaping @MainActor @Sendable ()->Void)->Void
    private(set) var decodedBytes=0,loadCount=0
    init(root:URL,preload:@escaping([SKTexture],@escaping @MainActor @Sendable ()->Void)->Void={textures,done in SKTexture.preload(textures){Task { @MainActor in done() }}}) {
        self.root=root;self.preload=preload
    }
    @discardableResult
    func prepare(arcade:Bool,capture:NativeWildMeterDropRuntime.Capture,
                 completion:@escaping(Result<[String:SKTexture],Failure>)->Void)->Request {
        sequence &+= 1;let request=Request(capture:capture,sequence:sequence)
        guard !disposed else{completion(.failure(.retired));return request}
        if let loadFailure {completion(.failure(loadFailure));return request}
        if textures.count==NativeWildMeterDropPlan.preloadSources.count {completion(.success(selected(arcade)));return request}
        waiters[request]=Waiter(arcade:arcade,completion:completion)
        guard !loading else{return request};loading=true;loadCount += 1
        let root=self.root,paths=NativeWildMeterDropPlan.preloadSources,stop=stopToken
        io.async { [weak self] in
            var decoded:[Raster]=[],missing:[String]=[]
            for path in paths {
                if stop.isStopped(){break}
                let relative=path.hasPrefix("./") ? String(path.dropFirst(2)):path
                guard !relative.split(separator:"/").contains(".."),
                      let source=CGImageSourceCreateWithURL(root.appendingPathComponent(relative) as CFURL,nil),
                      let image=CGImageSourceCreateImageAtIndex(source,0,[kCGImageSourceShouldCacheImmediately:true] as CFDictionary)
                else{missing.append(path);continue}
                decoded.append(Raster(path:path,image:image))
            }
            let rasters=decoded,failures=missing
            Task { @MainActor [weak self] in
                guard let self,!self.disposed,!stop.isStopped() else{return}
                guard failures.isEmpty,rasters.count==paths.count else {
                    self.loading=false;self.loadFailure = .missingOriginal(failures)
                    self.completeWaiters();return
                }
                self.decodedBytes=rasters.reduce(0){$0+$1.image.bytesPerRow*$1.image.height}
                var textures:[String:SKTexture]=[:]
                for raster in rasters {let texture=SKTexture(cgImage:raster.image);texture.filteringMode = .linear;textures[raster.path]=texture}
                let preparedTextures=textures
                self.preload(Array(preparedTextures.values)) { [weak self] in
                    Task { @MainActor [weak self] in
                        guard let self,!self.disposed else{return}
                        self.textures=preparedTextures;self.loading=false;self.completeWaiters()
                    }
                }
            }
        }
        return request
    }
    func cancel(_ request:Request) {
        guard let waiter=waiters.removeValue(forKey:request) else{return}
        waiter.completion(.failure(.retired))
    }
    func dispose() {
        guard !disposed else{return};disposed=true;stopToken.stop()
        let old=waiters.values;waiters.removeAll();textures.removeAll();decodedBytes=0;loading=false
        old.forEach{$0.completion(.failure(.retired))}
    }
    private func selected(_ arcade:Bool)->[String:SKTexture] {
        let paths=Set(arcade ? NativeWildMeterDropPlan.crateSources:NativeWildMeterDropPlan.backpackSources)
        return textures.filter{paths.contains($0.key)}
    }
    private func completeWaiters() {
        // Pop each waiter immediately before dispatch. Reentrant cancel/dispose
        // from an earlier callback must retire, rather than ready, later borrowers.
        for request in Array(waiters.keys) {
            guard let waiter=waiters.removeValue(forKey:request) else{continue}
            if let loadFailure {waiter.completion(.failure(loadFailure))}
            else{waiter.completion(.success(selected(waiter.arcade)))}
        }
    }
}
