import Foundation

/// BLOOB-owned voices borrow the existing bounded, Settings-gated transport.
nonisolated enum NativeBloobAudio {
    private static let base="assets/sound/Wild and special kockice/bloob ball/"
    private static let area="assets/sound/Board transitions/Area 55/"
    static func cues(_ moment:String,index:Int=0)->[NativeAudioCue] {
        func cue(_ path:String,_ gain:Double,_ delay:Double=0)->NativeAudioCue {
            NativeAudioCue(source:path,voice:"bloob-\(moment)-\(index)-\(path)",gain:gain,delay:delay)
        }
        switch moment {
        // Standard committed Star/merge-six layers are already played by the
        // shared owner. Splat uses120percent of its existing0.42 gain.
        case "merge":return [cue(base+"splat.wav",0.504),cue(base+"paint splat.wav",0.6)]
        case "rise":return [cue(area+"djeca.wav",0.84),cue(area+"beams.wav",0.45,0.4)]
        default:return []
        }
    }
    static var sources:[String] {cues("merge").map(\.source)+cues("rise").map(\.source)}
}
