import Foundation

/// Immutable counterpart of journey-v700-motion.ts; one view owns its application.
enum JimiNativeWorldMotion {
    static func enterOffsets(ids: [String], reduced: Bool) -> [Double] {
        let raw = ids.enumerated().map { index,id -> Double in
            if index == 0 || id.contains("main") {return 0}
            if reduced {return min(0.06,Double(index)*0.006)}
            var hash: UInt32 = 2166136261
            for character in id.utf16 {hash ^= UInt32(character); hash = hash &* 16777619}
            return 0.035 + Double(hash)/4294967295*0.185
        }
        guard !reduced else {return raw}
        let ordered = raw.indices.filter {raw[$0]>0}.sorted {raw[$0] == raw[$1] ? $0<$1 : raw[$0]<raw[$1]}
        let collision = zip(ordered.dropFirst(),ordered).contains {raw[$0.0]-raw[$0.1]<1/60}
        guard collision,ordered.count>1 else {return raw}
        var resolved = raw
        for (rank,index) in ordered.enumerated() {resolved[index] = 0.035 + Double(rank)*0.185/Double(ordered.count-1)}
        return resolved
    }
}
