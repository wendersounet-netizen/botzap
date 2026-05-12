const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const csv = require('csv-parser');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── ARQUIVO DE ESTADO ───────────────────────────────────────────────────────
const PHONES_FILE  = path.join(__dirname, 'phones.json');
const DB_FILE      = path.join(__dirname, 'registro_contatos.json');
const CONFIG_FILE  = path.join(__dirname, 'config.json');

const DEFAULT_CONFIG = {
    mensagem: `Olá, tudo bem? Me chamo Wender e trabalho com o posicionamento digital de profissionais liberais.\n\nEstava analisando o perfil da {nome} em {cidade} e notei que vocês ainda não possuem um site institucional ou Landing Page de autoridade. No setor jurídico, a falta de uma vitrine oficial acaba passando menos segurança para novos clientes que buscam especialistas no Google.\n\nEu desenvolvo sites de alto padrão que ajudam a transmitir mais credibilidade e facilitam o fechamento de contratos de maior valor. Teria 2 minutos para eu te mostrar como isso pode impactar a sua advocacia?`,
    limiteDiario: 40,
    pausaEntreMensagens: 90,
    pausaInicial: 45,
    arquivoCSV: 'advocacia1.csv'
};

// ─── HELPERS DE PERSISTÊNCIA ─────────────────────────────────────────────────
function loadConfig() {
    if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return JSON.parse(fs.readFileSync(CONFIG_FILE));
}
function saveConfig(c) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2)); }

function loadPhones() {
    if (!fs.existsSync(PHONES_FILE)) fs.writeFileSync(PHONES_FILE, JSON.stringify([], null, 2));
    return JSON.parse(fs.readFileSync(PHONES_FILE));
}
function savePhones(p) { fs.writeFileSync(PHONES_FILE, JSON.stringify(p, null, 2)); }

function loadDB() {
    if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ enviado: [], invalido: [], erro: [] }, null, 2));
    return JSON.parse(fs.readFileSync(DB_FILE));
}
function saveDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

// ─── ESTADO EM MEMÓRIA ───────────────────────────────────────────────────────
// clients[id] = { client, status, campaign: null | { sent, startTime }, paused, stopped }
const clients = {};

// ─── HELPERS DE COMUNICAÇÃO ──────────────────────────────────────────────────
function emit(event, data) { io.emit(event, data); }

function log(phoneId, type, message) {
    const entry = { phoneId, type, message, time: new Date().toISOString() };
    emit('log', entry);
    console.log(`[${phoneId}][${type}] ${message}`);
}

// ─── DELAY INTERROMPÍVEL ─────────────────────────────────────────────────────
async function waitMs(ms, stopFn) {
    const chunk = 500;
    let elapsed = 0;
    while (elapsed < ms) {
        if (stopFn && stopFn()) return true; // sinaliza que foi interrompido
        await new Promise(r => setTimeout(r, Math.min(chunk, ms - elapsed)));
        elapsed += chunk;
    }
    return false;
}

// ─── INICIALIZAR UM TELEFONE ─────────────────────────────────────────────────
async function initializePhone(phoneData) {
    const { id, label } = phoneData;
    if (clients[id]) return; // já existe

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: id, dataPath: path.join(__dirname, '.wwebjs_auth') }),
        puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    });

    clients[id] = { client, status: 'initializing', campaign: null, paused: false, stopped: false };
    emit('phone:update', { id, status: 'initializing' });

    client.on('qr', async (qr) => {
        const qrDataUrl = await QRCode.toDataURL(qr, { width: 300 });
        clients[id].status = 'qr';
        emit('phone:qr', { id, qr: qrDataUrl });
        emit('phone:update', { id, status: 'qr' });
        log(id, 'info', '📱 QR Code gerado. Aguardando escaneamento...');
    });

    client.on('ready', async () => {
        clients[id].status = 'ready';
        const info = client.info;
        const number = info?.wid?.user || null;

        const phones = loadPhones();
        const phone = phones.find(p => p.id === id);
        if (phone) {
            phone.number = number;
            phone.connectedAt = new Date().toISOString();
            savePhones(phones);
        }

        emit('phone:update', { id, status: 'ready', number });
        log(id, 'success', `✅ Conectado! Número: +${number}`);
    });

    client.on('disconnected', (reason) => {
        clients[id].status = 'disconnected';
        clients[id].campaign = null;
        emit('phone:update', { id, status: 'disconnected', campaign: null });
        log(id, 'warn', `🔌 Desconectado: ${reason}`);
    });

    client.on('auth_failure', () => {
        clients[id].status = 'auth_failed';
        emit('phone:update', { id, status: 'auth_failed' });
        log(id, 'error', '❌ Falha de autenticação. Remova e adicione o telefone novamente.');
    });

    try {
        await client.initialize();
    } catch (err) {
        clients[id].status = 'error';
        emit('phone:update', { id, status: 'error' });
        log(id, 'error', `⚠️ Erro ao inicializar: ${err.message}`);
    }
}

// ─── CAMPANHA ────────────────────────────────────────────────────────────────
async function runCampaign(phoneId) {
    const config = loadConfig();
    const cd = clients[phoneId];

    cd.campaign = { sent: 0, startTime: new Date().toISOString() };
    cd.paused   = false;
    cd.stopped  = false;
    emit('phone:update', { id: phoneId, campaign: cd.campaign, paused: false });

    const isStopped = () => cd.stopped;

    log(phoneId, 'info', `🚀 Campanha iniciada. Sincronizando (${config.pausaInicial}s)...`);
    if (await waitMs(config.pausaInicial * 1000, isStopped)) {
        log(phoneId, 'warn', '⏹️ Campanha encerrada durante sincronização.');
        cd.campaign = null;
        emit('phone:update', { id: phoneId, campaign: null, paused: false });
        return;
    }

    const contatos = await loadCSV(config.arquivoCSV);
    log(phoneId, 'info', `📊 ${contatos.length} leads carregados`);

    if (contatos.length === 0) {
        log(phoneId, 'error', `❌ Nenhum lead encontrado em: ${config.arquivoCSV}`);
        cd.campaign = null;
        emit('phone:update', { id: phoneId, campaign: null });
        return;
    }

    let disparos = 0;
    const LIMITE = config.limiteDiario;

    for (const lead of contatos) {
        if (isStopped()) { log(phoneId, 'warn', '⏹️ Campanha encerrada.'); break; }
        if (disparos >= LIMITE) { log(phoneId, 'info', `🏁 Limite de ${LIMITE} disparos atingido.`); break; }

        // aguarda se pausado
        while (cd.paused && !isStopped()) {
            await new Promise(r => setTimeout(r, 1000));
        }
        if (isStopped()) break;

        let numero = String(lead.telefone).replace(/\D/g, '');
        if (!numero.startsWith('55')) numero = '55' + numero;
        const idZap = `${numero}@c.us`;

        // verifica memória central
        const db = loadDB();
        const jaFeito = db.enviado.some(i => i.numero === numero) ||
                        db.invalido.some(i => i.numero === numero) ||
                        db.erro.some(i => i.numero === numero);
        if (jaFeito) { log(phoneId, 'skip', `⏭️ Ignorando ${lead.nome} (já na memória)`); continue; }

        try {
            const registered = await cd.client.isRegisteredUser(idZap);

            if (registered) {
                const msg = config.mensagem
                    .replace(/\{nome\}/g, lead.nome)
                    .replace(/\{cidade\}/g, lead.cidade || 'sua região');

                await cd.client.sendMessage(idZap, msg);
                disparos++;
                cd.campaign.sent = disparos;

                const db2 = loadDB();
                db2.enviado.push({ numero, nome: lead.nome, data: new Date().toISOString(), phoneId });
                saveDB(db2);

                emit('phone:update', { id: phoneId, campaign: { ...cd.campaign } });
                emit('stats:update', statsSnapshot());
                log(phoneId, 'success', `✔️ [${disparos}/${LIMITE}] ${lead.nome} — enviado`);

                if (disparos < LIMITE && !isStopped()) {
                    log(phoneId, 'info', `⏳ Pausa de segurança (${config.pausaEntreMensagens}s)...`);
                    await waitMs(config.pausaEntreMensagens * 1000, isStopped);
                }
            } else {
                const db2 = loadDB();
                db2.invalido.push({ numero, nome: lead.nome, data: new Date().toISOString() });
                saveDB(db2);
                emit('stats:update', statsSnapshot());
                log(phoneId, 'invalid', `❌ ${lead.nome} não tem WhatsApp`);
            }
        } catch (e) {
            const db2 = loadDB();
            db2.erro.push({ numero, nome: lead.nome, data: new Date().toISOString() });
            saveDB(db2);
            emit('stats:update', statsSnapshot());
            log(phoneId, 'error', `⚠️ Erro com ${lead.nome}: ${e.message}`);
            await waitMs(5000, isStopped);
        }
    }

    cd.campaign = null;
    cd.stopped  = false;
    emit('phone:update', { id: phoneId, campaign: null, paused: false });
    log(phoneId, 'success', '🏁 Operação finalizada! Memória sincronizada.');
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function statsSnapshot() {
    const db = loadDB();
    return { enviado: db.enviado.length, invalido: db.invalido.length, erro: db.erro.length };
}

function loadCSV(arquivo) {
    return new Promise((resolve) => {
        const contatos = [];
        const filePath = path.isAbsolute(arquivo) ? arquivo : path.join(__dirname, arquivo);
        if (!fs.existsSync(filePath)) { resolve([]); return; }
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                const col = (name) => {
                    const key = Object.keys(row).find(k => k.trim().toLowerCase().includes(name.toLowerCase()));
                    return key ? row[key] : null;
                };
                const nome     = col('title');
                const telefone = col('phoneUnformatted') || col('phone');
                const cidade   = col('city') || 'sua região';
                if (nome && telefone && nome.toLowerCase() !== 'title') {
                    contatos.push({
                        nome: nome.split(/[-/|]/)[0].trim(),
                        telefone: String(telefone).replace(/\D/g, ''),
                        cidade
                    });
                }
            })
            .on('end', () => resolve(contatos))
            .on('error', () => resolve([]));
    });
}

function phoneSnapshot(phoneData) {
    const cd = clients[phoneData.id];
    return {
        ...phoneData,
        status:   cd?.status   || 'offline',
        campaign: cd?.campaign || null,
        paused:   cd?.paused   || false,
    };
}

// ─── API ─────────────────────────────────────────────────────────────────────
app.get('/api/state', (req, res) => {
    res.json({
        phones: loadPhones().map(phoneSnapshot),
        config: loadConfig(),
        stats:  statsSnapshot()
    });
});

// Listar phones
app.get('/api/phones', (req, res) => res.json(loadPhones().map(phoneSnapshot)));

// Adicionar novo phone
app.post('/api/phones', async (req, res) => {
    const { label } = req.body;
    const id = `phone_${Date.now()}`;
    const newPhone = { id, label: label || `Telefone ${loadPhones().length + 1}`, number: null };
    const phones = loadPhones();
    phones.push(newPhone);
    savePhones(phones);
    res.json({ id, status: 'initializing' });
    // inicializa em background
    initializePhone(newPhone).catch(console.error);
});

// Remover phone
app.delete('/api/phones/:id', async (req, res) => {
    const { id } = req.params;
    if (clients[id]) {
        clients[id].stopped = true;
        try { await clients[id].client.destroy(); } catch (_) {}
        delete clients[id];
    }
    savePhones(loadPhones().filter(p => p.id !== id));
    emit('phone:removed', { id });
    res.json({ ok: true });
});

// Iniciar campanha
app.post('/api/phones/:id/start', (req, res) => {
    const { id } = req.params;
    const cd = clients[id];
    if (!cd || cd.status !== 'ready') return res.status(400).json({ error: 'Telefone não está pronto' });

    if (cd.campaign && !cd.paused) return res.status(400).json({ error: 'Campanha já em execução' });

    if (cd.paused) {
        // retomar
        cd.paused = false;
        emit('phone:update', { id, paused: false });
        log(id, 'info', '▶️ Campanha retomada');
    } else {
        // nova campanha
        runCampaign(id).catch(e => log(id, 'error', `Erro fatal: ${e.message}`));
    }
    res.json({ ok: true });
});

// Pausar campanha
app.post('/api/phones/:id/pause', (req, res) => {
    const { id } = req.params;
    if (!clients[id]) return res.status(400).json({ error: 'Não encontrado' });
    clients[id].paused = true;
    emit('phone:update', { id, paused: true });
    log(id, 'warn', '⏸️ Campanha pausada');
    res.json({ ok: true });
});

// Parar campanha
app.post('/api/phones/:id/stop', (req, res) => {
    const { id } = req.params;
    if (!clients[id]) return res.status(400).json({ error: 'Não encontrado' });
    clients[id].stopped = true;
    clients[id].paused  = false;
    res.json({ ok: true });
});

// Config
app.get('/api/config',  (req, res) => res.json(loadConfig()));
app.post('/api/config', (req, res) => { saveConfig(req.body); res.json({ ok: true }); });

// Stats + histórico
app.get('/api/stats', (req, res) => res.json(statsSnapshot()));
app.get('/api/history', (req, res) => {
    const { category = 'enviado', page = 1, limit = 50 } = req.query;
    const db = loadDB();
    const items = (db[category] || []).reverse();
    const total = items.length;
    const data  = items.slice((page - 1) * limit, page * limit);
    res.json({ data, total, page: Number(page) });
});

// Limpar histórico de uma categoria
app.delete('/api/history/:category', (req, res) => {
    const { category } = req.params;
    const db = loadDB();
    if (db[category]) { db[category] = []; saveDB(db); }
    emit('stats:update', statsSnapshot());
    res.json({ ok: true });
});

// ─── SOCKET.IO ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log('🖥️  Dashboard conectado');
    socket.emit('init', {
        phones: loadPhones().map(phoneSnapshot),
        config: loadConfig(),
        stats:  statsSnapshot()
    });
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
    console.log(`\n🌐 ZapBot UI → http://localhost:${PORT}\n`);
    const phones = loadPhones();
    for (const phone of phones) {
        console.log(`🔄 Restaurando sessão: ${phone.label} (${phone.id})`);
        initializePhone(phone).catch(console.error);
    }
});