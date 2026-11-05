import fs from 'fs';
import path from 'path';

// Multer stores evidence with a relative destination ('uploads/'), so
// evidence_files.file_path holds a path like "uploads/<uuid>-<original name>"
// that is relative to the directory the API was started from. Resolve it against
// that same root here, so deletion keeps working no matter where the process was
// started, and refuse to unlink anything that resolves outside the uploads root.
export function uploadsRoot() {
  return process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(process.cwd(), 'uploads');
}

export function resolveEvidencePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { absolute: null, insideRoot: false };
  }
  const root = uploadsRoot();
  const absolute = path.isAbsolute(filePath)
    ? path.normalize(filePath)
    : path.resolve(process.cwd(), filePath);

  const rel = path.relative(root, absolute);
  const insideRoot = rel !== '' && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);

  return { absolute, insideRoot };
}

// Delete the files behind a list of evidence_files.file_path values.
//
// Safe to call repeatedly: a file that is already gone is reported as `missing`,
// not as an error. Never throws for a missing file. Any other unlink failure
// (permissions, EISDIR, ...) is reported in `failed` so the caller can refuse to
// claim success while a file is still on disk.
export async function deleteEvidenceFiles(filePaths) {
  const deleted = [];
  const missing = [];
  const skipped = [];
  const failed = [];

  for (const filePath of filePaths) {
    const { absolute, insideRoot } = resolveEvidencePath(filePath);

    if (!absolute || !insideRoot) {
      // Not a path this API could have written (or empty) — never unlink it.
      skipped.push({ file_path: filePath ?? null, reason: 'outside uploads root' });
      continue;
    }

    try {
      await fs.promises.unlink(absolute);
      deleted.push(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        missing.push(filePath);
      } else {
        failed.push({ file_path: filePath, error: error.code || error.message });
      }
    }
  }

  return { deleted, missing, skipped, failed };
}
