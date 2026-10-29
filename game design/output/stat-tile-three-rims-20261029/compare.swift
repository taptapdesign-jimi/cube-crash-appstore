import AppKit
import Foundation
let dir=URL(fileURLWithPath:FileManager.default.currentDirectoryPath).appendingPathComponent("game design/output/stat-tile-three-rims-20261029")
let canvas=NSSize(width:1110,height:610)
let image=NSImage(size:canvas)
image.lockFocus()
NSColor(calibratedRed:0.91,green:0.85,blue:0.77,alpha:1).setFill();NSBezierPath(rect:NSRect(origin:.zero,size:canvas)).fill()
for i in 1...3 {
    let source=NSImage(contentsOf:dir.appendingPathComponent("candidate-0\(i).png"))!
    let box=NSRect(x:CGFloat(i-1)*370+20,y:60,width:330,height:525)
    let scale=min(box.width/source.size.width,box.height/source.size.height)
    let size=NSSize(width:source.size.width*scale,height:source.size.height*scale)
    source.draw(in:NSRect(x:box.midX-size.width/2,y:box.midY-size.height/2,width:size.width,height:size.height),from:.zero,operation:.sourceOver,fraction:1)
    let label="\(i)" as NSString
    let attrs:[NSAttributedString.Key:Any]=[.font:NSFont.boldSystemFont(ofSize:27),.foregroundColor:NSColor(calibratedRed:0.40,green:0.28,blue:0.21,alpha:1)]
    let labelSize=label.size(withAttributes:attrs)
    label.draw(at:NSPoint(x:box.midX-labelSize.width/2,y:15),withAttributes:attrs)
}
image.unlockFocus()
let rep=NSBitmapImageRep(data:image.tiffRepresentation!)!
try rep.representation(using:.png,properties:[:])!.write(to:dir.appendingPathComponent("comparison.png"))
