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
  const drawtext = [
    `fontfile=${FONT_PATH}`,
    `text='VidFlex AI'`,
    `fontsize=h/22`,
    `fontcolor=white@0.85`,
    `borderw=2`,
    `bordercolor=black@0.6`,
    `box=1`,
    `boxcolor=black@0.35`,
    `boxborderw=10`,
    `x=(w-text_w)/2`,
    `y=h-text_h-40`,
  ].join(':');

  await run('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-vf', `drawtext=${drawtext}`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ]);
}
