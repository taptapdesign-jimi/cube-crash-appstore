import Foundation

/// Dedicated Wild/Special cues through the existing bounded Settings-gated transport.
@MainActor enum NativeBloobBallAudio {
    private static let base="assets/sound/Wild and special kockice/bloob ball/"
    nonisolated static let popSource="assets/sound/CTA/poping.wav"
    static func barrelLayer(_ group:String)->[NativeAudioCue] {
        (NativeAuthoredAudioCatalog.groups[group] ?? []).filter {$0.voice != "barrel-merge6-tnt3"}.map {
            var gain=$0.gain*0.5
            if $0.voice == "regular-merge6-boom" {gain=0.5}
            return NativeAudioCue(source:$0.source,voice:"bloob-gas-"+$0.voice,gain:gain,rate:$0.rate,
                delay:$0.delay,stopAfter:$0.stopAfter,fadeOut:$0.fadeOut)
        }
    }
    static func cues(_ moment:String,index:Int=0)->[NativeAudioCue] {
        func cue(_ file:String,_ gain:Double,_ delay:Double=0,_ stop:Double?=nil)->NativeAudioCue {
            NativeAudioCue(source:base+file+".wav",voice:"bloob-ball-\(moment)-\(index)-\(file)",gain:gain,delay:delay,stopAfter:stop,fadeOut:stop == nil ? 0:0.12)
        }
        let pop=NativeAudioCue(source:popSource,voice:"bloob-ball-\(moment)-pop-\(index)",gain:0.6)
        switch moment {
        case "pop":return [pop]
        case "smoke":return barrelLayer("barrelSmoke")+cues("burst",index:index)
        case "merge":return barrelLayer("barrel")+[cue("massive gas leak",0.6),NativeAudioCue(source:"assets/sound/Wild and special kockice/gun/beam1.wav",voice:"bloob-ball-merge-beam1",gain:0.4284)]
        case "rise":return [cue("radio break",0.6*0.3),cue("air",0.6)]
        case "burst":return [pop,cue("bum puf",0.6),cue("splat",0.6*0.7),NativeAudioCue(source:"assets/sound/Wild and special kockice/juice/mini2.mp3",voice:"bloob-ball-boing-\(index)",gain:0.39,delay:0.09)]
        default:return []
        }
    }
    nonisolated static var sources:[String] {
        ["splat","radio break","air","bum puf","massive gas leak"].map{"assets/sound/Wild and special kockice/bloob ball/"+$0+".wav"}+["assets/sound/Wild and special kockice/juice/mini2.mp3","assets/sound/Wild and special kockice/gun/beam1.wav",popSource]
    }
}
