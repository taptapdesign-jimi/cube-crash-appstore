import Foundation

/// Failure-only evidence, separate from gameplay saves. Nothing reads or decodes
/// this file during startup, board entry, rendering or normal navigation.
@MainActor enum NativeSourceRejectionDiagnostics {
    struct Entry:Codable,Equatable {
        let time:Date
        let reason:String
        let generation:UInt64
        let board:Int
        let mode:String
        let phase:String
        let counters:[String:Int]
        let details:[String:String]?
        init(time:Date=Date(),reason:String,generation:UInt64,board:Int,mode:String,phase:String,counters:[String:Int]=[:],details:[String:String]=[:]) {
            self.time=time;self.reason=String(reason.prefix(192));self.generation=generation
            self.board=board;self.mode=String(mode.prefix(32));self.phase=String(phase.prefix(96))
            var bounded:[String:Int]=[:]
            for key in counters.keys.sorted().prefix(12) {bounded[String(key.prefix(32))]=counters[key]}
            self.counters=bounded
            var context:[String:String]=[:]
            for key in details.keys.sorted().prefix(6) {context[String(key.prefix(32))]=String((details[key] ?? "").prefix(1024))}
            self.details=context.isEmpty ? nil:context
        }
        fileprivate var bounded:Self {.init(time:time,reason:reason,generation:generation,board:board,mode:mode,phase:phase,counters:counters,details:details ?? [:])}
    }
    static let maximumEntries=8
    static let maximumBytes=65_536
    static var fileURL:URL {
        FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0]
            .appendingPathComponent("NativeDiagnostics",isDirectory:true)
            .appendingPathComponent("source-rejections.json")
    }
    /// Synchronous atomic write only at the rejected-phase failure boundary.
    /// Failure to write evidence never changes recovery or gameplay behavior.
    @discardableResult static func record(_ entry:Entry,to url:URL?=nil)->Bool {
        let destination=url ?? fileURL
        var entries=read(from:destination)
        entries.append(entry.bounded);entries=Array(entries.suffix(maximumEntries))
        do {
            var data=try JSONEncoder().encode(entries)
            // Unicode can occupy several bytes per character. Retain the newest
            // event even when maximal detail payloads require fewer than eight.
            while data.count>maximumBytes,entries.count>1 {
                entries.removeFirst();data=try JSONEncoder().encode(entries)
            }
            guard data.count<=maximumBytes else{return false}
            try FileManager.default.createDirectory(at:destination.deletingLastPathComponent(),withIntermediateDirectories:true)
            try data.write(to:destination,options:.atomic)
            return true
        } catch {return false}
    }
    /// Explicit incident inspection; oversized/corrupt evidence is discarded.
    static func read(from url:URL)->[Entry] {
        guard let handle=try? FileHandle(forReadingFrom:url) else{return []}
        defer{try? handle.close()}
        guard let data=try? handle.read(upToCount:maximumBytes+1),data.count<=maximumBytes,
              let entries=try? JSONDecoder().decode([Entry].self,from:data) else{return []}
        return entries.suffix(maximumEntries).map(\.bounded)
    }
}
