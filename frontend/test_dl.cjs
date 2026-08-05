const { YtDlp } = require('ytdlp-nodejs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

async function test() {
  const binaryPath = path.join(__dirname, 'node_modules', 'ytdlp-nodejs', 'bin', 'yt-dlp.exe');
  console.log("Using binary path:", binaryPath);

  const outputPath = path.join(os.tmpdir(), 'test_clip.mp4');
  const cmd = `"${binaryPath}" "https://www.youtube.com/watch?v=dQw4w9WgXcQ" --ffmpeg-location "C:\\FFmpeg\\bin" --download-sections "*00:00:10-00:00:20" -o "${outputPath}" --verbose`;
  console.log("Executing:", cmd);
  
  const child = exec(cmd);
  child.stdout.on('data', d => console.log('STDOUT:', d.toString()));
  child.stderr.on('data', d => console.log('STDERR:', d.toString()));
  child.on('close', code => console.log('Exited with code:', code));
}

test();
