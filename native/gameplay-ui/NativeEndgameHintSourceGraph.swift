import Foundation

/// Original endgame-hint text and default text-clouds roots. Owns presentation
/// only: callers provide an actual eligibility decision and generation fence.
@MainActor final class NativeEndgameHintSourceGraph {
    typealias Pose=NativeNoMovesPlan.Pose
    static let messages=["Stack it!","Drag it!","Move it!","Knock knock","Helloo?","You home?","Anybody?","Wazzup?","Tap tap","Do it!","Go go!","Your move","Come on","Psst!","Still there?","Wake up!","Nudge it","Send it","Boop!","One more"]
    struct Letter {let character:Character,size:Double}
    struct Cloud {
        let asset:Int,width,height,x,y,rotation,scale,delay,windDuration,drift,windY:Double
        var exitAt:Double {delay+0.06+windDuration+0.05}
    }
    struct CloudPose {var x,y,scale,alpha:Double}
    @MainActor private final class Participant:NativeSourceAnimationParticipant {
        let paint:(Double)->Void
        init(_ paint:@escaping(Double)->Void){self.paint=paint}
        func advanceSourceAnimation(seconds:Double){paint(seconds)}
    }
    @MainActor private final class Root {
        let participant:Participant,category:String
        var lease:NativeNoMovesRootLease?
        init(_ category:String,_ paint:@escaping(Double)->Void){self.category=category;participant=Participant(paint)}
    }
    enum Failure:Error {case stale,closed,invalidRandom}
    private let scheduler:any NativeNoMovesRootScheduling,current:()->Bool,random:()->Double
    private var roots:[UUID:Root]=[:],cloudBounces:[Int:NativeNoMovesRootLease]=[:]
    private var closed=false,exiting=false,entriesCompleted=0,exitsCompleted=0
    private(set) var letters:[Letter]=[],tilt=0.0,clouds:[Cloud]=[],glyphs:[Pose],cloudPoses:[CloudPose]=[]
    var onGlyph:((Int,Pose)->Void)?,onCloud:((Int,CloudPose)->Void)?,onFinished:((Bool)->Void)?
    var activeIDs:[UInt64]{roots.values.compactMap{$0.lease?.id}.sorted()}
    init(message:String,width:Double,height:Double,scheduler:any NativeNoMovesRootScheduling,
         current:@escaping()->Bool,random:@escaping()->Double)throws {
        self.scheduler=scheduler;self.current=current;self.random=random
        let characters=Array(message);glyphs=Array(repeating:Pose(),count:characters.count)
        guard !characters.isEmpty,valid() else{throw Failure.stale}
        do {
            // ensureElement first attaches clouds, then renders the message;
            // updateMessage renders it again. Both font/tilt groups consume RNG.
            let w=max(320,width),h=max(520,height),base=min(240,max(104,w*0.22)),step=max(18,base*0.18)
            for i in 0..<5 {
                let boost=0.95+(try draw())*0.4,size=((base+Double(i%3)*step)*boost).rounded(),height=(size/1.15).rounded()
                let scale=(0.9+Double(i%3)*0.08)*min(1.1,0.98+boost*0.1),delay=Double(i)*0.06
                let factor=1+((try draw())*2-1)*0.18,dy=((try draw())*2-1)*10,duration=1.032*factor,distance=w*0.32+(try draw())*(w*0.3)
                let x=(w*0.5+((try draw())*2-1)*min(26,w*0.04)).rounded(),y=(h*0.5+((try draw())*2-1)*min(90,h*0.15)).rounded()
                clouds.append(.init(asset:i%4,width:size,height:height,x:x,y:y,rotation:Double(i%5-2)*5,
                    scale:scale,delay:delay,windDuration:duration,drift:distance*(i%2==0 ? -1:1),windY:dy))
                cloudPoses.append(.init(x:x,y:y,scale:0.12,alpha:0))
                let speed=0.4+Double(i%4)*0.08,amount=5+Double(i%3)*2
                var bounceBase:Double?
                cloudBounces[i]=try root("cloudBounce",family:.timeline,duration:speed*2,delay:delay+0.5) { [weak self] t in
                    guard let self,self.valid() else{return}
                    if bounceBase==nil {bounceBase=self.cloudPoses[i].y}
                    let phase=Self.r7(t).truncatingRemainder(dividingBy:speed),half=speed/2
                    let offset=phase<half ? amount*sin(min(1,phase/half) * .pi/2):amount*cos(min(1,(phase-half)/half) * .pi/2)
                    self.cloudPoses[i].y=Self.r6((bounceBase ?? y)+offset);self.onCloud?(i,self.cloudPoses[i])
                }
                var previous = -Double.infinity
                _=try root("cloudEnter",family:.timeline,duration:max(0.48,0.06+Self.r7(duration)),delay:delay) { [weak self] t in
                    guard let self,self.valid() else{return};let c=self.clouds[i]
                    func sine(_ p:Double)->Double{(1-cos(min(1,max(0,p)) * .pi))/2}
                    var pose=self.cloudPoses[i]
                    if t<=0.34 || previous<0.34 {let p=NativeNoMovesPlan.backOut(t/0.34,2.2);pose.scale=Self.r6(0.12+(c.scale*1.22-0.12)*p);pose.alpha=Self.r6(0.8*p)}
                    if t>=0.34,(t<=0.48 || previous<0.48) {let p=NativeNoMovesPlan.powerOut((t-0.34)/0.14);pose.scale=Self.r6(Self.r6(c.scale*1.22)+(c.scale-Self.r6(c.scale*1.22))*p);pose.alpha=0.8}
                    if t>=0.06 {pose.x=c.x+Self.r6(c.drift*sine((t-0.06)/Self.r7(duration)))}
                    let yEnd=0.06+Self.r7(duration*0.55)
                    if t>=0.06,(t<=yEnd || previous<yEnd){pose.y=c.y+Self.r6(c.windY*sine((t-0.06)/Self.r7(duration*0.55)))}
                    previous=t;self.cloudPoses[i]=pose;self.onCloud?(i,pose)
                }
                _=try root("cloudDelay",family:.eagerTween,duration:0,delay:clouds[i].exitAt,paint:{_ in},completed:{[weak self] success in if success{self?.exitCloud(i)}})
            }
            _=try fontGroup(characters)
            let rendered=try fontGroup(characters);letters=rendered.0;tilt=rendered.1
            for i in characters.indices {
                _=try root("entry",family:.timeline,duration:0.54,delay:0.3+Double(i)*0.05,paint:{[weak self] t in
                    guard let self,self.valid(),!self.exiting else{return}
                    let letter=NativeNoMovesPlan.Letter(character:characters[i],size:1,inkAlpha:1,bounce:1)
                    self.publish(i,letter.enter(at:t+0.2,index:0))
                },completed:{[weak self] success in
                    guard let self,success,self.valid(),!self.exiting else{return};self.entriesCompleted+=1
                    if self.entriesCompleted==characters.count {self.beginBounces()}
                })
            }
        } catch {dispose();throw error}
    }
    private func fontGroup(_ characters:[Character])throws->([Letter],Double) {
        let count=characters.count,base=count>=11 ? 58.0:count>=9 ? 64:count>=7 ? 72:80
        var result:[Letter]=[]
        for (i,c) in characters.enumerated(){let size=base*(i%2==0 ? 1.04:0.96)*(0.94+(try draw())*0.12);result.append(.init(character:c,size:c==" " ? 64:(size*10).rounded()/10))}
        return (result,((try draw())-0.5)*30)
    }
    private func draw()throws->Double {
        guard valid() else{throw Failure.closed};let value=random()
        guard valid(),value.isFinite,value>=0,value<1 else{throw Failure.invalidRandom};return value
    }
    private func valid()->Bool {guard !closed else{return false};let admitted=current();if !admitted && !closed {dispose()};return admitted && !closed}
    @discardableResult private func root(_ category:String,family:NativeSourceAnimationRuntime.RootFamily,duration:Double,delay:Double=0,
        paint:@escaping(Double)->Void,completed:@escaping(Bool)->Void={_ in})throws->NativeNoMovesRootLease {
        guard valid() else{throw Failure.closed};let id=UUID(),record=Root(category,paint);roots[id]=record
        guard let lease=scheduler.register(record.participant,family:family,duration:duration,delay:delay,paused:false,cleanup:{[weak self,weak record] success in
            if let self,let record,self.roots[id] === record {self.roots.removeValue(forKey:id)};completed(success)
        }) else{roots.removeValue(forKey:id);throw Failure.closed}
        guard valid(),roots[id] === record else{lease.cancel();throw Failure.closed};record.lease=lease;return lease
    }
    private func beginBounces() {
        do {for i in letters.indices {
            let amplitude=1.16+(try draw())*0.06,duration=Self.r7(0.54+(try draw())*0.42),delay=(try draw())*0.25+Double(i)*0.03
            _=try root("bounce",family:.defaultLazyTween,duration:1e10,delay:delay) { [weak self] t in
                guard let self,self.valid(),!self.exiting else{return}
                let phase=Self.r7(t).truncatingRemainder(dividingBy:duration*2)/duration,p=phase<=1 ? phase:2-phase
                var pose=self.glyphs[i];pose.scale=1+(amplitude-1)*(1-cos(p * .pi))/2;self.publish(i,pose)
            }
        }} catch {dispose()}
    }
    private func exitCloud(_ i:Int) {
        guard valid() else{return};cloudBounces.removeValue(forKey:i)?.cancel()
        let from=cloudPoses[i],c=clouds[i],alpha=min(0.88,from.alpha==0 ? 0.8:from.alpha)
        do {_=try root("cloudExit",family:.timeline,duration:0.48) { [weak self] t in
            guard let self,self.valid() else{return};var pose=from
            if t<0.14 {let p=NativeNoMovesPlan.backOut(t/0.14,2);pose.scale=from.scale+(c.scale*1.14-from.scale)*p;pose.alpha=from.alpha+(alpha-from.alpha)*p}
            else {let p=NativeNoMovesPlan.backIn((t-0.14)/0.34,1.55);pose.scale=Self.r6(c.scale*1.14)*(1-p);pose.alpha=alpha*(1-p)}
            pose.scale=Self.r6(pose.scale);pose.alpha=Self.r6(pose.alpha);self.cloudPoses[i]=pose;self.onCloud?(i,pose)
        }} catch {dispose()}
    }
    func beginExit() {
        guard valid(),!exiting else{return};exiting=true
        for record in Array(roots.values) where ["entry","bounce"].contains(record.category){record.lease?.cancel()}
        do {for i in letters.indices {
            let from=glyphs[i],rotation=12+(try draw())*8
            _=try root("exit",family:.timeline,duration:0.12,delay:Double(i)*0.012,paint:{[weak self] t in
                guard let self,self.valid() else{return};var pose=from
                if t<0.038 {let p=NativeNoMovesPlan.powerOut(t/0.038);pose.scale=from.scale+(1.1-from.scale)*p;pose.z=from.z+(30-from.z)*p}
                else {let p=pow(min(1,max(0,(t-0.038)/0.082)),3);pose.scale=1.1*(1-p);pose.alpha=from.alpha*(1-p);pose.rx=from.rx+(45-from.rx)*p;pose.ry=from.ry+(30-from.ry)*p;pose.rz=rotation*p;pose.z=30-130*p}
                self.publish(i,pose)
            },completed:{[weak self] success in
                guard let self,success,self.valid() else{return};self.exitsCompleted+=1
                if self.exitsCompleted==self.letters.count {let callback=self.onFinished;self.onFinished=nil;callback?(true)}
            })
        }} catch {dispose()}
    }
    private func publish(_ i:Int,_ value:Pose){guard valid() else{return};var p=value;p.scale=Self.r6(p.scale);p.alpha=Self.r6(p.alpha);p.rx=Self.r6(p.rx);p.ry=Self.r6(p.ry);p.rz=Self.r6(p.rz);p.z=Self.r6(p.z);glyphs[i]=p;onGlyph?(i,p)}
    func dispose(){guard !closed else{return};closed=true;onFinished=nil;let records=Array(roots.values);roots.removeAll();cloudBounces.removeAll();records.forEach{$0.lease?.cancel()};onGlyph=nil;onCloud=nil}
    isolated deinit{dispose()}
    private static func r6(_ value:Double)->Double{(value*1e6).rounded()/1e6}
    private static func r7(_ value:Double)->Double{(value*1e7).rounded()/1e7}
}
