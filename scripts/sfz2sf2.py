#!/usr/bin/env python3
"""Convert an SFZ instrument to a single-preset SoundFont 2 (.sf2) that AVAudioUnitSampler can load.

Usage: sfz2sf2.py INPUT.sfz OUTPUT.sf2 "Preset name" [--copyright TEXT] [--comment TEXT]

Supported: #define / #include, <control>/<global>/<master>/<group>/<region> inheritance, key / velocity
ranges, pitch_keycenter, tune / transpose, volume / group_volume, pan, cutoff, amp envelope
(attack / hold / decay / sustain / release), loops (opcodes or smpl metadata in FLAC / WAV), stereo samples.
Skipped regions: release triggers, CC-conditioned regions (pedal resonance…), keyswitches, round-robins > 1.
Samples are decoded with macOS `afconvert` to 16-bit PCM.
"""
import argparse
import math
import os
import re
import struct
import subprocess
import sys
import tempfile
import wave

NOTE_NAMES = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}


def note_number(value: str) -> int:
    """SFZ note: integer or name like c4, f#3, eb2 (c4 = 60)."""
    value = value.strip().lower()
    if re.fullmatch(r'-?\d+', value):
        return int(value)
    m = re.fullmatch(r'([a-g])([#b]?)(-?\d+)', value)
    if not m:
        raise ValueError(f'bad note {value!r}')
    semitone = NOTE_NAMES[m.group(1)] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0)
    return (int(m.group(3)) + 1) * 12 + semitone


# ---------------------------------------------------------------------------------------------- SFZ parsing

def preprocess(path: str, defines: dict) -> str:
    """Expands #define / #include (relative to the including file) and strips // comments."""
    out = []
    base = os.path.dirname(path)
    with open(path, encoding='utf-8', errors='replace') as f:
        for raw in f:
            line = raw.split('//', 1)[0].rstrip()
            # Read definitions before substituting, or `#define $X …` would get its own name replaced.
            m = re.match(r'#define\s+(\$\w+)\s+(.*)', line.strip())
            if m:
                defines[m.group(1)] = m.group(2).strip()
                continue
            for name in sorted(defines, key=len, reverse=True):
                line = line.replace(name, defines[name])
            stripped = line.strip()
            m = re.match(r'#include\s+"([^"]+)"', stripped)
            if m:
                out.append(preprocess(os.path.join(base, m.group(1)), defines))
                continue
            out.append(line)
    return '\n'.join(out)


def parse_regions(sfz_path: str):
    text = preprocess(sfz_path, {})
    scopes = {'control': {}, 'global': {}, 'master': {}, 'group': {}}
    regions = []
    current = None
    for line in text.splitlines():
        for token in re.split(r'(<\w+>)', line):
            header = re.fullmatch(r'<(\w+)>', token.strip())
            if header:
                name = header.group(1)
                if name == 'region':
                    current = {}
                    regions.append((dict(scopes['global'], **scopes['master'], **scopes['group']), current))
                elif name in scopes:
                    # A new scope resets the narrower ones.
                    order = ['control', 'global', 'master', 'group']
                    for s in order[order.index(name):]:
                        scopes[s] = {}
                    current = scopes[name]
                else:
                    current = {}  # <curve>, <effect>… : ignored
                continue
            if current is None:
                continue
            matches = list(re.finditer(r'([A-Za-z_][A-Za-z0-9_]*)=', token))
            for i, m in enumerate(matches):
                end = matches[i + 1].start() if i + 1 < len(matches) else len(token)
                current[m.group(1)] = token[m.end():end].strip()
    return regions


def load_regions(sfz_path: str):
    """Returns the merged opcodes of each playable region."""
    text = preprocess(sfz_path, {})
    default_path = ''
    m = re.search(r'default_path=(\S+)', text)
    if m:
        default_path = m.group(1)
    result = []
    for inherited, own in parse_regions(sfz_path):
        r = dict(inherited, **own)
        if 'sample' not in r:
            continue
        if r.get('trigger', 'attack') != 'attack':
            continue
        if any(k.startswith(('locc', 'hicc', 'sw_')) for k in r):
            continue
        if int(r.get('seq_position', '1')) > 1:
            continue
        sample = r['sample'].replace('\\', '/')
        r['_path'] = os.path.normpath(os.path.join(os.path.dirname(sfz_path), default_path, sample))
        result.append(r)
    return result


# ------------------------------------------------------------------------------------------------- Samples

def flac_loop(path: str):
    """Loop points stored as a RIFF smpl chunk in a FLAC APPLICATION 'riff' block (or a WAV smpl chunk)."""
    data = open(path, 'rb').read()
    j = data.find(b'smpl')
    if j < 0:
        return None
    body = data[j + 8:]
    if len(body) < 36:
        return None
    (count,) = struct.unpack('<I', body[28:32])
    if count < 1 or len(body) < 60:
        return None
    _, _, start, end, _, _ = struct.unpack('<IIIIII', body[36:60])
    return start, end


class Sample:
    def __init__(self, path: str, tmp: str):
        out = os.path.join(tmp, f'{abs(hash(path))}.wav')
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16', path, out], check=True)
        with wave.open(out) as w:
            self.rate = w.getframerate()
            self.channels = w.getnchannels()
            frames = w.readframes(w.getnframes())
        self.frames = len(frames) // (2 * self.channels)
        samples = struct.unpack(f'<{len(frames) // 2}h', frames)
        self.data = [samples[c::self.channels] for c in range(self.channels)]
        self.loop = flac_loop(path)


# ----------------------------------------------------------------------------------------------- SF2 write

GEN = dict(initialFilterFc=8, pan=17, attackVolEnv=34, holdVolEnv=35, decayVolEnv=36, sustainVolEnv=37,
           releaseVolEnv=38, instrument=41, keyRange=43, velRange=44, initialAttenuation=48,
           coarseTune=51, fineTune=52, sampleID=53, sampleModes=54, overridingRootKey=58)


def timecents(seconds: float) -> int:
    return -12000 if seconds <= 0.001 else max(-12000, min(8000, round(1200 * math.log2(seconds))))


def chunk(tag: bytes, payload: bytes) -> bytes:
    pad = b'\0' if len(payload) % 2 else b''
    return tag + struct.pack('<I', len(payload)) + payload + pad


def name20(s: str) -> bytes:
    return s.encode('ascii', 'replace')[:19].ljust(20, b'\0')


def zstr(s: str) -> bytes:
    b = s.encode('ascii', 'replace') + b'\0'
    return b + (b'\0' if len(b) % 2 else b'')


def region_generators(r: dict, sample: Sample, channel_pan: int | None):
    def f(key, default):
        return float(r.get(key, default))

    lo = note_number(r.get('lokey', r.get('key', '0')))
    hi = note_number(r.get('hikey', r.get('key', '127')))
    root = note_number(r.get('pitch_keycenter', r.get('key', '60')))
    gens = [(GEN['keyRange'], ('range', lo, hi)),
            (GEN['velRange'], ('range', int(r.get('lovel', 1)), int(r.get('hivel', 127))))]
    add = gens.append

    volume = f('volume', 0) + f('group_volume', 0)
    if volume < 0:
        add((GEN['initialAttenuation'], round(-volume * 10)))
    pan = channel_pan if channel_pan is not None else round(f('pan', 0) * 5)
    if pan:
        add((GEN['pan'], max(-500, min(500, pan))))
    if 'cutoff' in r:
        add((GEN['initialFilterFc'], max(1500, min(13500, round(1200 * math.log2(f('cutoff', 20000) / 8.176))))))
    if int(r.get('transpose', 0)):
        add((GEN['coarseTune'], int(r['transpose'])))
    if f('tune', 0):
        add((GEN['fineTune'], max(-99, min(99, round(f('tune', 0))))))
    for opcode, gen in (('ampeg_attack', 'attackVolEnv'), ('ampeg_hold', 'holdVolEnv'),
                        ('ampeg_decay', 'decayVolEnv'), ('ampeg_release', 'releaseVolEnv')):
        if opcode in r:
            add((GEN[gen], timecents(f(opcode, 0))))
    if 'ampeg_sustain' in r:
        level = f('ampeg_sustain', 100) / 100
        add((GEN['sustainVolEnv'], 1440 if level <= 0.0001 else min(1440, round(-200 * math.log10(level)))))
    loop_mode = r.get('loop_mode', 'loop_continuous' if sample.loop else 'no_loop')
    if loop_mode in ('loop_continuous', 'loop_sustain') and (sample.loop or 'loop_end' in r):
        add((GEN['sampleModes'], 1 if loop_mode == 'loop_continuous' else 3))
    add((GEN['overridingRootKey'], root))
    return gens


def write_sf2(regions, out_path: str, preset_name: str, copyright: str, comment: str):
    tmp = tempfile.mkdtemp()
    samples: dict[str, Sample] = {}
    for r in regions:
        if r['_path'] not in samples:
            samples[r['_path']] = Sample(r['_path'], tmp)
            print(f'  decoded {os.path.basename(r["_path"])}', file=sys.stderr)

    # Sample pool: one SF2 sample per channel.
    smpl = bytearray()
    shdr = bytearray()
    sample_ids: dict[tuple[str, int], int] = {}
    for path, s in samples.items():
        ids = []
        for c in range(s.channels):
            start = len(smpl) // 2
            smpl += struct.pack(f'<{len(s.data[c])}h', *s.data[c]) + b'\0' * 92  # 46 zero samples of padding
            end = start + s.frames
            ls, le = s.loop if s.loop else (0, s.frames - 1)
            ids.append(len(shdr) // 46)
            shdr += struct.pack('<20sIIIIIBbHH', name20(f'{os.path.basename(path)[:16]}-{c}'),
                                start, end, start + ls, start + min(le, s.frames - 1), s.rate, 60, 0, 0, 1)
            sample_ids[(path, c)] = ids[-1]
        if s.channels == 2:  # link left (type 4) and right (type 2)
            left, right = ids
            for idx, link, kind in ((left, right, 4), (right, left, 2)):
                off = idx * 46 + 42
                shdr[off:off + 4] = struct.pack('<HH', link, kind)
    shdr += struct.pack('<20sIIIIIBbHH', name20('EOS'), 0, 0, 0, 0, 0, 0, 0, 0, 0)

    # One instrument, one zone per region and channel.
    igen = bytearray()
    ibag = bytearray()
    gen_count = 0
    for r in regions:
        s = samples[r['_path']]
        for c in range(s.channels):
            ibag += struct.pack('<HH', gen_count, 0)
            pan = None if s.channels == 1 else (-500 if c == 0 else 500)
            for oper, amount in region_generators(r, s, pan) + [(GEN['sampleID'], sample_ids[(r['_path'], c)])]:
                if isinstance(amount, tuple):
                    igen += struct.pack('<HBB', oper, amount[1], amount[2])
                else:
                    igen += struct.pack('<Hh', oper, amount)
                gen_count += 1
    zones = len(ibag) // 4
    ibag += struct.pack('<HH', gen_count, 0)
    igen += struct.pack('<HH', 0, 0)

    inst = struct.pack('<20sH', name20(preset_name), 0) + struct.pack('<20sH', name20('EOI'), zones)
    imod = b'\0' * 10
    phdr = struct.pack('<20sHHHIII', name20(preset_name), 0, 0, 0, 0, 0, 0) + \
        struct.pack('<20sHHHIII', name20('EOP'), 0, 0, 1, 0, 0, 0)
    pbag = struct.pack('<HH', 0, 0) + struct.pack('<HH', 1, 0)
    pmod = b'\0' * 10
    pgen = struct.pack('<Hh', GEN['instrument'], 0) + struct.pack('<HH', 0, 0)

    info = b'INFO' + chunk(b'ifil', struct.pack('<HH', 2, 1)) + chunk(b'isng', zstr('EMU8000')) + \
        chunk(b'INAM', zstr(preset_name)) + chunk(b'ICOP', zstr(copyright)) + chunk(b'ICMT', zstr(comment)) + \
        chunk(b'ISFT', zstr('LiveKeys sfz2sf2'))
    sdta = b'sdta' + chunk(b'smpl', bytes(smpl))
    pdta = b'pdta' + b''.join(chunk(t, p) for t, p in (
        (b'phdr', phdr), (b'pbag', pbag), (b'pmod', pmod), (b'pgen', pgen),
        (b'inst', inst), (b'ibag', bytes(ibag)), (b'imod', imod), (b'igen', bytes(igen)), (b'shdr', bytes(shdr))))
    body = b'sfbk' + chunk(b'LIST', info) + chunk(b'LIST', sdta) + chunk(b'LIST', pdta)
    with open(out_path, 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', len(body)) + body)
    print(f'{out_path}: {len(regions)} regions, {len(samples)} samples, {zones} zones', file=sys.stderr)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('sfz')
    p.add_argument('sf2')
    p.add_argument('name')
    p.add_argument('--copyright', default='')
    p.add_argument('--comment', default='')
    a = p.parse_args()
    regions = load_regions(a.sfz)
    if not regions:
        sys.exit('no playable regions')
    write_sf2(regions, a.sf2, a.name, a.copyright, a.comment)


if __name__ == '__main__':
    main()
