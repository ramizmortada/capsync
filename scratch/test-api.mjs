async function run() {
  try {
    const res = await fetch('http://localhost:3000/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        isAudio: false,
        quality: '1080',
        type: 'mp4',
        startTime: '00:00:12',
        endTime: '00:00:20'
      })
    });

    const reader = res.body;
    if (!reader) return console.log('no body');
    const readerStream = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await readerStream.read();
      if (done) break;
      console.log(decoder.decode(value));
    }
  } catch (err) {
    console.error(err);
  }
}
run();
