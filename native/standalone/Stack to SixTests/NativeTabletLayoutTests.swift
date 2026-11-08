import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeTabletLayoutTests:XCTestCase {
    private let sizes=[CGSize(width:744,height:1133),CGSize(width:820,height:1180),CGSize(width:1032,height:1376)]
    private func all(_ view:UIView)->[UIView] {[view]+view.subviews.flatMap(all)}
    private var assets:JimiV9Artwork {JimiV9Artwork(resourceRoot:NativeTestResources.root)}

    func testModalProjectionScalesCircleGlyphAndContentTogetherWithoutAccumulation() {
        let host=UIView(frame:CGRect(x:0,y:0,width:820,height:1180)),backdrop=UIView(),card=UIView()
        backdrop.frame=host.bounds;host.addSubview(backdrop);host.addSubview(card)
        let bounds=NativeTabletLayout.modalBounds(in:host,card:card)
        card.bounds=CGRect(x:0,y:0,width:310,height:400);card.center=CGPoint(x:bounds.midX,y:bounds.midY)
        let close=UIView(frame:CGRect(x:268,y:-10,width:52,height:52)),glyph=UIView(frame:CGRect(x:14,y:14,width:24,height:24))
        close.addSubview(glyph);card.addSubview(close)
        XCTAssertEqual(close.convert(close.bounds,to:host).width,72.8,accuracy:0.001)
        XCTAssertEqual(glyph.convert(glyph.bounds,to:host).width,33.6,accuracy:0.001)
        XCTAssertTrue(host.hitTest(CGPoint(x:410,y:10),with:nil) === backdrop,"Blank projected area must not swallow backdrop taps")
        let projection=card.superview
        _=NativeTabletLayout.modalBounds(in:host,card:card)
        XCTAssertTrue(card.superview === projection);XCTAssertEqual(host.subviews.count,2)
        XCTAssertEqual(card.convert(card.bounds,to:host).width,434,accuracy:0.001)
        host.frame=CGRect(x:0,y:0,width:390,height:844)
        XCTAssertEqual(NativeTabletLayout.modalBounds(in:host,card:card),host.bounds)
        XCTAssertTrue(card.superview === host);XCTAssertEqual(host.subviews.count,2)
        XCTAssertEqual(NativeTabletLayout.modalProjectionScale(of:card),1)
    }
    func testBackdropOcclusionBindingSurvivesBoardGenerationReplacement() {
        func state(_ generation:UInt64)->NativeBoardState {
            .init(columns:7,rows:8,tiles:[
                .init(id:"locked",cell:.init(column:0,row:7),value:0,locked:true,alpha:0.25),
                .init(id:"open",cell:.init(column:1,row:7),value:2)],generation:generation)
        }
        let engine=NativeGameplayEngine(state:state(1))
        let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:CGSize(width:820,height:1180))
        scene.layout(size:CGSize(width:820,height:1180),insets:.zero)
        var received:[NativeBoardBackdropCutout]=[]
        scene.onBackdropOcclusion={received=$0}
        engine.restart(state:state(2));scene.synchronize()
        XCTAssertNotNil(scene.onBackdropOcclusion)
        scene.didFinishUpdate()
        XCTAssertFalse(received.isEmpty,"The replacement board must still mask scenery behind locked tiles")
        scene.dispose();XCTAssertNil(scene.onBackdropOcclusion)
    }


    func testPhoneNavigationCompressesHeaderWithUnchangedIconAndTitleSizes() {
        for size in [CGSize(width:390,height:844),CGSize(width:430,height:932)] {
            for safeTop:CGFloat in [0,47,59] {
                let top=max(0,safeTop+size.height*0.02-16)
                let base:CGFloat=66
                do {
                    let row=JimiV9NavigationHeader.RowLayout(bounds:CGRect(origin:.zero,size:size),safeAreaTop:safeTop)
                    let inset=(top+base)*0.1
                    XCTAssertEqual(row.headerHeight(),(top+base)*0.8,accuracy:0.000001)
                    XCTAssertEqual(row.centerY,top+26-inset+8,accuracy:0.000001)
                    XCTAssertEqual(row.iconScale,1);XCTAssertEqual(row.titleFontSize,28)
                    let label=UILabel();label.font=assets.font(size:28);label.text="Journey"
                    let title=row.titleFrame(for:label)
                    XCTAssertEqual(title.minY,top+10-inset+8,accuracy:0.000001)
                    XCTAssertEqual(title.minX,72);XCTAssertEqual(title.width,size.width-144);XCTAssertEqual(title.height,32)
                    let button=row.buttonFrame(x:24)
                    XCTAssertEqual(button.minY,top+4-inset+8,accuracy:0.000001)
                    XCTAssertEqual(button.minX,24);XCTAssertEqual(button.size,CGSize(width:44,height:44))
                    XCTAssertEqual(row.iconInsets(UIEdgeInsets(top:10,left:10,bottom:10,right:10),imageHeight:24,inkCenterY:0.5104166667),UIEdgeInsets(top:10,left:10,bottom:10,right:10))
                }
            }
        }
    }
    func testBoxNavigationArtworkFillsSameCanvasAsBackpackOnPhoneAndTablet() throws {
        for size in [CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            let window=UIWindow(frame:CGRect(origin:.zero,size:size)),host=UIViewController()
            window.rootViewController=host;window.makeKeyAndVisible()
            defer{window.isHidden=true}
            var artworkSizes:[CGSize]=[]
            for arcade in [false,true] {
                let view=JimiV9HubView(frame:CGRect(origin:.zero,size:size),assets:assets,arcade:arcade)
                host.view.addSubview(view);view.layoutIfNeeded();view.header.layoutIfNeeded();view.backpackButton.layoutIfNeeded()
                let image=try XCTUnwrap(view.backpackButton.imageView)
                artworkSizes.append(image.bounds.size)
                let scale:CGFloat=NativeTabletLayout.applies(size) ? 1.4:1
                XCTAssertEqual(image.bounds.width,40*scale,accuracy:0.01)
                XCTAssertEqual(image.bounds.height,40*scale,accuracy:1/UIScreen.main.scale,"Small crate originals must upscale beyond intrinsic36pt")
                XCTAssertEqual(view.backpackButton.bounds.size,CGSize(width:40*scale,height:48*scale))
                let attachment=XCTAttachment(image:UIGraphicsImageRenderer(bounds:view.header.bounds).image{view.header.layer.render(in:$0.cgContext)})
                attachment.name="\(arcade ? "Box":"Backpack") navigation \(Int(size.width))";attachment.lifetime = .keepAlways;add(attachment)
                view.removeFromSuperview()
            }
            XCTAssertEqual(artworkSizes[0].width,artworkSizes[1].width,accuracy:1/UIScreen.main.scale)
            XCTAssertEqual(artworkSizes[0].height,artworkSizes[1].height,accuracy:1/UIScreen.main.scale)
        }
    }

    func testTabletNavigationSitsFourPointsBelowHeaderCentreAndExportsPaintEvidence() throws {
        let size=CGSize(width:820,height:1180),art=assets
        let window=UIWindow(frame:CGRect(origin:.zero,size:size)),host=UIViewController()
        window.rootViewController=host;window.makeKeyAndVisible()
        defer{window.isHidden=true}
        var records:[[String:Any]]=[]
        var expectedHeaderHeight:CGFloat?
        let folder=URL(fileURLWithPath:"/tmp/ipad-navigation-down4-20261103")
        try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
        func rect(_ r:CGRect)->[Double] {[Double(r.minX),Double(r.minY),Double(r.width),Double(r.height)]}
        func capture(_ name:String,_ view:UIView,_ header:JimiV9NavigationHeader) throws {
            host.view.addSubview(view);view.frame=CGRect(origin:.zero,size:size)
            view.setNeedsLayout();view.layoutIfNeeded();header.layoutIfNeeded()
            header.layer.transform=CATransform3DIdentity;header.alpha=1
            if let expectedHeaderHeight {
                XCTAssertEqual(header.bounds.height,expectedHeaderHeight,accuracy:0.001,"LOCKED: all navigation dividers must match Hub/Settings")
            } else {expectedHeaderHeight=header.bounds.height}
            let title=try XCTUnwrap(header.subviews.compactMap{$0 as? UILabel}.first)
            XCTAssertEqual(title.font.pointSize,39.2,accuracy:0.0001)
            let format=UIGraphicsImageRendererFormat();format.scale=4;format.opaque=false
            func png(_ target:UIView,_ file:String) throws {
                let data=UIGraphicsImageRenderer(size:target.bounds.size,format:format).pngData{target.layer.render(in:$0.cgContext)}
                try data.write(to:folder.appendingPathComponent(file))
            }
            try png(header,name+"-header.png");try png(title,name+"-title.png")
            var icons:[[String:Any]]=[]
            for (i,button) in header.subviews.compactMap({$0 as? UIButton}).enumerated() {
                XCTAssertEqual(button.frame.midY,header.bounds.midY+12,accuracy:0.001)
                button.layoutIfNeeded()
                let image=button.imageView?.image != nil ? button.imageView:button.subviews.compactMap{$0 as? UIImageView}.first{$0.image != nil}
                if let image,image.image != nil {
                    let file=name+"-icon"+String(i)+".png";try png(image,file)
                    icons.append(["file":file,"rect":rect(image.convert(image.bounds,to:header))])
                }
            }
            records.append(["name":name,"headerHeight":Double(header.bounds.height),"headerWidth":Double(header.bounds.width),"titleRect":rect(title.frame),"titleFile":name+"-title.png","icons":icons])
            view.removeFromSuperview()
        }
        for arcade in [false,true] {
            let view=JimiV9HubView(frame:CGRect(origin:.zero,size:size),assets:art,arcade:arcade)
            try capture(arcade ? "Arcade":"Journey",view,view.header)
        }
        let settings=JimiNativeSettingsView(frame:CGRect(origin:.zero,size:size),assets:art)
        try capture("Settings",settings,settings.header)
        for (worldID,title) in [(1,"Forest"),(2,"Beach"),(3,"Area 55")] {
            let board=(worldID-1)*10+1
            let raw:[String:Any] = ["version":1,"worldID":worldID,"requestID":"navigation-centre","routeGeneration":1,"stateRevision":0,"title":title,"contentHeight":2400,"mainFrame":["x":0,"y":100,"width":390,"height":300],"mainParts":[],"units":[["id":"board-"+String(board),"boardID":board,"frame":["x":30,"y":520,"width":150,"height":200],"cardArt":"assets/close-icon.png","locked":false,"interim":false,"stars":0,"allowedActions":["openCard","play"],"stats":[],"parts":[]]]]
            let view=try XCTUnwrap(JimiNativeWorldView(snapshot:raw,assets:art));defer{view.cleanup()}
            try capture(title,view,view.header)
        }
        for crate in [false,true] {
            let view=NativeBackpackView(frame:CGRect(origin:.zero,size:size),assets:art,title:crate ? "Your Box":"Backpack",arcadeCrate:crate)
            try capture(crate ? "Box":"Backpack",view,view.header)
        }
        try JSONSerialization.data(withJSONObject:records,options:.prettyPrinted).write(to:folder.appendingPathComponent("paint-geometry.json"))
    }
    func testLockedTabletNumbersKeepPhoneIslandAnchorAndRowsHaveBreathingRoom() async throws {
        let layouts=try NativeWorldLayouts(),progress=NativeProgressionState()
        for size in sizes {for worldID in 1...3 {
            let raw=try layouts.snapshot(world:worldID,width:Double(size.width),height:Double(size.height),generation:1,progression:progress,proportionalCards:true,unitScale:1.105,unitRowGap:36)
            let baseline=try XCTUnwrap(JimiNativeWorldSnapshot(try layouts.snapshot(world:worldID,width:Double(size.width),height:Double(size.height),generation:1,progression:progress,proportionalCards:true,unitScale:1.105)))
            let phone=try XCTUnwrap(JimiNativeWorldSnapshot(try layouts.snapshot(world:worldID,width:390,height:844,generation:1,progression:progress)))
            let world=try XCTUnwrap(JimiNativeWorldView(snapshot:raw,assets:assets))
            world.frame=CGRect(origin:.zero,size:size);world.layoutIfNeeded()
            defer {world.cleanup()}
            let scale=NativeTabletLayout.worldFrame(world.bounds).width/390*1.105
            XCTAssertEqual(world.snapshot.mainFrame,baseline.mainFrame)
            XCTAssertEqual(world.snapshot.mainParts,baseline.mainParts)
            for (index,definition) in world.snapshot.units.enumerated() {
                XCTAssertEqual(definition.frame.minY-baseline.units[index].frame.minY,CGFloat(index)*36*1.105,accuracy:0.001)
                guard definition.locked else {continue}
                world.scrollView.contentOffset.y=max(0,definition.frame.minY*scale/1.105-180)
                world.layoutIfNeeded()
                let ready=expectation(description:"Locked Unit artwork ready")
                world.prepare{ready.fulfill()};await fulfillment(of:[ready],timeout:10)
                let id=definition.boardID
                let label=try XCTUnwrap(all(world).first{$0.accessibilityIdentifier=="native.world.number.\(id)"} as? UILabel)
                let island=try XCTUnwrap(all(world).first{$0.accessibilityIdentifier=="native.world.part.\(id).island"})
                let reference=phone.units[index],part=try XCTUnwrap(reference.parts.first{$0.role=="island"})
                let actual=label.superview!.convert(label.center,to:world)
                let origin=island.superview!.convert(island.center,to:world)
                // Compare the label's unrotated centre, including its authored
                // translation, with the phone's virtual card and island anchor.
                XCTAssertEqual((actual.x+definition.lockedNumberOffset.x*scale/1.105-origin.x)/scale,reference.frame.width/2+reference.lockedNumberOffset.x-part.frame.midX,accuracy:0.01)
                XCTAssertEqual((actual.y+definition.lockedNumberOffset.y*scale/1.105-origin.y+island.bounds.height/2)/scale,reference.frame.height/2+reference.lockedNumberOffset.y-part.frame.minY,accuracy:0.01)
                XCTAssertEqual(label.text,String(format:"%02d",index+1))
                if size.width==820,worldID==1,index==5 {
                    let renderer=UIGraphicsImageRenderer(size:size)
                    let data=renderer.pngData{context in
                        UIColor(red:0.97,green:0.95,blue:0.91,alpha:1).setFill();context.fill(CGRect(origin:.zero,size:size))
                        world.alpha=1;world.layer.render(in:context.cgContext)
                    }
                    let attachment=XCTAttachment(data:data,uniformTypeIdentifier:"public.png")
                    attachment.name="Tablet Forest 04–08 spacing";attachment.lifetime = .keepAlways;add(attachment)
                    try data.write(to:URL(fileURLWithPath:"/tmp/ipad-journey-spacing-render.png"))
                }
            }
        }}
    }

    func testEightRowBoardFitsBelowProportionalHUDAndHitsEveryCell() {
        for size in sizes {
            let insets=UIEdgeInsets(top:24,left:0,bottom:20,right:0)
            let geometry=NativeBoardGeometry(columns:7,rows:8,viewport:size,safeInsets:insets)
            let chrome=NativeGameplayChromePlan.make(viewport:size,safeTop:24,scaleTopHUD:false)
            let top=size.height-chrome.meterRect.minY,bottom=size.height-size.width*0.20
            let height=(8*NativeBoardGeometry.tile+7*NativeBoardGeometry.gap)*geometry.scale
            let actualTop=size.height-geometry.origin.y-height
            XCTAssertEqual(actualTop-40-top,bottom-(size.height-geometry.origin.y-40),accuracy:0.001)
            XCTAssertGreaterThanOrEqual(actualTop,top)
            XCTAssertLessThanOrEqual(size.height-geometry.origin.y,bottom+40)
            let boardWidth=(7*NativeBoardGeometry.tile+6*NativeBoardGeometry.gap)*geometry.scale
            let aligned=NativeGameplayChromePlan.make(viewport:size,safeTop:24,boardBounds:CGRect(x:geometry.origin.x,y:0,width:boardWidth,height:0))
            XCTAssertEqual(aligned.meterRect.minX,geometry.origin.x,accuracy:0.001)
            XCTAssertEqual(aligned.meterRect.width,boardWidth,accuracy:0.001)
            let previousAvailable=size.height-(top+24)-24-insets.bottom
            let padding:CGFloat=size.width>=768 ? 40:24
            let oldScale=min((size.width-padding*2)/(7*128+6*20),previousAvailable/(9*128+8*20))
            XCTAssertEqual(geometry.scale,min(oldScale,(bottom-top)/(8*128+7*20)),accuracy:0.001)
            // The requested taller proportional HUD owns its reserved band;
            // the complete grid must fit that band and preserve every hit.
            for row in 0..<8 {for column in 0..<7 {
                let hit=geometry.cell(at:geometry.center(row:row,column:column))
                XCTAssertEqual(hit?.row,row);XCTAssertEqual(hit?.column,column)
            }}
            for mode in [NativeRunMode.journey,.arcade] {
                let state=NativeBoardFactory.make(mode:mode,board:1,columns:7,rows:8)
                XCTAssertEqual(state.tiles.count,56);XCTAssertTrue(state.validationIssues().isEmpty)
                XCTAssertTrue(state.tiles.allSatisfy{$0.cell.row<8})
            }
        }
    }
    func testActualTabletSceneMeterAndHUDUseBoardEdges() throws {
        for size in sizes {
            let engine=NativeGameplayEngine(state:NativeBoardFactory.make(mode:.journey,board:1,columns:7,rows:8))
            let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:size)
            defer {scene.dispose()}
            scene.layout(size:size,insets:.init(top:24,left:0,bottom:20,right:0))
            let scale=NativeGameplayChromePlan.hudScale(for:size)
            let grid=try XCTUnwrap(scene.boardGeometry)
            let track=try XCTUnwrap(scene.childNode(withName:"//native-game-wild-meter-track") as? SKShapeNode)
            let hudLeft=grid.origin.x
            XCTAssertEqual(track.position.x,hudLeft,accuracy:0.001)
            let width=try XCTUnwrap(track.path).boundingBox.width
            XCTAssertEqual(track.position.x+width,size.width-hudLeft,accuracy:0.001)
            let close=try XCTUnwrap(scene.childNode(withName:"//native-game-close") as? NativeHUDCloseNode)
            XCTAssertEqual(close.position.x-NativeHUDCloseNode.radius*scale,hudLeft,accuracy:0.001)
            XCTAssertEqual(max(close.icon.size.width,close.icon.size.height),24*scale,accuracy:0.001)
            let help=try XCTUnwrap(scene.childNode(withName:"//native-game-help") as? SKSpriteNode)
            let score=try XCTUnwrap(scene.childNode(withName:"//native-game-score-art") as? SKSpriteNode)
            let combo=try XCTUnwrap(scene.childNode(withName:"//native-game-combo-art") as? SKSpriteNode)
            XCTAssertEqual(max(help.size.width,help.size.height),NativeGameplayChromePlan.backpackBaseSide(for:size)*scale,accuracy:0.001)
            for icon in [score,combo] {XCTAssertEqual(max(icon.size.width,icon.size.height),28*scale,accuracy:0.001)}
            let number=try XCTUnwrap(scene.childNode(withName:"//native-game-combo-value") as? SKLabelNode)
            XCTAssertEqual(number.fontSize,18*scale,accuracy:0.001)
            XCTAssertEqual(try XCTUnwrap(track.path).boundingBox.height,10*scale,accuracy:0.001)
            XCTAssertEqual(close.position.y-(track.position.y+5*scale),38*scale+8,accuracy:0.001)
            XCTAssertLessThan(close.position.x,score.position.x)
            XCTAssertLessThan(score.position.x,combo.position.x)
            XCTAssertLessThan(combo.position.x,help.position.x)
            let interval=score.position.x-close.position.x
            XCTAssertEqual(combo.position.x-score.position.x,interval,accuracy:0.001)
            XCTAssertEqual(help.position.x-combo.position.x,interval,accuracy:0.001)
            XCTAssertEqual(close.zRotation,-14 * .pi/180,accuracy:0.0001)
            XCTAssertEqual(help.zRotation,14 * .pi/180,accuracy:0.0001)
            XCTAssertTrue(close.ring.isHidden)
            XCTAssertEqual(score.zRotation,-3.42235500034373 * .pi/180,accuracy:0.0001)
            XCTAssertEqual(combo.zRotation,2.3749138871645905 * .pi/180,accuracy:0.0001)
        }
    }
    func testTabletHUDAnchorsIgnoreValueChangesFeedbackAndCanvasShake() throws {
        let values:[(Int,Int)]=[(0,0),(111,1),(888,8),(999,9),(1000,10),(12345,12),(9999999,123)]
        let scales:[(CGFloat,CGFloat)]=[(1,1),(1.76,1),(2.50,1.3),(3.20,1.6),(1.2,1.1)]
        for size in sizes {
            var baseline:[CGPoint]?
            for (scoreValue,comboValue) in values {
                var state=NativeBoardFactory.make(mode:.journey,board:1,columns:7,rows:8)
                state.score=scoreValue;state.combo=comboValue
                let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root,size:size)
                defer {scene.dispose()}
                scene.layout(size:size,insets:.init(top:24,left:0,bottom:20,right:0))
                let icons=try ["native-game-close","native-game-help","native-game-score-art","native-game-combo-art"].map {
                    try XCTUnwrap(scene.childNode(withName:"//"+$0))
                }
                let number=try XCTUnwrap(scene.childNode(withName:"//native-game-combo-value") as? SKLabelNode)
                let score=try XCTUnwrap(icons[2].parent?.children.compactMap{$0 as? NativeArchedHUDScore}.first{$0.text==NativeScoreDisplay.text(state.score)})
                let canvas=try XCTUnwrap(scene.childNode(withName:"native-gameplay-canvas"))
                let multiplier=try XCTUnwrap(icons[3].parent?.children.compactMap{$0 as? SKLabelNode}.first{$0.text=="x"})
                let angle=multiplier.zRotation;multiplier.zRotation=0
                let intrinsicWidth=multiplier.frame.width;multiplier.zRotation=angle
                XCTAssertEqual(number.position.x,multiplier.position.x+intrinsicWidth*cos(angle),accuracy:0.001)
                XCTAssertEqual(number.position.y,multiplier.position.y+intrinsicWidth*sin(angle),accuracy:0.001)
                if baseline==nil {baseline=icons.map{$0.convert(.zero,to:scene)}}
                let positions=try XCTUnwrap(baseline)
                for (comboScale,scoreScale) in scales {
                    number.setScale(comboScale);score.setScale(scoreScale)
                    scene.synchronize(animateEntry:false)
                    for offset in [CGPoint.zero,CGPoint(x:2,y:-3),CGPoint(x:-1.5,y:2)] {
                        canvas.position=offset
                        for (icon,position) in zip(icons,positions) {
                            let actual=icon.convert(CGPoint.zero,to:scene)
                            XCTAssertEqual(actual.x,position.x,accuracy:0.001)
                            XCTAssertEqual(actual.y,position.y,accuracy:0.001)
                        }
                    }
                    canvas.position = .zero
                }
            }
        }
    }
    func testPhoneAndTabletHUDProjectionExportsActualMountedPaint() async throws {
        let folder=URL(fileURLWithPath:"/tmp/hud-phone-tablet-proportions-20261103")
        try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
        var evidence:[[String:Any]]=[]
        for size in [CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            let tablet=NativeTabletLayout.applies(size),safeTop:CGFloat=tablet ? 24:47
            var state=NativeBoardFactory.make(mode:.journey,board:1,columns:7,rows:8);state.score=4648
            let engine=NativeGameplayEngine(state:state)
            let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:size)
            let renderer=SKView(frame:CGRect(origin:.zero,size:size)),controller=UIViewController()
            controller.view=renderer
            let window=UIWindow(frame:renderer.bounds);window.rootViewController=controller;window.makeKeyAndVisible()
            defer {scene.dispose();renderer.presentScene(nil);window.isHidden=true}
            renderer.presentScene(scene)
            scene.layout(size:size,insets:.init(top:safeTop,left:0,bottom:tablet ? 20:34,right:0))
            try await Task.sleep(for:.seconds(2))
            let close=try XCTUnwrap(scene.childNode(withName:"//native-game-close") as? NativeHUDCloseNode)
            let help=try XCTUnwrap(scene.childNode(withName:"//native-game-help") as? SKSpriteNode)
            let score=try XCTUnwrap(scene.childNode(withName:"//native-game-score-art") as? SKSpriteNode)
            let combo=try XCTUnwrap(scene.childNode(withName:"//native-game-combo-art") as? SKSpriteNode)
            let number=try XCTUnwrap(scene.childNode(withName:"//native-game-combo-value") as? SKLabelNode)
            let meter=try XCTUnwrap(scene.childNode(withName:"//native-game-wild-meter-track") as? SKShapeNode)
            let scale=NativeGameplayChromePlan.hudScale(for:size)
            let bar=try XCTUnwrap(meter.path).boundingBox
            XCTAssertEqual(max(close.icon.size.width,close.icon.size.height)/scale,24,accuracy:0.001)
            XCTAssertEqual(max(help.size.width,help.size.height)/scale,tablet ? NativeGameplayChromePlan.backpackBaseSide(for:size):36.8,accuracy:0.001)
            XCTAssertEqual(max(score.size.width,score.size.height)/scale,28,accuracy:0.001)
            XCTAssertEqual(max(combo.size.width,combo.size.height)/scale,28,accuracy:0.001)
            XCTAssertEqual(number.fontSize/scale,18,accuracy:0.001)
            XCTAssertEqual(bar.height/scale,10,accuracy:0.001)
            let distance=close.position.y-meter.position.y-bar.midY
            XCTAssertEqual(distance/scale,tablet ? 38+8/scale:43.37,accuracy:0.001)
            let bandHeight=size.height-meter.position.y+24*scale
            // Capture the full Scene first. SKView's Scene+crop overload
            // reprojects its viewport into the crop and distorts the image.
            let texture=try XCTUnwrap(renderer.texture(from:scene))
            let full=texture.cgImage(),pixelsPerPoint=CGFloat(full.width)/size.width
            XCTAssertEqual(CGFloat(full.height)/CGFloat(full.width),size.height/size.width,accuracy:0.01)
            let crop=try XCTUnwrap(full.cropping(to:CGRect(x:0,y:0,width:full.width,height:Int(ceil(bandHeight*pixelsPerPoint)))))
            let image=UIImage(cgImage:crop)
            let name=tablet ? "ipad":"iphone"
            try XCTUnwrap(image.pngData()).write(to:folder.appendingPathComponent(name+".png"))
            evidence.append(["device":name,"scale":scale,"close":max(close.icon.size.width,close.icon.size.height),"backpack":max(help.size.width,help.size.height),"score":max(score.size.width,score.size.height),"combo":max(combo.size.width,combo.size.height),"font":number.fontSize,"barHeight":bar.height,"rowToBarCentre":distance])
        }
        try JSONSerialization.data(withJSONObject:evidence,options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("geometry.json"))
    }
    func testTabletGameplayExportsSharedPreloadAndHUD() async throws {
        let folder=URL(fileURLWithPath:"/tmp/native-ipad-refresh-20261108/renders")
        try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
        for size in sizes {for mode in [NativeRunMode.journey,.arcade] {
            var state=NativeBoardFactory.make(mode:mode,board:1,columns:7,rows:8)
            state.score=1234567;state.combo=123
            let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root,size:size)
            let renderer=SKView(frame:CGRect(origin:.zero,size:size)),controller=UIViewController()
            controller.view=renderer
            let window=UIWindow(frame:renderer.bounds);window.rootViewController=controller;window.makeKeyAndVisible()
            renderer.presentScene(scene);scene.layout(size:size,insets:.init(top:24,left:0,bottom:20,right:0))
            let track=try XCTUnwrap(scene.childNode(withName:"//native-game-wild-meter-track") as? SKShapeNode)
            let hud=try XCTUnwrap(track.parent),rect=try XCTUnwrap(track.path).boundingBox
            let bar=NativePreloadBarPresentation(isPad:true,dividerResourceRoot:NativeTestResources.root,reducedMotion:{false})
            hud.addChild(bar.container);bar.container.position=CGPoint(x:track.position.x,y:track.position.y+rect.height)
            bar.resize(maximum:rect.width,barHeight:rect.height);bar.setNativeFill(left:0,width:rect.width*0.55,maximum:rect.width)
            track.isHidden=true;scene.childNode(withName:"//native-game-wild-meter-fill")?.isHidden=true
            defer{bar.dispose();scene.dispose();renderer.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
            try await Task.sleep(for:.milliseconds(200))
            let divider=try XCTUnwrap(bar.container.childNode(withName:"//native-preload-divider") as? SKSpriteNode)
            XCTAssertFalse(divider.isHidden);XCTAssertNotNil(divider.texture)
            XCTAssertGreaterThanOrEqual(divider.size.width,size.width,"Divider paper must cover the entire tablet, even when the grid is narrower")
            for name in ["native-game-close","native-game-score-art","native-game-combo-art","native-game-help"] {
                let node=try XCTUnwrap(scene.childNode(withName:"//"+name)),parent=try XCTUnwrap(node.parent)
                let f=node.frame,a=scene.convert(CGPoint(x:f.minX,y:f.minY),from:parent),b=scene.convert(CGPoint(x:f.maxX,y:f.maxY),from:parent)
                XCTAssertGreaterThanOrEqual(a.x,0);XCTAssertLessThanOrEqual(b.x,size.width)
                XCTAssertLessThanOrEqual(b.y,size.height-24)
            }
            let texture=try XCTUnwrap(renderer.texture(from:scene))
            let format=UIGraphicsImageRendererFormat();format.scale=1
            let image=UIGraphicsImageRenderer(size:size,format:format).image { context in
                NativeAppPaperSurface.base.setFill();context.fill(CGRect(origin:.zero,size:size))
                UIImage(cgImage:texture.cgImage()).draw(in:CGRect(origin:.zero,size:size))
            }
            try XCTUnwrap(image.pngData()).write(to:folder.appendingPathComponent("gameplay-\(mode)-\(Int(size.width)).png"))
        }}
    }
    func testTabletHUDContactsFollowTiltedArtworkAndLongValues() throws {
        for size in sizes {
            var state=NativeBoardFactory.make(mode:.journey,board:1,columns:7,rows:8)
            state.score=999999999;state.combo=999
            let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root,size:size)
            defer{scene.dispose()}
            scene.layout(size:size,insets:.init(top:24,left:0,bottom:20,right:0))
            var hits:[String]=[]
            scene.onExitRequest={hits.append("close")};scene.onScoreRequest={hits.append("score")}
            scene.onComboRequest={hits.append("combo")};scene.onHelpRequest={hits.append("bag")}
            for (name,expected) in [("native-game-close","close"),("native-game-score-art","score"),("native-game-combo-art","combo"),("native-game-help","bag")] {
                let node=try XCTUnwrap(scene.childNode(withName:"//"+name))
                XCTAssertTrue(scene.handleHUDContact(at:node.convert(.zero,to:scene)))
                XCTAssertEqual(hits.last,expected)
            }
            let scoreIcon=try XCTUnwrap(scene.childNode(withName:"//native-game-score-art"))
            let value=try XCTUnwrap(scoreIcon.parent?.children.compactMap{$0 as? NativeArchedHUDScore}.first{$0.text==NativeScoreDisplay.text(state.score)})
            XCTAssertTrue(scene.handleHUDContact(at:value.convert(CGPoint(x:value.frame.width-4,y:0),to:scene)))
            XCTAssertEqual(hits.last,"score","The last digit must not trigger Combo")
        }
    }
    func testActualPaintedLockedAndGhostCutoutsFollowMotionVisibilityAndRetirement() throws {
        let size=CGSize(width:820,height:1180)
        let engine=NativeGameplayEngine(state:.init(columns:7,rows:8,tiles:[
            .init(id:"locked",cell:.init(column:0,row:7),value:0,locked:true,alpha:0.25),
            .init(id:"open",cell:.init(column:1,row:7),value:2)]))
        let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:size)
        defer {scene.dispose()}
        scene.layout(size:size,insets:.init(top:24,left:0,bottom:20,right:0))
        let grid=try XCTUnwrap(scene.boardGeometry)
        func contains(_ column:Int)->Bool {
            let p=grid.center(row:7,column:column),point=CGPoint(x:p.x,y:size.height-p.y)
            return scene.backdropOcclusionCutouts().contains{$0.path.contains(point)}
        }
        XCTAssertTrue(contains(0));XCTAssertFalse(contains(1));XCTAssertTrue(contains(2))
        let locked=try XCTUnwrap(scene.sourceNativeTileNode("locked"))
        let before=scene.backdropOcclusionCutouts()
        locked.position.y-=12;locked.zRotation=0.2
        XCTAssertNotEqual(scene.backdropOcclusionCutouts(),before)
        locked.isHidden=true;XCTAssertFalse(contains(0))
        let ghost=try XCTUnwrap(scene.childNode(withName:"//native-ghost-2-7"))
        ghost.removeFromParent();XCTAssertFalse(contains(2))
        scene.onBackdropOcclusion={_ in}
        scene.dispose();XCTAssertNil(scene.onBackdropOcclusion);XCTAssertTrue(scene.backdropOcclusionCutouts().isEmpty)
    }
    func testNavigationArtworkFollowsCurveWithoutRotatingHitTargets() {
        for width:CGFloat in [390,820] {
            let header=JimiV9NavigationHeader(frame:CGRect(x:0,y:0,width:width,height:80))
            let title=JimiV9ArchedNavigationTitle(frame:CGRect(x:72,y:20,width:width-144,height:40))
            title.font=assets.font(size:28);title.text="Journey"
            let left=UIButton(frame:CGRect(x:22,y:20,width:44,height:44))
            let right=UIButton(frame:CGRect(x:width-66,y:20,width:44,height:44))
            [title,left,right].forEach{header.addSubview($0)}
            let targets=[left.frame,right.frame]
            header.applyCurve(to:title,icons:[left,right])
            XCTAssertEqual(left.frame,targets[0]);XCTAssertEqual(right.frame,targets[1])
            XCTAssertTrue(CATransform3DIsIdentity(left.layer.transform))
            XCTAssertGreaterThan(left.layer.sublayerTransform.m12,0)
            XCTAssertLessThan(right.layer.sublayerTransform.m12,0)
            XCTAssertEqual(left.layer.sublayerTransform.m12,-right.layer.sublayerTransform.m12,accuracy:0.000001)
            XCTAssertEqual(left.layer.sublayerTransform.m42,right.layer.sublayerTransform.m42,accuracy:0.000001)
            XCTAssertEqual(JimiV9NavigationHeader.tangentAngle(at:width/2,width:width),0)
            let home=JimiV9HomeView(frame:CGRect(x:0,y:0,width:width,height:1180),assets:assets)
            home.layoutSubviews()
            XCTAssertLessThan(home.navigationButtonViews.first!.layer.sublayerTransform.m12,0)
            XCTAssertGreaterThan(home.navigationButtonViews.last!.layer.sublayerTransform.m12,0)
        }
    }
    func testHomeBottomArchStaysBelowExistingDividerLine() throws {
        for size in [CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            let home=JimiV9HomeView(frame:CGRect(origin:.zero,size:size),assets:assets)
            home.layoutSubviews()
            let shadow=home.fixedShadowView
            let paintedHeight=shadow.contentMode == .scaleToFill ? shadow.bounds.height:max(shadow.bounds.height,shadow.bounds.width*49/390)
            let oldLine=shadow.center.y-paintedHeight/2
            let surface=try XCTUnwrap(shadow.subviews.first as? JimiV9BottomNavigationSurface)
            XCTAssertEqual(surface.convert(CGPoint.zero,to:home).y,oldLine+6,accuracy:0.0001)
            XCTAssertEqual(JimiV9BottomNavigationSurface.topEdge(at:0.5),0,accuracy:0.0001)
            for fraction in [CGFloat(0),0.25,0.5,0.75,1] {
                XCTAssertGreaterThanOrEqual(JimiV9BottomNavigationSurface.topEdge(at:fraction),0)
            }
            let preview=UIGraphicsImageRenderer(size:CGSize(width:size.width,height:200)).image {context in
                NativeAppPaperSurface.base.setFill();context.fill(CGRect(x:0,y:0,width:size.width,height:200))
                context.cgContext.translateBy(x:0,y:200-size.height)
                home.layer.render(in:context.cgContext)
            }
            try preview.pngData()?.write(to:URL(fileURLWithPath:"/tmp/home-bottom-arch-\(Int(size.width)).png"))
        }
    }
    func testAllHomeSlidesHaveLargerContainedArtworkAndStableExitPivot() {
        for size in sizes {
            let home=JimiV9HomeView(frame:CGRect(origin:.zero,size:size),assets:assets)
            for index in 0..<3 {
                home.selectSlide(index,animated:false);home.layoutSubviews()
                let hero=home.heroView,button=home.ctaView
                XCTAssertEqual(hero.bounds.width,min(500,size.width*0.63,size.height*0.44)*1.20,accuracy:0.01)
                XCTAssertLessThan(hero.bounds.width,size.width-96)
                let cta=button.convert(button.bounds,to:home)
                XCTAssertGreaterThan(cta.minY,hero.frame.maxY)
                let shadow=home.fixedShadowView,image=assets.image("assets/home-shadow.png")!
                let paintedHeight=shadow.contentMode == .scaleToFill ? shadow.bounds.height:max(shadow.bounds.height,shadow.bounds.width*image.size.height/image.size.width)
                let dividerY=shadow.frame.midY-paintedHeight/2
                XCTAssertEqual(dividerY-cta.maxY,64,accuracy:0.01)
                let dividerScale=shadow.bounds.width/390
                let visibleLeft=shadow.frame.minX+17*dividerScale
                let visibleRight=shadow.frame.minX+377*dividerScale
                XCTAssertEqual(visibleLeft,size.width-visibleRight,accuracy:0.001)
                XCTAssertEqual(visibleRight-visibleLeft,home.heroImages[index].bounds.width/0.95+32,accuracy:0.001)
                let icons=home.navigationButtonViews
                let oldGap=(min(600,size.width-64)-24-icons.reduce(0){$0+$1.bounds.width})/2
                for slot in 1..<icons.count {
                    XCTAssertEqual(icons[slot].frame.minX-icons[slot-1].frame.maxX,oldGap*0.8,accuracy:0.001)
                }
                XCTAssertEqual(icons[0].frame.minX,size.width-icons[2].frame.maxX,accuracy:0.001)
                if size.width==820,index==0 {
                    let data=UIGraphicsImageRenderer(size:size).pngData {context in
                        UIColor(red:0.97,green:0.95,blue:0.91,alpha:1).setFill();context.fill(CGRect(origin:.zero,size:size))
                        home.layer.render(in:context.cgContext)
                    }
                    try? data.write(to:URL(fileURLWithPath:"/tmp/ipad-home-divider-after.png"))
                }
                XCTAssertEqual(home.logoView.bounds.width,208*1.28*0.95,accuracy:0.01)
                XCTAssertEqual(home.logoView.bounds.height,127*1.28*0.95,accuracy:0.01)
                XCTAssertEqual(cta.minY-hero.frame.maxY,40-88*0.22,accuracy:0.01)
                XCTAssertEqual(button.bounds.height,88*1.22,accuracy:0.01)
                XCTAssertEqual(button.titleLabel!.font.pointSize,32*1.22,accuracy:0.01)
                let anchor=hero.layer.anchorPoint
                hero.layer.position.y+=(0.65-anchor.y)*hero.bounds.height
                hero.layer.anchorPoint=CGPoint(x:anchor.x,y:0.65)
                let expected=hero.layer.position
                hero.layer.transform=CATransform3DMakeScale(0.01,0.01,1)
                home.layoutSubviews();XCTAssertEqual(hero.layer.position,expected)
                hero.layer.transform=CATransform3DIdentity
            }
            home.isHidden=true
        }
    }
    func testTabletFlagFontSurvivesProgressRefreshAfterInitialLayout() throws {
        for size in [CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            for progressBeforeLayout in [false,true] {
                let hub=JimiV9HubView(frame:CGRect(origin:.zero,size:size),assets:assets)
                let worlds=hub.worldIDs.map{["worldId":$0,"completed":1,"total":10]}
                if progressBeforeLayout {hub.updateProgress(worlds)}
                hub.layoutSubviews()
                let labels=try hub.worldUnits.map {unit in try XCTUnwrap(all(unit).compactMap{$0 as? UILabel}.first)}
                let originalFonts=labels.map{$0.font!}
                for completed in [1,10,0,1] {
                    hub.updateProgress(hub.worldIDs.map{["worldId":$0,"completed":completed,"total":10]})
                    for (label,font) in zip(labels,originalFonts) {
                        let attributedFont=label.attributedText?.attribute(.font,at:0,effectiveRange:nil) as? UIFont
                        if NativeTabletLayout.applies(size) {
                            XCTAssertEqual(attributedFont?.pointSize ?? 0,font.pointSize,accuracy:0.001,"Progress refresh must keep explicit tablet type before another layout")
                        }
                        XCTAssertEqual(label.font.pointSize,font.pointSize,accuracy:0.001)
                    }
                    hub.layoutSubviews()
                    for (label,font) in zip(labels,originalFonts) {
                        XCTAssertEqual(label.font.pointSize,font.pointSize,accuracy:0.001)
                        if NativeTabletLayout.applies(size) {
                            let paintedFont=label.attributedText?.attribute(.font,at:0,effectiveRange:nil) as? UIFont
                            XCTAssertEqual(paintedFont?.pointSize ?? 0,font.pointSize,accuracy:0.001)
                        }
                    }
                }
            }
        }
    }
    func testJourneyFitsThreeEnlargedWorldsWithFullWidthCloudsAndStableExit() throws {
        let phone=JimiV9HubView(frame:CGRect(x:0,y:0,width:390,height:844),assets:assets)
        phone.layoutSubviews()
        for size in sizes {
            let hub=JimiV9HubView(frame:CGRect(origin:.zero,size:size),assets:assets)
            hub.layoutSubviews()
            let scale=hub.worldUnits[0].bounds.width/phone.worldUnits[0].bounds.width
            let baseFit=min(size.width/390,(size.height-(hub.header.bounds.height-32)-48)/(439+390*0.65))
            XCTAssertEqual(scale,baseFit*1.30*0.95*0.94*0.95,accuracy:0.0001)
            var artworkRects:[CGRect]=[]
            for (original,unit) in zip(phone.worldUnits,hub.worldUnits) {
                XCTAssertEqual(unit.bounds.width,original.bounds.width*scale,accuracy:0.01)
                let art=try XCTUnwrap(all(unit).first{$0.accessibilityIdentifier=="native.hub.art.\(unit.tag)"})
                let rect=art.convert(art.bounds,to:hub);artworkRects.append(rect)
                XCTAssertGreaterThanOrEqual(rect.minY,hub.header.frame.maxY+15.9-32-(unit.tag == 1 ? 4:0))
                XCTAssertLessThanOrEqual(rect.maxY,size.height+16)
                XCTAssertGreaterThanOrEqual(rect.minX,0)
                XCTAssertLessThanOrEqual(rect.maxX,size.width)
                let originalClouds=all(phone.cloudUnits[unit.tag]!).compactMap{$0 as? UIImageView}.filter{$0.accessibilityIdentifier == nil}
                let carrier=try XCTUnwrap(hub.cloudUnits[unit.tag])
                let plane=try XCTUnwrap(carrier.superview)
                XCTAssertTrue(plane.superview === unit.superview)
                XCTAssertLessThan(plane.superview!.subviews.firstIndex(of:plane)!,unit.superview!.subviews.firstIndex(of:unit)!,"All clouds must paint behind every World")
                let clouds=all(carrier).compactMap{$0 as? UIImageView}.filter{$0.accessibilityIdentifier == nil}
                let fill=try XCTUnwrap(all(carrier).first{$0.accessibilityIdentifier=="native.hub.left-cloud.\(unit.tag)"})
                XCTAssertFalse(fill.isHidden)
                let fillRect=fill.convert(fill.bounds,to:hub)
                XCTAssertLessThan(fillRect.minX,0)
                XCTAssertGreaterThan(fillRect.maxX,size.width*0.6)
                if let preceding=artworkRects.dropLast().last {
                    XCTAssertGreaterThanOrEqual(fillRect.minY,preceding.maxY+7.9,"A later Unit cloud must not paint over preceding World artwork")
                }
                XCTAssertFalse(clouds.isEmpty)
                let originalArt=try XCTUnwrap(all(original).first{$0.accessibilityIdentifier=="native.hub.art.\(unit.tag)"})
                XCTAssertEqual(art.bounds.width,originalArt.bounds.width*scale,accuracy:0.01)
                let cloudEnvelope=clouds.reduce(CGRect.null) {$0.union($1.convert($1.bounds,to:hub))}
                XCTAssertEqual(cloudEnvelope.minX,-64,accuracy:0.01)
                XCTAssertEqual(cloudEnvelope.maxX,size.width+64,accuracy:0.01)
                for (a,b) in zip(originalClouds,clouds) {
                    XCTAssertEqual(b.bounds.width/b.bounds.height,a.bounds.width/a.bounds.height,accuracy:0.0001,"Cloud enlargement must preserve original image aspect")
                }
            }
            if size.width==820 {
                let format=UIGraphicsImageRendererFormat();format.scale=1
                let data=UIGraphicsImageRenderer(size:size,format:format).pngData {context in
                    UIColor(red:0.97,green:0.95,blue:0.91,alpha:1).setFill();context.fill(CGRect(origin:.zero,size:size))
                    hub.layer.render(in:context.cgContext)
                }
                try data.write(to:URL(fileURLWithPath:"/tmp/ipad-hub-minus6-render.png"))
            }
            XCTAssertEqual(hub.scrollView.contentSize.width,size.width)
            XCTAssertGreaterThanOrEqual(hub.scrollView.contentSize.height,artworkRects.map(\.maxY).max()!+8)
            XCTAssertTrue(hub.scrollView.alwaysBounceVertical,"Preserve elastic pan cancellation on World controls")
            XCTAssertLessThanOrEqual(artworkRects.map(\.maxY).max()!,size.height+16,"Beach's extra16pt offset may use the bottom elastic scroll margin")
            let offset=hub.scrollView.contentOffset
            let positions=hub.worldUnits.map{$0.layer.position}
            for unit in hub.worldUnits {unit.layer.transform=CATransform3DMakeScale(0.01,0.01,1)}
            hub.layoutSubviews()
            XCTAssertEqual(hub.scrollView.contentOffset,offset)
            XCTAssertEqual(hub.worldUnits.map{$0.layer.position},positions)
            hub.stopIdle()
        }
    }
    func testTabletCloudTravelKeepsPhonePeriodsAndRetiresAllCloudAnimations() throws {
        guard !UIAccessibility.isReduceMotionEnabled else {throw XCTSkip("Idle disabled by Reduce Motion")}
        let key="jimi.v9.hub.idle.transform"
        var baseline:[(Double,CGFloat)]=[]
        for tablet in [false,true] {
            let size=tablet ? CGSize(width:820,height:1180):CGSize(width:390,height:844)
            let window=UIWindow(frame:CGRect(origin:.zero,size:size)),root=UIViewController()
            window.rootViewController=root;window.isHidden=false
            let hub=JimiV9HubView(frame:CGRect(origin:.zero,size:size),assets:assets)
            root.view.addSubview(hub);hub.layoutSubviews();hub.startIdle()
            let clouds=hub.worldUnits.flatMap { unit -> [UIImageView] in
                let parent:UIView=hub.cloudUnits[unit.tag]!
                return parent.subviews.flatMap{ $0.subviews }.compactMap{$0 as? UIImageView}.filter{!$0.isHidden}
            }
            XCTAssertEqual(clouds.count,tablet ? 16:13)
            var originals:[(Double,CGFloat)]=[]
            for cloud in clouds {
                let animation=try XCTUnwrap(cloud.layer.animation(forKey:key) as? CAKeyframeAnimation)
                if cloud.accessibilityIdentifier == nil {
                    let peak=try XCTUnwrap((animation.values?[1] as? NSValue)?.caTransform3DValue)
                    originals.append((animation.duration,peak.m41))
                }
            }
            if tablet {
                for (phone,ipad) in zip(baseline,originals) {
                    XCTAssertEqual(ipad.0,phone.0,"Keep the original cloud period")
                    XCTAssertEqual(ipad.1,phone.1*1.4,accuracy:0.001)
                }
                let home=JimiV9HomeView(frame:hub.bounds,assets:assets)
                let motion=NativeRouteMotion(home:home,hub:hub)
                let entries=motion.hubTracks(enter:false,selectedWorldID:1)
                for unit in hub.worldUnits {
                    let source=try XCTUnwrap(entries.first{$0.0 === unit}?.1)
                    let carrier=try XCTUnwrap(hub.cloudUnits[unit.tag])
                    let clouds=entries.filter{$0.0.superview === carrier}
                    XCTAssertFalse(clouds.isEmpty)
                    for (_,cloud) in clouds {
                        XCTAssertEqual(source.anchorY,cloud.anchorY)
                        XCTAssertEqual(source.tweens.map(\.duration),cloud.tweens.map(\.duration))
                        XCTAssertGreaterThan(cloud.duration,source.duration)
                    }
                }
            } else {baseline=originals;XCTAssertTrue(hub.cloudUnits.values.allSatisfy{!$0.isHidden})}
            hub.stopIdle()
            XCTAssertTrue(clouds.allSatisfy{$0.layer.animation(forKey:key)==nil})
            hub.startIdle();hub.isHidden=true
            XCTAssertTrue(clouds.allSatisfy{$0.layer.animation(forKey:key)==nil})
            hub.removeFromSuperview();window.isHidden=true;window.rootViewController=nil
        }
    }
    func testSettingsRowsAndFooterShareCenteredTabletColumnWithoutPreferenceWrites() {
        let view=JimiNativeSettingsView(frame:CGRect(origin:.zero,size:sizes[1]),assets:assets)
        var writes=0;view.onPreference={_,_,_ in writes+=1}
        _=view.apply(["presentationEpoch":1,"gameSoundsEnabled":true,"musicEnabled":true,"hapticsEnabled":true])
        view.layoutSubviews()
        XCTAssertEqual(view.scroll.frame.midX,410,accuracy:0.001)
        XCTAssertEqual(view.scroll.bounds.width,744)
        XCTAssertEqual(view.footer.frame.midX,410,accuracy:0.001)
        for row in view.rows {XCTAssertLessThanOrEqual(row.bounds.width,688)}
        XCTAssertEqual(writes,0)
    }
    func testCollectionGridIsCenteredWithBoundedCrateAndThreeColumnBackpack() {
        for crate in [false,true] {
            let view=NativeBackpackView(frame:CGRect(origin:.zero,size:sizes[1]),assets:assets,arcadeCrate:crate)
            view.apply([.init(title:"Forest",dice:NativeBackpackCatalog.forest,unlocked:[])])
            view.layoutSubviews();view.grid.layoutIfNeeded()
            XCTAssertEqual(view.grid.frame.midX,410,accuracy:0.001)
            let side=view.collectionView(view.grid,layout:view.grid.collectionViewLayout,sizeForItemAt:IndexPath(item:0,section:0))
            XCTAssertLessThanOrEqual(side.width,290)
            XCTAssertGreaterThan(side.width,180)
            let columns=3
            XCTAssertLessThanOrEqual(CGFloat(columns)*side.width+CGFloat(columns-1)*16+64,view.grid.bounds.width+1)
        }
    }
    func testBoxMatchesBackpackGridOnTabletAndRetainsPhoneLayout() throws {
        for size in sizes+[CGSize(width:390,height:844)] {
            let backpack=NativeBackpackView(frame:CGRect(origin:.zero,size:size),assets:assets)
            backpack.apply([.init(title:"Forest",dice:NativeBackpackCatalog.forest,unlocked:[])])
            let box=NativeBackpackView(frame:CGRect(origin:.zero,size:size),assets:assets,title:"Box",arcadeCrate:true)
            box.apply([])
            for view in [backpack,box] {view.layoutSubviews();view.grid.layoutIfNeeded()}
            XCTAssertEqual(box.grid.frame,backpack.grid.frame)
            let frames=try (0..<4).map{try XCTUnwrap(box.grid.collectionViewLayout.layoutAttributesForItem(at:IndexPath(item:$0,section:0))).frame}
            if NativeTabletLayout.applies(size) {
                for index in 0..<4 {
                    let reference=try XCTUnwrap(backpack.grid.collectionViewLayout.layoutAttributesForItem(at:IndexPath(item:index,section:0))).frame
                    XCTAssertEqual(frames[index],reference)
                }
                XCTAssertEqual(frames[0].minY,frames[2].minY,accuracy:0.01)
                XCTAssertGreaterThan(frames[3].minY,frames[0].minY)
            } else {
                XCTAssertEqual(frames[0].width,153)
                XCTAssertEqual(frames[0].minY,frames[1].minY)
                XCTAssertGreaterThan(frames[2].minY,frames[0].minY)
            }
        }
    }
    func testBackpackThreeColumnsAlignWithHeadersAndGainEqualVisibleGaps() throws {
        for size in sizes {
            let view=NativeBackpackView(frame:CGRect(origin:.zero,size:size),assets:assets)
            view.apply([.init(title:"Forest",dice:NativeBackpackCatalog.forest,unlocked:Set(NativeBackpackCatalog.forest.map(\.id)))])
            view.layoutSubviews();view.grid.layoutIfNeeded()
            let frames=try (0..<3).map{try XCTUnwrap(view.grid.collectionViewLayout.layoutAttributesForItem(at:IndexPath(item:$0,section:0))).frame}
            XCTAssertEqual(frames[0].minX,32,accuracy:0.01)
            XCTAssertEqual(frames[2].maxX,view.grid.bounds.width-32,accuracy:0.01)
            let leftGap=frames[1].minX-frames[0].maxX,rightGap=frames[2].minX-frames[1].maxX
            XCTAssertEqual(leftGap,rightGap,accuracy:0.01)
            let oldSide=floor((view.grid.bounds.width-96)/3),oldPainted=oldSide*0.97
            let oldGap=(view.grid.bounds.width-64-3*oldSide)/2+oldSide-oldPainted
            XCTAssertEqual(leftGap,oldGap+view.grid.bounds.width*0.02,accuracy:0.01)
            XCTAssertGreaterThanOrEqual(frames[0].width,oldPainted*0.95)
            XCTAssertLessThan(frames[0].width,oldPainted)
        }
    }
    func testJourneyHUDBackpackTabletUsesThreeColumnsAndWiderPaperOnly() throws {
        for (size,arcade,columns) in [(CGSize(width:820,height:1180),false,3),(CGSize(width:390,height:844),false,2),(CGSize(width:820,height:1180),true,2)] {
            let motion=NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets))
            let modal=NativeGameplayBackpackController(root:NativeTestResources.root,sections:[.init(title:"Forest",dice:NativeBackpackCatalog.forest,unlocked:[])],includesArcade:arcade,motion:motion)
            defer{modal.dispose()}
            modal.loadViewIfNeeded();modal.view.frame=CGRect(origin:.zero,size:size);modal.viewDidLayoutSubviews()
            let screen=try XCTUnwrap(modal.screen);screen.layoutIfNeeded();screen.grid.layoutIfNeeded()
            let frames=try (0..<columns+1).map{try XCTUnwrap(screen.grid.collectionViewLayout.layoutAttributesForItem(at:IndexPath(item:$0,section:0))).frame}
            for index in 1..<columns {XCTAssertEqual(frames[index].minY,frames[0].minY,accuracy:0.01)}
            XCTAssertGreaterThan(frames[columns].minY,frames[0].minY)
            if columns==3 {XCTAssertEqual(modal.card.convert(modal.card.bounds,to:modal.view).width,680,accuracy:0.01)}
            XCTAssertEqual(NativeTabletLayout.modalProjectionScale(of:modal.card),size.width>=600 ? 1.4:1)
        }
    }
    func testActualArcadeAndDetailUseLargerGeometryAndDisposeDuringEntry() throws {
        for size in sizes {
            let modal=NativeArcadeWorldModal(frame:CGRect(origin:.zero,size:size),assets:assets,index:0)
            modal.layoutSubviews()
            let paper=try XCTUnwrap(all(modal).first{$0.accessibilityIdentifier=="native.arcade-world-modal.paper"})
            XCTAssertEqual(paper.bounds.width,310,accuracy:0.001)
            XCTAssertEqual(paper.convert(paper.bounds,to:modal).width,434,accuracy:0.001)
            let play=try XCTUnwrap(all(modal).first{$0.accessibilityIdentifier=="native.arcade-world-modal.play"} as? UIButton)
            XCTAssertEqual(play.bounds.height,72,accuracy:0.001)
            XCTAssertEqual(play.convert(play.bounds,to:modal).height,100.8,accuracy:0.001)
            modal.setForeground(false);modal.dispose();modal.dispose();XCTAssertNil(modal.onFinish)
            let a=assets
            let detail=NativeBackpackDetail(die:NativeBackpackCatalog.arcade.first!,assets:a,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:a),hub:JimiV9HubView(frame:.zero,assets:a)))
            detail.loadViewIfNeeded();detail.view.frame=CGRect(origin:.zero,size:size);detail.viewDidLayoutSubviews()
            XCTAssertEqual(detail.card.bounds.width,310,accuracy:0.001)
            XCTAssertEqual(detail.card.convert(detail.card.bounds,to:detail.view).width,434,accuracy:0.001)
            XCTAssertLessThan(detail.card.bounds.height,size.height-80)
            detail.dispose();detail.dispose();XCTAssertNil(detail.onSpeechRequested)
        }
    }
    func testScoreHistoryStaysBoundedAndFontAdaptationRetainsAttributedColor() throws {
        var stats=NativeBoardStats();stats.scoreHistory=(1...10).map{.init(value:$0*100,date:Double($0))}
        let modal=NativeScoreModal(model:.init(boardStats:stats,combo:false),root:NativeTestResources.root)
        modal.loadViewIfNeeded();modal.view.frame=CGRect(origin:.zero,size:sizes[1]);modal.viewDidLayoutSubviews()
        let card=try XCTUnwrap(all(modal.view).first{$0.accessibilityIdentifier=="native.score-modal"})
        XCTAssertEqual(card.bounds.width,310)
        XCTAssertEqual(card.convert(card.bounds,to:modal.view).width,434,accuracy:0.001)
        XCTAssertLessThan(card.bounds.height,sizes[1].height-100)
        let rows=all(modal.view).filter{$0.accessibilityIdentifier?.hasPrefix("native.score-history.row.")==true}
        XCTAssertEqual(rows.count,3)
        for row in rows {XCTAssertLessThan(row.convert(row.bounds,to:card).maxY,card.bounds.height-30)}
        modal.setSuspended(true);modal.setSuspended(false);modal.dispose();modal.dispose();XCTAssertNil(modal.onClosed)
        let label=UILabel();label.font=assets.font(size:18)
        label.attributedText=NativeModalTypography.attributedSubtitle("Test",font:label.font)
        let before=label.attributedText?.attribute(.foregroundColor,at:0,effectiveRange:nil) as? UIColor
        XCTAssertNotNil(before)
        NativeTabletLayout.labelFont(label,size:20.7)
        XCTAssertEqual(label.font.pointSize,20.7,accuracy:0.001)
        XCTAssertEqual(label.attributedText?.attribute(.foregroundColor,at:0,effectiveRange:nil) as? UIColor,before)
    }
    func testWorldCanvasCentersWithoutNarrowingHeaderOrModalCoordinates() throws {
        let raw:[String:Any] = ["version":1,"worldID":1,"requestID":"ipad-layout","routeGeneration":1,"stateRevision":1,"title":"Forest","contentHeight":2400,"mainFrame":["x":0,"y":100,"width":390,"height":300],"mainParts":[],"units":[["id":"board-1","boardID":1,"frame":["x":30,"y":520,"width":150,"height":200],"cardArt":"assets/close-icon.png","locked":false,"interim":false,"stars":0,"allowedActions":["openCard","play"],"stats":[],"parts":[]]]]
        for size in sizes {
            let world=try XCTUnwrap(JimiNativeWorldView(snapshot:raw,assets:assets))
            world.frame=CGRect(origin:.zero,size:size);world.layoutSubviews()
            let expected=NativeTabletLayout.worldFrame(world.bounds)
            let canvas=try XCTUnwrap(world.scrollView.subviews.first{abs($0.bounds.width-expected.width)<0.01})
            XCTAssertEqual(canvas.frame.minX,expected.minX,accuracy:0.001)
            XCTAssertEqual(world.scrollView.bounds.width,size.width)
            XCTAssertEqual(world.headerGeometrySnapshot()["header"]?.width,size.width)
            world.park();world.cleanup();world.cleanup()
        }
    }
    func testRenderedTabletCardsScaleUniformlyAndKeepPhoneOffsetFromIsland() async throws {
        var progress=NativeProgressionState();progress.completedJourneyBoards=Set(1...30)
        let layouts=try NativeWorldLayouts()
        for worldID in 1...3 {
            let raw=try layouts.snapshot(world:worldID,width:820,height:1180,generation:1,progression:progress,proportionalCards:true,unitScale:1.105,unitHorizontalBleed:((820-680)/2-16)/(680.0/390))
            let phone=try XCTUnwrap(JimiNativeWorldSnapshot(try layouts.snapshot(world:worldID,width:390,height:844,generation:1,progression:progress)))
            let world=try XCTUnwrap(JimiNativeWorldView(snapshot:raw,assets:assets))
            world.frame=CGRect(x:0,y:0,width:820,height:1180);world.layoutIfNeeded()
            defer {world.cleanup()}
            let ready=expectation(description:"Actual tablet artwork ready")
            world.prepare{ready.fulfill()};await fulfillment(of:[ready],timeout:10)
            let id=(worldID-1)*10+1
            let card=try XCTUnwrap(all(world).first{$0.accessibilityIdentifier=="native.world.part.\(id).card"})
            let unit=try XCTUnwrap(all(world).first{$0.accessibilityIdentifier=="native.world.card.\(id)"})
            let scale=NativeTabletLayout.worldFrame(world.bounds).width/390*1.105
            XCTAssertEqual(card.bounds.width,90*scale,accuracy:0.01)
            XCTAssertEqual(card.bounds.height,133*scale,accuracy:0.01)
            if worldID>1 {
                let badge=try XCTUnwrap(all(card).first{$0.accessibilityIdentifier=="native.world.ribbon"})
                XCTAssertEqual(badge.bounds.width,56*scale,accuracy:0.01)
            }
            XCTAssertEqual(unit.bounds.width,card.bounds.width,accuracy:0.01)
            let island=try XCTUnwrap(all(world).first{$0.accessibilityIdentifier=="native.world.part.\(id).island"})
            let islandRect=island.convert(island.bounds,to:world)
            XCTAssertGreaterThanOrEqual(islandRect.minX,15.9)
            XCTAssertLessThanOrEqual(islandRect.maxX,world.bounds.width-15.9)
            let cardCenter=card.convert(CGPoint(x:card.bounds.midX,y:card.bounds.midY),to:world)
            let islandCenter=island.convert(CGPoint(x:island.bounds.midX,y:island.bounds.midY),to:world)
            let phoneCard=try XCTUnwrap(phone.units[0].parts.first{$0.role=="card"})
            let phoneIsland=try XCTUnwrap(phone.units[0].parts.first{$0.role=="island"})
            // Island authored height is intrinsic; compare horizontal centres and
            // the card centre against the island's unrotated top position.
            XCTAssertEqual((cardCenter.x-islandCenter.x)/scale,phoneCard.frame.midX-phoneIsland.frame.midX+(id==1 ? 12:0),accuracy:0.01)
            XCTAssertEqual(unit.bounds.height,133*scale,accuracy:0.01)
        }
    }
    func testPhoneMetricsAndResultGeometryRemainOriginalWhileTabletResultFits() {
        let phone=CGSize(width:390,height:844)
        XCTAssertFalse(NativeTabletLayout.applies(phone));XCTAssertEqual(NativeTabletLayout.textScale(phone),1)
        XCTAssertEqual(NativeTabletLayout.journeyScale(phone),1)
        XCTAssertEqual(NativeTabletLayout.paperWidth(phone),310)
        let old=NativeResultPresentationPlan.layout(viewport:phone,clean:true,titleHeight:40)
        XCTAssertEqual(old.card.width,340);XCTAssertEqual(old.hero.width,280)
        for size in sizes {
            let layout=NativeResultPresentationPlan.layout(viewport:size,clean:true,titleHeight:46,primarySize:CGSize(width:280,height:92))
            XCTAssertEqual(layout.card.width,440)
            XCTAssertGreaterThan(layout.card.minY,40)
            XCTAssertLessThan(layout.secondary.maxY,size.height-40)
            let canvas=NativeTabletLayout.worldFrame(CGRect(origin:.zero,size:size))
            XCTAssertEqual(canvas.midX,size.width/2)
            XCTAssertLessThanOrEqual(canvas.width,680)
            XCTAssertEqual(canvas.height,size.height)
        }
    }
}
