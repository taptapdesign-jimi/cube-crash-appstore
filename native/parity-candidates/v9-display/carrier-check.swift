import UIKit
import SpriteKit
import Foundation

@MainActor
func check() throws {
 var generation:UInt64=4,finished:[Bool]=[]
 let owner=try NativeRegularSixSpritePresentation(origin:CGPoint(x:190,y:400),tileSize:70,destinationDepth:43,combinedDepth:12,generation:4,reduced:false,hotFactor:1,patternIndex:0,isCurrent:{$0==generation},random:{0.4})
 let sprites=owner.multiplierLayer.children.compactMap{$0 as? SKSpriteNode}
 precondition(sprites.count==1 && sprites[0].name=="native-regular-six-multiplier:×12" && sprites[0].texture != nil)
 precondition(owner.multiplierLayer.children.allSatisfy{!($0 is SKLabelNode)})
 owner.onFinished={finished.append($0)};owner.paint(seconds:0.2)
 precondition(owner.multiplierLayer.alpha>0.9 && owner.multiplierLayer.xScale>0.9)
 generation=5;owner.paint(seconds:0.3);owner.dispose();precondition(finished==[false])
 print("PASS connected ordinary6 SpriteKit carrier: raster ×12, source motion, stale generation cleanup once")
}
try MainActor.assumeIsolated{try check()}
