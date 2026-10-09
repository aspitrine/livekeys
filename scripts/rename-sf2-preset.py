#!/usr/bin/env python3
"""Rename the presets (and their instruments) of a SoundFont in place: the name shown in LiveKeys' sound browser.

Usage: rename-sf2-preset.py BANK.sf2 "New name" [--program N] [--bank N]
SF2 names hold 19 characters: longer names are refused rather than silently cut.
Without --program, every preset gets the name (single-preset banks).
"""
import argparse
import struct
import sys


def chunks(data: bytes, start: int, end: int):
    """(tag, payload offset, size) of the RIFF sub-chunks between start and end."""
    k = start
    while k + 8 <= end:
        tag, size = bytes(data[k:k + 4]), struct.unpack('<I', data[k + 4:k + 8])[0]
        yield tag, k + 8, size
        k += 8 + size + (size & 1)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('sf2')
    p.add_argument('name')
    p.add_argument('--program', type=int)
    p.add_argument('--bank', type=int, default=0)
    a = p.parse_args()
    raw = a.name.encode('ascii')
    if len(raw) > 19:
        sys.exit(f'name longer than 19 characters: {a.name!r}')
    name = raw.ljust(20, b'\0')

    data = bytearray(open(a.sf2, 'rb').read())
    for tag, offset, size in chunks(data, 12, len(data)):
        if tag != b'LIST' or data[offset:offset + 4] != b'pdta':
            continue
        parts = {t: (o, s) for t, o, s in chunks(data, offset + 4, offset + size)}
        phdr_o, phdr_s = parts[b'phdr']
        renamed = 0
        for i in range(phdr_o, phdr_o + phdr_s - 38, 38):  # last record is the EOP terminator
            program, bank = struct.unpack('<HH', data[i + 20:i + 24])
            if a.program is None or (program == a.program and bank == a.bank):
                data[i:i + 20] = name
                renamed += 1
        if a.program is None:
            inst_o, inst_s = parts[b'inst']
            for i in range(inst_o, inst_o + inst_s - 22, 22):
                data[i:i + 20] = name
        open(a.sf2, 'wb').write(data)
        print(f'{a.sf2}: {renamed} preset(s) renamed to {a.name!r}')
        return
    sys.exit('no pdta chunk')


if __name__ == '__main__':
    main()
