import { resolve } from 'path';
import { uploadedFileUrl, uploadsDir } from './upload-path.util';

describe('uploadsDir', () => {
  it('resolves a relative path against the working directory', () => {
    expect(uploadsDir('./uploads')).toBe(resolve(process.cwd(), 'uploads'));
    expect(uploadsDir('uploads')).toBe(resolve(process.cwd(), 'uploads'));
  });

  /**
   * The regression this helper exists for. Production sets an absolute
   * STORAGE_LOCAL_PATH; `join(cwd, abs)` produced
   * `/Milan/aavaschool/backend/Milan/aavaschool/backend/uploads`, so files were
   * written to one directory and served from another and every gallery image
   * 404'd.
   */
  it('leaves an absolute path alone', () => {
    const abs = resolve('/Milan/aavaschool/backend/uploads');
    expect(uploadsDir('/Milan/aavaschool/backend/uploads')).toBe(abs);
    expect(uploadsDir('/Milan/aavaschool/backend/uploads')).not.toContain(
      resolve(process.cwd(), 'Milan'),
    );
  });

  it('falls back to ./uploads when unset', () => {
    const fallback = resolve(process.cwd(), 'uploads');
    expect(uploadsDir()).toBe(fallback);
    expect(uploadsDir(null)).toBe(fallback);
    expect(uploadsDir('')).toBe(fallback);
    // A stray newline from an .env file must not become a directory name.
    expect(uploadsDir('  ')).toBe(fallback);
  });

  it('trims surrounding whitespace', () => {
    expect(uploadsDir('  ./uploads  ')).toBe(resolve(process.cwd(), 'uploads'));
  });
});

describe('uploadedFileUrl', () => {
  it('builds the public path clients resolve against their own host', () => {
    expect(uploadedFileUrl('1699-42.png')).toBe('/uploads/1699-42.png');
  });
});
