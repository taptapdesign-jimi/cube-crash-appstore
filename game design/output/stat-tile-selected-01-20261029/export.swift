import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let root=URL(fileURLWithPath:FileManager.default.currentDirectoryPath)
let work=root.appendingPathComponent("game design/output/stat-tile-selected-01-20261029")
let dest=root.appendingPathComponent("assets/ui/native-stage-stats-v14")
let source=work.appendingPathComponent("approved-source.png")
let image=CGImageSourceCreateImageAtIndex(CGImageSourceCreateWithURL(source as CFURL,nil)!,0,nil)!
let space=CGColorSpace(name:CGColorSpace.sRGB)!
let format=CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue
var manifest=[[String:Any]]()
for density in 1...3 {
    let w=138*density,h=176*density,padding=Double(density)
    let c=CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:space,bitmapInfo:format)!
    let scale=min((Double(w)-2*padding)/Double(image.width),(Double(h)-2*padding)/Double(image.height))
    let rect=CGRect(x:(Double(w)-Double(image.width)*scale)/2,y:(Double(h)-Double(image.height)*scale)/2,width:Double(image.width)*scale,height:Double(image.height)*scale)
    c.interpolationQuality = .high;c.draw(image,in:rect)
    let name="stat-tile\(density == 1 ? "":"@\(density)x").png"
    let writer=CGImageDestinationCreateWithURL(dest.appendingPathComponent(name) as CFURL,UTType.png.identifier as CFString,1,nil)!
    CGImageDestinationAddImage(writer,c.makeImage()!,nil);precondition(CGImageDestinationFinalize(writer))
    manifest.append(["file":name,"density":density,"width":w,"height":h,"uniformScale":scale,"paddingPoints":1])
}
try JSONSerialization.data(withJSONObject:manifest,options:[.prettyPrinted,.sortedKeys]).write(to:work.appendingPathComponent("density-manifest.json"))
print("Exported complete approved candidate01 at1x,2x,3x;uniform scaling,1pt transparent padding;no crop,mask,composite or repaint.")
