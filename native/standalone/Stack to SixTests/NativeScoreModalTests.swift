import XCTest
import UIKit
import CoreText
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeScoreModalTests:XCTestCase {
    func testBenchmarkPaperReusesOriginalPixelsAndUniformCoverAcrossResize() throws {
        // User2026-11-07 restored the original benchmark material. A fitted
        // per-size raster and invariant cropped corner pixels are retired.
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let original=try XCTUnwrap(assets.image("assets/modals/paper.png"))
        weak var retired:NativeModalPaperView?
        try autoreleasepool {
            let paper=NativeModalPaperView();retired=paper;paper.prepare(assets:assets)
            let close=try XCTUnwrap(paper.closeMaterial)
            var firstPaint:Data?
            for height in [CGFloat(280),420,620,280] {
                JimiNativeModalV10.paperLayout(paper,bounds:CGRect(x:0,y:0,width:310,height:height),bottomExtension:96)
                paper.layoutIfNeeded()
                XCTAssertTrue(paper.image === original);XCTAssertTrue(paper.closeMaterial === close)
                let uv=paper.layer.contentsRect
                XCTAssertEqual(original.size.width*uv.width*paper.textureScale,paper.bounds.width,accuracy:0.000001)
                XCTAssertEqual(original.size.height*uv.height*paper.textureScale,paper.bounds.height,accuracy:0.000001)
                XCTAssertGreaterThanOrEqual(uv.minX,0);XCTAssertLessThanOrEqual(uv.maxX,1)
                XCTAssertGreaterThanOrEqual(uv.minY,0);XCTAssertLessThanOrEqual(uv.maxY,1)
                XCTAssertNil(paper.layer.mask)
                let format=UIGraphicsImageRendererFormat();format.scale=1;format.opaque=false
                let paint=UIGraphicsImageRenderer(bounds:paper.bounds,format:format).pngData{paper.layer.render(in:$0.cgContext)}
                if height==280 {if let firstPaint {XCTAssertEqual(paint,firstPaint)}else{firstPaint=paint}}
                let count=paper.fitCount
                paper.prepare(assets:assets);paper.fit(in:paper.frame)
                XCTAssertTrue(paper.image === original);XCTAssertEqual(paper.fitCount,count)
            }
        }
        XCTAssertNil(retired)
    }
    func testOneTwoThreeHistoryRowsReuseBenchmarkImageAndJoinedCloseWithoutChangingSpacing() throws {
        func all(_ view:UIView)->[UIView] {[view]+view.subviews.flatMap(all)}
        let output=URL(fileURLWithPath:"/tmp/shared-paper-20261106/renders")
        try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
        for size in [CGSize(width:390,height:844),CGSize(width:820,height:1180)] {for combo in [false,true] {
            var previous:CGFloat=0
            for count in 1...3 {
                var stats=NativeBoardStats()
                stats.scoreHistory=(1...count).map{.init(value:$0*1000,date:Double($0))}
                stats.comboHistory=(1...count).map{.init(value:$0*10,date:Double($0))}
                let modal=NativeScoreModal(model:.init(boardStats:stats,combo:combo),root:NativeTestResources.root,deferredEntry:true)
                defer{modal.dispose()}
                modal.loadViewIfNeeded();modal.view.frame=CGRect(origin:.zero,size:size);modal.view.setNeedsLayout();modal.view.layoutIfNeeded()
                let paper=try XCTUnwrap(all(modal.view).compactMap{$0 as? NativeModalPaperView}.first)
                let image=try XCTUnwrap(paper.image)
                let original=try XCTUnwrap(JimiV9Artwork(resourceRoot:NativeTestResources.root).image("assets/modals/paper.png"))
                XCTAssertEqual(image.size,original.size)
                XCTAssertEqual(image.pngData(),original.pngData())
                let uv=paper.layer.contentsRect
                XCTAssertEqual(image.size.width*uv.width*paper.textureScale,paper.bounds.width,accuracy:0.000001)
                XCTAssertEqual(image.size.height*uv.height*paper.textureScale,paper.bounds.height,accuracy:0.000001)
                XCTAssertGreaterThan(paper.bounds.height,previous);previous=paper.bounds.height
                XCTAssertEqual(all(modal.view).filter{$0.accessibilityIdentifier?.hasPrefix("native.score-history.row.")==true}.count,count)
                let close=try XCTUnwrap(all(modal.view).first{$0.accessibilityIdentifier=="native.score-modal.close"} as? UIButton)
                XCTAssertNil(close.backgroundImage(for:.normal),"The joined tab borrows the same original texture plane")
                let mask=try XCTUnwrap(paper.layer.mask as? CAShapeLayer)
                let bodyCenter=CGPoint(x:paper.bodyFrame.midX-paper.frame.minX,y:paper.bodyFrame.midY-paper.frame.minY)
                let closeCenter=CGPoint(x:close.center.x-paper.frame.minX,y:close.center.y-paper.frame.minY)
                XCTAssertTrue(mask.path?.contains(bodyCenter)==true)
                XCTAssertTrue(mask.sublayers?.compactMap{$0 as? CAShapeLayer}.contains{$0.path?.contains(closeCenter)==true}==true)
                XCTAssertFalse(paper.clipsToBounds)
                let painted=try XCTUnwrap(paper.superview)
                try UIGraphicsImageRenderer(bounds:painted.bounds).pngData{painted.layer.render(in:$0.cgContext)}.write(to:output.appendingPathComponent("history-\(combo)-\(count)-\(Int(size.width)).png"))
            }
        }}
    }
    func testHistoryStripsUseSettingsRadiusOnPhoneAndRetainTabletModalRadius() throws {
        for size in [CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            for combo in [false,true] {
                var stats=NativeBoardStats()
                stats.scoreHistory=[.init(value:4800,date:1)]
                stats.comboHistory=[.init(value:48,date:1)]
                let modal=NativeScoreModal(model:.init(boardStats:stats,combo:combo),root:NativeTestResources.root,deferredEntry:true)
                defer {modal.dispose()}
                modal.loadViewIfNeeded();modal.view.frame=CGRect(origin:.zero,size:size)
                modal.view.setNeedsLayout();modal.view.layoutIfNeeded()
                func all(_ view:UIView)->[UIView] {[view]+view.subviews.flatMap(all)}
                let row=try XCTUnwrap(all(modal.view).first{$0.accessibilityIdentifier=="native.score-history.row.0"})
                row.setNeedsLayout();row.layoutIfNeeded()
                let paper=try XCTUnwrap(row.subviews.first{$0 is UIImageView})
                let expected=NativeTabletLayout.applies(size) ? NativeTabletLayout.paperCornerRadius(in:paper):NativeTabletLayout.settingsPaperCornerRadius(size)
                XCTAssertEqual(paper.layer.cornerRadius,expected,accuracy:0.001)
                XCTAssertEqual(row.layer.shadowPath,UIBezierPath(roundedRect:row.bounds,cornerRadius:min(expected,row.bounds.height/2)).cgPath)
            }
        }
    }
    func testHistoryDatesUseMinutesTodayYesterdayThenOriginalDate() throws {
        var calendar=Calendar(identifier:.gregorian)
        calendar.timeZone=try XCTUnwrap(TimeZone(identifier:"Europe/Zagreb"))
        let now=try XCTUnwrap(calendar.date(from:DateComponents(year:2026,month:11,day:3,hour:12)))
        func text(_ elapsed:TimeInterval)->String {NativeScoreHistoryDate.text(now.addingTimeInterval(-elapsed).timeIntervalSince1970,now:now,calendar:calendar)}
        XCTAssertEqual(text(0),"Just now");XCTAssertEqual(text(59),"Just now")
        XCTAssertEqual(text(60),"1min ago");XCTAssertEqual(text(300),"5min ago")
        XCTAssertEqual(text(2700),"45min ago");XCTAssertEqual(text(3599),"59min ago");XCTAssertEqual(text(3600),"Today")
        XCTAssertEqual(text(86400),"Yesterday");XCTAssertEqual(text(172800),"01.11.2026")
        XCTAssertEqual(NativeScoreHistoryDate.text(nil,now:now,calendar:calendar),"--/--")
        let midnight=try XCTUnwrap(calendar.date(from:DateComponents(year:2026,month:11,day:3)))
        XCTAssertEqual(NativeScoreHistoryDate.text(midnight.addingTimeInterval(-60).timeIntervalSince1970,now:midnight,calendar:calendar),"Yesterday")
        // Yesterday can last 25 hours when the local clock leaves daylight saving time.
        let afterDST=try XCTUnwrap(calendar.date(from:DateComponents(year:2026,month:10,day:26,hour:0,minute:30)))
        let yesterday=try XCTUnwrap(calendar.date(from:DateComponents(year:2026,month:10,day:25,hour:0,minute:15)))
        XCTAssertEqual(NativeScoreHistoryDate.text(yesterday.timeIntervalSince1970,now:afterDST,calendar:calendar),"Yesterday")
    }
    func testJourneyHistoryProjectsTopThreeAndNeverInventsLegacyDate() {
        var stats=NativeBoardStats();stats.highScore=400
        let legacy=NativeScoreModalModel(boardStats:stats,combo:false)
        XCTAssertEqual(legacy.title,"High score");XCTAssertEqual(legacy.history,[.init(value:400,date:nil)])
        stats.comboHistory=[.init(value:2,date:10),.init(value:8,date:12),.init(value:8,date:11),.init(value:4,date:1)]
        let top=NativeScoreModalModel(boardStats:stats,combo:true)
        XCTAssertEqual(top.title,"Best combo");XCTAssertEqual(top.history.map(\.value),[8,8,4]);XCTAssertEqual(top.history.first?.date,12)
    }
    func testScoreAndComboTitlesRetainVisible32ptWithoutHeightShrink() throws {
        for size in [CGSize(width:320,height:568),CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            for combo in [false,true] {for history in [false,true] {
                let model=history ? NativeScoreModalModel(boardStats:NativeBoardStats(),combo:combo)
                    : NativeScoreModalModel(state:NativeBoardFactory.make(mode:.journey,board:1),progression:NativeProgressionState(),combo:combo)
                let modal=NativeScoreModal(model:model,root:NativeTestResources.root,deferredEntry:true)
                defer{modal.dispose()}
                modal.loadViewIfNeeded();modal.view.frame=CGRect(origin:.zero,size:size);modal.view.setNeedsLayout();modal.view.layoutIfNeeded()
                func labels(_ view:UIView)->[UILabel] {((view as? UILabel).map{[$0]} ?? []) + view.subviews.flatMap(labels)}
                let title=try XCTUnwrap(labels(modal.view).first{$0.text==model.title})
                // Accepted Nov03 policy compensates the tablet paper's1.4x
                // projection. Test the visible size, not only logical UIFont.
                let expectedLogical:CGFloat=size.width == 820 ? 32/1.4:32
                XCTAssertEqual(title.font.pointSize,expectedLogical,accuracy:0.001)
                var projectedScale:CGFloat=1,ancestor:UIView?=title
                while let current=ancestor,current !== modal.view {
                    projectedScale *= hypot(current.transform.a,current.transform.b)
                    ancestor=current.superview
                }
                XCTAssertEqual(title.font.pointSize*projectedScale,32,accuracy:0.001)
                XCTAssertFalse(title.adjustsFontSizeToFitWidth)
                XCTAssertGreaterThanOrEqual(title.bounds.height,title.font.lineHeight)
                XCTAssertLessThanOrEqual((model.title as NSString).size(withAttributes:[.font:title.font!]).width,title.bounds.width)
            }}
        }
    }
    func testHistoryModalHasBoundedRowsAndSharedModalIdle()async throws {
        var stats=NativeBoardStats();stats.scoreHistory=(1...10).map{.init(value:$0*100,date:Double($0))}
        let modal=NativeScoreModal(model:.init(boardStats:stats,combo:false),root:NativeTestResources.root)
        let window=UIWindow(frame:.init(x:0,y:0,width:320,height:568));window.rootViewController=modal;window.makeKeyAndVisible()
        defer{modal.dispose();window.isHidden=true}
        func all(_ v:UIView)->[UIView]{[v]+v.subviews.flatMap(all)}
        // Wait for actual mounted entry completion, including cold font/layout work.
        let deadline=Date().addingTimeInterval(2)
        while !UIAccessibility.isReduceMotionEnabled,
              !all(modal.view).contains(where:{$0.layer.animation(forKey:"score.idle") != nil}),
              Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        let views=all(modal.view)
        XCTAssertEqual(views.filter{$0.accessibilityIdentifier?.hasPrefix("native.score-history.row.")==true}.count,3)
        XCTAssertEqual(views.contains{$0.layer.animation(forKey:"score.idle") != nil},!UIAccessibility.isReduceMotionEnabled)
        modal.setSuspended(true);XCTAssertEqual(modal.view.layer.speed,0)
        modal.setSuspended(false);XCTAssertEqual(modal.view.layer.speed,1)
        modal.dispose();modal.dispose();XCTAssertNil(modal.onClosed)
    }
    func testActualHighScoreAndComboModalAdmissionSpeaksOnceAndRejectedRepeatIsSilent() async throws {
        enum Unused:Error {case unavailable}
        for mode in [NativeRunMode.journey,.arcade] {for combo in [false,true] {
            let services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw Unused.unavailable},markViewed:{_ in},makeGameplay:{_,_ in throw Unused.unavailable},flush:{})
            let root=NativeAppController(resourceRoot:NativeTestResources.root,services:services)
            let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=root;window.makeKeyAndVisible()
            let game=NativeGameplayViewController(engine:NativeGameplayEngine(state:NativeBoardFactory.make(mode:mode,board:1)),resourceRoot:NativeTestResources.root)
            root.addChild(game);game.view.frame=root.view.bounds;root.view.addSubview(game.view);game.didMove(toParent:root)
            game.boardScene?.layout(size:game.view.bounds.size,insets:.zero,animateEntry:false)
            let owner=NativeScoreOwner(gameplay:game,root:NativeTestResources.root,progression:{NativeProgressionState()})
            defer{owner.dispose();game.dispose();root.dispose();window.isHidden=true}
            var cues:[String]=[];owner.onFeedback={cues.append($0)}
            owner.present(combo:combo);owner.present(combo:!combo)
            XCTAssertNotNil(game.presentedViewController)
            XCTAssertEqual(cues,["hud-modal-open",combo ? "combo-modal-speech":"high-score-modal-speech"])
            try await Task.sleep(for:.milliseconds(100))
        }}
    }
    func testScoreCloseRequestFeedbackPrecedesExitAndCannotRepeat() async throws {
        let state=NativeBoardFactory.make(mode:.journey,board:1)
        let modal=NativeScoreModal(model:NativeScoreModalModel(state:state,progression:NativeProgressionState(),combo:false),root:NativeTestResources.root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=modal;window.makeKeyAndVisible()
        defer{modal.dispose();window.isHidden=true;window.rootViewController=nil}
        try await Task.sleep(for:.milliseconds(850))
        var requested=0,closed=0
        modal.onCloseRequested={requested += 1};modal.onClosed={closed += 1}
        modal.requestClose();modal.requestClose()
        XCTAssertEqual(requested,1);XCTAssertEqual(closed,0)
        modal.dispose();modal.requestClose();XCTAssertEqual(requested,1)
    }
    func testArcadeRoundsCardReadsVariantAndSharesCurrentTypographyAcrossViewports() async throws {
        func all(_ view:UIView)->[UIView] {[view]+view.subviews.flatMap(all)}
        let output=URL(fileURLWithPath:"/tmp/arcade-rounds-card/renders")
        try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
        var progression=NativeProgressionState()
        let now=Date().timeIntervalSince1970
        for (index,variant) in NativeArcadeVariant.allCases.enumerated() {
            progression.finishAttempt(mode:.arcade,board:index+3,score:21399,longestCombo:8,cubesCracked:0,clean:true,arcadeVariant:variant,now:now-1260)
            progression.finishAttempt(mode:.arcade,board:1,score:16516,longestCombo:4,cubesCracked:0,clean:false,arcadeVariant:variant,now:now-2640)
        }
        let original=progression
        for size in [CGSize(width:320,height:568),CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            for (index,variant) in NativeArcadeVariant.allCases.enumerated() {
                weak var retiredCard:UIView?
                try autoreleasepool {
                    var state=NativeBoardFactory.make(mode:.arcade,board:2,arcadeVariant:variant);state.score=21399
                    let modal=NativeScoreModal(model:.init(state:state,progression:progression,combo:false),root:NativeTestResources.root,deferredEntry:true)
                    let window=UIWindow(frame:CGRect(origin:.zero,size:size));window.rootViewController=modal;window.makeKeyAndVisible()
                    defer{modal.dispose();modal.dispose();window.isHidden=true;window.rootViewController=nil}
                    modal.view.frame=window.bounds;modal.view.setNeedsLayout();modal.view.layoutIfNeeded()
                    let views=all(modal.view)
                    XCTAssertNil(views.first{$0.accessibilityIdentifier=="native.score-modal.arcade-rounds"})
                    let rows=views.filter{$0.accessibilityIdentifier?.hasPrefix("native.score-history.row.")==true}
                    XCTAssertEqual(rows.count,3);retiredCard=rows.last
                    for (rowIndex,row) in rows.enumerated() {
                        let labels=row.subviews.compactMap{$0 as? UILabel}
                        let value=try XCTUnwrap(labels.first)
                        let date=try XCTUnwrap(labels.first{$0.text=="Current" || $0.text?.contains("ago")==true})
                        let rounds=try XCTUnwrap(labels.first{$0.accessibilityIdentifier=="native.score-history.rounds.\(rowIndex)"})
                        let expected=rowIndex==0 ? "01":(rowIndex==1 ? NativeScoreDisplay.padded(index+3):"00")
                        XCTAssertEqual(rounds.attributedText?.string,"\(expected) rounds won")
                        XCTAssertEqual(rounds.attributedText?.attribute(.foregroundColor,at:0,effectiveRange:nil) as? UIColor,value.textColor)
                        XCTAssertEqual(date.frame.midY,row.bounds.midY,accuracy:0.001)
                        let scoreInk=CTLineGetBoundsWithOptions(CTLineCreateWithAttributedString(NSAttributedString(string:value.text!,attributes:[.font:value.font!])),.useGlyphPathBounds)
                        let roundsInk=CTLineGetBoundsWithOptions(CTLineCreateWithAttributedString(rounds.attributedText!),.useGlyphPathBounds)
                        let roundsFont=try XCTUnwrap(rounds.attributedText?.attribute(.font,at:0,effectiveRange:nil) as? UIFont)
                        let scoreBottom=value.frame.minY+(value.bounds.height-value.font.lineHeight)/2+value.font.ascender-scoreInk.minY
                        let roundsTop=rounds.frame.minY+(rounds.bounds.height-roundsFont.lineHeight)/2+roundsFont.ascender-roundsInk.maxY
                        XCTAssertEqual(roundsTop-scoreBottom,8,accuracy:0.001)
                        XCTAssertGreaterThanOrEqual(rounds.bounds.width,ceil(rounds.intrinsicContentSize.width))
                        let divider=try XCTUnwrap(row.subviews.first{$0.accessibilityIdentifier=="native.score-history.divider.\(rowIndex)"})
                        XCTAssertGreaterThan(divider.frame.maxY,rounds.frame.midY)
                        XCTAssertGreaterThanOrEqual(rounds.frame.minY,0)
                        XCTAssertLessThanOrEqual(rounds.frame.maxY,row.bounds.height)
                    }
                    let host=try XCTUnwrap(rows.last?.superview)
                    modal.setSuspended(true);XCTAssertEqual(modal.view.layer.speed,0)
                    modal.setSuspended(false);XCTAssertEqual(modal.view.layer.speed,1)
                    try UIGraphicsImageRenderer(bounds:host.bounds).pngData{host.layer.render(in:$0.cgContext)}.write(to:output.appendingPathComponent("modal-\(Int(size.width))-\(index).png"))
                }
                // UIKit retires a mounted root on the next main-runloop turn.
                let deadline=Date().addingTimeInterval(0.5)
                while retiredCard != nil,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
                XCTAssertNil(retiredCard,"Dismissal must release the static card and its borrowed art")
            }
        }
        XCTAssertEqual(progression,original,"Browsing a score card cannot change canonical progression")
        for mode in [NativeRunMode.journey,.arcade] {
            let state=NativeBoardFactory.make(mode:mode,board:1)
            for combo in [false,true] {
                let modal=NativeScoreModal(model:.init(state:state,progression:NativeProgressionState(),combo:combo),root:NativeTestResources.root)
                modal.loadViewIfNeeded();modal.view.frame=CGRect(x:0,y:0,width:390,height:844);modal.view.layoutIfNeeded()
                let footer=all(modal.view).first{$0.accessibilityIdentifier=="native.score-modal.arcade-rounds"}
                XCTAssertNil(footer)
                XCTAssertEqual(all(modal.view).filter{$0.accessibilityIdentifier?.hasPrefix("native.score-history.rounds.")==true}.count,mode == .arcade && !combo ? 1:0)
                modal.dispose()
            }
        }
    }
    func testCommittedStatisticsStayScopedToModeAndBoard() {
        var progression=NativeProgressionState(),board=NativeBoardStats()
        board.highScore=1234;board.longestCombo=7;progression.boardStats[11]=board
        progression.arcadeStats.highScore=9999;progression.arcadeStats.longestCombo=12;progression.arcadeStats.highestStageOpened=4
        let journey=NativeBoardFactory.make(mode:.journey,board:11)
        XCTAssertEqual(NativeScoreModalModel(state:journey,progression:progression,combo:true).history.first?.value,7)
        XCTAssertEqual(NativeScoreModalModel(state:journey,progression:progression,combo:false).history.count,1)
        let arcade=NativeScoreModalModel(state:NativeBoardFactory.make(mode:.arcade,board:1),progression:progression,combo:false)
        XCTAssertEqual(arcade.title,"High Score")
        XCTAssertEqual(arcade.currentRounds,0)
        XCTAssertEqual(arcade.history.first?.value,9999)
    }
    func testArcadeModalReadsItsExactVariantRecord() {
        var progression = NativeProgressionState()
        for (index, variant) in NativeArcadeVariant.allCases.enumerated() {
            progression.finishAttempt(mode: .arcade, board: index + 2, score: (index + 1) * 1234, longestCombo: index + 3, cubesCracked: 0, clean: true, arcadeVariant: variant)
        }
        for (index, variant) in NativeArcadeVariant.allCases.enumerated() {
            let state = NativeBoardFactory.make(mode: .arcade, board: 1, arcadeVariant: variant)
            let score = NativeScoreModalModel(state: state, progression: progression, combo: false)
            XCTAssertEqual(score.subtitle, variant.title)
            XCTAssertEqual(score.history.first?.value, (index + 1) * 1234)
            XCTAssertEqual(score.history.first?.roundsWon,index+2)
            XCTAssertEqual(score.currentRounds,0)
            let combo = NativeScoreModalModel(state: state, progression: progression, combo: true)
            XCTAssertEqual(combo.subtitle, variant.title)
            XCTAssertEqual(combo.history.first?.value, index + 3)
        }
    }
    func testTutorialHudCannotPresentOrMutateTheLiveRun() throws {
        let state=NativeBoardFactory.make(mode:.arcade,board:1,tutorial:true)
        let engine=NativeGameplayEngine(state:state);XCTAssertTrue(engine.startTutorial().accepted)
        let game=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root)
        game.loadViewIfNeeded()
        let snapshot=engine.state,owner=NativeScoreOwner(gameplay:game,root:NativeTestResources.root,progression:{NativeProgressionState()})
        var cues:[String]=[];owner.onFeedback={cues.append($0)}
        owner.present(combo:false);owner.present(combo:true)
        XCTAssertTrue(cues.isEmpty)
        XCTAssertNil(game.presentedViewController);XCTAssertEqual(engine.state,snapshot)
        owner.dispose();game.dispose()
    }
}
