const { Client, LocalAuth } = require('whatsapp-web.js');
const sessions = {};
const { executablePath } = require('puppeteer');
const qrcode = require('qrcode');
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let qrBase64 = null;
let isReady = false;

// Inisialisasi WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: executablePath()
    }
});


// Event: QR code baru muncul
client.on('qr', async (qr) => {
    try {
        qrBase64 = await qrcode.toDataURL(qr);
        isReady = false;
        console.log('📲 QR tersedia, scan dengan WhatsApp');
    } catch (err) {
        console.error('❌ Gagal konversi QR ke base64:', err);
    }
});

// Event: WhatsApp siap digunakan
client.on('ready', () => {
    isReady = true;
    console.log('✅ WhatsApp siap digunakan!');
});

// Event: berhasil login
client.on('authenticated', () => {
    console.log('🔐 Autentikasi berhasil');
});

// Event: koneksi putus
client.on('disconnected', (reason) => {
    isReady = false;
    qrBase64 = null;
    console.log('❌ Terputus:', reason);
});

// Mulai client WhatsApp
client.initialize();

// Endpoint: Ambil QR Code & Status
app.get('/qr', (req, res) => {
    res.json({
        status: isReady ? 'ready' : 'waiting',
        qr: isReady ? null : qrBase64
    });
});

// Endpoint: Kirim pesan WA
app.post('/persensi/send', async (req, res) => {
    const { number, message } = req.body;

    if (!number || !message) {
        return res.status(400).json({ error: 'Nomor dan pesan wajib diisi.' });
    }

    if (!isReady) {
        return res.status(503).json({ error: 'WhatsApp client belum siap.' });
    }

    const formattedNumber = number.replace(/\D/g, '') + '@c.us';

    try {
        const id = await client.getNumberId(formattedNumber);
        if (!id) {
            return res.status(404).json({ error: 'Nomor tidak terdaftar di WhatsApp' });
        }

        await client.sendMessage(id._serialized, message);
        console.log(`📤 Pesan terkirim ke ${formattedNumber}`);
        res.json({ success: true, message: 'Pesan berhasil dikirim' });

    } catch (err) {
        console.error('❌ Gagal kirim pesan:', err);
        res.status(500).json({ error: 'Gagal kirim pesan', details: err.message });
    }
});

// Jalankan server Node.js
app.listen(port, () => {
    console.log(`🌐 Server berjalan di http://localhost:${port}`);
});

