import { spawn } from 'child_process';
import { writeFile, readFile, unlink, mkdir, rm } from 'fs/promises';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import pool from './db.js';
import { uploadBuffer } from './storage.js';

// ── Config (change without editing code) ──
const MAX_CLIPS = 10;
const MAX_DURATION_SEC = 120;
const FFMPEG_TIMEOUT = 5 * 60 * 1000; // 5 min per assembly
const WORKER_INTERVAL = 3000; // poll queue every 3s

const CANVAS = {
  '9x16': { w: 720, h: 1280 },
  '1x1':  { w: 1080, h: 1080 },
  '16x9': { w: 1280, h: 720 },
};

// ── FFmpeg runner ──

function ffrun(args, timeout = FFMPEG_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stdout.on('data', () => {});
    proc.stderr.on('data', d => { stderr += d; });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('ffmpeg assembly timeout'));
    }, timeout);

    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-600)}`));
    });
    proc.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

function ffprobe(filePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,duration',
      '-show_entries', 'format=duration',
      '-of', 'json', filePath,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', d => { out += d; });
    proc.on('close', code => {
      if (code !== 0) return reject(new Error('ffprobe failed'));
      try {
        const data = JSON.parse(out);
        const s = data.streams?.[0] || {};
        const dur = parseFloat(s.duration) || parseFloat(data.format?.duration) || 0;
        resolve({ width: s.width || 0, height: s.height || 0, duration: dur });
      } catch { reject(new Error('ffprobe parse error')); }
    });
    proc.on('error', reject);
  });
}

// ── Normalize a single clip to the target canvas ──

async function normalizeClip(inputPath, outputPath, tw, th) {
  const info = await ffprobe(inputPath);
  const iw = info.width;
  const ih = info.height;

  const inputRatio = iw / ih;
  const targetRatio = tw / th;
  const sameOrientation = Math.abs(inputRatio - targetRatio) / targetRatio < 0.25;

  let filterComplex;
  if (sameOrientation) {
    filterComplex = `scale=${tw}:${th}:force_original_aspect_ratio=decrease,pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p,setsar=1`;
  } else {
    filterComplex = [
      `[0:v]split=2[bg][fg]`,
      `[bg]scale=${tw}:${th}:force_original_aspect_ratio=increase,crop=${tw}:${th},gblur=sigma=20[bg2]`,
      `[fg]scale=${tw}:${th}:force_original_aspect_ratio=decrease[fg2]`,
      `[bg2][fg2]overlay=(W-w)/2:(H-h)/2,fps=30,format=yuv420p,setsar=1`,
    ].join(';');
  }

  await ffrun([
    '-y', '-i', inputPath,
    '-filter_complex', filterComplex,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
    '-an', '-movflags', '+faststart',
    outputPath,
  ]);

  return info.duration;
}

// ── Process one assembly ──

async function processAssembly(assembly) {
  const { id, user_id, canvas, clip_ids, audio_key } = assembly;
  const canvasSpec = CANVAS[canvas];
  if (!canvasSpec) throw new Error(`Unknown canvas: ${canvas}`);

  const uid = randomUUID().slice(0, 12);
  const workDir = join(tmpdir(), `asm-${uid}`);
  await mkdir(workDir, { recursive: true });

  const tempFiles = [];

  try {
    // 1. Fetch clip video URLs from DB (re-validate ownership + readiness)
    const clipResult = await pool.query(
      `SELECT id, brief, result_url FROM projects
       WHERE id = ANY($1) AND user_id = $2 AND status = 'ready'`,
      [clip_ids, user_id],
    );

    const clipMap = new Map();
    for (const r of clipResult.rows) {
      const b = typeof r.brief === 'string' ? JSON.parse(r.brief) : (r.brief || {});
      const url = b.video_url || r.result_url;
      if (url) clipMap.set(r.id, url);
    }

    const orderedUrls = [];
    for (const cid of clip_ids) {
      const url = clipMap.get(cid);
      if (!url) throw new Error(`Clip ${cid} not found or not ready`);
      orderedUrls.push({ id: cid, url });
    }

    // 2. Download & normalize each clip
    const normPaths = [];
    let totalDuration = 0;

    for (let i = 0; i < orderedUrls.length; i++) {
      const { url } = orderedUrls[i];
      const rawPath = join(workDir, `raw-${i}.mp4`);
      const normPath = join(workDir, `norm-${i}.mp4`);
      tempFiles.push(rawPath, normPath);

      console.log(`[assembly:${id}] Downloading clip ${i + 1}/${orderedUrls.length}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to download clip ${orderedUrls[i].id}: HTTP ${res.status}`);
      await writeFile(rawPath, Buffer.from(await res.arrayBuffer()));

      console.log(`[assembly:${id}] Normalizing clip ${i + 1} to ${canvas}`);
      const dur = await normalizeClip(rawPath, normPath, canvasSpec.w, canvasSpec.h);
      totalDuration += dur;
      normPaths.push(normPath);
    }

    if (totalDuration > MAX_DURATION_SEC) {
      throw new Error(`Суммарная длительность ${Math.round(totalDuration)}с превышает лимит ${MAX_DURATION_SEC}с`);
    }

    // 3. Concat all normalized clips
    const concatPath = join(workDir, 'concat.mp4');
    tempFiles.push(concatPath);

    if (normPaths.length === 1) {
      // Single clip — just copy normalized
      const { copyFile } = await import('fs/promises');
      await copyFile(normPaths[0], concatPath);
    } else {
      const listPath = join(workDir, 'list.txt');
      tempFiles.push(listPath);
      await writeFile(listPath, normPaths.map(p => `file '${p}'`).join('\n'));
      await ffrun([
        '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
        '-c', 'copy', '-movflags', '+faststart', concatPath,
      ]);
    }
    console.log(`[assembly:${id}] Concat done (${normPaths.length} clips, ~${Math.round(totalDuration)}s)`);

    // 4. Audio overlay (optional)
    let finalPath = concatPath;

    if (audio_key) {
      const audioPath = join(workDir, 'audio.tmp');
      const withAudioPath = join(workDir, 'final.mp4');
      tempFiles.push(audioPath, withAudioPath);

      const audioUrl = `https://${process.env.S3_BUCKET || 'videoai-media'}.storage.yandexcloud.net/${audio_key}`;
      const audioRes = await fetch(audioUrl);
      if (!audioRes.ok) throw new Error(`Failed to download audio: HTTP ${audioRes.status}`);
      await writeFile(audioPath, Buffer.from(await audioRes.arrayBuffer()));

      console.log(`[assembly:${id}] Mixing audio`);
      await ffrun([
        '-y', '-i', concatPath, '-i', audioPath,
        '-filter_complex', '[1:a]apad[a]',
        '-map', '0:v', '-map', '[a]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-shortest', '-movflags', '+faststart',
        withAudioPath,
      ]);
      finalPath = withAudioPath;
    }

    // 5. Upload to S3
    const outputBuf = await readFile(finalPath);
    const s3Key = `assemblies/${user_id}/${id}.mp4`;
    const outputUrl = await uploadBuffer({
      buffer: outputBuf,
      key: s3Key,
      contentType: 'video/mp4',
    });
    console.log(`[assembly:${id}] Uploaded ${outputBuf.length} bytes → ${s3Key}`);

    // 6. Mark done
    await pool.query(
      `UPDATE assemblies SET status = 'done', output_url = $1, finished_at = NOW() WHERE id = $2`,
      [outputUrl, id],
    );
    console.log(`[assembly:${id}] ✓ Done`);

  } finally {
    // Cleanup work directory
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    // Cleanup uploaded audio from S3 tmp
    if (audio_key?.startsWith('tmp/')) {
      try {
        const { deleteByPrefix } = await import('./storage.js');
        await deleteByPrefix(audio_key);
      } catch {}
    }
  }
}

// ── Worker loop (concurrency = 1) ──

let running = false;

async function tick() {
  if (running) return;
  running = true;

  try {
    // Atomically grab the oldest queued assembly
    const result = await pool.query(
      `UPDATE assemblies SET status = 'processing', started_at = NOW()
       WHERE id = (
         SELECT id FROM assemblies WHERE status = 'queued' ORDER BY created_at LIMIT 1
       )
       RETURNING *`,
    );

    if (result.rows.length === 0) return;

    const assembly = result.rows[0];
    console.log(`[assembly:${assembly.id}] Processing (canvas=${assembly.canvas}, clips=${assembly.clip_ids.length})`);

    try {
      await processAssembly(assembly);
    } catch (err) {
      console.log(`[assembly:${assembly.id}] Failed: ${err.message}`);
      await pool.query(
        `UPDATE assemblies SET status = 'failed', error = $1, finished_at = NOW() WHERE id = $2`,
        [err.message.slice(0, 500), assembly.id],
      ).catch(() => {});
    }
  } catch (err) {
    console.log(`[assembly-worker] Tick error: ${err.message}`);
  } finally {
    running = false;
  }
}

export function startAssemblyWorker() {
  console.log(`[assembly-worker] Started (interval=${WORKER_INTERVAL / 1000}s, maxClips=${MAX_CLIPS}, maxDur=${MAX_DURATION_SEC}s)`);
  setInterval(tick, WORKER_INTERVAL);
}

export { MAX_CLIPS, MAX_DURATION_SEC };
