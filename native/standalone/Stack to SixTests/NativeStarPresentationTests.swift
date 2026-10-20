import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeStarPresentationTests: XCTestCase {
    private var root: URL { Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle") }
    func testCoreStarPlannerMatchesExecutedOriginalSourceDrawOrder() throws {
        let plans = NativeStarBurstMotion.make(viewport: CGSize(width: 390,height: 844),random: { 0.5 })
        XCTAssertEqual(plans.count,26)
        let first = try XCTUnwrap(plans.first)
        XCTAssertEqual(first.birth,CGPoint(x: 266,y: 422)); XCTAssertEqual(first.size,47)
        XCTAssertEqual(first.delay,0.025,accuracy: 0.000001)
        XCTAssertEqual(first.launch,0.05,accuracy: 0.000001); XCTAssertEqual(first.travel,0.67,accuracy: 0.000001)
        XCTAssertEqual(first.poses[1].scale,1.177,accuracy: 0.000001)
        XCTAssertEqual(first.poses[2].point.x,114.1088,accuracy: 0.000001)
        XCTAssertEqual(first.poses[2].point.y,-43,accuracy: 0.000001)
        XCTAssertEqual(first.poses[3].point.x,258.9392,accuracy: 0.000001)
        XCTAssertEqual(first.poses[3].point.y,26.875,accuracy: 0.000001)
        XCTAssertEqual(first.poses[4].point.x,518.0595522919716,accuracy: 0.000001)
        XCTAssertEqual(first.poses[4].alpha,0.3479,accuracy: 0.000001)
        XCTAssertEqual(first.poses[5].point.x,676.8752520838252,accuracy: 0.000001)
        XCTAssertEqual(plans.last?.delay ?? 0,1.325,accuracy: 0.000001)
        XCTAssertEqual(first.sample(seconds: first.end).alpha,0)
    }
    func testNativeScreenBlendAndCleanupOwnAllTwentySixParticles() {
        let textures = NativeBoardTextures(root: root)
        let finale = NativeStarFinale(textures: textures,viewport: CGSize(width: 390,height: 844),random: { 0.5 })
        XCTAssertEqual(finale.children.count,26)
        XCTAssertTrue(finale.children.allSatisfy { ($0 as? SKSpriteNode)?.blendMode == .screen })
        XCTAssertEqual(finale.duration,2.545,accuracy: 0.000001)
        var cleanups = 0
        finale.onGlyphClock = { _,finished in if finished { cleanups += 1 } }
        finale.dispose(); finale.dispose()
        XCTAssertEqual(cleanups,1); XCTAssertEqual(finale.children.count,0)
        XCTAssertFalse(finale.hasActions())
        textures.dispose()
    }
    func testFractionalGlyphPaletteUsesComplementaryOriginalFontMasks() throws {
        let field = NativeSplashGlyphField(artwork: JimiV9Artwork(resourceRoot: root),text: "M",colors: [.red,.blue],splitIndex: 0.5,
            letterOpacityRange: 1...1,random: { 0.5 })
        field.frame = CGRect(x: 0,y: 0,width: 390,height: 844); field.layoutIfNeeded()
        let container = try XCTUnwrap(field.subviews.first),letter = try XCTUnwrap(container.subviews.first as? UILabel)
        XCTAssertEqual(letter.textColor,.clear)
        let halves = letter.subviews.compactMap { $0 as? UILabel }
        XCTAssertEqual(halves.count,2); XCTAssertEqual(halves.map(\.text),["M","M"])
        XCTAssertEqual(halves[0].textColor,.red); XCTAssertEqual(halves[1].textColor,.blue)
        let left = try XCTUnwrap((halves[0].layer.mask as? CAShapeLayer)?.path?.boundingBox)
        let right = try XCTUnwrap((halves[1].layer.mask as? CAShapeLayer)?.path?.boundingBox)
        XCTAssertEqual(left.maxX,right.minX,accuracy: 0.000001)
        XCTAssertEqual(left.width+right.width,letter.bounds.width,accuracy: 0.000001)
        XCTAssertEqual(halves[0].font,letter.font); XCTAssertEqual(halves[1].font,letter.font)
    }
    func testCompactLaserGlyphHasAuthoredFastEnterAndKeepsIdleUntilOwnerCleanup() throws {
        let field = NativeSplashGlyphField(artwork: JimiV9Artwork(resourceRoot: root),text: "Z",colors: [.orange],splitIndex: 0,
            compactLaser: true,random: { 0.5 })
        field.frame = CGRect(x: 0,y: 0,width: 390,height: 844); field.layoutIfNeeded()
        let letter = try XCTUnwrap(field.subviews.first?.subviews.first as? UILabel)
        field.paint(seconds: 0.04); XCTAssertEqual(letter.alpha,0)
        field.paint(seconds: 0.20); XCTAssertEqual(letter.alpha,1); XCTAssertEqual(letter.layer.transform.m11,1.2,accuracy: 0.000001)
        field.paint(seconds: 10)
        XCTAssertEqual(letter.alpha,1); XCTAssertGreaterThan(letter.layer.transform.m11,0.9)
        XCTAssertTrue(field.exitStart.isInfinite)
    }
    private struct HaloOracle:Decodable {
        struct Pose:Decodable {let x,y,rotation,scale,alpha,angle:Double;let revealed,introAnimating:Bool}
        struct Frame:Decodable {let now,lastUpdate:Double,paintable:Bool,poses:[Pose]}
        struct Case:Decodable {let index,count,countDraws,setupDraws:Int;let rolls:[Double],width,height,textureWidth:Double;let introBounce:Bool;let frames:[Frame]}
        let cases:[Case]
    }
    func testSourceHaloAuthoredMotionAtLegacySparseSamplesMatchesOriginalGSAPOracle()throws {
        let json = #"""
{
  "authority": "Literal wild-stars.ts setup/tick functions and actual GSAP intro timelines; Sprite probe only, no renderer or physical claim",
  "sourceSHA256": "642b43ab7a3a5f8aa6ec7517fea775239b8117c02938cb1449ea7e398773cbd2",
  "cases": [
    {
      "index": 0,
      "rolls": [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ],
      "count": 1,
      "countDraws": 1,
      "setupDraws": 11,
      "width": 128,
      "height": 140,
      "textureWidth": 80,
      "introBounce": true,
      "frames": [
        {
          "now": 0,
          "paintable": true,
          "lastUpdate": 0,
          "poses": [
            {
              "x": 50.37419740193444,
              "y": 1.612524762892518,
              "rotation": 0,
              "scale": 0.0756,
              "alpha": 1,
              "angle": 0.032,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 16,
          "paintable": true,
          "lastUpdate": 0,
          "poses": [
            {
              "x": 50.37419740193444,
              "y": 1.612524762892518,
              "rotation": 0,
              "scale": 0.430784,
              "alpha": 1,
              "angle": 0.032,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 34,
          "paintable": true,
          "lastUpdate": 34,
          "poses": [
            {
              "x": 50.41793066494042,
              "y": 3.2311603786605465,
              "rotation": 0.001186766726831411,
              "scale": 0.713999,
              "alpha": 1,
              "angle": 0.064,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 90,
          "paintable": true,
          "lastUpdate": 90,
          "poses": [
            {
              "x": 50.48744384056894,
              "y": 4.861739055359421,
              "rotation": 0.003140532473418142,
              "scale": 1.00926,
              "alpha": 1,
              "angle": 0.096,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 180,
          "paintable": true,
          "lastUpdate": 180,
          "poses": [
            {
              "x": 50.62254592600061,
              "y": 6.515307068261639,
              "rotation": 0.006274706441684006,
              "scale": 0.7938,
              "alpha": 1,
              "angle": 0.128,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 260,
          "paintable": true,
          "lastUpdate": 260,
          "poses": [
            {
              "x": 50.665158445271196,
              "y": 8.176315947961886,
              "rotation": 0.009050170446854331,
              "scale": 0.5418,
              "alpha": 1,
              "angle": 0.16,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 340,
          "paintable": true,
          "lastUpdate": 340,
          "poses": [
            {
              "x": 50.648856687485406,
              "y": 9.845864854252614,
              "rotation": 0.01181115610990975,
              "scale": 0.636924,
              "alpha": 1,
              "angle": 0.192,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 480,
          "paintable": true,
          "lastUpdate": 480,
          "poses": [
            {
              "x": 50.76566158226942,
              "y": 11.565596828841281,
              "rotation": 0.016594773887166334,
              "scale": 0.6113398231803165,
              "alpha": 1,
              "angle": 0.224,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 510,
          "paintable": true,
          "lastUpdate": 480,
          "poses": [
            {
              "x": 50.76566158226942,
              "y": 11.565596828841281,
              "rotation": 0.016594773887166334,
              "scale": 0.6113398231803165,
              "alpha": 1,
              "angle": 0.224,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 620,
          "paintable": false,
          "lastUpdate": 620,
          "poses": [
            {
              "x": 50.76566158226942,
              "y": 11.565596828841281,
              "rotation": 0.016594773887166334,
              "scale": 0.6113398231803165,
              "alpha": 1,
              "angle": 0.224,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 760,
          "paintable": false,
          "lastUpdate": 760,
          "poses": [
            {
              "x": 50.76566158226942,
              "y": 11.565596828841281,
              "rotation": 0.016594773887166334,
              "scale": 0.6113398231803165,
              "alpha": 1,
              "angle": 0.224,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 990,
          "paintable": true,
          "lastUpdate": 990,
          "poses": [
            {
              "x": 51.787134737136604,
              "y": 13.554920100712042,
              "rotation": 0.03316346546345439,
              "scale": 0.6354283311083151,
              "alpha": 1,
              "angle": 0.256,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1030,
          "paintable": true,
          "lastUpdate": 1030,
          "poses": [
            {
              "x": 51.41642063854384,
              "y": 15.23139388228198,
              "rotation": 0.034385419185973265,
              "scale": 0.6366583501129435,
              "alpha": 1,
              "angle": 0.28800000000000003,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1140,
          "paintable": true,
          "lastUpdate": 1140,
          "poses": [
            {
              "x": 51.1278547844721,
              "y": 16.94322938741725,
              "rotation": 0.03767342399876105,
              "scale": 0.6394650137552187,
              "alpha": 1,
              "angle": 0.32000000000000006,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1320,
          "paintable": true,
          "lastUpdate": 1320,
          "poses": [
            {
              "x": 50.86177963767123,
              "y": 18.6813610368288,
              "rotation": 0.042803631065596454,
              "scale": 0.6421559766923909,
              "alpha": 1,
              "angle": 0.3520000000000001,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1600,
          "paintable": true,
          "lastUpdate": 1600,
          "poses": [
            {
              "x": 50.53747655823157,
              "y": 20.42008637495658,
              "rotation": 0.050080902781729615,
              "scale": 0.6414757219796701,
              "alpha": 1,
              "angle": 0.3840000000000001,
              "revealed": true,
              "introAnimating": false
            }
          ]
        }
      ]
    },
    {
      "index": 1,
      "rolls": [
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999,
        0.999999
      ],
      "count": 3,
      "countDraws": 1,
      "setupDraws": 31,
      "width": 135,
      "height": 138,
      "textureWidth": 88,
      "introBounce": false,
      "frames": [
        {
          "now": 0,
          "paintable": true,
          "lastUpdate": 0,
          "poses": [
            {
              "x": 63.655995997438424,
              "y": 3.568465260700753,
              "rotation": -8.772977303615356e-7,
              "scale": 0.6147267650781326,
              "alpha": 1,
              "angle": 0.055999976,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -28.737616430430098,
              "y": 56.9119422673326,
              "rotation": -8.772977303615356e-7,
              "scale": 0.6147267650781326,
              "alpha": 1,
              "angle": 2.0383951263931954,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -34.918379567008344,
              "y": -53.34347700663184,
              "rotation": -8.772977303615356e-7,
              "scale": 0.6147267650781326,
              "alpha": 1,
              "angle": 4.132790228786391,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 16,
          "paintable": true,
          "lastUpdate": 0,
          "poses": [
            {
              "x": 63.655995997438424,
              "y": 3.568465260700753,
              "rotation": -8.772977303615356e-7,
              "scale": 0.6147267650781326,
              "alpha": 1,
              "angle": 0.055999976,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -28.737616430430098,
              "y": 56.9119422673326,
              "rotation": -8.772977303615356e-7,
              "scale": 0.6147267650781326,
              "alpha": 1,
              "angle": 2.0383951263931954,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -34.918379567008344,
              "y": -53.34347700663184,
              "rotation": -8.772977303615356e-7,
              "scale": 0.6147267650781326,
              "alpha": 1,
              "angle": 4.132790228786391,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 34,
          "paintable": true,
          "lastUpdate": 34,
          "poses": [
            {
              "x": 63.72141367718573,
              "y": 7.166787063278657,
              "rotation": 0.0037964878754682993,
              "scale": 0.617906108950458,
              "alpha": 1,
              "angle": 0.111999952,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -25.654087178279866,
              "y": 58.767756541139356,
              "rotation": 0.0037964878754682993,
              "scale": 0.617906108950458,
              "alpha": 1,
              "angle": 1.9823951503931954,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -38.06732649890587,
              "y": -51.600969477860694,
              "rotation": 0.0037964878754682993,
              "scale": 0.617906108950458,
              "alpha": 1,
              "angle": 4.076790252786391,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 90,
          "paintable": true,
          "lastUpdate": 90,
          "poses": [
            {
              "x": 63.81440522649899,
              "y": 10.82282867110764,
              "rotation": 0.010043529059914522,
              "scale": 0.6231235970881183,
              "alpha": 1,
              "angle": 0.167999928,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -22.53435804326369,
              "y": 60.6763103890964,
              "rotation": 0.010043529059914522,
              "scale": 0.6231235970881183,
              "alpha": 1,
              "angle": 1.9263951743931953,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -41.28004718323529,
              "y": -49.853481717988764,
              "rotation": 0.010043529059914522,
              "scale": 0.6231235970881183,
              "alpha": 1,
              "angle": 4.020790276786391,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 180,
          "paintable": true,
          "lastUpdate": 180,
          "poses": [
            {
              "x": 64.03803125501247,
              "y": 14.589344447326354,
              "rotation": 0.020035892290404922,
              "scale": 0.6313873039798302,
              "alpha": 1,
              "angle": 0.223999904,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -19.384272711560154,
              "y": 62.75323409884586,
              "rotation": 0.020035892290404922,
              "scale": 0.6313873039798302,
              "alpha": 1,
              "angle": 1.8703951983931952,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -44.65375854345229,
              "y": -48.163889651519504,
              "rotation": 0.020035892290404922,
              "scale": 0.6313873039798302,
              "alpha": 1,
              "angle": 3.964790300786391,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 260,
          "paintable": true,
          "lastUpdate": 260,
          "poses": [
            {
              "x": 63.90948324018823,
              "y": 18.377440058371022,
              "rotation": 0.028832433638580377,
              "scale": 0.6385150588081763,
              "alpha": 1,
              "angle": 0.27999988,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -16.039411673019014,
              "y": 64.53595605792435,
              "rotation": 0.028832433638580377,
              "scale": 0.6385150588081763,
              "alpha": 1,
              "angle": 1.8143952223931952,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -47.870071567169184,
              "y": -46.15851599955334,
              "rotation": 0.028832433638580377,
              "scale": 0.6385150588081763,
              "alpha": 1,
              "angle": 3.9087903247863913,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 340,
          "paintable": true,
          "lastUpdate": 340,
          "poses": [
            {
              "x": 63.520378896547165,
              "y": 22.184017986449707,
              "rotation": 0.03751091773224555,
              "scale": 0.645344730465887,
              "alpha": 1,
              "angle": 0.335999856,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -12.548266313997196,
              "y": 66.10227077564765,
              "rotation": 0.03751091773224555,
              "scale": 0.645344730465887,
              "alpha": 1,
              "angle": 1.758395246393195,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -50.97211258254992,
              "y": -43.918252789197965,
              "rotation": 0.03751091773224555,
              "scale": 0.645344730465887,
              "alpha": 1,
              "angle": 3.8527903487863915,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 480,
          "paintable": true,
          "lastUpdate": 480,
          "poses": [
            {
              "x": 63.33531684541031,
              "y": 26.182476546191968,
              "rotation": 0.05230765790241722,
              "scale": 0.6563246614947447,
              "alpha": 1,
              "angle": 0.391999832,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -8.992968599712631,
              "y": 67.94123161795781,
              "rotation": 0.05230765790241722,
              "scale": 0.6563246614947447,
              "alpha": 1,
              "angle": 1.702395270393195,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -54.34234824569762,
              "y": -41.758755071765876,
              "rotation": 0.05230765790241722,
              "scale": 0.6563246614947447,
              "alpha": 1,
              "angle": 3.7967903727863916,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 510,
          "paintable": true,
          "lastUpdate": 480,
          "poses": [
            {
              "x": 63.33531684541031,
              "y": 26.182476546191968,
              "rotation": 0.05230765790241722,
              "scale": 0.6563246614947447,
              "alpha": 1,
              "angle": 0.391999832,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -8.992968599712631,
              "y": 67.94123161795781,
              "rotation": 0.05230765790241722,
              "scale": 0.6563246614947447,
              "alpha": 1,
              "angle": 1.702395270393195,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -54.34234824569762,
              "y": -41.758755071765876,
              "rotation": 0.05230765790241722,
              "scale": 0.6563246614947447,
              "alpha": 1,
              "angle": 3.7967903727863916,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 620,
          "paintable": false,
          "lastUpdate": 620,
          "poses": [
            {
              "x": 63.33531684541031,
              "y": 26.182476546191968,
              "rotation": 0.05230765790241722,
              "scale": 0.6563246614947447,
              "alpha": 1,
              "angle": 0.391999832,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -8.992968599712631,
              "y": 67.94123161795781,
              "rotation": 0.05230765790241722,
              "scale": 0.6563246614947447,
              "alpha": 1,
              "angle": 1.702395270393195,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -54.34234824569762,
              "y": -41.758755071765876,
              "rotation": 0.05230765790241722,
              "scale": 0.6563246614947447,
              "alpha": 1,
              "angle": 3.7967903727863916,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 760,
          "paintable": false,
          "lastUpdate": 760,
          "poses": [
            {
              "x": 63.33531684541031,
              "y": 26.182476546191968,
              "rotation": 0.05230765790241722,
              "scale": 0.6563246614947447,
              "alpha": 1,
              "angle": 0.391999832,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -8.992968599712631,
              "y": 67.94123161795781,
              "rotation": 0.05230765790241722,
              "scale": 0.6563246614947447,
              "alpha": 1,
              "angle": 1.702395270393195,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -54.34234824569762,
              "y": -41.758755071765876,
              "rotation": 0.05230765790241722,
              "scale": 0.6563246614947447,
              "alpha": 1,
              "angle": 3.7967903727863916,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 990,
          "paintable": true,
          "lastUpdate": 990,
          "poses": [
            {
              "x": 64.11945878020508,
              "y": 30.815204190165506,
              "rotation": 0.09937968478451878,
              "scale": 0.6804076098257654,
              "alpha": 1,
              "angle": 0.447999808,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -5.372979738614501,
              "y": 70.93668227564953,
              "rotation": 0.09937968478451878,
              "scale": 0.6804076098257654,
              "alpha": 1,
              "angle": 1.646395294393195,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -58.74647904159052,
              "y": -40.12147808548407,
              "rotation": 0.09937968478451878,
              "scale": 0.6804076098257654,
              "alpha": 1,
              "angle": 3.740790396786392,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1030,
          "paintable": true,
          "lastUpdate": 1030,
          "poses": [
            {
              "x": 62.33434847168552,
              "y": 34.37785420548401,
              "rotation": 0.10246674633215407,
              "scale": 0.6809918598843901,
              "alpha": 1,
              "angle": 0.503999784,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -1.3950791662958666,
              "y": 71.17205640757336,
              "rotation": 0.10246674633215407,
              "scale": 0.6809918598843901,
              "alpha": 1,
              "angle": 1.590395318393195,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -60.93926930538958,
              "y": -36.794202202089416,
              "rotation": 0.10246674633215407,
              "scale": 0.6809918598843901,
              "alpha": 1,
              "angle": 3.684790420786392,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1140,
          "paintable": true,
          "lastUpdate": 1140,
          "poses": [
            {
              "x": 60.310019529919735,
              "y": 37.81131853950837,
              "rotation": 0.11040606578611543,
              "scale": 0.6815241471682709,
              "alpha": 1,
              "angle": 0.55999976,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": 2.590552640839951,
              "y": 71.1356682854003,
              "rotation": 0.11040606578611543,
              "scale": 0.6815241471682709,
              "alpha": 1,
              "angle": 1.5343953423931949,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -62.900572170759595,
              "y": -33.324349745892,
              "rotation": 0.11040606578611543,
              "scale": 0.6815241471682709,
              "alpha": 1,
              "angle": 3.628790444786392,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1320,
          "paintable": true,
          "lastUpdate": 1320,
          "poses": [
            {
              "x": 57.764991167047846,
              "y": 40.89109260959866,
              "rotation": 0.121529272003299,
              "scale": 0.6789946595440981,
              "alpha": 1,
              "angle": 0.6159997359999999,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": 6.53022940489069,
              "y": 70.47149610484647,
              "rotation": 0.121529272003299,
              "scale": 0.6789946595440981,
              "alpha": 1,
              "angle": 1.4783953663931948,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -64.29522057193844,
              "y": -29.58040349524789,
              "rotation": 0.121529272003299,
              "scale": 0.6789946595440981,
              "alpha": 1,
              "angle": 3.5727904687863923,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1600,
          "paintable": true,
          "lastUpdate": 1600,
          "poses": [
            {
              "x": 54.1642863165256,
              "y": 43.088459356287224,
              "rotation": 0.1337639107513695,
              "scale": 0.6671340218501227,
              "alpha": 1,
              "angle": 0.6719997119999999,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": 10.233557254215283,
              "y": 68.45187760610862,
              "rotation": 0.1337639107513695,
              "scale": 0.6671340218501227,
              "alpha": 1,
              "angle": 1.4223953903931947,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -64.39784357074078,
              "y": -25.363418249821493,
              "rotation": 0.1337639107513695,
              "scale": 0.6671340218501227,
              "alpha": 1,
              "angle": 3.5167904927863924,
              "revealed": true,
              "introAnimating": false
            }
          ]
        }
      ]
    },
    {
      "index": 2,
      "rolls": [
        0.38,
        0.51,
        0.64,
        0.77,
        0.9,
        0.03,
        0.16,
        0.29,
        0.42,
        0.55,
        0.68,
        0.81,
        0.94,
        0.07,
        0.2,
        0.33,
        0.46,
        0.59,
        0.72,
        0.85,
        0.98,
        0.11,
        0.24,
        0.37,
        0.5,
        0.63,
        0.76,
        0.89,
        0.02,
        0.15,
        0.28,
        0.41,
        0.54,
        0.67,
        0.8,
        0.93,
        0.06,
        0.19,
        0.32,
        0.45
      ],
      "count": 2,
      "countDraws": 1,
      "setupDraws": 21,
      "width": 142,
      "height": 136,
      "textureWidth": 96,
      "introBounce": true,
      "frames": [
        {
          "now": 0,
          "paintable": true,
          "lastUpdate": 0,
          "poses": [
            {
              "x": 66.13747431826329,
              "y": 2.927832208984884,
              "rotation": -0.03624340605620875,
              "scale": 0.066045,
              "alpha": 1,
              "angle": 0.04424,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -65.76659871216506,
              "y": 3.386020918249548,
              "rotation": -0.11183048123093574,
              "scale": 0.046130000000000004,
              "alpha": 0,
              "angle": 3.090152653589793,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 16,
          "paintable": true,
          "lastUpdate": 0,
          "poses": [
            {
              "x": 66.13747431826329,
              "y": 2.927832208984884,
              "rotation": -0.03624340605620875,
              "scale": 0.376337,
              "alpha": 1,
              "angle": 0.04424,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -65.76659871216506,
              "y": 3.386020918249548,
              "rotation": -0.11183048123093574,
              "scale": 0.046130000000000004,
              "alpha": 0,
              "angle": 3.090152653589793,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 34,
          "paintable": true,
          "lastUpdate": 34,
          "poses": [
            {
              "x": 66.11039611985653,
              "y": 5.864760345717442,
              "rotation": -0.03860915723654337,
              "scale": 0.623758,
              "alpha": 1,
              "angle": 0.08848,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -65.36198530919195,
              "y": 6.748266411469229,
              "rotation": -0.10981960088276782,
              "scale": 0.046130000000000004,
              "alpha": 0,
              "angle": 3.0387126535897933,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 90,
          "paintable": true,
          "lastUpdate": 90,
          "poses": [
            {
              "x": 66.03122507679667,
              "y": 8.815485489129031,
              "rotation": -0.04246706193137886,
              "scale": 0.881701,
              "alpha": 1,
              "angle": 0.13272,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -64.69152113375168,
              "y": 10.063206613046232,
              "rotation": -0.10636627132816764,
              "scale": 0.046130000000000004,
              "alpha": 0,
              "angle": 2.9872726535897933,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 180,
          "paintable": true,
          "lastUpdate": 180,
          "poses": [
            {
              "x": 65.88929180613279,
              "y": 11.78302109610959,
              "rotation": -0.048555954698118534,
              "scale": 0.693473,
              "alpha": 1,
              "angle": 0.17696,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -63.7069907270302,
              "y": 13.296528005430444,
              "rotation": -0.1004605268587142,
              "scale": 0.046130000000000004,
              "alpha": 0,
              "angle": 2.9358326535897934,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 260,
          "paintable": true,
          "lastUpdate": 260,
          "poses": [
            {
              "x": 65.49539290629096,
              "y": 14.728588703136438,
              "rotation": -0.05383953833914846,
              "scale": 0.473323,
              "alpha": 1,
              "angle": 0.2212,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -62.60177289792614,
              "y": 16.465869913777205,
              "rotation": -0.09486008423477194,
              "scale": 0.046130000000000004,
              "alpha": 0,
              "angle": 2.8843926535897935,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 340,
          "paintable": true,
          "lastUpdate": 340,
          "poses": [
            {
              "x": 64.8891594269844,
              "y": 17.640443487967765,
              "rotation": -0.05898812029241408,
              "scale": 0.556424,
              "alpha": 1,
              "angle": 0.26544,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -61.3400879446016,
              "y": 19.556974849998014,
              "rotation": -0.08894849091393466,
              "scale": 0.046130000000000004,
              "alpha": 0,
              "angle": 2.8329526535897935,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 480,
          "paintable": true,
          "lastUpdate": 480,
          "poses": [
            {
              "x": 64.03988910341383,
              "y": 20.491144695957097,
              "rotation": -0.06763466838058615,
              "scale": 0.5613522313653977,
              "alpha": 1,
              "angle": 0.30968,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -59.68820533833606,
              "y": 22.472262445076595,
              "rotation": -0.07791336118451817,
              "scale": 0.046130000000000004,
              "alpha": 0,
              "angle": 2.7815126535897936,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 510,
          "paintable": true,
          "lastUpdate": 480,
          "poses": [
            {
              "x": 64.03988910341383,
              "y": 20.491144695957097,
              "rotation": -0.06763466838058615,
              "scale": 0.5613522313653977,
              "alpha": 1,
              "angle": 0.30968,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -59.68820533833606,
              "y": 22.472262445076595,
              "rotation": -0.07791336118451817,
              "scale": 0.046130000000000004,
              "alpha": 0,
              "angle": 2.7815126535897936,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 620,
          "paintable": false,
          "lastUpdate": 620,
          "poses": [
            {
              "x": 64.03988910341383,
              "y": 20.491144695957097,
              "rotation": -0.06763466838058615,
              "scale": 0.5613522313653977,
              "alpha": 1,
              "angle": 0.30968,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -59.68820533833606,
              "y": 22.472262445076595,
              "rotation": -0.07791336118451817,
              "scale": 0.046130000000000004,
              "alpha": 0,
              "angle": 2.7815126535897936,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 760,
          "paintable": false,
          "lastUpdate": 760,
          "poses": [
            {
              "x": 64.03988910341383,
              "y": 20.491144695957097,
              "rotation": -0.06763466838058615,
              "scale": 0.5613522313653977,
              "alpha": 1,
              "angle": 0.30968,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -59.68820533833606,
              "y": 22.472262445076595,
              "rotation": -0.07791336118451817,
              "scale": 0.046130000000000004,
              "alpha": 0,
              "angle": 2.7815126535897936,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 990,
          "paintable": true,
          "lastUpdate": 990,
          "poses": [
            {
              "x": 61.096442710496575,
              "y": 22.573743002700084,
              "rotation": -0.09429158899311506,
              "scale": 0.5537641799730885,
              "alpha": 1,
              "angle": 0.35392,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -56.646197183773616,
              "y": 24.722639967395036,
              "rotation": -0.03200275188391658,
              "scale": 0.069195,
              "alpha": 1,
              "angle": 2.7300726535897937,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 1030,
          "paintable": true,
          "lastUpdate": 1030,
          "poses": [
            {
              "x": 59.77601154366037,
              "y": 25.143344315164025,
              "rotation": -0.0960083999311586,
              "scale": 0.5524785957605003,
              "alpha": 1,
              "angle": 0.39816,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -55.18356048561028,
              "y": 27.544365645576335,
              "rotation": -0.028138805869551916,
              "scale": 0.717711,
              "alpha": 1,
              "angle": 2.6786326535897937,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 1140,
          "paintable": true,
          "lastUpdate": 1140,
          "poses": [
            {
              "x": 57.83661293894333,
              "y": 27.398115730837496,
              "rotation": -0.10041615085763987,
              "scale": 0.5484834634440606,
              "alpha": 1,
              "angle": 0.4424,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -53.40364476424011,
              "y": 30.18105313331762,
              "rotation": -0.017403550382522663,
              "scale": 0.77524,
              "alpha": 1,
              "angle": 2.627192653589794,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 1320,
          "paintable": true,
          "lastUpdate": 1320,
          "poses": [
            {
              "x": 55.18591438212511,
              "y": 29.19775926369242,
              "rotation": -0.10659356371000558,
              "scale": 0.5406260820981479,
              "alpha": 1,
              "angle": 0.48664,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -51.391575966855534,
              "y": 32.63956224527077,
              "rotation": 0.0003652316261329716,
              "scale": 0.585341,
              "alpha": 1,
              "angle": 2.575752653589794,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 1600,
          "paintable": true,
          "lastUpdate": 1600,
          "poses": [
            {
              "x": 51.55774975693263,
              "y": 30.269540735622943,
              "rotation": -0.11349238242999819,
              "scale": 0.5258302511532943,
              "alpha": 1,
              "angle": 0.53088,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -49.253148461199245,
              "y": 34.96040997092657,
              "rotation": 0.027884921877836664,
              "scale": 0.47309953391063336,
              "alpha": 1,
              "angle": 2.524312653589794,
              "revealed": true,
              "introAnimating": false
            }
          ]
        }
      ]
    },
    {
      "index": 3,
      "rolls": [
        0.57,
        0.7,
        0.83,
        0.96,
        0.09,
        0.22,
        0.35,
        0.48,
        0.61,
        0.74,
        0.87,
        0,
        0.13,
        0.26,
        0.39,
        0.52,
        0.65,
        0.78,
        0.91,
        0.04,
        0.17,
        0.3,
        0.43,
        0.56,
        0.69,
        0.82,
        0.95,
        0.08,
        0.21,
        0.34,
        0.47,
        0.6,
        0.73,
        0.86,
        0.99,
        0.12,
        0.25,
        0.38,
        0.51,
        0.64
      ],
      "count": 2,
      "countDraws": 1,
      "setupDraws": 21,
      "width": 149,
      "height": 134,
      "textureWidth": 104,
      "introBounce": false,
      "frames": [
        {
          "now": 0,
          "paintable": true,
          "lastUpdate": 0,
          "poses": [
            {
              "x": 72.56148272180555,
              "y": 3.5438139302936538,
              "rotation": -0.13029301620617512,
              "scale": 0.5238565509979012,
              "alpha": 1,
              "angle": 0.0488,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -51.22100604529773,
              "y": 1.6396318926788214,
              "rotation": 0.020313340386018744,
              "scale": 0.4595031385926519,
              "alpha": 1,
              "angle": 3.109592653589793,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 16,
          "paintable": true,
          "lastUpdate": 0,
          "poses": [
            {
              "x": 72.56148272180555,
              "y": 3.5438139302936538,
              "rotation": -0.13029301620617512,
              "scale": 0.5238565509979012,
              "alpha": 1,
              "angle": 0.0488,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -51.22100604529773,
              "y": 1.6396318926788214,
              "rotation": 0.020313340386018744,
              "scale": 0.4595031385926519,
              "alpha": 1,
              "angle": 3.109592653589793,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 34,
          "paintable": true,
          "lastUpdate": 34,
          "poses": [
            {
              "x": 72.15715020287513,
              "y": 7.064985236826954,
              "rotation": -0.13044822835724135,
              "scale": 0.522604001778096,
              "alpha": 1,
              "angle": 0.0976,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -51.028573140775016,
              "y": 3.270294943435861,
              "rotation": 0.02238539243347438,
              "scale": 0.45816938897984794,
              "alpha": 1,
              "angle": 3.077592653589793,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 90,
          "paintable": true,
          "lastUpdate": 90,
          "poses": [
            {
              "x": 71.47642301248504,
              "y": 10.539554086695485,
              "rotation": -0.13055050698673884,
              "scale": 0.5204011888216561,
              "alpha": 1,
              "angle": 0.1464,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -50.72422269328165,
              "y": 4.884539912526051,
              "rotation": 0.025763810297314643,
              "scale": 0.45615509983087155,
              "alpha": 1,
              "angle": 3.045592653589793,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 180,
          "paintable": true,
          "lastUpdate": 180,
          "poses": [
            {
              "x": 70.44719865598672,
              "y": 13.928652194029704,
              "rotation": -0.13031486003471449,
              "scale": 0.5165179763876206,
              "alpha": 1,
              "angle": 0.1952,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -50.299879643210375,
              "y": 6.473778735885282,
              "rotation": 0.03108963404177074,
              "scale": 0.45341530013023584,
              "alpha": 1,
              "angle": 3.013592653589793,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 260,
          "paintable": true,
          "lastUpdate": 260,
          "poses": [
            {
              "x": 69.27575700215809,
              "y": 17.24692186696283,
              "rotation": -0.1296920817024357,
              "scale": 0.512741490288263,
              "alpha": 1,
              "angle": 0.24400000000000002,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -49.891370988530696,
              "y": 8.051442545469445,
              "rotation": 0.03569821264402738,
              "scale": 0.4515189973806721,
              "alpha": 1,
              "angle": 2.981592653589793,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 340,
          "paintable": true,
          "lastUpdate": 340,
          "poses": [
            {
              "x": 67.92357702393532,
              "y": 20.476559759196334,
              "rotation": -0.12868220014473858,
              "scale": 0.5086934844745195,
              "alpha": 1,
              "angle": 0.2928,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -49.47106122170044,
              "y": 9.616907761427756,
              "rotation": 0.04017031815539799,
              "scale": 0.4501501538065168,
              "alpha": 1,
              "angle": 2.949592653589793,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 480,
          "paintable": true,
          "lastUpdate": 480,
          "poses": [
            {
              "x": 66.05190691355416,
              "y": 23.48396992664738,
              "rotation": -0.12599315354823984,
              "scale": 0.5010631632557434,
              "alpha": 1,
              "angle": 0.3416,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -48.99209438723941,
              "y": 11.161537027644101,
              "rotation": 0.047617020026675894,
              "scale": 0.44906233304089427,
              "alpha": 1,
              "angle": 2.917592653589793,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 510,
          "paintable": true,
          "lastUpdate": 480,
          "poses": [
            {
              "x": 66.05190691355416,
              "y": 23.48396992664738,
              "rotation": -0.12599315354823984,
              "scale": 0.5010631632557434,
              "alpha": 1,
              "angle": 0.3416,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -48.99209438723941,
              "y": 11.161537027644101,
              "rotation": 0.047617020026675894,
              "scale": 0.44906233304089427,
              "alpha": 1,
              "angle": 2.917592653589793,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 620,
          "paintable": false,
          "lastUpdate": 620,
          "poses": [
            {
              "x": 66.05190691355416,
              "y": 23.48396992664738,
              "rotation": -0.12599315354823984,
              "scale": 0.5010631632557434,
              "alpha": 1,
              "angle": 0.3416,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -48.99209438723941,
              "y": 11.161537027644101,
              "rotation": 0.047617020026675894,
              "scale": 0.44906233304089427,
              "alpha": 1,
              "angle": 2.917592653589793,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 760,
          "paintable": false,
          "lastUpdate": 760,
          "poses": [
            {
              "x": 66.05190691355416,
              "y": 23.48396992664738,
              "rotation": -0.12599315354823984,
              "scale": 0.5010631632557434,
              "alpha": 1,
              "angle": 0.3416,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -48.99209438723941,
              "y": 11.161537027644101,
              "rotation": 0.047617020026675894,
              "scale": 0.44906233304089427,
              "alpha": 1,
              "angle": 2.917592653589793,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 990,
          "paintable": true,
          "lastUpdate": 990,
          "poses": [
            {
              "x": 61.61630320361713,
              "y": 25.356499973752296,
              "rotation": -0.1067553137571923,
              "scale": 0.47050807100225234,
              "alpha": 1,
              "angle": 0.3904,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -49.0878541763042,
              "y": 12.848402304019771,
              "rotation": 0.06945552308470314,
              "scale": 0.4590822214878194,
              "alpha": 1,
              "angle": 2.885592653589793,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1030,
          "paintable": true,
          "lastUpdate": 1030,
          "poses": [
            {
              "x": 60.04752090747942,
              "y": 28.210540746698445,
              "rotation": -0.10466277034721067,
              "scale": 0.4681344182146999,
              "alpha": 1,
              "angle": 0.43920000000000003,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -48.752608569769464,
              "y": 14.442276897007778,
              "rotation": 0.07075123493854149,
              "scale": 0.46072559731364104,
              "alpha": 1,
              "angle": 2.853592653589793,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1140,
          "paintable": true,
          "lastUpdate": 1140,
          "poses": [
            {
              "x": 57.906566181235505,
              "y": 30.73807203648311,
              "rotation": -0.09851040777275775,
              "scale": 0.4617722096983963,
              "alpha": 1,
              "angle": 0.48800000000000004,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -48.583707832672275,
              "y": 16.100126042257276,
              "rotation": 0.07396219991095046,
              "scale": 0.46579199458094156,
              "alpha": 1,
              "angle": 2.821592653589793,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1320,
          "paintable": true,
          "lastUpdate": 1320,
          "poses": [
            {
              "x": 55.250136783199316,
              "y": 32.878700320952674,
              "rotation": -0.08726126205242635,
              "scale": 0.4521065401369245,
              "alpha": 1,
              "angle": 0.5368,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -48.68360912620858,
              "y": 17.881326314994794,
              "rotation": 0.07805470898446047,
              "scale": 0.4755951742797184,
              "alpha": 1,
              "angle": 2.789592653589793,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1600,
          "paintable": true,
          "lastUpdate": 1600,
          "poses": [
            {
              "x": 52.03485718986654,
              "y": 34.509610039507905,
              "rotation": -0.06721348853342896,
              "scale": 0.43977448659408047,
              "alpha": 1,
              "angle": 0.5856,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -49.32168269993802,
              "y": 19.928834787198955,
              "rotation": 0.08140245643740096,
              "scale": 0.493490040473961,
              "alpha": 1,
              "angle": 2.7575926535897928,
              "revealed": true,
              "introAnimating": false
            }
          ]
        }
      ]
    },
    {
      "index": 4,
      "rolls": [
        0.76,
        0.89,
        0.02,
        0.15,
        0.28,
        0.41,
        0.54,
        0.67,
        0.8,
        0.93,
        0.06,
        0.19,
        0.32,
        0.45,
        0.58,
        0.71,
        0.84,
        0.97,
        0.1,
        0.23,
        0.36,
        0.49,
        0.62,
        0.75,
        0.88,
        0.01,
        0.14,
        0.27,
        0.4,
        0.53,
        0.66,
        0.79,
        0.92,
        0.05,
        0.18,
        0.31,
        0.44,
        0.57,
        0.7,
        0.83
      ],
      "count": 3,
      "countDraws": 1,
      "setupDraws": 31,
      "width": 156,
      "height": 132,
      "textureWidth": 112,
      "introBounce": true,
      "frames": [
        {
          "now": 0,
          "paintable": true,
          "lastUpdate": 0,
          "poses": [
            {
              "x": 55.09617653852108,
              "y": 2.942725440905937,
              "rotation": -0.031508502224386385,
              "scale": 0.06002999999999999,
              "alpha": 1,
              "angle": 0.053360000000000005,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -26.15145629593169,
              "y": 49.380530098405735,
              "rotation": 0.09419723443885497,
              "scale": 0.04182,
              "alpha": 0,
              "angle": 2.057835102393195,
              "revealed": false,
              "introAnimating": false
            },
            {
              "x": -38.58312427494917,
              "y": -60.54643460851881,
              "rotation": -0.02171559475100818,
              "scale": 0.03762,
              "alpha": 0,
              "angle": 4.145030204786391,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 16,
          "paintable": true,
          "lastUpdate": 0,
          "poses": [
            {
              "x": 55.09617653852108,
              "y": 2.942725440905937,
              "rotation": -0.031508502224386385,
              "scale": 0.342063,
              "alpha": 1,
              "angle": 0.053360000000000005,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -26.15145629593169,
              "y": 49.380530098405735,
              "rotation": 0.09419723443885497,
              "scale": 0.04182,
              "alpha": 0,
              "angle": 2.057835102393195,
              "revealed": false,
              "introAnimating": false
            },
            {
              "x": -38.58312427494917,
              "y": -60.54643460851881,
              "rotation": -0.02171559475100818,
              "scale": 0.03762,
              "alpha": 0,
              "angle": 4.145030204786391,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 34,
          "paintable": true,
          "lastUpdate": 34,
          "poses": [
            {
              "x": 54.68689678355004,
              "y": 5.858443443549481,
              "rotation": -0.029814019816208466,
              "scale": 0.566949,
              "alpha": 1,
              "angle": 0.10672000000000001,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -24.391437285440634,
              "y": 50.43244975940589,
              "rotation": 0.09439636516875458,
              "scale": 0.04182,
              "alpha": 0,
              "angle": 2.021275102393195,
              "revealed": false,
              "introAnimating": false
            },
            {
              "x": -41.31948781372879,
              "y": -58.97851265786912,
              "rotation": -0.02411027916008091,
              "scale": 0.03762,
              "alpha": 0,
              "angle": 4.101270204786391,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 90,
          "paintable": true,
          "lastUpdate": 90,
          "poses": [
            {
              "x": 54.01611152227771,
              "y": 8.721524835407411,
              "rotation": -0.02698247732391404,
              "scale": 0.8014,
              "alpha": 1,
              "angle": 0.16008,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -22.634248790865012,
              "y": 51.523651638642825,
              "rotation": 0.09465750070065408,
              "scale": 0.04182,
              "alpha": 0,
              "angle": 1.984715102393195,
              "revealed": false,
              "introAnimating": false
            },
            {
              "x": -44.06033373893192,
              "y": -57.37535181507035,
              "rotation": -0.028030612489535936,
              "scale": 0.03762,
              "alpha": 0,
              "angle": 4.057510204786391,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 180,
          "paintable": true,
          "lastUpdate": 180,
          "poses": [
            {
              "x": 53.0399058823137,
              "y": 11.49594215862743,
              "rotation": -0.022336814257987087,
              "scale": 0.630315,
              "alpha": 1,
              "angle": 0.21344000000000002,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -20.90385737545786,
              "y": 52.740456894574976,
              "rotation": 0.09490243453097327,
              "scale": 0.04182,
              "alpha": 0,
              "angle": 1.9481551023931951,
              "revealed": false,
              "introAnimating": false
            },
            {
              "x": -46.81695071577408,
              "y": -55.73684727425879,
              "rotation": -0.034258375635266035,
              "scale": 0.03762,
              "alpha": 0,
              "angle": 4.013750204786391,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 260,
          "paintable": true,
          "lastUpdate": 260,
          "poses": [
            {
              "x": 51.98525013577866,
              "y": 14.208404176717758,
              "rotation": -0.018123540778974042,
              "scale": 0.430215,
              "alpha": 1,
              "angle": 0.26680000000000004,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -19.11239296399682,
              "y": 53.89300745628782,
              "rotation": 0.09493891912030983,
              "scale": 0.04182,
              "alpha": 0,
              "angle": 1.9115951023931952,
              "revealed": false,
              "introAnimating": false
            },
            {
              "x": -49.42142527292262,
              "y": -53.86543634188633,
              "rotation": -0.039705235286169024,
              "scale": 0.03762,
              "alpha": 0,
              "angle": 3.9699902047863915,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 340,
          "paintable": true,
          "lastUpdate": 340,
          "poses": [
            {
              "x": 50.80955657615273,
              "y": 16.84677151726242,
              "rotation": -0.013846769362039895,
              "scale": 0.505748,
              "alpha": 1,
              "angle": 0.32016000000000006,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -17.275600740255882,
              "y": 55.02015764388485,
              "rotation": 0.09480475188662534,
              "scale": 0.04182,
              "alpha": 0,
              "angle": 1.8750351023931953,
              "revealed": false,
              "introAnimating": false
            },
            {
              "x": -51.890599763438345,
              "y": -51.811722496659876,
              "rotation": -0.04505443372974314,
              "scale": 0.03762,
              "alpha": 0,
              "angle": 3.9262302047863917,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 480,
          "paintable": true,
          "lastUpdate": 480,
          "poses": [
            {
              "x": 49.29345896905792,
              "y": 19.319006466701587,
              "rotation": -0.006254794388366835,
              "scale": 0.4230337893649686,
              "alpha": 1,
              "angle": 0.3735200000000001,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -15.498525905226641,
              "y": 56.510192464276344,
              "rotation": 0.0941602264291677,
              "scale": 0.04182,
              "alpha": 0,
              "angle": 1.8384751023931953,
              "revealed": false,
              "introAnimating": false
            },
            {
              "x": -54.241405259233936,
              "y": -49.61461438256535,
              "rotation": -0.05414111220127404,
              "scale": 0.03762,
              "alpha": 0,
              "angle": 3.882470204786392,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 510,
          "paintable": true,
          "lastUpdate": 480,
          "poses": [
            {
              "x": 49.29345896905792,
              "y": 19.319006466701587,
              "rotation": -0.006254794388366835,
              "scale": 0.4230337893649686,
              "alpha": 1,
              "angle": 0.3735200000000001,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -15.498525905226641,
              "y": 56.510192464276344,
              "rotation": 0.0941602264291677,
              "scale": 0.04182,
              "alpha": 0,
              "angle": 1.8384751023931953,
              "revealed": false,
              "introAnimating": false
            },
            {
              "x": -54.241405259233936,
              "y": -49.61461438256535,
              "rotation": -0.05414111220127404,
              "scale": 0.03762,
              "alpha": 0,
              "angle": 3.882470204786392,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 620,
          "paintable": false,
          "lastUpdate": 620,
          "poses": [
            {
              "x": 49.29345896905792,
              "y": 19.319006466701587,
              "rotation": -0.006254794388366835,
              "scale": 0.4230337893649686,
              "alpha": 1,
              "angle": 0.3735200000000001,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -15.498525905226641,
              "y": 56.510192464276344,
              "rotation": 0.0941602264291677,
              "scale": 0.04182,
              "alpha": 0,
              "angle": 1.8384751023931953,
              "revealed": false,
              "introAnimating": false
            },
            {
              "x": -54.241405259233936,
              "y": -49.61461438256535,
              "rotation": -0.05414111220127404,
              "scale": 0.03762,
              "alpha": 0,
              "angle": 3.882470204786392,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 760,
          "paintable": false,
          "lastUpdate": 760,
          "poses": [
            {
              "x": 49.29345896905792,
              "y": 19.319006466701587,
              "rotation": -0.006254794388366835,
              "scale": 0.4230337893649686,
              "alpha": 1,
              "angle": 0.3735200000000001,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -15.498525905226641,
              "y": 56.510192464276344,
              "rotation": 0.0941602264291677,
              "scale": 0.04182,
              "alpha": 0,
              "angle": 1.8384751023931953,
              "revealed": false,
              "introAnimating": false
            },
            {
              "x": -54.241405259233936,
              "y": -49.61461438256535,
              "rotation": -0.05414111220127404,
              "scale": 0.03762,
              "alpha": 0,
              "angle": 3.882470204786392,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 990,
          "paintable": true,
          "lastUpdate": 990,
          "poses": [
            {
              "x": 46.868598005129805,
              "y": 21.31818964095019,
              "rotation": 0.021357867793851314,
              "scale": 0.41050024316906036,
              "alpha": 1,
              "angle": 0.4268800000000001,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -14.292794027891887,
              "y": 60.73671721955782,
              "rotation": 0.08748656659362507,
              "scale": 0.06273000000000001,
              "alpha": 1,
              "angle": 1.8019151023931954,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -55.1104067834493,
              "y": -46.14796112789256,
              "rotation": -0.08331942572123965,
              "scale": 0.03762,
              "alpha": 0,
              "angle": 3.838710204786392,
              "revealed": false,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1030,
          "paintable": true,
          "lastUpdate": 1030,
          "poses": [
            {
              "x": 45.61053149827974,
              "y": 23.759252473035108,
              "rotation": 0.023445451239827202,
              "scale": 0.4102943560201038,
              "alpha": 1,
              "angle": 0.4802400000000001,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -12.120933954778494,
              "y": 61.51153139887566,
              "rotation": 0.08668491096244035,
              "scale": 0.650654,
              "alpha": 1,
              "angle": 1.7653551023931955,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -56.8651759803764,
              "y": -43.531195933478536,
              "rotation": -0.08529124464951668,
              "scale": 0.05643,
              "alpha": 1,
              "angle": 3.7949502047863923,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 1140,
          "paintable": true,
          "lastUpdate": 1140,
          "poses": [
            {
              "x": 44.1706914136305,
              "y": 26.094415955368277,
              "rotation": 0.02907495800136398,
              "scale": 0.41034469789848793,
              "alpha": 1,
              "angle": 0.5336000000000001,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -9.990671064255544,
              "y": 62.705536328556754,
              "rotation": 0.08428062582963092,
              "scale": 0.702808,
              "alpha": 1,
              "angle": 1.7287951023931956,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -58.045559111340715,
              "y": -40.534374295978026,
              "rotation": -0.09043974452642137,
              "scale": 0.729441,
              "alpha": 1,
              "angle": 3.7511902047863925,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 1320,
          "paintable": true,
          "lastUpdate": 1320,
          "poses": [
            {
              "x": 42.662357555777284,
              "y": 28.37736752588374,
              "rotation": 0.037855023262314,
              "scale": 0.4123643890332577,
              "alpha": 1,
              "angle": 0.58696,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -7.840074364602605,
              "y": 64.24221758131975,
              "rotation": 0.07973275717895922,
              "scale": 0.530652,
              "alpha": 1,
              "angle": 1.6922351023931956,
              "revealed": true,
              "introAnimating": true
            },
            {
              "x": -58.44410362502673,
              "y": -37.118527703796744,
              "rotation": -0.09794740404651525,
              "scale": 0.462426,
              "alpha": 1,
              "angle": 3.7074302047863927,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 1600,
          "paintable": true,
          "lastUpdate": 1600,
          "poses": [
            {
              "x": 41.28639577447663,
              "y": 30.76007127373737,
              "rotation": 0.050126458047249946,
              "scale": 0.42002556968767035,
              "alpha": 1,
              "angle": 0.64032,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -5.6192406522552,
              "y": 66.04406926959047,
              "rotation": 0.07123441967584458,
              "scale": 0.5274104597675654,
              "alpha": 1,
              "angle": 1.6556751023931957,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -57.600569996857985,
              "y": -33.13897583340105,
              "rotation": -0.10717432695445284,
              "scale": 0.45505714387982815,
              "alpha": 1,
              "angle": 3.663670204786393,
              "revealed": true,
              "introAnimating": false
            }
          ]
        }
      ]
    },
    {
      "index": 5,
      "rolls": [
        0.95,
        0.08,
        0.21,
        0.34,
        0.47,
        0.6,
        0.73,
        0.86,
        0.99,
        0.12,
        0.25,
        0.38,
        0.51,
        0.64,
        0.77,
        0.9,
        0.03,
        0.16,
        0.29,
        0.42,
        0.55,
        0.68,
        0.81,
        0.94,
        0.07,
        0.2,
        0.33,
        0.46,
        0.59,
        0.72,
        0.85,
        0.98,
        0.11,
        0.24,
        0.37,
        0.5,
        0.63,
        0.76,
        0.89,
        0.02
      ],
      "count": 3,
      "countDraws": 1,
      "setupDraws": 31,
      "width": 163,
      "height": 130,
      "textureWidth": 120,
      "introBounce": false,
      "frames": [
        {
          "now": 0,
          "paintable": true,
          "lastUpdate": 0,
          "poses": [
            {
              "x": 55.968214172472244,
              "y": 1.8991702544334221,
              "rotation": 0.059738004417270056,
              "scale": 0.39414265204287874,
              "alpha": 1,
              "angle": 0.033920000000000006,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -31.80312307163098,
              "y": 60.72015246394579,
              "rotation": 0.05213076433925897,
              "scale": 0.4047838822849365,
              "alpha": 1,
              "angle": 2.0532751023931954,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -43.11278470622015,
              "y": -66.9787057950975,
              "rotation": -0.1268666857692823,
              "scale": 0.4556505880715835,
              "alpha": 1,
              "angle": 4.14047020478639,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 16,
          "paintable": true,
          "lastUpdate": 0,
          "poses": [
            {
              "x": 55.968214172472244,
              "y": 1.8991702544334221,
              "rotation": 0.059738004417270056,
              "scale": 0.39414265204287874,
              "alpha": 1,
              "angle": 0.033920000000000006,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -31.80312307163098,
              "y": 60.72015246394579,
              "rotation": 0.05213076433925897,
              "scale": 0.4047838822849365,
              "alpha": 1,
              "angle": 2.0532751023931954,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -43.11278470622015,
              "y": -66.9787057950975,
              "rotation": -0.1268666857692823,
              "scale": 0.4556505880715835,
              "alpha": 1,
              "angle": 4.14047020478639,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 34,
          "paintable": true,
          "lastUpdate": 34,
          "poses": [
            {
              "x": 55.8462435909258,
              "y": 3.794431946515442,
              "rotation": 0.061439688028591365,
              "scale": 0.3939259185215463,
              "alpha": 1,
              "angle": 0.06784000000000001,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -29.417887938527848,
              "y": 62.26778730647729,
              "rotation": 0.05022798041669841,
              "scale": 0.40674735806860735,
              "alpha": 1,
              "angle": 2.0121551023931956,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -46.22286603666647,
              "y": -64.71347786472636,
              "rotation": -0.1273900905381841,
              "scale": 0.4547607984483422,
              "alpha": 1,
              "angle": 4.09215020478639,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 90,
          "paintable": true,
          "lastUpdate": 90,
          "poses": [
            {
              "x": 55.66368895148572,
              "y": 5.68396989945085,
              "rotation": 0.06414354560009791,
              "scale": 0.393766628810416,
              "alpha": 1,
              "angle": 0.10176000000000002,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -27.037248260891527,
              "y": 63.90655822531811,
              "rotation": 0.047050730936200186,
              "scale": 0.4099318411223675,
              "alpha": 1,
              "angle": 1.9710351023931956,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -49.154220463745425,
              "y": -62.227541446026144,
              "rotation": -0.128104926256502,
              "scale": 0.45316461747243647,
              "alpha": 1,
              "angle": 4.043830204786389,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 180,
          "paintable": true,
          "lastUpdate": 180,
          "poses": [
            {
              "x": 55.455947712218816,
              "y": 7.570777070190079,
              "rotation": 0.06821919734931656,
              "scale": 0.3940271416064217,
              "alpha": 1,
              "angle": 0.13568000000000002,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -24.67368082146744,
              "y": 65.72688014228018,
              "rotation": 0.04183940906421584,
              "scale": 0.4148789531940903,
              "alpha": 1,
              "angle": 1.9299151023931955,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -51.83888684305215,
              "y": -59.478226363412475,
              "rotation": -0.12886772881600242,
              "scale": 0.45027420545916097,
              "alpha": 1,
              "angle": 3.9955102047863895,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 260,
          "paintable": true,
          "lastUpdate": 260,
          "poses": [
            {
              "x": 55.23559895993983,
              "y": 9.458823678685077,
              "rotation": 0.07154806950457661,
              "scale": 0.39479048169140674,
              "alpha": 1,
              "angle": 0.16960000000000003,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -22.16633937695279,
              "y": 67.34012099405446,
              "rotation": 0.03710865346773958,
              "scale": 0.4190469613547095,
              "alpha": 1,
              "angle": 1.8887951023931955,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -54.378854990007156,
              "y": -56.621295058151105,
              "rotation": -0.1291443140125495,
              "scale": 0.44739077105302694,
              "alpha": 1,
              "angle": 3.9471902047863896,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 340,
          "paintable": true,
          "lastUpdate": 340,
          "poses": [
            {
              "x": 55.00012699998972,
              "y": 11.35077820385775,
              "rotation": 0.07458617312871874,
              "scale": 0.3960461540987376,
              "alpha": 1,
              "angle": 0.20352000000000003,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -19.55647357940657,
              "y": 68.81768190383667,
              "rotation": 0.03229607936237263,
              "scale": 0.42294685084030503,
              "alpha": 1,
              "angle": 1.8476751023931954,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -56.74096563503539,
              "y": -53.63627173884357,
              "rotation": -0.12904217206004706,
              "scale": 0.44423740483417457,
              "alpha": 1,
              "angle": 3.8988702047863897,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 480,
          "paintable": true,
          "lastUpdate": 480,
          "poses": [
            {
              "x": 54.90133164037489,
              "y": 13.28640152425978,
              "rotation": 0.07916674944972422,
              "scale": 0.3993858508979774,
              "alpha": 1,
              "angle": 0.23744000000000004,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -16.947763943080233,
              "y": 70.5492136646707,
              "rotation": 0.023709203814925472,
              "scale": 0.4289878500016983,
              "alpha": 1,
              "angle": 1.8065551023931954,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -58.64598980236877,
              "y": -50.30170279324738,
              "rotation": -0.12795363837205667,
              "scale": 0.4381522982892208,
              "alpha": 1,
              "angle": 3.8505502047863898,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 510,
          "paintable": true,
          "lastUpdate": 480,
          "poses": [
            {
              "x": 54.90133164037489,
              "y": 13.28640152425978,
              "rotation": 0.07916674944972422,
              "scale": 0.3993858508979774,
              "alpha": 1,
              "angle": 0.23744000000000004,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -16.947763943080233,
              "y": 70.5492136646707,
              "rotation": 0.023709203814925472,
              "scale": 0.4289878500016983,
              "alpha": 1,
              "angle": 1.8065551023931954,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -58.64598980236877,
              "y": -50.30170279324738,
              "rotation": -0.12795363837205667,
              "scale": 0.4381522982892208,
              "alpha": 1,
              "angle": 3.8505502047863898,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 620,
          "paintable": false,
          "lastUpdate": 620,
          "poses": [
            {
              "x": 54.90133164037489,
              "y": 13.28640152425978,
              "rotation": 0.07916674944972422,
              "scale": 0.3993858508979774,
              "alpha": 1,
              "angle": 0.23744000000000004,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -16.947763943080233,
              "y": 70.5492136646707,
              "rotation": 0.023709203814925472,
              "scale": 0.4289878500016983,
              "alpha": 1,
              "angle": 1.8065551023931954,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -58.64598980236877,
              "y": -50.30170279324738,
              "rotation": -0.12795363837205667,
              "scale": 0.4381522982892208,
              "alpha": 1,
              "angle": 3.8505502047863898,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 760,
          "paintable": false,
          "lastUpdate": 760,
          "poses": [
            {
              "x": 54.90133164037489,
              "y": 13.28640152425978,
              "rotation": 0.07916674944972422,
              "scale": 0.3993858508979774,
              "alpha": 1,
              "angle": 0.23744000000000004,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -16.947763943080233,
              "y": 70.5492136646707,
              "rotation": 0.023709203814925472,
              "scale": 0.4289878500016983,
              "alpha": 1,
              "angle": 1.8065551023931954,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -58.64598980236877,
              "y": -50.30170279324738,
              "rotation": -0.12795363837205667,
              "scale": 0.4381522982892208,
              "alpha": 1,
              "angle": 3.8505502047863898,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 990,
          "paintable": true,
          "lastUpdate": 990,
          "poses": [
            {
              "x": 56.633599908045966,
              "y": 15.756761989884025,
              "rotation": 0.08723278184689164,
              "scale": 0.42179816802328396,
              "alpha": 1,
              "angle": 0.27136000000000005,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -14.414471051452434,
              "y": 73.11997548240498,
              "rotation": -0.008483117926157413,
              "scale": 0.4398094254005507,
              "alpha": 1,
              "angle": 1.7654351023931953,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -58.212161918765744,
              "y": -45.238242275522204,
              "rotation": -0.11445565000659323,
              "scale": 0.4123986057757106,
              "alpha": 1,
              "angle": 3.80223020478639,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1030,
          "paintable": true,
          "lastUpdate": 1030,
          "poses": [
            {
              "x": 56.29520173632504,
              "y": 17.74036352688047,
              "rotation": 0.0872657305887393,
              "scale": 0.4240589443354245,
              "alpha": 1,
              "angle": 0.30528000000000005,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -11.399830798340673,
              "y": 73.67263450175172,
              "rotation": -0.011013507897353756,
              "scale": 0.43980611946269865,
              "alpha": 1,
              "angle": 1.7243151023931953,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -60.08263734165773,
              "y": -42.20048901165509,
              "rotation": -0.11279343292309581,
              "scale": 0.4103118042281945,
              "alpha": 1,
              "angle": 3.75391020478639,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1140,
          "paintable": true,
          "lastUpdate": 1140,
          "poses": [
            {
              "x": 56.31253668446508,
              "y": 19.869148120728056,
              "rotation": 0.08689928570778152,
              "scale": 0.43049736462907917,
              "alpha": 1,
              "angle": 0.33920000000000006,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -8.356701761882178,
              "y": 74.03533197837743,
              "rotation": -0.017936590290524242,
              "scale": 0.43913120051677973,
              "alpha": 1,
              "angle": 1.6831951023931953,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -61.344269441356005,
              "y": -38.80223849581128,
              "rotation": -0.1077997481362462,
              "scale": 0.4046499122114805,
              "alpha": 1,
              "angle": 3.70559020478639,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1320,
          "paintable": true,
          "lastUpdate": 1320,
          "poses": [
            {
              "x": 56.73041285972296,
              "y": 22.207510886666817,
              "rotation": 0.0848632938766775,
              "scale": 0.4414545838020319,
              "alpha": 1,
              "angle": 0.37312000000000006,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -5.277702469154104,
              "y": 73.91767491312474,
              "rotation": -0.029090942047188623,
              "scale": 0.4359684228829448,
              "alpha": 1,
              "angle": 1.6420751023931952,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -61.95196961431995,
              "y": -35.11663759941437,
              "rotation": -0.09835336587669515,
              "scale": 0.3958248319103608,
              "alpha": 1,
              "angle": 3.65727020478639,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1600,
          "paintable": true,
          "lastUpdate": 1600,
          "poses": [
            {
              "x": 57.74578943809926,
              "y": 24.895166055182486,
              "rotation": 0.07825776259345608,
              "scale": 0.45831939903986835,
              "alpha": 1,
              "angle": 0.40704000000000007,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -2.1932045523411423,
              "y": 72.69988665581816,
              "rotation": -0.04575257170293128,
              "scale": 0.4264445644353451,
              "alpha": 1,
              "angle": 1.6009551023931952,
              "revealed": true,
              "introAnimating": false
            },
            {
              "x": -61.72250328770432,
              "y": -31.148018553058034,
              "rotation": -0.0808182645131113,
              "scale": 0.38397005811258256,
              "alpha": 1,
              "angle": 3.60895020478639,
              "revealed": true,
              "introAnimating": false
            }
          ]
        }
      ]
    },
    {
      "index": 6,
      "rolls": [
        0.14,
        0.27,
        0.4,
        0.53,
        0.66,
        0.79,
        0.92,
        0.05,
        0.18,
        0.31,
        0.44,
        0.57,
        0.7,
        0.83,
        0.96,
        0.09,
        0.22,
        0.35,
        0.48,
        0.61,
        0.74,
        0.87,
        0,
        0.13,
        0.26,
        0.39,
        0.52,
        0.65,
        0.78,
        0.91,
        0.04,
        0.17,
        0.3,
        0.43,
        0.56,
        0.69,
        0.82,
        0.95,
        0.08,
        0.21
      ],
      "count": 1,
      "countDraws": 1,
      "setupDraws": 11,
      "width": 170,
      "height": 128,
      "textureWidth": 128,
      "introBounce": true,
      "frames": [
        {
          "now": 0,
          "paintable": true,
          "lastUpdate": 0,
          "poses": [
            {
              "x": 64.58946345166889,
              "y": 2.486630001092819,
              "rotation": 0.09347132728150606,
              "scale": 0.04764375,
              "alpha": 1,
              "angle": 0.03848000000000001,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 16,
          "paintable": true,
          "lastUpdate": 0,
          "poses": [
            {
              "x": 64.58946345166889,
              "y": 2.486630001092819,
              "rotation": 0.09347132728150606,
              "scale": 0.271483,
              "alpha": 1,
              "angle": 0.03848000000000001,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 34,
          "paintable": true,
          "lastUpdate": 34,
          "poses": [
            {
              "x": 64.7178479624798,
              "y": 4.990542202119407,
              "rotation": 0.09275770630122962,
              "scale": 0.449968,
              "alpha": 1,
              "angle": 0.07696000000000001,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 90,
          "paintable": true,
          "lastUpdate": 90,
          "poses": [
            {
              "x": 64.93636251119875,
              "y": 7.529731497400395,
              "rotation": 0.0915107153024519,
              "scale": 0.636044,
              "alpha": 1,
              "angle": 0.11544000000000001,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 180,
          "paintable": true,
          "lastUpdate": 180,
          "poses": [
            {
              "x": 65.35840847156045,
              "y": 10.140171165559202,
              "rotation": 0.08932265301789666,
              "scale": 0.500259,
              "alpha": 1,
              "angle": 0.15392000000000003,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 260,
          "paintable": true,
          "lastUpdate": 260,
          "poses": [
            {
              "x": 65.61172549184516,
              "y": 12.781804510131591,
              "rotation": 0.08719114687274199,
              "scale": 0.341447,
              "alpha": 1,
              "angle": 0.19240000000000004,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 340,
          "paintable": true,
          "lastUpdate": 340,
          "poses": [
            {
              "x": 65.77000871137105,
              "y": 15.460674217530096,
              "rotation": 0.08488840246866487,
              "scale": 0.401395,
              "alpha": 1,
              "angle": 0.23088000000000006,
              "revealed": true,
              "introAnimating": true
            }
          ]
        },
        {
          "now": 480,
          "paintable": true,
          "lastUpdate": 480,
          "poses": [
            {
              "x": 66.34612495709789,
              "y": 18.316124092174817,
              "rotation": 0.08046034531262038,
              "scale": 0.3707738657778367,
              "alpha": 1,
              "angle": 0.26936000000000004,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 510,
          "paintable": true,
          "lastUpdate": 480,
          "poses": [
            {
              "x": 66.34612495709789,
              "y": 18.316124092174817,
              "rotation": 0.08046034531262038,
              "scale": 0.3707738657778367,
              "alpha": 1,
              "angle": 0.26936000000000004,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 620,
          "paintable": false,
          "lastUpdate": 620,
          "poses": [
            {
              "x": 66.34612495709789,
              "y": 18.316124092174817,
              "rotation": 0.08046034531262038,
              "scale": 0.3707738657778367,
              "alpha": 1,
              "angle": 0.26936000000000004,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 760,
          "paintable": false,
          "lastUpdate": 760,
          "poses": [
            {
              "x": 66.34612495709789,
              "y": 18.316124092174817,
              "rotation": 0.08046034531262038,
              "scale": 0.3707738657778367,
              "alpha": 1,
              "angle": 0.26936000000000004,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 990,
          "paintable": true,
          "lastUpdate": 990,
          "poses": [
            {
              "x": 69.55291114431473,
              "y": 22.114174990688763,
              "rotation": 0.0604667875895039,
              "scale": 0.3943239243716431,
              "alpha": 1,
              "angle": 0.30784000000000006,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1030,
          "paintable": true,
          "lastUpdate": 1030,
          "poses": [
            {
              "x": 68.89841968470678,
              "y": 24.862940445191892,
              "rotation": 0.0586723422923069,
              "scale": 0.39572875553435144,
              "alpha": 1,
              "angle": 0.34632000000000007,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1140,
          "paintable": true,
          "lastUpdate": 1140,
          "poses": [
            {
              "x": 68.49986354714419,
              "y": 27.741705068851974,
              "rotation": 0.05359176273228361,
              "scale": 0.39913175397059475,
              "alpha": 1,
              "angle": 0.3848000000000001,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1320,
          "paintable": true,
          "lastUpdate": 1320,
          "poses": [
            {
              "x": 68.1449502383745,
              "y": 30.700148630821225,
              "rotation": 0.044857862377132754,
              "scale": 0.40309615372570645,
              "alpha": 1,
              "angle": 0.4232800000000001,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1600,
          "paintable": true,
          "lastUpdate": 1600,
          "poses": [
            {
              "x": 67.48119016181411,
              "y": 33.581522398073865,
              "rotation": 0.0304193133243013,
              "scale": 0.4048860893705088,
              "alpha": 1,
              "angle": 0.4617600000000001,
              "revealed": true,
              "introAnimating": false
            }
          ]
        }
      ]
    },
    {
      "index": 7,
      "rolls": [
        0.33,
        0.46,
        0.59,
        0.72,
        0.85,
        0.98,
        0.11,
        0.24,
        0.37,
        0.5,
        0.63,
        0.76,
        0.89,
        0.02,
        0.15,
        0.28,
        0.41,
        0.54,
        0.67,
        0.8,
        0.93,
        0.06,
        0.19,
        0.32,
        0.45,
        0.58,
        0.71,
        0.84,
        0.97,
        0.1,
        0.23,
        0.36,
        0.49,
        0.62,
        0.75,
        0.88,
        0.01,
        0.14,
        0.27,
        0.4
      ],
      "count": 1,
      "countDraws": 1,
      "setupDraws": 11,
      "width": 177,
      "height": 126,
      "textureWidth": 136,
      "introBounce": false,
      "frames": [
        {
          "now": 0,
          "paintable": true,
          "lastUpdate": 0,
          "poses": [
            {
              "x": 79.63236677676184,
              "y": 3.429494974024686,
              "rotation": 1.393592547007341e-17,
              "scale": 0.37914589400490245,
              "alpha": 1,
              "angle": 0.04304,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 16,
          "paintable": true,
          "lastUpdate": 0,
          "poses": [
            {
              "x": 79.63236677676184,
              "y": 3.429494974024686,
              "rotation": 1.393592547007341e-17,
              "scale": 0.37914589400490245,
              "alpha": 1,
              "angle": 0.04304,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 34,
          "paintable": true,
          "lastUpdate": 34,
          "poses": [
            {
              "x": 79.70233018270005,
              "y": 6.877772542274673,
              "rotation": -0.0023638170065620463,
              "scale": 0.38052527346108284,
              "alpha": 1,
              "angle": 0.08608,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 90,
          "paintable": true,
          "lastUpdate": 90,
          "poses": [
            {
              "x": 79.78382003286994,
              "y": 10.35932104332026,
              "rotation": -0.006254459487140445,
              "scale": 0.38266875702721753,
              "alpha": 1,
              "angle": 0.12912,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 180,
          "paintable": true,
          "lastUpdate": 180,
          "poses": [
            {
              "x": 79.91087035113298,
              "y": 13.89500579041835,
              "rotation": -0.012490010879015374,
              "scale": 0.3857500581983083,
              "alpha": 1,
              "angle": 0.17216,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 260,
          "paintable": true,
          "lastUpdate": 260,
          "poses": [
            {
              "x": 79.72656733871811,
              "y": 17.427012573342274,
              "rotation": -0.018001608138417065,
              "scale": 0.3880789722086427,
              "alpha": 1,
              "angle": 0.2152,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 340,
          "paintable": true,
          "lastUpdate": 340,
          "poses": [
            {
              "x": 79.30268073474284,
              "y": 20.946841252381454,
              "rotation": -0.023470203539254924,
              "scale": 0.3899916861864616,
              "alpha": 1,
              "angle": 0.25824,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 480,
          "paintable": true,
          "lastUpdate": 480,
          "poses": [
            {
              "x": 78.80883929431005,
              "y": 24.48900258843131,
              "rotation": -0.0328975550758577,
              "scale": 0.3922690548157197,
              "alpha": 1,
              "angle": 0.30128000000000005,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 510,
          "paintable": true,
          "lastUpdate": 480,
          "poses": [
            {
              "x": 78.80883929431005,
              "y": 24.48900258843131,
              "rotation": -0.0328975550758577,
              "scale": 0.3922690548157197,
              "alpha": 1,
              "angle": 0.30128000000000005,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 620,
          "paintable": false,
          "lastUpdate": 620,
          "poses": [
            {
              "x": 78.80883929431005,
              "y": 24.48900258843131,
              "rotation": -0.0328975550758577,
              "scale": 0.3922690548157197,
              "alpha": 1,
              "angle": 0.30128000000000005,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 760,
          "paintable": false,
          "lastUpdate": 760,
          "poses": [
            {
              "x": 78.80883929431005,
              "y": 24.48900258843131,
              "rotation": -0.0328975550758577,
              "scale": 0.3922690548157197,
              "alpha": 1,
              "angle": 0.30128000000000005,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 990,
          "paintable": true,
          "lastUpdate": 990,
          "poses": [
            {
              "x": 77.04137475521274,
              "y": 27.62741510739897,
              "rotation": -0.06471225014789826,
              "scale": 0.3883942342260064,
              "alpha": 1,
              "angle": 0.34432000000000007,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1030,
          "paintable": true,
          "lastUpdate": 1030,
          "poses": [
            {
              "x": 75.58148895748414,
              "y": 30.835145022237825,
              "rotation": -0.06698038154174095,
              "scale": 0.38731111986925965,
              "alpha": 1,
              "angle": 0.3873600000000001,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1140,
          "paintable": true,
          "lastUpdate": 1140,
          "poses": [
            {
              "x": 73.54673271247911,
              "y": 33.76569078786722,
              "rotation": -0.0730074714187879,
              "scale": 0.3838191870432541,
              "alpha": 1,
              "angle": 0.4304000000000001,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1320,
          "paintable": true,
          "lastUpdate": 1320,
          "poses": [
            {
              "x": 70.7298198068679,
              "y": 36.23496523832701,
              "rotation": -0.08214705184335303,
              "scale": 0.3766692521293738,
              "alpha": 1,
              "angle": 0.47344000000000014,
              "revealed": true,
              "introAnimating": false
            }
          ]
        },
        {
          "now": 1600,
          "paintable": true,
          "lastUpdate": 1600,
          "poses": [
            {
              "x": 66.64314171598186,
              "y": 37.84645763346281,
              "rotation": -0.09435443633660957,
              "scale": 0.36299123979785386,
              "alpha": 1,
              "angle": 0.5164800000000002,
              "revealed": true,
              "introAnimating": false
            }
          ]
        }
      ]
    }
  ]
}
"""#
        let oracle=try JSONDecoder().decode(HaloOracle.self,from:Data(json.utf8));XCTAssertEqual(oracle.cases.count,8)
        for c in oracle.cases {
            var draws=0
            let random:()->Double={let value=c.rolls[draws];draws+=1;return value}
            let count=try XCTUnwrap(NativeSourceStarHaloMotion.pickCount(random:random))
            XCTAssertEqual(count,c.count);XCTAssertEqual(draws,c.countDraws)
            var stars=try XCTUnwrap(NativeSourceStarHaloMotion.makeStars(count:count,textureWidth:c.textureWidth,introBounce:c.introBounce,performanceNow:{0},random:random))
            XCTAssertEqual(draws,c.setupDraws)
            // Preserve the old sparse oracle for unchanged motion/intro math;
            // the user-approved phase/cadence delta is covered separately.
            for index in stars.indices {stars[index].angle=Double.pi*2*Double(index)/Double(count)}
            var field=NativeSourceStarHaloMotion.Field(stars:stars,lastUpdate:-1000/30,introBounce:c.introBounce),roots:[Int:Double]=[:]
            for frame in c.frames {
                for (index,start) in roots{field.paintIntro(index:index,seconds:max(0,(frame.now-start)/1000))}
                let started = (!frame.paintable || frame.now-field.lastUpdate>=1000/30)
                    ? field.tick(now:frame.now,paintable:frame.paintable,width:c.width,height:c.height):[]
                for index in started{roots[index]=frame.now}
                XCTAssertEqual(field.lastUpdate,frame.lastUpdate,accuracy:0.000001)
                for (index,expected) in frame.poses.enumerated() {
                    let actual=field.stars[index],message="case \(c.index) at \(frame.now), star \(index)"
                    XCTAssertEqual(actual.pose.x,expected.x,accuracy:0.000001,message)
                    XCTAssertEqual(actual.pose.y,expected.y,accuracy:0.000001,message)
                    XCTAssertEqual(actual.pose.rotation,expected.rotation,accuracy:0.000001,message)
                    XCTAssertEqual(actual.pose.scale,expected.scale,accuracy:0.00002,message)
                    XCTAssertEqual(actual.pose.alpha,expected.alpha,accuracy:0.000001,message)
                    XCTAssertEqual(actual.angle,expected.angle,accuracy:0.000001,message)
                    XCTAssertEqual(actual.revealed,expected.revealed,message)
                    XCTAssertEqual(actual.introAnimating,expected.introAnimating,message)
                }
            }
            XCTAssertEqual(draws,c.setupDraws,"ticker and intro must never redraw Math")
        }
    }
    func testHaloUsesFreshRandomPhasesWithoutAdditionalSharedMathDraws()throws {
        var draws=0,seed:UInt32=42
        func random()->Double {draws+=1;seed=seed &* 1664525 &+ 1013904223;return Double(seed)/4294967296}
        let first=try XCTUnwrap(NativeSourceStarHaloMotion.makeStars(count:3,textureWidth:56,introBounce:false,performanceNow:{0},random:random))
        let second=try XCTUnwrap(NativeSourceStarHaloMotion.makeStars(count:3,textureWidth:56,introBounce:false,performanceNow:{0},random:random))
        XCTAssertEqual(draws,60)
        XCTAssertNotEqual(first.map(\.angle),second.map(\.angle))
        for (index,star) in first.enumerated(){XCTAssertEqual(star.angle,Double.pi*2*Double(index)/3+star.pulsePhase,accuracy:1e-9)}
    }
    func testActualHaloPaintsEverySixtyHzDeliveryAndHiddenResumeDoesNotJump()throws {
        var wall=0.0,visible=true
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall},sourceFrameTransportEnabled:true)
        let ticker=NativeSourceStarHaloTicker(service:service,generation:1,current:{true},performanceNow:{wall})
        let stars=try XCTUnwrap(NativeSourceStarHaloMotion.makeStars(count:1,textureWidth:56,introBounce:false,performanceNow:{0},random:{0.25}))
        let parent=SKNode(),node=try XCTUnwrap(NativeSourceStarHaloPresentation(stars:stars,texture:nil,introBounce:false,performanceMilliseconds:0,service:service,generation:1,current:{true},paintable:{visible},metrics:{.init(width:128,height:128)}))
        defer{node.dispose();ticker.dispose();service.dispose()}
        parent.addChild(node);XCTAssertTrue(node.start(ticker:ticker))
        var previous=node.paintedPoses[0].x
        for frame in 1...60 {
            wall=Double(frame)*1000/60;service.deliver(wallMilliseconds:wall)
            XCTAssertNotEqual(node.paintedPoses[0].x,previous,"No 30Hz skipped frame at \(frame)")
            previous=node.paintedPoses[0].x
        }
        visible=false;wall=10000;service.deliver(wallMilliseconds:wall)
        XCTAssertEqual(node.paintedPoses[0].x,previous)
        visible=true;wall+=1000/60;service.deliver(wallMilliseconds:wall)
        XCTAssertNotEqual(node.paintedPoses[0].x,previous)
        XCTAssertLessThan(abs(node.paintedPoses[0].x-previous),15,"Hidden wall time must not advance the orbit as ten seconds of motion")
        node.dispose();XCTAssertEqual(service.sourceTickerListenerCount,0)
    }
    func testSourceHaloSetupStopsAfterReentrantRetirementWithoutMoreMath() {
        var current=true,draws=0
        let stars=NativeSourceStarHaloMotion.makeStars(count:3,textureWidth:128,introBounce:true,performanceNow:{0},random:{draws+=1;current=false;return 0.5},current:{current})
        XCTAssertNil(stars);XCTAssertEqual(draws,1)
        XCTAssertNil(NativeSourceStarHaloMotion.pickCount(random:{.nan}))
    }

    func testSourceStarEarlyCaptureRetainsTexturesAndPosesAfterRendererDisposal()throws {
        let textures=NativeBoardTextures(root:root);defer{textures.dispose()}
        let texture=try XCTUnwrap(textures.texture("assets/small-star@3x.png",densityAware:false))
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true);defer{service.dispose()}
        let stars=try XCTUnwrap(NativeSourceStarHaloMotion.makeStars(count:2,textureWidth:Double(texture.size().width),introBounce:false,performanceNow:{0},random:{0.5}))
        let halo=try XCTUnwrap(NativeSourceStarHaloPresentation(stars:stars,texture:texture,introBounce:false,performanceMilliseconds:0,service:service,generation:1,current:{true},paintable:{true},metrics:{.init(width:128,height:128)}))
        let stage=SKScene(size:.init(width:390,height:844));stage.addChild(halo);halo.position = .init(x:123,y:456)
        let captured=try XCTUnwrap(halo.captureForMerge(in:stage));XCTAssertEqual(captured.stars.count,2);XCTAssertEqual(captured.systemCount,2)
        let first=try XCTUnwrap(captured.stars.first);XCTAssertTrue(first.texture === texture)
        halo.dispose();XCTAssertNil(halo.captureForMerge(in:stage))
        XCTAssertEqual(first.position,.init(x:123,y:456));XCTAssertTrue(captured.stars[0].texture === texture)
        XCTAssertEqual(NativeSpawnRules.sourceStarOrbitCountForSpawn(savedPositions:captured.stars.count,savedSystem:captured.systemCount,liveSystem:0),2)
    }
    func testActualScenePlainStarCallUsesSharedMathAndRetiresAboveHUDOnScopeReplacement()async throws {try await runActualSceneStar(contact:false)}
    func testActualSceneDragContactCapturesLiveOrbitBeforeRemoval()async throws {try await runActualSceneStar(contact:true)}
    func testArcadeHidesOrbitingStarsWhileJourneyKeepsThem()async throws {try await runActualSceneStar(contact:false,mode:.arcade)}
    private func runActualSceneStar(contact:Bool,mode:NativeRunMode = .journey)async throws {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true);service.sourceMicrotaskTasks=tasks
        var draws=0
        let context=NativeGameplaySourceContext(service:service,visualRandom:{draws+=1;return 0.5},sourceMicrotaskTasks:tasks)
        let star=NativeTile(id:"scene-star",cell:.init(column:0,row:0),value:6,archetype:.star)
        let tiles=contact ? [star,NativeTile(id:"target",cell:.init(column:1,row:0),value:2),NativeTile(id:"survivor",cell:.init(column:4,row:8),value:1),NativeTile(id:"holder",cell:.init(column:0,row:1),value:0,locked:true)]:[star]
        let engine=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,mode:mode))
        if contact {engine.stagedDirectWildMoves=true;engine.stagedDirectWildAssignments=true;engine.specialPresentationAdmitted={_,_ in true}}
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844))
        let scope=try XCTUnwrap(context.beginScene(engine:engine){scene.retireSourceAnimationBindings()})
        defer{scene.dispose();context.dispose();service.dispose();fifo.dispose()}
        scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
        XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo))
        scene.layout(size:scene.size,insets:.zero);scene.synchronize()
        let node=try XCTUnwrap(scene.sourceNativeTileNode(star.id))
        XCTAssertTrue(scene.configureSourcePlainStarHalos(scope:scope,performanceNow:{0}))
        let before=draws
        tasks.inputTask {XCTAssertTrue(scene.beginSourcePlainStarHalo(node,introBounce:true))}
        let deadline=Date().addingTimeInterval(5)
        while node.sourceLiveStarHaloCount==0 && Date()<deadline {try await Task.sleep(nanoseconds:10_000_000)}
        XCTAssertEqual(node.sourceLiveStarHaloCount,2);XCTAssertEqual(draws-before,21)
        let orbit=try XCTUnwrap(scene.childNode(withName:"//native-source-wild-star-orbit"))
        XCTAssertEqual(orbit.isHidden,mode == .arcade)
        XCTAssertEqual(scene.children.filter{$0.name=="ANIMATED_DICE_HUD_FOREGROUND"}.count,1)
        if contact {
            XCTAssertTrue(scene.configureSourceSpecialTransactions(scope:scope))
            let target=try XCTUnwrap(scene.sourceNativeTileNode("target"))
            tasks.inputTask {
                XCTAssertTrue(scene.beginDrag(at:node.convert(CGPoint.zero,to:scene)))
                let result=scene.finishDrag(at:target.convert(CGPoint.zero,to:scene),now:1)
                XCTAssertTrue(result?.accepted == true)
            }
            let plan=try XCTUnwrap(engine.pendingDirectWild)
            XCTAssertEqual(plan.sourceStarOrbitCapture?.tileID,star.id)
            XCTAssertEqual(plan.sourceStarOrbitCapture?.savedPositions,2)
            XCTAssertEqual(plan.sourceStarOrbitCapture?.savedSystem,2)
        }
        scope.dispose();XCTAssertEqual(node.sourceLiveStarHaloCount,0)
        XCTAssertTrue(scene.children.filter{$0.name=="ANIMATED_DICE_HUD_FOREGROUND"}.isEmpty)
    }
    func testSourceStarForegroundPreservesAffineShearAlphaAndOriginalOrbitIdentity()throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let stars=try XCTUnwrap(NativeSourceStarHaloMotion.makeStars(count:1,textureWidth:56,introBounce:false,performanceNow:{0},random:{0.5}))
        let orbit=try XCTUnwrap(NativeSourceStarHaloPresentation(stars:stars,texture:nil,introBounce:false,performanceMilliseconds:0,service:service,generation:1,current:{true},paintable:{true},metrics:{.init(width:128,height:128)}))
        let scene=SKScene(size:.init(width:390,height:844)),branch=SKNode(),host=SKNode(),layer=SKNode()
        scene.alpha=0.3;scene.addChild(branch);branch.addChild(host);scene.addChild(layer);host.addChild(orbit)
        branch.position = .init(x:80,y:150);branch.xScale=1.7;branch.yScale=0.6;branch.zRotation=0.4;branch.alpha=0.4
        host.position = .init(x:20,y:30);host.xScale=0.8;host.yScale = -1.2;host.zRotation = -0.7;host.alpha=0.5
        layer.position = .init(x:12,y:18);layer.xScale=0.9;layer.yScale=1.3;layer.zRotation=0.2
        let foreground=try XCTUnwrap(NativeSourceStarHaloForeground(orbit:orbit,host:host,layer:layer))
        defer{foreground.dispose();orbit.dispose();service.dispose()}
        for point in [CGPoint.zero,.init(x:10,y:0),.init(x:0,y:14),.init(x:-7,y:22)] {
            let actual=orbit.convert(point,to:scene),expected=host.convert(point,to:scene)
            XCTAssertEqual(actual.x,expected.x,accuracy:0.001);XCTAssertEqual(actual.y,expected.y,accuracy:0.001)
        }
        XCTAssertEqual(orbit.parent!.parent!.alpha,0.2,accuracy:0.000001)
        branch.isHidden=true;XCTAssertFalse(foreground.sync());branch.isHidden=false;XCTAssertTrue(foreground.sync())
        foreground.dispose();XCTAssertTrue(orbit.parent === host);XCTAssertEqual(orbit.starCount,1)
        XCTAssertTrue(orbit.mountAboveHUD(host:host,layer:layer,artworkZIndex:3000))
        XCTAssertEqual(layer.children.count,1);XCTAssertEqual(layer.children[0].zPosition,3001)
        orbit.dispose();XCTAssertTrue(layer.children.isEmpty);XCTAssertNil(orbit.parent)
    }
    func testSourcePlainStarAsyncAttachmentRetirementStopsSetupMath()async throws {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let ticker=NativeSourceStarHaloTicker(service:service,generation:1,current:{true},performanceNow:{0})
        let uploaded=expectation(description:"captured Star texture decoded")
        var finish:(@Sendable()->Void)?,draws=0,mounts=0
        let textures=NativeBoardTextures(root:root,selectedFinalePreload:{_,done in finish=done;uploaded.fulfill()})
        let parent=SKNode(),host=NativeDiceNode(id:"async-attach",value:6,kind:"wild",variant:nil,depth:1,locked:false,textures:textures)
        let driver=NativeSourceOuterTimelineAdapter(service:service);parent.addChild(host);host.installSourceOuterDriver(driver,generation:1,geometryScale:1)
        defer{host.dispose();ticker.dispose();service.dispose();textures.dispose();fifo.dispose()}
        tasks.inputTask {
            XCTAssertTrue(host.beginSourcePlainStarHalo(service:service,ticker:ticker,tasks:tasks,generation:1,introBounce:true,random:{draws+=1;return 0.5},performanceNow:{0},current:{true},paintable:{true},metrics:{.init(width:128,height:128)},mount:{halo in mounts+=1;host.addChild(halo);return true}))
        }
        XCTAssertEqual(draws,1);XCTAssertEqual(host.sourceLiveStarHaloCount,0)
        await fulfillment(of:[uploaded],timeout:5)
        XCTAssertEqual(draws,1)
        host.installSourceOuterDriver(driver,generation:2,geometryScale:1)
        let done=try XCTUnwrap(finish);done()
        let drained=expectation(description:"late Star result drained");DispatchQueue.main.async{drained.fulfill()};await fulfillment(of:[drained],timeout:5)
        XCTAssertEqual(draws,1);XCTAssertEqual(mounts,0);XCTAssertEqual(service.sourceTickerListenerCount,0)
    }
    func testSourcePlainStarAttachmentConsumesCountBeforeSetupAndRetainsExistingOwner()throws {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let ticker=NativeSourceStarHaloTicker(service:service,generation:1,current:{true},performanceNow:{0})
        let textures=NativeBoardTextures(root:root);_ = try XCTUnwrap(textures.texture("assets/small-star@3x.png",densityAware:false))
        let parent=SKNode(),host=NativeDiceNode(id:"source-attach",value:6,kind:"wild",variant:nil,depth:1,locked:false,textures:textures)
        parent.addChild(host);host.installSourceOuterDriver(NativeSourceOuterTimelineAdapter(service:service),generation:1,geometryScale:1)
        defer{host.dispose();ticker.dispose();service.dispose();textures.dispose();fifo.dispose()}
        var draws=0
        func start(_ force:Bool)->Bool {
            host.beginSourcePlainStarHalo(service:service,ticker:ticker,tasks:tasks,generation:1,introBounce:true,force:force,random:{draws+=1;return 0.5},performanceNow:{0},current:{true},paintable:{true},metrics:{.init(width:128,height:128)},mount:{halo in XCTAssertEqual(draws,force ? 42:21);host.addChild(halo);return true})
        }
        XCTAssertTrue(start(false));XCTAssertEqual(draws,21);XCTAssertEqual(host.sourceLiveStarHaloCount,2)
        XCTAssertTrue(start(false));XCTAssertEqual(draws,21)
        XCTAssertTrue(start(true));XCTAssertEqual(draws,42);XCTAssertEqual(service.sourceTickerListenerCount,1)
        host.dispose();XCTAssertEqual(service.sourceTickerListenerCount,0)
    }
    func testSourceStarLoaderRejectsForeignReactionFIFOWithoutAssetWork()throws {
        let first=NativeSourceMicrotaskFIFO(),second=NativeSourceMicrotaskFIFO()
        let tasks=NativeSourceMicrotaskAdapters(fifo:first)
        let foreign=try XCTUnwrap(second.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{true}))
        var uploads=0,callbacks=0
        let textures=NativeBoardTextures(root:root,selectedFinalePreload:{_,_ in uploads+=1})
        defer{textures.dispose();foreign.dispose();first.dispose();second.dispose()}
        textures.prepareSourceStarTexture(candidates:["assets/small-star@3x.png"],current:{true},assetTasks:tasks,reactionScope:foreign) {texture in callbacks+=1;XCTAssertNil(texture)}
        XCTAssertEqual(callbacks,1);XCTAssertEqual(uploads,0)
        XCTAssertNil(textures.sourceCachedTexture(candidates:["assets/small-star@3x.png"]))
    }
    func testSourceStarActualUploadCompletionUsesAPPFIFOReaction()async throws {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let scope=try XCTUnwrap(fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{true}))
        let completed=expectation(description:"actual resource APP reaction")
        var trace:[String]=[]
        let textures=NativeBoardTextures(root:root,selectedFinalePreload:{_,done in trace.append("upload");done()})
        defer{textures.dispose();scope.dispose();fifo.dispose()}
        tasks.inputTask {
            textures.prepareSourceStarTexture(candidates:["assets/small-star@3x.png"],current:{true},assetTasks:tasks,reactionScope:scope) {texture in
                XCTAssertNotNil(texture);XCTAssertTrue(fifo.isInsideCheckpoint);trace.append("then")
                XCTAssertTrue(scope.enqueue{trace.append("nested");completed.fulfill()})
            }
            trace.append("input-return")
        }
        await fulfillment(of:[completed],timeout:5)
        XCTAssertEqual(trace,["input-return","upload","then","nested"])
    }
    func testSourceStarAsyncLoaderAttemptsCandidatesAndRejectsRetiredUpload()async throws {
        let uploaded=expectation(description:"actual original texture decoded")
        var finishUpload:(@Sendable()->Void)?,uploadCount=0,callbacks=0
        let textures=NativeBoardTextures(root:root,selectedFinalePreload:{ _,done in
            uploadCount+=1;finishUpload=done;uploaded.fulfill()
        })
        defer{textures.dispose()}
        textures.prepareSourceStarTexture(candidates:["assets/source-star-test-missing.png","assets/small-star@3x.png"],current:{true}) {texture in
            callbacks+=1;XCTAssertNil(texture)
        }
        await fulfillment(of:[uploaded],timeout:5)
        XCTAssertEqual(uploadCount,1);XCTAssertEqual(callbacks,0)
        textures.invalidatePendingPreparation();XCTAssertEqual(callbacks,1)
        let stale=try XCTUnwrap(finishUpload);stale()
        let drained=expectation(description:"obsolete upload drained")
        DispatchQueue.main.async{drained.fulfill()};await fulfillment(of:[drained],timeout:5)
        XCTAssertEqual(callbacks,1);XCTAssertNil(textures.sourceCachedTexture(candidates:["assets/small-star@3x.png"]))
    }
    func testSourceStarLoaderCachedCandidateDoesNotUpload()throws {
        var uploads=0,callbacks=0
        let textures=NativeBoardTextures(root:root,selectedFinalePreload:{_,_ in uploads+=1})
        defer{textures.dispose()}
        let expected=try XCTUnwrap(textures.texture("assets/small-star@2x.png",densityAware:false))
        textures.prepareSourceStarTexture(candidates:["./assets/small-star@2x.png"],current:{true}) {texture in
            callbacks+=1;XCTAssertTrue(texture === expected)
        }
        XCTAssertEqual(callbacks,1);XCTAssertEqual(uploads,0)
    }
    func testSourceHaloFallbackUsesOriginalVectorShapeWithoutNewMath()throws {
        var draws=0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let ticker=NativeSourceStarHaloTicker(service:service,generation:1,current:{true},performanceNow:{0})
        let stars=try XCTUnwrap(NativeSourceStarHaloMotion.makeStars(count:2,textureWidth:56,introBounce:false,performanceNow:{0},random:{draws+=1;return 0.5}))
        let halo=try XCTUnwrap(NativeSourceStarHaloPresentation(stars:stars,texture:nil,introBounce:false,performanceMilliseconds:0,service:service,generation:1,current:{true},paintable:{true},metrics:{.init(width:128,height:128)}))
        let parent=SKNode();parent.addChild(halo);XCTAssertTrue(halo.start(ticker:ticker))
        defer{halo.dispose();ticker.dispose();service.dispose()}
        XCTAssertEqual(draws,20);XCTAssertEqual(halo.starCount,2)
        for child in halo.children {
            let shape=try XCTUnwrap(child as? SKShapeNode);XCTAssertEqual(shape.lineWidth,0)
            let path=try XCTUnwrap(shape.path);XCTAssertEqual(path.boundingBoxOfPath.maxY,28,accuracy:0.000001)
            XCTAssertEqual(path.boundingBoxOfPath.minX,-28*sin(Double.pi*2/5),accuracy:0.000001)
        }
        service.deliver(wallMilliseconds:16);XCTAssertEqual(draws,20)
    }
    func testSourceStarTextureCacheDoesNotDecodeAndRetainsCandidateOrder()throws {
        let textures=NativeBoardTextures(root:root)
        let high="assets/small-star@3x.png",low="assets/small-star@2x.png"
        XCTAssertNil(textures.sourceCachedTexture(candidates:[high,low]))
        let lowTexture=try XCTUnwrap(textures.texture(low,densityAware:false))
        XCTAssertTrue(textures.sourceCachedTexture(candidates:["./"+high,"./"+low]) === lowTexture)
        XCTAssertNil(textures.sourceCachedTexture(candidates:[high]))
        let highTexture=try XCTUnwrap(textures.texture(high,densityAware:false))
        XCTAssertTrue(textures.sourceCachedTexture(candidates:[high,low]) === highTexture)
        XCTAssertTrue(textures.sourceCachedTexture(candidates:[low,high]) === lowTexture)
        textures.dispose();XCTAssertNil(textures.sourceCachedTexture(candidates:[high,low]))
    }
    func testSourceHaloActualDiceIdentityGenerationAndDisposeRetireOwnedTicker()throws {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let ticker=NativeSourceStarHaloTicker(service:service,generation:1,current:{true},performanceNow:{0})
        let textures=NativeBoardTextures(root:root);let parent=SKNode()
        let host=NativeDiceNode(id:"owned-halo",value:6,kind:"wild",variant:nil,depth:1,locked:false,textures:textures)
        parent.addChild(host)
        let driver=NativeSourceOuterTimelineAdapter(service:service)
        host.installSourceOuterDriver(driver,generation:1,geometryScale:1)
        defer{host.dispose();ticker.dispose();service.dispose();textures.dispose()}
        let texture=try XCTUnwrap(textures.texture("assets/small-star@3x.png"))
        let stars=try XCTUnwrap(NativeSourceStarHaloMotion.makeStars(count:2,textureWidth:Double(texture.size().width),introBounce:false,performanceNow:{0},random:{0.5}))
        func make()->NativeSourceStarHaloPresentation {let halo=NativeSourceStarHaloPresentation(stars:stars,texture:texture,introBounce:false,performanceMilliseconds:0,service:service,generation:1,current:{true},paintable:{true},metrics:{.init(width:128,height:128)})!;host.addChild(halo);return halo}
        let first=make();XCTAssertTrue(host.adoptSourceStarHalo(first,generation:1,ticker:ticker));XCTAssertEqual(host.sourceLiveStarHaloCount,2)
        let duplicate=make();XCTAssertFalse(host.adoptSourceStarHalo(duplicate,generation:1,ticker:ticker));duplicate.dispose()
        XCTAssertEqual(service.sourceTickerListenerCount,1)
        first.dispose();XCTAssertEqual(host.sourceLiveStarHaloCount,0)
        let renewed=make();XCTAssertTrue(host.adoptSourceStarHalo(renewed,generation:1,ticker:ticker))
        host.update(value:6,kind:"wild",variant:nil,depth:2,locked:false)
        XCTAssertEqual(host.sourceLiveStarHaloCount,2)
        host.installSourceOuterDriver(driver,generation:2,geometryScale:1)
        XCTAssertEqual(host.sourceLiveStarHaloCount,0);XCTAssertNil(first.parent);XCTAssertNil(renewed.parent);XCTAssertEqual(service.sourceTickerListenerCount,0)
        let wrongGeneration=make();XCTAssertFalse(host.adoptSourceStarHalo(wrongGeneration,generation:2,ticker:ticker));wrongGeneration.dispose()
        host.installSourceOuterDriver(driver,generation:1,geometryScale:1)
        let next=make();XCTAssertTrue(host.adoptSourceStarHalo(next,generation:1,ticker:ticker))
        host.update(value:4,kind:"regular",variant:nil,depth:1,locked:false)
        XCTAssertNil(next.parent);XCTAssertEqual(service.sourceTickerListenerCount,0)
        host.update(value:6,kind:"wild",variant:nil,depth:1,locked:false)
        let last=make();XCTAssertTrue(host.adoptSourceStarHalo(last,generation:1,ticker:ticker));host.dispose()
        XCTAssertNil(last.parent);XCTAssertEqual(service.sourceTickerListenerCount,0)
    }
    func testSourceHaloActualSpriteKitBranchesShareOneAPPListenerAndDisposeExactly()throws {
        var wall=0.0,current=true
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall},sourceFrameTransportEnabled:true);service.sourceMicrotaskTasks=tasks
        let ticker=NativeSourceStarHaloTicker(service:service,generation:1,current:{current},performanceNow:{wall})
        defer{ticker.dispose();service.dispose();fifo.dispose()}
        let textures=NativeBoardTextures(root:root);defer{textures.dispose()}
        let texture=try XCTUnwrap(textures.texture("assets/small-star@3x.png"))
        let stars=try XCTUnwrap(NativeSourceStarHaloMotion.makeStars(count:2,textureWidth:Double(texture.size().width),introBounce:true,performanceNow:{0},random:{0.5}))
        let parent=SKNode()
        let first=try XCTUnwrap(NativeSourceStarHaloPresentation(stars:stars,texture:texture,introBounce:true,performanceMilliseconds:0,service:service,generation:1,current:{current},paintable:{true},metrics:{.init(width:128,height:128)}))
        let second=try XCTUnwrap(NativeSourceStarHaloPresentation(stars:stars,texture:texture,introBounce:true,performanceMilliseconds:0,service:service,generation:1,current:{current},paintable:{true},metrics:{.init(width:128,height:128)}))
        parent.addChild(first);parent.addChild(second);XCTAssertTrue(first.start(ticker:ticker));XCTAssertTrue(second.start(ticker:ticker))
        XCTAssertEqual(service.sourceTickerListenerCount,1);XCTAssertEqual(ticker.count,2)
        for value in stride(from:16.0,through:300,by:16){wall=value;service.deliver(wallMilliseconds:value)}
        let sprite=try XCTUnwrap(first.children.first as? SKSpriteNode)
        XCTAssertEqual(sprite.blendMode,.alpha)
        XCTAssertEqual(sprite.position.x,first.paintedPoses[0].x,accuracy:0.000001)
        XCTAssertEqual(sprite.position.y,-first.paintedPoses[0].y,accuracy:0.000001)
        XCTAssertEqual(sprite.zRotation,-first.paintedPoses[0].rotation,accuracy:0.000001)
        XCTAssertEqual(sprite.frame.width,texture.size().width*first.paintedPoses[0].scale*(abs(cos(sprite.zRotation))+abs(sin(sprite.zRotation))*texture.size().height/texture.size().width),accuracy:0.001)
        first.dispose();XCTAssertEqual(ticker.count,1);XCTAssertEqual(service.sourceTickerListenerCount,1);XCTAssertTrue(first.children.isEmpty)
        current=false;wall=320;service.deliver(wallMilliseconds:wall)
        XCTAssertNil(second.parent);XCTAssertTrue(second.children.isEmpty);XCTAssertEqual(service.sourceTickerListenerCount,0);XCTAssertEqual(service.activeParticipantCount,0)
    }
    func testSourceHaloGSAPPauseRetainsIntroScaleWhileActualOrbitTickerKeepsMoving()throws {
        var wall=0.0
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall},sourceFrameTransportEnabled:true);service.sourceMicrotaskTasks=tasks
        let ticker=NativeSourceStarHaloTicker(service:service,generation:1,current:{true},performanceNow:{wall})
        defer{ticker.dispose();service.dispose();fifo.dispose()}
        let textures=NativeBoardTextures(root:root);defer{textures.dispose()};let texture=try XCTUnwrap(textures.texture("assets/small-star@3x.png"))
        let stars=try XCTUnwrap(NativeSourceStarHaloMotion.makeStars(count:1,textureWidth:Double(texture.size().width),introBounce:true,performanceNow:{0},random:{0.5}))
        let parent=SKNode(),node=try XCTUnwrap(NativeSourceStarHaloPresentation(stars:stars,texture:texture,introBounce:true,performanceMilliseconds:0,service:service,generation:1,current:{true},paintable:{true},metrics:{.init(width:128,height:128)}))
        parent.addChild(node);XCTAssertTrue(node.start(ticker:ticker))
        for value in stride(from:16.0,through:96,by:16){wall=value;service.deliver(wallMilliseconds:value)}
        service.setSourceGlobalPaused(true);let pose=node.paintedPoses[0]
        for value in stride(from:112.0,through:304,by:16){wall=value;service.deliver(wallMilliseconds:value)}
        XCTAssertEqual(node.paintedPoses[0].scale,pose.scale,accuracy:0.000001)
        XCTAssertNotEqual(node.paintedPoses[0].x,pose.x)
        service.setSourceGlobalPaused(false)
        for value in stride(from:320.0,through:1008,by:16){wall=value;service.deliver(wallMilliseconds:value)}
        XCTAssertNotEqual(node.paintedPoses[0].scale,pose.scale)
    }

    private final class HaloRenderScene:SKScene {var painted:(()->Void)?;override func didFinishUpdate(){painted?()}}
    func testSourceHaloPaintsOriginalTextureOnActualVisibleSpriteKitSurface()async throws {
        var wall=0.0,current=true
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall},sourceFrameTransportEnabled:true);service.sourceMicrotaskTasks=tasks
        let ticker=NativeSourceStarHaloTicker(service:service,generation:1,current:{current},performanceNow:{wall})
        let textures=NativeBoardTextures(root:root)
        let texture=try XCTUnwrap(textures.texture("assets/small-star@3x.png"))
        let stars=try XCTUnwrap(NativeSourceStarHaloMotion.makeStars(count:3,textureWidth:Double(texture.size().width),introBounce:true,performanceNow:{0},random:{0.5}))
        let scene=HaloRenderScene(size:.init(width:390,height:844)),view=SKView(frame:.init(x:0,y:0,width:390,height:844)),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        let vc=UIViewController();vc.view=view;window.rootViewController=vc;window.makeKeyAndVisible()
        scene.backgroundColor=UIColor(red:1,green:247/255,blue:239/255,alpha:1)
        let host=NativeDiceNode(id:"halo-host",value:6,kind:"wild",variant:nil,depth:1,locked:false,textures:textures)
        host.position = .init(x:195,y:422);host.setScale(60.8/128);scene.addChild(host)
        let node=try XCTUnwrap(NativeSourceStarHaloPresentation(stars:stars,texture:texture,introBounce:true,performanceMilliseconds:0,service:service,generation:1,current:{current},paintable:{true},metrics:{.init(width:128,height:128)}))
        host.addChild(node);XCTAssertTrue(node.start(ticker:ticker));view.presentScene(scene)
        defer{current=false;scene.painted=nil;ticker.dispose();service.dispose();fifo.dispose();node.dispose();host.dispose();textures.dispose();view.presentScene(nil);window.isHidden=true;window.rootViewController=nil}
        for value in stride(from:16.0,through:1616,by:16){wall=value;service.deliver(wallMilliseconds:value)}
        let painted=expectation(description:"actual SpriteKit completed update")
        scene.painted={scene.painted=nil;painted.fulfill()};await fulfillment(of:[painted],timeout:5)
        XCTAssertEqual(node.starCount,3);XCTAssertTrue(node.paintedPoses.allSatisfy{$0.alpha==1})
        let raster=try XCTUnwrap(view.texture(from:scene)),image=UIImage(cgImage:raster.cgImage())
        let attachment=XCTAttachment(image:image);attachment.name="SourceStarHaloMounted390";attachment.lifetime = .keepAlways;add(attachment)
        XCTAssertGreaterThan(image.size.width,300);XCTAssertGreaterThan(image.size.height,700)
    }

    func testFourthWildFacePreservesObjectAndCorrectsScaledTextureDimensions()throws {
        let textures=NativeBoardTextures(root:root)
        let texture=try XCTUnwrap(textures.texture("assets/wild.png",densityAware:false))
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        let driver=NativeSourceOuterTimelineAdapter(service:service)
        let parent=SKNode(),host=NativeDiceNode(id:"fourth-face",value:6,kind:"wild",variant:nil,depth:3,locked:false,textures:textures)
        parent.addChild(host);host.installSourceOuterDriver(driver,generation:1,geometryScale:1)
        defer{host.dispose();driver.dispose();service.dispose();textures.dispose()}
        let face=try XCTUnwrap(host.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === texture})
        face.setScale(7)
        XCTAssertFalse(host.paintSourceTutorialWildFace(generation:2,current:{true}));XCTAssertEqual(face.xScale,7)
        XCTAssertTrue(host.commitSourceTutorialWildFields(generation:1))
        XCTAssertTrue(host.paintSourceTutorialWildFace(generation:1,current:{true}))
        XCTAssertTrue(face.parent === host.sourceStarOrbitHost);XCTAssertTrue(face.texture === texture)
        XCTAssertEqual(host.sourceStarOrbitMetrics.width,128,accuracy:0.001)
        XCTAssertEqual(host.sourceStarOrbitMetrics.height,128,accuracy:0.001)
        XCTAssertTrue(host.paintSourceTutorialWildFace(generation:1,current:{true}))
        XCTAssertEqual(host.sourceStarOrbitMetrics.width,128,accuracy:0.001)
        XCTAssertFalse(host.paintSourceTutorialWildFace(generation:1,current:{host.dispose();return true}))
    }
    func testSourceStarSheetPairKeepsOriginalPhaseClampVisibilityAndIndependentRetirement()throws {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let textures=NativeBoardTextures(root:root),scene=SKScene(size:.init(width:390,height:844)),layer=SKNode()
        scene.addChild(layer)
        XCTAssertNotNil(textures.texture(NativeDiceSheet.star.path,densityAware:false))
        let hostA=SKNode(),hostB=SKNode(),baseA=SKSpriteNode(color:.white,size:.init(width:128,height:128)),baseB=SKSpriteNode(color:.white,size:.init(width:128,height:128))
        scene.addChild(hostA);scene.addChild(hostB);hostA.addChild(baseA);hostB.addChild(baseB)
        var now=0.0,visible=true,currentA=true
        let a=try XCTUnwrap(NativeSourceStarSheetPresentation(textures:textures,host:hostA,base:baseA,layer:layer,
            current:{currentA},paintable:{visible},ownsBase:{true},dateNow:{now}))
        let b=try XCTUnwrap(NativeSourceStarSheetPresentation(textures:textures,host:hostB,base:baseB,layer:layer,
            current:{true},paintable:{true},ownsBase:{true},dateNow:{now}))
        defer{a.dispose();b.dispose();textures.dispose();fifo.dispose()}
        tasks.inputTask{XCTAssertTrue(a.start(tasks:tasks));XCTAssertTrue(b.start(tasks:tasks))}
        XCTAssertFalse(a.running);XCTAssertTrue(b.running,"Original frame-cache B receipt gets the first phase")
        now=170;a.tick(deltaMilliseconds:0)
        XCTAssertTrue(a.running);XCTAssertEqual(a.elapsedMilliseconds,0)
        a.tick(deltaMilliseconds:250);XCTAssertEqual(a.elapsedMilliseconds,100)
        XCTAssertEqual(a.frameIndex,6)
        let sprite=try XCTUnwrap(a.sprite),first=sprite.texture
        visible=false;a.tick(deltaMilliseconds:55)
        XCTAssertEqual(a.elapsedMilliseconds,100);XCTAssertTrue(sprite.isHidden);XCTAssertFalse(baseA.isHidden)
        visible=true;hostA.position = .init(x:27,y:43);hostA.setScale(1.08);a.pointerStateChanged()
        XCTAssertFalse(sprite.isHidden);XCTAssertTrue(sprite.texture === first);XCTAssertTrue(baseA.isHidden)
        let actual=sprite.convert(CGPoint.zero,to:scene),expected=hostA.convert(CGPoint.zero,to:scene)
        XCTAssertEqual(actual.x,expected.x,accuracy:0.001);XCTAssertEqual(actual.y,expected.y,accuracy:0.001)
        a.tick(deltaMilliseconds:33);XCTAssertEqual(a.elapsedMilliseconds,133)
        currentA=false;a.tick(deltaMilliseconds:16)
        XCTAssertTrue(a.disposed);XCTAssertNil(a.sprite);XCTAssertNil(sprite.parent);XCTAssertFalse(baseA.isHidden)
        b.tick(deltaMilliseconds:20);XCTAssertEqual(b.elapsedMilliseconds,20);XCTAssertNotNil(b.sprite?.parent)
        a.dispose();b.dispose();XCTAssertFalse(baseB.isHidden);XCTAssertTrue(layer.children.isEmpty)
    }

    func testSourceStarSharedSheetRetainedAtlasMatchesOriginalReactionOrderAcrossGeneration()throws {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let scope=try XCTUnwrap(fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{true}))
        let textures=NativeBoardTextures(root:root)
        defer{textures.dispose();scope.dispose();fifo.dispose()}
        XCTAssertNotNil(textures.texture(NativeDiceSheet.star.path,densityAware:false))
        var trace:[String]=[],first:[SKTexture]=[],second:[SKTexture]=[]
        tasks.inputTask {
            XCTAssertTrue(textures.prepareSourceSharedSheet(.star,tasks:tasks,scope:scope,current:{true}) {frames in
                XCTAssertTrue(fifo.isInsideCheckpoint);first=frames ?? [];trace.append("A")
            })
            XCTAssertTrue(textures.prepareSourceSharedSheet(.star,tasks:tasks,scope:scope,current:{true}) {frames in
                second=frames ?? [];trace.append("B")
            })
            XCTAssertTrue(trace.isEmpty)
        }
        XCTAssertEqual(trace,["B","A"],"Original cached atlas creates frames before the adopted mount reaction")
        XCTAssertEqual(first.count,120);XCTAssertEqual(second.count,120)
        XCTAssertTrue(zip(first,second).allSatisfy{$0 === $1})
        textures.invalidatePendingPreparation();trace=[]
        tasks.inputTask {
            for id in ["A","B"] {
                XCTAssertTrue(textures.prepareSourceSharedSheet(.star,tasks:tasks,scope:scope,current:{true}) {frames in
                    XCTAssertTrue(frames?.first === first.first);trace.append(id)
                })
            }
        }
        XCTAssertEqual(trace,["A","B"],"Retained frame cache stays a direct hit after provider-generation renewal")
    }

    func testSourceStarSharedSheetColdConsumersShareOriginalFramesAndKeepCallerOrder()async throws {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let scope=try XCTUnwrap(fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{true}))
        var uploads=0,trace:[String]=[],results:[[SKTexture]]=[]
        let textures=NativeBoardTextures(root:root,selectedFinalePreload:{_,complete in uploads+=1;complete()})
        let done=expectation(description:"cold original shared sheet consumers");done.expectedFulfillmentCount=2
        defer{textures.dispose();scope.dispose();fifo.dispose()}
        tasks.inputTask {
            for id in ["A","B"] {
                XCTAssertTrue(textures.prepareSourceSharedSheet(.star,tasks:tasks,scope:scope,current:{true}) {frames in
                    XCTAssertTrue(fifo.isInsideCheckpoint);results.append(frames ?? []);trace.append(id);done.fulfill()
                })
            }
            XCTAssertTrue(trace.isEmpty)
        }
        await fulfillment(of:[done],timeout:5)
        XCTAssertEqual(uploads,1);XCTAssertEqual(trace,["A","B"])
        XCTAssertEqual(results.count,2)
        guard results.count==2 else{return}
        XCTAssertEqual(results[0].count,120)
        XCTAssertTrue(zip(results[0],results[1]).allSatisfy{$0 === $1})
    }

    func testSourceSpecialTextureRealUploadPublishesExactHandleOnlyThroughAPPFIFO()async throws {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let scope=try XCTUnwrap(fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{true}))
        let textures=NativeBoardTextures(root:root),other=NativeBoardTextures(root:root),done=expectation(description:"actual special upload reaction")
        var trace:[String]=[],handle:NativeBoardTextures.SourceTextureHandle?
        defer{textures.dispose();other.dispose();scope.dispose();fifo.dispose()}
        tasks.inputTask {
            XCTAssertTrue(textures.prepareSourceSpecialTexture(assetPath:"./assets/wild.png",assetTasks:tasks,reactionScope:scope,current:{true}) {value in
                XCTAssertTrue(fifo.isInsideCheckpoint);handle=value;trace.append("handle");done.fulfill()
            })
            trace.append("input-return");XCTAssertTrue(scope.enqueue{trace.append("prior")})
        }
        await fulfillment(of:[done],timeout:5)
        let value=try XCTUnwrap(handle);XCTAssertEqual(value.assetPath,"assets/wild.png")
        XCTAssertTrue(textures.isSourceTextureHandleCurrent(value));XCTAssertFalse(other.isSourceTextureHandleCurrent(value))
        XCTAssertTrue(value.texture === textures.sourceCachedTexture(candidates:["assets/wild.png"]))
        XCTAssertEqual(trace,["input-return","prior","handle"])
        textures.invalidatePendingPreparation();XCTAssertFalse(textures.isSourceTextureHandleCurrent(value))
    }
    func testSourceSpecialCachedTextureStillNeedsSharedUploadReceiptAndDeduplicatesConsumers()async throws {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let scope=try XCTUnwrap(fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{true}))
        var finish:(@Sendable()->Void)?,uploads=0,callbacks=0
        let done=expectation(description:"both uploaded consumers");done.expectedFulfillmentCount=2
        let textures=NativeBoardTextures(root:root,selectedFinalePreload:{_,callback in uploads+=1;finish=callback})
        let original=try XCTUnwrap(textures.texture("assets/wild.png",densityAware:false))
        defer{textures.dispose();scope.dispose();fifo.dispose()}
        for path in ["./assets/wild.png","assets/wild.png"] {
            XCTAssertTrue(textures.prepareSourceSpecialTexture(assetPath:path,assetTasks:tasks,reactionScope:scope,current:{true}) {handle in
                XCTAssertTrue(fifo.isInsideCheckpoint);XCTAssertTrue(handle?.texture === original)
                if let handle {XCTAssertTrue(textures.isSourceTextureHandleCurrent(handle))}
                callbacks+=1;done.fulfill()
            })
        }
        XCTAssertEqual(uploads,1);XCTAssertEqual(callbacks,0)
        let complete=try XCTUnwrap(finish);complete();await fulfillment(of:[done],timeout:5)
        XCTAssertEqual(callbacks,2)
    }
    func testSourceSpecialInvalidatedUploadCannotStealOrPublishNewProviderGeneration()async throws {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let scope=try XCTUnwrap(fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{true}))
        var finishes:[@Sendable()->Void]=[],oldCallbacks=0,newCallbacks=0
        let done=expectation(description:"new generation receipt")
        let textures=NativeBoardTextures(root:root,selectedFinalePreload:{_,callback in finishes.append(callback)})
        _=try XCTUnwrap(textures.texture("assets/wild.png",densityAware:false))
        defer{textures.dispose();scope.dispose();fifo.dispose()}
        XCTAssertTrue(textures.prepareSourceSpecialTexture(assetPath:"assets/wild.png",assetTasks:tasks,reactionScope:scope,current:{true}) {handle in
            XCTAssertTrue(fifo.isInsideCheckpoint);XCTAssertNil(handle);oldCallbacks+=1
        })
        textures.invalidatePendingPreparation();XCTAssertEqual(oldCallbacks,1)
        XCTAssertTrue(textures.prepareSourceSpecialTexture(assetPath:"assets/wild.png",assetTasks:tasks,reactionScope:scope,current:{true}) {handle in
            XCTAssertTrue(fifo.isInsideCheckpoint);if let handle {XCTAssertTrue(textures.isSourceTextureHandleCurrent(handle))}else{XCTFail("new upload missing")}
            newCallbacks+=1;done.fulfill()
        })
        XCTAssertEqual(finishes.count,2);finishes[0]();finishes[1]()
        await fulfillment(of:[done],timeout:5);XCTAssertEqual(oldCallbacks,1);XCTAssertEqual(newCallbacks,1)
    }
    func testSourceSpecialForeignFIFOAndReentrantProviderDisposeRefuseBeforeAssetWork()throws {
        let first=NativeSourceMicrotaskFIFO(),second=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:first)
        let foreign=try XCTUnwrap(second.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{true}))
        let bound=try XCTUnwrap(first.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{true}))
        var uploads=0,callbacks=0
        let textures=NativeBoardTextures(root:root,selectedFinalePreload:{_,_ in uploads+=1})
        defer{textures.dispose();foreign.dispose();bound.dispose();first.dispose();second.dispose()}
        XCTAssertFalse(textures.prepareSourceSpecialTexture(assetPath:"assets/wild.png",assetTasks:tasks,reactionScope:foreign,current:{true}) {_ in callbacks+=1})
        XCTAssertFalse(textures.prepareSourceSpecialTexture(assetPath:"assets/wild.png",assetTasks:tasks,reactionScope:bound,current:{textures.dispose();return true}) {_ in callbacks+=1})
        XCTAssertEqual(uploads,0);XCTAssertEqual(callbacks,0)
    }
    func testSourceSpecialReactionCurrentRetiringScopeCannotPublishHandleOrFailure()async throws {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let scope=try XCTUnwrap(fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{true}))
        let retired=expectation(description:"current guard retires reaction Scope")
        var calls=0,callbacks=0
        let textures=NativeBoardTextures(root:root)
        defer{textures.dispose();scope.dispose();fifo.dispose()}
        XCTAssertTrue(textures.prepareSourceSpecialTexture(assetPath:"assets/wild.png",assetTasks:tasks,reactionScope:scope,current:{
            calls+=1;if calls==2 {scope.dispose();retired.fulfill()};return true
        }) {_ in callbacks+=1})
        await fulfillment(of:[retired],timeout:5);XCTAssertEqual(calls,2);XCTAssertEqual(callbacks,0)
    }

    func testSourceSpecialLogicallyRetiredBoundScopeRejectsWithoutUploadOrDecode()throws {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        var current=true,uploads=0,callbacks=0
        let scope=try XCTUnwrap(fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{current}))
        let textures=NativeBoardTextures(root:root,selectedFinalePreload:{_,_ in uploads+=1})
        defer{textures.dispose();scope.dispose();fifo.dispose()}
        _=try XCTUnwrap(textures.texture("assets/wild.png",densityAware:false))
        current=false;XCTAssertTrue(scope.isBound(to:fifo));XCTAssertFalse(scope.admissionOpen)
        XCTAssertFalse(textures.prepareSourceSpecialTexture(assetPath:"assets/wild.png",assetTasks:tasks,reactionScope:scope,current:{true}) {_ in callbacks+=1})
        XCTAssertEqual(uploads,0);XCTAssertEqual(callbacks,0)
    }

    @MainActor private final class SourceWildSkinFixture {
        let fifo=NativeSourceMicrotaskFIFO(),service:NativeSourceAnimationClockService,context:NativeGameplaySourceContext,scope:NativeGameplaySourceContext.Scope,scene:NativeBoardScene,node:NativeDiceNode,view:SKView
        init(root:URL,archetype:NativeWildArchetype = .magnet,variant:String?=nil,deferred:Bool=true,visualRandom:@escaping()->Double={0.5},additionalTile:NativeTile?=nil)throws {
            let tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
            service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
            service.sourceMicrotaskTasks=tasks
            context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:visualRandom,sourceMicrotaskTasks:tasks)
            let engine=NativeGameplayEngine(state:.init(tiles:[.init(id:"skin",cell:.init(column:0,row:0),value:6,archetype:archetype,variant:variant),.init(id:"other",cell:.init(column:4,row:8),value:2)]+(additionalTile.map{[$0]} ?? [])))
            scene=NativeBoardScene(engine:engine,resourceRoot:root,size:.init(width:390,height:844))
            let captured=scene;scope=try XCTUnwrap(context.beginScene(engine:engine,retire:{[weak captured] in captured?.retireSourceAnimationBindings()}))
            scene.sourceOuterTimelineDriver=scope.timeline;scene.sourceDragTweenDriver=scope.tween
            XCTAssertTrue(scene.configureSourceMicrotaskBoundaries(scope:scope,fifo:fifo))
            scene.layout(size:scene.size,insets:.init(top:47,left:0,bottom:34,right:0),animateEntry:false)
            node=try XCTUnwrap(scene.sourceNativeTileNode("skin"));node.setSourceIdleDeferred(deferred)
            view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.presentScene(scene)
        }
        func dispose(){scene.dispose();context.dispose();service.dispose();view.presentScene(nil);fifo.dispose()}
    }
    private struct SourceFizzPrefixProbe:Decodable {
        struct Bubble:Decodable {let x,y,scaleX,scaleY,alpha:Double}
        struct Frame:Decodable {let draws:Int,bubbles:[Bubble]}
        let family:String,seed:UInt32,frames:[Frame]
    }
    func testDeferredDynamicSkinCompletionReadsLiveAnchorAfterEntryOrLandingRelease()async throws {
        for (core,variant) in [(NativeWildArchetype.magnet,"bottle"),(.star,"kanta")] {
            let f=try SourceWildSkinFixture(root:root,archetype:core,variant:variant)
            defer{f.dispose()}
            // Keep the actual asynchronous texture transport live, but prevent
            // unrelated Raw SKView ticks from changing Bottle's pivot afterwards.
            f.view.isPaused=true
            var failures:[String]=[],idleStarts=0
            f.scene.onSourcePresentationFailure={reason,_ in failures.append(reason)}
            let ready=expectation(description:"deferred \(variant) skin finishes after release")
            var delivered=false
            f.node.onResourceReady={if f.node.sourceWildSkinReceiptCurrent,!delivered {delivered=true;ready.fulfill()}}
            XCTAssertTrue(f.node.sourceIdleDeferred)
            XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{idleStarts+=1;return true}))
            XCTAssertFalse(delivered,"The real texture upload is still pending")
            f.node.setSourceIdleDeferred(false)
            let texture=try XCTUnwrap(f.node.sourcePaintedNumbersTexture)
            let artwork=try XCTUnwrap(f.node.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === texture})
            XCTAssertEqual(artwork.anchorPoint,CGPoint(x:f.node.sourceBaseAnchorX,y:1-f.node.sourceBaseAnchorY))
            artwork.anchorPoint=CGPoint(x:0.43,y:0.19)
            XCTAssertEqual(f.node.sourceBaseAnchorX,Double(artwork.anchorPoint.x),accuracy:1e-6)
            XCTAssertEqual(1-f.node.sourceBaseAnchorY,Double(artwork.anchorPoint.y),accuracy:1e-6)
            let currentAnchor=artwork.anchorPoint,state=f.scene.engine.state
            await fulfillment(of:[ready],timeout:5)
            XCTAssertTrue(failures.isEmpty,"A deferred request remains valid after its idle handoff: \(failures)")
            XCTAssertEqual(artwork.anchorPoint,currentAnchor,"Async paint reads the actual live anchor, not the authored/request-time default")
            XCTAssertEqual(idleStarts,0,"Late skin receipt must not replay the idle prefix")
            XCTAssertEqual(f.scene.engine.state,state)
            XCTAssertTrue(f.node.sourceWildSkinReceiptCurrent)
        }
    }
    func testSpawnSafetySkinPaintBorrowsCurrentReceiptWithoutRestartingIdleOrDrawingRandom()async throws {
        for (archetype,variant) in NativeSpecialDiceRegistry.variants.values.sorted(by:{$0.id<$1.id}).map({($0.archetype,$0.id)}) {
            var draws=0
            let f=try SourceWildSkinFixture(root:root,archetype:archetype,variant:variant,visualRandom:{draws+=1;return 0.5})
            defer{f.dispose()}
            XCTAssertFalse(f.node.repairSourceWildSkinPaint(generation:f.node.sourceGeneration,current:{f.scope.current}),"A Raw texture is not an admitted Source skin")
            let ready=expectation(description:"actual admitted \(variant) skin"),nativeReady=f.node.onResourceReady
            var finished=false
            f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,!finished {finished=true;ready.fulfill()}}
            XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{XCTFail("deferred constructor cannot start idle");return false}))
            await fulfillment(of:[ready],timeout:5)
            f.node.setSourceIdleDeferred(false)
            func admittedFace(_ root:SKNode)->SKSpriteNode? {
                if let sprite=root as? SKSpriteNode,sprite.texture === f.node.sourcePaintedNumbersTexture{return sprite}
                return root.children.lazy.compactMap{admittedFace($0)}.first
            }
            let face=try XCTUnwrap(admittedFace(f.node),"The actual \(variant) face may be nested in its authored host")
            if variant=="kanta" || variant=="bottle" {face.anchorPoint=CGPoint(x:0.5,y:0.125)}
            let anchor=face.anchorPoint,size=face.size,texture=face.texture,idles=f.node.sourceIdleOwnerCount,initialDraws=draws
            face.xScale = -0.7;face.yScale = -1.3
            face.alpha=0.2
            XCTAssertFalse(f.node.repairSourceWildSkinPaint(generation:f.node.sourceGeneration,current:{false}))
            XCTAssertEqual(face.alpha,0.2,accuracy:0.001)
            face.texture=nil // Repair paint may differ from the retained admitted asset receipt.
            for _ in 0..<3 {XCTAssertTrue(f.node.repairSourceWildSkinPaint(generation:f.node.sourceGeneration,current:{f.scope.current}))}
            XCTAssertEqual(face.alpha,1);XCTAssertEqual(face.anchorPoint,anchor)
            XCTAssertEqual(face.xScale,-1);XCTAssertEqual(face.yScale,-1)
            XCTAssertEqual(face.frame.width,size.width,accuracy:0.001);XCTAssertEqual(face.frame.height,size.height,accuracy:0.001)
            XCTAssertTrue(face.texture === texture)
            XCTAssertEqual(f.node.sourceIdleOwnerCount,idles);XCTAssertEqual(draws,initialDraws)
            XCTAssertFalse(f.node.repairSourceWildSkinPaint(generation:f.node.sourceGeneration+1,current:{true}))
            f.scope.dispose()
            XCTAssertFalse(f.node.repairSourceWildSkinPaint(generation:f.node.sourceGeneration,current:{f.scope.current}))
        }
    }
    func testActualSceneSkinBorrowsCommonRNGForShimmerThenOriginalFizzBeforeVariantAndRetiresRejectedCue()async throws {
        let original=try XCTUnwrap(JSONDecoder().decode([SourceFizzPrefixProbe].self,from:Data(NativeIdleBubbleSourceOracle.json.utf8)).first{$0.family=="bottle" && $0.seed==1})
        let first=try XCTUnwrap(original.frames.first),paint=try XCTUnwrap(first.bubbles.first)
        var draws=0,rng=original.seed
        let f=try SourceWildSkinFixture(root:root,variant:"bottle",visualRandom:{
            defer{draws+=1};if draws==0 {return 0.5}
            rng=rng &* 1664525 &+ 1013904223;return Double(rng)/4294967296
        });defer{f.dispose()}
        XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:f.scope))
        let ready=expectation(description:"deferred typed skin before actual cue prefix"),nativeReady=f.node.onResourceReady;var finished=false
        f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,!finished {finished=true;ready.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{XCTFail("still deferred");return false}))
        await fulfillment(of:[ready],timeout:5)
        XCTAssertEqual(draws,0)
        f.scene.sourceWildShimmerEnabled=true;f.node.setSourceIdleDeferred(false)
        XCTAssertEqual(draws,0,"Raw rebuild cannot speculatively consume the APP stream")
        var variants=0
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{
            variants+=1;XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,1,"Actual RAF is queued before variant endpoint");XCTAssertEqual(draws,1+first.draws,"Actual shimmer then original bubble budget precede variant motion")
            return true // Bounded variant endpoint, not complete product-family admission.
        },currentSourceFaceAnchor:{CGPoint(x:f.node.sourceBaseAnchorX,y:1-f.node.sourceBaseAnchorY)}))
        XCTAssertEqual(variants,1)
        let field=try XCTUnwrap(f.node.visual.children.compactMap{$0 as? NativeIdleBubbleField}.first)
        let actual=try XCTUnwrap(field.fishBubbleSnapshots.first)
        XCTAssertEqual(actual.point.x,paint.x,accuracy:0.000003);XCTAssertEqual(actual.point.y,paint.y,accuracy:0.000003)
        XCTAssertEqual(actual.scale.x,paint.scaleX,accuracy:0.000003);XCTAssertEqual(actual.scale.y,paint.scaleY,accuracy:0.000003)
        XCTAssertEqual(actual.alpha,paint.alpha,accuracy:0.000003)
        let held=draws
        XCTAssertFalse(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{false},currentSourceFaceAnchor:{CGPoint(x:f.node.sourceBaseAnchorX,y:1-f.node.sourceBaseAnchorY)}))
        XCTAssertEqual(draws,held+1+first.draws,"Rejected variant follows the same original cue order")
        XCTAssertEqual(f.node.sourceWildShimmerRootCount,0)
        XCTAssertFalse(f.node.visual.children.contains{$0 is NativeIdleBubbleField},"Rejected prefix retires only its new cue")
        let retired=draws;field.tick(2);XCTAssertEqual(draws,retired)
    }
    func testActualSourceFizzStartsWhileVariantPendingAndContinuesThroughRegistrySuspensionUntilScopeRetires()async throws {
        var draws=0
        let f=try SourceWildSkinFixture(root:root,variant:"bottle",visualRandom:{draws+=1;return 0.5});defer{f.dispose()}
        XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:f.scope))
        let ready=expectation(description:"typed deferred bottle before pending variant"),nativeReady=f.node.onResourceReady;var finished=false
        f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,!finished {finished=true;ready.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{false}))
        await fulfillment(of:[ready],timeout:5)
        f.view.isPaused=true
        let release=try XCTUnwrap(f.scope.specialIdle.acquire(reason:"captured-variant-pending"))
        f.node.setSourceIdleDeferred(false)
        XCTAssertEqual(f.scope.specialIdle.snapshot.pending,1);XCTAssertEqual(draws,0)
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{true},currentSourceFaceAnchor:{CGPoint(x:f.node.sourceBaseAnchorX,y:1-f.node.sourceBaseAnchorY)}))
        var field=try XCTUnwrap(f.node.visual.children.compactMap{$0 as? NativeIdleBubbleField}.first)
        XCTAssertEqual(draws,12)
        f.scene.update(0);f.scene.update(0.5)
        XCTAssertEqual(draws,12,"Scene samples cannot advance Source animation/RNG")
        f.service.deliver(wallMilliseconds:500)
        XCTAssertEqual(draws,36,"Late ticker producer precedes actual automatic Magnet RAF restart")
        field=try XCTUnwrap(f.node.visual.children.compactMap{$0 as? NativeIdleBubbleField}.first)
        let held=draws;f.node.tickSourceIdleBubbles(1,suspended:true);XCTAssertEqual(draws,held)
        release();XCTAssertEqual(f.scope.specialIdle.snapshot.running,1)
        XCTAssertTrue(f.node.visual.children.contains{$0 === field});XCTAssertEqual(draws,held,"Variant release cannot restart the live FX cue")
        _=try XCTUnwrap(f.context.beginScene(retire:{}))
        field.tick(1);f.node.tickSourceIdleBubbles(1,suspended:false)
        XCTAssertEqual(draws,held,"Destructive captured Scope retirement seals its exact FX owner")
        XCTAssertFalse(f.node.visual.children.contains{$0 === field})
    }
    func testActualSourceFizzRejectsNewCoreGenerationBeforeSceneSynchronizesWithoutAnotherDraw()async throws {
        var draws=0
        let f=try SourceWildSkinFixture(root:root,variant:"bottle",visualRandom:{draws+=1;return 0.5});defer{f.dispose()}
        XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:f.scope))
        let ready=expectation(description:"typed original generation before new Core state"),nativeReady=f.node.onResourceReady;var finished=false
        f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,!finished {finished=true;ready.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{false}))
        await fulfillment(of:[ready],timeout:5)
        f.view.isPaused=true;f.node.setSourceIdleDeferred(false)
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{true},currentSourceFaceAnchor:{CGPoint(x:f.node.sourceBaseAnchorX,y:1-f.node.sourceBaseAnchorY)}))
        let field=try XCTUnwrap(f.node.visual.children.compactMap{$0 as? NativeIdleBubbleField}.first)
        XCTAssertEqual(draws,12);XCTAssertTrue(f.scope.current)
        var next=f.scene.engine.state;next.generation=2;f.scene.engine.restart(state:next)
        XCTAssertTrue(f.scope.current,"Context scope alone is insufficient to prove the old Core generation")
        f.service.deliver(wallMilliseconds:500)
        XCTAssertEqual(draws,12,"Canonical root rejects stale Core generation before Scene synchronization")
        f.node.tickSourceIdleBubbles(0.5,suspended:false)
        XCTAssertEqual(draws,12,"Actual captured model getter refuses before any new-generation draw")
        XCTAssertFalse(f.node.visual.children.contains{$0 === field})
        field.tick(0.5);XCTAssertEqual(draws,12)
    }
    func testActualSceneWildMagnetSkinInstallsExpandedInputBeforeTextureAndPreservesCore()async throws {
        let f=try SourceWildSkinFixture(root:root);defer{f.dispose()}
        let geometry=try XCTUnwrap(f.scene.boardGeometry),center=geometry.center(row:0,column:0)
        let point=CGPoint(x:center.x+geometry.tileSize*0.535,y:center.y),before=f.scene.engine.state
        XCTAssertNil(geometry.cell(at:point));XCTAssertFalse(f.scene.beginDrag(at:point))
        let done=expectation(description:"actual Scene skin texture ready"),nativeReady=f.node.onResourceReady
        var ready=0
        f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,ready==0 {ready+=1;done.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{XCTFail("real deferred flag skips idle");return false}))
        XCTAssertTrue(f.node.hasSourceSkinHitArea);XCTAssertFalse(f.node.sourceWildSkinReceiptCurrent)
        XCTAssertTrue(f.scene.beginDrag(at:point));f.scene.cancelDrag()
        await fulfillment(of:[done],timeout:5)
        XCTAssertEqual(f.node.sourceWildSkinAssetPath,"assets/wild-magnet.png")
        XCTAssertEqual(f.node.sourceStarOrbitMetrics.width,122.88,accuracy:0.001)
        XCTAssertEqual(f.scene.engine.state,before);XCTAssertFalse(f.node.sourcePhysicalMarkersCovered,"skin does not invent constructor marker admission")
    }
    func testActualSceneRepeatedWildSkinReceiptsCannotInflateFaceOrStartDeferredIdle()async throws {
        let f=try SourceWildSkinFixture(root:root);defer{f.dispose()}
        let done=expectation(description:"two actual skin reactions");done.expectedFulfillmentCount=2
        let nativeReady=f.node.onResourceReady;var ready=0
        f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,ready<2 {ready+=1;done.fulfill()}}
        for _ in 0..<2 {XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{XCTFail("deferred idle");return false}))}
        await fulfillment(of:[done],timeout:5);XCTAssertEqual(ready,2)
        XCTAssertEqual(f.node.sourceStarOrbitMetrics.width,122.88,accuracy:0.001)
        XCTAssertEqual(f.node.sourceStarOrbitMetrics.height,122.88,accuracy:0.001)
    }
    func testActualSceneLaserSkinUsesExactMobileRegistryTextureWithoutEnlargingInput()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.tnt,variant:"laser-gun");defer{f.dispose()}
        let done=expectation(description:"Source mobile Laser asset"),nativeReady=f.node.onResourceReady;var ready=false
        f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,!ready {ready=true;done.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{XCTFail("deferred idle");return false}))
        let geometry=try XCTUnwrap(f.scene.boardGeometry),center=geometry.center(row:0,column:0)
        XCTAssertFalse(f.scene.beginDrag(at:.init(x:center.x+geometry.tileSize*0.60,y:center.y)))
        await fulfillment(of:[done],timeout:5)
        XCTAssertEqual(f.node.sourceWildSkinAssetPath,"assets/shop/gun/right gun@2x.png")
        XCTAssertTrue(f.node.resourcePaths.contains("assets/shop/gun/right gun@2x.png"),"Source mobile receipt survives normal resource trim")
        XCTAssertEqual(f.node.sourceStarOrbitMetrics.width,184.32,accuracy:0.001)
    }
    func testActualSceneWildSkinRetiredScopeCannotPublishLateTextureOrHitOwner()async throws {
        let f=try SourceWildSkinFixture(root:root);defer{f.dispose()}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{XCTFail("deferred idle");return false}))
        _=try XCTUnwrap(f.context.beginScene(retire:{}));XCTAssertFalse(f.scope.current)
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertFalse(f.node.hasSourceSkinHitArea);XCTAssertFalse(f.node.sourceWildSkinReceiptCurrent)
    }
    func testActualSceneActiveWildSkinCallsBoundIdleEndpointSynchronouslyBeforeTextureReaction()async throws {
        let f=try SourceWildSkinFixture(root:root,deferred:false);defer{f.dispose()}
        let done=expectation(description:"active skin receipt"),nativeReady=f.node.onResourceReady;var ready=false,idle=0
        f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,!ready {ready=true;done.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{
            // Explicit bounded idle endpoint, not production family admission.
            XCTAssertFalse(f.node.sourceWildSkinReceiptCurrent);idle+=1;return true
        }))
        XCTAssertEqual(idle,1);await fulfillment(of:[done],timeout:5);XCTAssertEqual(idle,1)
    }
    func testActualSceneRejectedIdleAdmissionCannotPaintPendingSkinOrRetainHitClaim()async throws {
        let f=try SourceWildSkinFixture(root:root,deferred:false);defer{f.dispose()}
        let face=try XCTUnwrap(f.node.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === f.node.sourcePaintedNumbersTexture})
        face.setScale(4);let width=face.frame.width
        XCTAssertFalse(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{false}))
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertFalse(f.node.hasSourceSkinHitArea);XCTAssertFalse(f.node.sourceWildSkinReceiptCurrent)
        XCTAssertEqual(face.frame.width,width,accuracy:0.001)
    }

    func testActualSceneSourceSkinHitFollowsPaintedNodeRatherThanOriginalCoreCell()throws {
        let f=try SourceWildSkinFixture(root:root);defer{f.dispose()}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{XCTFail("deferred idle");return false}))
        let geometry=try XCTUnwrap(f.scene.boardGeometry),original=geometry.center(row:0,column:0),before=f.scene.engine.state
        f.node.position.x+=geometry.stride
        XCTAssertFalse(f.scene.beginDrag(at:original),"original empty paint location must not hit by Core cell")
        XCTAssertTrue(f.scene.beginDrag(at:f.node.position),"actual Source transformed object owns input")
        f.scene.cancelDrag();XCTAssertEqual(f.scene.engine.state,before)
    }

    func testActualSceneBottleAndHoneySourceSkinsUseMagnetDefaultFaceSize()async throws {
        for variant in ["bottle","honey"] {
            let f=try SourceWildSkinFixture(root:root,variant:variant);defer{f.dispose()}
            let done=expectation(description:"Source \(variant) default Magnet face"),nativeReady=f.node.onResourceReady;var ready=false
            f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,!ready {ready=true;done.fulfill()}}
            XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{XCTFail("deferred idle");return false}))
            await fulfillment(of:[done],timeout:5)
            XCTAssertEqual(f.node.sourceStarOrbitMetrics.width,122.88,accuracy:0.001)
            XCTAssertEqual(f.node.sourceStarOrbitMetrics.height,122.88,accuracy:0.001)
        }
    }
    func testActualSceneActiveBottleUsesLiveFacePivotReaderAtTexturePaint()async throws {
        let f=try SourceWildSkinFixture(root:root,variant:"bottle",deferred:false);defer{f.dispose()}
        let face=try XCTUnwrap(f.node.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === f.node.sourcePaintedNumbersTexture})
        let done=expectation(description:"live Source idle pivot"),nativeReady=f.node.onResourceReady;var ready=false,reads=0
        f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,!ready {ready=true;done.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{
            // Bounded endpoint sets the actual Sprite pivot; full product idle
            // recipe remains outside this geometry/receipt acceptance fixture.
            face.anchorPoint=CGPoint(x:0.5,y:0);return true
        },currentSourceFaceAnchor:{reads+=1;return face.anchorPoint}))
        await fulfillment(of:[done],timeout:5)
        XCTAssertEqual(reads,1);XCTAssertEqual(face.anchorPoint.y,0)
        // SpriteKit size already reflects xScale; frame also includes rotation.
        XCTAssertEqual(face.size.width,122.88,accuracy:0.001)
        XCTAssertEqual(face.size.height,122.88,accuracy:0.001)
    }
    func testActualSceneActiveBottleMissingPivotOwnerRejectsBeforeSkinInputClaim()throws {
        let f=try SourceWildSkinFixture(root:root,variant:"bottle",deferred:false);defer{f.dispose()}
        XCTAssertFalse(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{XCTFail("missing pivot must refuse first");return true}))
        XCTAssertFalse(f.node.hasSourceSkinHitArea);XCTAssertFalse(f.node.sourceWildSkinReceiptCurrent)
    }

    func testSourceSpecialMissingDecodeRecoversOnceThroughActualProviderAndFIFO()async throws {
        let folder=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
        defer{try? FileManager.default.removeItem(at:folder)}
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let scope=try XCTUnwrap(fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{true}))
        let textures=NativeBoardTextures(root:folder),done=expectation(description:"fresh decode after initial missing image")
        defer{textures.dispose();scope.dispose();fifo.dispose()}
        var checks=0,callbacks=0
        XCTAssertTrue(textures.prepareSourceSpecialTexture(assetPath:"recovered.png",assetTasks:tasks,reactionScope:scope,current:{
            checks+=1
            if checks==2 {
                do {try Data(contentsOf:self.root.appendingPathComponent("assets/wild.png")).write(to:folder.appendingPathComponent("recovered.png"))}
                catch {XCTFail("recovery fixture could not publish original raster: \(error)")}
            }
            return true
        }) {handle in
            XCTAssertTrue(fifo.isInsideCheckpoint);XCTAssertNotNil(handle)
            if let handle {XCTAssertTrue(textures.isSourceTextureHandleCurrent(handle))}
            callbacks+=1;done.fulfill()
        })
        await fulfillment(of:[done],timeout:5)
        XCTAssertEqual(checks,4);XCTAssertEqual(callbacks,1)
    }
    func testSourceSpecialPermanentMissingDecodeStopsAfterOneRecovery()async throws {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let scope=try XCTUnwrap(fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{true}))
        let textures=NativeBoardTextures(root:root),done=expectation(description:"bounded missing texture failure")
        defer{textures.dispose();scope.dispose();fifo.dispose()}
        var checks=0,callbacks=0
        XCTAssertTrue(textures.prepareSourceSpecialTexture(assetPath:"missing-\(UUID().uuidString).png",assetTasks:tasks,reactionScope:scope,current:{checks+=1;return true}) {handle in
            XCTAssertTrue(fifo.isInsideCheckpoint);XCTAssertNil(handle);callbacks+=1;done.fulfill()
        })
        await fulfillment(of:[done],timeout:5)
        XCTAssertEqual(checks,4);XCTAssertEqual(callbacks,1)
    }

    func testSourceSpecialRecoveryBoundaryReentrantProviderRetirementCannotDecodeOrPublish()async throws {
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let scope=try XCTUnwrap(fifo.makeAssetScope(boundProducer:.sourceAssetCompletionTask,isCurrent:{true}))
        let textures=NativeBoardTextures(root:root),retired=expectation(description:"fresh retry checks actual epoch")
        defer{textures.dispose();scope.dispose();fifo.dispose()}
        var checks=0,callbacks=0
        XCTAssertTrue(textures.prepareSourceSpecialTexture(assetPath:"missing-\(UUID().uuidString).png",assetTasks:tasks,reactionScope:scope,current:{
            checks+=1;if checks==3 {textures.invalidatePendingPreparation();retired.fulfill()};return true
        }) {_ in callbacks+=1})
        await fulfillment(of:[retired],timeout:5)
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertEqual(checks,3);XCTAssertEqual(callbacks,0)
    }

    func testActualSceneSourceSkinSameIdentityModelUpdatePreservesTypedFaceAndLivePivot()async throws {
        let f=try SourceWildSkinFixture(root:root,variant:"bottle",deferred:false);defer{f.dispose()}
        let face=try XCTUnwrap(f.node.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === f.node.sourcePaintedNumbersTexture})
        let ready=expectation(description:"owned face before model refresh"),nativeReady=f.node.onResourceReady;var finished=false
        f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,!finished {finished=true;ready.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{face.anchorPoint=CGPoint(x:0.5,y:0);return true},currentSourceFaceAnchor:{face.anchorPoint}))
        await fulfillment(of:[ready],timeout:5)
        let texture=try XCTUnwrap(face.texture),size=face.size,anchor=face.anchorPoint,children=f.node.sourceStarOrbitHost.children
        f.node.update(value:5,kind:"wild-magnet",variant:"bottle",depth:2,locked:true)
        XCTAssertTrue(face.texture === texture);XCTAssertEqual(face.size,size);XCTAssertEqual(face.anchorPoint,anchor)
        XCTAssertEqual(f.node.sourceStarOrbitHost.children.count,children.count)
        XCTAssertTrue(f.node.sourceWildSkinReceiptCurrent);XCTAssertTrue(f.node.hasSourceSkinHitArea)
    }
    func testActualSceneSourceSkinPendingUpdateCannotRebuildRawFaceOrRestoreOldIdentityClaim()async throws {
        let f=try SourceWildSkinFixture(root:root);defer{f.dispose()}
        let face=try XCTUnwrap(f.node.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === f.node.sourcePaintedNumbersTexture})
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{XCTFail("deferred");return false}))
        face.anchorPoint=CGPoint(x:0.25,y:0.125)
        f.node.update(value:5,kind:"wild-magnet",variant:nil,depth:2,locked:false)
        XCTAssertEqual(face.anchorPoint,CGPoint(x:0.25,y:0.125));XCTAssertTrue(f.node.hasSourceSkinHitArea)
        f.node.update(value:2,kind:"regular",variant:nil,depth:1,locked:false)
        XCTAssertFalse(f.node.hasSourceSkinHitArea);XCTAssertFalse(f.node.sourceWildSkinReceiptCurrent)
        f.node.update(value:6,kind:"wild-magnet",variant:nil,depth:1,locked:false)
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertFalse(f.node.hasSourceSkinHitArea);XCTAssertFalse(f.node.sourceWildSkinReceiptCurrent)
    }

    func testActualSceneSourceBottleDeferredActivationPreservesReceiptAndCorrectPivotGeometry()async throws {
        let f=try SourceWildSkinFixture(root:root,variant:"bottle");defer{f.dispose()}
        let face=try XCTUnwrap(f.node.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === f.node.sourcePaintedNumbersTexture})
        let ready=expectation(description:"typed bottle before genuine idle activation"),nativeReady=f.node.onResourceReady;var finished=false
        f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,!finished {finished=true;ready.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{XCTFail("still deferred");return false}))
        await fulfillment(of:[ready],timeout:5)
        let texture=try XCTUnwrap(face.texture)
        XCTAssertEqual(f.node.sourceIdleOwnerCount,0)
        f.node.setSourceIdleDeferred(false)
        XCTAssertTrue(face.texture === texture);XCTAssertTrue(f.node.sourceWildSkinReceiptCurrent)
        XCTAssertEqual(face.size.width,122.88,accuracy:0.001);XCTAssertEqual(face.size.height,122.88,accuracy:0.001)
        XCTAssertEqual(face.anchorPoint.y,0);XCTAssertEqual(face.position.y,-61.44,accuracy:0.001)
        XCTAssertGreaterThan(f.node.sourceIdleOwnerCount,0)
        f.node.setSourceIdleDeferred(true)
        XCTAssertTrue(face.texture === texture);XCTAssertTrue(f.node.sourceWildSkinReceiptCurrent)
        XCTAssertEqual(face.size.width,122.88,accuracy:0.001);XCTAssertEqual(face.size.height,122.88,accuracy:0.001)
        XCTAssertEqual(f.node.sourceIdleOwnerCount,0)
    }

    func testActualSceneSourceRegistryStartPreservesSkinAndStartsActualBottleIdleOnlyOnLanding()async throws {
        let f=try SourceWildSkinFixture(root:root,variant:"bottle");defer{f.dispose()}
        let registry=NativeSourceSpecialIdleRegistry(),idle=NativeSourceSpecialIdleScope(registry:registry,current:{f.scope.current})
        defer{idle.dispose()}
        XCTAssertTrue(f.node.configureSourceSpecialIdle(idle));XCTAssertEqual(f.node.sourceIdleOwnerCount,0)
        let face=try XCTUnwrap(f.node.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === f.node.sourcePaintedNumbersTexture})
        let ready=expectation(description:"actual typed bottle before registry owner start"),nativeReady=f.node.onResourceReady;var finished=false
        f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,!finished {finished=true;ready.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{XCTFail("deferred");return false}))
        await fulfillment(of:[ready],timeout:5)
        let texture=try XCTUnwrap(face.texture)
        f.node.setSourceIdleDeferred(false)
        XCTAssertTrue(face.texture === texture);XCTAssertTrue(f.node.sourceWildSkinReceiptCurrent)
        XCTAssertEqual(face.size.width,122.88,accuracy:0.001);XCTAssertEqual(face.size.height,122.88,accuracy:0.001)
        XCTAssertEqual(face.anchorPoint.y,0);XCTAssertEqual(face.position.y,-61.44,accuracy:0.001)
        XCTAssertGreaterThan(f.node.sourceIdleOwnerCount,0)
        f.node.retireSourceSpecialIdleBinding(idle)
        XCTAssertEqual(f.node.sourceIdleOwnerCount,0);XCTAssertTrue(f.node.sourceWildSkinReceiptCurrent)
    }

    func testActualSceneSourceFishIdleActivationAndDragFlipKeepLogicalFaceSize()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.juice,variant:"fish");defer{f.dispose()}
        let face=try XCTUnwrap(f.node.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === f.node.sourcePaintedNumbersTexture})
        let ready=expectation(description:"typed mobile fish raster"),nativeReady=f.node.onResourceReady;var finished=false
        f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,!finished {finished=true;ready.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{XCTFail("deferred");return false}))
        await fulfillment(of:[ready],timeout:5)
        let texture=try XCTUnwrap(face.texture)
        f.node.setSourceIdleDeferred(false)
        XCTAssertTrue(face.texture === texture);XCTAssertTrue(f.node.sourceWildSkinReceiptCurrent)
        XCTAssertEqual(face.size.width,128,accuracy:0.001);XCTAssertEqual(face.size.height,128,accuracy:0.001)
        f.node.setDragging(true)
        _=f.node.fishFrame(in:f.scene,visible:true)
        XCTAssertEqual(abs(face.size.width),128,accuracy:0.001);XCTAssertEqual(abs(face.size.height),128,accuracy:0.001)
        f.node.setDragging(false)
        XCTAssertEqual(face.size.width,128,accuracy:0.001);XCTAssertTrue(f.node.sourceWildSkinReceiptCurrent)
    }

    func testActualSceneSourceBeeUsesUploadedMobileFrameReceiptsAfterRealLanding()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.star,variant:"bee");defer{f.dispose()}
        let face=try XCTUnwrap(f.node.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === f.node.sourcePaintedNumbersTexture})
        let ready=expectation(description:"typed static Bee"),nativeReady=f.node.onResourceReady;var finished=false
        f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,!finished {finished=true;ready.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{XCTFail("deferred");return false}))
        await fulfillment(of:[ready],timeout:5)
        XCTAssertFalse(f.scene.prepareSourceBeeIdleFrames(tileID:"skin",scope:f.scope,completion:{_ in XCTFail("deferred cannot allocate animation frames")}))
        f.node.setSourceIdleDeferred(false)
        let original=try XCTUnwrap(face.texture)
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        XCTAssertTrue(face.texture === original)
        let frames=expectation(description:"all actual Bee uploads settled")
        XCTAssertTrue(f.scene.prepareSourceBeeIdleFrames(tileID:"skin",scope:f.scope,completion:{value in XCTAssertTrue(value);frames.fulfill()}))
        await fulfillment(of:[frames],timeout:5)
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        XCTAssertEqual(f.node.sourceWildSkinAssetPath,"assets/shop/bee/bee2@2x.png")
        XCTAssertTrue(f.node.sourceWildSkinReceiptCurrent)
        XCTAssertTrue(f.node.repairSourceWildSkinPaint(generation:f.node.sourceGeneration,current:{f.scope.current}),
            "A genuine animated Bee frame must repair using its original admitted static skin")
        XCTAssertEqual(f.node.sourceWildSkinAssetPath,"assets/shop/bee/bee1@2x.png")
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        XCTAssertEqual(f.node.sourceWildSkinAssetPath,"assets/shop/bee/bee3@2x.png","Safety paint must preserve the active frame cohort and cadence")
        XCTAssertGreaterThan(abs(face.size.width),125);XCTAssertLessThan(abs(face.size.width),131)
        for index in 1...4 {XCTAssertTrue(f.node.resourcePaths.contains("assets/shop/bee/bee\(index)@2x.png"))}
        f.node.setSourceIdleDeferred(true)
        let held=face.texture
        f.node.tick(1,suspended:false,viewportCenter:1000)
        XCTAssertTrue(face.texture === held)
    }
    func testActualSceneAnimatedBeeSafetyRepairRejectsRetiredCohortWithoutPainting()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.star,variant:"bee");defer{f.dispose()}
        f.view.isPaused=true
        XCTAssertTrue(f.node.configureSourceSpecialIdle(f.scope.specialIdle))
        try await prepareActualSourceBeeForHostMotion(f)
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        XCTAssertEqual(f.node.sourceWildSkinAssetPath,"assets/shop/bee/bee2@2x.png")
        let face=try XCTUnwrap(f.node.sourceStarOrbitHost.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === f.node.sourcePaintedNumbersTexture})
        face.alpha=0.2
        XCTAssertFalse(f.node.repairSourceWildSkinPaint(generation:f.node.sourceGeneration,current:{
            f.node.retireSourceSpecialIdleBinding(f.scope.specialIdle)
            return true // A hostile old callback cannot borrow the retired cohort.
        }))
        XCTAssertEqual(face.alpha,0.2,accuracy:0.001)
        XCTAssertEqual(f.node.sourceWildSkinAssetPath,"assets/shop/bee/bee1@2x.png")
        XCTAssertEqual(f.scope.specialIdle.snapshot.registered,0)
    }
    func testActualSceneSourceBeeScopeRetirementCannotPublishLateFrameCohort()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.star,variant:"bee");defer{f.dispose()}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{true}))
        f.node.setSourceIdleDeferred(false)
        var published=0
        XCTAssertTrue(f.scene.prepareSourceBeeIdleFrames(tileID:"skin",scope:f.scope,completion:{_ in published+=1}))
        _=try XCTUnwrap(f.context.beginScene(engine:NativeGameplayEngine(state:.init(tiles:[])),retire:{}))
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertEqual(published,0);XCTAssertFalse(f.node.hasSourceSkinHitArea)
    }

    func testActualSceneSourceBeePartialDecodeKeepsOriginalOrderAndRequiresTwoFrames()async throws {
        for indices in [[1,3],[1]] {
            let folder=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            let directory=folder.appendingPathComponent("assets/shop/bee")
            try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
            defer{try? FileManager.default.removeItem(at:folder)}
            for index in indices {
                let file="bee\(index)@2x.png"
                try FileManager.default.copyItem(at:root.appendingPathComponent("assets/shop/bee/"+file),to:directory.appendingPathComponent(file))
            }
            let f=try SourceWildSkinFixture(root:folder,archetype:.star,variant:"bee");defer{f.dispose()}
            let ready=expectation(description:"safe static Bee before partial frame decode"),nativeReady=f.node.onResourceReady;var finished=false
            f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,!finished {finished=true;ready.fulfill()}}
            XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{true}))
            await fulfillment(of:[ready],timeout:5)
            f.node.setSourceIdleDeferred(false)
            let frames=expectation(description:"all selected frame decode results settled")
            XCTAssertTrue(f.scene.prepareSourceBeeIdleFrames(tileID:"skin",scope:f.scope,completion:{value in
                XCTAssertEqual(value,indices.count>=2);frames.fulfill()
            }))
            await fulfillment(of:[frames],timeout:5)
            f.node.tick(0.04,suspended:false,viewportCenter:1000)
            XCTAssertEqual(f.node.sourceWildSkinAssetPath,indices.count>=2 ? "assets/shop/bee/bee3@2x.png":"assets/shop/bee/bee1@2x.png")
            XCTAssertTrue(f.node.sourceWildSkinReceiptCurrent)
        }
    }

    @MainActor private func prepareActualSourceBeeForHostMotion(_ f:SourceWildSkinFixture)async throws {
        let ready=expectation(description:"typed static Bee host fixture"),nativeReady=f.node.onResourceReady;var finished=false
        f.node.onResourceReady={nativeReady?();if f.node.sourceWildSkinReceiptCurrent,!finished {finished=true;ready.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{true}))
        await fulfillment(of:[ready],timeout:5)
        f.node.setSourceIdleDeferred(false)
        let frames=expectation(description:"actual Bee uploaded cohort before host motion")
        XCTAssertTrue(f.scene.prepareSourceBeeIdleFrames(tileID:"skin",scope:f.scope,completion:{value in XCTAssertTrue(value);frames.fulfill()}))
        await fulfillment(of:[frames],timeout:5)
    }
    func testActualSceneSourceBeeMotionPaintsCapturedHostAndDragRestoresItsPose()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.star,variant:"bee");defer{f.dispose()}
        // This golden sample owns its explicit 40ms tick; texture upload must
        // not also admit an independent SpriteKit update during the await.
        f.view.isPaused=true
        let host=f.node.sourceStarOrbitHost,outer=f.node.position
        f.node.dragInnerTilt=0.07;f.node.sourceInnerPosition=CGPoint(x:3,y:-5);host.xScale=1.03;host.yScale=1.02
        try await prepareActualSourceBeeForHostMotion(f)
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        // Original bee-dice-idle.ts sample(.04), restored board idle bounds.
        XCTAssertEqual(f.node.sourceInnerPosition.x,3.593619907781753,accuracy:0.000001)
        XCTAssertEqual(f.node.sourceInnerPosition.y,-9.917226024976649,accuracy:0.000001)
        XCTAssertEqual(f.node.dragInnerTilt,0.0890610627752862,accuracy:0.000001)
        XCTAssertEqual(host.xScale,1.03*1.0144282057276757,accuracy:0.000001)
        XCTAssertEqual(host.yScale,1.02*1.0144282057276757,accuracy:0.000001)
        XCTAssertEqual(f.node.position,outer)
        let face=try XCTUnwrap(host.children.compactMap{$0 as? SKSpriteNode}.first{$0.texture === f.node.sourcePaintedNumbersTexture})
        XCTAssertEqual(face.position,.zero);XCTAssertEqual(face.zRotation,0)
        XCTAssertEqual(abs(face.size.width),128,accuracy:0.001);XCTAssertEqual(abs(face.size.height),128,accuracy:0.001)
        let pausedPosition=f.node.sourceInnerPosition
        f.node.tick(1,suspended:true,viewportCenter:1000)
        XCTAssertEqual(f.node.sourceInnerPosition,pausedPosition)
        f.node.setDragging(true,sourceOuterTransform:true)
        XCTAssertEqual(f.node.sourceInnerPosition.x,3,accuracy:0.00001);XCTAssertEqual(f.node.sourceInnerPosition.y,-5,accuracy:0.00001);XCTAssertEqual(f.node.dragInnerTilt,0.07,accuracy:0.000001)
        XCTAssertEqual(host.xScale,1.03,accuracy:0.000001);XCTAssertEqual(host.yScale,1.02,accuracy:0.000001)
        f.node.tick(0.032,suspended:false,viewportCenter:1000)
        XCTAssertEqual(f.node.sourceInnerPosition.x,3,accuracy:0.00001);XCTAssertEqual(f.node.sourceInnerPosition.y,-5,accuracy:0.00001)
        f.node.setDragging(false,sourceOuterTransform:true)
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        XCTAssertGreaterThan(abs(f.node.sourceInnerPosition.x-3),0.1)
    }
    func testActualSceneSourceBeeWaitsForSettledHostThenCapturesActualPose()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.star,variant:"bee");defer{f.dispose()}
        let host=f.node.sourceStarOrbitHost
        host.xScale=1;host.yScale=0.5
        try await prepareActualSourceBeeForHostMotion(f)
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        XCTAssertEqual(host.xScale,1);XCTAssertEqual(host.yScale,0.5);XCTAssertEqual(f.node.sourceInnerPosition,.zero)
        host.xScale=0.98;host.yScale=1;f.node.sourceInnerPosition=CGPoint(x:8,y:-3)
        f.node.tick(0,suspended:false,viewportCenter:1000)
        XCTAssertEqual(f.node.sourceInnerPosition.x,8.593619907781753,accuracy:0.000001)
        XCTAssertEqual(f.node.sourceInnerPosition.y,-7.917226024976649,accuracy:0.000001)
        XCTAssertEqual(host.xScale,0.98*1.0144282057276757,accuracy:0.000001)
    }
    func testActualSceneSourceBeeCannotRestoreOrOverwriteReplacementHostOwner()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.star,variant:"bee");defer{f.dispose()}
        try await prepareActualSourceBeeForHostMotion(f)
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        f.node.dragInnerTilt=0.4;f.node.sourceInnerPosition=CGPoint(x:40,y:50)
        let host=f.node.sourceStarOrbitHost;host.xScale=0.8;host.yScale=0.9
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        f.node.setDragging(true,sourceOuterTransform:true)
        XCTAssertEqual(f.node.sourceInnerPosition.x,40,accuracy:0.00001);XCTAssertEqual(f.node.sourceInnerPosition.y,50,accuracy:0.00001);XCTAssertEqual(f.node.dragInnerTilt,0.4,accuracy:0.000001)
        XCTAssertEqual(host.xScale,0.8,accuracy:0.000001);XCTAssertEqual(host.yScale,0.9,accuracy:0.000001)
        f.node.retireSourceAnimationBindingsPreservingPaint()
        XCTAssertEqual(f.node.sourceInnerPosition.x,40,accuracy:0.00001);XCTAssertEqual(f.node.sourceInnerPosition.y,50,accuracy:0.00001);XCTAssertEqual(f.node.dragInnerTilt,0.4,accuracy:0.000001)
    }

    func testActualSceneHoneyRelayoutStartsSourceAfterEntryWithoutRawCarrierAllocation()async throws {
        let f=try SourceWildSkinFixture(root:root,variant:"honey",deferred:false);defer{f.dispose()}
        let tasks=try XCTUnwrap(f.scope.sourceMicrotaskTasks)
        f.scene.synchronize(animateEntry:true)
        XCTAssertTrue(tasks.layoutTask{XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:f.scope))})
        XCTAssertTrue(f.node.sourceIdleDeferred);XCTAssertFalse(f.node.hasSourceHoneyIdle)
        XCTAssertEqual(f.node.sourceIdleOwnerCount,0)
        XCTAssertTrue(tasks.layoutTask{f.scene.layout(size:.init(width:393,height:852),insets:.zero,animateEntry:false)})
        XCTAssertFalse(f.node.sourceIdleDeferred);XCTAssertTrue(f.node.hasSourceHoneyIdle)
        XCTAssertFalse(f.node.visual.children.contains{$0.name=="native-honey-idle-orbit"})
        for _ in 0..<500 {if f.node.sourceWildSkinReceiptCurrent && f.node.sourceHoneyCohortCommitted {break};try await Task.sleep(for:.milliseconds(2))}
        XCTAssertTrue(f.node.sourceWildSkinReceiptCurrent);XCTAssertTrue(f.node.sourceHoneyCohortCommitted)
        let before=f.scene.engine.state,ids=f.node.sourceHoneySprites.map(ObjectIdentifier.init)
        f.service.deliver(wallMilliseconds:400);let positions=f.node.sourceHoneySprites.map(\.position)
        let release=f.scene.acquireSourceSpecialIdle(reason:"actual-honey")
        f.service.deliver(wallMilliseconds:800)
        XCTAssertNotEqual(f.node.sourceHoneySprites.map(\.position),positions)
        release?();XCTAssertEqual(f.node.sourceHoneySprites.map(ObjectIdentifier.init),ids)
        XCTAssertEqual(f.scene.engine.state,before);XCTAssertEqual(f.scope.specialIdle.snapshot.running,1)
    }
    func testActualSceneHoneyOutsideTaskWaitsForGenuineRendererHandoff()throws {
        let f=try SourceWildSkinFixture(root:root,variant:"honey",deferred:false);defer{f.dispose()}
        XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:f.scope))
        XCTAssertTrue(f.node.sourceIdleDeferred);XCTAssertFalse(f.node.hasSourceHoneyIdle)
        f.scene.didFinishUpdate()
        XCTAssertFalse(f.node.sourceIdleDeferred);XCTAssertTrue(f.node.hasSourceHoneyIdle)
        XCTAssertFalse(f.node.visual.children.contains{$0.name=="native-honey-idle-orbit"})
    }
    func testActualSceneBottleEntryRelayoutResumesOriginalBaseAndLateSkinKeepsPivot()async throws {
        let f=try SourceWildSkinFixture(root:root,variant:"bottle",deferred:false);defer{f.dispose()}
        f.scene.synchronize(animateEntry:true)
        XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:f.scope))
        XCTAssertTrue(f.node.sourceIdleDeferred);XCTAssertFalse(f.node.hasSourceBottleIdle)
        f.scene.layout(size:CGSize(width:393,height:852),insets:.zero,animateEntry:false)
        XCTAssertFalse(f.node.sourceIdleDeferred);XCTAssertTrue(f.node.hasSourceBottleIdle)
        for _ in 0..<500 {if f.node.sourceWildSkinReceiptCurrent {break};try await Task.sleep(for:.milliseconds(2))}
        XCTAssertTrue(f.node.sourceWildSkinReceiptCurrent)
        XCTAssertEqual(f.node.sourceBaseAnchorY,1,accuracy:1e-6)
        let baseY=f.node.sourceBaseY
        f.service.deliver(wallMilliseconds:400)
        let moved=f.node.sourceBaseY
        XCTAssertLessThan(moved,baseY)
        f.node.tick(100,suspended:false,viewportCenter:195)
        XCTAssertEqual(f.node.sourceBaseY,moved)
        let release=f.scene.acquireSourceSpecialIdle(reason:"actual-bottle")
        f.service.deliver(wallMilliseconds:800);XCTAssertEqual(f.node.sourceBaseY,moved)
        release?();f.service.deliver(wallMilliseconds:1200)
        XCTAssertLessThan(f.node.sourceBaseY,moved)
        XCTAssertEqual(f.scope.specialIdle.snapshot.running,1)
    }

    func testActualSceneRestoredBeeDefersIdleUntilActualBoardEntranceCompletes()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.star,variant:"bee",deferred:false);defer{f.dispose()}
        let window=UIWindow(frame:f.view.bounds),controller=UIViewController();controller.view=f.view;window.rootViewController=controller
        window.makeKeyAndVisible();defer{window.isHidden=true;window.rootViewController=nil}
        f.scene.synchronize(animateEntry:true)
        XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:f.scope))
        XCTAssertTrue(f.node.sourceIdleDeferred)
        XCTAssertEqual(f.scope.specialIdle.snapshot.registered,0)
        for _ in 0..<500 {if f.node.sourceWildSkinReceiptCurrent {break};try await Task.sleep(for:.milliseconds(2))}
        XCTAssertTrue(f.node.sourceWildSkinReceiptCurrent)
        XCTAssertTrue(f.node.sourceIdleDeferred);XCTAssertFalse(f.node.hasAnimatedArtwork)
        for _ in 0..<500 {if !f.node.sourceIdleDeferred && f.node.hasAnimatedArtwork {break};try await Task.sleep(for:.milliseconds(10))}
        XCTAssertFalse(f.node.sourceIdleDeferred);XCTAssertTrue(f.node.hasAnimatedArtwork)
        XCTAssertEqual(f.scope.specialIdle.snapshot.running,1)
        let geometry=try XCTUnwrap(f.scene.boardGeometry)
        XCTAssertEqual(f.node.sourceLocalScale.x,1,accuracy:0.00001)
        XCTAssertEqual(f.node.xScale,geometry.scale,accuracy:0.00001)
    }

    func testActualSceneRestoredBeeRelayoutSettlesEntryBeforeResumingSingleIdle()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.star,variant:"bee",deferred:false);defer{f.dispose()}
        f.scene.synchronize(animateEntry:true)
        XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:f.scope));XCTAssertTrue(f.node.sourceIdleDeferred)
        f.scene.layout(size:CGSize(width:393,height:852),insets:.zero,animateEntry:false)
        XCTAssertFalse(f.node.sourceIdleDeferred)
        for _ in 0..<500 {if f.node.sourceWildSkinReceiptCurrent && f.node.hasAnimatedArtwork {break};try await Task.sleep(for:.milliseconds(10))}
        XCTAssertTrue(f.node.hasAnimatedArtwork);XCTAssertEqual(f.scope.specialIdle.snapshot.registered,1)
        XCTAssertEqual(f.node.sourceLocalScale.x,1,accuracy:0.00001)
        XCTAssertEqual(f.node.xScale,try XCTUnwrap(f.scene.boardGeometry).scale,accuracy:0.00001)
        try await Task.sleep(for:.milliseconds(900))
        XCTAssertEqual(f.scope.specialIdle.snapshot.registered,1)
        XCTAssertTrue(f.scene.sourceNativeTileNode("skin") === f.node)
    }

    func testActualSceneRestoredBeeRetiredScopeCannotResumeDeferredEntryIdle()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.star,variant:"bee",deferred:false);defer{f.dispose()}
        let window=UIWindow(frame:f.view.bounds),controller=UIViewController();controller.view=f.view;window.rootViewController=controller
        window.makeKeyAndVisible();defer{window.isHidden=true;window.rootViewController=nil}
        f.scene.synchronize(animateEntry:true)
        XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:f.scope));XCTAssertTrue(f.node.sourceIdleDeferred)
        _=try XCTUnwrap(f.context.beginScene(engine:NativeGameplayEngine(state:.init(tiles:[])),retire:{}))
        try await Task.sleep(for:.milliseconds(1000))
        XCTAssertFalse(f.node.hasAnimatedArtwork);XCTAssertEqual(f.scope.specialIdle.snapshot.registered,0)
        XCTAssertFalse(f.scene.sourceSpecialIdleAdmissionOpen)
    }

    func testActualSceneSourceBeeStartupScopeStartsTypedCohortAndResumeKeepsOwner()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.star,variant:"bee",deferred:false);defer{f.dispose()}
        XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:f.scope))
        for _ in 0..<500 {if f.node.sourceWildSkinReceiptCurrent && f.node.hasAnimatedArtwork {break};try await Task.sleep(for:.milliseconds(10))}
        XCTAssertTrue(f.node.sourceWildSkinReceiptCurrent);XCTAssertTrue(f.node.hasAnimatedArtwork)
        XCTAssertEqual(f.scope.specialIdle.snapshot.running,1)
        f.scene.setSuspended(true)
        f.scene.update(2)
        let release=try XCTUnwrap(f.scene.acquireSourceSpecialIdle(reason:"startup-pause"))
        let texture=f.node.sourcePaintedNumbersTexture
        f.node.tick(2,suspended:true,viewportCenter:1000)
        XCTAssertTrue(f.node.sourcePaintedNumbersTexture === texture)
        XCTAssertEqual(f.scope.specialIdle.snapshot.paused,1)
        release();release()
        XCTAssertTrue(f.scope.sourceMicrotaskTasks?.inputTask{f.scene.setSuspended(false)} == true)
        XCTAssertEqual(f.scope.specialIdle.snapshot.running,1)
        XCTAssertEqual(f.scope.specialIdle.snapshot.registered,1)
        XCTAssertTrue(f.node.hasAnimatedArtwork)
    }

    func testActualSceneSourceBeeRegistryPauseResumeRetainsPhaseAndHasSingleRegistration()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.star,variant:"bee");defer{f.dispose()}
        f.view.isPaused=true
        XCTAssertTrue(f.node.configureSourceSpecialIdle(f.scope.specialIdle))
        try await prepareActualSourceBeeForHostMotion(f)
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        let position=f.node.sourceInnerPosition,path=f.node.sourceWildSkinAssetPath
        let release=try XCTUnwrap(f.scope.specialIdle.acquire(reason:"merge6-resolution"))
        XCTAssertEqual(f.scope.specialIdle.snapshot.registered,1);XCTAssertEqual(f.scope.specialIdle.snapshot.paused,1)
        XCTAssertTrue(f.node.hasAnimatedArtwork)
        XCTAssertTrue(f.node.keepsDirectArtworkDuringRegistryPressure)
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        XCTAssertNotEqual(f.node.sourceInnerPosition,position)
        XCTAssertNotEqual(f.node.sourceWildSkinAssetPath,path)
        let pausedPosition=f.node.sourceInnerPosition,pausedPath=f.node.sourceWildSkinAssetPath
        f.node.tick(2,suspended:true,viewportCenter:1000)
        XCTAssertEqual(f.node.sourceInnerPosition,pausedPosition)
        XCTAssertEqual(f.node.sourceWildSkinAssetPath,pausedPath)
        release();release()
        XCTAssertEqual(f.scope.specialIdle.snapshot.registered,1);XCTAssertEqual(f.scope.specialIdle.snapshot.running,1)
        XCTAssertTrue(f.node.hasAnimatedArtwork)
        XCTAssertEqual(f.node.sourceInnerPosition,pausedPosition)
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        XCTAssertEqual(f.node.sourceWildSkinAssetPath,"assets/shop/bee/bee4@2x.png")
    }
    func testActualSceneSourceBeeActiveRetirementRestoresOwnedStaticSkinAndRestartUsesFreshCohort()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.star,variant:"bee");defer{f.dispose()}
        XCTAssertTrue(f.node.configureSourceSpecialIdle(f.scope.specialIdle))
        try await prepareActualSourceBeeForHostMotion(f)
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        XCTAssertEqual(f.node.sourceWildSkinAssetPath,"assets/shop/bee/bee2@2x.png")
        f.node.retireSourceSpecialIdleBinding(f.scope.specialIdle)
        XCTAssertEqual(f.scope.specialIdle.snapshot.registered,0);XCTAssertFalse(f.node.hasAnimatedArtwork)
        XCTAssertEqual(f.node.sourceInnerPosition.x,0,accuracy:0.00001);XCTAssertEqual(f.node.sourceInnerPosition.y,0,accuracy:0.00001)
        XCTAssertEqual(f.node.sourceStarOrbitHost.xScale,1,accuracy:0.000001)
        XCTAssertEqual(f.node.sourceWildSkinAssetPath,"assets/shop/bee/bee1@2x.png")
        XCTAssertTrue(f.node.configureSourceSpecialIdle(f.scope.specialIdle));XCTAssertFalse(f.node.hasAnimatedArtwork)
        let fresh=expectation(description:"new original cohort after owner restart")
        XCTAssertTrue(f.scene.prepareSourceBeeIdleFrames(tileID:"skin",scope:f.scope,completion:{value in XCTAssertTrue(value);fresh.fulfill()}))
        await fulfillment(of:[fresh],timeout:5)
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        XCTAssertEqual(f.node.sourceWildSkinAssetPath,"assets/shop/bee/bee2@2x.png")
        XCTAssertEqual(f.node.sourceStarOrbitHost.xScale,1.0144282057276757,accuracy:0.000001)
        XCTAssertEqual(f.scope.specialIdle.snapshot.registered,1)
    }
    func testActualSceneSourceBeeScopeClosurePreservesLastPaintInsteadOfActiveRestore()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.star,variant:"bee");defer{f.dispose()}
        XCTAssertTrue(f.node.configureSourceSpecialIdle(f.scope.specialIdle))
        try await prepareActualSourceBeeForHostMotion(f)
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        let position=f.node.sourceInnerPosition,rotation=f.node.dragInnerTilt,host=f.node.sourceStarOrbitHost,x=host.xScale,y=host.yScale,texture=f.node.sourcePaintedNumbersTexture
        _=try XCTUnwrap(f.context.beginScene(engine:NativeGameplayEngine(state:.init(tiles:[])),retire:{}))
        XCTAssertEqual(f.node.sourceInnerPosition,position);XCTAssertEqual(f.node.dragInnerTilt,rotation)
        XCTAssertEqual(host.xScale,x);XCTAssertEqual(host.yScale,y);XCTAssertTrue(f.node.sourcePaintedNumbersTexture === texture)
        XCTAssertFalse(f.node.hasAnimatedArtwork)
    }

    func testActualSceneSourceBeeSynchronousIdlePrefixBeforeStaticUploadCapturesRealFallback()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.star,variant:"bee",deferred:false);defer{f.dispose()}
        // This test samples one explicit 40ms idle step after real async upload.
        // Keep SKView's independent native updates from advancing elapsed time
        // while XCTest awaits that upload; Source wall is already fixed at zero.
        f.view.isPaused=true
        XCTAssertTrue(f.node.configureSourceSpecialIdle(f.scope.specialIdle))
        let ready=expectation(description:"early actual frame cohort"),nativeReady=f.node.onResourceReady;var starts=0,hadStaticAtStart=true
        let initialPosition=f.node.position
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{
            starts+=1;hadStaticAtStart=f.node.sourceWildSkinReceiptCurrent
            return f.scene.prepareSourceBeeIdleFrames(tileID:"skin",scope:f.scope,completion:{value in XCTAssertTrue(value);ready.fulfill()})
        }))
        XCTAssertEqual(starts,1);XCTAssertFalse(hadStaticAtStart)
        f.node.onResourceReady={nativeReady?()}
        await fulfillment(of:[ready],timeout:5)
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        XCTAssertEqual(f.node.sourceWildSkinAssetPath,"assets/shop/bee/bee2@2x.png")
        f.node.retireSourceSpecialIdleBinding(f.scope.specialIdle)
        XCTAssertEqual(f.node.sourceWildSkinAssetPath,"assets/shop/bee/bee1@2x.png")
        XCTAssertTrue(f.node.sourceWildSkinReceiptCurrent);XCTAssertFalse(f.node.hasAnimatedArtwork)
        XCTAssertEqual(f.node.position,initialPosition)
    }

    func testActualSceneSourceBeeUnregisteredDisposedNodeDoesNotRetainOriginalTexture()async throws {
        let f=try SourceWildSkinFixture(root:root,archetype:.star,variant:"bee");defer{f.dispose()}
        try await prepareActualSourceBeeForHostMotion(f)
        weak var original=f.node.sourcePaintedNumbersTexture
        XCTAssertNotNil(original)
        f.node.tick(0.04,suspended:false,viewportCenter:1000)
        XCTAssertFalse(f.node.sourcePaintedNumbersTexture === original)
        f.node.dispose();f.scene.dispose();f.view.presentScene(nil)
        try await Task.sleep(for:.milliseconds(100))
        // The fixture still strongly holds the disposed Node. Its safe initial
        // texture must not survive solely through the former Bee owner record.
        XCTAssertNil(original)
    }


    func testActualSceneTwoFizzSystemsMatchExecutedOriginalSharedGSAPPosesAndRNG() async throws {
        struct Bubble:Decodable {let x,y,scaleX,scaleY,alpha:Double;let color:UInt32}
        struct System:Decodable {let owner:String,bubbles:[Bubble]}
        struct Checkpoint:Decodable {let seconds:Double,draws:Int,systems:[System]}
        let json = #"[{"seconds":0.3,"draws":50,"systems":[{"owner":"bottle","bubbles":[{"x":13.286621,"y":48.770573,"scaleX":0.65429,"scaleY":0.714401,"alpha":0.7788843991234898,"color":13759730}]},{"owner":"honey","bubbles":[{"x":19.098108,"y":2.509672,"scaleX":0.859601,"scaleY":0.656988,"alpha":0.9924976648995651,"color":15907663}]}]},{"seconds":0.5,"draws":62,"systems":[{"owner":"bottle","bubbles":[{"x":21.579628,"y":22.373517,"scaleX":0.67091,"scaleY":0.73366,"alpha":0.7788843991234898,"color":14284533},{"x":-49.235037,"y":64,"scaleX":0.390213,"scaleY":0.390213,"alpha":0.7692530173109844,"color":13431793}]},{"owner":"honey","bubbles":[{"x":17.653662,"y":-32.320229,"scaleX":0.874466,"scaleY":0.665418,"alpha":0.9924976648995651,"color":15907663}]}]},{"seconds":0.8,"draws":75,"systems":[{"owner":"bottle","bubbles":[{"x":1.148513,"y":-29.662575,"scaleX":0.67091,"scaleY":0.73366,"alpha":0.7788843991234898,"color":15334137},{"x":-56.159321,"y":14.634986,"scaleX":0.753544,"scaleY":0.618699,"alpha":0.7692530173109844,"color":14415861}]},{"owner":"honey","bubbles":[{"x":16.031509,"y":-71.435206,"scaleX":0.874466,"scaleY":0.665418,"alpha":0.9924976648995651,"color":15907663},{"x":30.134074,"y":64,"scaleX":0.386667,"scaleY":0.386667,"alpha":0.7033481253776699,"color":15907663}]}]},{"seconds":1.1,"draws":87,"systems":[{"owner":"bottle","bubbles":[{"x":16.393744,"y":-77.440333,"scaleX":0.67091,"scaleY":0.73366,"alpha":0.740369,"color":16252413},{"x":-52.472654,"y":-74.880618,"scaleX":0.753544,"scaleY":0.618699,"alpha":0.740733,"color":16252413},{"x":-8.636265,"y":64,"scaleX":0.229205,"scaleY":0.229205,"alpha":0.9706279288511723,"color":13431793}]},{"owner":"honey","bubbles":[{"x":15.062773,"y":-94.794331,"scaleX":0.874466,"scaleY":0.665418,"alpha":0.892373,"color":15907663},{"x":27.465469,"y":16.687996,"scaleX":0.859905,"scaleY":0.736576,"alpha":0.7033481253776699,"color":15907663}]}]},{"seconds":1.4,"draws":87,"systems":[{"owner":"bottle","bubbles":[{"x":13.60826,"y":-101.513912,"scaleX":0.67091,"scaleY":0.73366,"alpha":0.241271,"color":16777215},{"x":-15.935612,"y":41.291068,"scaleX":0.82666,"scaleY":0.81111,"alpha":0.9706279288511723,"color":13891059}]},{"owner":"honey","bubbles":[{"x":25.242194,"y":-22.728722,"scaleX":0.921523,"scaleY":0.782136,"alpha":0.7033481253776699,"color":15907663}]}]},{"seconds":1.7,"draws":112,"systems":[{"owner":"bottle","bubbles":[{"x":1.674718,"y":-14.439204,"scaleX":0.831266,"scaleY":0.815596,"alpha":0.9706279288511723,"color":15006200},{"x":-22.280093,"y":64,"scaleX":0.20032,"scaleY":0.20032,"alpha":0.8053519337205216,"color":13431793}]},{"owner":"honey","bubbles":[{"x":23.464247,"y":-54.250152,"scaleX":0.921523,"scaleY":0.782136,"alpha":0.7033481253776699,"color":15907663},{"x":-23.120079,"y":64,"scaleX":0.382212,"scaleY":0.382212,"alpha":0.982379332720302,"color":15907663}]}]},{"seconds":2,"draws":112,"systems":[{"owner":"bottle","bubbles":[{"x":-14.358584,"y":-72.768337,"scaleX":0.831266,"scaleY":0.815596,"alpha":0.942637,"color":16186877},{"x":-35.443306,"y":18.519477,"scaleX":0.717891,"scaleY":0.685987,"alpha":0.8053519337205216,"color":14350069}]},{"owner":"honey","bubbles":[{"x":22.131629,"y":-77.876296,"scaleX":0.921523,"scaleY":0.782136,"alpha":0.703302,"color":15907663},{"x":-23.629535,"y":1.615635,"scaleX":0.731467,"scaleY":0.602152,"alpha":0.982379332720302,"color":15907663}]}]}]"#
        let gold=try JSONDecoder().decode([Checkpoint].self,from:Data(json.utf8))
        var seed:UInt32=1,draws=0
        let f=try SourceWildSkinFixture(root:root,variant:"bottle",visualRandom:{draws+=1;seed=seed &* 1664525 &+ 1013904223;return Double(seed)/4294967296},additionalTile:.init(id:"honey",cell:.init(column:1,row:0),value:6,archetype:.magnet,variant:"honey"))
        defer{f.dispose()}
        let honey=try XCTUnwrap(f.scene.sourceNativeTileNode("honey"));honey.setSourceIdleDeferred(true)
        XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:f.scope))
        let ready=expectation(description:"two actual typed Source receipts");ready.expectedFulfillmentCount=2
        for node in [f.node,honey] {
            let native=node.onResourceReady;var done=false
            node.onResourceReady={native?();if node.sourceWildSkinReceiptCurrent,!done{done=true;ready.fulfill()}}
            XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:node.tileID,scope:f.scope,startSourceIdle:{XCTFail("deferred prefix");return false}))
        }
        await fulfillment(of:[ready],timeout:5);XCTAssertEqual(draws,0)
        f.view.isPaused=true
        for node in [f.node,honey] {
            node.setSourceIdleDeferred(false)
            XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:node.tileID,scope:f.scope,startSourceIdle:{true},currentSourceFaceAnchor:{.init(x:node.sourceBaseAnchorX,y:1-node.sourceBaseAnchorY)}))
        }

        XCTAssertEqual(draws,25)
        XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,2)
        f.service.deliver(wallMilliseconds:16);XCTAssertEqual(draws,50)
        for checkpoint in gold {
            f.service.deliver(wallMilliseconds:checkpoint.seconds*1000)
            XCTAssertEqual(draws,checkpoint.draws,"actual APP common RNG at \(checkpoint.seconds)")
            let fields=try [f.node,honey].map{node in try XCTUnwrap(node.visual.children.compactMap{$0 as? NativeIdleBubbleField}.first)}
            for (field,system) in zip(fields,checkpoint.systems) {
                let actual=field.fishBubbleSnapshots;XCTAssertEqual(actual.count,system.bubbles.count)
                let carriers=field.children.filter{!$0.isHidden}
                XCTAssertEqual(carriers.count,actual.count)
                for (index,pair) in zip(actual,system.bubbles).enumerated() {
                    let (pose,original)=pair
                    let body=try XCTUnwrap(carriers[index].children.first as? SKShapeNode)
                    var r:CGFloat=0,g:CGFloat=0,b:CGFloat=0,a:CGFloat=0
                    XCTAssertTrue(body.fillColor.getRed(&r,green:&g,blue:&b,alpha:&a))
                    let rgb=UInt32((r*255).rounded())<<16 | UInt32((g*255).rounded())<<8 | UInt32((b*255).rounded())
                    XCTAssertEqual(rgb,original.color);XCTAssertEqual(a,0.6,accuracy:1e-6)
                    XCTAssertEqual(pose.point.x,original.x,accuracy:3e-5);XCTAssertEqual(pose.point.y,original.y,accuracy:3e-5)
                    XCTAssertEqual(pose.scale.x,original.scaleX,accuracy:3e-5);XCTAssertEqual(pose.scale.y,original.scaleY,accuracy:3e-5)
                    XCTAssertEqual(pose.alpha,original.alpha,accuracy:3e-5)
                }
            }
        }
    }

    func testActualAutomaticMagnetRAFRestartsCapturedFizzWhileGlobalGSAPPaused()async throws {
        var draws=0
        let f=try SourceWildSkinFixture(root:root,variant:"bottle",visualRandom:{draws+=1;return 0.5});defer{f.dispose()}
        XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:f.scope))
        let ready=expectation(description:"typed bottle");let native=f.node.onResourceReady;var done=false
        f.node.onResourceReady={native?();if f.node.sourceWildSkinReceiptCurrent,!done{done=true;ready.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{false}))
        await fulfillment(of:[ready],timeout:5);f.view.isPaused=true;f.node.setSourceIdleDeferred(false)
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{true},currentSourceFaceAnchor:{.init(x:f.node.sourceBaseAnchorX,y:1-f.node.sourceBaseAnchorY)}))
        let old=try XCTUnwrap(f.node.visual.children.compactMap{$0 as? NativeIdleBubbleField}.first)
        XCTAssertEqual(draws,12);XCTAssertTrue(f.service.setSourceGlobalPaused(true))
        XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,1)
        f.service.deliver(wallMilliseconds:16)
        XCTAssertEqual(draws,24);XCTAssertNil(old.parent);XCTAssertFalse(old.isRunning)
        let replacement=try XCTUnwrap(f.node.visual.children.compactMap{$0 as? NativeIdleBubbleField}.first)
        XCTAssertFalse(replacement === old);XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,0)
        f.service.deliver(wallMilliseconds:32);XCTAssertEqual(draws,24)
        XCTAssertEqual(f.service.sourceAnimationSeconds,0,"RAF must not resume the paused GSAP timeline")
    }

    func testActualNodeMagnetRAFReplacementAndScopeRetirementCannotRestartNewerCue()async throws {
        var draws=0
        let f=try SourceWildSkinFixture(root:root,variant:"bottle",visualRandom:{draws+=1;return 0.5});defer{f.dispose()}
        XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:f.scope))
        let ready=expectation(description:"typed bottle for captured RAF");let native=f.node.onResourceReady;var done=false
        f.node.onResourceReady={native?();if f.node.sourceWildSkinReceiptCurrent,!done{done=true;ready.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{false}))
        await fulfillment(of:[ready],timeout:5);f.view.isPaused=true;f.node.setSourceIdleDeferred(false)
        let reactions=try XCTUnwrap(f.fifo.makeMeterScope(boundProducers:NativeSourceMicrotaskFIFO.meterBoundaries,isCurrent:{f.scope.current}));defer{reactions.dispose()}
        func repair(){XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{true},currentSourceFaceAnchor:{.init(x:f.node.sourceBaseAnchorX,y:1-f.node.sourceBaseAnchorY)}))}
        repair();XCTAssertEqual(draws,12)
        repair();XCTAssertEqual(draws,24);XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,2)
        let newer=try XCTUnwrap(f.node.visual.children.compactMap{$0 as? NativeIdleBubbleField}.first)
        f.service.deliver(wallMilliseconds:16);XCTAssertEqual(draws,48)
        XCTAssertNil(newer.parent)
        XCTAssertTrue(f.node.scheduleSourceMagnetFizzRestart(service:f.service,tasks:reactions,canvasPaintable:{true},current:{f.scope.current}))
        _=try XCTUnwrap(f.context.beginScene(retire:{}))
        XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,0)
        f.service.deliver(wallMilliseconds:32);XCTAssertEqual(draws,48)
    }
    func testActualAutomaticMagnetLateFirstFrameRunsSourceProducerBeforeCapturedRestart()async throws {
        var draws=0
        let f=try SourceWildSkinFixture(root:root,variant:"bottle",visualRandom:{draws+=1;return 0.5});defer{f.dispose()}
        XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:f.scope))
        let ready=expectation(description:"typed bottle");let native=f.node.onResourceReady;var done=false
        f.node.onResourceReady={native?();if f.node.sourceWildSkinReceiptCurrent,!done{done=true;ready.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{false}))
        await fulfillment(of:[ready],timeout:5);f.view.isPaused=true;f.node.setSourceIdleDeferred(false)
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{true},currentSourceFaceAnchor:{.init(x:f.node.sourceBaseAnchorX,y:1-f.node.sourceBaseAnchorY)}))
        let old=try XCTUnwrap(f.node.visual.children.compactMap{$0 as? NativeIdleBubbleField}.first)
        XCTAssertEqual(draws,12);XCTAssertTrue(f.service.setSourceGlobalPaused(false))
        XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,1)
        f.service.deliver(wallMilliseconds:500)
        XCTAssertEqual(draws,36);XCTAssertNil(old.parent);XCTAssertFalse(old.isRunning)
        let replacement=try XCTUnwrap(f.node.visual.children.compactMap{$0 as? NativeIdleBubbleField}.first)
        XCTAssertFalse(replacement === old);XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,0)
        f.service.deliver(wallMilliseconds:516);XCTAssertEqual(draws,36)
        XCTAssertEqual(f.service.sourceAnimationSeconds,0.516,accuracy:1e-7,"Source ticker runs before the late restart; RAF is not a GSAP root")
    }


    func testRejectedOuterPrefixCancelsOnlyItsRAFAndKeepsReentrantAcceptedPrefix()async throws {
        var draws=0
        let f=try SourceWildSkinFixture(root:root,variant:"bottle",visualRandom:{draws+=1;return 0.5});defer{f.dispose()}
        XCTAssertTrue(f.scene.configureSourceSpecialIdle(scope:f.scope))
        let ready=expectation(description:"typed reentrant bottle");let native=f.node.onResourceReady;var done=false
        f.node.onResourceReady={native?();if f.node.sourceWildSkinReceiptCurrent,!done{done=true;ready.fulfill()}}
        XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{false}))
        await fulfillment(of:[ready],timeout:5);f.view.isPaused=true;f.node.setSourceIdleDeferred(false)
        let anchor:()->CGPoint? = {.init(x:f.node.sourceBaseAnchorX,y:1-f.node.sourceBaseAnchorY)}
        XCTAssertFalse(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{
            XCTAssertTrue(f.scene.repairSourceWildSkin(tileID:"skin",scope:f.scope,startSourceIdle:{true},currentSourceFaceAnchor:anchor))
            return false
        },currentSourceFaceAnchor:anchor))
        XCTAssertEqual(draws,24);XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,1)
        f.service.deliver(wallMilliseconds:16)
        XCTAssertEqual(draws,36);XCTAssertEqual(f.service.pendingSourceAnimationFrameCount,0)
        XCTAssertTrue(f.node.visual.children.contains{$0 is NativeIdleBubbleField})
    }
}
