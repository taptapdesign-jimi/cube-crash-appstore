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
    /// One display-sized immutable sweep carrier. The existing preparation lease
    /// and serial queue own decode/filter work; there is no animation clock here.
    static func prepareShimmer(size:CGSize,displayScale:CGFloat,lease:NativeRewardPreparationLease,completion:@escaping(CGImage?)->Void) {
        let density=max(1,displayScale),width=Int(ceil(size.width*density)),height=Int(ceil(size.height*density))
        queue.async {
            guard !lease.cancelled,width>0,height>0,width<=2048,height<=2048 else{return}
            let space=CGColorSpaceCreateDeviceRGB()
            guard let bitmap=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:space,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue),
                  let gradient=CGGradient(colorsSpace:space,colors:[CGColor(red:1,green:1,blue:1,alpha:0),CGColor(red:1,green:1,blue:1,alpha:0.52),CGColor(red:1,green:1,blue:1,alpha:0)] as CFArray,locations:[0,0.5,1]) else{return}
            bitmap.drawLinearGradient(gradient,start:CGPoint(x:0,y:0),end:CGPoint(x:width,y:0),options:[])
            guard !lease.cancelled,let source=bitmap.makeImage() else{return}
            let input=CIImage(cgImage:source),blur=input.applyingFilter("CIGaussianBlur",parameters:[kCIInputRadiusKey:0.56*density])
            let image=CIContext(options:[.cacheIntermediates:false]).createCGImage(blur,from:input.extent)
            Task { @MainActor in guard !lease.cancelled else{return};completion(image) }
        }
    }
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
            for (path,image) in images where path.contains("colelctibles") || path.hasSuffix("/zguzvano9.png") {
                guard !lease.cancelled,let cg=image.cgImage else{continue}
                let original=CIImage(cgImage:cg)
                let bright=original.applyingFilter("CIColorMatrix",parameters:["inputRVector":CIVector(x:1.312,y:0,z:0,w:0),"inputGVector":CIVector(x:0,y:1.312,z:0,w:0),"inputBVector":CIVector(x:0,y:0,z:1.312,w:0)])
                    .applyingFilter("CIColorControls",parameters:[kCIInputSaturationKey:1.156])
                    .applyingFilter("CISepiaTone",parameters:[kCIInputIntensityKey:0.065])
                if let output=context.createCGImage(bright,from:original.extent) {result[path+"#burn"]=UIImage(cgImage:output,scale:image.scale,orientation:.up)}
                if path.hasSuffix("/zguzvano9.png") {
                    let impact=original.applyingFilter("CIColorMatrix",parameters:["inputRVector":CIVector(x:1.32,y:0,z:0,w:0),"inputGVector":CIVector(x:0,y:1.32,z:0,w:0),"inputBVector":CIVector(x:0,y:0,z:1.32,w:0)])
                        .applyingFilter("CIColorControls",parameters:[kCIInputSaturationKey:1.08])
                    if let output=context.createCGImage(impact,from:original.extent) {result[path+"#impact"]=UIImage(cgImage:output,scale:image.scale,orientation:.up)}
                }
            }
            let prepared=result
            Task { @MainActor in guard !lease.cancelled else{return};completion(prepared) }
        }
    }
}
