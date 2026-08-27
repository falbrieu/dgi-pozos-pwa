#!/usr/bin/env python3
# Uso: python batch_compress.py ruta/a/THUMB ruta/a/THUMB_WEB
#
# Procesamiento en lote de V1: recomprime cada JPG con la configuracion
# elegida a partir del experimento sobre 01-0012 (version A: calidad
# JPEG 52, sin cambiar resolucion - cada archivo conserva su propio
# tamano nativo). Nunca modifica ni borra los originales: siempre lee
# de una carpeta y escribe en otra distinta.
#
# Requiere Pillow: pip install Pillow

import sys
import os
from PIL import Image

JPEG_QUALITY = 52


def compress_one(src_path, dst_path):
    img = Image.open(src_path)
    img.load()
    img.convert('RGB').save(dst_path, 'JPEG', quality=JPEG_QUALITY, optimize=True)
    return os.path.getsize(src_path), os.path.getsize(dst_path)


def main():
    if len(sys.argv) != 3:
        print('Uso: python batch_compress.py carpeta_origen carpeta_destino')
        sys.exit(1)

    src_dir, dst_dir = sys.argv[1], sys.argv[2]
    if not os.path.isdir(src_dir):
        print('No existe la carpeta de origen: ' + src_dir)
        sys.exit(1)
    if os.path.abspath(src_dir) == os.path.abspath(dst_dir):
        print('El origen y el destino no pueden ser la misma carpeta (no se tocan los originales).')
        sys.exit(1)
    os.makedirs(dst_dir, exist_ok=True)

    files = [f for f in os.listdir(src_dir) if f.lower().endswith('.jpg')]
    if not files:
        print('No se encontraron archivos .jpg en ' + src_dir)
        sys.exit(1)

    print('Procesando %d archivos (calidad JPEG %d, resolucion original sin cambios)...' % (len(files), JPEG_QUALITY))
    print()

    total_original = 0
    total_new = 0
    errores = []

    for i, name in enumerate(files, 1):
        src_path = os.path.join(src_dir, name)
        dst_path = os.path.join(dst_dir, name)
        try:
            orig_size, new_size = compress_one(src_path, dst_path)
            total_original += orig_size
            total_new += new_size
        except Exception as err:
            errores.append((name, str(err)))

        if i % 50 == 0 or i == len(files):
            print('  %d/%d procesados...' % (i, len(files)))

    print()
    print('Listo.')
    print('  archivos procesados sin error: %d' % (len(files) - len(errores)))
    print('  errores: %d' % len(errores))
    print('  tamano total original: %.2f MB' % (total_original / 1024 / 1024))
    print('  tamano total nuevo: %.2f MB' % (total_new / 1024 / 1024))
    if total_original > 0:
        print('  reduccion: %.1f%%' % (100 * (1 - total_new / total_original)))

    if errores:
        print()
        print('Archivos con error (revisar a mano, por ejemplo si no son JPG validos):')
        for name, msg in errores:
            print('  %s: %s' % (name, msg))


if __name__ == '__main__':
    main()
