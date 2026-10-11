import UIKit

/// One generation-fenced idle/visible/repeat owner. Timer delivery borrows the
/// existing app-timeout owner; glyph/cloud roots borrow the existing APP clock.
/// Neither UI, locks, score nor persistence is authored by this presentation.
@MainActor final class NativeEndgameHintCoordinator {
    private weak var host:UIView?
    private let root:URL,service:NativeSourceAnimationClockService,current:(UInt64)->Bool,random:()->Double
    private let preparedCloudImages:()->[UIImage]?
    private let timeouts=NativeSourceAppTimeoutOwner()
    private var images:[UIImage]=[],font:UIFont?
    private var preparationStarted=false
    private var idle:NativeSourceAppTimeoutOwner.Receipt?,visibleTimer:NativeSourceAppTimeoutOwner.Receipt?,repeatTimer:NativeSourceAppTimeoutOwner.Receipt?
    private(set) var generation:UInt64=0,lastMessageIndex = -1,eligible=false,visible=false,disposed=false
    private var epoch:UInt64=0,preparationEpoch:UInt64=0
    private(set) var presentation:NativeEndgameHintSourcePresentation?
    private(set) var preparationCount=0
    var pendingTimers:Int{timeouts.pendingCount}
    init(host:UIView,root:URL,service:NativeSourceAnimationClockService,current:@escaping(UInt64)->Bool,
         random:@escaping()->Double={Double.random(in:0..<1)},preparedCloudImages:@escaping()->[UIImage]?={nil}) {
        self.host=host;self.root=root;self.service=service;self.current=current;self.random=random;self.preparedCloudImages=preparedCloudImages
    }
    private func prepare() {
        guard !preparationStarted,!disposed else{return};preparationStarted=true
        preparationCount+=1;preparationEpoch &+= 1;let expected=preparationEpoch,root=self.root
        if let borrowed=preparedCloudImages(),borrowed.count==4 {
            let font=JimiV9Artwork(resourceRoot:root).font(size:80,weight:"ExtraBold")
            guard !disposed,preparationEpoch==expected,font.fontName=="Baloo2-ExtraBold" else{return}
            images=borrowed;self.font=font;return
        }
        Task { @MainActor [weak self] in
            let bytes=await Task.detached(priority:.userInitiated){NativeSourceNoMovesUIKitCoordinator.paths.map{try? Data(contentsOf:root.appendingPathComponent($0))}}.value
            guard let self,!self.disposed,self.preparationEpoch==expected else{return}
            let loaded=bytes.compactMap{$0.flatMap{UIImage(data:$0)}?.preparingForDisplay()}
            let font=JimiV9Artwork(resourceRoot:root).font(size:80,weight:"ExtraBold")
            guard loaded.count==4,font.fontName=="Baloo2-ExtraBold" else{return}
            self.images=loaded;self.font=font
        }
    }
    private func admitted(_ expected:UInt64,_ token:UInt64)->Bool {
        guard !disposed,generation==expected,epoch==token else{return false};let value=current(expected)
        return value && !disposed && generation==expected && epoch==token
    }
    func update(eligible requested:Bool,generation:UInt64) {
        guard !disposed else{return}
        if self.generation != generation {reset();self.generation=generation}
        let allowed=requested && admitted(generation,epoch);eligible=allowed
        if !allowed {clearTimers();if admitted(generation,epoch){hide(repeatAfter:false)}else{forceClear()};return}
        prepare()
        if !visible,idle==nil,repeatTimer==nil {scheduleIdle()}
    }
    private func scheduleIdle() {
        let expected=generation,token=epoch
        idle=timeouts.schedule(sourceID:"endgame-hint.idle",generation:expected,delayMilliseconds:20000) { [weak self] in
            guard let self else{return};self.idle=nil
            guard self.admitted(expected,token),self.eligible else{return};self.show()
        }
    }
    private func show() {
        let expected=generation,token=epoch
        guard eligible,admitted(expected,token),let host,let font,images.count==4 else{return}
        let draw=random()
        guard admitted(expected,token),draw.isFinite,draw>=0,draw<1 else{return}
        var index=Int(draw*Double(NativeEndgameHintSourceGraph.messages.count))
        if index==lastMessageIndex {index=(index+1)%NativeEndgameHintSourceGraph.messages.count}
        do {
            let node=try NativeEndgameHintSourcePresentation(message:NativeEndgameHintSourceGraph.messages[index],font:font,
                images:images,viewport:host.bounds.size,service:service,current:{[weak self] in self?.admitted(expected,token)==true},random:random)
            guard admitted(expected,token),eligible else{node.dispose();return}
            presentation?.dispose();presentation=node;lastMessageIndex=index;visible=true;host.addSubview(node)
            node.onFinished={ [weak self,weak node] in
                guard let self,let node,self.presentation === node else{return}
                self.presentation=nil;node.dispose()
            }
            visibleTimer=timeouts.schedule(sourceID:"endgame-hint.visible",generation:expected,delayMilliseconds:3000) { [weak self] in
                guard let self else{return};self.visibleTimer=nil
                guard self.admitted(expected,token) else{return};self.hide(repeatAfter:true)
            }
        } catch {forceClear()}
    }
    private func hide(repeatAfter:Bool) {
        if let receipt=visibleTimer {_=timeouts.cancel(receipt)};visibleTimer=nil;visible=false
        if repeatAfter,eligible,idle==nil,repeatTimer==nil {
            let expected=generation,token=epoch
            repeatTimer=timeouts.schedule(sourceID:"endgame-hint.repeat",generation:expected,delayMilliseconds:5000) { [weak self] in
                guard let self else{return};self.repeatTimer=nil
                guard self.admitted(expected,token),self.eligible,!self.visible,self.idle==nil else{return};self.show()
            }
        }
        presentation?.beginExit()
    }
    func interact(){guard !disposed else{return};clearTimers();hide(repeatAfter:false)}
    func forceClear(){clearTimers();visible=false;let node=presentation;presentation=nil;node?.dispose()}
    func reset(){guard !disposed else{return};epoch &+= 1;eligible=false;lastMessageIndex = -1;forceClear()}
    private func clearTimers(){timeouts.cancelAll();idle=nil;visibleTimer=nil;repeatTimer=nil}
    isolated deinit{dispose()}
    func dispose(){guard !disposed else{return};reset();disposed=true;preparationEpoch &+= 1;images=[];font=nil;host=nil}
}
