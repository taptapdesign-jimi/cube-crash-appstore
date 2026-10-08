import SpriteKit

/// Captures the SAME native die, not an image clone. The Scene must supply its
/// logical identity/epoch guard. Source poses are Y-down; stagePoint owns mapping.
@MainActor
final class NativeWildMeterDropNodeHandoff {
    let capture:NativeWildMeterDropRuntime.Capture
    let tile:SKNode
    private let stage:SKNode,parent:SKNode
    private let position:CGPoint,xScale:CGFloat,yScale:CGFloat,rotation:CGFloat,depth:CGFloat
    private let flightX:CGFloat,flightY:CGFloat
    private let stagePoint:(NativeWildMeterDropPlan.Point)->CGPoint
    private let isCurrent:(NativeWildMeterDropRuntime.Capture,SKNode)->Bool
    private(set) var restored=false,disposed=false
    init?(tile:SKNode,stage:SKNode,capture:NativeWildMeterDropRuntime.Capture,
          sourceParentVisualScale:Double,stagePoint:@escaping(NativeWildMeterDropPlan.Point)->CGPoint,
          isCurrent:@escaping(NativeWildMeterDropRuntime.Capture,SKNode)->Bool) {
        guard let parent=tile.parent,sourceParentVisualScale.isFinite,sourceParentVisualScale>0 else{return nil}
        self.tile=tile;self.stage=stage;self.parent=parent;self.capture=capture
        position=tile.position;xScale=tile.xScale;yScale=tile.yScale;rotation=tile.zRotation;depth=tile.zPosition
        // Differentiate actual node transforms analytically. Subtracting two
        // SKNode.convert points only1px apart loses Float32 precision at a
        // large board translation and must not perturb the captured grid scale.
        var x=CGVector(dx:1,dy:0),y=CGVector(dx:0,dy:1),ancestor:SKNode?=tile
        while let current=ancestor,current !== stage {
            let cosine=cos(current.zRotation),sine=sin(current.zRotation)
            func project(_ v:CGVector)->CGVector {
                CGVector(dx:v.dx*current.xScale*cosine-v.dy*current.yScale*sine,
                         dy:v.dx*current.xScale*sine+v.dy*current.yScale*cosine)
            }
            x=project(x);y=project(y);ancestor=current.parent
        }
        guard ancestor === stage else{return nil}
        flightX=hypot(x.dx,x.dy)/CGFloat(sourceParentVisualScale)
        flightY=hypot(y.dx,y.dy)/CGFloat(sourceParentVisualScale)
        self.stagePoint=stagePoint;self.isCurrent=isCurrent
    }
    private func valid()->Bool {guard !disposed else{return false};let current=isCurrent(capture,tile);return !disposed && current}
    @discardableResult
    func apply(_ pose:NativeWildMeterDropPlan.TilePose)->Bool {
        guard valid() else{return false}
        if pose.stageParent {
            guard !restored else{return false}
            let point=stagePoint(pose.pose.point)
            guard valid() else{return false}
            if tile.parent !== stage {tile.removeFromParent();stage.addChild(tile)}
            tile.position=point
            tile.xScale=CGFloat(pose.pose.scaleX)*flightX;tile.yScale=CGFloat(pose.pose.scaleY)*flightY
            tile.zRotation = -CGFloat(pose.pose.rotation);tile.zPosition=CGFloat(NativeWildMeterDropPlan.tileDepth)
            tile.alpha=CGFloat(pose.pose.opacity);tile.isHidden = !pose.visible
        } else {
            // Restore captured native scale, never Source's literal unit scale.
            // Later paints must not rewind the native idle owner started by onLanded.
            if !restored {
                tile.removeFromParent();parent.addChild(tile);tile.position=position
                tile.xScale=xScale;tile.yScale=yScale;tile.zRotation=rotation;tile.zPosition=depth
                tile.alpha=CGFloat(pose.pose.opacity);tile.isHidden = !pose.visible
                restored=true
            }
            // Wall/input and bookkeeping callbacks cannot repaint a restored
            // die now owned by an accepted subsequent merge/idle animation.
        }
        return true
    }
    /// Retiring a generation never reparents or reveals a replacement die.
    func dispose(){guard !disposed else{return};disposed=true}
}
