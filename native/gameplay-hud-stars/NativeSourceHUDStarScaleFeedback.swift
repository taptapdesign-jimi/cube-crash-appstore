import Foundation

/// Literal HUD star feedback on the existing Source clock. Source scoreRef is
/// already mutated, so animateScore(value,.18) takes its from==to branch. The
/// plain integer is painted before number bump and then original icon bounce.
@MainActor final class NativeSourceHUDStarScaleFeedback {
    nonisolated struct Scale:Equatable,Codable {var x:Double,y:Double}
    enum Target:String {case number,icon}
    typealias Cancel=()->Void
    struct Hooks {
        let current:()->Bool
        let text:()->String
        let setText:(String)->Void
        let readScale:(Target)->Scale
        let writeScale:(Target,Scale)->Void
        let killOtherScaleTweens:(Target)->Void
        let timeline:(_ label:String,_ duration:Double,_ paint:@escaping(Double)->Void,_ finished:@escaping(Bool)->Void)->Cancel?
        let wall:(_ milliseconds:Int,_ callback:@escaping()->Void)->Cancel?
    }
    private final class Root {let id=UUID();var cancel:Cancel?,initial:Scale?,second:Scale?}
    private let hooks:Hooks
    private var emptyPops:[UUID:Root]=[:]
    private var number:Root?,icon:Root?,deflate:(id:UUID,cancel:Cancel?)?
    private var burst=0,baseIcon:Scale?,disposed=false,epoch:UInt64=0
    var burstCount:Int{burst}
    var activeNumber:Bool{number != nil}
    var activeIcon:Bool{icon != nil}
    init(hooks:Hooks){self.hooks=hooks}
    private func admits(_ e:UInt64)->Bool {guard !disposed,epoch==e else{return false};let valid=hooks.current();return valid && !disposed && epoch==e}
    @discardableResult func paint(score:Int)->Bool {
        epoch &+= 1;let e=epoch;guard admits(e) else{return false}
        let text=String(min(999999,score))
        let old=hooks.text();guard admits(e) else{return false}
        if old != text {
            hooks.setText(text);guard admits(e) else{return false}
            // updateHUD creates this original .26 timeline; bump kills it in
            // the same RAF before a GSAP delivery can paint any default pop.
            kill(.number);guard admits(e) else{return false}
            // Literal killTweensOf(scale) removes both default-pop children,
            // but leaves their now-empty parent linked until the next Source
            // root pass. Retain that zero-duration root instead of deleting it
            // at construction and changing the ticker's linked-root lifetime.
            let root=Root();emptyPops[root.id]=root
            let cancel=hooks.timeline("hud-score-default-pop-collapsed",0,{_ in},{[weak self,weak root] _ in
                guard let self,let root,self.emptyPops[root.id] === root else{return}
                self.emptyPops.removeValue(forKey:root.id)
            })
            guard admits(e),emptyPops[root.id] === root else{cancel?();return false}
            guard let cancel else{emptyPops.removeValue(forKey:root.id);return false};root.cancel=cancel
        }
        guard bumpNumber(epoch:e),admits(e) else{return false}
        return bounceIcon(epoch:e)
    }
    private func kill(_ target:Target) {
        let old:Root?
        if target == .number {old=number;number=nil}else{old=icon;icon=nil}
        old?.cancel?();hooks.killOtherScaleTweens(target)
    }
    private func bumpNumber(epoch e:UInt64)->Bool {
        burst=min(burst+1,6)
        let peak=min(1.79,1.46+Double(burst-1)*0.084)
        let value=hooks.readScale(.number);guard admits(e) else{return false}
        let cur=max(value.x == 0 ? 1:value.x,value.y == 0 ? 1:value.y)
        let up=Self.round7(max(0.08,0.16-(cur-1)*0.06))
        kill(.number);guard admits(e) else{return false}
        let prior=deflate;deflate=nil;prior?.cancel?();guard admits(e) else{return false}
        let root=Root();number=root
        let secondStart=Self.round7(up-0.01),duration=Self.round7(secondStart+1.05)
        let cancel=hooks.timeline("hud-score-star-bump",duration,{[weak self,weak root] t in
            guard let self,let root,self.admits(e),self.number === root else{return}
            if root.initial == nil {let s=self.hooks.readScale(.number);guard self.admits(e),self.number === root else{return};root.initial=s}
            guard let from=root.initial else{return}
            var pose=Self.interpolate(from,.init(x:peak,y:peak),Self.backOut(min(1,max(0,t/up)),3))
            if t>=secondStart {
                if root.second == nil {root.second=pose}
                pose=Self.interpolate(root.second!,.init(x:1,y:1),Self.power2Out(min(1,max(0,(t-secondStart)/1.05))))
            }
            guard self.admits(e),self.number === root else{return};self.hooks.writeScale(.number,pose)
        },{[weak self,weak root] success in
            guard let self,let root,self.number === root else{return};self.number=nil
            if success,self.admits(e){self.burst=0}
        })
        guard admits(e),number === root else{cancel?();return false}
        guard let cancel else{number=nil;return false};root.cancel=cancel
        let id=UUID();deflate=(id,nil)
        let wall=hooks.wall(2600){[weak self] in
            guard let self,self.deflate?.id==id else{return};self.deflate=nil
            if self.admits(e){self.burst=0}
        }
        guard admits(e),deflate?.id==id else{wall?();return false}
        guard let wall else{deflate=nil;return false};deflate=(id,wall);return true
    }
    private func bounceIcon(epoch e:UInt64)->Bool {
        if baseIcon == nil {let s=hooks.readScale(.icon);guard admits(e) else{return false};baseIcon = .init(x:s.x == 0 ? 1:s.x,y:s.y == 0 ? 1:s.y)}
        guard let base=baseIcon else{return false}
        kill(.icon);guard admits(e) else{return false}
        let root=Root();icon=root
        let peak=Scale(x:base.x*1.3,y:base.y*1.3)
        let cancel=hooks.timeline("hud-score-icon-bounce",0.23,{[weak self,weak root] t in
            guard let self,let root,self.admits(e),self.icon === root else{return}
            if root.initial == nil {let s=self.hooks.readScale(.icon);guard self.admits(e),self.icon === root else{return};root.initial=s}
            guard let initial=root.initial else{return}
            var pose=Self.interpolate(initial,peak,Self.power2Out(min(1,max(0,t/0.08))))
            if t>=0.08 {
                if root.second == nil {root.second=pose}
                pose=Self.interpolate(root.second!,base,Self.backOut(min(1,max(0,(t-0.08)/0.15)),1.7))
            }
            guard self.admits(e),self.icon === root else{return};self.hooks.writeScale(.icon,pose)
        },{[weak self,weak root] _ in guard let self,let root,self.icon === root else{return};self.icon=nil})
        guard admits(e),icon === root else{cancel?();return false}
        guard let cancel else{icon=nil;return false};root.cancel=cancel;return true
    }
    static func round7(_ x:Double)->Double{(x*1e7).rounded()/1e7}
    static func round6(_ x:Double)->Double{(x*1e6).rounded()/1e6}
    static func power2Out(_ x:Double)->Double{1-pow(1-x,3)}
    static func backOut(_ x:Double,_ s:Double)->Double{let t=x-1;return 1+t*t*((s+1)*t+s)}
    static func interpolate(_ a:Scale,_ b:Scale,_ t:Double)->Scale{.init(x:round6(a.x+(b.x-a.x)*t),y:round6(a.y+(b.y-a.y)*t))}
    func dispose(){guard !disposed else{return};disposed=true;epoch &+= 1
        let n=number,i=icon,d=deflate,empties=Array(emptyPops.values);number=nil;icon=nil;deflate=nil;emptyPops.removeAll()
        n?.cancel?();i?.cancel?();d?.cancel?();for root in empties{root.cancel?()}
    }
}
