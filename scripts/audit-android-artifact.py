"""Read-only ELF alignment audit of APK/AAB archives; never signs or installs."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zipfile


def audit_elf(data):
    if len(data) < 64 or data[:4] != b'\x7fELF' or data[4] != 2 or data[5] not in (1, 2):
        raise ValueError('Invalid or unsupported 64-bit ELF header')
    order = '<' if data[5] == 1 else '>'
    offset = struct.unpack_from(order+'Q', data, 32)[0]
    entry_size, count = struct.unpack_from(order+'HH', data, 54)
    if entry_size < 56 or not count or count > 256 or offset+entry_size*count > len(data):
        raise ValueError('Invalid ELF program-header bounds')
    segments = 0
    for n in range(count):
        kind, _, file_offset, address, _, file_size, _, alignment = struct.unpack_from(order+'IIQQQQQQ', data, offset+n*entry_size)
        if kind != 1:
            continue
        segments += 1
        if file_offset+file_size > len(data):
            raise ValueError('Truncated ELF load segment')
        if alignment < 16384 or alignment & (alignment-1) or address % 16384 != file_offset % 16384:
            raise ValueError('ELF load segment is not 16KB aligned')
    if not segments:
        raise ValueError('ELF has no load segments')
    return segments


def audit_archive(path):
    libraries = []
    with zipfile.ZipFile(path) as archive:
        entries = [i for i in archive.infolist() if i.filename.endswith('.so') and any('/'+abi+'/' in i.filename for abi in ('arm64-v8a', 'x86_64'))]
        if not entries or len(entries) > 512 or sum(i.file_size for i in entries) > 512*1024*1024:
            raise ValueError('Missing or oversized native-library set')
        for item in entries:
            if item.file_size > 128*1024*1024:
                raise ValueError('Native library exceeds audit bound')
            try:
                segments = audit_elf(archive.read(item))
            except ValueError as error:
                raise ValueError(item.filename+': '+str(error)) from None
            libraries.append({'library': item.filename, 'load_segments': segments})
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''):
            digest.update(chunk)
    return {'artifact': path.name, 'sha256': digest.hexdigest(), 'elf_16kb_alignment': 'pass', 'libraries': libraries,
            'scope': '64-bit ELF segments only; APK zipalign, actual signing/manifest and 16KB-device runtime acceptance are separate'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('artifact', type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(audit_archive(args.artifact)))
    except (ValueError, OSError, zipfile.BadZipFile) as error:
        print(json.dumps({'elf_16kb_alignment': 'fail', 'reason': str(error)}))
        raise SystemExit(1)
