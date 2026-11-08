import UIKit
import CoreImage

nonisolated final class NativeRewardPreparationLease:@unchecked Sendable {
    private let lock=NSLock();private var retired=false
    var cancelled:Bool {lock.lock();defer{lock.unlock()};return retired}
    func cancel(){lock.lock();retired=true;lock.unlock()}
}
/// Runtime burn filter of the selected immutable collectible. One bounded
/// serial queue prepares its carrier; disposed screens reject late completion.
nonisolated enum NativeRewardFilteredFrames {
    private static let queue=DispatchQueue(label:"stacktosix.native-reward.filters",qos:.userInitiated)
    /// One star-sized frame set shared by the three selected result stars.
    static func prepareResultStar(_ image:CGImage,lease:NativeRewardPreparationLease,completion:@escaping ([CGImage],CGImage?)->Void) {
        queue.async {
            guard !lease.cancelled else{return}
            let frames=JimiNativeInterimEffect.renderBurn(image:image,size:CGSize(width:128,height:128),density:1,radius:0,exactAlpha:true,includeArtwork:false,uniformHighlight:true,cancelled:{lease.cancelled})
            guard !lease.cancelled else{return}
            let original=CIImage(cgImage:image)
            let bright=original.applyingFilter("CIColorMatrix",parameters:["inputRVector":CIVector(x:1.312,y:0,z:0,w:0),"inputGVector":CIVector(x:0,y:1.312,z:0,w:0),"inputBVector":CIVector(x:0,y:0,z:1.312,w:0)])
                .applyingFilter("CIColorControls",parameters:[kCIInputSaturationKey:1.156])
                .applyingFilter("CISepiaTone",parameters:[kCIInputIntensityKey:0.065])
            let glow=CIContext(options:[.cacheIntermediates:false]).createCGImage(bright,from:original.extent)
            guard !lease.cancelled else{return}
            Task { @MainActor in guard !lease.cancelled else{return};completion(frames,glow) }
        }
    }
    /// One selected final-score glyph raster, capped by the caller at512x160.
    static func prepareResultScore(_ image:CGImage,lease:NativeRewardPreparationLease,completion:@escaping ([CGImage])->Void) {
        queue.async {
            guard !lease.cancelled else{return}
            let frames=JimiNativeInterimEffect.renderBurn(image:image,size:CGSize(width:image.width,height:image.height),density:1,radius:0,exactAlpha:true,includeArtwork:false,uniformHighlight:true,cancelled:{lease.cancelled})
            guard !lease.cancelled else{return}
            Task { @MainActor in guard !lease.cancelled else{return};completion(frames) }
        }
    }
    static func prepareFaceEffects(_ image:CGImage,lease:NativeRewardPreparationLease,completion:@escaping (NativeMagicCardSource.Node)->Void) {
        queue.async {
            guard !lease.cancelled else{return}
            let root=NativeMagicCardSource.Node("g",[:])
            let face=NativeMagicCardSource.Node("image",["x":"0","y":"0","width":"360","height":"533"])
            face.image=image;root.children=[face]
            NativeMagicCardSource.prepareFaceEffects(face,lease:lease)
            guard !lease.cancelled else{return}
            Task { @MainActor in guard !lease.cancelled else{return};completion(root) }
        }
    }
    static func prepare(_ images:[String:UIImage],lease:NativeRewardPreparationLease,completion:@escaping ([String:UIImage])->Void) {
        queue.async {
            let context=CIContext(options:[.cacheIntermediates:false]);var result:[String:UIImage]=[:]
            for (path,image) in images where path.contains("colelctibles") {
                guard !lease.cancelled,let cg=image.cgImage else{continue}
                let original=CIImage(cgImage:cg)
                let bright=original.applyingFilter("CIColorMatrix",parameters:["inputRVector":CIVector(x:1.312,y:0,z:0,w:0),"inputGVector":CIVector(x:0,y:1.312,z:0,w:0),"inputBVector":CIVector(x:0,y:0,z:1.312,w:0)])
                    .applyingFilter("CIColorControls",parameters:[kCIInputSaturationKey:1.156])
                    .applyingFilter("CISepiaTone",parameters:[kCIInputIntensityKey:0.065])
                if let output=context.createCGImage(bright,from:original.extent) {result[path+"#burn"]=UIImage(cgImage:output,scale:image.scale,orientation:.up)}

            }
            let prepared=result
            Task { @MainActor in guard !lease.cancelled else{return};completion(prepared) }
        }
    }
}
