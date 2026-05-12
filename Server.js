const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const csv = require('csv-parser');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const path = require('path');
const https = require('https');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── ARQUIVO DE ESTADO ───────────────────────────────────────────────────────
const PHONES_FILE  = path.join(__dirname, 'phones.json');
const DB_FILE      = path.join(__dirname, 'registro_contatos.json');
const CONFIG_FILE  = path.join(__dirname, 'config.json');
const APIFY_TOKEN_FILE = path.join(__dirname, '.apify_token');
const APIFY_BASE_URL = 'api.apify.com';
const APIFY_DEFAULT_ACTOR_ID = 'nwua9Gu5YrADL7ZDj';

const DEFAULT_APIFY_INPUT = {
    includeWebResults: true,
    language: 'pt-BR',
    maxCrawledPlacesPerSearch: 200,
    maxImages: 0,
    maxQuestions: 0,
    maxReviews: 0,
    maximumLeadsEnrichmentRecords: 0,
    placeMinimumStars: 'four',
    reviewsOrigin: 'all',
    reviewsSort: 'newest',
    scrapeContacts: true,
    scrapeDirectories: true,
    scrapePlaceDetailPage: true,
    scrapeSocialMediaProfiles: {
        facebooks: true,
        instagrams: true,
        tiktoks: false
    },
    searchMatching: 'all',
    searchStringsArray: [
        'Segurança do Trabalho São Paulo', 'SST São Paulo', 'Medicina do Trabalho São Paulo', 'Treinamento NR São Paulo',
        'Segurança do Trabalho Campinas', 'SST Campinas', 'Medicina do Trabalho Campinas', 'Treinamento NR Campinas',
        'Segurança do Trabalho Curitiba', 'SST Curitiba', 'Medicina do Trabalho Curitiba', 'Treinamento NR Curitiba',
        'Segurança do Trabalho Londrina', 'SST Londrina', 'Medicina do Trabalho Londrina', 'Treinamento NR Londrina',
        'Segurança do Trabalho Joinville', 'SST Joinville', 'Medicina do Trabalho Joinville', 'Treinamento NR Joinville',
        'Segurança do Trabalho Florianópolis', 'SST Florianópolis', 'Medicina do Trabalho Florianópolis', 'Treinamento NR Florianópolis',
        'Segurança do Trabalho Ribeirão Preto', 'SST Ribeirão Preto', 'Medicina Ocupacional Ribeirão Preto', 'Consultoria NR Ribeirão Preto',
        'Segurança do Trabalho Sorocaba', 'SST Sorocaba', 'Medicina Ocupacional Sorocaba', 'Consultoria NR Sorocaba',
        'Segurança do Trabalho São José dos Campos', 'SST São José dos Campos', 'Medicina Ocupacional São José dos Campos', 'Consultoria NR São José dos Campos',
        'Segurança do Trabalho Caxias do Sul', 'SST Caxias do Sul', 'Medicina Ocupacional Caxias do Sul', 'Consultoria NR Caxias do Sul',
        'Segurança do Trabalho Blumenau', 'SST Blumenau', 'Medicina Ocupacional Blumenau', 'Consultoria NR Blumenau',
        'Segurança do Trabalho Cascavel', 'SST Cascavel', 'Medicina Ocupacional Cascavel', 'Consultoria NR Cascavel',
        'Segurança do Trabalho Ponta Grossa', 'SST Ponta Grossa', 'Medicina Ocupacional Ponta Grossa', 'Consultoria NR Ponta Grossa',
        'Segurança do Trabalho Jundiaí', 'SST Jundiaí', 'Medicina Ocupacional Jundiaí', 'Consultoria NR Jundiaí',
        'Segurança do Trabalho Piracicaba', 'SST Piracicaba', 'Medicina Ocupacional Piracicaba', 'Consultoria NR Piracicaba',
        'Segurança do Trabalho Bauru', 'SST Bauru', 'Medicina Ocupacional Bauru', 'Consultoria NR Bauru',
        'Segurança do Trabalho Chapecó', 'SST Chapecó', 'Medicina Ocupacional Chapecó', 'Consultoria NR Chapecó',
        'Segurança do Trabalho Itajaí', 'SST Itajaí', 'Medicina Ocupacional Itajaí', 'Consultoria NR Itajaí',
        'Segurança do Trabalho Balneário Camboriú', 'SST Balneário Camboriú', 'Medicina Ocupacional Balneário', 'Consultoria NR Balneário',
        'Segurança do Trabalho São Bernardo do Campo', 'SST São Bernardo', 'Medicina Ocupacional São Bernardo', 'Consultoria NR São Bernardo'
    ],
    skipClosedPlaces: true,
    verifyLeadsEnrichmentEmails: false,
    website: 'allPlaces',
    allPlacesNoSearchAction: ''
};

const APIFY_ECONOMY_INPUT_PATCH = {
    includeWebResults: false,
    maxCrawledPlacesPerSearch: 80,
    maxImages: 0,
    maxQuestions: 0,
    maxReviews: 0,
    maximumLeadsEnrichmentRecords: 0,
    placeMinimumStars: 'four',
    scrapeContacts: true,
    scrapeDirectories: false,
    scrapePlaceDetailPage: true,
    scrapeSocialMediaProfiles: {
        facebooks: false,
        instagrams: false,
        tiktoks: false
    },
    verifyLeadsEnrichmentEmails: false
};

const DEFAULT_APIFY_SEGMENT_TERMS = [
    'Segurança do Trabalho',
    'SST',
    'Medicina do Trabalho',
    'Medicina Ocupacional',
    'Treinamento NR',
    'Consultoria NR',
    'Engenharia de Segurança do Trabalho',
    'PGR PCMSO LTCAT'
];

const DEFAULT_APIFY_REGIONS = [
    'São Paulo SP',
    'Guarulhos SP',
    'Osasco SP',
    'Santo André SP',
    'São Bernardo do Campo SP',
    'Campinas SP',
    'Jundiaí SP',
    'Sorocaba SP',
    'Ribeirão Preto SP',
    'São José dos Campos SP',
    'Curitiba PR',
    'Londrina PR',
    'Maringá PR',
    'Cascavel PR',
    'Joinville SC',
    'Florianópolis SC',
    'Blumenau SC',
    'Itajaí SC',
    'Chapecó SC',
    'Porto Alegre RS',
    'Caxias do Sul RS',
    'Belo Horizonte MG',
    'Contagem MG',
    'Rio de Janeiro RJ',
    'Niterói RJ'
];

const DEFAULT_CONFIG = {
    mensagem: `Olá, tudo bem? Me chamo Wender e trabalho com o posicionamento digital de profissionais liberais.\n\nEstava analisando o perfil da {nome} em {cidade} e notei que vocês ainda não possuem um site institucional ou Landing Page de autoridade. No setor jurídico, a falta de uma vitrine oficial acaba passando menos segurança para novos clientes que buscam especialistas no Google.\n\nEu desenvolvo sites de alto padrão que ajudam a transmitir mais credibilidade e facilitam o fechamento de contratos de maior valor. Teria 2 minutos para eu te mostrar como isso pode impactar a sua advocacia?`,
    limiteDiario: 40,
    pausaEntreMensagens: 90,
    pausaInicial: 45,
    arquivoCSV: 'advocacia1.csv',
    apifyActorId: APIFY_DEFAULT_ACTOR_ID,
    apifyOutputCSV: 'apify_leads.csv',
    apifyInput: DEFAULT_APIFY_INPUT,
    apifySegmentTerms: DEFAULT_APIFY_SEGMENT_TERMS,
    apifyRegions: DEFAULT_APIFY_REGIONS,
    apifyAutoMaxRuns: 20,
    apifyEconomyMode: true,
    apifyMaxSearchTermsPerRegion: 4,
    etiquetaArquivarBusiness: true
};

// ─── HELPERS DE PERSISTÊNCIA ─────────────────────────────────────────────────
function loadConfig() {
    if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE));
    const config = { ...DEFAULT_CONFIG, ...raw };
    if (!config.phoneConfigs || typeof config.phoneConfigs !== 'object' || Array.isArray(config.phoneConfigs)) {
        config.phoneConfigs = {};
    }
    return config;
}
function saveConfig(c) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2)); }

function campaignConfigForPhone(phoneId) {
    const config = loadConfig();
    return {
        ...config,
        ...(config.phoneConfigs?.[phoneId] || {})
    };
}

function saveCampaignConfigForPhone(phoneId, patch) {
    const config = loadConfig();
    config.phoneConfigs = config.phoneConfigs || {};
    config.phoneConfigs[phoneId] = {
        ...(config.phoneConfigs[phoneId] || {}),
        arquivoCSV: patch.arquivoCSV,
        limiteDiario: patch.limiteDiario,
        pausaEntreMensagens: patch.pausaEntreMensagens,
        pausaInicial: patch.pausaInicial,
        mensagem: patch.mensagem,
        etiquetaArquivarBusiness: patch.etiquetaArquivarBusiness
    };
    saveConfig(config);
    return campaignConfigForPhone(phoneId);
}

function loadPhones() {
    if (!fs.existsSync(PHONES_FILE)) fs.writeFileSync(PHONES_FILE, JSON.stringify([], null, 2));
    return JSON.parse(fs.readFileSync(PHONES_FILE));
}
function savePhones(p) { fs.writeFileSync(PHONES_FILE, JSON.stringify(p, null, 2)); }

function loadDB() {
    if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ enviado: [], invalido: [], erro: [] }, null, 2));
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    for (const key of ['enviado', 'invalido', 'erro', 'reservado']) {
        if (!Array.isArray(db[key])) db[key] = [];
    }
    const reservationCutoff = Date.now() - (12 * 60 * 60 * 1000);
    db.reservado = db.reservado.filter(item => {
        if (item.status !== 'active') return true;
        const reservedAt = new Date(item.data || 0).getTime();
        return reservedAt && reservedAt > reservationCutoff;
    });
    return db;
}
function saveDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

function normalizePhoneNumber(phone) {
    let numero = String(phone || '').replace(/\D/g, '');
    if (numero && !numero.startsWith('55')) numero = '55' + numero;
    return numero;
}

function todayKey(date = new Date()) {
    return date.toLocaleDateString('sv-SE');
}

function isToday(isoDate) {
    if (!isoDate) return false;
    return todayKey(new Date(isoDate)) === todayKey();
}

function sentTodayByPhone(db, phoneId) {
    return db.enviado.filter(item => item.phoneId === phoneId && isToday(item.data)).length;
}

function isProcessedNumber(db, numero) {
    return db.enviado.some(item => item.numero === numero) ||
           db.invalido.some(item => item.numero === numero) ||
           db.erro.some(item => item.numero === numero);
}

function reserveLead(numero, lead, phoneId) {
    const db = loadDB();
    if (isProcessedNumber(db, numero)) return { ok: false, reason: 'processed' };

    const activeReservation = db.reservado.find(item => item.numero === numero && item.status === 'active');
    if (activeReservation && activeReservation.phoneId !== phoneId) {
        return { ok: false, reason: 'reserved', phoneId: activeReservation.phoneId };
    }
    if (!activeReservation) {
        db.reservado.push({
            numero,
            nome: lead.nome,
            phoneId,
            data: new Date().toISOString(),
            status: 'active'
        });
        saveDB(db);
    }
    return { ok: true };
}

function finalizeLead(tipo, numero, lead, phoneId) {
    const db = loadDB();
    if (!db[tipo].some(item => item.numero === numero)) {
        db[tipo].push({ numero, nome: lead.nome, data: new Date().toISOString(), phoneId });
    }
    db.reservado = db.reservado.filter(item => !(item.numero === numero && item.phoneId === phoneId));
    saveDB(db);
}

function releaseReservationsByPhone(phoneId) {
    const db = loadDB();
    const before = db.reservado.length;
    db.reservado = db.reservado.filter(item => !(item.phoneId === phoneId && item.status === 'active'));
    if (db.reservado.length !== before) saveDB(db);
}

function isBusinessSession(client) {
    return ['smba', 'smbi'].includes(String(client?.info?.platform || '').toLowerCase());
}

function leadSegment(lead) {
    return firstValue(lead.segmento, lead.segment, lead.categoryName, lead.categoria, 'Lead');
}

async function labelAndArchiveChat(cd, idZap, lead, phoneId) {
    const config = campaignConfigForPhone(phoneId);
    if (!config.etiquetaArquivarBusiness) return;
    if (!isBusinessSession(cd.client)) {
        log(phoneId, 'info', `Conta nao Business: etiqueta/arquivo ignorado para ${lead.nome}`);
        return;
    }

    try {
        const chat = await cd.client.getChatById(idZap);
        const segment = leadSegment(lead);
        const target = normalizeLabelName(segment);
        let labels = [];
        try { labels = await cd.client.getLabels(); } catch (_) {}
        const label = labels.find(item => {
            const name = normalizeLabelName(item.name);
            return name === target || name.includes(target) || target.includes(name);
        });

        if (label) {
            const currentLabels = await chat.getLabels();
            const labelIds = new Set(currentLabels.map(item => item.id));
            labelIds.add(label.id);
            await chat.changeLabels([...labelIds]);
            log(phoneId, 'info', `Etiqueta "${label.name}" aplicada em ${lead.nome}`);
        } else {
            log(phoneId, 'warn', `Nenhuma etiqueta encontrada para segmento "${segment}"`);
        }

        await chat.archive();
        log(phoneId, 'info', `Conversa arquivada: ${lead.nome}`);
    } catch (err) {
        log(phoneId, 'warn', `Nao foi possivel etiquetar/arquivar ${lead.nome}: ${err.message || err}`);
    }
}

function loadApifyToken() {
    if (process.env.APIFY_TOKEN) return process.env.APIFY_TOKEN.trim();
    if (!fs.existsSync(APIFY_TOKEN_FILE)) return '';
    return fs.readFileSync(APIFY_TOKEN_FILE, 'utf8').trim();
}

function saveApifyToken(token) {
    fs.writeFileSync(APIFY_TOKEN_FILE, String(token || '').trim());
}

function apifyRequest(method, apiPath, body = null) {
    const token = loadApifyToken();
    if (!token) {
        return Promise.reject(new Error('Token da Apify nao configurado'));
    }

    const payload = body ? JSON.stringify(body) : '';
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: APIFY_BASE_URL,
            method,
            path: apiPath,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (response) => {
            let raw = '';
            response.on('data', chunk => raw += chunk);
            response.on('end', () => {
                let parsed = null;
                try { parsed = raw ? JSON.parse(raw) : null; } catch (_) {}
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    resolve(parsed);
                } else {
                    const msg = parsed?.error?.message || parsed?.message || raw || `HTTP ${response.statusCode}`;
                    reject(new Error(msg));
                }
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

function apifyActorPath(actorId) {
    return encodeURIComponent(actorId).replace(/%7E/g, '~');
}

function safeCsvPath(fileName) {
    const base = path.basename(String(fileName || 'apify_leads.csv'));
    const finalName = base.toLowerCase().endsWith('.csv') ? base : `${base}.csv`;
    return path.join(__dirname, finalName);
}

function csvEscape(value) {
    const text = value == null ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
}

function firstValue(...values) {
    for (const value of values) {
        if (Array.isArray(value) && value.length) return value[0];
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return '';
}

function normalizeList(value, fallback = []) {
    const items = Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : String(value || '')
        .split(/\r?\n|,/)
        .map(item => item.trim())
        .filter(Boolean);
    return items.length ? items : fallback;
}

function optimizeApifyInput(input, economyMode = true) {
    const base = {
        ...DEFAULT_APIFY_INPUT,
        ...(input || {})
    };
    if (!economyMode) return base;
    return {
        ...base,
        ...APIFY_ECONOMY_INPUT_PATCH,
        scrapeSocialMediaProfiles: {
            ...(base.scrapeSocialMediaProfiles || {}),
            ...APIFY_ECONOMY_INPUT_PATCH.scrapeSocialMediaProfiles
        }
    };
}

function limitSearchTerms(terms, economyMode = true, maxTermsPerRegion = 4) {
    const normalized = normalizeList(terms, DEFAULT_APIFY_SEGMENT_TERMS);
    if (!economyMode) return normalized;
    const limit = Math.max(1, Math.min(Number(maxTermsPerRegion || 4), normalized.length));
    return normalized.slice(0, limit);
}

function buildRegionalApifyInput(baseInput, segmentTerms, region, options = {}) {
    const economyMode = options.economyMode !== false;
    const terms = limitSearchTerms(segmentTerms, economyMode, options.maxTermsPerRegion);
    return {
        ...optimizeApifyInput(baseInput, economyMode),
        searchStringsArray: terms.map(term => `${term} ${region}`)
    };
}

function categoryAt(item, index) {
    if (Array.isArray(item.categories)) return item.categories[index] || '';
    return item[`categories/${index}`] || '';
}

function normalizeLabelName(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function normalizeApifyLead(item) {
    return {
        title: firstValue(item.title, item.name, item.placeName),
        totalScore: firstValue(item.totalScore, item.rating, item.stars),
        reviewsCount: firstValue(item.reviewsCount, item.reviews),
        street: firstValue(item.street, item.address, item.location?.address),
        city: firstValue(item.city, item.location?.city),
        state: firstValue(item.state, item.location?.state),
        countryCode: firstValue(item.countryCode, item.location?.countryCode),
        website: firstValue(item.website, item.urlWebsite),
        phone: firstValue(item.phoneUnformatted, item.phone, item.phoneNumber),
        'categories/0': categoryAt(item, 0),
        'categories/1': categoryAt(item, 1),
        'categories/2': categoryAt(item, 2),
        url: firstValue(item.url, item.placeUrl),
        categoryName: firstValue(item.categoryName, item.category),
        segment: firstValue(item.segment, item.segmento, item.categoryName, item.category, categoryAt(item, 0)),
        'emails/0': firstValue(item.emails, item.email),
        'facebooks/0': firstValue(item.facebooks, item.facebook),
        'instagrams/0': firstValue(item.instagrams, item.instagram)
    };
}

function writeLeadsCsv(fileName, items) {
    const headers = [
        'title', 'totalScore', 'reviewsCount', 'street', 'city', 'state', 'countryCode',
        'website', 'phone', 'categories/0', 'categories/1', 'categories/2', 'url',
        'categoryName', 'segment', 'emails/0', 'facebooks/0', 'instagrams/0'
    ];
    const rows = items.map(normalizeApifyLead).filter(item => item.title && item.phone);
    const content = [
        headers.map(csvEscape).join(','),
        ...rows.map(row => headers.map(header => csvEscape(row[header])).join(','))
    ].join('\n');
    const filePath = safeCsvPath(fileName);
    fs.writeFileSync(filePath, content, 'utf8');
    return { fileName: path.basename(filePath), total: items.length, imported: rows.length };
}

function readCsvNumbers(filePath) {
    return new Promise((resolve) => {
        const numbers = new Set();
        if (!fs.existsSync(filePath)) return resolve(numbers);
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', row => {
                const key = Object.keys(row).find(k => k.trim().toLowerCase().includes('phone'));
                const numero = normalizePhoneNumber(key ? row[key] : '');
                if (numero) numbers.add(numero);
            })
            .on('end', () => resolve(numbers))
            .on('error', () => resolve(numbers));
    });
}

async function appendLeadsCsv(fileName, items) {
    const headers = [
        'title', 'totalScore', 'reviewsCount', 'street', 'city', 'state', 'countryCode',
        'website', 'phone', 'categories/0', 'categories/1', 'categories/2', 'url',
        'categoryName', 'segment', 'emails/0', 'facebooks/0', 'instagrams/0'
    ];
    const filePath = safeCsvPath(fileName);
    const existing = await readCsvNumbers(filePath);
    const rows = [];
    for (const item of items.map(normalizeApifyLead)) {
        const numero = normalizePhoneNumber(item.phone);
        if (!item.title || !numero || existing.has(numero)) continue;
        existing.add(numero);
        rows.push(item);
    }
    const lines = rows.map(row => headers.map(header => csvEscape(row[header])).join(','));
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, headers.map(csvEscape).join(',') + '\n', 'utf8');
    }
    if (lines.length) {
        fs.appendFileSync(filePath, lines.join('\n') + '\n', 'utf8');
    }
    return { fileName: path.basename(filePath), total: items.length, imported: rows.length };
}

// ─── ESTADO EM MEMÓRIA ───────────────────────────────────────────────────────
// clients[id] = { client, status, campaign: null | { sent, startTime }, paused, stopped }
const clients = {};
const apifyRuns = {};
const apifyBatch = {
    running: false,
    stopped: false,
    id: null,
    status: 'idle',
    currentRegion: null,
    currentRunId: null,
    startedAt: null,
    finishedAt: null,
    processedRegions: 0,
    imported: 0,
    total: 0,
    error: null,
    outputCSV: null,
    regions: [],
    logs: []
};

// ─── HELPERS DE COMUNICAÇÃO ──────────────────────────────────────────────────
function emit(event, data) { io.emit(event, data); }

function log(phoneId, type, message) {
    const entry = { phoneId, type, message, time: new Date().toISOString() };
    emit('log', entry);
    console.log(`[${phoneId}][${type}] ${message}`);
}

function emitApifyBatch() {
    emit('apify:batch', { ...apifyBatch });
}

function apifyLog(type, message) {
    const entry = { type, message, time: new Date().toISOString() };
    apifyBatch.logs.unshift(entry);
    if (apifyBatch.logs.length > 300) apifyBatch.logs.length = 300;
    emit('apify:log', entry);
    console.log(`[apify][${type}] ${message}`);
}

function apifyDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isApifyTerminal(status) {
    return ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status);
}

async function waitForApifyRun(runId) {
    while (!apifyBatch.stopped) {
        const response = await apifyRequest('GET', `/v2/actor-runs/${encodeURIComponent(runId)}`);
        const run = response.data || response;
        apifyRuns[runId] = {
            ...(apifyRuns[runId] || {}),
            id: run.id,
            status: run.status,
            statusMessage: run.statusMessage,
            defaultDatasetId: run.defaultDatasetId,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
            stats: run.stats || null
        };
        apifyBatch.status = run.status;
        emit('apify:update', apifyRuns[runId]);
        emitApifyBatch();
        if (isApifyTerminal(run.status)) return run;
        await apifyDelay(15000);
    }
    return null;
}

async function runApifyBatch(options) {
    const config = loadConfig();
    const actorId = options.actorId || config.apifyActorId || APIFY_DEFAULT_ACTOR_ID;
    const outputCSV = options.outputCSV || config.apifyOutputCSV || 'apify_leads.csv';
    const segmentTerms = normalizeList(options.segmentTerms, config.apifySegmentTerms || DEFAULT_APIFY_SEGMENT_TERMS);
    const regions = normalizeList(options.regions, config.apifyRegions || DEFAULT_APIFY_REGIONS);
    const maxRuns = Math.max(1, Math.min(Number(options.maxRuns || config.apifyAutoMaxRuns || 20), regions.length));
    const baseInput = options.input || config.apifyInput || DEFAULT_APIFY_INPUT;
    const economyMode = options.economyMode !== undefined ? Boolean(options.economyMode) : config.apifyEconomyMode !== false;
    const maxTermsPerRegion = Math.max(1, Number(options.maxTermsPerRegion || config.apifyMaxSearchTermsPerRegion || 4));
    const activeTerms = limitSearchTerms(segmentTerms, economyMode, maxTermsPerRegion);

    Object.assign(apifyBatch, {
        running: true,
        stopped: false,
        id: `batch_${Date.now()}`,
        status: 'RUNNING',
        currentRegion: null,
        currentRunId: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        processedRegions: 0,
        imported: 0,
        total: 0,
        error: null,
        outputCSV,
        regions: regions.slice(0, maxRuns),
        economyMode,
        maxTermsPerRegion,
        termsPerRegion: activeTerms.length,
        logs: []
    });
    apifyLog('info', `Lote iniciado: ${maxRuns} regioes, CSV ${outputCSV}`);
    apifyLog('info', economyMode
        ? `Modo economico ativo: ${activeTerms.length} termos x ate ${APIFY_ECONOMY_INPUT_PATCH.maxCrawledPlacesPerSearch} lugares por regiao`
        : `Modo economico desligado: ${segmentTerms.length} termos por regiao`);
    emitApifyBatch();

    const savedInput = optimizeApifyInput(baseInput, economyMode);
    saveConfig({
        ...config,
        arquivoCSV: outputCSV,
        apifyActorId: actorId,
        apifyOutputCSV: outputCSV,
        apifyInput: savedInput,
        apifySegmentTerms: segmentTerms,
        apifyRegions: regions,
        apifyAutoMaxRuns: maxRuns,
        apifyEconomyMode: economyMode,
        apifyMaxSearchTermsPerRegion: maxTermsPerRegion
    });

    try {
        for (const region of regions.slice(0, maxRuns)) {
            if (apifyBatch.stopped) break;
            apifyBatch.currentRegion = region;
            apifyBatch.status = 'STARTING';
            apifyLog('info', `Iniciando busca em ${region}`);
            emitApifyBatch();

            const regionalInput = buildRegionalApifyInput(baseInput, segmentTerms, region, { economyMode, maxTermsPerRegion });
            apifyLog('info', `Buscando ${regionalInput.searchStringsArray.length} termos em ${region}`);
            const response = await apifyRequest('POST', `/v2/acts/${apifyActorPath(actorId)}/runs`, regionalInput);
            const run = response.data || response;
            apifyLog('info', `Run ${run.id} criada para ${region}`);
            apifyBatch.currentRunId = run.id;
            apifyBatch.status = run.status;
            apifyRuns[run.id] = {
                id: run.id,
                actorId,
                outputCSV,
                region,
                status: run.status,
                defaultDatasetId: run.defaultDatasetId,
                startedAt: run.startedAt || new Date().toISOString()
            };
            emit('apify:update', apifyRuns[run.id]);
            emitApifyBatch();

            const finishedRun = await waitForApifyRun(run.id);
            if (!finishedRun) break;
            if (finishedRun.status !== 'SUCCEEDED') {
                apifyLog('warn', `Run de ${region} terminou como ${finishedRun.status}: ${finishedRun.statusMessage || 'sem detalhe'}`);
            } else {
                apifyLog('success', `Busca concluida em ${region}. Importando dataset...`);
            }

            if (finishedRun.defaultDatasetId) {
                const datasetId = finishedRun.defaultDatasetId;
                const itemsResponse = await apifyRequest(
                    'GET',
                    `/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json`
                );
                const result = await appendLeadsCsv(outputCSV, Array.isArray(itemsResponse) ? itemsResponse : []);
                apifyBatch.processedRegions++;
                apifyBatch.imported += result.imported;
                apifyBatch.total += result.total;
                const nextConfig = loadConfig();
                nextConfig.arquivoCSV = result.fileName;
                nextConfig.apifyOutputCSV = result.fileName;
                Object.keys(nextConfig.phoneConfigs || {}).forEach(id => {
                    nextConfig.phoneConfigs[id].arquivoCSV = result.fileName;
                });
                saveConfig(nextConfig);
                apifyLog(finishedRun.status === 'SUCCEEDED' ? 'success' : 'warn', `${result.imported} leads novos importados de ${region} para ${result.fileName}`);
                emitApifyBatch();
                continue;
            }

            apifyBatch.processedRegions++;
            emitApifyBatch();
        }
        apifyBatch.status = apifyBatch.stopped ? 'STOPPED' : 'FINISHED';
        apifyLog(apifyBatch.stopped ? 'warn' : 'success', apifyBatch.stopped ? 'Lote parado pelo usuario' : 'Lote finalizado');
    } catch (err) {
        apifyBatch.status = 'ERROR';
        apifyBatch.error = err.message;
        apifyLog('error', err.message);
    } finally {
        apifyBatch.running = false;
        apifyBatch.finishedAt = new Date().toISOString();
        emitApifyBatch();
    }
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
        releaseReservationsByPhone(id);
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
    const config = campaignConfigForPhone(phoneId);
    const cd = clients[phoneId];
    const LIMITE = Number(config.limiteDiario) || 40;
    let disparos = sentTodayByPhone(loadDB(), phoneId);

    cd.campaign = { sent: disparos, startTime: new Date().toISOString() };
    cd.paused   = false;
    cd.stopped  = false;
    emit('phone:update', { id: phoneId, campaign: cd.campaign, paused: false });

    const isStopped = () => cd.stopped;

    log(phoneId, 'info', `Campanha iniciada. Hoje este telefone ja enviou ${disparos}/${LIMITE}. Sincronizando (${config.pausaInicial}s)...`);
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

    for (const lead of contatos) {
        if (isStopped()) { log(phoneId, 'warn', '⏹️ Campanha encerrada.'); break; }
        disparos = sentTodayByPhone(loadDB(), phoneId);
        cd.campaign.sent = disparos;
        emit('phone:update', { id: phoneId, campaign: { ...cd.campaign } });
        if (disparos >= LIMITE) { log(phoneId, 'info', `Limite diario de ${LIMITE} disparos atingido.`); break; }

        // aguarda se pausado
        while (cd.paused && !isStopped()) {
            await new Promise(r => setTimeout(r, 1000));
        }
        if (isStopped()) break;

        const numero = normalizePhoneNumber(lead.telefone);
        if (!numero) continue;
        const idZap = `${numero}@c.us`;

        const reserva = reserveLead(numero, lead, phoneId);
        if (!reserva.ok) {
            const msg = reserva.reason === 'reserved'
                ? `Ignorando ${lead.nome} (reservado por outro telefone)`
                : `Ignorando ${lead.nome} (ja na memoria)`;
            log(phoneId, 'skip', msg);
            continue;
        }

        try {
            const registered = await cd.client.isRegisteredUser(idZap);

            if (registered) {
                const msg = config.mensagem
                    .replace(/\{nome\}/g, lead.nome)
                    .replace(/\{cidade\}/g, lead.cidade || 'sua região');

                await cd.client.sendMessage(idZap, msg);
                await labelAndArchiveChat(cd, idZap, lead, phoneId);
                finalizeLead('enviado', numero, lead, phoneId);
                disparos = sentTodayByPhone(loadDB(), phoneId);
                cd.campaign.sent = disparos;

                emit('phone:update', { id: phoneId, campaign: { ...cd.campaign } });
                emit('stats:update', statsSnapshot());
                log(phoneId, 'success', `✔️ [${disparos}/${LIMITE}] ${lead.nome} — enviado`);

                if (disparos < LIMITE && !isStopped()) {
                    log(phoneId, 'info', `⏳ Pausa de segurança (${config.pausaEntreMensagens}s)...`);
                    await waitMs(config.pausaEntreMensagens * 1000, isStopped);
                }
            } else {
                finalizeLead('invalido', numero, lead, phoneId);
                emit('stats:update', statsSnapshot());
                log(phoneId, 'invalid', `❌ ${lead.nome} não tem WhatsApp`);
            }
        } catch (e) {
            finalizeLead('erro', numero, lead, phoneId);
            emit('stats:update', statsSnapshot());
            log(phoneId, 'error', `⚠️ Erro com ${lead.nome}: ${e.message}`);
            await waitMs(5000, isStopped);
        }
    }

    cd.campaign = null;
    cd.stopped  = false;
    releaseReservationsByPhone(phoneId);
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
                        cidade,
                        segmento: col('segment') || col('categoryName') || col('categories/0') || ''
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
        config: campaignConfigForPhone(phoneData.id),
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
    releaseReservationsByPhone(id);
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
app.get('/api/phones/:id/config', (req, res) => {
    res.json(campaignConfigForPhone(req.params.id));
});
app.post('/api/phones/:id/config', (req, res) => {
    const config = saveCampaignConfigForPhone(req.params.id, req.body || {});
    emit('phone:update', { id: req.params.id, config });
    res.json(config);
});

// Apify
app.get('/api/apify/state', (req, res) => {
    const config = loadConfig();
    const economyMode = config.apifyEconomyMode !== false;
    res.json({
        hasToken: Boolean(loadApifyToken()),
        actorId: config.apifyActorId || APIFY_DEFAULT_ACTOR_ID,
        outputCSV: config.apifyOutputCSV || 'apify_leads.csv',
        input: optimizeApifyInput(config.apifyInput || DEFAULT_APIFY_INPUT, economyMode),
        segmentTerms: config.apifySegmentTerms || DEFAULT_APIFY_SEGMENT_TERMS,
        regions: config.apifyRegions || DEFAULT_APIFY_REGIONS,
        autoMaxRuns: config.apifyAutoMaxRuns || 20,
        economyMode,
        maxTermsPerRegion: config.apifyMaxSearchTermsPerRegion || 4,
        batch: { ...apifyBatch },
        logs: apifyBatch.logs || [],
        runs: Object.values(apifyRuns).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    });
});

app.post('/api/apify/token', (req, res) => {
    const { token } = req.body || {};
    if (!token || String(token).trim().length < 20) {
        return res.status(400).json({ error: 'Token da Apify invalido' });
    }
    saveApifyToken(token);
    res.json({ ok: true });
});

app.post('/api/apify/run', async (req, res) => {
    const config = loadConfig();
    const actorId = req.body?.actorId || config.apifyActorId || APIFY_DEFAULT_ACTOR_ID;
    const economyMode = req.body?.economyMode !== undefined ? Boolean(req.body.economyMode) : config.apifyEconomyMode !== false;
    const runInput = optimizeApifyInput(req.body?.input || config.apifyInput || DEFAULT_APIFY_INPUT, economyMode);
    const outputCSV = req.body?.outputCSV || config.apifyOutputCSV || 'apify_leads.csv';

    try {
        apifyLog('info', `Iniciando busca unica no actor ${actorId}${economyMode ? ' em modo economico' : ''}`);
        const response = await apifyRequest('POST', `/v2/acts/${apifyActorPath(actorId)}/runs`, runInput);
        const run = response.data || response;
        apifyLog('info', `Run ${run.id} criada`);
        apifyRuns[run.id] = {
            id: run.id,
            actorId,
            outputCSV,
            status: run.status,
            defaultDatasetId: run.defaultDatasetId,
            startedAt: run.startedAt || new Date().toISOString()
        };

        saveConfig({ ...config, apifyActorId: actorId, apifyInput: runInput, apifyOutputCSV: outputCSV, apifyEconomyMode: economyMode });
        emit('apify:update', apifyRuns[run.id]);
        res.json(apifyRuns[run.id]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get('/api/apify/run/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const response = await apifyRequest('GET', `/v2/actor-runs/${encodeURIComponent(id)}`);
        const run = response.data || response;
        const snapshot = {
            ...(apifyRuns[id] || {}),
            id: run.id,
            status: run.status,
            statusMessage: run.statusMessage,
            defaultDatasetId: run.defaultDatasetId,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
            stats: run.stats || null
        };
        apifyRuns[id] = snapshot;
        apifyLog('info', `Run ${id}: ${snapshot.status}`);
        emit('apify:update', snapshot);
        res.json(snapshot);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/apify/run/:id/import', async (req, res) => {
    const { id } = req.params;
    try {
        const runResponse = await apifyRequest('GET', `/v2/actor-runs/${encodeURIComponent(id)}`);
        const run = runResponse.data || runResponse;
        if (run.status !== 'SUCCEEDED') {
            return res.status(400).json({ error: `Run ainda nao finalizada: ${run.status}` });
        }

        const datasetId = run.defaultDatasetId;
        const itemsResponse = await apifyRequest(
            'GET',
            `/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json`
        );
        const config = loadConfig();
        const outputCSV = req.body?.outputCSV || apifyRuns[id]?.outputCSV || config.apifyOutputCSV || 'apify_leads.csv';
        const result = await appendLeadsCsv(outputCSV, Array.isArray(itemsResponse) ? itemsResponse : []);
        const nextConfig = { ...config, arquivoCSV: result.fileName, apifyOutputCSV: result.fileName };
        Object.keys(nextConfig.phoneConfigs || {}).forEach(phoneId => {
            nextConfig.phoneConfigs[phoneId].arquivoCSV = result.fileName;
        });
        saveConfig(nextConfig);
        apifyLog('success', `${result.imported} leads importados automaticamente para ${result.fileName}`);

        apifyRuns[id] = {
            ...(apifyRuns[id] || {}),
            id,
            status: run.status,
            defaultDatasetId: datasetId,
            importedAt: new Date().toISOString(),
            imported: result.imported,
            total: result.total,
            outputCSV: result.fileName
        };
        emit('apify:update', apifyRuns[id]);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/apify/batch/start', (req, res) => {
    if (apifyBatch.running) {
        return res.status(400).json({ error: 'Lote da Apify ja esta em execucao' });
    }
    runApifyBatch(req.body || {}).catch(err => {
        apifyBatch.running = false;
        apifyBatch.status = 'ERROR';
        apifyBatch.error = err.message;
        apifyBatch.finishedAt = new Date().toISOString();
        emitApifyBatch();
    });
    res.json({ ok: true, batch: { ...apifyBatch } });
});

app.post('/api/apify/batch/stop', (req, res) => {
    apifyBatch.stopped = true;
    apifyBatch.status = apifyBatch.running ? 'STOPPING' : apifyBatch.status;
    emitApifyBatch();
    res.json({ ok: true, batch: { ...apifyBatch } });
});

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
