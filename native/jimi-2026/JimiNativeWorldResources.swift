import UIKit
import ImageIO

/// World-scoped lease. Only visible/near-visible Units hold decoded original art.
@MainActor
final class JimiNativeWorldResources {
    private struct Entry { let image: UIImage; let bytes: Int }
    private let root: URL
    private var entries: [String: Entry] = [:]
    private let decoder = DispatchQueue(label:"stacktosix.native-world.decode",qos:.userInitiated)
    private var ownerGenerations: [Int:Int] = [:]
    private var generation = 0
    private var leases: [Int: Set<String>] = [:]
    private(set) var missingAssets = Set<String>()
    private(set) var decodedBytes = 0
    init(root: URL) { self.root = root }
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
    func prepare(_ paths: [String], owner: Int, required: Bool = true, completion: @escaping (Bool) -> Void) {
        let token = generation
        let ownerToken = ownerGenerations[owner,default:0]
        let missing = Array(Set(paths.filter { !$0.isEmpty })).filter { entries[$0.hasPrefix("./") ? String($0.dropFirst(2)) : $0] == nil }
        let density = min(3,max(1,Int(UIScreen.main.scale.rounded(.up))))
        let urls = missing.map { (path: $0, url: root.appendingPathComponent($0.hasPrefix("./") ? String($0.dropFirst(2)) : $0)) }
        decoder.async { [weak self] in
            var decoded: [(String,UIImage,Int)] = []
            for item in urls {
                let (url,imageScale) = Self.displayURL(item.url,density:density)
                guard !item.path.split(separator:"/").contains(".."),let source = CGImageSourceCreateWithURL(url as CFURL,nil),let cg = CGImageSourceCreateImageAtIndex(source,0,[kCGImageSourceShouldCacheImmediately:true] as CFDictionary) else {continue}
                decoded.append((item.path,UIImage(cgImage:cg,scale:imageScale,orientation:.up),cg.bytesPerRow*cg.height))
            }
            let result = decoded
            Task { @MainActor [weak self] in
                guard let self,self.generation == token,self.ownerGenerations[owner,default:0] == ownerToken else {completion(false);return}
                let decodedPaths = Set(result.map {$0.0})
                if required {self.missingAssets.formUnion(missing.filter {!decodedPaths.contains($0)})}
                for (relative,image,bytes) in result {
                    let path = relative.hasPrefix("./") ? String(relative.dropFirst(2)) : relative
                    if self.entries[path] == nil { self.entries[path] = Entry(image:image,bytes:bytes); self.decodedBytes += bytes }
                    self.leases[owner,default:[]].insert(path)
                }
                completion(result.count == missing.count)
            }
        }
    }
    func release(_ owner: Int) {
        ownerGenerations[owner,default:0] += 1
        leases.removeValue(forKey: owner)
        let retained = leases.values.reduce(into: Set<String>()) { $0.formUnion($1) }
        for key in Array(entries.keys) where !retained.contains(key) {
            decodedBytes -= entries[key]?.bytes ?? 0; entries.removeValue(forKey: key)
        }
    }
    func cleanup() { generation += 1; ownerGenerations.removeAll(); leases.removeAll(); entries.removeAll(); missingAssets.removeAll(); decodedBytes = 0 }
}
