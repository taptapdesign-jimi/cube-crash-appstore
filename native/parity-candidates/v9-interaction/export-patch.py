from pathlib import Path
import subprocess, difflib, json, hashlib
base='9a90908cd3b6b9dabe15d8b2df494414c2e65519'
packet=Path(__file__).resolve().parent
repo=packet.parents[2]
frozen=Path('/tmp/native-interaction-repair')
paths=['native/gameplay-app/NativeAppController.swift','native/gameplay-app/NativeRouteMotion.swift','native/jimi-2026/JimiV9HomeView.swift','native/gameplay-ui/NativeRegularDropTarget.swift','native/gameplay-ui/NativeBoardScene.swift','native/gameplay-ui/NativeDiceNode.swift','native/gameplay-ui/NativeDiceArtwork.swift','native/standalone/Stack to SixTests/NativeInteractionRepairTests.swift','native/standalone/Stack to SixUITests/NativeHomeInteractionUITests.swift']
patch=''; manifest={}
for rel in paths:
    result=subprocess.run(['git','show',base+':'+rel],cwd=repo,capture_output=True)
    old=result.stdout.decode() if result.returncode==0 else ''
    new=(frozen/rel).read_text()
    if old==new: continue
    patch+='diff --git a/'+rel+' b/'+rel+'\n'
    if not old: patch+='new file mode 100644\n'
    patch+=''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/'+rel if old else '/dev/null',tofile='b/'+rel))
    manifest[rel]={'baseSHA256':hashlib.sha256(old.encode()).hexdigest() if old else None,'candidateSHA256':hashlib.sha256(new.encode()).hexdigest()}
(packet/'interaction-repair.patch').write_text(patch)
(packet/'source-manifest.json').write_text(json.dumps({'baseCommit':base,'files':manifest},indent=2)+'\n')
print('Scoped patch:',len(manifest),'files')
