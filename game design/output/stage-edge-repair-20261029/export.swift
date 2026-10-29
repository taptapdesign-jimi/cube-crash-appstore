import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// Offline, narrow RGB repair. Preserve every original alpha byte and all pixels
// outside the two side strips. No runtime image processing.
let root=URL(fileURLWithPath:FileManager.default.currentDirectoryPath)
let work=root.appendingPathComponent("game design/output/stage-edge-repair-20261029")
let dest=root.appendingPathComponent("assets/ui/native-stage-stats-v10")
try FileManager.default.createDirectory(at:dest,withIntermediateDirectories:true)
func load(_ u:URL)->CGImage {CGImageSourceCreateImageAtIndex(CGImageSourceCreateWithURL(u as CFURL,nil)!,0,nil)!}
func bytes(_ i:CGImage)->[UInt8] {
    precondition(i.bitsPerPixel==32 && i.alphaInfo == .last)
    let d=i.dataProvider!.data!;return Array(UnsafeBufferPointer(start:CFDataGetBytePtr(d),count:CFDataGetLength(d)))
}
let paint=load(work.appendingPathComponent("generated-edge.png")),p=bytes(paint)
func edge(_ a:[UInt8],_ row:Int,_ w:Int,_ y:Int,_ left:Bool)->Int {
    var x=w/2
    while x>0 && x<w-1 && a[y*row+x*4+3]>220 {x += left ? -1:1}
    return x+(left ? 1:-1)
}
var profiles=[String:[UInt8]]()
for density in 1...3 {
    let suffix=density==1 ? "":"@\(density)x"
    for variant in 1...3 {
        let name="info-slab-\(variant)\(suffix).png"
        let original=load(root.appendingPathComponent("assets/ui/native-stage-stats-v9/"+name))
        let a=bytes(original),w=original.width,h=original.height,row=original.bytesPerRow
        var out=a
        for y in Int(Double(h)*0.13)..<Int(Double(h)*0.86) {
            let fy=Double(y)/Double(h)
            let vertical=min(1,min((fy-0.13)/0.035,(0.86-fy)/0.035))
            let py=max(0,min(paint.height-1,Int(Double(paint.height)*fy)))
            for left in [true,false] {
                let oldEdge=edge(a,row,w,y,left),newEdge=edge(p,paint.bytesPerRow,paint.width,py,left)
                for distance in 0..<(14*density) {
                    let x=oldEdge+(left ? distance:-distance)
                    guard x>=0 && x<w else{continue}
                    let i=y*row+x*4
                    guard a[i+3]>0 else{continue}
                    let shift=Int(Double(distance)*Double(paint.width)/Double(w))
                    let px=max(0,min(paint.width-1,newEdge+(left ? shift:-shift)))
                    _ = px
                    // A stable rounded-bevel profile removes the repeated white
                    // patch breaks retained by generation. Interior texture fades
                    // back in over the inner5pt; alpha still comes from original.
                    let key="\(density)-\(left)-\(distance)"
                    if profiles[key] == nil {
                    let profile=(0...30).map { sample -> Int in
                        let sy=Int(Double(paint.height)*(0.20+Double(sample)*0.018))
                        let boundary=edge(p,paint.bytesPerRow,paint.width,sy,left)
                        let sx=max(0,min(paint.width-1,boundary+(left ? shift:-shift)))
                        return sy*paint.bytesPerRow+sx*4
                    }
                    profiles[key]=(0..<3).map{ch in profile.map{p[$0+ch]}.sorted()[profile.count/2]}
                    }
                    let blend=vertical*max(0,min(1,(14-Double(distance)/Double(density))/5))
                    for ch in 0..<3 {out[i+ch]=UInt8((Double(a[i+ch])*(1-blend)+Double(profiles[key]![ch])*blend).rounded())}
                }
            }
        }
        let data=Data(out) as CFData
        let image=CGImage(width:w,height:h,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:row,space:original.colorSpace!,bitmapInfo:original.bitmapInfo,provider:CGDataProvider(data:data)!,decode:nil,shouldInterpolate:true,intent:.defaultIntent)!
        let writer=CGImageDestinationCreateWithURL(dest.appendingPathComponent(name) as CFURL,UTType.png.identifier as CFString,1,nil)!
        CGImageDestinationAddImage(writer,image,nil);precondition(CGImageDestinationFinalize(writer))
    }
}
print("Nine edge-only assets exported; original alpha and non-edge bytes preserved.")
