import UIKit
import CoreImage

nonisolated final class NativeRewardPreparationLease:@unchecked Sendable {
    private let lock=NSLock();private var retired=false
    var cancelled:Bool {lock.lock();defer{lock.unlock()};return retired}
    func cancel(){lock.lock();retired=true;lock.unlock()}
}
/// Runtime filters of immutable selected frames, not replacement assets. One
/// bounded queue prepares nine small blur carriers; disposed screens reject it.
nonisolated enum NativeRewardFilteredFrames {
    private static let queue=DispatchQueue(label:"stacktosix.native-reward.filters",qos:.userInitiated)
    static func prepare(_ images:[String:UIImage],lease:NativeRewardPreparationLease,completion:@escaping ([String:UIImage])->Void) {
        queue.async {
            let context=CIContext(options:[.cacheIntermediates:false]);var result:[String:UIImage]=[:]
            for (path,image) in images where path.contains("/zguzvano") {
                guard !lease.cancelled,let cg=image.cgImage else{continue}
                let original=CIImage(cgImage:cg)
                let bright=original.applyingFilter("CIColorMatrix",parameters:["inputRVector":CIVector(x:1.04,y:0,z:0,w:0),"inputGVector":CIVector(x:0,y:1.04,z:0,w:0),"inputBVector":CIVector(x:0,y:0,z:1.04,w:0)])
                let filtered=bright.clampedToExtent().applyingFilter("CIGaussianBlur",parameters:[kCIInputRadiusKey:1.2]).cropped(to:original.extent)
                if let output=context.createCGImage(filtered,from:original.extent) {result[path]=UIImage(cgImage:output,scale:image.scale,orientation:.up)}
            }
            let prepared=result
            Task { @MainActor in guard !lease.cancelled else{return};completion(prepared) }
        }
    }
}
