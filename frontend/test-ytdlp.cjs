const { YtDlp } = require('ytdlp-nodejs');
const path = require('path');
const os = require('os');

async function run() {
  const ytdlp = new YtDlp({});
  let dl = ytdlp.download('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    .output(path.join(os.tmpdir(), '%(title)s.%(ext)s'))
    .addArgs('--download-sections', '*00:00:12-00:00:20')
    .format({ filter: 'mergevideo', quality: '1080p', type: 'mp4' });

  dl.on('progress', (p) => {
    console.log('Progress:', p);
  });

  try {
    const result = await dl.run();
    console.log('Result:', result);
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
