import UIKit
import ImageIO

@MainActor
protocol NativeJourneyBottomDecorResourcePreparing:AnyObject {
    var decodedBytes:Int {get}
    func prepare(path:String,completion:@escaping(UIImage?)->Void)
    func cancelPendingPreparation()
    func release()
}

/// One exact srcset-selected original PNG, decoded off the visible clock.
/// Explicit @3x filename is never substituted for source's authored 2x choice.
@MainActor
final class NativeJourneyBottomDecorResources:NativeJourneyBottomDecorResourcePreparing {
    let root:URL
    private let decoder=DispatchQueue(label:"stacktosix.native-journey-bottom-decor",qos:.userInitiated)
    private var epoch:UInt64=0,image:UIImage?,path:String?
    private(set) var decodedBytes=0
    init(root:URL){self.root=root}
    func prepare(path:String,completion:@escaping(UIImage?)->Void) {
        if self.path==path,let image {completion(image);return}
        epoch &+= 1;let token=epoch
        let relative=path.hasPrefix("./") ? String(path.dropFirst(2)):path
        guard !relative.isEmpty,!relative.split(separator:"/").contains("..") else{completion(nil);return}
        let url=root.appendingPathComponent(relative)
        let owner=self
        decoder.async {
            let decoded:UIImage?
            if let source=CGImageSourceCreateWithURL(url as CFURL,nil),let cg=CGImageSourceCreateImageAtIndex(source,0,[kCGImageSourceShouldCacheImmediately:true] as CFDictionary) {
                // Source srcset labels either authored high-res file as 2x,
                // including Beach3's @3x filename. Aspect remains exact.
                let scale:CGFloat=relative.contains("@2x.") || relative.contains("@3x.") ? 2:1
                decoded=UIImage(cgImage:cg,scale:scale,orientation:.up)
            } else {decoded=nil}
            Task { @MainActor [weak owner] in
                guard let self=owner,self.epoch==token else{completion(nil);return}
                self.image=decoded;self.path=path
                self.decodedBytes=decoded?.cgImage.map{$0.bytesPerRow*$0.height} ?? 0
                completion(decoded)
            }
        }
    }
    func cancelPendingPreparation(){epoch &+= 1}
    func release(){cancelPendingPreparation();image=nil;path=nil;decodedBytes=0}
}
