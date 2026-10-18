import UIKit
import StackToSixGameplay

@MainActor
protocol NativeStackImpactGenerator:AnyObject {
    func prepare()
    func impactOccurred(intensity:CGFloat)
}
extension UIImpactFeedbackGenerator:NativeStackImpactGenerator {}

/// Swift port of the accepted PWA haptic governor. One UIKit transport, no web
/// bridge, timer or idle clock. Authored finite owners supply contact times.
@MainActor
final class NativeHapticRuntime {
    enum Output:Equatable { case impact(String),stackContact,selection,notification(String) }
    struct Beat:Equatable {
        let seconds:Double,style:String
        var protected=false
    }
    private let enabled:()->Bool,active:()->Bool,now:()->Double
    private let transport:(Output)->Void
    private var impacts:[Double]=[],lights:[Double]=[],styles:[String:Double]=[:]
    private var lastImpact = -Double.infinity,lastSelection = -Double.infinity,lastNotification = -Double.infinity
    private var sequences:[UUID:Sequence]=[:]
    private var observers:[NSObjectProtocol]=[]
    private var foreground:Bool
    private var disposed=false
    var onOutput:((Output)->Void)?
    init(enabled:@escaping()->Bool,active:@escaping()->Bool = {UIApplication.shared.applicationState == .active},
         now:@escaping()->Double = {ProcessInfo.processInfo.systemUptime*1000},transport:((Output)->Void)? = nil) {
        self.enabled=enabled;self.active=active;self.now=now;foreground=active()
        let actuator=Actuator()
        self.transport=transport ?? {actuator.emit($0)}
        observers.append(NotificationCenter.default.addObserver(forName:UIApplication.willResignActiveNotification,object:nil,queue:.main) { [weak self] _ in
            MainActor.assumeIsolated {self?.foreground=false;self?.reset()}
        })
        observers.append(NotificationCenter.default.addObserver(forName:UIApplication.didBecomeActiveNotification,object:nil,queue:.main) {[weak self] _ in
            MainActor.assumeIsolated {self?.foreground=true}
        })
    }
    @discardableResult func emit(_ requested:String,protected:Bool=false)->Bool {
        guard !disposed,foreground,enabled(),active() else{return false}
        let style=requested.lowercased(),time=now()
        let output:Output
        if style == "stack-contact" {
            // One committed human stack contact; independent of finale burst
            // budgets so every accepted stack has the same subtle response.
            output = .stackContact
        } else if style == "selection" {
            guard time-lastSelection>=180 else{return false};lastSelection=time;output = .selection
        } else if style.hasPrefix("notification-") {
            guard time-lastNotification>=260 else{return false};lastNotification=time
            output = .notification(String(style.dropFirst("notification-".count)))
        } else {
            let normalized=["light","medium","heavy","rigid","soft"].contains(style) ? style:"medium"
            if !protected {
                impacts.removeAll{$0<=time-10000};lights.removeAll{$0<=time-10000}
                let gap=normalized == "heavy" ? 110.0:["light","soft"].contains(normalized) ? 180.0:140.0
                let same=normalized == "heavy" ? 140.0:["light","soft"].contains(normalized) ? 220.0:180.0
                guard time-lastImpact>=gap,time-(styles[normalized] ?? -Double.infinity)>=same,
                      impacts.filter({$0>time-2000}).count<5,impacts.count<10,
                      normalized != "light" || lights.count<6 else{return false}
                impacts.append(time);if normalized == "light" {lights.append(time)}
                lastImpact=time;styles[normalized]=time
            }
            output = .impact(normalized)
        }
        transport(output);onOutput?(output);return true
    }
    func play(_ beats:[Beat],in host:UIView,current:@escaping()->Bool) {
        guard !disposed,current(),let end=beats.map(\.seconds).max(),end>=0 else{return}
        let id=UUID(),sequence=Sequence(beats:beats,current:current)
        sequence.onBeat={ [weak self] beat in self?.emit(beat.style,protected:beat.protected) }
        sequence.onFinished={ [weak self] _ in self?.sequences.removeValue(forKey:id) }
        sequences[id]=sequence;host.addSubview(sequence);sequence.start()
    }
    func cancelSequences() {
        let captured=Array(sequences.values);sequences.removeAll()
        captured.forEach{$0.dispose()}
    }
    func reset() {
        cancelSequences()
        impacts.removeAll();lights.removeAll();styles.removeAll()
        lastImpact = -Double.infinity;lastSelection = -Double.infinity;lastNotification = -Double.infinity
    }
    func dispose() {
        guard !disposed else{return};disposed=true;reset();onOutput=nil
        observers.forEach(NotificationCenter.default.removeObserver);observers.removeAll()
    }
    isolated deinit {observers.forEach(NotificationCenter.default.removeObserver)}

    /// Reuse generators rather than allocating one for each bubble/contact.
    final class Actuator {
        private var impacts:[String:UIImpactFeedbackGenerator]=[:]
        private let makeStackGenerator:()->NativeStackImpactGenerator
        private var stackGenerator:NativeStackImpactGenerator?
        private lazy var selection=UISelectionFeedbackGenerator()
        private lazy var notification=UINotificationFeedbackGenerator()
        init(makeStackGenerator:@escaping()->NativeStackImpactGenerator = {UIImpactFeedbackGenerator(style:.light)}) {
            self.makeStackGenerator=makeStackGenerator
        }
        func emit(_ output:Output) {
            switch output {
            case .stackContact:
                // One discrete light contact, raised after the reported missing
                // physical response at 0.35; merge-six keeps its own waveform.
                let generator=stackGenerator ?? makeStackGenerator()
                stackGenerator=generator
                generator.prepare()
                generator.impactOccurred(intensity:0.7)
            case .selection:selection.selectionChanged()
            case .notification(let kind):notification.notificationOccurred(kind == "error" ? .error:kind == "warning" ? .warning:.success)
            case .impact(let kind):
                let style:UIImpactFeedbackGenerator.FeedbackStyle
                switch kind {case "heavy":style = .heavy;case "light":style = .light;case "rigid":style = .rigid;case "soft":style = .soft;default:style = .medium}
                let generator=impacts[kind] ?? UIImpactFeedbackGenerator(style:style)
                impacts[kind]=generator;generator.impactOccurred()
            }
        }
    }
    final class Sequence:NativeFinitePresentation {
        private let beats:[Beat],current:()->Bool
        private var sent=0,closed=false
        var onBeat:((Beat)->Void)?
        init(beats:[Beat],current:@escaping()->Bool) {
            self.beats=beats.filter{$0.seconds.isFinite && $0.seconds>=0}.sorted{$0.seconds<$1.seconds};self.current=current
            super.init(viewport:.zero,duration:max(0.001,(self.beats.last?.seconds ?? 0)+0.001))
            accessibilityElementsHidden=true
        }
        required init?(coder:NSCoder){fatalError("Use authored haptic beats")}
        override func paint(seconds:Double) {
            guard !closed,current() else{dispose();return}
            while sent<beats.count,seconds>=beats[sent].seconds {
                let beat=beats[sent];sent += 1
                guard current(),!closed else{dispose();return};onBeat?(beat)
            }
        }
        override func dispose(){guard !closed else{return};closed=true;onBeat=nil;super.dispose()}
    }
}

/// Contact patterns mirror app-core.ts; existing finale owners keep their own
/// glyph/beam/bubble clocks. The first committed six bypasses burst suppression.
enum NativeHapticPatterns {
    static let home:[NativeHapticRuntime.Beat]=[0.2,0.355,0.485].map{.init(seconds:$0,style:"light")}
    static func mergeSix(source:NativeTile?,destination:NativeTile?,event:NativeGameplayEvent)->[NativeHapticRuntime.Beat] {
        let tiles=[source,destination].compactMap{$0}
        let variants=Set(tiles.compactMap(\.variant)+(event.variant.map{[$0]} ?? []))
        if variants.contains("laser-gun") {return []} // Four actual beam contacts own all beats.
        let types=tiles.compactMap(\.archetype)+(event.archetype.map{[$0]} ?? [])
        if types.contains(.tnt) || !variants.isDisjoint(with:["flower","beach-ball","barell"]) {
            return [.init(seconds:0,style:"heavy",protected:true),.init(seconds:0.45,style:"light"),.init(seconds:0.85,style:"light")]
        }
        if !types.isEmpty || !variants.isEmpty {
            return [.init(seconds:0,style:"heavy",protected:true),.init(seconds:0.15,style:"heavy")]
        }
        return [.init(seconds:0,style:"medium",protected:true)]
    }
    static func magnetPull(count:Int)->[NativeHapticRuntime.Beat] {
        let count=min(4,max(0,count)),lastTwo=max(0,count-2)
        return (0..<count).map{.init(seconds:Double($0)*0.05+($0>=lastTwo ? 0.05:0),style:$0>=lastTwo ? "medium":"light")}
    }
}
