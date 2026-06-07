import { spawn } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';

const FFMPEG_TIMEOUT = 120_000; // 120 sec for concat

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('ffmpeg concat timeout'));
    }, FFMPEG_TIMEOUT);

    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`ffmpeg concat exit ${code}: ${stderr.slice(-500)}`));
    });
    proc.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Concat multiple video URLs into a single MP4 using FFmpeg concat demuxer.
 * Segments must have compatible codecs / resolution.
 * @param {string[]} videoUrls - ordered array of S3 video URLs
 * @returns {Buffer} resulting MP4
 */
export async function concatVideos(videoUrls) {
  if (!videoUrls || videoUrls.length < 2) {
    throw new Error('concatVideos requires at least 2 URLs');
  }

  const uid = randomUUID().slice(0, 12);
  const dir = tmpdir();
  const segPaths = [];
  const listPath = join(dir, `${uid}-list.txt`);
  const outPath = join(dir, `${uid}-concat.mp4`);

  try {
    // 1. Download all segments
    for (let i = 0; i < videoUrls.length; i++) {
      const segPath = join(dir, `${uid}-seg${i}.mp4`);
      const res = await fetch(videoUrls[i]);
      if (!res.ok) throw new Error(`Failed to download segment ${i}: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(segPath, buf);
      segPaths.push(segPath);
      console.log(`[concat] Downloaded segment ${i}: ${buf.length} bytes`);
    }

    // 2. Re-encode segments to ensure compatible codecs/resolution
    const normPaths = [];
    for (let i = 0; i < segPaths.length; i++) {
      const normPath = join(dir, `${uid}-norm${i}.mp4`);
      await run('ffmpeg', [
        '-y', '-i', segPaths[i],
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-an',           // drop audio (product video, no audio from Kling)
        '-movflags', '+faststart',
        normPath,
      ]);
      normPaths.push(normPath);
      console.log(`[concat] Normalized segment ${i}`);
    }

    // 3. Create concat list file
    const listContent = normPaths.map(p => `file '${p}'`).join('\n');
    await writeFile(listPath, listContent);

    // 4. Concat via demuxer (stream copy since all normalized)
    await run('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      outPath,
    ]);

    // 5. Read and return
    const result = await readFile(outPath);
    console.log(`[concat] Output: ${result.length} bytes`);
    return result;
  } finally {
    // Cleanup all temp files
    for (const p of segPaths) await unlink(p).catch(() => {});
    for (const p of segPaths.map((_, i) => join(dir, `${uid}-norm${i}.mp4`))) await unlink(p).catch(() => {});
    await unlink(listPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}
