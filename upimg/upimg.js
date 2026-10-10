const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const readline = require('readline');

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dtz0urit6/auto/upload';
const SIGN_URL = 'https://cloudinary-tools.netlify.app/.netlify/functions/sign-upload-params';
const API_KEY = '985946268373735';
const UPLOAD_PRESET = 'cloudinary-tools';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(q) {
    return new Promise(r => rl.question(q, r));
}

async function getSignature() {
    const timestamp = Math.floor(Date.now() / 1000);
    const { data } = await axios.post(SIGN_URL, {
        paramsToSign: { timestamp, upload_preset: UPLOAD_PRESET, source: 'ml' }
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://cloudinary-tools.netlify.app',
            'Referer': 'https://cloudinary-tools.netlify.app/',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
        }
    });
    return { signature: data.signature, timestamp };
}

async function upload(filePath, sig) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('upload_preset', UPLOAD_PRESET);
    form.append('source', 'ml');
    form.append('api_key', API_KEY);
    form.append('signature', sig.signature);
    form.append('timestamp', sig.timestamp);

    const { data } = await axios.post(CLOUDINARY_URL, form, {
        headers: {
            ...form.getHeaders(),
            'Origin': 'https://upload-widget.cloudinary.com',
            'Referer': 'https://upload-widget.cloudinary.com/',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
        }
    });
    return data;
}

async function downloadUpscaled(publicId) {
    const url = `https://res.cloudinary.com/dtz0urit6/image/upload/f_jpg,e_upscale,q_auto/${publicId}.jpg`;
    const outFile = `./upscaled_${Date.now()}.jpg`;

    const writer = fs.createWriteStream(outFile);
    const res = await axios({ method: 'get', url, responseType: 'stream' });
    res.data.pipe(writer);

    await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });

    return outFile;
}

async function main() {
    const input = await ask('Path gambar: ');
    const filePath = input.trim().replace(/^['"]|['"]$/g, '');

    if (!fs.existsSync(filePath)) {
        console.log('File tidak ditemukan:', filePath);
        rl.close();
        return;
    }

    try {
        const sig = await getSignature();
        const result = await upload(filePath, sig);
        const saved = await downloadUpscaled(result.public_id);
        console.log('Disimpan:', saved);
    } catch (err) {
        const msg = err.response ? JSON.stringify(err.response.data) : err.message;
        console.error('Error:', msg);
    }

    rl.close();
}

main();
