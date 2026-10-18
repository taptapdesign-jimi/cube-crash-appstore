import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeArcadeHubTests: XCTestCase {
    private func make() -> NativeArcadeHubView {
        NativeArcadeHubView(frame:CGRect(x:0,y:0,width:375,height:812),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
    }
    func testWorldSelectionUsesMatchingModalAndCleanupRejectsStalePlay() {
        let view = make(); view.present(); view.layoutIfNeeded()
        for (index,title) in ["Endurance","One Lucky Drop","Slow Burn"].enumerated() {
            view.hub.onWorld?(view.hub.worldIDs[index])
            let modal = view.subviews.last!
            XCTAssertEqual(modal.accessibilityIdentifier,"native.arcade-world-modal")
            func labels(_ root:UIView)->[UILabel] { root.subviews.flatMap { ($0 as? UILabel).map {[$0]} ?? labels($0) } }
            XCTAssertTrue(labels(modal).contains { $0.text == title })
            view.hide(); view.hide()
            XCTAssertFalse(view.subviews.contains { $0 === modal })
            XCTAssertFalse(view.hub.accessibilityElementsHidden)
            view.present()
        }
    }
    func testCascadeAndHiddenLifecycleStayBounded() {
        let view = make(); view.present(); view.layoutIfNeeded()
        XCTAssertEqual(view.tracks(enter:true).count,4)
        XCTAssertEqual(view.tracks(enter:false).count,4)
        view.suspend(); view.resume(); view.hide(); view.resume()
        for unit in view.hub.worldUnits {
            XCTAssertNil(unit.layer.animationKeys())
            XCTAssertLessThanOrEqual(unit.frame.maxX,view.bounds.width)
            XCTAssertGreaterThanOrEqual(unit.frame.minX,0)
        }
        XCTAssertTrue(view.isHidden)
    }
    func testCloseAcceptsFirstIncomingTapAndRejectsDuplicatesUntilReopen() {
        let view=make();var closes=0;view.onClose={closes += 1}
        view.present();view.hub.onBack?();view.hub.onBack?()
        XCTAssertEqual(closes,1)
        view.hide();view.hub.onBack?();XCTAssertEqual(closes,1)
        view.present();view.hub.onBack?();XCTAssertEqual(closes,2)
    }
    func testEveryDescriptionFitsAndArtworkClearsTextAndCTAAtSmallWidths() throws {
        func find(_ root:UIView,_ id:String)->UIView? {
            if root.accessibilityIdentifier == id { return root }
            return root.subviews.lazy.compactMap { find($0,id) }.first
        }
        for size in [CGSize(width:320,height:568),CGSize(width:375,height:812),CGSize(width:390,height:844)] {
            let view=NativeArcadeHubView(frame:CGRect(origin:.zero,size:size),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
            for id in view.hub.worldIDs {
                view.present();view.layoutIfNeeded();view.hub.onWorld?(id)
                let text=try XCTUnwrap(find(view,"native.arcade-world-modal.description") as? UILabel)
                let art=try XCTUnwrap(find(view,"native.arcade-world-modal.art"))
                let play=try XCTUnwrap(find(view,"native.arcade-world-modal.play"))
                let measured=text.sizeThatFits(CGSize(width:text.bounds.width,height:CGFloat.greatestFiniteMagnitude))
                XCTAssertLessThanOrEqual(measured.height,text.bounds.height+0.5,"Full description at \(size), world \(id)")
                XCTAssertEqual(text.numberOfLines,id == view.hub.worldIDs[0] ? 2 : 3)
                let full=try XCTUnwrap(text.attributedText)
                let uncapped=full.boundingRect(with:CGSize(width:text.bounds.width,height:.greatestFiniteMagnitude),options:[.usesLineFragmentOrigin,.usesFontLeading],context:nil)
                XCTAssertLessThanOrEqual(ceil(uncapped.height),text.bounds.height+0.5,"Line limit must not truncate copy")
                XCTAssertLessThanOrEqual(text.bounds.height,ceil(19*1.3*Double(text.numberOfLines))+0.5)
                XCTAssertGreaterThan(art.bounds.height,40)
                XCTAssertLessThanOrEqual(art.bounds.width,(min(390,size.width-40)-30)*0.8+0.5)
                XCTAssertEqual(art.frame.minY-text.frame.maxY,24,accuracy:0.01)
                XCTAssertEqual(play.frame.minY-art.frame.maxY,32,accuracy:0.01)
                let close=try XCTUnwrap(find(view,"native.arcade-world-modal.close") as? JimiV9PlainButton)
                for enabled in [true,false,true] {
                    close.isEnabled=enabled;close.setNeedsLayout();close.layoutIfNeeded()
                    XCTAssertEqual(close.imageView?.alpha ?? 0,0.8,accuracy:0.0001)
                    XCTAssertEqual(try XCTUnwrap(close.imageView).bounds.size,CGSize(width:24,height:24))
                    XCTAssertEqual(close.bounds.size,CGSize(width:52,height:52))
                }
                let paper=try XCTUnwrap(find(view,"native.arcade-world-modal.paper"))
                if id == view.hub.worldIDs[1] {
                    XCTAssertEqual(text.text,"Get one lucky Special die\nto help you per round.")
                    XCTAssertEqual(text.frame.minX,paper.bounds.width*0.1,accuracy:0.01)
                    XCTAssertEqual(text.bounds.width,paper.bounds.width*0.8,accuracy:0.01)
                }
                XCTAssertEqual(play.bounds.width,226,accuracy:0.01)
                XCTAssertEqual(play.bounds.height,64,accuracy:0.01)
                XCTAssertEqual(play.frame.midX,paper.bounds.midX,accuracy:0.01)
                XCTAssertEqual(paper.bounds.height-play.frame.maxY,40,accuracy:0.01)
                view.hide()
            }
        }
    }
    func testMountedHubAndModalCapturePhoneAndSmallViewportEvidence() async throws {
        enum Unused:Error { case unavailable }
        let services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw Unused.unavailable},markViewed:{_ in},makeGameplay:{_,_ in throw Unused.unavailable},flush:{})
        func waitFor(_ predicate:()->Bool)async throws {
            let deadline=Date().addingTimeInterval(8)
            while !predicate(),Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertTrue(predicate())
        }
        func find(_ root:UIView,_ id:String)->UIView? {
            if root.accessibilityIdentifier == id { return root }
            return root.subviews.lazy.compactMap { find($0,id) }.first
        }
        func capture(_ view:UIView,_ filename:String)throws {
            let renderer=UIGraphicsImageRenderer(bounds:view.bounds)
            let image=renderer.image { _ in XCTAssertTrue(view.drawHierarchy(in:view.bounds,afterScreenUpdates:true)) }
            try XCTUnwrap(image.pngData()).write(to:URL(fileURLWithPath:"/tmp/"+filename))
            let attachment=XCTAttachment(image:image);attachment.name=filename;attachment.lifetime = .keepAlways;add(attachment)
        }
        for size in [CGSize(width:390,height:844),CGSize(width:320,height:568)] {
            let controller=NativeAppController(resourceRoot:NativeTestResources.root,services:services)
            let window=UIWindow(frame:CGRect(origin:.zero,size:size));window.rootViewController=controller;window.makeKeyAndVisible()
            defer { controller.dispose();window.isHidden=true }
            controller.loadViewIfNeeded()
            try await waitFor { controller.home.isUserInteractionEnabled }
            controller.home.onActivate?(1)
            try await waitFor { controller.route == .arcadeHub && controller.arcadeHub.hub.scrollView.isUserInteractionEnabled }
            let suffix=size.width == 390 ? "" : "-320"
            try capture(controller.view,"arcade-hub-preview"+suffix+".png")
            var previousArtworkTop:CGFloat=0
            let headerFrame=controller.arcadeHub.hub.header.convert(controller.arcadeHub.hub.header.bounds,to:controller.view)
            for (index,id) in controller.arcadeHub.hub.worldIDs.enumerated() {
                let art=try XCTUnwrap(find(controller.arcadeHub,"native.arcade-hub.art.\(id)"))
                let frame=art.convert(art.bounds,to:controller.view)
                XCTAssertGreaterThanOrEqual(frame.minY,headerFrame.maxY+19)
                XCTAssertLessThanOrEqual(frame.maxY,controller.arcadeHub.hub.scrollView.contentSize.height-controller.view.safeAreaInsets.bottom)
                XCTAssertGreaterThanOrEqual(frame.minX,0);XCTAssertLessThanOrEqual(frame.maxX,controller.view.bounds.width)
                if index>0 { XCTAssertGreaterThan(frame.minY,previousArtworkTop) }
                if index==1 { XCTAssertGreaterThan(frame.midX,controller.view.bounds.midX) }
                else { XCTAssertLessThan(frame.midX,controller.view.bounds.midX) }
                previousArtworkTop=frame.minY
                let ratios:[CGFloat]=[276.0/290,218.0/290,245.0/290]
                let available=controller.view.bounds.height-controller.view.safeAreaInsets.bottom-20-(headerFrame.maxY+20)
                let baseline=min(size.width*0.676,273,max(0,(available-40)/ratios.reduce(0,+)))
                let enlargedWidth=baseline*1.2
                XCTAssertEqual(frame.width,enlargedWidth*0.96*(index == 1 ? 1.1 : 1),accuracy:0.1)
                let originalGap=(available-enlargedWidth*ratios.reduce(0,+))/2
                let precedingHeight=ratios.prefix(index).reduce(0,+)*enlargedWidth+CGFloat(index)*originalGap
                let artworkScale:CGFloat = index == 1 ? 1.1 : 1
                let expectedY=headerFrame.maxY+20+precedingHeight+[-4,31,49][index]+enlargedWidth*ratios[index]*(1-0.96*artworkScale)/2
                XCTAssertEqual(frame.minY,expectedY,accuracy:0.15)
            }
            XCTAssertGreaterThanOrEqual(controller.arcadeHub.hub.scrollView.contentSize.height,controller.arcadeHub.hub.bounds.height)
            for unit in controller.arcadeHub.hub.worldUnits {
                XCTAssertGreaterThanOrEqual(unit.frame.minX,0)
                XCTAssertLessThanOrEqual(unit.frame.maxX,size.width)
            }
            for (index,unit) in controller.arcadeHub.hub.worldUnits.enumerated() {
            unit.sendActions(for:.touchUpInside)
            try await waitFor { find(controller.arcadeHub,"native.arcade-world-modal.play") != nil }
            let play=try XCTUnwrap(find(controller.arcadeHub,"native.arcade-world-modal.play") as? UIButton)
            try await waitFor { play.isEnabled }
            let playFrame=play.convert(play.bounds,to:controller.view)
            XCTAssertTrue(controller.view.bounds.contains(playFrame),"CTA must fit at \(size)")
            let paper=try XCTUnwrap(find(controller.arcadeHub,"native.arcade-world-modal.paper"))
            let paperFrame=paper.convert(paper.bounds,to:controller.view)
            XCTAssertGreaterThanOrEqual(paperFrame.minY,controller.view.safeAreaInsets.top)
            XCTAssertLessThanOrEqual(paperFrame.maxY,controller.view.bounds.height-controller.view.safeAreaInsets.bottom)
            // Authored spacing is measured within the now-rotated content plane.
            let content=try XCTUnwrap(paper.superview)
            let localPlay=play.convert(play.bounds,to:content)
            XCTAssertEqual(paper.frame.maxY-localPlay.maxY,40,accuracy:0.1)
            XCTAssertEqual(play.bounds.width,226,accuracy:0.1)
            XCTAssertEqual(play.bounds.height,64,accuracy:0.1)
            XCTAssertEqual(localPlay.midX,paper.frame.midX,accuracy:0.1)
            let tilt=try XCTUnwrap(content.superview)
            let originalTilt=tilt.transform
            let degrees=atan2(originalTilt.b,originalTilt.a)*180 / .pi
            XCTAssertLessThanOrEqual(abs(degrees),2.501)
            XCTAssertEqual(degrees*2,(degrees*2).rounded(),accuracy:0.001)
            controller.arcadeHub.setNeedsLayout();controller.arcadeHub.layoutIfNeeded()
            XCTAssertEqual(tilt.transform,originalTilt)
            let modeSuffix = index == 0 ? "" : index == 1 ? "-pure-dice" : "-slow-burn"
            try capture(controller.view,"arcade-modal-preview"+suffix+modeSuffix+".png")
            let close=try XCTUnwrap(find(controller.arcadeHub,"native.arcade-world-modal.close") as? UIButton)
            close.sendActions(for:.touchUpInside)
            try await waitFor { find(controller.arcadeHub,"native.arcade-world-modal.play") == nil }
            }
        }
    }

}
