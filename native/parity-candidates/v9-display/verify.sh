#!/bin/zsh
set -euo pipefail
packetRoot="${0:A:h}"
repoRoot="${packetRoot:h:h:h}"
probeRoot=$(mktemp -d /tmp/native-secondary-display.XXXXXX)
cd "$repoRoot"
node "$packetRoot/export-geometry.cjs"
node "$packetRoot/export-multiplier.cjs"
node "$packetRoot/export-no-moves.cjs" > "$probeRoot/no-moves-export.log" 2>&1
node "$packetRoot/export-no-moves-clouds.cjs" > "$probeRoot/cloud-export.log" 2>&1
macCache=/tmp/native-hud-motion-draft/module-cache
if [[ ! -d "$macCache" ]]; then macCache="$probeRoot/mac-cache"; fi
cp "$packetRoot/geometry-main.swift" "$probeRoot/main.swift"
swiftc -module-cache-path "$macCache" "$packetRoot/GeometryCheck.swift" "$probeRoot/main.swift" -o "$probeRoot/geometry"
"$probeRoot/geometry" "$packetRoot/geometry-oracle.json"
cp "$packetRoot/no-moves-main.swift" "$probeRoot/main.swift"
swiftc -module-cache-path "$macCache" "$packetRoot/NativeNoMovesPlan.swift" "$probeRoot/main.swift" -o "$probeRoot/no-moves"
"$probeRoot/no-moves" "$packetRoot/no-moves-oracle.json"
cp "$packetRoot/cloud-main.swift" "$probeRoot/main.swift"
swiftc -module-cache-path "$macCache" "$packetRoot/NativeNoMovesPlan.swift" "$packetRoot/NativeNoMovesCloudPlan.swift" "$probeRoot/main.swift" -o "$probeRoot/clouds"
"$probeRoot/clouds" "$packetRoot/no-moves-cloud-oracle.json"
if [[ $# -eq 0 ]]; then
  print 'PASS source/math probes. Supply an already-booted QA Simulator UUID for UIKit/SpriteKit probes.'
  exit 0
fi
simulatorID="$1"
simSdk=$(xcrun --sdk iphonesimulator --show-sdk-path)
simCache=/tmp/native-v9-parity/ModuleCache.noindex
if [[ ! -d "$simCache" ]]; then simCache="$probeRoot/simulator-cache"; fi
compileProbe() {
  local probeName="$1"
  shift
  cp "$packetRoot/${probeName}-check.swift" "$probeRoot/main.swift"
  SDKROOT="$simSdk" xcrun swiftc -target arm64-apple-ios26.0-simulator -sdk "$simSdk" -module-cache-path "$simCache" "$@" "$probeRoot/main.swift" -o "$probeRoot/$probeName"
  xcrun simctl spawn "$simulatorID" "$probeRoot/$probeName"
}
compileProbe badge "$packetRoot/NativeRegularSixMultiplierGlyph.swift"
compileProbe display "$packetRoot/NativeNoMovesPlan.swift" "$packetRoot/NativeNoMovesCloudPlan.swift" "$packetRoot/NativeNoMovesPresentation.swift"
compileProbe carrier "$repoRoot/native/gameplay-ordinary-six/NativeRegularSixFxPlan.swift" "$repoRoot/native/gameplay-ordinary-six/NativeRegularShardTemplates.swift" "$packetRoot/NativeRegularSixMultiplierGlyph.swift" "$packetRoot/NativeRegularSixSpritePresentation.candidate.swift"
print "PASS isolated display package. Probe artifacts: $probeRoot"
