import Foundation
import CoreGraphics

/// Original spatial scheduler. Optional draws refuse a retired APP stream;
/// they never fabricate a fallback number or rewind consumed Source Math.
struct NativeSourceBoardEntryPlan:Equatable,Sendable {
    enum Preset:String,CaseIterable {case inward,outward,diagonal,burst}
    let preset:Preset,tileIndex:Int,delay:Double,offset:CGPoint,rotation:Double
    static let grow=0.18,compress=0.12,rebound=0.12,settle=0.14
    static let opacityDuration=0.08
    var fullOpacityTime:Double{delay+Self.opacityDuration}
    var end:Double{delay+Self.grow+Self.compress+Self.rebound+Self.settle}
    static func make(positions:[CGPoint],maxOffset:Double,random:()->Double?)->[Self]? {
        func unit()->Double? {guard let value=random() else{return nil};return max(0,min(0.999999,value.isFinite ? value:0))}
        guard let presetDraw=unit(),let cornerDraw=unit() else{return nil}
        let preset=Preset.allCases[Int(presetDraw*4)],corner=Int(cornerDraw*4)
        guard !positions.isEmpty else{return []} // Source still consumed two above.
        let minX=positions.map(\.x).min()!,maxX=positions.map(\.x).max()!,minY=positions.map(\.y).min()!,maxY=positions.map(\.y).max()!
        let center=CGPoint(x:(minX+maxX)/2,y:(minY+maxY)/2),cornerPoint=CGPoint(x:corner%2==0 ? minX:maxX,y:corner<2 ? minY:maxY)
        let radius=max(1,positions.map{hypot($0.x-center.x,$0.y-center.y)}.max()!)
        func score(_ index:Int)->Double {let point=positions[index];if preset == .diagonal{return abs(point.x-cornerPoint.x)+abs(point.y-cornerPoint.y)};let distance=hypot(point.x-center.x,point.y-center.y);return preset == .inward ? -distance:distance}
        let order=positions.indices.sorted{score($0)==score($1) ? $0<$1:score($0)<score($1)}
        let stagger=positions.count>1 ? min(0.018,0.36/Double(positions.count-1)):0,distance=max(0,maxOffset)
        var result:[Self]=[]
        for (index,tileIndex) in order.enumerated() {
            let radialX=(positions[tileIndex].x-center.x)/radius,radialY=(positions[tileIndex].y-center.y)/radius
            let direction=preset == .inward ? 1.0:(preset == .outward || preset == .burst ? -1.0:0.0)
            let factor=preset == .burst ? 0.72:(preset == .outward ? 0.58:1)
            let offset=preset == .diagonal ? CGPoint(x:(corner%2==0 ? -1:1)*distance*0.52,y:(corner<2 ? -1:1)*distance*0.52):CGPoint(x:radialX*distance*direction*factor,y:radialY*distance*direction*factor)
            guard let tilt=unit() else{return nil}
            result.append(.init(preset:preset,tileIndex:tileIndex,delay:0.02+Double(index)*stagger,offset:offset,rotation:(tilt*2-1)*(preset == .burst ? 8:6)*Double.pi/180))
        }
        return result
    }
    static func haptics(_ plans:[Self])->[Double] {
        let delays=plans.map(\.delay).sorted();guard let first=delays.first,let last=delays.last else{return []}
        let count=min(6,delays.count,Int(floor(max(0,last-first)/0.05))+1)
        guard count>1 else{return [first]};var result:[Double]=[]
        for index in 0..<count {let quantile=Int((Double(index)*Double(delays.count-1)/Double(count-1)).rounded()),actual=delays[quantile];result.append(result.last.map{min(last,max(actual,$0+0.05))} ?? actual)}
        return result
    }
}

/// Local single-parent timeline channels for an entry-exclusive fresh regular
/// holder. Parent callback order and lifetime are owned by the mounted carrier.
struct NativeSourceBoardEntryPose:Equatable,Sendable {
    let x:Double,y:Double,rotation:Double,scale:Double,alpha:Double
    static func sample(_ plan:NativeSourceBoardEntryPlan,rest:CGPoint,rotation:Double,locked:Bool,value:Int,seconds:Double)->Self {
        let local=seconds-plan.delay,initialAlpha=locked && value==0 ? 0.25:0.0,targetAlpha=locked ? (value>0 ? 0:0.25):1.0
        guard local>=0 else{return .init(x:rest.x+plan.offset.x,y:rest.y+plan.offset.y,rotation:rotation+plan.rotation,scale:0,alpha:initialAlpha)}
        func sine(_ t:Double)->Double{(1-cos(Double.pi*max(0,min(1,t))))/2}
        func back(_ t:Double)->Double{let p=max(0,min(1,t))-1;return 1+p*p*(2.7*p+1.7)}
        let move=back(local/0.42),fade=1-pow(1-max(0,min(1,local/NativeSourceBoardEntryPlan.opacityDuration)),3)
        let scale:Double
        if local<0.18 {scale=1.08*back(local/0.18)}
        else if local<0.30 {scale=1.08+(0.96-1.08)*sine((local-0.18)/0.12)}
        else if local<0.42 {scale=0.96+(1.02-0.96)*sine((local-0.30)/0.12)}
        else {scale=1.02+(1-1.02)*sine((local-0.42)/0.14)}
        return .init(x:rest.x+plan.offset.x*(1-move),y:rest.y+plan.offset.y*(1-move),rotation:rotation+plan.rotation*(1-move),scale:scale,alpha:initialAlpha+(targetAlpha-initialAlpha)*fade)
    }
}
