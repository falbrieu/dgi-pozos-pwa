#!/usr/bin/env python3
# Uso: python resize_experiment.py ruta/a/01-0012.jpg
#
# Experimento de V1 (no forma parte de V0). Genera 3 copias del original
# (nunca lo modifica ni lo sobreescribe), buscando ~300KB, ~500KB y ~800KB,
# probando combinaciones de resolucion y calidad JPEG.
#
# Prioridad de busqueda: primero se baja la calidad JPEG (manteniendo la
# resolucion original) hasta un piso de 50; solo si eso no alcanza para
# llegar al tamano objetivo se reduce la resolucion en pasos chicos. Esto
# es a proposito: perder nitidez de texto/lineas por resolucion se nota
# mas que perder algo de calidad de compresion.
#
# Requiere Pillow: pip install Pillow

import sys
import os
from io import BytesIO
from PIL import Image

TARGETS_KB = {'A': 300, 'B': 500, 'C': 800}
QUALITY_START = 92
QUALITY_FLOOR = 50
QUALITY_STEP = 5
SCALE_STEP = 0.85
MAX_SCALE_ROUNDS = 6
TOLERANCE = 0.15  # +-15% del objetivo se considera aceptable


def encode(img, quality):
    buf = BytesIO()
    img.convert('RGB').save(buf, 'JPEG', quality=quality, optimize=True)
    return buf.getvalue()


def find_best(original, target_bytes):
    best = None
    scale = 1.0
    for _ in range(MAX_SCALE_ROUNDS):
        width = max(1, int(original.width * scale))
        height = max(1, int(original.height * scale))
        resized = original.resize((width, height), Image.LANCZOS) if scale < 1.0 else original

        quality = QUALITY_START
        while quality >= QUALITY_FLOOR:
            data = encode(resized, quality)
            size = len(data)
            candidate = {'width': width, 'height': height, 'quality': quality, 'size': size, 'data': data}

            if best is None or abs(size - target_bytes) < abs(best['size'] - target_bytes):
                best = candidate

            if size <= target_bytes * (1 + TOLERANCE):
                return best
            quality -= QUALITY_STEP

        scale *= SCALE_STEP

    return best


def main():
    if len(sys.argv) != 2:
        print('Uso: python resize_experiment.py ruta/a/01-0012.jpg')
        sys.exit(1)

    src_path = sys.argv[1]
    if not os.path.isfile(src_path):
        print('No se encontro el archivo: ' + src_path)
        sys.exit(1)

    original = Image.open(src_path)
    original.load()
    orig_size = os.path.getsize(src_path)

    print('Original: %s' % src_path)
    print('  dimensiones: %dx%d px' % (original.width, original.height))
    print('  tamano: %d bytes (%.2f MB)' % (orig_size, orig_size / 1024 / 1024))
    print()

    base_dir = os.path.dirname(os.path.abspath(src_path))
    base_name = os.path.splitext(os.path.basename(src_path))[0]

    for label, target_kb in TARGETS_KB.items():
        target_bytes = target_kb * 1024
        result = find_best(original, target_bytes)

        out_path = os.path.join(base_dir, '%s_%s_%dkb.jpg' % (base_name, label, target_kb))
        with open(out_path, 'wb') as f:
            f.write(result['data'])

        print('Version %s (objetivo ~%d KB):' % (label, target_kb))
        print('  archivo: %s' % out_path)
        print('  dimensiones: %dx%d px' % (result['width'], result['height']))
        print('  calidad JPEG: %d' % result['quality'])
        print('  tamano real: %d bytes (%.2f MB)' % (result['size'], result['size'] / 1024 / 1024))
        print()


if __name__ == '__main__':
    main()
