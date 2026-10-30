import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

/// Development-only snapshot exporter. Copied into the QA target only during capture.
@MainActor final class NativeTypographyCaptureTests:XCTestCase {
    let root=NativeTestResources.root
    let output=URL(fileURLWithPath:"/tmp/native-typography-library")
    var scenes=[[String:Any]]()
    var window:UIWindow!
    var host:UIViewController!
    var art:JimiV9Artwork!
    var sceneForCapture:SKScene?
    func wait(_ seconds:Double=0.8) async throws {try await Task.sleep(for:.seconds(seconds))}
    func reset() {
        host=UIViewController();window.rootViewController=host;window.makeKeyAndVisible()
        host.view.frame=CGRect(x:0,y:0,width:390,height:844)
        let paper=NativeAppPaperSurface(artwork:art);paper.frame=host.view.bounds;host.view.addSubview(paper)
    }
    func mount(_ view:UIView) {view.frame=host.view.bounds;host.view.addSubview(view);view.setNeedsLayout();view.layoutIfNeeded()}
    func mountController(_ controller:UIViewController) {
        host.addChild(controller);controller.view.frame=host.view.bounds;host.view.addSubview(controller.view)
        controller.didMove(toParent:host);controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        controller.beginAppearanceTransition(true,animated:false);controller.endAppearanceTransition()
    }
    func hex(_ color:UIColor?)->String {
        guard let color else{return "unknown"}
        var r:CGFloat=0,g:CGFloat=0,b:CGFloat=0,a:CGFloat=0
        guard color.getRed(&r,green:&g,blue:&b,alpha:&a) else{return "gradient / pattern"}
        return String(format:"#%02X%02X%02X",Int(round(r*255)),Int(round(g*255)),Int(round(b*255)))
    }
    func capture(_ id:String,_ name:String,_ category:String,_ route:String,_ source:String) throws {
        host.view.layoutIfNeeded();CATransaction.flush()
        let format=UIGraphicsImageRendererFormat();format.scale=3
        let image=UIGraphicsImageRenderer(size:host.view.bounds.size,format:format).image{_ in host.view.drawHierarchy(in:host.view.bounds,afterScreenUpdates:true)}
        try image.pngData()!.write(to:output.appendingPathComponent(id+".png"))
        var texts=[[String:Any]]()
        func rect(_ r:CGRect)->[String:Double] {["x":Double(r.minX),"y":Double(r.minY),"width":Double(r.width),"height":Double(r.height)]}
        func walk(_ view:UIView,_ opacity:CGFloat,_ path:String) {
            let effective=opacity*CGFloat(view.layer.presentation()?.opacity ?? view.layer.opacity)
            guard !view.isHidden,effective>0.03 else{return}
            if let label=view as? UILabel,let text=label.text ?? label.attributedText?.string,!text.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty {
                let identifier=label.accessibilityIdentifier ?? ""
                if !identifier.contains("title-outline") && !identifier.contains("title-inner-outline") {
                    let box=label.convert(label.bounds,to:host.view)
                    if box.width>1,box.height>1,box.intersects(host.view.bounds),box.minY<844,box.maxY>0 {
                        var font=label.font!,color=label.textColor
                        var runs=[[String:Any]]()
                        label.attributedText?.enumerateAttributes(in:NSRange(location:0,length:label.attributedText?.length ?? 0)){attrs,range,_ in
                            let f=attrs[.font] as? UIFont ?? label.font!
                            let c=attrs[.foregroundColor] as? UIColor ?? label.textColor
                            runs.append(["text":(label.attributedText!.string as NSString).substring(with:range),"font":f.fontName,"size":f.pointSize,"color":hex(c)])
                            if range.location==0 {font=f;color=c}
                        }
                        var parent:UIView?=label.superview,button:UIButton?
                        while let current=parent {if let b=current as? UIButton {button=b;break};parent=current.superview}
                        let rowID=id+"-text-"+String(texts.count+1)
                        var item:[String:Any] = ["id":rowID,"text":String(text.prefix(1500)),"font":font.fontName,"size":font.pointSize,"color":hex(color),"rect":rect(box),"identifier":identifier,"path":path,"opacity":effective,"runs":runs,"lineCount":label.numberOfLines,"alignment":label.textAlignment.rawValue]
                        if let button {
                            item["button"]=["identifier":button.accessibilityIdentifier ?? "","size":["width":Double(button.bounds.width),"height":Double(button.bounds.height)],"rect":rect(button.convert(button.bounds,to:host.view)),"enabled":button.isEnabled,"kind":button.subviews.contains{$0.accessibilityIdentifier=="native.cta.sculpted-face"} ? "CTA":"Control"]
                        }
                        texts.append(item)
                    }
                }
            }
            if let sk=view as? SKView,let scene=sk.scene {
                func nodes(_ node:SKNode,_ alpha:CGFloat) {
                    guard !node.isHidden,alpha*node.alpha>0.03 else{return}
                    if let label=node as? SKLabelNode,let text=label.text,!text.isEmpty,let parent=label.parent {
                        let f=label.frame,p1=scene.convertPoint(toView:parent.convert(CGPoint(x:f.minX,y:f.minY),to:scene)),p2=scene.convertPoint(toView:parent.convert(CGPoint(x:f.maxX,y:f.maxY),to:scene))
                        let box=sk.convert(CGRect(x:min(p1.x,p2.x),y:min(p1.y,p2.y),width:abs(p1.x-p2.x),height:abs(p1.y-p2.y)),to:host.view)
                        if box.width>1,box.height>1,box.intersects(host.view.bounds) {
                            texts.append(["id":id+"-text-"+String(texts.count+1),"text":text,"font":label.fontName ?? "system","size":label.fontSize,"color":hex(label.fontColor),"rect":rect(box),"identifier":label.name ?? "","path":path+"/SpriteKit/"+(label.name ?? "SKLabelNode"),"opacity":effective*alpha*node.alpha,"runs":[],"lineCount":1,"alignment":1,"sourceHint":"native/gameplay-ui/NativeBoardScene.swift"])
                        }
                    }
                    for child in node.children {nodes(child,alpha*node.alpha)}
                }
                nodes(scene,1)
            }
            for (index,child) in view.subviews.enumerated() {walk(child,effective,path+"/"+String(describing:type(of:child))+"[\(index)]")}
        }
        walk(host.view,1,"root")
        if let scene=sceneForCapture {
            func nodes(_ node:SKNode,_ alpha:CGFloat) {
                guard !node.isHidden,alpha*node.alpha>0.03 else{return}
                if let label=node as? SKLabelNode,let text=label.text,!text.isEmpty,let parent=label.parent {
                    let f=label.frame,p1=parent.convert(CGPoint(x:f.minX,y:f.minY),to:scene),p2=parent.convert(CGPoint(x:f.maxX,y:f.maxY),to:scene)
                    let sx=390/max(1,scene.size.width),sy=844/max(1,scene.size.height)
                    let box=CGRect(x:min(p1.x,p2.x)*sx,y:(scene.size.height-max(p1.y,p2.y))*sy,width:abs(p1.x-p2.x)*sx,height:abs(p1.y-p2.y)*sy)
                    if box.width>1,box.height>1,box.intersects(host.view.bounds) {
                        texts.append(["id":id+"-text-"+String(texts.count+1),"text":text,"font":label.fontName ?? "system","size":label.fontSize,"color":hex(label.fontColor),"rect":rect(box),"identifier":label.name ?? "","path":"NativeBoardScene/"+(label.name ?? "SKLabelNode"),"opacity":alpha*node.alpha,"runs":[],"lineCount":1,"alignment":1,"sourceHint":"native/gameplay-ui/NativeBoardScene.swift"])
                    }
                }
                for child in node.children {nodes(child,alpha*node.alpha)}
            }
            nodes(scene,1)
        }
        scenes.append(["id":id,"name":name,"category":category,"route":route,"source":source,"screenshot":id+".png","width":390,"height":844,"texts":texts])
        try JSONSerialization.data(withJSONObject:scenes,options:[.prettyPrinted,.sortedKeys]).write(to:output.appendingPathComponent("scenes.json"))
        print("[TYPOGRAPHY] \(id) labels=\(texts.count)")
    }
    func motion()->NativeRouteMotion {NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:art),hub:JimiV9HubView(frame:.zero,assets:art))}
    func waitForCoach(_ view:UIView) async throws {
        func find(_ v:UIView)->UILabel? {if let l=v as? UILabel,l.text=="TAP TO COLLECT" {return l};return v.subviews.lazy.compactMap{find($0)}.first}
        let deadline=Date().addingTimeInterval(8)
        while Date()<deadline {
            if let label=find(view),(label.layer.presentation()?.opacity ?? label.layer.opacity)>0.6 {return}
            try await wait(0.05)
        }
    }
    func testCaptureContextualOnboarding() async throws {
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));art=JimiV9Artwork(resourceRoot:root)
        let url=output.appendingPathComponent("scenes.json")
        scenes=(try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as? [[String:Any]]) ?? []
        scenes.removeAll{["tutorial-encouragement","tutorial-completed"].contains($0["id"] as? String ?? "")}
        defer{window.isHidden=true;previous?.makeKeyAndVisible()}
        reset();let encouragement=NativeTutorialOverlay(resourceRoot:root);mount(encouragement)
        encouragement.show(step:5,from:nil,to:nil,initial:true);try await wait(0.8)
        try capture("tutorial-encouragement","Great merge · tutorial follow-up","Tutorial","First play → Special merge animation completes","native/gameplay-app/NativeTutorialOverlay.swift")
        encouragement.dispose()
        reset();let complete=NativeTutorialCompleteController(resourceRoot:root);mountController(complete);try await wait(1)
        try capture("tutorial-completed","Tutorial completed · Arcade","Tutorial","Arcade first play → tutorial cleared → Continue → real round 01","native/gameplay-tutorial-complete/NativeTutorialCompleteController.swift")
        complete.dispose()
    }
    func testCaptureSubtitleStandard() async throws {
        try await testCaptureTypographyLibrary()
        try await testCaptureTypographyLibrarySupplement()
        try await testCaptureAllDiceDetails()
        let rows=scenes.flatMap{($0["texts"] as? [[String:Any]]) ?? []}
        XCTAssertFalse(rows.contains{($0["size"] as? NSNumber)?.doubleValue==20},"Captured body/subtitle styles no longer use20")
        XCTAssertEqual(scenes.filter{($0["category"] as? String)=="Backpack · Kockice details"}.count,22)
    }
    func testCaptureAllDiceDetails() async throws {
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"]=="1018BE2D-491B-465F-8F75-3E5BEB38C22A" else{throw XCTSkip("Retained QA Simulator only")}
        scenes=try JSONSerialization.jsonObject(with:Data(contentsOf:output.appendingPathComponent("scenes.json"))) as! [[String:Any]]
        scenes.removeAll{($0["id"] as? String ?? "").hasPrefix("dice-detail")}
        window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        defer{window.isHidden=true;window.rootViewController=nil}
        let groups=[("Forest",NativeBackpackCatalog.forest),("Beach",NativeBackpackCatalog.beach),("Area 55",NativeBackpackCatalog.area),("Arcade",NativeBackpackCatalog.arcade)]
        var count=0
        for (group,dice) in groups {
            for die in dice {
                art=JimiV9Artwork(resourceRoot:root);reset()
                let detail=NativeBackpackDetail(die:die,assets:art,motion:motion());detail.entersImmediately=true
                var started=false;detail.onPresentationStarted={started=true}
                mountController(detail);detail.beginImmediatePresentation()
                let deadline=Date().addingTimeInterval(15)
                while !started && Date()<deadline {try await wait(0.05)}
                XCTAssertTrue(started,"Actual artwork readiness for \(die.id)")
                try await wait(1.1)
                let id=die.id=="bee" ? "dice-detail":"dice-detail-"+die.id
                try capture(id,group+" · "+die.title,"Backpack · Kockice details",(group=="Arcade" ? "Home → Arcade → Crate → ":"Home → Backpack → "+group+" → ")+die.title,"native/gameplay-collection/NativeBackpackDetail.swift")
                XCTAssertEqual((scenes.last?["texts"] as? [[String:Any]])?.count,2,"Title and description for \(die.id)")
                detail.dispose();count += 1
            }
        }
        XCTAssertEqual(count,22)
    }
    func testCaptureSettingsTitleColor() async throws {
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"]=="1018BE2D-491B-465F-8F75-3E5BEB38C22A" else{throw XCTSkip("Retained QA Simulator only")}
        scenes=try JSONSerialization.jsonObject(with:Data(contentsOf:output.appendingPathComponent("scenes.json"))) as! [[String:Any]]
        scenes.removeAll{($0["id"] as? String)=="settings"}
        art=JimiV9Artwork(resourceRoot:root);window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        defer{window.isHidden=true;window.rootViewController=nil}
        reset();let settings=JimiNativeSettingsView(frame:host.view.bounds,assets:art);mount(settings);try await wait(0.2)
        try capture("settings","Settings navigation and rows","Navigation","Home → Settings","native/jimi-2026/JimiNativeSettingsView.swift")
        let title=try XCTUnwrap((scenes.last?["texts"] as? [[String:Any]])?.first)
        XCTAssertEqual(title["text"] as? String,"Settings");XCTAssertEqual(title["color"] as? String,"#BE7C59")
    }
    func testCaptureStageTypography() async throws {
        try await testCaptureNavigationTitles()
        scenes.removeAll{["stage-play","stage-continue"].contains($0["id"] as? String ?? "")}
        // The shared navigation capture retires its window; restore this test's host.
        art=JimiV9Artwork(resourceRoot:root);window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        defer{window.isHidden=true;window.rootViewController=nil}
        var progress=NativeProgressionState();progress.completedJourneyBoards=Set(1...30)
        for continuing in [false,true] {
            reset();var raw=try NativeWorldLayouts().snapshot(world:1,width:390,height:844,generation:1,progression:progress)
            var units=raw["units"] as! [[String:Any]];units[6]["allowedActions"]=["openCard",continuing ? "continue":"play"];raw["units"]=units
            let snap=try XCTUnwrap(JimiNativeWorldSnapshot(raw));let unit=try XCTUnwrap(snap.units.first{$0.boardID==7})
            let resources=JimiNativeWorldResources(root:root);let card=JimiNativeWorldCardView(unit:unit,assets:art,resources:resources)
            mount(card);card.enter(from:CGRect(x:30,y:400,width:90,height:133));card.setNeedsLayout();card.layoutIfNeeded();try await wait(1.1)
            try capture(continuing ? "stage-continue":"stage-play",continuing ? "Stage · Continue CTA":"Stage · Play CTA","CTA","Journey → Forest → Unit 07 → stats back","native/jimi-2026/JimiNativeWorldCardView.swift");card.cleanup()
        }

        var values=0,labels=0
        for scene in scenes where ["stage-play","stage-continue","stage-forest","stage-beach","stage-area55"].contains(scene["id"] as? String ?? "") {
            for t in (scene["texts"] as? [[String:Any]]) ?? [] {
                let text=t["text"] as? String ?? ""
                if text.hasPrefix("Stage ") || text=="0" {XCTAssertEqual((t["size"] as? NSNumber)?.doubleValue,text=="0" ? 34:28);values += 1}
                if ["High score","Best combo"].contains(text) {XCTAssertEqual((t["size"] as? NSNumber)?.doubleValue,18);labels += 1}
            }
        }
        XCTAssertEqual(values,15);XCTAssertEqual(labels,10)
    }
    func testCaptureFont19To18() async throws {
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"]=="1018BE2D-491B-465F-8F75-3E5BEB38C22A" else{throw XCTSkip("Retained QA Simulator only")}
        scenes=try JSONSerialization.jsonObject(with:Data(contentsOf:output.appendingPathComponent("scenes.json"))) as! [[String:Any]]
        scenes.removeAll{let id=$0["id"] as? String ?? "";return id=="nav-journey" || id.hasPrefix("arcade-mode-")}
        art=JimiV9Artwork(resourceRoot:root);window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        defer{window.isHidden=true;window.rootViewController=nil}
        reset();let hub=JimiV9HubView(frame:host.view.bounds,assets:art,arcade:false);mount(hub);hub.updateProgress([["worldId":1,"completed":7,"total":10],["worldId":2,"completed":4,"total":10],["worldId":3,"completed":2,"total":10]])
        try await wait(0.2);try capture("nav-journey","Journey navigation","Navigation","Home → Journey","native/jimi-2026/JimiV9HubView.swift");hub.stopIdle()
        for index in 0...2 {
            reset();let modal=NativeArcadeWorldModal(frame:host.view.bounds,assets:art,index:index);mount(modal);modal.reveal();try await wait(0.9)
            try capture("arcade-mode-\(index)",["Endurance","One Lucky Drop","Slow Burn"][index],"Modal","Home → Arcade → mode card","native/gameplay-app/NativeArcadeHubView.swift");modal.dispose()
        }
        let rows=scenes.flatMap{($0["texts"] as? [[String:Any]]) ?? []}
        XCTAssertFalse(rows.contains{($0["size"] as? NSNumber)?.doubleValue==19})
        XCTAssertEqual(rows.filter{let text=$0["text"] as? String ?? "";return ["7 / 10","2 / 10","4 / 10","Clear rounds and keep going until you run out of moves.","Get one lucky Special die\nto help you per round.","Special dice take longer to drop onto your board."].contains(text) && ($0["size"] as? NSNumber)?.doubleValue==18}.count,6)
    }
    func testCaptureNavigationTitles() async throws {
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"]=="1018BE2D-491B-465F-8F75-3E5BEB38C22A" else{throw XCTSkip("Retained QA Simulator only")}
        scenes=try JSONSerialization.jsonObject(with:Data(contentsOf:output.appendingPathComponent("scenes.json"))) as! [[String:Any]]
        scenes.removeAll{let id=$0["id"] as? String ?? "";return id.hasPrefix("nav-") || ["stage-forest","stage-beach","stage-area55","settings","backpack"].contains(id)}
        art=JimiV9Artwork(resourceRoot:root);window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        defer{window.isHidden=true;window.rootViewController=nil}
        var progress=NativeProgressionState();progress.completedJourneyBoards=Set(1...30)
        for arcade in [false,true] {
            reset();let hub=JimiV9HubView(frame:host.view.bounds,assets:art,arcade:arcade);mount(hub);hub.updateProgress([["worldId":1,"completed":7,"total":10],["worldId":2,"completed":4,"total":10],["worldId":3,"completed":2,"total":10]])
            try await wait(0.2);try capture(arcade ? "nav-arcade":"nav-journey",arcade ? "Arcade navigation":"Journey navigation","Navigation",arcade ? "Home → Arcade":"Home → Journey","native/jimi-2026/JimiV9HubView.swift");hub.stopIdle()
        }
        for worldID in 1...3 {
            reset();let raw=try NativeWorldLayouts().snapshot(world:worldID,width:390,height:844,generation:1,progression:progress)
            let snap=try XCTUnwrap(JimiNativeWorldSnapshot(raw));let world=try XCTUnwrap(JimiNativeWorldView(snapshot:raw,assets:art));mount(world)
            await withCheckedContinuation{continuation in world.prepare{continuation.resume()}}
            await withCheckedContinuation{continuation in world.enter{continuation.resume()}};world.finishPresentationAdmission();try await wait(0.3)
            let slug=["forest","beach","area55"][worldID-1]
            try capture("nav-"+slug,snap.title+" navigation","Navigation","Home → Journey → "+snap.title,"native/jimi-2026/JimiNativeWorldView.swift")
            world.openCard(boardID:(worldID-1)*10+7);try await wait(1.5)
            try capture("stage-"+slug,"Stage 07 · "+snap.title,"Modal","Journey → "+snap.title+" → Unit 07 → stats back","native/jimi-2026/JimiNativeWorldCardView.swift")
            world.cleanup()
        }
        reset();let settings=JimiNativeSettingsView(frame:host.view.bounds,assets:art);mount(settings);try await wait(0.2)
        try capture("settings","Settings navigation and rows","Navigation","Home → Settings","native/jimi-2026/JimiNativeSettingsView.swift")
        reset();let backpack=NativeBackpackView(frame:host.view.bounds,assets:art);mount(backpack);backpack.apply([NativeBackpackCatalog.Section(title:"Forest",dice:NativeBackpackCatalog.forest,unlocked:Set(NativeBackpackCatalog.forest.map(\.id)))]);try await wait(0.3)
        try capture("backpack","Backpack navigation and section","Navigation","Home → Backpack","native/gameplay-collection/NativeBackpackView.swift")

        let names=["Journey","Arcade","Forest","Beach","Area 55","Settings","Backpack"]
        var count=0
        for scene in scenes where (scene["category"] as? String)=="Navigation" || ["stage-forest","stage-beach","stage-area55"].contains(scene["id"] as? String ?? "") {
            for text in (scene["texts"] as? [[String:Any]]) ?? [] where names.contains(text["text"] as? String ?? "") {
                XCTAssertEqual((text["size"] as? NSNumber)?.doubleValue,28);count += 1
            }
        }
        XCTAssertEqual(count,11)
    }
    func testCaptureArcadeTitles() async throws {
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"]=="1018BE2D-491B-465F-8F75-3E5BEB38C22A" else{throw XCTSkip("Retained QA Simulator only")}
        scenes=try JSONSerialization.jsonObject(with:Data(contentsOf:output.appendingPathComponent("scenes.json"))) as! [[String:Any]]
        scenes.removeAll{($0["id"] as? String ?? "").hasPrefix("arcade-mode-")}
        art=JimiV9Artwork(resourceRoot:root);window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        defer{window.isHidden=true;window.rootViewController=nil}
        for index in 0...2 {
            reset();let modal=NativeArcadeWorldModal(frame:host.view.bounds,assets:art,index:index);mount(modal);modal.reveal();try await wait(0.9)
            try capture("arcade-mode-\(index)",["Endurance","One Lucky Drop","Slow Burn"][index],"Modal","Home → Arcade → mode card","native/gameplay-app/NativeArcadeHubView.swift");modal.dispose()
            let heading=try XCTUnwrap((scenes.last?["texts"] as? [[String:Any]])?.first)
            XCTAssertEqual(heading["size"] as? CGFloat,28)
            XCTAssertEqual(heading["font"] as? String,"Baloo2-ExtraBold")
        }
    }
    func testCaptureTypographyLibrarySupplement() async throws {
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"]=="1018BE2D-491B-465F-8F75-3E5BEB38C22A" else{throw XCTSkip("Retained QA Simulator only")}
        scenes=try JSONSerialization.jsonObject(with:Data(contentsOf:output.appendingPathComponent("scenes.json"))) as! [[String:Any]]
        scenes.removeAll{["reward-common","reward-legendary","gameplay-hud"].contains($0["id"] as? String ?? "")}
        art=JimiV9Artwork(resourceRoot:root);window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        defer{window.isHidden=true;window.rootViewController=nil}
        for legendary in [false,true] {
            reset();let reward=NativeJourneyRewardController(root:root,board:1,score:legendary ? 90000:1500,generation:1,awardedStars:legendary ? 3:1,random:{0.4});mountController(reward);reward.start();try await wait(2.1)
            reward.activate();try await waitForCoach(reward.view)
            try capture(legendary ? "reward-legendary":"reward-common",legendary ? "Legendary! reward":"Common reward","Reward","New Reward → tap card → unlocked","native/gameplay-reward/NativeJourneyRewardController.swift");reward.dispose(notify:false)
        }
        reset();let gameplay=NativeGameplayViewController(engine:NativeGameplayEngine(state:NativeBoardState(tiles:[NativeTile(id:"library-1",cell:NativeCell(column:1,row:3),value:1),NativeTile(id:"library-2",cell:NativeCell(column:2,row:3),value:1)],mode:.journey,board:7,stage:7,score:42179)),resourceRoot:root);mountController(gameplay);try await wait(1)
        sceneForCapture=gameplay.boardScene
        try capture("gameplay-hud","Gameplay HUD","Gameplay","Journey → Stage 07 → Play","native/gameplay-ui/NativeBoardScene.swift");gameplay.dispose();sceneForCapture=nil
        XCTAssertTrue(scenes.allSatisfy{!(($0["texts"] as? [[String:Any]]) ?? []).isEmpty})
    }
    func testCaptureTypographyLibrary() async throws {
        guard ProcessInfo.processInfo.environment["SIMULATOR_UDID"]=="1018BE2D-491B-465F-8F75-3E5BEB38C22A" else{throw XCTSkip("Retained QA Simulator only")}
        try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
        art=JimiV9Artwork(resourceRoot:root)
        window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.windowScene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first
        defer{window.isHidden=true;window.rootViewController=nil}
        var progress=NativeProgressionState();progress.completedJourneyBoards=Set(1...30)
        // Home and the two destination hubs.
        reset();let home=JimiV9HomeView(frame:host.view.bounds,assets:art);mount(home);try await wait()
        try capture("home","Home · Journey CTA","CTA","Home","native/jimi-2026/JimiV9HomeView.swift")
        for arcade in [false,true] {
            reset();let hub=JimiV9HubView(frame:host.view.bounds,assets:art,arcade:arcade);mount(hub);hub.updateProgress([["worldId":1,"completed":7,"total":10],["worldId":2,"completed":4,"total":10],["worldId":3,"completed":2,"total":10]])
            try await wait(0.2);try capture(arcade ? "nav-arcade":"nav-journey",arcade ? "Arcade navigation":"Journey navigation","Navigation",arcade ? "Home → Arcade":"Home → Journey","native/jimi-2026/JimiV9HubView.swift");hub.stopIdle()
        }
        for worldID in 1...3 {
            reset();let raw=try NativeWorldLayouts().snapshot(world:worldID,width:390,height:844,generation:1,progression:progress)
            let snap=try XCTUnwrap(JimiNativeWorldSnapshot(raw));let world=try XCTUnwrap(JimiNativeWorldView(snapshot:raw,assets:art));mount(world)
            await withCheckedContinuation{continuation in world.prepare{continuation.resume()}}
            await withCheckedContinuation{continuation in world.enter{continuation.resume()}};world.finishPresentationAdmission();try await wait(0.3)
            let slug=["forest","beach","area55"][worldID-1]
            try capture("nav-"+slug,snap.title+" navigation","Navigation","Home → Journey → "+snap.title,"native/jimi-2026/JimiNativeWorldView.swift")
            world.openCard(boardID:(worldID-1)*10+7);try await wait(1.5)
            try capture("stage-"+slug,"Stage 07 · "+snap.title,"Modal","Journey → "+snap.title+" → Unit 07 → stats back","native/jimi-2026/JimiNativeWorldCardView.swift")
            world.cleanup()
        }
        reset();let settings=JimiNativeSettingsView(frame:host.view.bounds,assets:art);mount(settings);try await wait(0.2)
        try capture("settings","Settings navigation and rows","Navigation","Home → Settings","native/jimi-2026/JimiNativeSettingsView.swift")
        reset();let backpack=NativeBackpackView(frame:host.view.bounds,assets:art);mount(backpack);backpack.apply([NativeBackpackCatalog.Section(title:"Forest",dice:NativeBackpackCatalog.forest,unlocked:Set(NativeBackpackCatalog.forest.map(\.id)))]);try await wait(0.3)
        try capture("backpack","Backpack navigation and section","Navigation","Home → Backpack","native/gameplay-collection/NativeBackpackView.swift")
        for continuing in [false,true] {
            reset();var raw=try NativeWorldLayouts().snapshot(world:1,width:390,height:844,generation:1,progression:progress)
            var units=raw["units"] as! [[String:Any]];units[6]["allowedActions"]=["openCard",continuing ? "continue":"play"];raw["units"]=units
            let snap=try XCTUnwrap(JimiNativeWorldSnapshot(raw));let unit=try XCTUnwrap(snap.units.first{$0.boardID==7})
            let resources=JimiNativeWorldResources(root:root);let card=JimiNativeWorldCardView(unit:unit,assets:art,resources:resources)
            mount(card);card.enter(from:CGRect(x:30,y:400,width:90,height:133));card.setNeedsLayout();card.layoutIfNeeded();try await wait(1.1)
            try capture(continuing ? "stage-continue":"stage-play",continuing ? "Stage · Continue CTA":"Stage · Play CTA","CTA","Journey → Forest → Unit 07 → stats back","native/jimi-2026/JimiNativeWorldCardView.swift");card.cleanup()
        }
        for (id,title) in [("exit-stage","Exit Stage?"),("exit-game","Exit Game?")] {
            reset();let model=try XCTUnwrap(JimiNativeEndRunModel(["title":title,"subtitle":"Come back anytime.\nStage 7 progress saved.","restartLabel":"Restart","exitLabel":title=="Exit Stage?" ? "Exit Stage":"Exit Game"]))
            let modal=JimiNativeEndRunModal(id:70,model:model,assets:art);mountController(modal);try await wait(1.2)
            try capture(id,title+" · paired actions","Modal","Gameplay → X","native/jimi-2026/JimiNativeEndRunModal.swift");modal.dispose()
        }
        for index in 0...2 {
            reset();let modal=NativeArcadeWorldModal(frame:host.view.bounds,assets:art,index:index);mount(modal);modal.reveal();try await wait(0.9)
            try capture("arcade-mode-\(index)",["Endurance","One Lucky Drop","Slow Burn"][index],"Modal","Home → Arcade → mode card","native/gameplay-app/NativeArcadeHubView.swift");modal.dispose()
        }
        reset();let score=NativeScoreModal(model:NativeScoreModalModel(state:NativeBoardState(tiles:[],mode:.journey,board:7,stage:7,score:42179),progression:progress,combo:false),root:root);mountController(score);try await wait(0.9)
        try capture("score-modal","High score HUD modal","Modal","Gameplay → trophy","native/gameplay-app/NativeScoreModal.swift");score.dispose()
        reset();let detail=NativeBackpackDetail(die:NativeBackpackCatalog.forest[0],assets:art,motion:motion());detail.entersImmediately=true;mountController(detail);detail.beginImmediatePresentation();try await wait(1.4)
        try capture("dice-detail","Wee Bee · die detail","Modal","Backpack → Wee Bee","native/gameplay-collection/NativeBackpackDetail.swift");detail.dispose()
        reset();let bag=NativeGameplayBackpackController(root:root,sections:[NativeBackpackCatalog.sections(progress)[0]],includesArcade:false,motion:motion());mountController(bag);try await wait(0.9)
        try capture("backpack-info","Backpack gameplay modal","Modal","Gameplay → Backpack","native/gameplay-app/NativeScoreOwner.swift");bag.dispose()
        for clean in [true,false] {
            reset();let state=NativeBoardState(tiles:[],mode:.journey,board:7,stage:7,score:42179,bestScore:90000)
            let result=NativeResultController(root:root,state:state,clean:clean,combo:500,efficiency:1500,finalScore:44179,headlineRandom:0.2);mountController(result)
            result.tick(0)
            for frame in 1...480 {
                result.tick(Double(frame)/60)
                if clean,frame==180 {try capture("result-combo","Result · Combo bonus","Result","Gameplay → clean result → combo phase","native/gameplay-app/NativeResultOwner.swift")}
                if clean,frame==300 {try capture("result-efficiency","Result · Efficiency bonus","Result","Gameplay → clean result → efficiency phase","native/gameplay-app/NativeResultOwner.swift")}
            }
            try await wait(0.15)
            try capture(clean ? "result-clean":"result-fail",clean ? "Clean result":"Failed result","Result",clean ? "Gameplay → cleared → result":"Gameplay → no moves → result","native/gameplay-app/NativeResultOwner.swift");result.dispose()
        }
        for legendary in [false,true] {
            reset();let reward=NativeJourneyRewardController(root:root,board:1,score:legendary ? 90000:1500,generation:1,awardedStars:legendary ? 3:1,random:{0.4});mountController(reward);reward.start();try await wait(2.1)
            if !legendary {try capture("reward-interim","New Reward · interim card","Reward","First completed Unit → New Reward","native/gameplay-reward/NativeJourneyRewardController.swift")}
            reward.activate();try await waitForCoach(reward.view)
            try capture(legendary ? "reward-legendary":"reward-common",legendary ? "Legendary! reward":"Common reward","Reward","New Reward → tap card → unlocked","native/gameplay-reward/NativeJourneyRewardController.swift");reward.dispose(notify:false)
        }
        reset();let tutorial=NativeTutorialOverlay(resourceRoot:root);mount(tutorial);tutorial.show(step:1,from:nil,to:nil,initial:true);try await wait(0.8)
        try capture("tutorial","First play tutorial","Tutorial","Settings → First play / first launch","native/gameplay-app/NativeTutorialOverlay.swift");tutorial.dispose()
        reset();let gameplay=NativeGameplayViewController(engine:NativeGameplayEngine(state:NativeBoardState(tiles:[NativeTile(id:"library-1",cell:NativeCell(column:1,row:3),value:1),NativeTile(id:"library-2",cell:NativeCell(column:2,row:3),value:1)],mode:.journey,board:7,stage:7,score:42179)),resourceRoot:root);mountController(gameplay);try await wait(0.6)
        sceneForCapture=gameplay.boardScene
        try capture("gameplay-hud","Gameplay HUD","Gameplay","Journey → Stage 07 → Play","native/gameplay-ui/NativeGameplayViewController.swift");gameplay.dispose();sceneForCapture=nil
        reset();let cleared=NativeArcadeRoundPresentation(resourceRoot:root,clearedRound:1,nextRound:2,boardClearedOnly:true,random:{0.4});mount(cleared);cleared.start();try await wait(1.1)
        try capture("cleared-celebration","CLEARED · animated glyph sizes","Effect","Final merge → CLEARED celebration","native/gameplay-ui/NativeArcadeRoundPresentation.swift");cleared.dispose()
        XCTAssertGreaterThan(scenes.count,20)
    }
    func testCaptureTutorialActionButtons() async throws {
        scenes=try JSONSerialization.jsonObject(with:Data(contentsOf:output.appendingPathComponent("scenes.json"))) as! [[String:Any]]
        scenes.removeAll{["tutorial","tutorial-merge","tutorial-special","tutorial-special-bar"].contains($0["id"] as? String ?? "")}
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));art=JimiV9Artwork(resourceRoot:root)
        defer{window.isHidden=true;window.rootViewController=nil;previous?.makeKeyAndVisible()}
        for (step,id,name) in [(1,"tutorial","Drag to stack · Got it"),(2,"tutorial-merge","Merge dice · Got it"),(4,"tutorial-special","Special dice · Got it")] {
            reset();let overlay=NativeTutorialOverlay(resourceRoot:root);mount(overlay);overlay.show(step:step,from:nil,to:nil,initial:true);try await wait(0.9)
            try capture(id,name,"Tutorial","First play → tutorial sheet","native/gameplay-app/NativeTutorialOverlay.swift");overlay.dispose()
        }
        reset();let overlay=NativeTutorialOverlay(resourceRoot:root);mount(overlay);XCTAssertTrue(overlay.showSpecialBar(entered:{}));try await wait(0.9)
        try capture("tutorial-special-bar","Special Bar · Continue","Tutorial","First play → earned meter guide","native/gameplay-app/NativeTutorialOverlay.swift");overlay.dispose()
    }

    func testCaptureClearStageFreeMovementCopy() async throws {
        scenes=try JSONSerialization.jsonObject(with:Data(contentsOf:output.appendingPathComponent("scenes.json"))) as! [[String:Any]]
        scenes.removeAll{($0["id"] as? String)=="tutorial-clear"}
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));art=JimiV9Artwork(resourceRoot:root)
        defer{window.isHidden=true;window.rootViewController=nil;previous?.makeKeyAndVisible()}
        reset();let overlay=NativeTutorialOverlay(resourceRoot:root);mount(overlay);overlay.show(step:3,from:nil,to:nil,initial:true);try await wait(0.9)
        try capture("tutorial-clear","Clear the stage · free movement","Tutorial","First play → Clear the stage","native/gameplay-app/NativeTutorialOverlay.swift");overlay.dispose()
    }

}
