import UIKit

/// Explicit Native-only capture; no renderer, web, save, audio or haptic owner.
@MainActor final class NativeDiagnosticsCapture {
    static func admitted(arguments:[String],bundleIdentifier:String?)->Bool {
        bundleIdentifier=="com.taptapdesign.stacktosix.native" &&
        arguments.contains(where:{["--cc-performance-diagnostics","--cc-native-thermal-telemetry"].contains($0)})
    }
    private let directory:URL,center:NotificationCenter,timeouts:NativeSourceAppTimeoutOwner
    private let limit:Int,interval:Int,snapshot:()->[String:Any],output:(String)->Void
    private var observers:[NSObjectProtocol]=[],pending:NativeSourceAppTimeoutOwner.Receipt?
    private var file:FileHandle?,foreground=false,epoch:UInt64=0,closed=false
    private var previousBatteryMonitoring:Bool?
    private(set) var fileURL:URL?,sampleCount=0,active=false
    var pendingCount:Int {pending == nil ? 0:1}
    var observerCount:Int {observers.count}
    init(directory:URL,center:NotificationCenter = .default,timeouts:NativeSourceAppTimeoutOwner = .init(),
         sampleLimit:Int=720,intervalMilliseconds:Int=5000,snapshot:@escaping()->[String:Any],output:@escaping(String)->Void={print($0)}) {
        self.directory=directory;self.center=center;self.timeouts=timeouts
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
        } catch {closed=true;output("[CC_NATIVE_THERMAL_FILE] unavailable \(error.localizedDescription)");return}
        active=true;self.foreground=foreground;epoch &+= 1
        previousBatteryMonitoring=UIDevice.current.isBatteryMonitoringEnabled
        if previousBatteryMonitoring==false {UIDevice.current.isBatteryMonitoringEnabled=true}
        watch(UIApplication.didBecomeActiveNotification){$0.setForeground(true,reason:"app-active")}
        watch(UIApplication.willResignActiveNotification){$0.setForeground(false,reason:"app-inactive")}
        watch(UIApplication.didEnterBackgroundNotification){$0.setForeground(false,reason:"app-background")}
        watch(ProcessInfo.thermalStateDidChangeNotification){$0.sample(reason:"thermal-state-change")}
        watch(UIApplication.didReceiveMemoryWarningNotification){$0.sample(reason:"memory-warning")}
        output("[CC_NATIVE_THERMAL_FILE] \(fileURL!.lastPathComponent)")
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
        guard active,!closed,sampleCount<limit,let file else{return}
        let captured=epoch
        var payload=snapshot()
        guard active,!closed,epoch==captured else{return}
        payload["reason"]=reason;payload["sequence"]=sampleCount+1
        payload["wall"]=Int(floor(Date().timeIntervalSince1970*1000))
        payload["webRuntime"]="absent";payload["schema"]="native-diagnostics-v1"
        do {
            let data=try JSONSerialization.data(withJSONObject:payload,options:[.sortedKeys])
            guard data.count<=4096,let json=String(data:data,encoding:.utf8) else {throw CocoaError(.fileWriteUnknown)}
            try file.write(contentsOf:data+Data([10]));sampleCount+=1
            output("[CC_NATIVE_THERMAL] \(json)")
            if sampleCount>=limit {dispose()}
        } catch {dispose();output("[CC_NATIVE_THERMAL_FILE] unavailable \(error.localizedDescription)")}
    }
    private func cancelPending(){if let pending{self.pending=nil;_ = timeouts.cancel(pending)}}
    func dispose() {
        guard !closed else{return};closed=true;active=false;foreground=false;epoch &+= 1
        cancelPending();observers.forEach{center.removeObserver($0)};observers.removeAll()
        try? file?.close();file=nil
        if previousBatteryMonitoring==false,UIDevice.current.isBatteryMonitoringEnabled {UIDevice.current.isBatteryMonitoringEnabled=false}
        previousBatteryMonitoring=nil
    }
    isolated deinit {dispose()}
}
