#!/usr/bin/env python3
# Uso: python batch_compress.py ruta/a/THUMB ruta/a/THUMB_WEB
#
# Procesamiento en lote de V1: reproduce la configuracion de la Version A
# del experimento sobre 01-0012.jpg. A SI redimensiono (fue la 6ta ronda
# de reduccion de resize_experiment.py, scale = 0.85**5), no se quedo en
# la resolucion nativa como se penso en un primer momento. El factor de
# escala exacto que produjo 2958x2303 a partir de 6668x5191 es 0.85**5
# (confirmado corriendo la cuenta: da 2958x2303 exacto). Nunca modifica
# ni borra los originales: siempre lee de una carpeta y escribe en otra
# distinta, con el mismo nombre de archivo.
#
# Requiere Pillow: pip install Pillow

import sys
import os
import time
from PIL import Image

SCALE_FACTOR = 0.85 ** 5  # = 0.4437053125, el mismo factor que dio la Version A
JPEG_QUALITY = 52


def compress_one(src_path, dst_path):
    img = Image.open(src_path)
    img.load()
    new_width = max(1, int(img.width * SCALE_FACTOR))
    new_height = max(1, int(img.height * SCALE_FACTOR))
    resized = img.resize((new_width, new_height), Image.LANCZOS)
    resized.convert('RGB').save(dst_path, 'JPEG', quality=JPEG_QUALITY, optimize=True)
    return os.path.getsize(src_path), os.path.getsize(dst_path), new_width, new_height


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

    total_files = len(files)
    print('Encontrados %d archivos .jpg en %s' % (total_files, src_dir))
    print('Procesando (escala %.10f, calidad JPEG %d)...' % (SCALE_FACTOR, JPEG_QUALITY))
    print()

    total_original = 0
    total_new = 0
    errores = []
    start_time = time.time()

    for i, name in enumerate(files, 1):
        src_path = os.path.join(src_dir, name)
        dst_path = os.path.join(dst_dir, name)
        try:
            orig_size, new_size, w, h = compress_one(src_path, dst_path)
            total_original += orig_size
            total_new += new_size
        except Exception as err:
            errores.append((name, str(err)))
            print('  ERROR en %s: %s' % (name, err))

        if i % 50 == 0 or i == total_files:
            print('  ... %d/%d procesados' % (i, total_files))

    elapsed_seconds = time.time() - start_time

    print()
    print('Listo.')
    print('  archivos encontrados: %d' % total_files)
    print('  procesados sin error: %d' % (total_files - len(errores)))
    print('  errores: %d' % len(errores))
    print('  tamano total original: %.2f MB' % (total_original / 1024 / 1024))
    print('  tamano total nuevo: %.2f MB' % (total_new / 1024 / 1024))
    if total_original > 0:
        print('  reduccion: %.1f%%' % (100 * (1 - total_new / total_original)))
    print('  tiempo total: %.1f s' % elapsed_seconds)

    if errores:
        print()
        print('Archivos con error (revisar a mano, por ejemplo si no son JPG validos):')
        for name, msg in errores:
            print('  %s: %s' % (name, msg))


if __name__ == '__main__':
    main()
