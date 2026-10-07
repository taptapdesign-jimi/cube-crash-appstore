import QuartzCore

/// Interpolate GSAP's individual spatial components before composing a pose.
/// Interpolating finished matrices loses the exit angles at zero scale and
/// follows different geometry throughout the inflate/collapse/enter tracks.
enum NativeRewardMotion {
    struct Pose: Equatable {
        var scaleX=1.0,scaleY=1.0,y=0.0,rotationZ=0.0,rotationX=0.0,rotationY=0.0,depth=0.0
        func interpolated(to end:Pose,progress:Double)->Pose {
            func mix(_ a:Double,_ b:Double)->Double {a+(b-a)*progress}
            return Pose(scaleX:mix(scaleX,end.scaleX),scaleY:mix(scaleY,end.scaleY),y:mix(y,end.y),rotationZ:mix(rotationZ,end.rotationZ),rotationX:mix(rotationX,end.rotationX),rotationY:mix(rotationY,end.rotationY),depth:mix(depth,end.depth))
        }
        var transform:CATransform3D {
            var value=CATransform3DIdentity;value.m34 = -1/1050
            value=CATransform3DTranslate(value,0,y,depth)
            // CSSPlugin canonical order: translation, Z rotation, Y, X, scale.
            value=CATransform3DRotate(value,rotationZ * .pi/180,0,0,1)
            value=CATransform3DRotate(value,rotationY * .pi/180,0,1,0)
            value=CATransform3DRotate(value,rotationX * .pi/180,1,0,0)
            return CATransform3DScale(value,scaleX,scaleY,1)
        }
        var interimIdleTransform:CATransform3D {
            var value=CATransform3DIdentity;value.m34 = -1/1050
            value=CATransform3DRotate(value,rotationX * .pi/180,1,0,0)
            value=CATransform3DRotate(value,rotationY * .pi/180,0,1,0)
            value=CATransform3DRotate(value,rotationZ * .pi/180,0,0,1)
            return CATransform3DTranslate(value,0,0,depth)
        }
    }
    static func pose(scale:Double=1,scaleX:Double?=nil,scaleY:Double?=nil,y:Double=0,z:Double=0,x:Double=0,ry:Double=0,depth:Double=0)->Pose {
        Pose(scaleX:scaleX ?? scale,scaleY:scaleY ?? scale,y:y,rotationZ:z,rotationX:x,rotationY:ry,depth:depth)
    }
    static func samples(from:Pose,to:Pose,ease:(Double)->Double,count:Int=96)->[CATransform3D] {
        (0...count).map {from.interpolated(to:to,progress:ease(Double($0)/Double(count))).transform}
    }
    static func cubic(_ time:Double,_ x1:Double,_ y1:Double,_ x2:Double,_ y2:Double)->Double {
        let time=min(1,max(0,time));var low=0.0,high=1.0
        if time==0 || time==1 {return time}
        func point(_ t:Double,_ a:Double,_ b:Double)->Double {3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t}
        for _ in 0..<24 {let middle=(low+high)/2;if point(middle,x1,x2)<time {low=middle}else{high=middle}}
        return point((low+high)/2,y1,y2)
    }
    static func cssTrack(poses:[Pose],offsets:[Double],interimOrder:Bool=false,count:Int=192)->[CATransform3D] {
        (0...count).map { index in
            let progress=cubic(Double(index)/Double(count),0.42,0,0.58,1)
            let segment=min(poses.count-2,max(0,(0..<(poses.count-1)).last(where:{offsets[$0]<=progress}) ?? 0))
            let local=(progress-offsets[segment])/(offsets[segment+1]-offsets[segment])
            let pose=poses[segment].interpolated(to:poses[segment+1],progress:local)
            return interimOrder ? pose.interimIdleTransform:pose.transform
        }
    }
}
