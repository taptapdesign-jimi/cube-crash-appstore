import CoreGraphics

/// Read-only placement from app-core.layoutBoard and hud-helpers.layout.
/// This does not decide moves, rewards, entry admission or navigation.
struct NativeGameplayChromePlan {
    let hudTop:CGFloat
    let valueRowY:CGFloat
    let meterRect:CGRect
    let roundCenter:CGPoint
    static let tabletTopHUDScale:CGFloat=1.4
    static func hudScale(for viewport:CGSize)->CGFloat {
        NativeTabletLayout.applies(viewport) ? tabletTopHUDScale:1
    }
    static func backpackBaseSide(for viewport:CGSize)->CGFloat {NativeTabletLayout.applies(viewport) ? 40:34}
    static func make(viewport:CGSize,safeTop:CGFloat,boardBounds:CGRect?=nil,scaleTopHUD:Bool=true)->Self {
        if NativeTabletLayout.applies(viewport) {
            // Match Journey navigation scale; retain the composition centre.
            // Spread the HUD horizontally to the complete dice-grid edges.
            // Original vertical union: row20 +/- close radius22, bar ends63.
            // The board requests scaleTopHUD:false to retain its reserved band.
            let baseScale=viewport.width/390,factor=scaleTopHUD ? tabletTopHUDScale/baseScale:1
            let scale=baseScale*factor,anchorY=safeTop+30.5*baseScale
            // Screen-space tablet spacing; keep the board's reserved band unchanged.
            let hudOffset:CGFloat=scaleTopHUD ? 12:0
            let meterGap:CGFloat=scaleTopHUD ? 8:0
            let row=anchorY+(safeTop+20*baseScale-anchorY)*factor+hudOffset
            let meterHeight=10*scale,meterTop=row+33*scale+meterGap
            let left=boardBounds?.minX ?? 40,barWidth=boardBounds?.width ?? max(120,viewport.width-80)
            return Self(hudTop:row-20,valueRowY:viewport.height-row,
                meterRect:CGRect(x:left,y:viewport.height-meterTop-meterHeight,
                    width:barWidth,height:meterHeight),
                roundCenter:CGPoint(x:viewport.width/2,y:43))
        }
        let width=viewport.width,height=viewport.height
        let mobile=width<768 || height>width
        let tablet=width>=768 && width<=1400
        var top=mobile ? max(44,safeTop)+48:20+(height*0.004).rounded()+safeTop
        if tablet {top-=56}
        if mobile && !tablet {top-=(height*0.047).rounded()}
        top-=8
        let meterTop=top+20+24+(height*0.02).rounded()-8
        return Self(hudTop:top,valueRowY:height-top-20,
            meterRect:CGRect(x:boardBounds?.minX ?? 24,y:height-meterTop-10,width:boardBounds?.width ?? max(120,width-48),height:10),
            roundCenter:CGPoint(x:width/2,y:43))
    }
    static func visibleMeterRatio(_ value:Double)->CGFloat {
        value.isFinite ? CGFloat(min(1,max(0,value))):0
    }
}
