const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const readline = require('readline');

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dtz0urit6/auto/upload';
const SIGN_URL = 'https://cloudinary-tools.netlify.app/.netlify/functions/sign-upload-params';
const API_KEY = '985946268373735';
const UPLOAD_PRESET = 'cloudinary-tools';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

async function main() {
    const input = await ask('Path gambar: ');
    const filePath = input.trim().replace(/^['"]|['"]$/g, '');

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

    const { data: res } = await axios.post(CLOUDINARY_URL, form, {
        headers: form.getHeaders()
    });

    console.log('\n=== SEMUA DATA DARI CLOUDINARY ===');
    console.log(JSON.stringify(res, null, 2));
    rl.close();
}

main();

