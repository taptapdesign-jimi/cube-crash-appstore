# Remaining Native legacy storage transport

Status: active transport migrated to Foundation/SQLite; State36, connected SDK11
and full Source QA PASS. Current Release/complete SDK and physical compatibility
acceptance remain pending. Primary research and producer baseline below preceded
implementation; original WebKit exporter is archived in the narrow before snapshot.

Current importer reads only this Native sandbox's app://localhost origin, then
NativeHybridImporter validates the product and NativeSaveStore commits atomically.
No original localStorage bytes are changed. Preserve that boundary in replacement.
Never read the PWA sandbox or discard an unscoped/corrupt save to make boot pass.

Primary WebKit format research (2026-10-10; verify with actual runtime receipt):

- [SQLiteStorageArea.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/NetworkProcess/storage/SQLiteStorageArea.cpp): ItemTable uses text keys and blob values; actual value conversion goes through columnBlobAsString. A native SQL text cast is not evidence of correct Unicode decoding.
- [StorageUtilities.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/storage/StorageUtilities.cpp): modern origin identity is persisted ClientOrigin; directory names hash origin plus salt. Directory name or string-substring matches alone do not establish app://localhost identity.
- [WebCorePersistentCoders.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/WebCorePersistentCoders.cpp): ClientOrigin carries top and client origins; each encodes protocol/host/optional port. Require both exact origins.
- [PersistentCoders.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WTF/wtf/persistence/PersistentCoders.cpp): persisted strings carry length and 8-bit/16-bit representation.
- [WebsiteDataStoreCocoa.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/WebsiteData/Cocoa/WebsiteDataStoreCocoa.mm): named stores live under Library/WebKit/WebsiteDataStore/UUID, separating an actual producer test from the normal profile.

Prepared draft (outside target until the current complete SDK settles):
`/tmp/native-completion-20261010-evidence/NativeLegacyStorageProducerTests.swift`.
Creates a fresh named public WKWebsiteDataStore, on exact QA Simulator/.native only,
and two blank custom-scheme origins (localhost and foreign.invalid). Captures JSON
receipt plus actual origin/SQLite/WAL bytes, including a Unicode fixture. No normal
store, gameplay, original media, phone or PWA access. Draft has SDK type-check PASS (explicit XCTest Swift overlay). Initial direct type-check missed that overlay and failed before runtime; preserved logs. Linked32716/74691 PASS; baseline71331 failed only guessed unprefixed directory, preserving original/foreign JS receipts. Corrected87859 PASS2.172s. Actual modern origin files are46/58bytes; values are UTF16LE SQLite BLOBs and Unicode/emoji/NUL decoded correctly from an extracted private snapshot. See NativeLegacyStorageProducerValidation.json. Durable draft: NativeLegacyStorageProducerTests.draft.swift.

Next: validate actual producer receipt; then a Foundation/SQLite reader must prove
strict origin matching, Unicode, coherent WAL snapshot, bounded reads, ambiguous
origin rejection, corruption preservation, atomic Native save and repeated boot.
Compare source bytes before/after; never open the original SQLite read-write.
Only connected compatibility proof permits replacing NativeHybridExport's runtime.

## Connected target inventory (read-only)

Former active gameplay-app WebKit use: NativeHybridExport (now Foundation/SQLite),
owned by NativeBootstrap's requiresLegacyImport branch. Legacy jimi files have WebKit
adapters: JimiHomeHubController, JimiNativeWorldHost, bottom EndRun bridge in
JimiNativeEndRunModal, and WKScriptMessageHandlerWithReply extension in
JimiNativeMusic. Keep shared native view/audio owners and original source bytes;
classify bridge call sites/tests before any target exclusion or extraction.
Retiring one importer does not alone establish absence of shipping WebKit symbols.

Implementation constraints for the next reader (design only): recognize the modern
bounded origin directory hierarchy and exact older app_localhost_0.localstorage
name; parse the whole supported origin document, reject unsupported/trailing
format rather than searching bytes for localhost. Confirm format with producer
bytes before implementation. Both top/client tuples must equal app/localhost
with the expected port. Read source files into a bounded private snapshot and
verify stable source content before/after, including WAL; open only that snapshot
with SQLite read-only and validate key/value schema plus strict string decoding.
Retain empty/unscoped-profile rejection from the existing exporter. Keep canonical
allowed storage-key policy shared instead of introducing diverging filtering.
Do native atomic save only after full import validation; cancellation/late results
must not cross Bootstrap disposal. No original database repair, migration or deletion.


Compile-condition verification corrected the initial textual inventory: preserved
JimiHomeHubController/JimiNativeWorldHost/EndRun host are Debug fixtures under
DEBUG || !NATIVE_HYBRID_UI_RETIRED. Native music's script adapter is under
!NATIVE_MUSIC_DIRECT_ONLY. Both retirement flags are active for target Debug/Release;
DEBUG alone admits the old UI comparison fixtures in Debug. Do not remove shared
native view/audio owners or those fixtures based on an unfiltered import search.
Actual Release dependency/symbol verification is the next proof boundary.
