const { YtDlp } = require('ytdlp-nodejs');
const path = require('path');
const os = require('os');

async function run() {
  const ytdlp = new YtDlp({});
  let dl = ytdlp.download('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    .output(path.join(os.tmpdir(), '%(title)s.%(ext)s'))
    .addArgs('--postprocessor-args', 'ffmpeg:-ss 00:00:12 -to 00:00:20')
    .format({ filter: 'mergevideo', quality: '1080p', type: 'mp4' });

  try {
    console.log('Running...');
    const result = await dl.run();
    console.log('Result filePaths:', result.filePaths);
    console.log('Result:', Object.keys(result));
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
