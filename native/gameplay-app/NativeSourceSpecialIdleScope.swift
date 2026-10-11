import Foundation
import StackToSixGameplay

/// Captured Scene registrations borrow the app-lived registry. Scope sealing
/// precedes every owner callback, and release never targets a newer Scene.
@MainActor final class NativeSourceSpecialIdleScope {
    /// Actual APP function binding. Nil belongs only to preserved Raw/manual scopes.
    let sourceMathRandom:NativeSourceMathRandomStream?
    private let registry:NativeSourceSpecialIdleRegistry
    private let current:()->Bool
    private var keys:[ObjectIdentifier:AnyObject]=[:]
    private var releases:[UUID:()->Void]=[:]
    private var disposed=false
    var onStateChange:((NativeSourceSpecialIdleRegistry.Snapshot)->Void)?
    init(registry:NativeSourceSpecialIdleRegistry,sourceMathRandom:NativeSourceMathRandomStream?=nil,current:@escaping()->Bool){self.registry=registry;self.sourceMathRandom=sourceMathRandom;self.current=current}
    var snapshot:NativeSourceSpecialIdleRegistry.Snapshot{registry.snapshot}
    var registeredKeys:[AnyObject]{keys.values.filter{registry.has($0)}}
    var admissionOpen:Bool{guard !disposed else{return false};let accepted=current();return accepted && !disposed}
    func hasStarted(_ key:AnyObject)->Bool {
        admissionOpen && keys[ObjectIdentifier(key)] === key && registry.hasStarted(key)
    }
    @discardableResult func register(_ key:AnyObject,owner:NativeSourceSpecialIdleRegistry.Owner)->Bool {
        guard admissionOpen else{return false}
        let id=ObjectIdentifier(key)
        guard !registry.has(key) || keys[id] === key else{return false}
        keys[id]=key
        registry.register(key,owner:owner)
        guard admissionOpen,keys[ObjectIdentifier(key)] === key,registry.has(key) else{return false}
        publish();return admissionOpen
    }
    func retire(_ key:AnyObject){
        guard keys[ObjectIdentifier(key)] === key else{return}
        keys.removeValue(forKey:ObjectIdentifier(key));registry.retire(key);publish()
    }
    func acquire(reason:String)->(()->Void)? {
        guard admissionOpen,let captured=registry.acquire(reason:reason) else{return nil}
        guard admissionOpen else{captured();return nil}
        let id=UUID();var released=false
        let release:()->Void = {[weak self] in
            guard !released else{return};released=true
            self?.releases.removeValue(forKey:id);captured();self?.publish()
        }
        releases[id]=release;publish()
        guard admissionOpen else{release();return nil}
        return release
    }
    private func publish(){guard admissionOpen else{return};onStateChange?(registry.snapshot)}
    func dispose(){
        guard !disposed else{return};disposed=true;onStateChange=nil
        let capturedKeys=Array(keys.values),capturedReleases=Array(releases.values)
        keys.removeAll();releases.removeAll()
        for key in capturedKeys{registry.retire(key)}
        for release in capturedReleases{release()}
    }
    isolated deinit{dispose()}
}
