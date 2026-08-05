const { YtDlp } = require('ytdlp-nodejs');
const path = require('path');
const fs = require('fs');

const SCRATCH_DIR = path.resolve(__dirname, '..', 'scratch');
const CACHE_DIR = path.join(SCRATCH_DIR, 'video_cache');
const TEMP_DIR = path.join(SCRATCH_DIR, 'temp');

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const url = 'https://www.youtube.com/watch?v=AeKSeq8oROo';
const videoId = 'AeKSeq8oROo';
const quality = '1080';
const safeTitle = 'Dev Lemons - test';
const ext = 'mp4';
const cacheFileName = `${safeTitle} (${quality}p).${ext}`;
const cachedFilePath = path.join(CACHE_DIR, cacheFileName);

const tempDownloadPath = path.join(TEMP_DIR, `dl_${videoId}_${quality}p_${Date.now()}.${ext}`);

console.log("CACHE_DIR:", CACHE_DIR);
console.log("TEMP_DIR:", TEMP_DIR);
console.log("tempDownloadPath:", tempDownloadPath);
console.log("cachedFilePath:", cachedFilePath);

const ytdlp = new YtDlp({});
let dl = ytdlp.download(url).output(tempDownloadPath);
dl = dl.addArgs('--ffmpeg-location', 'C:\\FFmpeg\\bin');
dl = dl.format({ filter: 'mergevideo', quality: `${quality}p`, type: 'mp4' });

dl.run().then(result => {
  console.log("\n--- RESULT ---");
  console.log("result.filePaths:", result.filePaths);
  
  const filesInTemp = fs.readdirSync(TEMP_DIR);
  console.log("Files in TEMP_DIR:", filesInTemp);

  // Check what file was downloaded
  let downloadedPath = tempDownloadPath;
  if (result.filePaths && result.filePaths.length > 0) {
    downloadedPath = result.filePaths[0];
  }

  console.log("Checking if downloadedPath exists:", downloadedPath, "->", fs.existsSync(downloadedPath));

  if (!fs.existsSync(downloadedPath)) {
    // Try searching TEMP_DIR for matching file
    for (const f of filesInTemp) {
      const fullF = path.join(TEMP_DIR, f);
      if (fs.statSync(fullF).isFile() && fs.statSync(fullF).size > 1000) {
        downloadedPath = fullF;
        console.log("Found actual downloaded file in TEMP_DIR:", downloadedPath);
        break;
      }
    }
  }

  if (fs.existsSync(downloadedPath) && fs.statSync(downloadedPath).isFile()) {
    console.log(`Moving file from ${downloadedPath} to ${cachedFilePath}`);
    fs.renameSync(downloadedPath, cachedFilePath);
    console.log("Success! File now in cache:", fs.existsSync(cachedFilePath));
    console.log("Files in CACHE_DIR:", fs.readdirSync(CACHE_DIR));
  } else {
    console.error("FAIL: Could not find downloaded file!");
  }
}).catch(err => {
  console.error("DL Error:", err);
});
