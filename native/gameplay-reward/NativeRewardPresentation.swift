import UIKit

struct NativeRewardPresentation {
    static let names=["Star Is Out","Weee - Beee","Final Gate","Honey Splat","Dreamy","Shroomy","Kaboom","Break Out","Flying Tent","Winner","Fishy","Fresh Juice","Bouncy Day","Bottle Tips","Castle Ruins","Star Below","Looky Here","Playtime","The Letter","Life Saver","The Bloob","Bibi - Ribi","Woombuu","Zap - Zap","Beam Up","Bloob Spill","Team Party","Transport","Fixer Upper","Take Over"]
    static let inflateDuration=0.12,collapseDuration=0.224,unlockedEnterDuration=0.28
    static let surfaceScale=1.17,surfaceY=40.0,shadowY=48.0
    enum TapAction {case reveal,queueCollect,collect,ignore}
    static func tapAction(revealed:Bool,revealRunning:Bool,resolved:Bool,disposed:Bool)->TapAction {
        if resolved || disposed{return .ignore};if revealed && !revealRunning{return .collect};if revealRunning{return .queueCollect};return .reveal
    }
    static func name(board:Int)->String {names[min(29,max(0,board-1))]}
    static func dragTilt(start:Double,deltaX:Double,width:Double)->Double {max(-28.8,min(28.8,start+deltaX/max(1,abs(width)*0.4)*28.8))}
    static func collectDrag(deltaX:Double,deltaY:Double,cardHeight:Double)->Bool {abs(deltaY)>=min(96,max(48,abs(cardHeight)*0.12)) && abs(deltaY)>abs(deltaX)*1.15}
    struct Layout {
        let title: CGRect,subtitle:CGRect,hero:CGRect,shadow:CGRect,hand:CGRect,coach:CGRect
        let titleFont:CGFloat,subtitleFont:CGFloat
        init(width:CGFloat,height:CGFloat,bottomSafe:CGFloat,handAspect:CGFloat=1) {
            func clamp(_ value:CGFloat,_ lower:CGFloat,_ upper:CGFloat)->CGFloat {max(lower,min(upper,value))}
            titleFont=clamp(width*0.094,44,64);subtitleFont=clamp(width*0.051,23,32)
            let padding=clamp(height*0.135,84,132),titleHeight=titleFont*0.95,subtitleHeight=subtitleFont*1.2
            let textWidth=min(width*0.88,520),heroWidth=min(width*0.68,380),heroHeight=heroWidth*458/310
            title=CGRect(x:(width-textWidth)/2,y:padding-16,width:textWidth,height:titleHeight)
            subtitle=CGRect(x:(width-textWidth)/2,y:padding+titleHeight+26-16,width:textWidth,height:subtitleHeight)
            hero=CGRect(x:(width-heroWidth)/2,y:padding+titleHeight+26+subtitleHeight+clamp(height*0.125,70,116)-64,width:heroWidth,height:heroHeight)
            shadow=CGRect(x:heroWidth*0.06,y:heroHeight*0.89+36,width:heroWidth*0.88,height:heroHeight*0.16)
            let handWidth=min(width*0.36,168),handHeight=handWidth*handAspect
            hand=CGRect(x:(width-handWidth)/2,y:height*0.56-handHeight*0.28,width:handWidth,height:handHeight)
            coach=CGRect(x:16,y:height-bottomSafe-34-32,width:width-32,height:32)
        }
    }
    struct Tilt {
        let interimZ:Double,interimX:Double,interimY:Double,interimExitZ:Double,interimExitX:Double,interimExitY:Double
        let entryZ:Double,entryX:Double,entryY:Double,restZ:Double,restX:Double,restY:Double,exitZ:Double,exitX:Double,exitY:Double
        init(random:()->Double={Double.random(in:0...1)}) {
            func sample()->Double {let value=random();return value.isFinite ? min(1,max(0,value)) : 0.5}
            func round(_ value:Double)->Double {(value*100).rounded()/100}
            let direction=sample()<0.5 ? -1.0 : 1.0
            let rest=2.375+sample()*0.75,restDepth=2+sample()*1.5,interimExit=4.5+sample()*3
            let unlocked = -direction,entry=4.5+sample()*3,unlockedRest=2.375+sample()*0.75,unlockedDepth=1.5+sample()*1.5,exit=4.5+sample()*3
            interimZ=round(direction*rest);interimX=round(-1.5-sample()*1.5);interimY=round(direction*restDepth)
            interimExitZ=round(direction*interimExit);interimExitX=round(-4.5-sample()*3);interimExitY=round(direction*interimExit)
            entryZ=round(unlocked*entry);entryX=round(4.5+sample()*3);entryY=round(unlocked*entry)
            restZ=round(unlocked*unlockedRest);restX=round(1+sample());restY=round(unlocked*unlockedDepth)
            exitZ=round(unlocked*exit);exitX=round(-4.5-sample()*3);exitY=round(unlocked*exit)
        }
    }
}
