const { exec } = require('child_process');
const path = require('path');
const os = require('os');

const binaryPath = path.join(__dirname, 'node_modules', 'ytdlp-nodejs', 'bin', 'yt-dlp.exe');
const ffmpegPath = 'C:\\FFmpeg\\bin';
const url = 'https://www.youtube.com/watch?v=AeKSeq8oROo';

const outFile = path.join(os.tmpdir(), `h264_clip_${Date.now()}.mp4`);
// Prefer H.264 (avc1) format for fast unthrottled section streaming
const cmd = `"${binaryPath}" "${url}" --ffmpeg-location "${ffmpegPath}" -f "bestvideo[height<=1080][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best" --download-sections "*00:07:24-00:08:33" -o "${outFile}" --verbose`;

console.log("Testing H.264 section download speed...");
const start = Date.now();
const child = exec(cmd);

child.stdout.on('data', d => console.log('STDOUT:', d.toString()));
child.stderr.on('data', d => console.log('STDERR:', d.toString()));
child.on('close', code => {
  const duration = (Date.now() - start) / 1000;
  console.log(`Exited with code ${code} in ${duration} seconds! File: ${outFile}`);
});
