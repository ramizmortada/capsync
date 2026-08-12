export function parseSRT(srtContent: string) {
  const segments: any[] = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length >= 3) {
      const timecodeLine = lines[1];
      const textLines = lines.slice(2).join('\n');
      
      const timeMatch = timecodeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      
      if (timeMatch) {
        const startH = parseInt(timeMatch[1], 10);
        const startM = parseInt(timeMatch[2], 10);
        const startS = parseInt(timeMatch[3], 10);
        const startMs = parseInt(timeMatch[4], 10);
        const start = startH * 3600 + startM * 60 + startS + startMs / 1000;
        
        const endH = parseInt(timeMatch[5], 10);
        const endM = parseInt(timeMatch[6], 10);
        const endS = parseInt(timeMatch[7], 10);
        const endMs = parseInt(timeMatch[8], 10);
        const end = endH * 3600 + endM * 60 + endS + endMs / 1000;
        
        segments.push({
          start,
          end,
          text: textLines.trim(),
          words: textLines.trim().split(/\s+/).map(word => ({ word, start, end })),
        });
      }
    }
  }
  return segments;
}

export function parseVTT(vttContent: string) {
  const segments: any[] = [];
  const lines = vttContent.trim().split('\n');
  let i = 0;
  
  if (lines[i].startsWith('WEBVTT')) {
    i++;
  }
  
  while (i < lines.length) {
    if (lines[i].trim() === '') {
      i++;
      continue;
    }
    
    // Check if it's an identifier line
    if (!lines[i].includes('-->') && i + 1 < lines.length && lines[i+1].includes('-->')) {
      i++;
    }
    
    const timecodeLine = lines[i];
    if (timecodeLine && timecodeLine.includes('-->')) {
      // VTT time format: 00:00:00.000 or 00:00.000
      const timeMatch = timecodeLine.match(/(\d{2,}:)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2,}:)?(\d{2}):(\d{2})\.(\d{3})/);
      
      if (timeMatch) {
        const startH = timeMatch[1] ? parseInt(timeMatch[1], 10) : 0;
        const startM = parseInt(timeMatch[2], 10);
        const startS = parseInt(timeMatch[3], 10);
        const startMs = parseInt(timeMatch[4], 10);
        const start = startH * 3600 + startM * 60 + startS + startMs / 1000;
        
        const endH = timeMatch[5] ? parseInt(timeMatch[5], 10) : 0;
        const endM = parseInt(timeMatch[6], 10);
        const endS = parseInt(timeMatch[7], 10);
        const endMs = parseInt(timeMatch[8], 10);
        const end = endH * 3600 + endM * 60 + endS + endMs / 1000;
        
        i++;
        const textLines = [];
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i].replace(/<[^>]+>/g, '')); // Strip VTT formatting tags
          i++;
        }
        
        segments.push({
          start,
          end,
          text: textLines.join('\n').trim(),
          words: textLines.join('\n').trim().split(/\s+/).map(word => ({ word, start, end })),
        });
        continue;
      }
    }
    i++;
  }
  return segments;
}
