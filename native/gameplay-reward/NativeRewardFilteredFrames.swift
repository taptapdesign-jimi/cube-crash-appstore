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
    /// Same exact radial gradient and software blur, outside visible frame work.
    static func prepareArcadeThumbShadow(size:CGSize,lease:NativeRewardPreparationLease,completion:@escaping (UIImage?)->Void) {
        queue.async {
            guard !lease.cancelled else{return}
            let image=autoreleasepool {NativeArcadeThumbShadow.makeShadow(size:size,alphaGain:1)}
            guard !lease.cancelled else{return}
            Task { @MainActor in guard !lease.cancelled else{return};completion(image) }
        }
    }
    /// Compile the exact counter filter/radius family before its visible clock.
    /// The context transfers only after the worker's final synchronous render;
    /// it is never used by this worker and the visible result concurrently.
    static func prepareCounterBlur(lease:NativeRewardPreparationLease,completion:@escaping (CIContext?)->Void) {
        queue.async {
            guard !lease.cancelled else{return}
            autoreleasepool {
                let start=ProcessInfo.processInfo.systemUptime
                let context=CIContext(options:[.cacheIntermediates:false])
                // Use a finite bitmap input, exactly like the score glyphs.
                // A procedural constant color can select a different fused
                // kernel and leave the first bitmap blur cold.
                guard let bitmap=CGContext(data:nil,width:64,height:64,bitsPerComponent:8,bytesPerRow:64*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else {
                    context.clearCaches();Task { @MainActor in guard !lease.cancelled else{return};completion(nil) };return
                }
                bitmap.setFillColor(CGColor(red:1,green:1,blue:1,alpha:1));bitmap.fill(CGRect(x:12,y:12,width:40,height:40))
                guard let image=bitmap.makeImage() else {
                    context.clearCaches();Task { @MainActor in guard !lease.cancelled else{return};completion(nil) };return
                }
                let input=CIImage(cgImage:image)
                for step in 1...20 {
                    guard !lease.cancelled else{context.clearCaches();return}
                    let output=input.applyingFilter("CIMotionBlur",parameters:[kCIInputRadiusKey:Double(step)*0.5,kCIInputAngleKey:Double.pi/2])
                    guard context.createCGImage(output,from:input.extent) != nil else {
                        context.clearCaches()
                        Task { @MainActor in guard !lease.cancelled else{return};completion(nil) }
                        return
                    }
                }
                guard !lease.cancelled else{context.clearCaches();return}
                #if DEBUG
                NSLog("[NativeResultCounterBlur] prepared durationMs=%.1f",(ProcessInfo.processInfo.systemUptime-start)*1000)
                #endif
                Task { @MainActor in
                    guard !lease.cancelled else{retireCounterBlur(context);return}
                    completion(context)
                }
            }
        }
    }
    /// Potential driver cache retirement never blocks the outgoing result/CTA.
    static func retireCounterBlur(_ context:CIContext) {queue.async {context.clearCaches()}}
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
