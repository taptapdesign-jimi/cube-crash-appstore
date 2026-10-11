import Foundation

/// Literal ordinary _setValueVisuals/_drawStackInternal values. Parent geometry
/// transforms the complete node once; all coordinates here are source tile units.
struct NativeRegularStackLayout:Equatable {
 enum Skin:String,CaseIterable {case base="./assets/tile_numbers.png",second="./assets/tile_numbers2.png",third="./assets/tile_numbers3.png",fourth="./assets/tile_numbers4.png"}
 struct Layer:Equatable {
  let index:Int,x:Double,y:Double,rotation:Double,z:Int
  let size:Double,spriteScaleX:Double,spriteScaleY:Double,anchorX:Double,anchorY:Double
  let spriteAlpha:Double=0.9,overlayAlpha:Double=0.25
  let overlayColor:UInt32=0x8B5A2B,overlayRadius:Double=20
 }
 let depth:Int,skin:Skin,layers:[Layer]
 static func capture(depth:Int,add:Int,baseX:Double=0,baseY:Double=0,baseScaleX:Double=1,baseScaleY:Double=1,anchorX:Double=0.5,anchorY:Double=0.5,available:Set<Skin>=Set(Skin.allCases),random:()->Double)->Self {
  let skin=chooseSkin(available:available,random:random)
  let current=max(1,depth),next=add==0 ? current:min(4,current+add)
  return captureLayers(depth:next,skin:skin,baseX:baseX,baseY:baseY,baseScaleX:baseScaleX,baseScaleY:baseScaleY,anchorX:anchorX,anchorY:anchorY,random:random)
 }
 static func chooseSkin(available:Set<Skin>,random:()->Double)->Skin {
  let draw=random(),preferred:Skin=draw<0.4 ? .base:draw<0.7 ? .second:draw<0.9 ? .third:.fourth
  return available.contains(preferred) ? preferred:.base
 }
 static func captureLayers(depth next:Int,skin:Skin,baseX:Double=0,baseY:Double=0,baseScaleX:Double=1,baseScaleY:Double=1,anchorX:Double=0.5,anchorY:Double=0.5,random:()->Double)->Self {
  var direction=0,layers:[Layer]=[]
  for index in 1..<max(1,next) {
   let shrink=1-Double(index)*0.05
   let x=baseX+(random()*2-1)*(6+Double(index)*1.6)
   let y=baseY+(random()*2-1)*(5+Double(index)*1.3)
   direction=direction==0 ? (random()>0.5 ? 1:-1):-direction
   let rotation=Double(direction)*(10+random()*10)*Double.pi/180
   layers.append(.init(index:index,x:x,y:y,rotation:rotation,z:-10+index,size:128*shrink,spriteScaleX:baseScaleX*shrink,spriteScaleY:baseScaleY*shrink,anchorX:anchorX,anchorY:anchorY))
  }
  return .init(depth:next,skin:skin,layers:layers)
 }
}

/// Immutable child capture for app-core's srcDepth>1 loop, taken BEFORE it
/// appends overlays. Includes old overlay children if they still exist.
struct NativeRegularStackLayerCapture:Equatable {
 let id:String,x:Double,y:Double,rotation:Double,scaleX:Double,scaleY:Double
}
struct NativeRegularStackContactOverlay:Equatable {
 let layer:NativeRegularStackLayerCapture,targetRotation:Double
 let duration:Double=0.2,overlayDelay:Double=0.2,overlayDuration:Double=0.4
 let color:UInt32=0x8B4513,fillAlpha:Double=0.4,z:Int = -1,size:Double=128
 static func capture(children:[NativeRegularStackLayerCapture],sourceDepth:Int,random:()->Double)->[Self] {
  guard sourceDepth>1 else{return []}
  var direction=0
  return children.map {child in
   direction=direction==0 ? (random()>0.5 ? 1:-1):-direction
   let rotation=Double(direction)*(5+random()*5)*Double.pi/180
   return .init(layer:child,targetRotation:rotation)
  }
 }
 func rotation(seconds:Double,capturedStart:Double)->Double {
  let p=max(0,min(1,seconds/duration)),ease=1-pow(1-p,3)
  return capturedStart+(targetRotation-capturedStart)*ease
 }
 func alpha(seconds:Double)->Double {
  let p=max(0,min(1,(seconds-overlayDelay)/overlayDuration))
  return pow(1-p,2) // literal omitted ease uses original GSAP power1.out
 }
}
