import { describe, it, expect } from 'vitest';
import { detectarTipoReal } from '../../../../src/middleware/entregafacturas/magicBytes';

describe('detectarTipoReal', () => {
  it('detecta JPEG por firma real', () => {
    const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    expect(detectarTipoReal(buf)).toBe('jpeg');
  });

  it('detecta PNG por firma real', () => {
    const buf = Buffer.from('89504e470d0a1a0a', 'hex');
    expect(detectarTipoReal(buf)).toBe('png');
  });

  it('detecta WEBP por firma real', () => {
    const buf = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
    expect(detectarTipoReal(buf)).toBe('webp');
  });

  it('detecta HEIC por firma real (ftyp + brand heic)', () => {
    const buf = Buffer.concat([Buffer.alloc(4), Buffer.from('ftyp'), Buffer.from('heic')]);
    expect(detectarTipoReal(buf)).toBe('heic');
  });

  it('rechaza contenido que no coincide con ninguna firma conocida', () => {
    const buf = Buffer.from('esto no es una imagen');
    expect(detectarTipoReal(buf)).toBeNull();
  });

  it('rechaza un buffer vacío o muy corto', () => {
    expect(detectarTipoReal(Buffer.alloc(0))).toBeNull();
    expect(detectarTipoReal(Buffer.from([0xFF]))).toBeNull();
  });

  it('no se deja engañar por una extensión/mimetype falso — solo mira el contenido', () => {
    // Un archivo de texto renombrado a .jpg no tiene la firma real
    const buf = Buffer.from('<script>alert(1)</script>');
    expect(detectarTipoReal(buf)).toBeNull();
  });
});
