import UIKit
import ImageIO

/// World-scoped lease. Only visible/near-visible Units hold decoded original art.
@MainActor
final class JimiNativeWorldResources {
    private struct Entry { let image: UIImage; let bytes: Int }
    private let root: URL
    private var entries: [String: Entry] = [:]
    private let decoder:DispatchQueue
    private let decode:@Sendable(URL,Int)->UIImage?
    nonisolated private final class Lifetime:@unchecked Sendable {
        private let lock=NSLock();private var live=true
        var current:Bool {lock.lock();defer{lock.unlock()};return live}
        func retire(){lock.lock();live=false;lock.unlock()}
    }
    private var preparationLifetime=Lifetime()
    private var ownerLifetimes:[Int:Lifetime]=[:]
    private var ownerGenerations: [Int:Int] = [:]
    private var generation = 0
    private var leases: [Int: Set<String>] = [:]
    private(set) var missingAssets = Set<String>()
    private(set) var decodedBytes = 0
    init(root:URL,preparationQueue:DispatchQueue?=nil,decode:@escaping @Sendable(URL,Int)->UIImage?=JimiNativeWorldResources.decodeImage) {
        self.root=root;decoder=preparationQueue ?? DispatchQueue(label:"stacktosix.native-world.decode",qos:.userInitiated);self.decode=decode
    }
    nonisolated static func decodeImage(_ original:URL,_ density:Int)->UIImage? {
        let (url,scale)=displayURL(original,density:density)
        guard let source=CGImageSourceCreateWithURL(url as CFURL,nil),
              let cg=CGImageSourceCreateImageAtIndex(source,0,[kCGImageSourceShouldCacheImmediately:true] as CFDictionary) else{return nil}
        return UIImage(cgImage:cg,scale:scale,orientation:.up)
    }
    nonisolated private static func displayURL(_ url:URL,density:Int) -> (URL,CGFloat) {
        let name = url.deletingPathExtension().lastPathComponent
        if name.hasSuffix("@2x") {return (url,2)}
        if name.hasSuffix("@3x") {return (url,3)}
        // World collectible 1x is the already-painted spatial entry carrier.
        // Exact modal density is leased separately after its first motion.
        guard !url.path.contains("/colelctibles/"),density>1 else {return (url,1)}
        for scale in stride(from:density,through:2,by:-1) {
            let candidate = url.deletingLastPathComponent().appendingPathComponent(name+"@\(scale)x."+url.pathExtension)
            if FileManager.default.fileExists(atPath:candidate.path) {return (candidate,CGFloat(scale))}
        }
        return (url,1)
    }
    func image(_ relative: String, owner: Int) -> UIImage? {
        let path = relative.hasPrefix("./") ? String(relative.dropFirst(2)) : relative
        guard !path.isEmpty, !path.split(separator: "/").contains("..") else { return nil }
        leases[owner, default: []].insert(path)
        if let entry = entries[path] { return entry.image }
        let (url,imageScale) = Self.displayURL(root.appendingPathComponent(path),density:min(3,max(1,Int(UIScreen.main.scale.rounded(.up)))))
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let cg = CGImageSourceCreateImageAtIndex(source, 0, [kCGImageSourceShouldCacheImmediately: true] as CFDictionary) else { missingAssets.insert(path); return nil }
        let image = UIImage(cgImage:cg,scale:imageScale,orientation:.up)
        let bytes = cg.bytesPerRow * cg.height
        entries[path] = Entry(image: image, bytes: bytes); decodedBytes += bytes
        return image
    }
    func prepare(_ paths:[String],owner:Int,required:Bool=true,completion:@escaping(Bool)->Void) {
        let paths=Array(Set(paths.map{$0.hasPrefix("./") ? String($0.dropFirst(2)):$0}.filter{!$0.isEmpty})).sorted()
        guard paths.allSatisfy({!$0.split(separator:"/").contains("..")}) else{completion(false);return}
        // Cached requests are already ready and must not wait behind unrelated
        // optional decodes; each caller still acquires its own resource lease.
        let cached=paths.filter{entries[$0] != nil}
        leases[owner,default:[]].formUnion(cached)
        let missing=paths.filter{entries[$0] == nil}
        guard !missing.isEmpty else{completion(true);return}
        let token=generation,ownerToken=ownerGenerations[owner,default:0]
        let lifetime=preparationLifetime
        let ownerLifetime=ownerLifetimes[owner] ?? Lifetime();ownerLifetimes[owner]=ownerLifetime
        let density=min(3,max(1,Int(UIScreen.main.scale.rounded(.up))))
        let root=self.root,decode=self.decode
        decoder.async { [weak self] in
            var decoded:[(String,UIImage,Int)]=[]
            for path in missing {
                // Retirement prevents queued and between-file work, not only
                // stale publication. One already-running ImageIO decode drains.
                guard self != nil,lifetime.current,ownerLifetime.current else{break}
                let image=autoreleasepool{decode(root.appendingPathComponent(path),density)}
                guard self != nil,lifetime.current,ownerLifetime.current else{break}
                if let image,let cg=image.cgImage {decoded.append((path,image,cg.bytesPerRow*cg.height))}
            }
            let result=decoded
            Task { @MainActor [weak self] in
                guard let self,lifetime.current,ownerLifetime.current,self.generation==token,self.ownerGenerations[owner,default:0]==ownerToken else{completion(false);return}
                let decodedPaths=Set(result.map{$0.0})
                if required {self.missingAssets.formUnion(missing.filter{!decodedPaths.contains($0)})}
                for (path,image,bytes) in result {
                    if self.entries[path]==nil {self.entries[path]=Entry(image:image,bytes:bytes);self.decodedBytes += bytes}
                    self.leases[owner,default:[]].insert(path)
                }
                completion(result.count==missing.count)
            }
        }
    }
    func release(_ owner: Int) {
        ownerLifetimes.removeValue(forKey:owner)?.retire()
        ownerGenerations[owner,default:0] += 1
        leases.removeValue(forKey: owner)
        let retained = leases.values.reduce(into: Set<String>()) { $0.formUnion($1) }
        for key in Array(entries.keys) where !retained.contains(key) {
            decodedBytes -= entries[key]?.bytes ?? 0; entries.removeValue(forKey: key)
        }
    }
    /// Reject adoption from queued decode work while retaining the already
    /// painted incoming World's original decoded art and owner leases.
    func cancelPendingPreparation(){
        preparationLifetime.retire();preparationLifetime=Lifetime()
        ownerLifetimes.values.forEach{$0.retire()};ownerLifetimes.removeAll();generation += 1
    }
    func cleanup() { cancelPendingPreparation(); ownerGenerations.removeAll(); leases.removeAll(); entries.removeAll(); missingAssets.removeAll(); decodedBytes = 0 }
}
