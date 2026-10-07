import UIKit
import StackToSixGameplay

/// Analytic equivalents of the source's hidden DOM marker reads; visible pose remains immutable.
enum NativeLaserGunGeometry {
    struct Pose { var center: CGPoint; var aim: Double; var beam: Double; var barrel: CGPoint; let scale: Double; let width: Double; let offscreen: Double }
    static func rotate(_ p: CGPoint,_ degrees: Double) -> CGPoint {
        let r = degrees * .pi / 180,c = cos(r),s = sin(r)
        return CGPoint(x:Double(p.x)*c-Double(p.y)*s,y:Double(p.x)*s+Double(p.y)*c)
    }
    static func normalizedAngle(_ degrees: Double) -> Double { ((degrees+180).truncatingRemainder(dividingBy:360)+360).truncatingRemainder(dividingBy:360)-180 }
    static func marker(_ ratio: CGPoint,side: NativeLaserShooter,center: CGPoint,width: Double,scale: Double,aim: Double) -> CGPoint {
        let height = width*183/200
        var p = rotate(CGPoint(x:Double(ratio.x)*width+0.5-width/2,y:Double(ratio.y)*height+0.5-height/2),aim)
        if side == .left { p.x = -p.x; p = rotate(p,45) }
        p = rotate(p,side == .left ? 0 : -8)
        return CGPoint(x:Double(center.x)+Double(p.x)*scale,y:Double(center.y)+Double(p.y)*scale)
    }
    static func constrainedTop(_ nominal: Double,target: CGPoint,gunX: Double,minimum: Double = 150) -> Double {
        let horizontal = abs(Double(target.x)-gunX),maximumVertical = tan(55 * .pi / 180)*horizontal
        let angleTop = max(Double(target.y)-maximumVertical,min(Double(target.y)+maximumVertical,nominal))
        let required = sqrt(max(0,minimum*minimum-horizontal*horizontal))
        if abs(Double(target.y)-angleTop) >= required { return angleTop }
        let distance = min(required,maximumVertical),above = Double(target.y)-distance,below = Double(target.y)+distance
        return abs(nominal-above) <= abs(nominal-below) ? above : below
    }
    static func sidePositions(count: Int,height: Double,side: NativeLaserShooter) -> [Double] {
        let count = min(4,max(0,count)); guard count > 0 else { return [] }
        let height = max(320,height),margin = min(height*0.24,132),maxCenter = height-margin,anchor = height*(side == .left ? 0.37 : 0.63)
        if count == 1 { return [max(margin,min(maxCenter,anchor))] }
        let separation = min(200,max(0,maxCenter-margin)/Double(count-1)),span = separation*Double(count-1)
        let start = max(margin,min(maxCenter-span,anchor-span*0.5))
        return (0..<count).map{start+Double($0)*separation}
    }
    static func solve(side: NativeLaserShooter,target: CGPoint,viewport: CGSize,scale: Double,nominalY: Double) -> Pose {
        let viewportWidth = max(320,Double(viewport.width)),width = min(viewportWidth*0.70,273)
        let muzzle = NativeLaserGunRules.muzzleX(side,width:viewportWidth)
        var center = CGPoint(x:muzzle-width*max(0.1,scale)*(side == .left ? 0.30 : -0.28),y:constrainedTop(nominalY,target:target,gunX:muzzle)),aim = 0.0
        func marks() -> (CGPoint,CGPoint) { (marker(CGPoint(x:0.72,y:0.58),side:side,center:center,width:width,scale:scale,aim:aim),marker(CGPoint(x:0.24,y:0.32),side:side,center:center,width:width,scale:scale,aim:aim)) }
        func settle() {
            for _ in 0..<12 {
                let (axis,barrel) = marks(),axisAngle = atan2(Double(barrel.y-axis.y),Double(barrel.x-axis.x))*180 / .pi,targetAngle = atan2(Double(target.y-barrel.y),Double(target.x-barrel.x))*180 / .pi
                aim += (side == .left ? -1 : 1)*normalizedAngle(targetAngle-axisAngle)
                let (a,b) = marks(),dx = Double(b.x-a.x),dy = Double(b.y-a.y),length = hypot(dx,dy)
                if length <= 0.01 || abs(dx*Double(target.y-b.y)-dy*Double(target.x-b.x))/length <= 0.05 { break }
            }
        }
        settle()
        let minimumHorizontal = 150.5*cos(55 * .pi / 180)
        for _ in 0..<6 {
            settle(); let (_,barrel) = marks(),horizontal = abs(Double(target.x-barrel.x))
            if horizontal+0.02 < minimumHorizontal { center.x += (side == .left ? -1 : 1)*(minimumHorizontal-horizontal); continue }
            let delta = constrainedTop(Double(barrel.y),target:target,gunX:Double(barrel.x),minimum:150.5)-Double(barrel.y)
            if abs(delta) <= 0.02 { break }; center.y += delta
        }
        settle(); let (axis,barrel) = marks()
        let beam = atan2(Double(barrel.y-axis.y),Double(barrel.x-axis.x))*180 / .pi
        let offscreen = side == .left ? -(Double(center.x)+width*scale/2+6) : viewportWidth-Double(center.x)+width*scale/2+6
        return Pose(center:center,aim:aim,beam:beam,barrel:barrel,scale:scale,width:width,offscreen:offscreen)
    }
}
