import importlib.util
from pathlib import Path
import struct
import unittest

spec = importlib.util.spec_from_file_location('audit', Path(__file__).with_name('audit-android-artifact.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def elf(alignment=16384, address=0):
    data = bytearray(128)
    data[:6] = b'\x7fELF\x02\x01'
    struct.pack_into('<Q', data, 32, 64)
    struct.pack_into('<HH', data, 54, 56, 1)
    struct.pack_into('<IIQQQQQQ', data, 64, 1, 5, 0, address, 0, 128, 128, alignment)
    return data


class Audit(unittest.TestCase):
    def test_aligned_native_library(self):
        self.assertEqual(audit.audit_elf(elf()), 1)

    def test_real_4kb_library_is_rejected(self):
        with self.assertRaisesRegex(ValueError, '16KB'):
            audit.audit_elf(elf(4096))

    def test_mismatched_virtual_address(self):
        with self.assertRaisesRegex(ValueError, '16KB'):
            audit.audit_elf(elf(address=4096))

    def test_corrupt_headers_and_truncated_segments(self):
        for raw in (b'not ELF', elf()[:100], elf()[:127]):
            with self.assertRaises(ValueError):
                audit.audit_elf(raw)


if __name__ == '__main__':
    unittest.main()
