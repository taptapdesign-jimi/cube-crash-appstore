import Foundation
import CoreGraphics

/// Authored CSS lengths have been resolved into typed native geometry at build
/// time. Runtime layout uses viewport and original image ratios, never WebKit.
enum NativeTransitionSceneGeometry {
    struct Variation {var beachSwapped=false,frontDirection=1,walkerDirection = -1}
    struct Layer {
        let definition:NativeTransitionThemeLayers.Layer
        let frame:CGRect
        let left,bottom,width,height:Double
    }
    static func sceneFrame(viewport:CGSize)->CGRect {
        let tablet=(769...1366).contains(viewport.width),height=min(viewport.height*0.44,380)+120
        return CGRect(x:0,y:viewport.height+(tablet ? 76:52)-height,width:viewport.width,height:height)
    }
    static func layers(theme:NativeBoardTransitionPlan.Theme,viewport:CGSize,variation:Variation)->[Layer] {
        let scene=sceneFrame(viewport:viewport),vw=Double(viewport.width),vh=Double(viewport.height),sh=Double(scene.height),tablet=(769...1366).contains(vw)
        return NativeTransitionThemeLayers.layers(theme).map {d in
            var left=d.leftRatio*vw+d.leftOffset,bottom=d.bottomRatio*sh+d.bottomOffset+d.bottomViewportRatio*vh
            let width=d.widthRatio>0 ? min(vw*d.widthRatio,d.maximumWidth):d.maximumWidth,height=width*d.heightRatio
            if tablet, ["mountain","hill1","hill2"].contains(d.key) {
                left=vw/2;bottom=d.key=="mountain" ? 140:d.key=="hill2" ? 13:70
            }
            if theme == .beach {
                if d.key=="beach-bottle" || d.key=="beach-ball" {
                    let isBottle=d.key=="beach-bottle",right=variation.beachSwapped ? !isBottle:isBottle
                    left=vw*(right ? 0.94:0.06)
                }
                if d.key=="beach-castle",variation.beachSwapped {left=vw*0.32-30}
                if d.key=="beach-shore-1",variation.beachSwapped {left=vw*(-0.06)+180}
            }
            if theme == .area55 {
                if d.key=="robo-front" {left=vw*(variation.frontDirection==1 ? 0.16:0.84)}
                if d.key=="robo-walker" {left=vw*(variation.walkerDirection==1 ? 0.20:0.80)}
            }
            return Layer(definition:d,frame:CGRect(x:left-width/2,y:sh-bottom-height,width:width,height:height),left:left,bottom:bottom,width:width,height:height)
        }
    }
}
