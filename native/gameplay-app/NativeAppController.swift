import UIKit
import StackToSixGameplay
import StackToSixNativeState

/// Native app composition. Services contain Swift state owners, never a web transport.
@MainActor
struct NativeAppServices {
    var developerAction: ((NativeDeveloperAction, UIViewController) throws -> Void)?
    var showsStudioIntro=false
    var studioIntroCue:((String)->Void)?
    var readJourneyDie: (String)->Bool = {_ in false}
    var journeyProgression: () -> NativeProgressionState = {NativeProgressionState()}
    var settings: () -> [String: Any]
    var setPreference: (String, Bool) throws -> Void
    var worldSnapshot: (Int, CGSize, Int) throws -> [String: Any]
    var markViewed: (Int) throws -> Void
    var makeGameplay: (Int?, @escaping () -> Void) throws -> UIViewController
    var prepareGameplayEntry:(Int?,@escaping(Bool)->Void)->Void = {_,completion in completion(true)}
    var cancelGameplayEntry:()->Void = {}
    var selectArcadeVariant:(NativeArcadeVariant)throws->Void = {_ in}
    var canContinueArcade:(NativeArcadeVariant)->Bool = {_ in false}
    var flush: () throws -> Void
    var ambient: (Int, CGRect, [Int]) -> [[String:Any]]? = {_,_,_ in nil}
    var bees: ([Int]) -> [[String:Any]]? = {_ in nil}
    var requiresTutorial: () -> Bool = {false}
    var prepareReturnWorld: (JimiNativeWorldView,@escaping ()->Void)->Void = {world,completion in world.prepare(completion:completion)}
    var prepareWorldEntry: (JimiNativeWorldView,@escaping ()->Void)->Void = {world,completion in world.prepare(completion:completion)}
}

@MainActor
final class NativeAppController: UIViewController {
    enum Route: Equatable {case home, hub, arcadeHub, settings, backpack, world(Int), gameplay}
    private let services: NativeAppServices
    private let artwork: JimiV9Artwork
    private let resourceRoot:URL
    private var studioIntro:NativeStudioIntroView?
    private(set) var route = Route.home
    private(set) var home: JimiV9HomeView!
    private(set) var hub: JimiV9HubView!
    private(set) var arcadeHub: NativeArcadeHubView!
    private(set) var settingsView: JimiNativeSettingsView!
    private(set) var world: JimiNativeWorldView?
    private var gameplay: UIViewController?
    @MainActor private final class GameplayLaunchPreparation {
        let board:Int?,generation:Int
        var ready=false,exitFinished=false
        init(board:Int?,generation:Int){self.board=board;self.generation=generation}
    }
    private var gameplayLaunchPreparation:GameplayLaunchPreparation?
    private var motion: NativeRouteMotion!
    private(set) var backpackView:NativeBackpackView?
    private var pendingBackpackDie:NativeBackpackCatalog.Die?
    private var backpackDetail:NativeBackpackDetail?
    private var backpackReturnRoute:Route = .hub
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
    @MainActor private final class WorldEntryPreparation {
        let generation:Int,id:Int,world:JimiNativeWorldView
        var ready=false
        init(generation:Int,id:Int,world:JimiNativeWorldView){self.generation=generation;self.id=id;self.world=world}
    }
    private var worldEntryPreparation:WorldEntryPreparation?
    var hasPreparedGameplayReturn:Bool {guard let lease=returnPreparation else{return false};return lease.ready && isCurrentReturn(lease)}
    private let fault = UILabel()
    var onFeedback: ((String) -> Void)?
    var onShipVisibility:((Bool)->Void)?
    var onRoute: ((Route) -> Void)?

    init(resourceRoot: URL, services: NativeAppServices) {
        self.resourceRoot=resourceRoot;self.services = services;self.artwork = JimiV9Artwork(resourceRoot:resourceRoot)
        super.init(nibName:nil,bundle:nil)
    }
    required init?(coder:NSCoder) {fatalError("Use native dependency initializer")}
    override var prefersStatusBarHidden: Bool {true}

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = NativeAppPaperSurface.base
        let paper = NativeAppPaperSurface(artwork:artwork)
        paper.frame=view.bounds;paper.autoresizingMask=[.flexibleWidth,.flexibleHeight]
        view.addSubview(paper)
        home = JimiV9HomeView(frame:view.bounds,assets:artwork)
        hub = JimiV9HubView(frame:view.bounds,assets:artwork)
        settingsView = JimiNativeSettingsView(frame:view.bounds,assets:artwork)
        arcadeHub = NativeArcadeHubView(frame:view.bounds,assets:artwork)
        arcadeHub.onFeedback = {[weak self] cue in self?.onFeedback?(cue)}
        arcadeHub.canContinue = {[weak self] identifier in
            guard let self,let variant=NativeArcadeVariant(rawValue:identifier) else{return false}
            return self.services.canContinueArcade(variant)
        }
        for surface in [home as UIView,hub as UIView,arcadeHub as UIView,settingsView as UIView] {
            surface.autoresizingMask = [.flexibleWidth,.flexibleHeight];surface.isHidden = true;view.addSubview(surface)
        }
        motion = NativeRouteMotion(home:home,hub:hub)
        backpack=NativeHubBackpackFeedback(button:hub.backpackButton)
        hub.onBackpack = { [weak self] in guard let self else{return};self.navigate(.backpack) }
        home.onActivate = { [weak self] index in
            guard let self else{return}
            self.homeJourneyTutorial = index == 0 && self.services.requiresTutorial()
            self.navigate(self.homeJourneyTutorial ? .gameplay : index == 0 ? .hub : index == 1 ? .arcadeHub : .settings)
        }
        home.onSlideSelected = { [weak self] index in self?.selectSlide(index) }
        home.onPanBegan = { [weak self] in
            guard let self,!self.transitioning,self.route == .home else{return false}
            self.motion.cancel();self.home.pauseHeroIdle();return true
        }
        home.onPanEnded = { [weak self] index,_ in self?.selectSlide(index,feedback:"tab-swipe") }
        arcadeHub.onCrate = {[weak self] in
            guard let self,!self.disposed,!self.suspended,!self.transitioning,self.route == .arcadeHub else{return}
            self.navigate(.backpack)
        }
        arcadeHub.onClose = {[weak self] in self?.navigate(.home,interrupt:true)}
        arcadeHub.onPlayExit = {[weak self] done in
            guard let self,!self.disposed,!self.suspended,self.route == .arcadeHub else{return}
            self.motion.animate(self.arcadeHub.tracks(enter:false),completion:done)
        }
        arcadeHub.onPlay = {[weak self] identifier in
            guard let self,!self.disposed,!self.suspended,!self.transitioning,self.route == .arcadeHub,
                  let variant=NativeArcadeVariant(rawValue:identifier) else{return}
            do {try self.services.selectArcadeVariant(variant)} catch {self.reveal(.arcadeHub);self.showFault(error);return}
            self.transitioning=true;self.arcadeHub.setContentInteractionEnabled(false);self.arcadeHub.suspend()
            // New variant rules must never alter the required authored tutorial.
            let tutorialBoard:Int? = self.services.requiresTutorial() && variant != .endurance ? 1:nil
            self.prepareGameplayLaunch(boardID:tutorialBoard)
        }
        hub.onBack = { [weak self] in self?.navigate(.home,interrupt:true) }
        hub.onWorld = { [weak self] id in self?.navigate(.world(id)) }
        settingsView.onBack = { [weak self] in self?.navigate(.home) }
        settingsView.onDeveloperClose = {[weak self] in self?.onFeedback?("back")}
        settingsView.onDeveloper = { [weak self] epoch in
            guard let self,!self.disposed,!self.suspended,!self.transitioning,
                  self.route == .settings,epoch == self.generation else{return}
            self.onFeedback?("cta");self.settingsView.setDeveloperPanelVisible(true)
        }
        settingsView.onDeveloperAction = { [weak self] action, epoch in
            guard let self, !self.disposed, !self.suspended, !self.transitioning,
                  self.route == .settings, epoch == self.generation,
                  self.settingsView.developerPanelVisible, self.presentedViewController == nil else { return }
            self.onFeedback?("cta")
            do { try self.services.developerAction?(action, self) } catch { self.showFault(error) }
        }
        settingsView.onPreference = { [weak self] key,enabled,epoch in
            guard let self,self.route == .settings,!self.transitioning,epoch == self.generation else{return}
            do {try self.services.setPreference(key,enabled);self.applySettings()} catch {self.showFault(error)}
        }
        settingsView.onPrivacy = { [weak self] in
            guard let self,self.presentedViewController == nil else{return}
            self.onFeedback?("cta")
            let privacy = JimiNativePrivacyController(assets:self.artwork);privacy.modalPresentationStyle = .overFullScreen
            privacy.onCloseRequested={[weak self] in self?.onFeedback?("back")}
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
        if services.showsStudioIntro {
            transitioning=true
            let intro=NativeStudioIntroView(root:resourceRoot);studioIntro=intro
            intro.frame=view.bounds;intro.autoresizingMask=[.flexibleWidth,.flexibleHeight];view.addSubview(intro)
            intro.onCharacterCue=services.studioIntroCue
            intro.start { [weak self] in guard let self,!self.disposed else{return};self.studioIntro=nil;self.reveal(.home) }
        }else{reveal(.home)}
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews();fault.frame = CGRect(x:24,y:view.safeAreaInsets.top+16,width:max(0,view.bounds.width-48),height:100)
    }
    private func applySettings() {
        var value = services.settings();value["presentationEpoch"] = generation
        value["developerToolsAvailable"] = true
        value["firstPlayRequired"] = services.requiresTutorial()
        _ = settingsView.apply(value)
    }
    private func selectSlide(_ index:Int,feedback:String="tab") {
        guard !transitioning,route == .home else{return}
        onFeedback?(feedback)
        motion.selectSlide(index) { [weak self] in
            guard let self,self.route == .home,!self.suspended,!self.transitioning else{return}
            self.home.startHeroIdle()
        }
    }
    func navigate(_ next:Route,interrupt:Bool = false) {
        guard studioIntro == nil,route != next,(!transitioning || interrupt),route != .gameplay else{return}
        if next == .backpack {
            if case .world = route {backpackReturnRoute=route}else{backpackReturnRoute = route == .arcadeHub ? .arcadeHub:.hub}
        }
        retireDeveloperPresentation()
        cancelWorldEntryPreparation()
        cancelGameplayLaunchPreparation()
        if transitioning {motion.cancel()} else {motion.cancelSelectionLayout()}
        generation += 1;let owner = generation;transitioning = true
        settingsView.setDeveloperPanelVisible(false)
        backpack?.setActive(false,generation:generation)
        if route == .hub {
            let button:UIButton? = next == .backpack ? hub.backpackButton : next == .home ? hub.backButton : nil
            if let button {NativeHubBackpackFeedback.play(on:button.imageView ?? button)}
        }

        home.stopHeroIdle(preservePaintedPose:true);hub.stopIdle();arcadeHub.suspend()
        home.isUserInteractionEnabled = false;hub.setContentInteractionEnabled(false);settingsView.isUserInteractionEnabled = false
        // v9 starts the exact destination preparation under the Hub exit.
        // Resource readiness never replaces that exit's completion receipt.
        if route == .hub,case .world(let id)=next {
            do {try prepareWorldEntry(id:id,owner:owner)}catch {
                transitioning=false;hub.setContentInteractionEnabled(true);hub.startIdle();showFault(error);return
            }
        }
        // Journey hubTracks owns the selected World scale and collapse.
        // An additional artwork pulse compounds that same visible tap.
        onFeedback?(route == .backpack || next == .home || next == .hub && route != .home ? "back" : "cta")
        let complete:()->Void = { [weak self] in
            guard let self,self.generation == owner else{return}
            self.reveal(next)
        }
        backpackView?.isUserInteractionEnabled=false;backpackView?.setAlertsActive(false)
        switch route {
        case .backpack:
            retireBackpackDetail()
            motion.animate(backpackView?.tracks(enter:false) ?? [],completion:complete)
        case .home:motion.animate(motion.homeTracks(enter:false),completion:complete)
        case .hub:
            let id:Int? = {if case .world(let id) = next{return id};return nil}()
            motion.animate(motion.hubTracks(enter:false,selectedWorldID:id),completion:complete)
        case .arcadeHub:motion.animate(arcadeHub.tracks(enter:false),completion:complete)
        case .settings:motion.animate(settingsView.tracks(enter:false),completion:complete)
        case .world:world?.exit(completion:complete)
        case .gameplay:break
        }
    }
    private func reveal(_ next:Route) {
        guard !suspended else {deferredReveal = next;return}
        if route == .backpack || next == .backpack {motion.cancel()}
        home.isUserInteractionEnabled=false
        home.isHidden = true;hub.isHidden = true;arcadeHub.hide();settingsView.isHidden = true;world?.isHidden = true
        backpackView?.isHidden=true
        route = next;onRoute?(next);fault.isHidden = true
        let owner = generation
        let admitted:()->Void = { [weak self] in
            guard let self,self.generation == owner else{return}
            self.transitioning = false
            self.backpack?.setActive(self.route == .hub && !self.suspended,generation:self.generation)
            self.home.isUserInteractionEnabled = self.route == .home
            self.hub.setContentInteractionEnabled(self.route == .hub)
            self.settingsView.isUserInteractionEnabled = self.route == .settings
            self.backpackView?.isUserInteractionEnabled = self.route == .backpack
            self.backpackView?.setAlertsActive(self.route == .backpack && !self.suspended)
            if self.route == .home {self.home.startHeroIdle()}
            if self.route == .hub {self.hub.startIdle()}
            if self.route == .arcadeHub {self.arcadeHub.setContentInteractionEnabled(true);self.arcadeHub.resume()}
        }
        switch next {
        case .backpack:
            let crate = backpackReturnRoute == .arcadeHub
            if let current=backpackView,current.arcadeCrate != crate {
                retireBackpackDetail();current.onClose=nil;current.onDie=nil;current.removeFromSuperview();backpackView=nil
            }
            if backpackView == nil {
                let screen=NativeBackpackView(frame:view.bounds,assets:JimiV9Artwork(resourceRoot:resourceRoot),title:crate ? "Dice Box":"Backpack",arcadeCrate:crate)
                screen.autoresizingMask=[.flexibleWidth,.flexibleHeight];view.addSubview(screen);backpackView=screen
                screen.onClose={[weak self] in guard let self,!self.disposed,!self.suspended,!self.transitioning,self.route == .backpack else{return};self.navigate(self.backpackReturnRoute)}
                screen.onDie={[weak self] die in self?.openBackpackDetail(die)}
            }
            backpackView?.isHidden=false;backpackView?.isUserInteractionEnabled=false
            backpackView?.apply(crate ? []:NativeBackpackCatalog.sections(services.journeyProgression()))
            motion.animate(backpackView?.tracks(enter:true) ?? [],completion:admitted)
        case .home:
            home.isHidden = false;home.selectSlide(home.selectedSlide,animated:false)
            onFeedback?("home-haptic-enter")
            motion.animate(motion.homeTracks(enter:true),completion:admitted)
            let prepared=beforeHomeReveal;beforeHomeReveal=nil;prepared?()
        case .hub:
            let progression=services.journeyProgression()
            hub.setBackpackUnread(!progression.unreadJourneyDice.isEmpty)
            hub.updateProgress(hub.worldIDs.map { id in
                let boards=((id-1)*10+1)...(id*10)
                return ["worldId":id,"completed":boards.filter(progression.completedJourneyBoards.contains).count,
                        "total":boards.count,"hasInterimCard":progression.interimBoard(world:id) != nil] as [String:Any]
            })
            hub.isHidden = false;hub.isUserInteractionEnabled = true
            motion.animate(motion.hubTracks(enter:true),completion:admitted)
        case .arcadeHub:
            arcadeHub.present()
            motion.animate(arcadeHub.tracks(enter:true),completion:admitted)
        case .settings:
            settingsView.isHidden = false;applySettings();settingsView.layoutIfNeeded()
            motion.animate(settingsView.tracks(enter:true),completion:admitted)
        case .world(let id):
            do {
                if worldEntryPreparation?.generation != owner || worldEntryPreparation?.id != id {
                    try prepareWorldEntry(id:id,owner:owner)
                }
                finishPreparedWorldEntry()
            } catch {
                generation += 1;reveal(.hub);showFault(error)
            }
        case .gameplay:launch(boardID:homeJourneyTutorial ? 1 : nil);homeJourneyTutorial=false
        }
    }
    private func prepareWorldEntry(id:Int,owner:Int)throws {
        let snapshot=try services.worldSnapshot(id,view.bounds.size,owner+1)
        if let current=world,current.snapshot.worldID==id {current.park();current.reconcile(snapshot)}
        else {
            world?.cleanup();world?.removeFromSuperview()
            guard let created=JimiNativeWorldView(snapshot:snapshot,assets:artwork) else{throw NativeAppError.invalidWorld}
            created.frame=view.bounds;created.autoresizingMask=[.flexibleWidth,.flexibleHeight]
            view.addSubview(created);world=created
        }
        guard let incoming=world else{throw NativeAppError.invalidWorld}
        incoming.isHidden=true;incoming.setActive(false);configureWorld(incoming,id:id)
        incoming.setBackpackUnread(!services.journeyProgression().unreadJourneyDice.isEmpty)
        let lease=WorldEntryPreparation(generation:owner,id:id,world:incoming);worldEntryPreparation=lease
        services.prepareWorldEntry(incoming){[weak self,weak lease] in
            guard let self,let lease,!self.disposed,!self.suspended,self.generation==lease.generation,
                  self.worldEntryPreparation === lease,self.world === lease.world else{return}
            lease.ready=true;self.finishPreparedWorldEntry()
        }
    }
    private func finishPreparedWorldEntry(){
        guard let lease=worldEntryPreparation,lease.ready,!disposed,!suspended,
              generation==lease.generation,route == .world(lease.id),world === lease.world else{return}
        worldEntryPreparation=nil
        let incoming=lease.world;incoming.isHidden=false
        incoming.enter{[weak self,weak incoming] in
            guard let self,let incoming,!self.disposed,self.generation==lease.generation,
                  self.route == .world(lease.id),self.world === incoming else{return}
            guard !self.suspended else{self.deferredReveal=self.route;return}
            incoming.finishPresentationAdmission();self.transitioning=false
        }
    }
    private func cancelWorldEntryPreparation(){
        guard let lease=worldEntryPreparation else{return};worldEntryPreparation=nil
        lease.world.cancelPendingPreparation()
    }
    private func worldAction(_ action:String,boardID:Int?) {
        if action == "back",case .world = route {navigate(.hub,interrupt:true);return}
        guard !transitioning,case .world = route else{return}
        switch action {
        case "back":navigate(.hub,interrupt:true)
        case "backpack":navigate(.backpack)
        case "openCard":
            guard let boardID,let world else{return}
            do {
                try services.markViewed(boardID)
                // Clone the visible NEW face before adopting the durable viewed projection.
                // The modal owns its ribbon until return; the retained World must not replay it.
                let updated=try services.worldSnapshot(world.snapshot.worldID,view.bounds.size,generation+1)
                world.openCard(boardID:boardID)
                world.reconcile(updated)
            } catch {showFault(error)}
        case "close":world?.closeCard()
        case "play","continue":
            guard let boardID else{return};transitioning = true
            prepareGameplayLaunch(boardID:boardID,exit:{[weak self] completion in
                self?.world?.prepareGameplayExit(boardID:boardID,completion:completion)
            })
        default:break
        }
    }
    func cancelGameplayLaunchPreparation(){
        gameplayLaunchPreparation=nil;services.cancelGameplayEntry()
    }
    private func prepareGameplayLaunch(boardID:Int?,exit:((@escaping()->Void)->Void)?=nil){
        cancelGameplayLaunchPreparation()
        let lease=GameplayLaunchPreparation(board:boardID,generation:generation)
        gameplayLaunchPreparation=lease
        services.prepareGameplayEntry(boardID){[weak self,weak lease] ready in
            guard let self,let lease,!self.disposed,!self.suspended,self.generation==lease.generation,
                  self.gameplayLaunchPreparation === lease else{return}
            guard ready else{
                self.cancelGameplayLaunchPreparation();self.generation+=1
                self.reveal(boardID.map{.world(($0-1)/10+1)} ?? .arcadeHub)
                self.showFault(NativeAppError.resources("The stage artwork could not be prepared."));return
            }
            lease.ready=true;self.commitGameplayLaunch(lease)
        }
        guard gameplayLaunchPreparation === lease else{return}
        if let exit {exit{[weak self,weak lease] in
            guard let self,let lease,self.gameplayLaunchPreparation === lease else{return}
            lease.exitFinished=true;self.commitGameplayLaunch(lease)
        }}else{lease.exitFinished=true;commitGameplayLaunch(lease)}
    }
    private func commitGameplayLaunch(_ lease:GameplayLaunchPreparation){
        guard !disposed,!suspended,generation==lease.generation,gameplayLaunchPreparation === lease,
              lease.ready,lease.exitFinished else{return}
        gameplayLaunchPreparation=nil;mountPreparedGameplay(boardID:lease.board)
    }
    func admitsDeveloperAction(epoch: Int) -> Bool {
        !disposed && !suspended && !transitioning && route == .settings &&
            settingsView.developerPanelVisible && settingsView.presentationEpoch == epoch
    }
    /// Only the isolated Developer host calls this, after its Home mount.
    func launchDeveloperBoard(_ board: Int) {
        guard !disposed, !suspended, route == .home else { return }
        motion.cancel(); home.stopHeroIdle(preservePaintedPose: false)
        generation += 1; transitioning = false
        launch(boardID: board)
    }
    private func launch(boardID:Int?) {
        prepareGameplayLaunch(boardID:boardID)
    }
    private func mountPreparedGameplay(boardID:Int?) {
        cancelGameplayReturnPreparation()
        do {
            returnRoute = boardID.map { .world(($0-1)/10+1) } ?? .arcadeHub
            let controller = try services.makeGameplay(boardID) { [weak self] in self?.returnFromGameplay() }
            let outgoing=boardID != nil && world?.isHidden==false ? world:nil
            let owner=generation
            if let native=controller as? NativeGameplayViewController,let outgoing {
                native.retainOutgoingWorldUntilOriginalCover {[weak self,weak controller,weak outgoing] in
                    guard let self,let controller,let outgoing,!self.disposed,self.generation==owner,
                          self.gameplay === controller,self.route == .gameplay,self.world === outgoing else{return}
                    outgoing.park();outgoing.isHidden=true
                }
            }
            addChild(controller);controller.view.frame = view.bounds;controller.view.autoresizingMask = [.flexibleWidth,.flexibleHeight]
            view.addSubview(controller.view);controller.didMove(toParent:self);gameplay = controller
            home.isHidden = true;hub.isHidden = true;arcadeHub.hide();settingsView.isHidden = true
            if outgoing==nil || !(controller is NativeGameplayViewController) {world?.park();world?.isHidden = true}
            route = .gameplay;transitioning = false;onRoute?(.gameplay)
        } catch {
            services.cancelGameplayEntry()
            generation += 1;reveal(returnRoute);showFault(error)
        }
    }
    private func returnFromGameplay() {
        do {try services.flush()} catch {showFault(error);return}
        let prepared=hasPreparedGameplayReturn ? returnPreparation:nil
        if prepared == nil {cancelGameplayReturnPreparation()}else{returnPreparation=nil;returnPreparationEpoch += 1}
        retireCoveredGameplay()
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
    private var pendingGameplayReplacement:NativeGameplayViewController?
    private func retireCoveredGameplay() {
        guard let covered=pendingGameplayReplacement else{return}
        pendingGameplayReplacement=nil
        covered.dispose();covered.willMove(toParent:nil)
        covered.view.removeFromSuperview();covered.removeFromParent()
    }
    func canReplaceGameplay(_ expected:NativeGameplayViewController)->Bool {
        !disposed && pendingGameplayReplacement==nil && route == .gameplay && !transitioning && gameplay === expected && expected.parent === self
    }
    /// New board generation keeps the current route/return destination. Source
    /// composition belongs to the replacement VC; old captured roots retire.
    @discardableResult func replaceGameplay(_ expected:NativeGameplayViewController,
                                           with incoming:NativeGameplayViewController)->Bool {
        guard canReplaceGameplay(expected),incoming !== expected,incoming.parent==nil else{return false}
        cancelGameplayReturnPreparation();generation += 1
        gameplay=incoming
        addChild(incoming);incoming.view.frame=view.bounds
        incoming.view.autoresizingMask=[.flexibleWidth,.flexibleHeight]
        if !incoming.waitsForFirstFrameOnReplacement {
            view.addSubview(incoming.view);incoming.didMove(toParent:self);incoming.setSuspended(suspended)
            expected.dispose();expected.willMove(toParent:nil)
            expected.view.removeFromSuperview();expected.removeFromParent()
            return true
        }
        // Keep the previous painted board as coverage until the incoming
        // Scene has delivered its existing two-frame readiness receipt.
        pendingGameplayReplacement=expected
        expected.view.isUserInteractionEnabled=false;expected.setSuspended(true)
        view.insertSubview(incoming.view,belowSubview:expected.view);incoming.didMove(toParent:self)
        incoming.setSuspended(suspended)
        incoming.whenFirstBoardFrameReady { [weak self,weak incoming,weak expected] in
            guard let self,let incoming,let expected,!self.disposed,
                  self.gameplay === incoming,self.pendingGameplayReplacement === expected else{return}
            self.retireCoveredGameplay()
        }
        return true
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
        incoming.onFeedback = {[weak self] kind,boardID,_ in
            // The route's accepted navigation owns the World header Back cue.
            // Card-local close events still belong to the card presentation.
            guard kind != "back" || boardID != nil else{return}
            self?.onFeedback?(kind)
        }
        incoming.onResourceFailure = {[weak self] reason in self?.showFault(NativeAppError.resources(reason))}
        incoming.onShipVisibility = {[weak self,weak incoming] visible in
            guard let self,let incoming,self.world === incoming else{return}
            self.onShipVisibility?(visible && self.route == .world(3) && !self.suspended)
        }
        incoming.onAmbientPlansRequest = {[weak self] viewport,ids,completion in completion(self?.services.ambient(id,viewport,ids))}
        incoming.onBeePlansRequest = {[weak self] ids,completion in completion(self?.services.bees(ids))}
    }
    func returnTutorialToHome(onPrepared:@escaping ()->Void) {
        home.selectSlide(0,animated:false);returnRoute = .home;beforeHomeReveal=onPrepared
        returnFromGameplay()
    }
    private func openBackpackDetail(_ die:NativeBackpackCatalog.Die) {
        guard !disposed,!suspended,!transitioning,route == .backpack,backpackDetail == nil,presentedViewController == nil else{return}
        onFeedback?("tab")
        let detail=NativeBackpackDetail(die:die,assets:JimiV9Artwork(resourceRoot:resourceRoot),motion:NativeRouteMotion(home:home,hub:hub))
        pendingBackpackDie=nil;backpackDetail=detail;backpackView?.isUserInteractionEnabled=false;backpackView?.setAlertsActive(false)
        detail.onPresentationStarted={[weak self,weak detail] in
            guard let self,let detail,self.backpackDetail === detail,!self.disposed,!self.suspended else{return}
            self.onFeedback?("exit-modal")
            if self.services.readJourneyDie(die.id){self.backpackView?.markRead(die.id)}
        }
        detail.onCloseRequested={[weak self] in self?.onFeedback?("back")}
        detail.onExitSelection={[weak self,weak detail] point in
            guard let self,let detail,self.backpackDetail === detail,self.route == .backpack,!self.transitioning,!self.suspended,!self.disposed else{return}
            if let die=self.backpackView?.revealedDie(atWindowPoint:point){self.pendingBackpackDie=die}
        }
        detail.onClose={[weak self,weak detail] in
            guard let self,let detail,self.backpackDetail === detail else{return}
            self.backpackDetail=nil
            self.backpackView?.setAlertsActive(self.route == .backpack && !self.suspended && !self.transitioning)
            let next=self.pendingBackpackDie;self.pendingBackpackDie=nil
            self.backpackView?.isUserInteractionEnabled = self.route == .backpack && !self.transitioning && !self.suspended
            if let next {self.openBackpackDetail(next)}
        }
        present(detail,animated:false)
    }
    private func retireBackpackDetail(){pendingBackpackDie=nil;backpackDetail?.dispose();backpackDetail?.dismiss(animated:false);backpackDetail=nil}
    private func showFault(_ error:Error) {fault.text = error.localizedDescription;fault.isHidden = false;view.bringSubviewToFront(fault)}
    private func suspend() {
        suspended = true;backpackView?.setAlertsActive(false);pendingBackpackDie=nil;motion.suspend();backpackView?.isUserInteractionEnabled=false;backpackDetail?.setForeground(false)
        if let launch=gameplayLaunchPreparation {
            deferredReveal=launch.board.map{.world(($0-1)/10+1)} ?? .arcadeHub
            generation+=1;transitioning=false
        }
        cancelGameplayLaunchPreparation()
        if let lease=worldEntryPreparation,route == .world(lease.id) {deferredReveal=route}
        cancelWorldEntryPreparation()
        cancelGameplayReturnPreparation()
        backpack?.setActive(false,generation:generation)
        home.pauseHeroIdle();hub.stopIdle();arcadeHub.suspend();world?.setActive(false)
        do {try services.flush()} catch {showFault(error)}
    }
    private func resume() {
        suspended = false;backpackView?.setAlertsActive(route == .backpack && backpackDetail == nil && !transitioning);motion.resume();backpackDetail?.setForeground(true)
        if route == .backpack {backpackView?.isUserInteractionEnabled = !transitioning && backpackDetail == nil}
        if let next = deferredReveal {deferredReveal = nil;reveal(next);return}
        guard !transitioning else{return}
        if route == .home {home.startHeroIdle()}
        if route == .hub {hub.startIdle()}
        if route == .arcadeHub {arcadeHub.resume()}
        backpack?.setActive(route == .hub,generation:generation)
        if case .world = route {world?.setActive(true)}
    }
    private func retireDeveloperPresentation() {
        if let preview = presentedViewController as? NativeDeveloperPreviewHost { preview.finish() }
        else if let preview = presentedViewController as? NativeDeveloperGameplayHost { preview.finish() }
        else if let picker = presentedViewController as? NativeDeveloperPicker { picker.dispose() }
    }
    func dispose() {
        guard !disposed else{return}
        studioIntro?.dispose();studioIntro=nil
        disposed=true;backpackView?.setAlertsActive(false);retireDeveloperPresentation();cancelGameplayReturnPreparation()
        cancelGameplayLaunchPreparation()
        cancelWorldEntryPreparation()
        generation += 1;transitioning = true;suspended = true;deferredReveal = nil
        arcadeHub?.hide();arcadeHub?.onClose=nil;arcadeHub?.onPlay=nil;arcadeHub?.onPlayExit=nil;arcadeHub?.onCrate=nil;arcadeHub?.canContinue=nil
        motion?.cancel();home?.stopHeroIdle(preservePaintedPose:false);hub?.stopIdle()
        retireBackpackDetail();backpackView?.onClose=nil;backpackView?.onDie=nil;backpackView?.removeFromSuperview();backpackView=nil
        backpack?.dispose();backpack=nil;hub?.onBackpack=nil
        world?.cleanup();world?.removeFromSuperview();world = nil
        retireCoveredGameplay()
        (gameplay as? NativeGameplayViewController)?.dispose()
        gameplay?.willMove(toParent:nil);gameplay?.view.removeFromSuperview();gameplay?.removeFromParent();gameplay = nil
        for observer in observers {NotificationCenter.default.removeObserver(observer)};observers.removeAll()
        onFeedback = nil;onRoute = nil;onShipVisibility=nil
        beforeHomeReveal=nil
    }
    deinit {for observer in observers {NotificationCenter.default.removeObserver(observer)}}
}
private enum NativeAppError:LocalizedError {
    case invalidWorld, resources(String)
    var errorDescription:String? {switch self {case .invalidWorld:return "Native World data is unavailable";case .resources(let detail):return detail}}
}
