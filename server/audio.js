import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';

const FFMPEG_TIMEOUT = 60_000; // 60 sec

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('ffmpeg timeout'));
    }, FFMPEG_TIMEOUT);

    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`));
    });
    proc.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Mix audio into video: replace audio track, trim to video length, fade-out 1s.
 * Video is NOT re-encoded (-c:v copy).
 * @returns {Buffer} resulting MP4
 */
export async function mixAudioIntoVideo({ videoUrl, audioBuffer, audioExt }) {
  const uid = randomUUID().slice(0, 12);
  const dir = tmpdir();
  const videoPath = join(dir, `${uid}-video.mp4`);
  const audioPath = join(dir, `${uid}-audio.${audioExt}`);
  const outPath = join(dir, `${uid}-out.mp4`);

  try {
    // 1. Download video
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Failed to download video: ${videoRes.status}`);
    const videoBuf = Buffer.from(await videoRes.arrayBuffer());
    await writeFile(videoPath, videoBuf);

    // 2. Write audio
    await writeFile(audioPath, audioBuffer);

    // 3. Get video duration via ffprobe
    const durationStr = await run('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=nw=1:nk=1',
      videoPath,
    ]);
    const duration = parseFloat(durationStr);
    if (!duration || duration <= 0) throw new Error('Could not determine video duration');

    // 4. FFmpeg: replace audio, trim to video length, fade-out 1s at end
    const fadeStart = Math.max(0, duration - 1);
    await run('ffmpeg', [
      '-y',
      '-i', videoPath,
      '-i', audioPath,
      '-filter_complex', `[1:a]afade=t=out:st=${fadeStart.toFixed(2)}:d=1[a]`,
      '-map', '0:v:0',
      '-map', '[a]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      outPath,
    ]);

    // 5. Read result
    const { readFile } = await import('fs/promises');
    return await readFile(outPath);
  } finally {
    // Cleanup all temp files
    await unlink(videoPath).catch(() => {});
    await unlink(audioPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}
