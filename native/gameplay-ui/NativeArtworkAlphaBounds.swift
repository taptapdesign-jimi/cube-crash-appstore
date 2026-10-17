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
    /// One selected-sheet raster and one row traversal. Retain rectangles only,
    /// never CPU atlas pixels or a GPU readback between animation frames.
    static func measureFrames(_ source:CGImage,cell:CGSize,columns:Int,frameCount:Int,
        current:@Sendable ()->Bool={true})->[CGRect]? {
        let width=source.width,height=source.height,cw=Int(cell.width),ch=Int(cell.height)
        guard current(),cw>0,ch>0,columns>0,frameCount>0,width==cw*columns,
              height>=((frameCount+columns-1)/columns)*ch else{return nil}
        var pixels=[UInt8](repeating:0,count:width*height*4)
        return pixels.withUnsafeMutableBytes {buffer in
            guard current(),let context=CGContext(data:buffer.baseAddress,width:width,height:height,
                bitsPerComponent:8,bytesPerRow:width*4,space:CGColorSpaceCreateDeviceRGB(),
                bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return nil}
            context.draw(source,in:CGRect(x:0,y:0,width:width,height:height))
            var left=[Int](repeating:cw,count:frameCount),right=[Int](repeating:-1,count:frameCount)
            var top=[Int](repeating:ch,count:frameCount),bottom=[Int](repeating:-1,count:frameCount)
            let bytes=buffer.baseAddress!.assumingMemoryBound(to:UInt8.self)
            for row in 0..<height {
                guard current() else{return nil}
                let firstFrame=(row/ch)*columns,localY=row%ch
                let rowPixels=bytes.advanced(by:row*width*4)
                for cellColumn in 0..<columns {
                    let index=firstFrame+cellColumn
                    guard index<frameCount else{break}
                    let cellPixels=rowPixels.advanced(by:cellColumn*cw*4)
                    // Only row extrema affect an alpha rectangle. Scan inward
                    // from both edges and skip its entire opaque interior.
                    var first=0
                    while first<cw && cellPixels[first*4+3]<=8 {first+=1}
                    guard first<cw else{continue}
                    var last=cw-1
                    while last>first && cellPixels[last*4+3]<=8 {last-=1}
                    if first<left[index] {left[index]=first}
                    if last>right[index] {right[index]=last}
                    if localY<top[index] {top[index]=localY}
                    bottom[index]=localY
                }
            }
            return (0..<frameCount).map {index in
                guard right[index]>=left[index],bottom[index]>=top[index] else{return CGRect(x:0,y:0,width:1,height:1)}
                return CGRect(x:CGFloat(left[index])/CGFloat(cw),y:CGFloat(top[index])/CGFloat(ch),
                    width:CGFloat(right[index]-left[index]+1)/CGFloat(cw),height:CGFloat(bottom[index]-top[index]+1)/CGFloat(ch))
            }
        }
    }

}
