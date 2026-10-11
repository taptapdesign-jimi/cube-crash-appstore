import Foundation
import CoreGraphics

/// Literal first-play-tutorial.ts step-three ordering and finite cycle recipe.
/// Input is the Scene's genuine object roster/rects; Math is the APP supplier.
struct NativeSourceTutorialFreePlayPlan {
    struct Candidate {let id:String,column:Int,row:Int,rect:CGRect}
    struct Move:Equatable {let from:CGRect,to:CGRect}
    struct Pose:Equatable {let position:CGPoint,alpha:Double,scale:Double,rotation:Double}
    let moves:[Move]
    var duration:Double{Double(moves.count-1)*1.08+1}
    var cycle:Double{duration+0.16}
    static func make(candidates:[Candidate],columns:Int,rows:Int,random:()->Double,cellRect:(Int,Int)->CGRect?,current:()->Bool)->Self? {
        guard current(),columns>0,rows>0 else{return nil}
        func shuffle<T>(_ source:[T])->[T]? {
            var result=source
            if result.count>1 {for i in stride(from:result.count-1,through:1,by:-1){guard current() else{return nil};let draw=random();guard current(),draw.isFinite,draw>=0,draw<1 else{return nil};let j=Int(floor(draw*Double(i+1)));result.swapAt(i,j)}}
            return result
        }
        var groups:[String:[Move]]=["right":[],"left":[],"down":[],"up":[]]
        for from in candidates {for to in candidates where from.id != to.id {
            let dx=to.column-from.column,dy=to.row-from.row
            guard dx != 0 || dy != 0 else{continue}
            let direction=abs(dx)>=abs(dy) ? (dx>0 ? "right":"left"):(dy>0 ? "down":"up")
            groups[direction,default:[]].append(Move(from:from.rect,to:to.rect))
        }}
        guard let directions=shuffle(["right","down","left","up"]) else{return nil}
        var moves:[Move]=[]
        for direction in directions {guard let options=shuffle(groups[direction] ?? []) else{return nil};if let first=options.first{moves.append(first)}}
        if moves.count>=2 {guard let selected=shuffle(moves),current() else{return nil};return Self(moves:Array(selected.prefix(4)))}
        let maxRow=min(rows-1,4),middle=columns/2
        let cells=[(max(0,middle-1),1),(min(columns-1,middle+1),1),(min(columns-1,middle+1),3),(max(0,middle-1),3),(max(0,middle),4)]
        var rects:[CGRect]=[]
        for (column,row) in cells {guard current() else{return nil};if let rect=cellRect(column,min(maxRow,row)){rects.append(rect)}}
        guard rects.count>=2 else{return Self(moves:[])}
        let third=rects.count>2 ? rects[2]:rects[0],fourth=rects.count>3 ? rects[3]:rects[0]
        guard let selected=shuffle([Move(from:rects[0],to:rects[1]),Move(from:rects[1],to:third),Move(from:fourth,to:rects.count>2 ? rects[2]:rects[1])]),current() else{return nil}
        return Self(moves:selected)
    }
    func pose(seconds:Double,fingertip:CGPoint)->Pose? {
        guard (1...4).contains(moves.count),seconds.isFinite,seconds>=0 else{return nil}
        let remainder=seconds.truncatingRemainder(dividingBy:cycle)
        let local=seconds>0 && remainder==0 ? cycle:remainder
        let index=min(moves.count-1,Int(local/1.08)),time=local-Double(index)*1.08,move=moves[index]
        let start=CGPoint(x:move.from.midX+16-fingertip.x,y:move.from.midY-fingertip.y)
        let dx=move.to.midX-move.from.midX,dy=move.to.midY-move.from.midY
        let t=max(0,min(1,(time-0.16)/0.58)),drag=t<0.5 ? 2*t*t:1-pow(-2*t+2,2)/2
        let rotation = -8+((dx>=0 ? -1.0:-12.0)+8)*drag
        let alpha:Double,scale:Double
        if time<0.16 {let t=max(0,min(1,time/0.16))-1,ease=1+2.8*t*t*t+1.8*t*t;alpha=ease;scale=0.9+0.1*ease}
        else if time<0.84 {alpha=1;scale=1-0.06*drag}
        else {let fade=1-cos(max(0,min(1,(time-0.84)/0.16))*Double.pi/2);alpha=1-fade;scale=0.94-0.08*fade}
        return Pose(position:CGPoint(x:start.x+dx*drag,y:start.y+dy*drag),alpha:alpha,scale:scale,rotation:rotation)
    }
}

/// One finite original step-four shell timeline. The caller reselects a live
/// target after the separate wall180 gap; this is not a repeating third hint.
struct NativeSourceTutorialFourthPointerPlan {
    let from:CGRect,to:CGRect
    static let duration=1.02
    func pose(seconds:Double,fingertip:CGPoint)->NativeSourceTutorialFreePlayPlan.Pose? {
        guard seconds.isFinite,seconds>=0 else{return nil}
        let time=min(Self.duration,seconds),dx=to.midX-from.midX,dy=to.midY-from.midY
        let start=CGPoint(x:from.midX+16-fingertip.x,y:from.midY-fingertip.y)
        let t=max(0,min(1,(time-0.16)/0.62)),drag=t<0.5 ? 2*t*t:1-pow(-2*t+2,2)/2
        let rotation = -8+((dx>=0 ? -1.0:-12.0)+8)*drag
        let alpha:Double,scale:Double
        if time<0.16 {let t=max(0,min(1,time/0.16))-1,ease=1+2.8*t*t*t+1.8*t*t;alpha=ease;scale=0.9+0.1*ease}
        else if time<0.86 {alpha=1;scale=1-0.06*drag}
        else {let fade=1-cos(max(0,min(1,(time-0.86)/0.16))*Double.pi/2);alpha=1-fade;scale=0.94-0.08*fade}
        return .init(position:CGPoint(x:start.x+dx*drag,y:start.y+dy*drag),alpha:alpha,scale:scale,rotation:rotation)
    }
}
