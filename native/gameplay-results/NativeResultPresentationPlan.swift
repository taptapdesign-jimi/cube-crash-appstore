import Foundation
import CoreGraphics

/// Read-only projection of clean-board-modal / board-fail-modal. The terminal owner
/// supplies time and persisted values; this module never commits a result or route.
enum NativeResultPresentationPlan {
    struct Pose: Equatable {
        var opacity:Double=1,scale:Double=1,y:Double=0,scaleBeforeTranslation=false
        /// CSS function order matters: Clean uses scale() translateY(), Fail
        /// and the shared GSAP CTA use translateY() scale().
        var transform:CGAffineTransform {CGAffineTransform(translationX:0,y:scaleBeforeTranslation ? y*scale:y).scaledBy(x:scale,y:scale)}
    }
    struct Layout {
        let card,hero,title,scoreLabel,score,status,primary,secondary:CGRect
        let starSize:Double
        func star(_ index:Int)->CGRect {
            let total=starSize*3+32
            return CGRect(x:hero.midX-total/2+Double(index)*(starSize+16),y:hero.minY-(index==1 ? 16:0),width:starSize,height:starSize)
        }
    }
    struct Sample {
        let hero,title,scoreLabel,score,combo,efficiency,status,primary,secondary:Pose
        let displayedScore,displayedCombo,displayedEfficiency:Int
    }
    static func layout(viewport:CGSize,clean:Bool,titleHeight:Double)->Layout {
        let w=Double(viewport.width),h=Double(viewport.height),s=min(90,max(60,w*0.2))
        let cw=min(340,w*0.88),inner=cw-64,heroW=min(280,w*0.8),buttons=min(310,w*0.8)
        let infoH=clean ? s+244+titleHeight:s+100+titleHeight
        let cardH=infoH+80,outerH=cardH+18+144,top=(h-outerH)/2
        let card=CGRect(x:(w-cw)/2,y:top,width:cw,height:cardH)
        let sy=top+40+(clean ? 16:0),ty=sy+s+(clean ? 48:64)
        let title=CGRect(x:(w-inner)/2,y:ty,width:inner,height:titleHeight)
        let label=CGRect(x:(w-inner)/2,y:title.maxY+16,width:inner,height:24)
        let score=CGRect(x:(w-inner)/2,y:label.maxY+16,width:inner,height:80)
        let status=CGRect(x:(w-inner)/2,y:clean ? score.maxY+8:title.maxY+12,width:inner,height:clean ? 52:24)
        return Layout(card:card,hero:CGRect(x:(w-heroW)/2,y:sy,width:heroW,height:s),title:title,
            scoreLabel:label,score:score,status:status,
            primary:CGRect(x:(w-buttons)/2,y:card.maxY+18,width:buttons,height:64),
            secondary:CGRect(x:(w-buttons)/2,y:card.maxY+98,width:buttons,height:64),starSize:s)
    }
    static func counterDuration(from:Int,to:Int)->Double {min(1.5,max(0.8,Double(abs(to-from))/500))}
    static func counter(from:Int,to:Int,age:Double,duration:Double?=nil)->Int {
        let p=bounded(age/(duration ?? counterDuration(from:from,to:to)))
        return Int((Double(from)+Double(to-from)*(1-pow(1-p,3))).rounded())
    }
    static func sample(seconds:Double,clean:Bool,baseScore:Int,combo:Int,efficiency:Int,arcadeReached:Bool=false)->Sample {
        let t=max(0,seconds)
        if !clean {
            return Sample(hero:enter(t,at:0.12,duration:0.55,y:-25,clean:false,startScale:0.7),title:enter(t,at:0.24,duration:0.55,y:-20,clean:false,startScale:0.75),
                scoreLabel:Pose(opacity:0),score:Pose(opacity:0),combo:Pose(opacity:0),efficiency:Pose(opacity:0),
                status:enter(t,at:0.42,duration:0.55,y:-10,clean:false,startScale:0.82),primary:cta(t,at:0.64),secondary:cta(t,at:0.82),
                displayedScore:baseScore,displayedCombo:0,displayedEfficiency:0)
        }
        var shown=counter(from:0,to:baseScore,age:t-0.47)
        if !arcadeReached,t>=2.15 {shown=counter(from:baseScore,to:baseScore+combo,age:t-2.15)}
        if !arcadeReached,t>=4.6 {shown=counter(from:baseScore+combo,to:baseScore+combo+efficiency,age:t-4.6)}
        var main=enter(t,at:0.42,duration:0.65,y:-10,clean:true)
        if !arcadeReached {main.scale *= pulse(t,at:2.15,enabled:combo>0)*pulse(t,at:4.6,enabled:efficiency>0)}
        return Sample(hero:enter(t,at:0.1,duration:0.65,y:-25,clean:true),title:enter(t,at:0.22,duration:0.65,y:-20,clean:true),
            scoreLabel:enter(t,at:0.32,duration:0.65,y:-15,clean:true),score:main,
            combo:arcadeReached ? Pose(opacity:0):bonus(t,at:1.35,hide:3.65),efficiency:arcadeReached ? Pose(opacity:0):bonus(t,at:3.97,hide:6.1),
            status:Pose(opacity:bezier(bounded((t-(arcadeReached ? 1.45:6.42))/0.4),0.25,0.1,0.25,1)),
            primary:cta(t,at:arcadeReached ? 2.05:6.62),secondary:cta(t,at:arcadeReached ? 2.40:6.97),displayedScore:shown,
            displayedCombo:combo-counter(from:0,to:combo,age:t-2.15,duration:1.4),
            displayedEfficiency:efficiency-counter(from:0,to:efficiency,age:t-4.6,duration:1.4))
    }
    static func filledStarScale(seconds:Double,index:Int)->Double {
        let age=seconds-(0.6+Double(index)*0.5)
        if age<0{return 0}
        if age<1.2 {let p=age/1.2,s=0.4/(2*Double.pi)*asin(1/1.5);return 0.88*(1+1.5*pow(2,-10*p)*sin((p-s)*2*Double.pi/0.4))}
        let p=(age-1.2).truncatingRemainder(dividingBy:2.5)/2.5
        return p<0.5 ? 0.88+0.37*bezier(p*2,0.42,0,0.58,1):1.25-0.37*bezier((p-0.5)*2,0.42,0,0.58,1)
    }
    static func emptyStarOpacity(seconds:Double,index:Int,earned:Int)->Double {
        guard index<earned else{return 1};return 1-bezier(bounded((seconds-(0.6+Double(index)*0.5))/0.2),0.25,0.1,0.25,1)
    }
    static func failedStarScale(seconds:Double,index:Int)->Double {
        let age=seconds-(0.36+Double(index)*0.095)
        if age<0{return 1}
        func out(_ p:Double,_ y:Double)->Double{bezier(bounded(p),0.34,y,0.64,1)}
        let at115=1+0.12*out(0.115/0.15,1.56)
        let at245=at115+(0.98-at115)*out(0.13/0.19,1.35)
        if age<0.115{return 1+0.12*out(age/0.15,1.56)}
        if age<0.245{return at115+(0.98-at115)*out((age-0.115)/0.19,1.35)}
        return at245+(1-at245)*out((age-0.245)/0.19,1.35)
    }
    static func bezier(_ p:Double,_ x1:Double,_ y1:Double,_ x2:Double,_ y2:Double)->Double {
        let p=bounded(p);if p==0||p==1{return p}
        func c(_ t:Double,_ a:Double,_ b:Double)->Double {3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t}
        var low=0.0,high=1.0;for _ in 0..<24 {let mid=(low+high)/2;if c(mid,x1,x2)<p{low=mid}else{high=mid}}
        return c((low+high)/2,y1,y2)
    }
    private static func bounded(_ p:Double)->Double{min(1,max(0,p))}
    private static func enter(_ t:Double,at:Double,duration:Double,y:Double,clean:Bool,startScale:Double=0)->Pose {
        let p=clean ? bezier(bounded((t-at)/duration),0.68,-0.8,0.265,1.8):bezier(bounded((t-at)/duration),0.68,-0.6,0.32,1.4)
        return Pose(opacity:bounded(p),scale:startScale+(1-startScale)*p,y:y*(1-p),scaleBeforeTranslation:clean)
    }
    private static func cta(_ t:Double,at:Double)->Pose {
        let p=bounded((t-at)/0.34)
        if p==0{return Pose(opacity:0,scale:0,y:18)}
        if p==1{return Pose()}
        let a=p-1,s=1+a*a*((1.8+1)*a+1.8)
        return Pose(opacity:bounded(s),scale:s,y:18*(1-s))
    }
    private static func bonus(_ t:Double,at:Double,hide:Double)->Pose {
        if t>=hide {let p=bezier(bounded((t-hide)/0.3),0.25,0.1,0.25,1);return Pose(opacity:1-p,scale:1-p*0.2,y:-8*p,scaleBeforeTranslation:true)}
        let p=bezier(bounded((t-at)/0.55),0.68,-0.8,0.265,1.8);return Pose(opacity:bounded(p),scale:0.65+p*0.35,y:-6*(1-p),scaleBeforeTranslation:true)
    }
    private static func pulse(_ t:Double,at:Double,enabled:Bool)->Double {
        guard enabled,t>=at else{return 1}
        let age=t-at,e: (Double)->Double={bezier(bounded($0),0.34,1.56,0.64,1)}
        if age<0.42{return 1+0.08*e(age/0.6)}
        let start=1+0.08*e(0.42/0.6);return start+(1-start)*e((age-0.42)/0.55)
    }
}
