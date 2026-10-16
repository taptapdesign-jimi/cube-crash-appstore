import UIKit

/// Bounded one-time alpha measurement of original artwork, never a GPU readback.
nonisolated enum NativeArtworkAlphaBounds {
    static func measure(_ image:UIImage)->CGRect {
        let full=CGRect(x:0,y:0,width:1,height:1)
        guard let source=image.cgImage else{return full}
        let factor=min(1,256/CGFloat(max(source.width,source.height)))
        let width=max(1,Int(CGFloat(source.width)*factor)),height=max(1,Int(CGFloat(source.height)*factor))
        var pixels=[UInt8](repeating:0,count:width*height*4)
        return pixels.withUnsafeMutableBytes { buffer in
            guard let context=CGContext(data:buffer.baseAddress,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return full}
            context.draw(source,in:CGRect(x:0,y:0,width:width,height:height))
            var first=height,last = -1,left=width,right = -1
            for row in 0..<height {
                for column in 0..<width where buffer[row*width*4+column*4+3]>8 {first=min(first,row);last=row;left=min(left,column);right=max(right,column)}
            }
            return last>=first ? CGRect(x:CGFloat(left)/CGFloat(width),y:CGFloat(first)/CGFloat(height),width:CGFloat(right-left+1)/CGFloat(width),height:CGFloat(last-first+1)/CGFloat(height)):full
        }
    }
}
