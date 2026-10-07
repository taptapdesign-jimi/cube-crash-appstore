import Foundation

struct NativeJourneyBottomDecorAsset:Equatable {
    let key,oneX:String
    let twoX:String?
    func path(density:Double)->String {density>1 ? (twoX ?? oneX):oneX}
}

/// Mirrors the source app-lived board->Forest choice map, never native save
/// progression. Bootstrap injects one catalog into successive board owners.
@MainActor
final class NativeJourneyBottomDecorCatalog {
    static let shared=NativeJourneyBottomDecorCatalog()
    private var forestByBoard:[Int:Int]=[:]
    func asset(board:Int,random:()->Double)->NativeJourneyBottomDecorAsset {
        let number=max(1,board)
        if (11...20).contains(number) {
            let unit=number-10,root="./assets/journey assets/beach/beach hud",file:String?
            switch unit {case 3:file="beach-hud3@3x.png";case 9:file=nil;default:file="beach-hud\(unit)@2x.png"}
            return .init(key:"beach-hud\(unit)",oneX:root+"/beach-hud\(unit).png",twoX:file.map{root+"/"+$0})
        }
        if (21...30).contains(number) {
            let unit=number-20,root="./assets/journey assets/robo/robo hud"
            return .init(key:"area55-hud\(unit)",oneX:root+"/area\(unit).png",twoX:root+"/area\(unit)@2x.png")
        }
        let choice:Int
        if let existing=forestByBoard[number] {choice=existing}
        else {choice=Int(floor(random()*12))+1;forestByBoard[number]=choice}
        return .init(key:"forest-bottom\(choice)",oneX:"./assets/journey assets/bottom\(choice).png",twoX:"./assets/journey assets/bottom\(choice)@2x.png")
    }
}

struct NativeJourneyBottomDecorPlan {
    struct Pose:Equatable {let x,y,scaleX,scaleY,opacity:Double}
    static let prepared=Pose(x:0,y:84,scaleX:0.94,scaleY:0.82,opacity:0)
    static let visible=Pose(x:0,y:0,scaleX:1,scaleY:1,opacity:1)
    static let enterDuration=0.62,exitDuration=0.44
    private static func unit(_ x:Double)->Double{min(1,max(0,x))}
    private static func mix(_ a:Double,_ b:Double,_ p:Double)->Double{a+(b-a)*p}
    static func enter(seconds:Double)->Pose {
        if seconds<0.48 {
            let p=1-pow(1-unit(seconds/0.48),4)
            return .init(x:0,y:mix(84,0,p),scaleX:mix(0.94,1.018,p),scaleY:mix(0.82,0.985,p),opacity:p)
        }
        let p=1-pow(1-unit((seconds-0.48)/0.14),3)
        return .init(x:0,y:0,scaleX:mix(1.018,1,p),scaleY:mix(0.985,1,p),opacity:1)
    }
    static func exit(seconds:Double,from:Pose)->Pose {
        let p=pow(unit(seconds/0.44),3)
        return .init(x:from.x,y:mix(from.y,70,p),scaleX:mix(from.scaleX,0.96,p),scaleY:mix(from.scaleY,0.88,p),opacity:mix(from.opacity,0,p))
    }
}
