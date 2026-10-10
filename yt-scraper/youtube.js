async function searchYutube(query) {
  const url = 'https://www.youtube.com/youtubei/v1/search?prettyPrint=false';
  
  const payload = {
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20240514.01.00', // Versi client web
        hl: 'en',
        gl: 'US',
      }
    },
    query: query
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': '2.20240514.01.00',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status}`);
    }

    const data = await response.json();
    const results = [];

    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
    
    if (contents && Array.isArray(contents)) {
      for (const section of contents) {
        const items = section.itemSectionRenderer?.contents || section.richGridRenderer?.contents;
        
        if (items && Array.isArray(items)) {
          for (const item of items) {
            const videoRenderer = item.videoRenderer || item.richItemRenderer?.content?.videoRenderer;
            
            if (videoRenderer && videoRenderer.videoId) {
              results.push({
                id: videoRenderer.videoId,
                title: videoRenderer.title?.runs?.map(r => r.text).join('') || 'No Title',
                channel: videoRenderer.ownerText?.runs?.map(r => r.text).join('') || 'Unknown Channel',
                views: videoRenderer.viewCountText?.simpleText || '0 views',
                publishedTime: videoRenderer.publishedTimeText?.simpleText || '',
                duration: videoRenderer.lengthText?.simpleText || 'LIVE',
                thumbnail: videoRenderer.thumbnail?.thumbnails?.[0]?.url || ''
              });
            }
          }
        }
      }
    }

    return results;
  } catch (error) {
    console.error('Gagal melakukan scraping YouTube:', error.message);
    throw error;
  }
}

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Masukkan kata kunci pencarian: ', async (query) => {
  if (!query) {
    console.log('Kata kunci tidak boleh kosong!');
    rl.close();
    return;
  }

  try {
    console.log(`\nMencari video: "${query}"...`);
    const hasil = await searchYutube(query);
    console.log(`\nDitemukan ${hasil.length} video. Menampilkan 3 teratas:`);
    console.log(JSON.stringify(hasil.slice(0, 3), null, 2));
  } catch (err) {
    console.error('Terjadi kesalahan:', err);
  } finally {
    rl.close();
  }
});

