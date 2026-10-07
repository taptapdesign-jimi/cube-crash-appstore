import UIKit
import StackToSixGameplay

/// Native app composition. Services contain Swift state owners, never a web transport.
@MainActor
struct NativeAppServices {
    var settings: () -> [String: Any]
    var setPreference: (String, Bool) throws -> Void
    var worldSnapshot: (Int, CGSize, Int) throws -> [String: Any]
    var markViewed: (Int) throws -> Void
    var makeGameplay: (Int?, @escaping () -> Void) throws -> UIViewController
    var flush: () throws -> Void
    var ambient: (Int, CGRect, [Int]) -> [[String:Any]]? = {_,_,_ in nil}
    var bees: ([Int]) -> [[String:Any]]? = {_ in nil}
    var requiresTutorial: () -> Bool = {false}
    var prepareReturnWorld: (JimiNativeWorldView,@escaping ()->Void)->Void = {world,completion in world.prepare(completion:completion)}
}

@MainActor
final class NativeAppController: UIViewController {
    enum Route: Equatable {case home, hub, settings, world(Int), gameplay}
    private let services: NativeAppServices
    private let artwork: JimiV9Artwork
    private(set) var route = Route.home
    private(set) var home: JimiV9HomeView!
    private(set) var hub: JimiV9HubView!
    private(set) var settingsView: JimiNativeSettingsView!
    private(set) var world: JimiNativeWorldView?
    private var gameplay: UIViewController?
    private var motion: NativeRouteMotion!
    private var backpack:NativeHubBackpackFeedback?
    private var generation = 0
    private var transitioning = false
    private var suspended = false
    private var deferredReveal:Route?
    private var observers: [NSObjectProtocol] = []
    private var returnRoute = Route.home
    private var homeJourneyTutorial=false
    private var beforeHomeReveal:(()->Void)?
    private var disposed=false
    private var returnPreparationEpoch=0
    @MainActor private final class ReturnPreparation {
        let epoch:Int,routeGeneration:Int,runGeneration:UInt64?,target:Route
        weak var gameplay:UIViewController?
        weak var world:JimiNativeWorldView?
        let originalAlpha:CGFloat,originalInteraction:Bool
        var callbacks:[(Bool)->Void],ready=false
        init(epoch:Int,routeGeneration:Int,gameplay:UIViewController,target:Route,completion:@escaping(Bool)->Void){
            self.epoch=epoch;self.routeGeneration=routeGeneration;self.gameplay=gameplay;self.target=target
            runGeneration=(gameplay as? NativeGameplayViewController)?.engine.state.generation
            originalAlpha=gameplay.view.alpha;originalInteraction=gameplay.view.isUserInteractionEnabled;callbacks=[completion]
        }
    }
    private var returnPreparation:ReturnPreparation?
    var hasPreparedGameplayReturn:Bool {guard let lease=returnPreparation else{return false};return lease.ready && isCurrentReturn(lease)}
    private let fault = UILabel()
    var onFeedback: ((String) -> Void)?
    var onRoute: ((Route) -> Void)?

    init(resourceRoot: URL, services: NativeAppServices) {
        self.services = services;self.artwork = JimiV9Artwork(resourceRoot:resourceRoot)
        super.init(nibName:nil,bundle:nil)
    }
    required init?(coder:NSCoder) {fatalError("Use native dependency initializer")}
    override var prefersStatusBarHidden: Bool {true}

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red:243/255,green:238/255,blue:232/255,alpha:1)
        let paper = UIImageView(image:artwork.image("assets/paper-bg.png"))
        paper.frame = view.bounds;paper.contentMode = .scaleToFill;paper.autoresizingMask = [.flexibleWidth,.flexibleHeight];view.addSubview(paper)
        let tint = UIView(frame:view.bounds);tint.backgroundColor = view.backgroundColor?.withAlphaComponent(0.4)
        tint.autoresizingMask = [.flexibleWidth,.flexibleHeight];view.addSubview(tint)
        home = JimiV9HomeView(frame:view.bounds,assets:artwork)
        hub = JimiV9HubView(frame:view.bounds,assets:artwork)
        settingsView = JimiNativeSettingsView(frame:view.bounds,assets:artwork)
        for surface in [home as UIView,hub as UIView,settingsView as UIView] {
            surface.autoresizingMask = [.flexibleWidth,.flexibleHeight];surface.isHidden = true;view.addSubview(surface)
        }
        motion = NativeRouteMotion(home:home,hub:hub)
        backpack=NativeHubBackpackFeedback(button:hub.backpackButton)
        hub.onBackpack = { [weak self] in guard let self else{return};self.backpack?.activate(generation:self.generation) }
        home.onActivate = { [weak self] index in
            guard let self else{return}
            self.homeJourneyTutorial = index == 0 && self.services.requiresTutorial()
            self.navigate(self.homeJourneyTutorial ? .gameplay : index == 0 ? .hub : index == 1 ? .gameplay : .settings)
        }
        home.onSlideSelected = { [weak self] index in self?.selectSlide(index) }
        home.onPanBegan = { [weak self] in
            guard let self,!self.transitioning,self.route == .home else{return false}
            self.home.pauseHeroIdle();return true
        }
        home.onPanEnded = { [weak self] index,_ in self?.selectSlide(index) }
        hub.onBack = { [weak self] in self?.navigate(.home,interrupt:true) }
        hub.onWorld = { [weak self] id in self?.navigate(.world(id)) }
        settingsView.onBack = { [weak self] in self?.navigate(.home) }
        settingsView.onPreference = { [weak self] key,enabled,epoch in
            guard let self,self.route == .settings,!self.transitioning,epoch == self.generation else{return}
            do {try self.services.setPreference(key,enabled);self.applySettings()} catch {self.showFault(error)}
        }
        settingsView.onPrivacy = { [weak self] in
            guard let self,self.presentedViewController == nil else{return}
            let privacy = JimiNativePrivacyController(assets:self.artwork);privacy.modalPresentationStyle = .overFullScreen
            self.present(privacy,animated:false)
        }
        fault.numberOfLines = 0;fault.textAlignment = .center;fault.font = artwork.font(size:17,weight:"Medium")
        fault.textColor = .systemRed;fault.accessibilityIdentifier = "native.migration.error";fault.isHidden = true
        view.addSubview(fault)
        observers.append(NotificationCenter.default.addObserver(forName:UIApplication.willResignActiveNotification,object:nil,queue:.main) { [weak self] _ in
            MainActor.assumeIsolated {self?.suspend()}
        })
        observers.append(NotificationCenter.default.addObserver(forName:UIApplication.didBecomeActiveNotification,object:nil,queue:.main) { [weak self] _ in
            MainActor.assumeIsolated {self?.resume()}
        })
        reveal(.home)
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews();fault.frame = CGRect(x:24,y:view.safeAreaInsets.top+16,width:max(0,view.bounds.width-48),height:100)
    }
    private func applySettings() {
        var value = services.settings();value["presentationEpoch"] = generation
        value["developerToolsAvailable"] = false // native diagnostics are separate; no web escape
        _ = settingsView.apply(value)
    }
    private func selectSlide(_ index:Int) {
        guard !transitioning,route == .home else{return}
        home.selectSlide(index,animated:true);onFeedback?("tab");home.startHeroIdle()
    }
    func navigate(_ next:Route,interrupt:Bool = false) {
        guard route != next,(!transitioning || interrupt),route != .gameplay else{return}
        if transitioning {motion.cancel()}
        generation += 1;let owner = generation;transitioning = true
        backpack?.setActive(false,generation:generation)
        home.stopHeroIdle(preservePaintedPose:true);hub.stopIdle()
        home.isUserInteractionEnabled = false;hub.setContentInteractionEnabled(false);settingsView.isUserInteractionEnabled = false
        onFeedback?(next == .home || next == .hub && route != .home ? "back" : "cta")
        let complete:()->Void = { [weak self] in
            guard let self,self.generation == owner else{return}
            self.reveal(next)
        }
        switch route {
        case .home:motion.animate(motion.homeTracks(enter:false),completion:complete)
        case .hub:
            let id:Int? = {if case .world(let id) = next{return id};return nil}()
            motion.animate(motion.hubTracks(enter:false,selectedWorldID:id),completion:complete)
        case .settings:motion.animate(settingsView.tracks(enter:false),completion:complete)
        case .world:world?.exit(completion:complete)
        case .gameplay:break
        }
    }
    private func reveal(_ next:Route) {
        guard !suspended else {deferredReveal = next;return}
        home.isHidden = true;hub.isHidden = true;settingsView.isHidden = true;world?.isHidden = true
        route = next;onRoute?(next);fault.isHidden = true
        let owner = generation
        let admitted:()->Void = { [weak self] in
            guard let self,self.generation == owner else{return}
            self.transitioning = false
            self.backpack?.setActive(self.route == .hub && !self.suspended,generation:self.generation)
            self.home.isUserInteractionEnabled = self.route == .home
            self.hub.setContentInteractionEnabled(self.route == .hub)
            self.settingsView.isUserInteractionEnabled = self.route == .settings
            if self.route == .home {self.home.startHeroIdle()}
            if self.route == .hub {self.hub.startIdle()}
        }
        switch next {
        case .home:
            home.isHidden = false;home.selectSlide(home.selectedSlide,animated:false)
            motion.animate(motion.homeTracks(enter:true),completion:admitted)
            let prepared=beforeHomeReveal;beforeHomeReveal=nil;prepared?()
        case .hub:
            hub.isHidden = false;hub.isUserInteractionEnabled = true
            motion.animate(motion.hubTracks(enter:true),completion:admitted)
        case .settings:
            settingsView.isHidden = false;applySettings();settingsView.layoutIfNeeded()
            motion.animate(settingsView.tracks(enter:true),completion:admitted)
        case .world(let id):
            do {
                let snapshot = try services.worldSnapshot(id,view.bounds.size,generation+1)
                if let current = world,current.snapshot.worldID == id {current.reconcile(snapshot)}
                else {
                    world?.cleanup();world?.removeFromSuperview()
                    guard let created = JimiNativeWorldView(snapshot:snapshot,assets:artwork) else {throw NativeAppError.invalidWorld}
                    created.isHidden = true;created.frame = view.bounds;created.autoresizingMask = [.flexibleWidth,.flexibleHeight];view.addSubview(created);world = created
                }
                guard let world else{throw NativeAppError.invalidWorld}
                world.onRequest = { [weak self] action,boardID in self?.worldAction(action,boardID:boardID) }
                world.onFeedback = { [weak self] kind,_,_ in self?.onFeedback?(kind) }
                world.onResourceFailure = { [weak self] reason in self?.showFault(NativeAppError.resources(reason)) }
                world.onAmbientPlansRequest = { [weak self] viewport,ids,completion in
                    completion(self?.services.ambient(id,viewport,ids))
                }
                world.onBeePlansRequest = { [weak self] ids,completion in completion(self?.services.bees(ids)) }
                world.prepare { [weak self,weak world] in
                    guard let self,let world,self.generation == owner,self.route == next else{return}
                    guard !self.suspended else {self.deferredReveal = next;return}
                    world.isHidden = false;world.enter {
                        guard self.generation == owner else{return}
                        world.finishPresentationAdmission();admitted()
                    }
                }
            } catch {
                generation += 1;reveal(.hub);showFault(error)
            }
        case .gameplay:launch(boardID:homeJourneyTutorial ? 1 : nil);homeJourneyTutorial=false
        }
    }
    private func worldAction(_ action:String,boardID:Int?) {
        if action == "back",case .world = route {navigate(.hub,interrupt:true);return}
        guard !transitioning,case .world = route else{return}
        switch action {
        case "back":navigate(.hub,interrupt:true)
        case "openCard":
            guard let boardID else{return}
            do {try services.markViewed(boardID);world?.openCard(boardID:boardID)} catch {showFault(error)}
        case "close":world?.closeCard()
        case "play","continue":
            guard let boardID else{return};transitioning = true
            world?.prepareGameplayExit(boardID:boardID) { [weak self] in self?.launch(boardID:boardID) }
        default:break
        }
    }
    private func launch(boardID:Int?) {
        cancelGameplayReturnPreparation()
        do {
            returnRoute = boardID.map { .world(($0-1)/10+1) } ?? .home
            let controller = try services.makeGameplay(boardID) { [weak self] in self?.returnFromGameplay() }
            addChild(controller);controller.view.frame = view.bounds;controller.view.autoresizingMask = [.flexibleWidth,.flexibleHeight]
            view.addSubview(controller.view);controller.didMove(toParent:self);gameplay = controller
            home.isHidden = true;hub.isHidden = true;settingsView.isHidden = true;world?.park();world?.isHidden = true
            route = .gameplay;transitioning = false;onRoute?(.gameplay)
        } catch {
            generation += 1;reveal(returnRoute);showFault(error)
        }
    }
    private func returnFromGameplay() {
        do {try services.flush()} catch {showFault(error);return}
        let prepared=hasPreparedGameplayReturn ? returnPreparation:nil
        if prepared == nil {cancelGameplayReturnPreparation()}else{returnPreparation=nil;returnPreparationEpoch += 1}
        (gameplay as? NativeGameplayViewController)?.dispose()
        gameplay?.willMove(toParent:nil);gameplay?.view.removeFromSuperview();gameplay?.removeFromParent();gameplay = nil
        generation += 1;transitioning = true
        if let prepared,let incoming=prepared.world,case .world(let id)=prepared.target {
            let owner=generation
            home.isHidden=true;hub.isHidden=true;settingsView.isHidden=true
            route = .world(id);fault.isHidden=true;onRoute?(route);incoming.isHidden=false
            incoming.enter(terminal:true){[weak self,weak incoming] in
                guard let self,let incoming,!self.disposed,self.generation==owner,self.world===incoming else{return}
                incoming.finishPresentationAdmission();self.transitioning=false
            }
        }else{reveal(returnRoute)}
    }
    /// Prepare the current persisted World behind the existing result paper.
    /// Readiness never changes route, hides gameplay or starts destination idle.
    func prepareGameplayReturn(completion:@escaping(Bool)->Void) {
        guard !disposed,!suspended,route == .gameplay,let gameplay,case .world(let id)=returnRoute else{completion(false);return}
        if let existing=returnPreparation,isCurrentReturn(existing) {
            if existing.ready {completion(true)}else{existing.callbacks.append(completion)}
            return
        }
        cancelGameplayReturnPreparation();returnPreparationEpoch += 1
        let lease=ReturnPreparation(epoch:returnPreparationEpoch,routeGeneration:generation,gameplay:gameplay,target:returnRoute,completion:completion)
        returnPreparation=lease;gameplay.view.isUserInteractionEnabled=false
        do {
            let raw=try services.worldSnapshot(id,view.bounds.size,generation+1)
            guard let snapshot=JimiNativeWorldSnapshot(raw),snapshot.worldID==id else{throw NativeAppError.invalidWorld}
            let incoming:JimiNativeWorldView
            if let current=world,current.snapshot.worldID==id {current.park();current.reconcile(snapshot);incoming=current}
            else {
                world?.cleanup();world?.removeFromSuperview()
                guard let created=JimiNativeWorldView(snapshot:raw,assets:artwork) else{throw NativeAppError.invalidWorld}
                incoming=created;incoming.frame=view.bounds;incoming.autoresizingMask=[.flexibleWidth,.flexibleHeight]
                view.insertSubview(incoming,belowSubview:gameplay.view);world=incoming
            }
            incoming.isHidden=true;incoming.setActive(false);lease.world=incoming
            configureWorld(incoming,id:id)
            services.prepareReturnWorld(incoming){[weak self,weak lease] in
                guard let self,let lease,self.isCurrentReturn(lease),let incoming=lease.world else{return}
                guard incoming.primeHiddenReturnPose() else{self.cancelGameplayReturnPreparation();return}
                lease.ready=true;let callbacks=lease.callbacks;lease.callbacks.removeAll();callbacks.forEach{$0(true)}
            }
        }catch{cancelGameplayReturnPreparation();showFault(error)}
    }
    /// The result owner calls only after its opaque visual cover and the exact
    /// incoming World are ready. This is a separate commit from preparation.
    @discardableResult func hideGameplayForPreparedReturn()->Bool {
        guard hasPreparedGameplayReturn,let gameplay else{return false}
        gameplay.view.alpha=0;return true
    }
    func cancelGameplayReturnPreparation() {
        returnPreparationEpoch += 1
        guard let lease=returnPreparation else{return};returnPreparation=nil
        lease.world?.cancelHiddenReturnPose();lease.world?.cancelPendingPreparation()
        if let captured=lease.gameplay,gameplay===captured,route == .gameplay {
            captured.view.alpha=lease.originalAlpha;captured.view.isUserInteractionEnabled=lease.originalInteraction
        }
        let callbacks=lease.callbacks;lease.callbacks.removeAll();callbacks.forEach{$0(false)}
    }
    private func isCurrentReturn(_ lease:ReturnPreparation)->Bool {
        guard !disposed,!suspended,returnPreparation===lease,lease.epoch==returnPreparationEpoch,
              lease.routeGeneration==generation,route == .gameplay,returnRoute==lease.target,
              let captured=lease.gameplay,gameplay===captured else{return false}
        return (captured as? NativeGameplayViewController)?.engine.state.generation==lease.runGeneration
    }
    private func configureWorld(_ incoming:JimiNativeWorldView,id:Int){
        incoming.onRequest = {[weak self] action,board in self?.worldAction(action,boardID:board)}
        incoming.onFeedback = {[weak self] kind,_,_ in self?.onFeedback?(kind)}
        incoming.onResourceFailure = {[weak self] reason in self?.showFault(NativeAppError.resources(reason))}
        incoming.onAmbientPlansRequest = {[weak self] viewport,ids,completion in completion(self?.services.ambient(id,viewport,ids))}
        incoming.onBeePlansRequest = {[weak self] ids,completion in completion(self?.services.bees(ids))}
    }
    func returnTutorialToHome(onPrepared:@escaping ()->Void) {
        home.selectSlide(0,animated:false);returnRoute = .home;beforeHomeReveal=onPrepared
        returnFromGameplay()
    }
    private func showFault(_ error:Error) {fault.text = error.localizedDescription;fault.isHidden = false;view.bringSubviewToFront(fault)}
    private func suspend() {
        suspended = true;motion.suspend()
        cancelGameplayReturnPreparation()
        backpack?.setActive(false,generation:generation)
        home.pauseHeroIdle();hub.stopIdle();world?.setActive(false)
        do {try services.flush()} catch {showFault(error)}
    }
    private func resume() {
        suspended = false;motion.resume()
        if let next = deferredReveal {deferredReveal = nil;reveal(next);return}
        guard !transitioning else{return}
        if route == .home {home.startHeroIdle()}
        if route == .hub {hub.startIdle()}
        backpack?.setActive(route == .hub,generation:generation)
        if case .world = route {world?.setActive(true)}
    }
    func dispose() {
        disposed=true;cancelGameplayReturnPreparation()
        generation += 1;transitioning = true;suspended = true;deferredReveal = nil
        motion?.cancel();home?.stopHeroIdle(preservePaintedPose:false);hub?.stopIdle()
        backpack?.dispose();backpack=nil;hub?.onBackpack=nil
        world?.cleanup();world?.removeFromSuperview();world = nil
        (gameplay as? NativeGameplayViewController)?.dispose()
        for observer in observers {NotificationCenter.default.removeObserver(observer)};observers.removeAll()
        onFeedback = nil;onRoute = nil
        beforeHomeReveal=nil
    }
    deinit {for observer in observers {NotificationCenter.default.removeObserver(observer)}}
}
private enum NativeAppError:LocalizedError {
    case invalidWorld, resources(String)
    var errorDescription:String? {switch self {case .invalidWorld:return "Native World data is unavailable";case .resources(let detail):return detail}}
}
