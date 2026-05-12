const fs = require('fs');
const csv = require('csv-parser');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');

// --- CONFIGURAÇÃO DA MEMÓRIA CENTRAL ---
const DB_FILE = 'registro_contatos.json';

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ enviado: [], invalido: [], erro: [] }, null, 4));
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    }
});

const delay = ms => new Promise(res => setTimeout(res, ms));

function lerMemoria() {
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function salvarNaMemoria(tipo, numero, nome) {
    const db = lerMemoria();
    if (!db[tipo].some(item => item.numero === numero)) {
        db[tipo].push({ numero, nome, data: new Date().toISOString() });
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 4));
    }
}

function jaFoiProcessado(numero) {
    const db = lerMemoria();
    // Verifica em todas as categorias para garantir que não repita
    return db.enviado.some(item => item.numero === numero) || 
           db.invalido.some(item => item.numero === numero) ||
           db.erro.some(item => item.numero === numero);
}

// --- EVENTOS DO WHATSAPP ---
client.on('qr', async (qr) => {
    console.log('-----------------------------------------------------');
    console.log('📱 NOVO ACESSO: ESCANEIE O QR CODE');
    qrcodeTerminal.generate(qr, { small: true });
    await QRCode.toFile('qrcode.png', qr);
});

client.on('ready', async () => {
    console.log('✅ Conexão estabelecida com sucesso!');
    if (fs.existsSync('qrcode.png')) fs.unlinkSync('qrcode.png');
    console.log('⏳ Sincronizando dados (45s)...');
    await delay(45000); 
    await processarTabela();
});

async function processarTabela() {
    const contatos = [];
    const arquivo = 'advocacia1.csv'; // Coloque aqui o nome da sua NOVA tabela

    if (!fs.existsSync(arquivo)) {
        console.error(`❌ Ficheiro ${arquivo} não encontrado.`);
        return;
    }

    fs.createReadStream(arquivo)
        .pipe(csv())
        .on('data', (row) => {
            const getCol = (name) => {
                const key = Object.keys(row).find(k => k.trim().toLowerCase().includes(name.toLowerCase()));
                return key ? row[key] : null;
            };

            const nome = getCol('title');
            const telefone = getCol('phoneUnformatted') || getCol('phone');
            const cidade = getCol('city') || 'sua região';

            if (nome && telefone && nome.toLowerCase() !== 'title') {
                contatos.push({
                    nome: nome.split(/[-/|]/)[0].trim(),
                    telefone: String(telefone).replace(/\D/g, ''),
                    cidade: cidade
                });
            }
        })
        .on('end', async () => {
            console.log(`📊 Leads na tabela atual: ${contatos.length}`);
            await iniciarCicloDeEnvio(contatos);
        });
}

async function iniciarCicloDeEnvio(contatos) {
    let disparosContabilizados = 0;
    const LIMITE_DIARIO = 40;

    for (let lead of contatos) {
        if (disparosContabilizados >= LIMITE_DIARIO) {
            console.log('🏁 Limite diário de 40 disparos atingido.');
            break;
        }

        let numeroLimpo = lead.telefone;
        if (!numeroLimpo.startsWith('55')) numeroLimpo = '55' + numeroLimpo;
        const idZap = `${numeroLimpo}@c.us`;

        // COMPARAÇÃO COM A MEMÓRIA CENTRAL
        if (jaFoiProcessado(numeroLimpo)) {
            console.log(`⏭️ Ignorando ${lead.nome}: Já existe na base histórica.`);
            continue;
        }

        try {
            const isRegistered = await client.isRegisteredUser(idZap);
            
            if (isRegistered) {
                const msg = `Olá, tudo bem? Me chamo Wender e trabalho com o posicionamento digital de profissionais liberais.\n\nEstava analisando o perfil da ${lead.nome} em ${lead.cidade} e notei que vocês ainda não possuem um site institucional ou Landing Page de autoridade. No setor jurídico, a falta de uma vitrine oficial acaba passando menos segurança para novos clientes que buscam especialistas no Google.\n\nEu desenvolvo sites de alto padrão que ajudam a transmitir mais credibilidade e facilitam o fechamento de contratos de maior valor. Teria 2 minutos para eu te mostrar como isso pode impactar a sua advocacia?`;

                await client.sendMessage(idZap, msg);
                disparosContabilizados++;
                
                salvarNaMemoria('enviado', numeroLimpo, lead.nome);
                console.log(`✔️ [${disparosContabilizados}/${LIMITE_DIARIO}] Sucesso: ${lead.nome}`);
                
                if (disparosContabilizados < LIMITE_DIARIO) {
                    console.log('⏳ Pausa de segurança (90s)...');
                    await delay(90000);
                }
            } else {
                salvarNaMemoria('invalido', numeroLimpo, lead.nome);
                console.log(`❌ ${lead.nome} não possui WhatsApp. Registrado na memória.`);
            }
        } catch (e) {
            salvarNaMemoria('erro', numeroLimpo, lead.nome);
            console.log(`⚠️ Falha ao contactar ${lead.nome}.`);
            await delay(5000);
        }
    }
    
    console.log('🚀 Operação finalizada! Memória sincronizada.');
    process.exit();
}

client.initialize();