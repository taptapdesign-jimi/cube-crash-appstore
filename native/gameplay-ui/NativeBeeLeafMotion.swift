import Foundation

/// Shared source sampler for Bee finale and Forest Clean Board leaves.
struct NativeBeeLeafMotion {
    let birth:Double,lifetime:Double,birthX:Double,birthY:Double,velocityX:Double,velocityY:Double,gravity:Double,flutter:Double,spin:Double,scale:Double,peakOpacity:Double
    struct Pose {let visible:Bool;let x:Double,y:Double,opacity:Double,scale:Double,rotation:Double,skewX:Double,imageScaleX:Double,imageScaleY:Double}
    static func gravity(viewportHeight:Double,birthY:Double,velocityY:Double,lifetime:Double)->Double {
        max(320,2*(max(120,viewportHeight-birthY+110)-velocityY*lifetime)/(lifetime*lifetime))
    }
    func sample(seconds:Double)->Pose {
        let age=seconds-birth
        guard age>=0,age<=lifetime else {return Pose(visible:false,x:birthX,y:birthY,opacity:0,scale:0,rotation:0,skewX:0,imageScaleX:1,imageScaleY:1)}
        func clamp(_ p:Double)->Double {min(1,max(0,p))}
        let progress=clamp(age/lifetime),enter=clamp(age/0.07),exit=progress>0.72 ? clamp((1-progress)/0.28):1
        return Pose(visible:true,x:birthX+velocityX*age+sin(age*8.5+flutter)*(18+28*progress),y:birthY+velocityY*age+gravity*age*age*0.5+cos(age*10.5+flutter)*(14+19*progress),opacity:peakOpacity*enter*exit,scale:scale*(0.45+enter*0.7)*(1-progress*0.18),rotation:spin*age+sin(age*11+flutter)*16,skewX:sin(age*13+flutter)*9,imageScaleX:0.96+sin(age*12+flutter)*0.07,imageScaleY:1.01-sin(age*12+flutter)*0.06)
    }
}
