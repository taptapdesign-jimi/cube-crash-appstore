import UIKit
import CoreText
import Foundation

@MainActor
func check() throws {
 let root=URL(fileURLWithPath:"/Users/user/cube-crash/assets")
 CTFontManagerRegisterFontsForURL(root.appendingPathComponent("fonts/Baloo2-ExtraBold.ttf") as CFURL,.process,nil)
 let font=UIFont(name:"Baloo2-ExtraBold",size:16)!
 let images=NativeNoMovesCloudPlan.paths.map{UIImage(contentsOfFile:"/Users/user/cube-crash/"+$0)!}
 var seed:UInt32=19
 func random()->Double{seed=1664525 &* seed &+ 1013904223;return Double(seed)/4294967296}
 let owner=try NativeNoMovesPresentation(font:font,images:images,viewport:CGSize(width:390,height:844),generation:12,random:random)
 precondition(owner.generation==12 && !owner.isUserInteractionEnabled)
 let labels=owner.subviews.last!.subviews.compactMap{$0 as? UILabel}
 precondition(labels.map{$0.text!}.joined()=="No\u{00A0}Moves")
 precondition(labels.count==8 && owner.subviews.count==6)
 precondition(labels.allSatisfy{$0.font.fontName=="Baloo2-ExtraBold"})
 owner.paint(at:1.1)
 precondition(labels.allSatisfy{$0.alpha==1})
 precondition(owner.subviews.dropLast().allSatisfy{$0.isHidden},"all five clouds must have completed finite source exits")
 let painted=labels.map{$0.layer.transform};owner.isHidden=true
 precondition(labels.allSatisfy{$0.layer.animationKeys()?.isEmpty != false},"renderer must not own a hidden ticker/CA animation")
 owner.isHidden=false;owner.paint(at:1.1)
 precondition(zip(painted,labels.map{$0.layer.transform}).allSatisfy{CATransform3DEqualToTransform($0,$1)})
 let canvas=UIView(frame:owner.bounds);canvas.backgroundColor=UIColor(red:249.0/255,green:238.0/255,blue:216.0/255,alpha:1);canvas.addSubview(owner)
 let image=UIGraphicsImageRenderer(size:canvas.bounds.size).image{ctx in canvas.layer.render(in:ctx.cgContext)}
 try image.pngData()!.write(to:URL(fileURLWithPath:"/tmp/native-v9-no-moves.png"))
 var replies:[Bool]=[];owner.onExitFinished={replies.append($0)}
 let duration=owner.beginExit(at:1.1,random:random)
 precondition(abs(duration-1.07)<1e-12)
 let captured=labels.map{$0.layer.transform};_ = owner.beginExit(at:1.2,random:random)
 owner.paint(at:1.1)
 precondition(zip(captured,labels.map{$0.layer.transform}).allSatisfy{CATransform3DEqualToTransform($0,$1)})
 owner.paint(at:2.18);owner.paint(at:3);owner.dispose();precondition(replies==[true] && owner.disposed)
 let cancel=try NativeNoMovesPresentation(font:font,images:images,viewport:CGSize(width:320,height:568),generation:13,random:random)
 var cancelled:[Bool]=[];cancel.onExitFinished={cancelled.append($0)};cancel.dispose();cancel.dispose();cancel.paint(at:3);precondition(cancelled==[false])
 do {_ = try NativeNoMovesPresentation(font:UIFont.systemFont(ofSize:16),images:images,viewport:.zero,generation:1,random:random);preconditionFailure("missing original font admitted")}catch{}
 print("PASS actual UIKit NO MOVES original fonts/art, finite clouds, captured exit, duplicate exit/dispose, late paint, missing resources")
}
try MainActor.assumeIsolated{try check()}
