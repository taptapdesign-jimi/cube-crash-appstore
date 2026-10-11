import Foundation
import SQLite3

/// Read-only compatibility transport, independent of WebKit and JavaScript.
/// Callers supply only their own sandbox roots. Never opens source SQLite: a
/// bounded, stable file snapshot is queried privately, including pending WAL.
public enum NativeLegacyStorageReader {
    public enum ReadError: Error, Equatable {
        case missingProfile, ambiguousProfile, unsupportedOrigin, unsafePath
        case oversizedStorage, unstableStorage, invalidDatabase, invalidString, emptyExport, unscopedSave
    }
    private static let byteLimit=16*1024*1024
    private static let entryLimit=128
    private static let exactKeys:Set<String>=["cc_settings","cc_board_stats_v1","cc_arcade_stats_v1","cc_arcade_run_state_v1",
        "cc_arcade_pending_round_v1","journey_boards_state","journey_viewed_boards","journey_highest_unlocked_board_id",
        "journey_last_opened_board_id","journey_current_run_state","cc_special_dice_unlocked_flower",
        "cc_special_dice_unlocked_juice","cc_board_completed","cc_first_play_tutorial_done","cc_first_play_tutorial_force_next","cc_saved_game"]
    public static func allowsStorageKey(_ key:String)->Bool {
        if exactKeys.contains(key) {return true}
        for prefix in ["cc_saved_game_board_","cc_journey_completed_board_"] where key.hasPrefix(prefix) {
            let suffix=key.dropFirst(prefix.count)
            return !suffix.isEmpty && suffix.utf8.allSatisfy{(48...57).contains($0)}
        }
        return false
    }
    /// Known default-store locations from WebKit's platform path policy. Named
    /// QA stores are deliberately excluded. No external app discovery occurs.
    public static func export(libraryRoot:URL) throws -> Data {
        let product="com.taptapdesign.stacktosix.native"
        let websiteBases=["WebKit/WebsiteData","WebKit/\(product)/WebsiteData"]
        let modern=(websiteBases.map{$0+"/Default"} + ["Caches/WebKit/Storage","Caches/\(product)/WebKit/Storage"]).map{libraryRoot.appendingPathComponent($0,isDirectory:true)}
        let legacy=(websiteBases.map{$0+"/LocalStorage"} + ["Caches/WebKit/LocalStorage","Caches/\(product)/WebKit/LocalStorage","Application Support/WebKit/LocalStorage"]).map{libraryRoot.appendingPathComponent($0,isDirectory:true)}
        return try export(modernRoots:modern,legacyRoots:legacy)
    }
    public static func export(modernRoots:[URL],legacyRoots:[URL]=[]) throws -> Data {
        try Task.checkCancellation()
        var candidates:[URL]=[]
        var originReceipts:[String:(URL,Data)]=[:]
        for root in modernRoots where FileManager.default.fileExists(atPath:root.path) {
            try requireDirectory(root)
            for top in try children(root) {
                try Task.checkCancellation()
                guard try top.resourceValues(forKeys:[.isDirectoryKey]).isDirectory == true else {continue}
                try requireDirectory(top)
                for client in try children(top) {
                    try Task.checkCancellation()
                    guard try client.resourceValues(forKeys:[.isDirectoryKey]).isDirectory == true else {continue}
                    try requireDirectory(client)
                    let database=client.appendingPathComponent("LocalStorage/localstorage.sqlite3")
                    guard FileManager.default.fileExists(atPath:database.path) else {continue}
                    try requireDirectory(database.deletingLastPathComponent())
                    let origin=try boundedData(client.appendingPathComponent("origin"),limit:4096)
                    if try isOriginalOrigin(origin) {
                        candidates.append(database)
                        originReceipts[database.standardizedFileURL.path]=(client.appendingPathComponent("origin"),origin)
                    }
                }
            }
        }
        for root in legacyRoots where FileManager.default.fileExists(atPath:root.path) {
            try requireDirectory(root)
            let database=root.appendingPathComponent("app_localhost_0.localstorage")
            if FileManager.default.fileExists(atPath:database.path) {candidates.append(database)}
        }
        candidates=Array(Dictionary(grouping:candidates,by:{$0.standardizedFileURL.path}).values.compactMap(\.first))
        guard candidates.count==1 else {throw candidates.isEmpty ? ReadError.missingProfile:ReadError.ambiguousProfile}
        let storage=try readStableSnapshot(candidates[0],origin:originReceipts[candidates[0].standardizedFileURL.path])
        guard !storage.isEmpty else {throw ReadError.emptyExport}
        if storage["cc_saved_game"] != nil && !storage.keys.contains(where:{$0.hasPrefix("cc_saved_game_board_") || $0=="cc_arcade_run_state_v1"}) {throw ReadError.unscopedSave}
        return try JSONSerialization.data(withJSONObject:["product":"com.taptapdesign.stacktosix.native","storage":storage],options:[.sortedKeys])
    }
    /// Strict supported persistence format: two protocol/host/optional-port
    /// tuples, no trailing bytes. Verified against actual iOS producer receipts.
    static func isOriginalOrigin(_ data:Data) throws -> Bool {
        let bytes=Array(data);var offset=0
        func byte() throws -> UInt8 {guard offset<bytes.count else {throw ReadError.unsupportedOrigin};defer{offset+=1};return bytes[offset]}
        func number(_ count:Int) throws -> UInt32 {
            var result:UInt32=0
            for shift in 0..<count {result |= UInt32(try byte()) << (shift*8)}
            return result
        }
        func string() throws -> String {
            let count=Int(try number(4)),eight=try byte()
            guard count<=4096,eight<=1 else {throw ReadError.unsupportedOrigin}
            let length=count*(eight==1 ? 1:2)
            guard length<=bytes.count-offset else {throw ReadError.unsupportedOrigin}
            let raw=Data(bytes[offset..<offset+length]);offset+=length
            guard let result=String(data:raw,encoding:eight==1 ? .isoLatin1:.utf16LittleEndian) else {throw ReadError.unsupportedOrigin}
            return result
        }
        func origin() throws -> (String,String,UInt32?) {
            let scheme=try string(),host=try string(),present=try byte()
            guard present<=1 else {throw ReadError.unsupportedOrigin}
            return (scheme,host,present==1 ? try number(2):nil)
        }
        let top=try origin(),client=try origin()
        guard offset==bytes.count else {throw ReadError.unsupportedOrigin}
        return top.0=="app" && top.1=="localhost" && top.2==nil && client.0=="app" && client.1=="localhost" && client.2==nil
    }
    private static func requireDirectory(_ url:URL) throws {
        let values=try url.resourceValues(forKeys:[.isDirectoryKey,.isSymbolicLinkKey])
        guard values.isDirectory==true,values.isSymbolicLink != true else {throw ReadError.unsafePath}
    }
    private static func children(_ url:URL) throws -> [URL] {
        let entries=try FileManager.default.contentsOfDirectory(at:url,includingPropertiesForKeys:[.isDirectoryKey,.isSymbolicLinkKey],options:[.skipsHiddenFiles])
        guard entries.count<=entryLimit else {throw ReadError.oversizedStorage};return entries
    }
    private static func boundedData(_ url:URL,limit:Int=byteLimit) throws -> Data {
        try Task.checkCancellation()
        let values=try url.resourceValues(forKeys:[.isRegularFileKey,.isSymbolicLinkKey,.fileSizeKey])
        guard values.isRegularFile==true,values.isSymbolicLink != true else {throw ReadError.unsafePath}
        guard (values.fileSize ?? limit+1)<=limit else {throw ReadError.oversizedStorage}
        let file=try FileHandle(forReadingFrom:url);defer{try? file.close()}
        let data=try file.read(upToCount:limit+1) ?? Data()
        guard data.count<=limit else {throw ReadError.oversizedStorage};return data
    }
    private static func capture(_ database:URL) throws -> [String:Data] {
        let main=try boundedData(database)
        guard main.prefix(16)==Data("SQLite format 3\0".utf8) else {throw ReadError.invalidDatabase}
        var files=[database.lastPathComponent:main]
        let wal=URL(fileURLWithPath:database.path+"-wal")
        if FileManager.default.fileExists(atPath:wal.path) {files[wal.lastPathComponent]=try boundedData(wal)}
        let journal=URL(fileURLWithPath:database.path+"-journal")
        if FileManager.default.fileExists(atPath:journal.path),!(try boundedData(journal)).isEmpty {throw ReadError.unstableStorage}
        return files
    }
    private static func readStableSnapshot(_ database:URL,origin:(URL,Data)?) throws -> [String:String] {
        func originUnchanged() throws -> Bool {
            guard let origin else{return true}
            return try boundedData(origin.0,limit:4096)==origin.1
        }
        for _ in 0..<3 {
            try Task.checkCancellation()
            guard try originUnchanged() else {throw ReadError.unstableStorage}
            let before=try capture(database)
            let directory=FileManager.default.temporaryDirectory.appendingPathComponent("native-legacy-read-\(UUID().uuidString)",isDirectory:true)
            try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
            defer{try? FileManager.default.removeItem(at:directory)}
            for (name,bytes) in before {try bytes.write(to:directory.appendingPathComponent(name),options:.atomic)}
            guard before == (try capture(database)),try originUnchanged() else {continue}
            let storage=try query(directory.appendingPathComponent(database.lastPathComponent))
            guard before == (try capture(database)),try originUnchanged() else {continue}
            return storage
        }
        throw ReadError.unstableStorage
    }
    private static func query(_ database:URL) throws -> [String:String] {
        var handle:OpaquePointer?
        guard sqlite3_open_v2(database.path,&handle,SQLITE_OPEN_READONLY|SQLITE_OPEN_NOMUTEX,nil)==SQLITE_OK,let handle else {
            if let handle {sqlite3_close(handle)};throw ReadError.invalidDatabase
        }
        defer{sqlite3_close(handle)}
        try validateSchema(handle)
        var statement:OpaquePointer?
        guard sqlite3_prepare_v2(handle,"SELECT key,value FROM ItemTable",-1,&statement,nil)==SQLITE_OK,let statement else {throw ReadError.invalidDatabase}
        defer{sqlite3_finalize(statement)}
        var result:[String:String]=[:],count=0
        while true {
            try Task.checkCancellation()
            let status=sqlite3_step(statement)
            if status==SQLITE_DONE {break}
            guard status==SQLITE_ROW else {throw ReadError.invalidDatabase}
            count+=1;guard count<=4096,sqlite3_column_type(statement,0)==SQLITE_TEXT else {throw ReadError.invalidDatabase}
            let keyCount=Int(sqlite3_column_bytes(statement,0))
            guard keyCount<=4096,let keyPointer=sqlite3_column_text(statement,0),
                  let key=String(data:Data(bytes:keyPointer,count:keyCount),encoding:.utf8) else {throw ReadError.invalidString}
            guard allowsStorageKey(key) else {continue}
            guard result[key]==nil,sqlite3_column_type(statement,1)==SQLITE_BLOB else {throw ReadError.invalidDatabase}
            let valueCount=Int(sqlite3_column_bytes(statement,1))
            guard valueCount<=byteLimit,valueCount%2==0 else {throw ReadError.invalidString}
            let data:Data
            if valueCount==0 {data=Data()} else {
                guard let pointer=sqlite3_column_blob(statement,1) else {throw ReadError.invalidString}
                data=Data(bytes:pointer,count:valueCount)
            }
            guard let value=String(data:data,encoding:.utf16LittleEndian) else {throw ReadError.invalidString}
            result[key]=value
        }
        return result
    }
    private static func validateSchema(_ handle:OpaquePointer) throws {
        var statement:OpaquePointer?
        guard sqlite3_prepare_v2(handle,"SELECT type FROM sqlite_master WHERE name='ItemTable'",-1,&statement,nil)==SQLITE_OK,let typeStatement=statement else {throw ReadError.invalidDatabase}
        defer{sqlite3_finalize(typeStatement)}
        guard sqlite3_step(typeStatement)==SQLITE_ROW,let type=sqlite3_column_text(typeStatement,0),String(cString:type)=="table",sqlite3_step(typeStatement)==SQLITE_DONE else {throw ReadError.invalidDatabase}
        statement=nil
        guard sqlite3_prepare_v2(handle,"PRAGMA table_info('ItemTable')",-1,&statement,nil)==SQLITE_OK,let columns=statement else {throw ReadError.invalidDatabase}
        defer{sqlite3_finalize(columns)}
        for (name,type,required) in [("key","TEXT",Int32(0)),("value","BLOB",Int32(1))] {
            guard sqlite3_step(columns)==SQLITE_ROW,let actualName=sqlite3_column_text(columns,1),let actualType=sqlite3_column_text(columns,2),String(cString:actualName)==name,String(cString:actualType).uppercased()==type,sqlite3_column_int(columns,3)==required else {throw ReadError.invalidDatabase}
        }
        guard sqlite3_step(columns)==SQLITE_DONE else {throw ReadError.invalidDatabase}
    }

}
