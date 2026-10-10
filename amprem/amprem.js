const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Files to store session cookies and results
const SESSION_FILE = path.join(__dirname, '.session.json');
const RESULTS_FILE = path.join(__dirname, 'results.json');

// Color helpers for terminal output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  fgBlack: '\x1b[30m',
  fgRed: '\x1b[31m',
  fgGreen: '\x1b[32m',
  fgYellow: '\x1b[33m',
  fgBlue: '\x1b[34m',
  fgMagenta: '\x1b[35m',
  fgCyan: '\x1b[36m',
  fgWhite: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

function log(color, message) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function promptQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans.trim());
  }));
}

// Generate random string
function generateRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Save session info
function saveSession(cookies, username) {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookies, username, timestamp: Date.now() }), 'utf-8');
  } catch (err) {
    log(COLORS.fgRed, `[-] Gagal menyimpan sesi: ${err.message}`);
  }
}

// Load saved session
function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      // Keep sessions valid for 24 hours
      if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
        return data;
      }
    }
  } catch (err) {
    // Ignore error
  }
  return null;
}

// Delete session
function clearSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
  } catch (err) {
    // Ignore error
  }
}

// Save premium accounts to results.json
function saveResult(account) {
  try {
    let results = [];
    if (fs.existsSync(RESULTS_FILE)) {
      try {
        results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
        if (!Array.isArray(results)) results = [];
      } catch (e) {
        results = [];
      }
    }
    results.push(account);
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2), 'utf-8');
  } catch (err) {
    log(COLORS.fgRed, `[-] Gagal menyimpan hasil: ${err.message}`);
  }
}

// Fetch helper that automatically retries on 503 database preparing state
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 503) {
        log(COLORS.fgYellow, `[*] Database sedang bersiap (delay serverless). Mencoba kembali dalam 3 detik... (${i + 1}/${retries})`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      return response;
    } catch (err) {
      if (i === retries) throw err;
      log(COLORS.fgYellow, `[*] Kesalahan jaringan: ${err.message}. Mencoba kembali... (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error('Server tidak merespon setelah beberapa kali percobaan (503).');
}

// Auto Register a new Ryezen account using random hash
async function autoRegisterNewAccount() {
  const randomUsername = `prabowo_${generateRandomString(8)}`;
  const randomPassword = `dar${generateRandomString(10)}`;
  
  log(COLORS.fgYellow, `[*] Mendaftarkan akun Ryezen baru secara otomatis: ${randomUsername} ...`);
  try {
    const res = await fetchWithRetry('https://www.ryezenstore.online/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ username: randomUsername, password: randomPassword })
    });

    const data = await res.json();
    if (res.ok) {
      log(COLORS.fgGreen, `[+] Pendaftaran otomatis sukses! Memperoleh session cookie...`);
      
      // Auto Login
      const loginRes = await fetchWithRetry('https://www.ryezenstore.online/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({ username: randomUsername, password: randomPassword })
      });

      if (loginRes.ok) {
        const cookiesList = loginRes.headers.getSetCookie();
        if (cookiesList && cookiesList.length > 0) {
          const sessionCookie = cookiesList.map(c => c.split(';')[0]).join('; ');
          log(COLORS.fgGreen, `[+] Login otomatis sukses untuk akun: ${randomUsername}`);
          saveSession(sessionCookie, randomUsername);
          return sessionCookie;
        }
      }
    } else {
      log(COLORS.fgRed, `[-] Registrasi otomatis gagal: ${data.error || 'Server error.'}`);
    }
  } catch (err) {
    log(COLORS.fgRed, `[-] Kesalahan saat registrasi otomatis: ${err.message}`);
  }
  return null;
}

// Login operation
async function loginFlow() {
  log(COLORS.fgCyan, '\n==================================================');
  log(COLORS.fgCyan + COLORS.bright, '       LOGIN KE RYEZENSTORE.ONLINE                ');
  log(COLORS.fgCyan, '==================================================');
  
  const username = await promptQuestion('Masukkan Username: ');
  if (!username) {
    log(COLORS.fgRed, '[-] Username tidak boleh kosong!');
    return null;
  }
  
  const password = await promptQuestion('Masukkan Password: ');
  if (!password) {
    log(COLORS.fgRed, '[-] Password tidak boleh kosong!');
    return null;
  }

  log(COLORS.fgYellow, '\n[*] Melakukan autentikasi...');
  try {
    const res = await fetchWithRetry('https://www.ryezenstore.online/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok) {
      const cookiesList = res.headers.getSetCookie();
      if (!cookiesList || cookiesList.length === 0) {
        log(COLORS.fgRed, '[-] Server login sukses, tetapi tidak mengirimkan session cookie.');
        return null;
      }
      
      const sessionCookie = cookiesList.map(c => c.split(';')[0]).join('; ');
      log(COLORS.fgGreen + COLORS.bright, `[+] Login Berhasil! Halo, ${username}.`);
      saveSession(sessionCookie, username);
      return sessionCookie;
    } else {
      log(COLORS.fgRed, `[-] Login Gagal: ${data.error || 'Password atau Username salah.'}`);
    }
  } catch (err) {
    log(COLORS.fgRed, `[-] Kesalahan saat Login: ${err.message}`);
  }
  return null;
}

// Fetch profile information
async function getProfile(cookie) {
  try {
    const res = await fetchWithRetry('https://www.ryezenstore.online/api/auth/profile', {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (res.ok) {
      const data = await res.json();
      return data.user;
    }
  } catch (err) {
    // Ignore error
  }
  return null;
}

// Generate single AM premium account (Returns account object or null)
async function generateSinglePremium(cookie) {
  // Step 1: Generate temporary email using custom vercel api
  let emailAddr = '';
  try {
    const mailRes = await fetch('https://creatett-seven.vercel.app/api/tempmail/create');
    const mailData = await mailRes.json();
    if (!mailData || !mailData.email) {
      throw new Error('API tempmail tidak mengembalikan email valid.');
    }
    emailAddr = mailData.email;
    log(COLORS.fgGreen, `[+] Email Sementara: ${emailAddr}`);
  } catch (err) {
    log(COLORS.fgRed, `[-] Gagal membuat email sementara: ${err.message}`);
    return null;
  }

  // Step 2: Trigger Ryezen Store to send verification email
  try {
    const sendRes = await fetchWithRetry('https://www.ryezenstore.online/api/am/send-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ email: emailAddr })
    });

    const sendData = await sendRes.json();
    if (!sendRes.ok) {
      log(COLORS.fgRed, `[-] Gagal memicu pengiriman email: ${sendData.error || 'Server error.'}`);
      // Return details if credits are exhausted
      if (sendRes.status === 400 || (sendData.error && sendData.error.toLowerCase().includes('kredit'))) {
        return { error: 'kredit_habis' };
      }
      return null;
    }
    log(COLORS.fgGreen, `[+] Server berhasil mengirim email verifikasi!`);
  } catch (err) {
    log(COLORS.fgRed, `[-] Gagal memicu pengiriman email: ${err.message}`);
    return null;
  }

  // Step 3: Poll the inbox
  let magicLink = '';
  const maxPolls = 15; // 75 seconds timeout
  for (let poll = 1; poll <= maxPolls; poll++) {
    log(COLORS.dim, `[*] Memeriksa kotak masuk... (${poll}/${maxPolls})`);
    try {
      const listRes = await fetch(`https://creatett-seven.vercel.app/api/tempmail/inbox/${emailAddr}`);
      const messages = await listRes.json();
      
      if (Array.isArray(messages) && messages.length > 0) {
        // Scan each message to extract Alight Motion URL
        for (const msg of messages) {
          const emailString = JSON.stringify(msg).replace(/\\/g, '');
          const linkRegex = /https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?:alightcreative\.com|alight\.link|alightmotion\.com)\/[^\s"'>]*/;
          const match = emailString.match(linkRegex);
          
          if (match) {
            magicLink = match[0].replace(/&/g, '&'); // Decode HTML entities
            log(COLORS.fgGreen, `[+] Tautan Verifikasi Ditemukan: ${magicLink}`);
            break;
          }
        }
        
        if (magicLink) break;
      }
    } catch (err) {
      log(COLORS.fgRed, `[-] Kesalahan saat polling inbox: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 5000));
  }

  if (!magicLink) {
    log(COLORS.fgRed, '[-] Timeout: Email verifikasi tidak kunjung tiba atau tautan gagal diekstrak.');
    return null;
  }

  // Step 4: Submit to activate
  try {
    const actRes = await fetchWithRetry('https://www.ryezenstore.online/api/am/activate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ email: emailAddr, magicLink: magicLink })
    });

    const actData = await actRes.json();
    if (actRes.ok) {
      log(COLORS.fgGreen + COLORS.bright, `[+] Akun Premium Berhasil Diaktifkan!`);
      const inboxUrl = `https://creatett-seven.vercel.app/?email=${emailAddr}`;
      return {
        email: emailAddr,
        inboxUrl: inboxUrl,
        magicLink: magicLink,
        status: 'success',
        message: actData.message || 'Lisensi Berhasil Ditambahkan',
        createdAt: new Date().toISOString()
      };
    } else {
      log(COLORS.fgRed, `[-] Gagal menerapkan lisensi: ${actData.error || 'Server error.'}`);
      if (actRes.status === 400 || (actData.error && actData.error.toLowerCase().includes('kredit'))) {
        return { error: 'kredit_habis' };
      }
    }
  } catch (err) {
    log(COLORS.fgRed, `[-] Kesalahan saat menerapkan lisensi: ${err.message}`);
  }
  return null;
}

// Bulk generation workflow
async function bulkGeneratorFlow(initialCookie) {
  log(COLORS.fgCyan, '\n==================================================');
  log(COLORS.fgCyan + COLORS.bright, '      MULAI GENERATOR BULK (CREATE BANYAK)        ');
  log(COLORS.fgCyan, '==================================================');

  const countInput = await promptQuestion('Berapa banyak akun premium Alight Motion yang ingin dibuat?: ');
  const totalTarget = parseInt(countInput, 10);
  if (isNaN(totalTarget) || totalTarget <= 0) {
    log(COLORS.fgRed, '[-] Jumlah pembuatan harus berupa angka positif!');
    return;
  }

  let cookie = initialCookie;
  let successCount = 0;
  const currentBatchResults = [];

  log(COLORS.fgYellow, `\n[*] Memulai proses bulk untuk membuat ${totalTarget} akun premium...\n`);

  while (successCount < totalTarget) {
    log(COLORS.fgCyan, `\n------------------ [ Proses Akun ke-${successCount + 1} / ${totalTarget} ] ------------------`);
    
    // Check profile before each step
    let profile = await getProfile(cookie);
    if (!profile || profile.credits === 0) {
      log(COLORS.fgYellow, `[!] Sesi saat ini tidak valid atau kredit habis (0). Merotasi ke akun baru...`);
      const newCookie = await autoRegisterNewAccount();
      if (!newCookie) {
        log(COLORS.fgRed, '[-] Fatal: Gagal melakukan pendaftaran akun otomatis untuk rotasi. Menghentikan bulk.');
        break;
      }
      cookie = newCookie;
      continue;
    }

    log(COLORS.fgCyan, `[Akun Ryezen Aktif: ${profile.username} | Sisa Kredit: ${profile.credits === -1 || profile.role === 'admin' ? 'Unlimited' : profile.credits}]`);
    
    const result = await generateSinglePremium(cookie);
    
    if (result) {
      if (result.error === 'kredit_habis') {
        log(COLORS.fgYellow, `[!] Kredit pada akun ini telah habis sewaktu request. Memutar akun...`);
        // Force register a new account on next loop
        cookie = await autoRegisterNewAccount();
        if (!cookie) {
          log(COLORS.fgRed, '[-] Fatal: Gagal melakukan rotasi akun setelah kredit habis. Menghentikan bulk.');
          break;
        }
      } else {
        successCount++;
        currentBatchResults.push(result);
        saveResult(result);
        log(COLORS.fgGreen + COLORS.bright, `[+] Sukses (${successCount}/${totalTarget}) : ${result.email}`);
      }
    } else {
      log(COLORS.fgRed, '[-] Percobaan pembuatan gagal. Mencoba kembali...');
      // Brief sleep before retrying
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  log(COLORS.fgCyan, '\n==================================================');
  log(COLORS.fgCyan + COLORS.bright, '          PROSES BULK SELESAI                     ');
  log(COLORS.fgCyan, '==================================================');
  log(COLORS.fgGreen + COLORS.bright, `[+] Total Berhasil: ${successCount} / ${totalTarget}`);
  log(COLORS.dim, `    Seluruh hasil telah ditambahkan ke: results.json`);
  
  // Output JSON formatting
  console.log('\nResult (JSON Output):');
  console.log(JSON.stringify(currentBatchResults, null, 2));
}

// Manual mode verification (custom email + paste link)
async function manualVerification(cookie) {
  log(COLORS.fgCyan, '\n==================================================');
  log(COLORS.fgCyan + COLORS.bright, '       PROSES LISENSI SEMI-OTOMATIS (MANUAL)      ');
  log(COLORS.fgCyan, '==================================================');

  const emailAddr = await promptQuestion('Masukkan Email Target Anda: ');
  if (!emailAddr) {
    log(COLORS.fgRed, '[-] Email tidak boleh kosong!');
    return;
  }

  log(COLORS.fgYellow, `[*] Mengirim link verifikasi ke: ${emailAddr}...`);
  try {
    const sendRes = await fetchWithRetry('https://www.ryezenstore.online/api/am/send-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ email: emailAddr })
    });

    const sendData = await sendRes.json();
    if (!sendRes.ok) {
      log(COLORS.fgRed, `[-] Gagal memicu pengiriman email: ${sendData.error || 'Server error.'}`);
      return;
    }
    log(COLORS.fgGreen, `[+] Email verifikasi sukses terkirim!`);
    log(COLORS.fgYellow, `[!] Silakan buka inbox email ${emailAddr}.`);
    log(COLORS.fgYellow, `[!] Temukan email dari Alight Motion, klik kanan/tahan tombol verifikasi dan pilih 'Salin Link'.`);
  } catch (err) {
    log(COLORS.fgRed, `[-] Gagal memicu pengiriman email: ${err.message}`);
    return;
  }

  const magicLinkInput = await promptQuestion('\nTempelkan Tautan Verifikasi Di Sini: ');
  if (!magicLinkInput) {
    log(COLORS.fgRed, '[-] Tautan verifikasi tidak boleh kosong!');
    return;
  }

  const magicLink = magicLinkInput.replace(/&/g, '&'); // Clean link
  
  log(COLORS.fgYellow, `[*] Memproses aktivasi lisensi...`);
  try {
    const actRes = await fetchWithRetry('https://www.ryezenstore.online/api/am/activate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ email: emailAddr, magicLink: magicLink })
    });

    const actData = await actRes.json();
    if (actRes.ok) {
      log(COLORS.fgGreen + COLORS.bright, `\n[+] SUKSES! Lisensi premium untuk ${emailAddr} berhasil diaktifkan!`);
      log(COLORS.dim, `    Pesan: ${actData.message || 'Berhasil'}`);
      
      const inboxUrl = `https://creatett-seven.vercel.app/?email=${emailAddr}`;
      saveResult({
        email: emailAddr,
        inboxUrl: inboxUrl,
        magicLink: magicLink,
        status: 'success',
        message: actData.message || 'Lisensi Berhasil Ditambahkan',
        createdAt: new Date().toISOString()
      });
    } else {
      log(COLORS.fgRed, `[-] Gagal menerapkan lisensi: ${actData.error || 'Server error.'}`);
    }
  } catch (err) {
    log(COLORS.fgRed, `[-] Kesalahan saat menerapkan lisensi: ${err.message}`);
  }
}

// Main interactive loop
async function main() {
  log(COLORS.fgCyan + COLORS.bright, `
  ██╗  ██╗  █████╗  ██╗██████╗   █████╗  ██████╗ 
  ██║  ██║██╔══██╗██║██╔══██╗██╔══██╗██╔══██╗
  ███████║███████║██║██║  ██║███████║██████╔╝
  ██╔══██║██╔══██║██║██║  ██║██╔══██║██╔══██╗
  ██║  ██║██║  ██║██║██████╔╝██║  ██║██║  ██║
  ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
  Creator Manual & Auto Scraper Client (HAIDAR Bulk V2)
  `);

  let session = loadSession();
  let cookie = session ? session.cookies : null;

  if (cookie) {
    log(COLORS.fgGreen, `[*] Ditemukan sesi aktif untuk: ${session.username}`);
    log(COLORS.fgYellow, `[*] Memverifikasi sesi...`);
    const profile = await getProfile(cookie);
    if (profile) {
      log(COLORS.fgGreen + COLORS.bright, `[+] Sesi valid! Selamat datang kembali, ${profile.username}.`);
      log(COLORS.fgCyan, `    [Kredit: ${profile.credits === -1 || profile.role === 'admin' ? 'Unlimited' : profile.credits} | Role: ${profile.role}]`);
    } else {
      log(COLORS.fgRed, `[-] Sesi lama sudah kadaluarsa.`);
      clearSession();
      cookie = null;
    }
  }

  // Initial Menu if not logged in
  while (!cookie) {
    log(COLORS.fgCyan, '\n==================================================');
    log(COLORS.fgCyan + COLORS.bright, '               PILIHAN AUTENTIKASI                ');
    log(COLORS.fgCyan, '==================================================');
    console.log('1. Login Akun Lama');
    console.log('2. Daftar Akun Baru (Register)');
    console.log('3. Buat Akun Acak Baru Secara Otomatis');
    console.log('4. Keluar');
    
    const initialChoice = await promptQuestion('\nPilih menu (1-4): ');
    
    if (initialChoice === '1') {
      cookie = await loginFlow();
    } else if (initialChoice === '2') {
      const regRes = await autoRegisterNewAccount(); // uses default prompt in flow
      if (regRes) cookie = regRes;
    } else if (initialChoice === '3') {
      cookie = await autoRegisterNewAccount();
    } else if (initialChoice === '4') {
      log(COLORS.fgYellow, '[*] Keluar dari aplikasi.');
      process.exit(0);
    } else {
      log(COLORS.fgRed, '[-] Pilihan tidak valid.');
    }
  }

  // Active loop
  while (true) {
    const profile = await getProfile(cookie);
    log(COLORS.fgCyan, '\n==================================================');
    log(COLORS.fgCyan + COLORS.bright, ` MENU UTAMA (Logged in as: ${profile ? profile.username : 'User'})`);
    if (profile) {
      log(COLORS.fgCyan, ` Detail Akun: Kredit = ${profile.credits === -1 || profile.role === 'admin' ? 'Unlimited' : profile.credits} | Role = ${profile.role}`);
    }
    log(COLORS.fgCyan, '==================================================');
    console.log('1. Buat Akun AM Premium Secara BULK (Otomatis - Rotasi Akun)');
    console.log('2. Buat Akun AM Premium Satuan (Manual - Custom Email)');
    console.log('3. Bersihkan Sesi (Logout)');
    console.log('4. Keluar');
    
    const choice = await promptQuestion('\nPilih menu (1-4): ');
    
    if (choice === '1') {
      await bulkGeneratorFlow(cookie);
    } else if (choice === '2') {
      await manualVerification(cookie);
    } else if (choice === '3') {
      clearSession();
      cookie = null;
      log(COLORS.fgYellow, '[+] Sesi berhasil dibersihkan. Silakan login kembali.');
      while (!cookie) {
        log(COLORS.fgCyan, '\n==================================================');
        log(COLORS.fgCyan + COLORS.bright, '               PILIHAN AUTENTIKASI                ');
        log(COLORS.fgCyan, '==================================================');
        console.log('1. Login Akun Lama');
        console.log('2. Daftar Akun Baru (Register)');
        console.log('3. Buat Akun Acak Baru Secara Otomatis');
        console.log('4. Keluar');
        
        const initialChoice = await promptQuestion('\nPilih menu (1-4): ');
        
        if (initialChoice === '1') {
          cookie = await loginFlow();
        } else if (initialChoice === '2') {
          cookie = await autoRegisterNewAccount();
        } else if (initialChoice === '3') {
          cookie = await autoRegisterNewAccount();
        } else if (initialChoice === '4') {
          log(COLORS.fgYellow, '[*] Keluar dari aplikasi.');
          process.exit(0);
        } else {
          log(COLORS.fgRed, '[-] Pilihan tidak valid.');
        }
      }
    } else if (choice === '4') {
      log(COLORS.fgYellow, '[*] Sampai jumpa!');
      break;
    } else {
      log(COLORS.fgRed, '[-] Pilihan tidak valid.');
    }
    
    await promptQuestion('\nTekan ENTER untuk kembali ke menu utama...');
  }
}

main().catch(err => {
  log(COLORS.fgRed, `[-] Fatal Error: ${err.message}`);
  process.exit(1);
});

