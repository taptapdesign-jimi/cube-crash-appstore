#!/usr/bin/env python3
"""Reproduce the 114 approved-order voice derivatives; never rewrite the supplied MP3.
Requires numpy. Uses macOS afconvert only to decode the original to temporary PCM.
"""
import hashlib, json, re, subprocess, tempfile, wave
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/sound/Clean board/voice/clean board titles.mp3'
DEST = ROOT / 'assets/sound/Clean board/voice/titles-v1'
CUTS = ROOT / 'docs/audio/clean-board-title-voice-cuts-v1.json'
RATE = 48000
EXPECTED_SOURCE_SHA256 = "15e8f094875070026adcfa6cb6cfabc10f20a32e3ecb208fc46b6cef3ceba32e"

def main():
    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert source_hash == EXPECTED_SOURCE_SHA256, 'Source differs from the aligned original; do not reuse these cut times.'
    cuts = json.loads(CUTS.read_text())
    swift = (ROOT / 'native/gameplay-results/NativeResultHeadlines.swift').read_text()
    names = json.loads(re.search(r'static let clean:\[String\]=(\[.*?\])', swift).group(1))
    assert [c['title'] for c in cuts] == names
    with tempfile.TemporaryDirectory(prefix='clean-title-pcm-') as directory:
        decoded = Path(directory) / 'source.wav'
        subprocess.run(['afconvert', str(SOURCE), str(decoded), '-f', 'WAVE', '-d', 'LEI16@48000', '-c', '1'], check=True)
        with wave.open(str(decoded)) as wav:
            assert wav.getframerate() == RATE and wav.getnchannels() == 1
            samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').astype(np.float64) / 32768
    DEST.mkdir(parents=True, exist_ok=True)
    report = []
    for cut in cuts:
        x = samples[round(cut['start'] * RATE):round(cut['end'] * RATE)].copy()
        assert 0.3 < len(x) / RATE < 2
        x -= np.mean(x)
        hop = 240
        rms = np.sqrt(np.mean(x[:len(x)//hop*hop].reshape(-1, hop)**2, axis=1))
        active = rms[rms > max(10**(-38/20), rms.max()*10**(-26/20))]
        level = np.sqrt(np.mean(active**2))
        gain = min(10**(-18/20)/level, 10**(-3/20)/np.max(np.abs(x)))
        x *= gain
        fade = round(0.003 * RATE)
        x[:fade] *= np.linspace(0, 1, fade)
        x[-fade:] *= np.linspace(1, 0, fade)
        pcm = np.rint(x * 32767).clip(-32767, 32767).astype('<i2')
        dest = DEST / cut['file']
        with wave.open(str(dest), 'wb') as wav:
            wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(RATE); wav.writeframes(pcm.tobytes())
        report.append({**cut, 'source': str(dest.relative_to(ROOT)), 'gainDb': round(20*np.log10(gain), 3),
            'peakDbFS': round(20*np.log10(np.max(np.abs(pcm.astype(float)))/32768), 3),
            'dc': float(pcm.astype(float).mean()/32768), 'sha256': hashlib.sha256(dest.read_bytes()).hexdigest()})
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == source_hash
    (ROOT / 'docs/audio/clean-board-title-voices-v1.json').write_text(json.dumps({
        'original': str(SOURCE.relative_to(ROOT)), 'originalSha256': source_hash,
        'format': '48000 Hz mono PCM16 WAV', 'processing': 'DC removal; active speech RMS target -18 dBFS, peak ceiling -3 dBFS; 3 ms edge fades; original speed and pitch',
        'alignment': 'User-confirmed order; local speech timestamps aligned to exact Native titles, refined to silent valleys; all inter-title boundaries below -55 dBFS RMS. Boom and puns checked in focused source ranges.',
        'clips': report}, indent=2, ensure_ascii=False)+'\n')
    lines=['// Generated from docs/audio/clean-board-title-voices-v1.json by the preparation script.',
        'enum NativeCleanBoardTitleVoice {', '    struct Entry {let title:String;let source:String}', '    static let entries:[Entry] = [']
    for c in report:
        lines.append('        Entry(title:'+json.dumps(c['title'],ensure_ascii=False)+',source:'+json.dumps(c['source'])+'),')
    lines += ['    ]', '    static func cue(index:Int)->NativeAudioCue? {',
        '        guard entries.indices.contains(index),NativeResultHeadlines.clean.indices.contains(index),',
        '              entries[index].title==NativeResultHeadlines.clean[index] else{return nil}',
        '        return NativeAudioCue(source:entries[index].source,voice:"native-clean-title",gain:0.9064262964918004)',
        '    }', '}']
    (ROOT/'native/gameplay-results/NativeCleanBoardTitleVoice.swift').write_text('\n'.join(lines)+'\n')
    subprocess.run(['python3', str(ROOT / 'scripts/boost-clean-board-title-voices.py')], check=True)
    print(f'PASS {len(report)} voice clips; original preserved {source_hash}; normalized speech, no clipped samples.')
if __name__ == '__main__': main()
