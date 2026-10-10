/**
 * Mengirim reaksi ke WhatsApp Channel melalui API
 * Description: Interactive send React pesan saluran WhatsApp[span_0](start_span)[span_0](end_span)
 * Credit by Zx[span_1](start_span)[span_1](end_span)
 * Sumber: https://whatsapp.com/channel/0029VbDLqe7EquiSF4STU13o[span_2](start_span)[span_2](end_span)
 */

import { gotScraping } from 'got-scraping';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {string} url - URL lengkap post WhatsApp Channel.
 * @param {string[]} [reactions=['😂']] - Array emoji yang dikirim.
 * @param {number} [maxRetries=5] - Maksimal percobaan ulang jika gagal/rate limit.
 */
async function sendReaction(url, reactions = ['😂'], maxRetries = 5) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(`\n[Attempt ${attempt + 1}/${maxRetries}] Mengirim reaction ke: ${url}`);
      
      const response = await gotScraping.post('https://react-w4.zfile.web.id/api/react', {
        json: {
          url: url,
          reactions: reactions,
        },
        responseType: 'json',
        timeout: { request: 60000 },
      });

      const data = response.body;

      if (data.success) {
        console.log(`✅ Berhasil: ${data.message}`);
        return data;
      } else {
  console.warn('⚠️ Respons API:', data);
  await delay(5000);
  attempt++;
}

    } catch (error) {
      if (error.response) {
        const data = error.response.body;
        const statusCode = error.response.statusCode;
        
        console.warn(`⚠️ HTTP Error ${statusCode}: ${data?.message || error.message}`);

        if (statusCode === 429 && data?.retryAfter) {
          const waitTime = data.retryAfter * 1000;
          console.log(`⏳ Rate limit tercapai. Menunggu ${data.retryAfter} detik sebelum retry...`);
          await delay(waitTime);
          attempt++;
          continue;
        }
        
        console.log('⏳ Server sibuk, mencoba lagi dalam 5 detik...');
        await delay(5000);
        attempt++;
        continue;
      }
      
      console.error(`❌ Error jaringan:`, error.message);
      await delay(5000);
      attempt++;
    }
  }

  return null;
}

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('=== WhatsApp Channel Auto React ===\n');
    
    const targetUrl = await rl.question('Masukkan Link Post Saluran: ');
    if (!targetUrl.trim()) {
      console.log('❌ Link tidak boleh kosong!');
      return;
    }

    const emojiInput = await rl.question('Masukkan Emoji (pisahkan dengan spasi atau koma, default: 😂): ');
    
    // Parsing emoji input, fallback ke ['😂'] jika dikosongkan
    const parsedEmojis = emojiInput.trim()
      ? emojiInput.split(/[\s,]+/).filter(Boolean)
      : ['😂'];

    console.log(`\nTarget URL : ${targetUrl.trim()}`);
    console.log(`Emoji List : ${parsedEmojis.join(' ')}`);

    await sendReaction(targetUrl.trim(), parsedEmojis);
  } finally {
    rl.close();
  }
}

main();

