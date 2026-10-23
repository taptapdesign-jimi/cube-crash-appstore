import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeBloobBallTests:XCTestCase {
    func testGasUsesBarrelTimingAndActualGasFramesWithBloobCaption()throws {
        let root=NativeTestResources.root
        let gas=NativeTntVariantPresentation(resourceRoot:root,variant:.bloobGas,viewport:.init(width:390,height:844),random:{0.5})
        let barrel=NativeTntVariantPresentation(resourceRoot:root,variant:.barell,viewport:.init(width:390,height:844),random:{0.5})
        defer{gas.dispose();barrel.dispose()}
        XCTAssertTrue(gas.assetsReady);XCTAssertEqual(gas.duration,barrel.duration)
        let field=try XCTUnwrap(gas.subviews.compactMap{$0 as? NativeSplashGlyphField}.first)
        let letters=try XCTUnwrap(field.subviews.first).subviews.compactMap{$0 as? UILabel}
        XCTAssertEqual(letters.compactMap(\.text).joined(),"GASSS!")
        XCTAssertTrue(letters.allSatisfy{$0.textColor.withAlphaComponent(1)==UIColor.white && $0.textColor.cgColor.alpha>=0.8 && $0.subviews.count==4})
        let clouds=gas.subviews.suffix(13).prefix(12).compactMap{$0 as? UIImageView}
        let original=barrel.subviews.suffix(13).prefix(12).compactMap{$0 as? UIImageView}
        XCTAssertEqual(clouds.count,12);XCTAssertEqual(gas.subviews.count,barrel.subviews.count)
        let artwork=JimiV9Artwork(resourceRoot:root)
        for i in 0..<12 {
            let expected=artwork.image("assets/shop/bloog ball/gas animation/gas\(i+1).png",densityAware:true)
            XCTAssertEqual(try XCTUnwrap(clouds[i].image).pngData(),try XCTUnwrap(expected).pngData())
        }
        var cues:[String]=[],frameSix=0,complete=0
        gas.onCue={moment,_ in cues.append(moment)};gas.onSprite6Entered={frameSix+=1};gas.onVisualSequenceComplete={complete+=1}
        for t in [0.0,0.07,0.31,0.509,0.51,0.91,1.2,1.75,4.2,4.2] {
            gas.paint(seconds:t);barrel.paint(seconds:t)
            for i in 0..<12 {
                XCTAssertEqual(clouds[i].center,original[i].center)
                XCTAssertLessThanOrEqual(clouds[i].alpha,original[i].alpha+0.000001)
                XCTAssertGreaterThanOrEqual(clouds[i].alpha,original[i].alpha*0.3-0.000001)
                if clouds[i].alpha>0 && t>0.07+Double(i)*0.04 {
                    let a=clouds[i].transform,b=original[i].transform
                    let x=hypot(a.a,a.b)/hypot(b.a,b.b),y=hypot(a.c,a.d)/(hypot(b.c,b.d)/1.4)
                    XCTAssertGreaterThanOrEqual((x+y)/2,0.7-0.00001);XCTAssertLessThanOrEqual((x+y)/2,0.98+0.00001)
                    XCTAssertTrue((0.55999...1.17601).contains(x));XCTAssertTrue((0.55999...1.17601).contains(y))
                    XCTAssertGreaterThan(atan2(a.b,a.a),atan2(b.b,b.a))
                }
            }
            if t<0.51 {XCTAssertEqual(frameSix,0)}
        }
        gas.paint(seconds:0.8);barrel.paint(seconds:0.8)
        let grown=clouds[0].transform,reference=original[0].transform
        let grownX=hypot(grown.a,grown.b)/hypot(reference.a,reference.b)
        let grownY=hypot(grown.c,grown.d)/(hypot(reference.c,reference.d)/1.4)
        XCTAssertEqual((grownX+grownY)/2,0.98,accuracy:0.00001,"Settled gas grows40percent above0.7 baseline")
        XCTAssertGreaterThan(Set(clouds.map{Int(($0.alpha*1000).rounded())}).count,3,"Layers fade independently")
        XCTAssertTrue(clouds.contains{$0.alpha<0.5 && $0.alpha>0.29},"Some gas layers remain airy below50percent")
        gas.paint(seconds:1.21)
        XCTAssertLessThanOrEqual(clouds[5].alpha,0.400001,"Pointed gas6 is at most40percent at its exit")
        gas.paint(seconds:4.2)
        XCTAssertEqual(frameSix,1);XCTAssertEqual(complete,1);XCTAssertEqual(cues,["rise","smoke"])
        XCTAssertTrue(clouds.allSatisfy{$0.alpha==0})
        let canvas=UIView(frame:CGRect(x:0,y:0,width:390,height:844));canvas.backgroundColor=UIColor(red:0.97,green:0.94,blue:0.89,alpha:1)
        canvas.addSubview(gas);gas.frame=canvas.bounds;gas.layoutIfNeeded();gas.paint(seconds:1.2)
        let png=UIGraphicsImageRenderer(bounds:canvas.bounds).image{canvas.layer.render(in:$0.cgContext)}.pngData()
        try XCTUnwrap(png).write(to:FileManager.default.temporaryDirectory.appendingPathComponent("bloob-gas-finale-1.2.png"))
        gas.paint(seconds:0.31);XCTAssertTrue(clouds.contains{$0.alpha>0})
        XCTAssertEqual(cues,["rise","smoke"],"Backward inspection never duplicates cues")
    }
    func testSelectedGasResourcesExcludeOldFloatingFinaleAndRelease()async throws {
        var selected:NativeSelectedUIKitFinaleArtworkOwner?=NativeSelectedUIKitFinaleArtworkOwner(root:NativeTestResources.root,generation:7,current:{true})
        weak var weakOwner=selected
        let specs=try XCTUnwrap(NativeSelectedUIKitFinaleArtworkOwner.assets("bloob-ball"))
        XCTAssertEqual(specs.filter{$0.path.contains("gas animation")}.count,12)
        XCTAssertTrue(specs.allSatisfy{$0.densityAware});XCTAssertFalse(specs.contains{$0.path.hasSuffix(".svg")})
        selected?.prepare(variant:"bloob-ball")
        let deadline=Date().addingTimeInterval(15)
        while selected?.readyFamilies.contains("bloob-ball") != true,Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertTrue(selected?.readyFamilies.contains("bloob-ball")==true)
        selected?.dispose();selected=nil;try await Task.sleep(for:.milliseconds(50));XCTAssertNil(weakOwner)
        weak var weakFinale:NativeTntVariantPresentation?
        autoreleasepool {
            let finale=NativeTntVariantPresentation(resourceRoot:NativeTestResources.root,variant:.bloobGas,viewport:.init(width:390,height:844))
            weakFinale=finale
            finale.setSuspended(true);XCTAssertFalse(finale.hasActiveClock)
            finale.dispose();finale.dispose()
        }
        try await Task.sleep(for:.milliseconds(50));XCTAssertNil(weakFinale)
    }
    func testInheritedBarrelAudioHalfGainAndOriginalBloobOverlay() {
        let original=(NativeAuthoredAudioCatalog.groups["barrel"] ?? []).filter{$0.voice != "barrel-merge6-tnt3"}
        let borrowed=NativeBloobBallAudio.barrelLayer("barrel")
        XCTAssertEqual(borrowed.count,original.count)
        for (a,b) in zip(original,borrowed) {XCTAssertEqual(a.source,b.source);XCTAssertEqual(b.gain,a.voice == "regular-merge6-boom" ? 0.5:a.gain*0.5);XCTAssertEqual(a.delay,b.delay);XCTAssertEqual(a.rate,b.rate);XCTAssertNotEqual(a.voice,b.voice)}
        let merge=NativeBloobBallAudio.cues("merge")
        XCTAssertEqual(merge.count,original.count+2);XCTAssertEqual(merge.last?.gain,0.4284)
        XCTAssertEqual(NativeBloobBallAudio.cues("rise").map(\.gain),[0.18,0.6])
        let smoke=NativeBloobBallAudio.cues("smoke")
        XCTAssertEqual(smoke.count,5);XCTAssertEqual(smoke.first?.gain,0.105)
        XCTAssertTrue(smoke.contains{$0.source.hasSuffix("juice/mini2.mp3") && $0.gain==0.39 && $0.delay==0.09})
        let leak=merge.filter{$0.source.hasSuffix("/massive gas leak.wav")}
        XCTAssertEqual(leak.count,1);XCTAssertEqual(leak.first?.gain,0.6);XCTAssertEqual(leak.first?.delay,0)
        let all=merge+smoke+NativeBloobBallAudio.cues("rise")
        XCTAssertFalse(all.contains{$0.source.hasSuffix("/tnt3.wav") || $0.source.hasSuffix("/crash.wav") || $0.source.contains("/hovering")})
        let sources=Set(NativeMeterSelectedAudioCatalog.sources(special:"wild-tnt",variant:"bloob-ball") ?? [])
        for cue in merge+smoke+NativeBloobBallAudio.cues("rise") {XCTAssertTrue(sources.contains(cue.source) || sources.contains("./"+cue.source),cue.source)}
    }
    func testBoardIdleFloatsWithoutSquashAndPausesWhileCollectionKeepsOriginalPose()async throws {
        let textures=NativeBoardTextures(root:NativeTestResources.root)
        let board=NativeBoardScene(engine:NativeGameplayEngine(state:.init(tiles:[])),
            resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844))
        let die=NativeDiceNode(id:"bloob-idle-scope",value:6,kind:"wild",variant:"bloob-ball",depth:1,locked:false,textures:textures)
        board.addChild(die)
        defer{die.dispose();textures.dispose();board.dispose()}
        var found:SKSpriteNode?
        for _ in 0..<600 {
            let candidate=die.visual.children.compactMap{$0 as? SKSpriteNode}.last
            if let candidate,!candidate.isHidden,candidate.texture != nil,candidate.size==CGSize(width:128,height:128) {found=candidate}
            if found != nil{break};try await Task.sleep(for:.milliseconds(20))
        }
        let art=try XCTUnwrap(found)
        var highest:CGFloat=0,lowest:CGFloat=0
        for _ in 0..<200 {
            die.tick(1.0/60,suspended:false,viewportCenter:195)
            XCTAssertEqual(art.xScale,1);XCTAssertEqual(art.yScale,1)
            highest=max(highest,art.position.y);lowest=min(lowest,art.position.y)
        }
        XCTAssertGreaterThan(highest,10);XCTAssertLessThan(lowest,-12)
        let held=art.position;die.tick(1,suspended:true,viewportCenter:195);XCTAssertEqual(art.position,held)
        let collection=SKScene(size:board.size)
        die.removeFromParent();collection.addChild(die);die.tick(0.2,suspended:false,viewportCenter:195)
        XCTAssertNotEqual(art.xScale,1,"Only the board flattens authored breathing")
    }
    private final class AudioTransport:NativeGameplayAudioTransport {
        var cues:[NativeAudioCue]=[],stops=0
        func play(_ cue:NativeAudioCue){cues.append(cue)}
        func stopAll(){stops+=1}
        func dispose(){stopAll()}
    }
    func testActualAudioOwnerGatesRepeatedBurstSettingsBackgroundAndGeneration() {
        let transport=AudioTransport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:transport)
        defer{owner.dispose()}
        owner.specialMoment(variant:"bloob-ball",moment:"burst",index:0,receipt:1,generation:1)
        XCTAssertEqual(transport.cues.count,4)
        XCTAssertTrue(transport.cues.last?.source.hasSuffix("juice/mini2.mp3")==true)
        owner.specialMoment(variant:"bloob-ball",moment:"burst",index:0,receipt:1,generation:1)
        XCTAssertEqual(transport.cues.count,4)
        owner.setEnabled(false);owner.specialMoment(variant:"bloob-ball",moment:"burst",index:1,receipt:2,generation:1)
        owner.setEnabled(true);owner.setForeground(false);owner.specialMoment(variant:"bloob-ball",moment:"rise",receipt:3,generation:1)
        XCTAssertEqual(transport.cues.count,4);XCTAssertGreaterThanOrEqual(transport.stops,2)
        owner.setForeground(true);owner.beginGeneration(2)
        owner.specialMoment(variant:"bloob-ball",moment:"burst",index:2,receipt:4,generation:1)
        XCTAssertEqual(transport.cues.count,4)
        owner.specialMoment(variant:"bloob-ball",moment:"burst",index:2,receipt:4,generation:2)
        XCTAssertEqual(transport.cues.count,8)
    }
}
