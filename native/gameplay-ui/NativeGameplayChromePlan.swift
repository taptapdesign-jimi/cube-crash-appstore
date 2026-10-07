import CoreGraphics

/// Read-only placement from app-core.layoutBoard and hud-helpers.layout.
/// This does not decide moves, rewards, entry admission or navigation.
struct NativeGameplayChromePlan {
    let hudTop:CGFloat
    let valueRowY:CGFloat
    let meterRect:CGRect
    let roundCenter:CGPoint
    static func make(viewport:CGSize,safeTop:CGFloat)->Self {
        let width=viewport.width,height=viewport.height
        let mobile=width<768 || height>width
        let tablet=width>=768 && width<=1400
        var top=mobile ? max(44,safeTop)+48:20+(height*0.004).rounded()+safeTop
        if tablet {top-=56}
        if mobile && !tablet {top-=(height*0.047).rounded()}
        top-=8
        let meterTop=top+20+24+(height*0.02).rounded()-8
        return Self(hudTop:top,valueRowY:height-top-20,
            meterRect:CGRect(x:24,y:height-meterTop-10,width:max(120,width-48),height:10),
            roundCenter:CGPoint(x:width/2,y:43))
    }
    static func visibleMeterRatio(_ value:Double)->CGFloat {
        value.isFinite ? CGFloat(min(1,max(0,value))):0
    }
}
