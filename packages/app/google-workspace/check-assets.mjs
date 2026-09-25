import { readFileSync } from 'node:fs';

const DIRECTORY = new URL('./', import.meta.url);
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/**
 * The size a PNG declares in its IHDR chunk, which the PNG format puts first,
 * or null for a file that is not a PNG.
 */
function pngSize(buffer) {
  if (buffer.length < 24) return null;
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buffer.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// assets.json is what google-workspace:assets renders: the Drive UI
// integration's and the Marketplace's icons, at 2x, and the card banner.
const assets = JSON.parse(
  readFileSync(new URL('assets.json', DIRECTORY), 'utf8')
);
const problems = [];

for (const { file, width, height } of assets) {
  let buffer;
  try {
    buffer = readFileSync(new URL(file, DIRECTORY));
  } catch {
    problems.push(`${file}: missing`);
    continue;
  }
  const size = pngSize(buffer);
  if (!size) {
    problems.push(`${file}: not a PNG`);
  } else if (size.width !== width || size.height !== height) {
    problems.push(
      `${file}: ${size.width}x${size.height}, expected ${width}x${height}`
    );
  }
}

if (problems.length) {
  console.error(
    `google-workspace assets need google-workspace:assets again:\n  ${problems.join('\n  ')}`
  );
  process.exitCode = 1;
} else {
  console.log(`google-workspace: ${assets.length} assets, each the right size`);
}
