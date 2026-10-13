import UIKit
import Darwin
import SpriteKit

/// Explicit Native-only capture; no renderer, web, save, audio or haptic owner.
@MainActor final class NativeDiagnosticsCapture {
    struct BatteryMonitor {let isEnabled:()->Bool;let setEnabled:(Bool)->Void}
    struct ProcessCPUReading {
        let uptimeSeconds:Double,userSeconds:Double,systemSeconds:Double
        static func current()->Self? {
            var usage=rusage()
            guard getrusage(RUSAGE_SELF,&usage)==0 else{return nil}
            func seconds(_ value:timeval)->Double {Double(value.tv_sec)+Double(value.tv_usec)/1_000_000}
            return .init(uptimeSeconds:ProcessInfo.processInfo.systemUptime,
                         userSeconds:seconds(usage.ru_utime),systemSeconds:seconds(usage.ru_stime))
        }
    }
    static func admitted(arguments:[String],bundleIdentifier:String?,preferenceEnabled:Bool=false)->Bool {
        bundleIdentifier=="com.taptapdesign.stacktosix.native" &&
        (preferenceEnabled || arguments.contains(where:{["--cc-performance-diagnostics","--cc-native-thermal-telemetry"].contains($0)}))
    }
    private let directory:URL,center:NotificationCenter,timeouts:NativeSourceAppTimeoutOwner
    private let limit:Int,interval:Int,snapshot:()->[String:Any],output:(String)->Void
    private let batteryMonitor:BatteryMonitor
    private let processCPUReading:()->ProcessCPUReading?
    private let diagnosticMillisecondsNow:()->Double
    private var previousSampleMilliseconds=0.0
    private var previousCPUReading:ProcessCPUReading?
    private var observers:[NSObjectProtocol]=[],pending:NativeSourceAppTimeoutOwner.Receipt?
    private var file:FileHandle?,foreground=false,epoch:UInt64=0,closed=false
    private var previousBatteryMonitoring:Bool?
    private(set) var fileURL:URL?,sampleCount=0,active=false
    var pendingCount:Int {pending == nil ? 0:1}
    var observerCount:Int {observers.count}
    init(directory:URL,center:NotificationCenter = .default,timeouts:NativeSourceAppTimeoutOwner? = nil,
         sampleLimit:Int=720,intervalMilliseconds:Int=5000,batteryMonitor:BatteryMonitor?=nil,
         processCPUReading:@escaping()->ProcessCPUReading?={ProcessCPUReading.current()},
         diagnosticMillisecondsNow:@escaping()->Double={ProcessInfo.processInfo.systemUptime*1000},
         snapshot:@escaping()->[String:Any],output:@escaping(String)->Void={print($0)}) {
        self.directory=directory;self.center=center;self.timeouts=timeouts ?? NativeSourceAppTimeoutOwner()
        self.batteryMonitor=batteryMonitor ?? .init(isEnabled:{UIDevice.current.isBatteryMonitoringEnabled},setEnabled:{UIDevice.current.isBatteryMonitoringEnabled=$0})
        self.processCPUReading=processCPUReading
        self.diagnosticMillisecondsNow=diagnosticMillisecondsNow
        limit=max(1,min(720,sampleLimit));interval=max(1,intervalMilliseconds)
        self.snapshot=snapshot;self.output=output
    }
    func start(foreground:Bool) {
        guard !closed,!active else{return}
        do {
            try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
            let sessions=try FileManager.default.contentsOfDirectory(at:directory,includingPropertiesForKeys:nil).filter{$0.lastPathComponent.hasPrefix("native-thermal-") && $0.pathExtension=="jsonl"}
            guard sessions.count<8 else {throw NSError(domain:"NativeDiagnostics",code:8,userInfo:[NSLocalizedDescriptionKey:"Capture session limit reached; existing evidence retained"])}
            let url=directory.appendingPathComponent("native-thermal-\(UUID().uuidString).jsonl")
            guard FileManager.default.createFile(atPath:url.path,contents:nil) else {throw CocoaError(.fileWriteUnknown)}
            file=try FileHandle(forWritingTo:url);fileURL=url
        } catch {
            try? file?.close();file=nil;fileURL=nil
            output("[CC_NATIVE_THERMAL_FILE] unavailable \(error.localizedDescription); bounded console capture continues")
            guard !closed else{return}
        }
        active=true;self.foreground=foreground;epoch &+= 1
        let captured=epoch,previous=batteryMonitor.isEnabled()
        guard active,!closed,epoch==captured else{return}
        previousBatteryMonitoring=previous
        if !previous {
            batteryMonitor.setEnabled(true)
            guard active,!closed,epoch==captured else{return}
        }
        watch(UIApplication.didBecomeActiveNotification){$0.setForeground(true,reason:"app-active")}
        watch(UIApplication.willResignActiveNotification){$0.setForeground(false,reason:"app-inactive")}
        watch(UIApplication.didEnterBackgroundNotification){$0.setForeground(false,reason:"app-background")}
        watch(ProcessInfo.thermalStateDidChangeNotification){$0.sample(reason:"thermal-state-change")}
        watch(UIApplication.didReceiveMemoryWarningNotification){$0.sample(reason:"memory-warning")}
        if let fileURL {output("[CC_NATIVE_THERMAL_FILE] \(fileURL.lastPathComponent)")}
        sample(reason:"telemetry-start");schedule()
    }
    private func watch(_ name:Notification.Name,action:@escaping @MainActor @Sendable (NativeDiagnosticsCapture)->Void) {
        observers.append(center.addObserver(forName:name,object:nil,queue:.main){[weak self] _ in
            MainActor.assumeIsolated {guard let self,self.active,!self.closed else{return};action(self)}
        })
    }
    private func setForeground(_ value:Bool,reason:String) {
        guard active,!closed else{return}
        foreground=value;epoch &+= 1;cancelPending()
        // Lifecycle samples start a fresh interval: background CPU must not be
        // attributed to the visible route after resuming.
        previousCPUReading=nil
        sample(reason:reason);schedule()
    }
    private func schedule() {
        guard active,!closed,foreground,pending==nil,sampleCount<limit else{return}
        let captured=epoch
        pending=timeouts.schedule(sourceID:"native-diagnostics",generation:captured,delayMilliseconds:interval){[weak self] in
            guard let self,self.active,!self.closed,self.epoch==captured else{return}
            self.pending=nil;self.sample(reason:"interval");self.schedule()
        }
    }
    private func sample(reason:String) {
        guard active,!closed,sampleCount<limit else{return}
        let captured=epoch
        let sampleStart=diagnosticMillisecondsNow()
        defer {previousSampleMilliseconds=max(0,diagnosticMillisecondsNow()-sampleStart)}
        var payload=snapshot()
        payload["diagnosticSnapshotMilliseconds"]=max(0,diagnosticMillisecondsNow()-sampleStart)
        payload["diagnosticPreviousSampleMilliseconds"]=previousSampleMilliseconds
        guard active,!closed,epoch==captured else{return}
        let cpu=processCPUReading()
        guard active,!closed,epoch==captured else{return}
        if let cpu,cpu.uptimeSeconds.isFinite,cpu.userSeconds.isFinite,cpu.systemSeconds.isFinite,
           cpu.uptimeSeconds>=0,cpu.userSeconds>=0,cpu.systemSeconds>=0 {
            payload["processCPUUserMilliseconds"]=cpu.userSeconds*1000
            payload["processCPUSystemMilliseconds"]=cpu.systemSeconds*1000
            if foreground,let previous=previousCPUReading {
                let elapsed=cpu.uptimeSeconds-previous.uptimeSeconds
                let user=cpu.userSeconds-previous.userSeconds,system=cpu.systemSeconds-previous.systemSeconds
                if elapsed>0,user>=0,system>=0 {
                    payload["processCPUIntervalMilliseconds"]=elapsed*1000
                    payload["processCPUConsumedMilliseconds"]=(user+system)*1000
                    // 100% means one CPU core; multi-threaded work can exceed it.
                    payload["processCPUPercentOfOneCore"]=(user+system)/elapsed*100
                }
            }
            previousCPUReading=foreground ? cpu:nil
        } else {previousCPUReading=nil}
        payload["reason"]=reason;payload["sequence"]=sampleCount+1
        payload["wall"]=Int(floor(Date().timeIntervalSince1970*1000))
        payload["webRuntime"]="absent";payload["schema"]="native-diagnostics-v1"
        payload["persistenceAvailable"]=file != nil
        if let footprint=Self.memoryFootprintBytes() {payload["processPhysicalFootprintBytes"]=footprint}
        do {
            var data=try JSONSerialization.data(withJSONObject:payload,options:[.sortedKeys])
            guard data.count<=4096 else {throw CocoaError(.fileWriteUnknown)}
            if let file {
                do {try file.write(contentsOf:data+Data([10]))}
                catch {
                    try? file.close();self.file=nil
                    output("[CC_NATIVE_THERMAL_FILE] unavailable \(error.localizedDescription); bounded console capture continues")
                    guard active,!closed,epoch==captured else{return}
                    payload["persistenceAvailable"]=false
                    data=try JSONSerialization.data(withJSONObject:payload,options:[.sortedKeys])
                    guard data.count<=4096 else {throw CocoaError(.fileWriteUnknown)}
                }
            }
            guard let json=String(data:data,encoding:.utf8) else {throw CocoaError(.fileWriteUnknown)}
            sampleCount+=1
            output("[CC_NATIVE_THERMAL] \(json)")
            if sampleCount>=limit {dispose()}
        } catch {dispose();output("[CC_NATIVE_THERMAL_FILE] unavailable \(error.localizedDescription)")}
    }
    static func memoryFootprintBytes()->UInt64? {
        var info=task_vm_info_data_t()
        var count=mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size/MemoryLayout<integer_t>.size)
        let result=withUnsafeMutablePointer(to:&info){pointer in
            pointer.withMemoryRebound(to:integer_t.self,capacity:Int(count)) {
                task_info(mach_task_self_,task_flavor_t(TASK_VM_INFO),$0,&count)
            }
        }
        return result==KERN_SUCCESS ? info.phys_footprint:nil
    }
    private func cancelPending(){if let pending{self.pending=nil;_ = timeouts.cancel(pending)}}
    func dispose() {
        guard !closed else{return};closed=true;active=false;foreground=false;epoch &+= 1
        cancelPending();observers.forEach{center.removeObserver($0)};observers.removeAll()
        previousCPUReading=nil
        try? file?.close();file=nil
        if previousBatteryMonitoring==false,batteryMonitor.isEnabled() {batteryMonitor.setEnabled(false)}
        previousBatteryMonitoring=nil
    }
    isolated deinit {dispose()}
}

/// Bounded, read-only census at the existing opt-in diagnostic sample boundary.
/// Texture identities and logical area are NOT GPU residency or presented FPS.
/// This owner retains no scene/view/texture and performs no resource preparation.
@MainActor enum NativeDiagnosticsRenderCensus {
    static func capture(root:UIView?,visitLimit:Int=4096)->[String:Any] {
        let limit=max(1,min(4096,visitLimit))
        var views:[UIView]=root.map{[$0]} ?? [],viewCount=0,skViews=0,scenes:[SKScene]=[]
        var clipped=false,drawableBudgets:[[String:Any]]=[]
        while let view=views.popLast(),viewCount<limit {
            viewCount+=1
            if let controller=view.next as? NativeGameplayViewController {
                let snapshot=controller.drawableBudgetDiagnosticSnapshot()
                if !snapshot.isEmpty {drawableBudgets.append(snapshot)}
            }
            if view is SKView {skViews+=1}
            if let renderer=view as? any NativeGameplayRenderHost,let scene=renderer.renderedScene {scenes.append(scene)}
            let remaining=max(0,limit-viewCount-views.count)
            if view.subviews.count>remaining {clipped=true}
            views.append(contentsOf:view.subviews.prefix(remaining))
        }
        var nodes:[(SKNode,Bool)]=scenes.map{($0,true)},nodeCount=0,paintable=0,sprites=0,shapes=0,crops=0,shaders=0,actions=0
        var textureIDs=Set<ObjectIdentifier>(),logicalTextureArea=0.0
        while let (node,ancestorVisible)=nodes.popLast(),nodeCount<limit {
            nodeCount+=1
            let visible=ancestorVisible && !node.isHidden && node.alpha>0.001
            if visible {paintable+=1}
            if node.hasActions() {actions+=1}
            if let sprite=node as? SKSpriteNode {
                sprites+=1;if sprite.shader != nil {shaders+=1}
                if let texture=sprite.texture,textureIDs.insert(ObjectIdentifier(texture)).inserted {
                    let size=texture.size()
                    if size.width.isFinite,size.height.isFinite {logicalTextureArea+=Double(max(0,size.width)*max(0,size.height))}
                }
            }
            if node is SKShapeNode {shapes+=1}
            if node is SKCropNode {crops+=1}
            let remaining=max(0,limit-nodeCount-nodes.count)
            if node.children.count>remaining {clipped=true}
            nodes.append(contentsOf:node.children.prefix(remaining).map{($0,visible)})
        }
        return ["mountedViews":viewCount,"mountedSKViews":skViews,"mountedScenes":scenes.count,
                "gameplayDrawableBudgets":drawableBudgets,
                "sceneNodes":nodeCount,"paintableNodes":paintable,"sprites":sprites,"shapes":shapes,
                "cropNodes":crops,"shaderSprites":shaders,"nodesWithActions":actions,
                "uniqueSpriteTextureObjects":textureIDs.count,"spriteTextureLogicalArea":logicalTextureArea,
                "visitLimit":limit,"truncated":clipped]
    }
}
