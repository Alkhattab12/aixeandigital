#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const readline = require('readline');

const DOWNLOAD_DIR = '/storage/emulated/0/Download';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const BIGJPG_API_KEY = '1d65dfe9a9b1444aa4f219889b20dc8c';

function ask(q) {
    return new Promise(r => rl.question(q, r));
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function createLoader(text) {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    const interval = setInterval(() => {
        process.stdout.write(`\r${frames[i++ % frames.length]} ${text}`);
    }, 80);

    return {
        update: (newText) => { text = newText; },
        stop: (endText = '') => {
            clearInterval(interval);
            process.stdout.write(`\r\x1b[K${endText}\n`);
        }
    };
}

function getSavePath(fileName) {
    if (!fs.existsSync(DOWNLOAD_DIR)) {
        try {
            fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
        } catch (e) {
            return `./${fileName}`;
        }
    }
    return path.join(DOWNLOAD_DIR, fileName);
}

// ==========================================
// 1. HELPER: UPLOAD CLOUDINARY (Temporary Host)
// ==========================================
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dtz0urit6/auto/upload';
const SIGN_URL = 'https://cloudinary-tools.netlify.app/.netlify/functions/sign-upload-params';
const API_KEY = '985946268373735';
const UPLOAD_PRESET = 'cloudinary-tools';

async function uploadToCloudinary(filePath) {
    const timestamp = Math.floor(Date.now() / 1000);
    const { data: sig } = await axios.post(SIGN_URL, {
        paramsToSign: { timestamp, upload_preset: UPLOAD_PRESET, source: 'ml' }
    });

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('upload_preset', UPLOAD_PRESET);
    form.append('source', 'ml');
    form.append('api_key', API_KEY);
    form.append('signature', sig.signature);
    form.append('timestamp', timestamp);

    const { data: result } = await axios.post(CLOUDINARY_URL, form, {
        headers: {
            ...form.getHeaders(),
            'Origin': 'https://upload-widget.cloudinary.com',
            'Referer': 'https://upload-widget.cloudinary.com/',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
        }
    });

    return result;
}

// ==========================================
// 2. ENGINE CLOUDINARY (e_upscale)
// ==========================================
async function processCloudinary(filePath) {
    const loader = createLoader('Cloudinary: Mengunggah gambar...');
    const result = await uploadToCloudinary(filePath);
    loader.stop('✔ Gambar terunggah ke Cloudinary.');

    const upscaleUrl = result.secure_url.replace(`/${result.resource_type}/upload/`, `/${result.resource_type}/upload/e_upscale/`);
    const renderLoader = createLoader('Cloudinary: Memproses upscale AI...');
    
    const testRes = await axios.get(upscaleUrl, {
        responseType: 'arraybuffer',
        validateStatus: () => true
    });

    if (testRes.status === 200) {
        const outFile = getSavePath(`cld_upscaled_${Date.now()}.jpg`);
        fs.writeFileSync(outFile, Buffer.from(testRes.data));
        renderLoader.stop('✔ Upscale selesai!');
        return outFile;
    } else {
        const errHeader = testRes.headers['x-cld-error'] || `HTTP ${testRes.status}`;
        renderLoader.stop(`✖ Upscale ditolak: ${errHeader}`);
        throw new Error(errHeader);
    }
}

// ==========================================
// 3. ENGINE BIGJPG (Waifu2x - 4x Upscale, None Noise)
// ==========================================
async function processBigjpg(filePath) {
    // 1. Host gambar dulu agar dapat URL publik
    const uploadLoader = createLoader('Bigjpg: Menyiapkan hosting gambar...');
    const uploadRes = await uploadToCloudinary(filePath);
    uploadLoader.stop('✔ URL publik gambar siap.');

    const imageUrl = uploadRes.secure_url;

    // 2. Kirim task ke Bigjpg (x2: "2" = 4x, noise: "-1" = None)
    const taskLoader = createLoader('Bigjpg: Mengirim task (4x, Noise: None)...');
    const payload = {
        style: 'art',
        noise: '-1',
        x2: '2',
        input: imageUrl
    };

    const taskRes = await axios.post('https://bigjpg.com/api/task/', payload, {
        headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': BIGJPG_API_KEY,
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
        }
    });

    const taskId = taskRes.data.tid;
    if (!taskId) throw new Error('Gagal mendapatkan Task ID dari Bigjpg: ' + JSON.stringify(taskRes.data));
    taskLoader.stop(`✔ Task ID didapatkan: ${taskId}`);

    // 3. Polling status render
    const renderLoader = createLoader('Bigjpg: Menunggu proses render AI...');
    const start = Date.now();
    let downloadUrl = null;

    while (Date.now() - start < 180000) { // Timeout 3 menit
        const elapsed = Math.floor((Date.now() - start) / 1000);
        renderLoader.update(`Bigjpg: Sedang me-render 4x... (${elapsed}s)`);

        try {
            const statusRes = await axios.get(`https://bigjpg.com/api/task/${taskId}`);
            const taskData = statusRes.data[taskId];

            if (taskData && taskData.status === 'ok' && taskData.url) {
                downloadUrl = taskData.url;
                renderLoader.stop(`✔ Render 4x selesai dalam ${elapsed}s!`);
                break;
            } else if (taskData && taskData.status === 'error') {
                renderLoader.stop('✖ Bigjpg gagal memproses gambar.');
                throw new Error('Server Bigjpg mengembalikan status error.');
            }
        } catch (e) {
            if (e.message.startsWith('Server Bigjpg')) throw e;
        }

        await sleep(3000);
    }

    if (!downloadUrl) throw new Error('Waktu render Bigjpg habis (Timeout).');

    // 4. Unduh hasil akhir
    const dlLoader = createLoader('Bigjpg: Mengunduh file hasil...');
    const outFile = getSavePath(`bigjpg_4x_${Date.now()}.png`);
    const res = await axios({ method: 'get', url: downloadUrl, responseType: 'stream' });
    const writer = fs.createWriteStream(outFile);
    res.data.pipe(writer);

    await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });

    dlLoader.stop('✔ Berhasil disimpan!');
    return outFile;
}

// ==========================================
// MENU UTAMA
// ==========================================
async function main() {
    console.log('=== MULTI-ENGINE IMAGE UPSCALER ===');
    const input = await ask('Path gambar: ');
    const filePath = input.trim().replace(/^['"]|['"]$/g, '');

    if (!fs.existsSync(filePath)) {
        console.log('✖ File tidak ditemukan:', filePath);
        rl.close();
        return;
    }

    console.log('\nPilih Layanan:');
    console.log('1. Cloudinary AI (Cepat)');
    console.log('2. Bigjpg Waifu2x (4x Upscale, Noise: None)');
    const choice = await ask('\nPilihan (1/2): ');

    try {
        let savedPath = '';
        if (choice.trim() === '2') {
            savedPath = await processBigjpg(filePath);
        } else {
            savedPath = await processCloudinary(filePath);
        }

        console.log(`\n🎉 Berhasil! File tersimpan di:`);
        console.log(savedPath);
    } catch (err) {
        console.error('\n✖ Terjadi Kesalahan:', err.response?.data?.message || err.message);
    }

    rl.close();
}

main();

