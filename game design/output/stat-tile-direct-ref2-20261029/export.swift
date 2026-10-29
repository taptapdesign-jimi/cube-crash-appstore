import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let root=URL(fileURLWithPath:FileManager.default.currentDirectoryPath)
let work=root.appendingPathComponent("game design/output/stat-tile-direct-ref2-20261029")
let source=root.appendingPathComponent("game design/output/stat-tile-no-wood-20261029/candidate-01.png")
let destination=root.appendingPathComponent("assets/ui/native-stage-stats-v13")
let original=CGImageSourceCreateImageAtIndex(CGImageSourceCreateWithURL(source as CFURL,nil)!,0,nil)!
let w=original.width,h=original.height,space=CGColorSpace(name:CGColorSpace.sRGB)!
let format=CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue
var rgba=[UInt8](repeating:0,count:w*h*4)
rgba.withUnsafeMutableBytes {p in let c=CGContext(data:p.baseAddress,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:space,bitmapInfo:format)!;c.draw(original,in:CGRect(x:0,y:0,width:w,height:h))}
// Remove detached exterior generation debris only. No crop, contour construction,
// interior blending, copied rim, morphology or old-asset pixels.
var seen=[Bool](repeating:false,count:w*h),largest=[Int](),componentCount=0
for i in 0..<(w*h) where !seen[i] && rgba[i*4+3]>0 {
    var queue=[i],head=0;seen[i]=true
    while head<queue.count {
        let p=queue[head];head+=1;let x=p%w,y=p/w
        for dy in -1...1 {for dx in -1...1 where dx != 0 || dy != 0 {
            let nx=x+dx,ny=y+dy
            if nx>=0 && nx<w && ny>=0 && ny<h {let q=ny*w+nx
                if !seen[q] && rgba[q*4+3]>0 {seen[q]=true;queue.append(q)}
            }
        }}
    }
    componentCount+=1;if queue.count>largest.count {largest=queue}
}
var keep=[Bool](repeating:false,count:w*h);for p in largest {keep[p]=true}
var removed=0
for p in 0..<(w*h) where !keep[p] && rgba[p*4+3]>0 {for ch in 0..<4 {rgba[p*4+ch]=0};removed+=1}
func write(_ image:CGImage,_ url:URL){let writer=CGImageDestinationCreateWithURL(url as CFURL,UTType.png.identifier as CFString,1,nil)!;CGImageDestinationAddImage(writer,image,nil);precondition(CGImageDestinationFinalize(writer))}
rgba.withUnsafeMutableBytes {p in
    let c=CGContext(data:p.baseAddress,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:space,bitmapInfo:format)!
    let clean=c.makeImage()!;write(clean,work.appendingPathComponent("reference-2-clean.png"))
    for density in 1...3 {
        let width=138*density,height=176*density,pad=Double(density)
        let out=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:space,bitmapInfo:format)!
        let scale=min((Double(width)-2*pad)/Double(w),(Double(height)-2*pad)/Double(h))
        let target=CGRect(x:(Double(width)-Double(w)*scale)/2,y:(Double(height)-Double(h)*scale)/2,width:Double(w)*scale,height:Double(h)*scale)
        out.interpolationQuality = .high;out.draw(clean,in:target)
        write(out.makeImage()!,destination.appendingPathComponent("stat-tile\(density == 1 ? "":"@\(density)x").png"))
    }
}
print("Direct reference2 export: \(w)x\(h), largest connected image \(largest.count)px; removed \(removed) detached pixels across \(componentCount-1) components. Entire image aspect-fit with1pt transparent padding. No old asset inputs.")
