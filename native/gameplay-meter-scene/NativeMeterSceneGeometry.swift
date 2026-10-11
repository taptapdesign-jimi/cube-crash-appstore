import SpriteKit

/// Native places board scale on each full die rather than a common grid parent.
/// Capture a source-equivalent local origin at THAT actual same-node target.
/// No model-selected target, nominal board sampler or hidden artwork clone.
@MainActor enum NativeMeterSceneGeometry {
    static func plan(tile:NativeDiceNode,stage:SKNode,viewport:CGSize,arcade:Bool,random:()->Double)->NativeWildMeterDropPlan? {
        guard tile.parent != nil,tile.xScale>0,tile.yScale>0,viewport.width>0,viewport.height>0 else{return nil}
        var point=tile.position,ancestor=tile.parent
        // v9 reads getGlobalScale(parent), excluding the die's own bounce/idle.
        // Native folds that parent grid scale into the full die's outer node.
        let baseX=tile.sourceOuterDriven ? tile.sourceGeometryScale:tile.xScale
        let baseY=tile.sourceOuterDriven ? tile.sourceGeometryScale:tile.yScale
        var x=CGVector(dx:baseX,dy:0),y=CGVector(dx:0,dy:baseY)
        while let node=ancestor,node !== stage {
            let c=cos(node.zRotation),s=sin(node.zRotation)
            func vector(_ v:CGVector)->CGVector{.init(dx:v.dx*node.xScale*c-v.dy*node.yScale*s,dy:v.dx*node.xScale*s+v.dy*node.yScale*c)}
            x=vector(x);y=vector(y)
            point = .init(x:point.x*node.xScale*c-point.y*node.yScale*s+node.position.x,
                        y:point.x*node.xScale*s+point.y*node.yScale*c+node.position.y)
            ancestor=node.parent
        }
        guard ancestor === stage else{return nil}
        return .init(arcade:arcade,viewport:.init(x:Double(viewport.width),y:Double(viewport.height)),tileSize:128,target:.init(x:0,y:0),
            parentWorld:.init(a:Double(x.dx),b:-Double(x.dy),c:-Double(y.dx),d:Double(y.dy),tx:Double(point.x),ty:Double(viewport.height-point.y)),
            originalRotation:-Double(tile.zRotation),originalZIndex:Double(tile.zPosition),
            usesUniformDropScale:NativeWildMeterDropPlan.sourceUsesUniformDropScale(variant:tile.variant),random:random)
    }
}
