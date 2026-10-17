const express = require('express');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const P = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');

const app = express();
app.use(express.json());

// State WA
let sock = null;
let currentQR = null;
let pairingCode = null;
let isConnected = false;

// ==========================================
// HTML UI (3D Animasi Glassmorphism)
// ==========================================
const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bara x Aurelia | System</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root { --primary: #a855f7; --bg: #050505; }
        body { margin: 0; font-family: 'Inter', sans-serif; background-color: var(--bg); color: white; overflow-x: hidden; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .font-tech { font-family: 'Orbitron', sans-serif; }
        .grid-bg {
            position: fixed; inset: 0; z-index: -1;
            background-image: linear-gradient(rgba(168, 85, 247, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(168, 85, 247, 0.1) 1px, transparent 1px);
            background-size: 40px 40px; transform: perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px); animation: gridMove 5s linear infinite;
        }
        @keyframes gridMove { 0% { transform: perspective(500px) rotateX(60deg) translateY(0) translateZ(-200px); } 100% { transform: perspective(500px) rotateX(60deg) translateY(40px) translateZ(-200px); } }
        .glass { background: rgba(15, 15, 25, 0.85); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8); }
        .slide-up { animation: slideUp 0.4s ease-out forwards; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .glow-text { text-shadow: 0 0 20px rgba(168, 85, 247, 0.8); }
        .input-neon { background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(168, 85, 247, 0.3); transition: all 0.3s; color: white; width: 100%; padding: 0.75rem 1rem; border-radius: 0.75rem; }
        .input-neon:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 15px rgba(168, 85, 247, 0.4); }
        .hidden { display: none !important; }
    </style>
</head>
<body>
    <div class="grid-bg"></div>
    <div class="glass w-full max-w-md p-8 rounded-3xl relative z-10 slide-up shadow-[0_0_50px_rgba(168,85,247,0.15)]">
        <div class="text-center mb-8 border-b border-white/10 pb-6">
            <h1 class="font-tech text-3xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-2 glow-text">BARA x AURELIA</h1>
            <p class="text-xs text-gray-500 tracking-widest uppercase">© 2026 System Official</p>
        </div>

        <div id="step1" class="slide-up">
            <h2 class="font-tech text-xl mb-2 text-center text-white">Selamat Datang</h2>
            <p class="text-sm text-gray-400 text-center mb-6">Masukkan nomor WhatsApp kamu</p>
            <form id="form-phone" class="space-y-4">
                <input type="text" id="input-phone" placeholder="6281234567890" class="input-neon" required>
                <button type="submit" class="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-xl hover:opacity-90">Lanjutkan</button>
            </form>
        </div>

        <div id="step2" class="hidden space-y-3">
            <h2 class="font-tech text-xl mb-4 text-center text-white">Menu Utama</h2>
            <button onclick="alert('Coming Soon!')" class="w-full flex items-center gap-4 p-4 bg-black/40 border border-white/10 rounded-xl hover:border-purple-500/50 text-left">
                <div class="bg-purple-500/20 p-3 rounded-lg text-purple-400"><i data-lucide="map-pin"></i></div>
                <div><h3 class="font-bold text-white">Lacak</h3><p class="text-xs text-gray-500">Coming Soon</p></div>
            </button>
            <button onclick="goToStep(3)" class="w-full flex items-center gap-4 p-4 bg-black/40 border border-white/10 rounded-xl hover:border-pink-500/50 text-left">
                <div class="bg-pink-500/20 p-3 rounded-lg text-pink-400"><i data-lucide="lock"></i></div>
                <div><h3 class="font-bold text-white">Lock Chat</h3><p class="text-xs text-gray-500">Efek JavaScript</p></div>
            </button>
            <button onclick="goToStep(4)" class="w-full flex items-center gap-4 p-4 bg-black/40 border border-white/10 rounded-xl hover:border-blue-500/50 text-left">
                <div class="bg-blue-500/20 p-3 rounded-lg text-blue-400"><i data-lucide="send"></i></div>
                <div><h3 class="font-bold text-white">Sender</h3><p class="text-xs text-gray-500">Koneksi WhatsApp</p></div>
            </button>
        </div>

        <div id="step3" class="hidden space-y-4">
            <h2 class="font-tech text-xl mb-4 text-center text-white flex items-center justify-center gap-2"><i data-lucide="lock" class="text-pink-500"></i> Lock Chat</h2>
            <input type="text" id="input-target" placeholder="Nomor target (628xxx)" class="input-neon">
            <input type="text" id="input-target-name" placeholder="Nama target (opsional)" class="input-neon">
            <button id="btn-lock" onclick="sendLockChat()" class="w-full bg-gradient-to-r from-pink-600 to-red-600 text-white font-bold py-3 rounded-xl hover:opacity-90">Mulai Lock Chat</button>
            <button onclick="goToStep(2)" class="w-full text-gray-500 text-sm flex justify-center gap-1">Kembali</button>
        </div>

        <div id="step4" class="hidden space-y-4">
            <h2 class="font-tech text-xl mb-4 text-center text-white flex items-center justify-center gap-2"><i data-lucide="send" class="text-blue-500"></i> Sender WA</h2>
            <div class="flex bg-black/40 p-1 rounded-xl border border-white/10">
                <button id="btn-qr" onclick="setMethod('qr')" class="flex-1 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white">QR Code</button>
                <button id="btn-pairing" onclick="setMethod('pairing')" class="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-400">Pairing</button>
            </div>
            <button id="btn-connect" onclick="connectWA()" class="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3 rounded-xl">Hubungkan Device</button>
            <div id="result-box" class="hidden bg-black/80 p-4 rounded-xl border border-white/10 text-center"></div>
            <button onclick="goToStep(2)" class="w-full text-gray-500 text-sm flex justify-center gap-1">Kembali</button>
        </div>
    </div>

    <script>
        lucide.createIcons();
        let phone = "", method = "qr";
        function goToStep(s) {
            document.querySelectorAll('[id^="step"]').forEach(el => el.classList.add('hidden'));
            document.getElementById('step' + s).classList.remove('hidden');
        }
        document.getElementById('form-phone').addEventListener('submit', (e) => {
            e.preventDefault();
            phone = document.getElementById('input-phone').value.replace(/\\D/g, '');
            if (!phone.startsWith("62")) return alert("Wajib 62!");
            goToStep(2);
        });
        function setMethod(m) {
            method = m;
            document.getElementById('btn-qr').className = \`flex-1 py-2 rounded-lg text-sm font-semibold \${m === 'qr' ? 'bg-blue-600 text-white' : 'text-gray-400'}\`;
            document.getElementById('btn-pairing').className = \`flex-1 py-2 rounded-lg text-sm font-semibold \${m === 'pairing' ? 'bg-blue-600 text-white' : 'text-gray-400'}\`;
        }
        async function connectWA() {
            const btn = document.getElementById('btn-connect'), resBox = document.getElementById('result-box');
            btn.innerHTML = 'Menghubungkan...'; resBox.classList.add('hidden');
            try {
                const res = await fetch('/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, method }) });
                const data = await res.json();
                resBox.classList.remove('hidden');
                if (!data.ok) throw new Error(data.error);
                if (data.qr) resBox.innerHTML = \`<p class="text-green-400 mb-2">Scan QR:</p><img src="\${data.qr}" class="w-48 h-48 mx-auto bg-white p-2 rounded">\`;
                else if (data.code) resBox.innerHTML = \`<p class="text-green-400 mb-2">Pairing:</p><p class="text-3xl font-black text-white">\${data.code}</p>\`;
            } catch (err) {
                resBox.classList.remove('hidden'); resBox.innerHTML = \`<p class="text-red-400">❌ \${err.message}</p>\`;
            }
            btn.innerHTML = 'Hubungkan Device';
        }
        async function sendLockChat() {
            const target = document.getElementById('input-target').value.replace(/\\D/g, '');
            const targetName = document.getElementById('input-target-name').value;
            if (!target) return alert("Target kosong!");
            const btn = document.getElementById('btn-lock'); btn.innerHTML = 'Mengirim...';
            try {
                const res = await fetch('/api/lockchat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target, targetName }) });
                const data = await res.json();
                if (data.ok) alert("✅ " + data.message); else throw new Error(data.error);
            } catch (err) { alert("❌ " + err.message); }
            btn.innerHTML = 'Mulai Lock Chat';
        }
    </script>
</body>
</html>
`;

app.get('/', (req, res) => res.send(htmlContent));

// ==========================================
// API ENDPOINTS
// ==========================================

app.post('/api/connect', async (req, res) => {
    const { phone, method } = req.body;
    if (!phone || !phone.startsWith('62')) return res.status(400).json({ ok: false, error: 'Nomor wajib 62' });

    try {
        currentQR = null; pairingCode = null; isConnected = false;
        
        // PENTING: Hapus folder session lama agar tidak bentrok saat pairing
        // Gunakan path /data jika di Render (Persistent Disk)
        const sessionPath = `/data/session_${phone}`;
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        
        sock = makeWASocket({
            auth: state, 
            printQRInTerminal: false, 
            logger: P({ level: 'silent' }), 
            // PENTING: Browser harus kanonik agar notif pairing muncul 
            browser: Browsers.macOS('Chrome'), 
        });

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) currentQR = await QRCode.toDataURL(qr);
            if (connection === 'close') isConnected = false;
            else if (connection === 'open') { 
                isConnected = true; 
                currentQR = null; 
                pairingCode = null; 
                console.log(`[${phone}] CONNECTED!`);
            }
        });

        // PENTING: Logika Pairing yang Benar (Tunggu hingga socket siap / QR muncul) 
        if (method === 'pairing' && !sock.authState.creds.registered) {
            // Tunggu hingga socket benar-benar siap (QR terdeteksi)
            let attempts = 0;
            while (!currentQR && attempts < 20) { 
                await new Promise(r => setTimeout(r, 500)); 
                attempts++; 
            }

            // Request pairing code SETELAH socket siap
            try {
                pairingCode = await sock.requestPairingCode(phone);
                return res.json({ ok: true, status: 'pairing', code: pairingCode });
            } catch (err) {
                return res.status(500).json({ ok: false, error: err.message });
            }
        } else {
            // QR Logic
            let attempts = 0;
            while (!currentQR && attempts < 20) { 
                await new Promise(r => setTimeout(r, 500)); 
                attempts++; 
            }
            if (currentQR) return res.json({ ok: true, status: 'qr', qr: currentQR });
            return res.status(500).json({ ok: false, error: 'Timeout QR' });
        }
    } catch (err) { return res.status(500).json({ ok: false, error: err.message }); }
});

app.post('/api/lockchat', async (req, res) => {
    const { target, targetName } = req.body;
    if (!sock || !isConnected) return res.status(400).json({ ok: false, error: 'WA belum konek!' });
    if (!target) return res.status(400).json({ ok: false, error: 'Target kosong' });

    try {
        const jid = `${target}@s.whatsapp.net`;
        const rtl = '\u202E', zwsp = '\u200B';
        const payload = `${rtl}${zwsp.repeat(30)}\nJavaScript\n😀😀😀😀😀\n${zwsp.repeat(50)}\n\`\`\`\n[SYSTEM LOCKED BY BARA x AURELIA]\nTarget: ${targetName || target}\nChat dibekukan.\`\`\``;
        await sock.sendMessage(jid, { text: payload });
        return res.json({ ok: true, message: 'Efek Lock Chat terkirim!' });
    } catch (err) { return res.status(500).json({ ok: false, error: err.message }); }
});

// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('\n=========================================');
    console.log('🔥 BARA x AURELIA SERVER RUNNING 🔥');
    console.log(`🌐 Port: ${PORT}`);
    console.log('=========================================\n');
});
