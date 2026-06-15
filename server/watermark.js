import { spawn } from 'child_process';

const FFMPEG_TIMEOUT = 60_000;
const FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stdout.on('data', () => {});
    proc.stderr.on('data', d => { stderr += d; });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('ffmpeg watermark timeout'));
    }, FFMPEG_TIMEOUT);

    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg watermark exit ${code}: ${stderr.slice(-500)}`));
    });
    proc.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export async function applyWatermark({ inputPath, outputPath }) {
  await run('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-filter_complex',
      `color=c=black@0.0:s=207x185,format=rgba,` +
      `drawtext=fontfile=${FONT_PATH}:text='VidFlex AI':fontsize=18:fontcolor=white@0.55:borderw=2:bordercolor=black@0.5:x=(w-text_w)/2:y=(h-text_h)/2,` +
      `rotate=-0.5:c=black@0.0:ow=207:oh=185[cell];` +
      `[cell]tile=6x8[grid];` +
      `[0:v][grid]overlay=0:0:format=auto:shortest=1,format=yuv420p[out]`,
    '-map', '[out]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ]);
}
