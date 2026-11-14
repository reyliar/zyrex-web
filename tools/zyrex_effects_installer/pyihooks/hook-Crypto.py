"""Ship only the AES-GCM backend of pycryptodome instead of every Crypto extension.

The bundled hook collects every native extension from Crypto.Cipher, Crypto.Hash,
Crypto.Util, Crypto.PublicKey, Crypto.Protocol and Crypto.Math, which adds ~2 MB of
RSA, ECC, ML-KEM and hash backends the installer never uses.
"""
import glob
import os

from PyInstaller.compat import EXTENSION_SUFFIXES
from PyInstaller.utils.hooks import get_module_file_attribute

# AES (portable, AES-NI, ARMv8), the ECB/CTR wrappers GCM builds on, and GHASH
# (portable, CLMUL, PMULL) are the only native backends AES-GCM needs; _cpuid_c
# powers the CPU feature detection.
KEPT_BACKENDS = (
    ("Crypto.Cipher", ("_raw_aes", "_raw_aesni", "_raw_aes_armv8", "_raw_ecb", "_raw_ctr")),
    ("Crypto.Hash", ("_ghash_portable", "_ghash_clmul", "_ghash_pmull")),
    ("Crypto.Util", ("_cpuid_c",)),
)

binaries = []
for module_name, prefixes in KEPT_BACKENDS:
    module_dir = os.path.dirname(get_module_file_attribute(module_name))
    for prefix in prefixes:
        for extension in EXTENSION_SUFFIXES:
            for path in glob.glob(os.path.join(module_dir, prefix + extension)):
                binaries.append((path, module_name.replace(".", os.sep)))
