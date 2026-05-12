# BotZap

Dashboard local para capturar leads via Apify/Google Maps, importar esses leads para CSV e disparar mensagens pelo WhatsApp usando `whatsapp-web.js`.

## Visao Geral

O sistema tem tres partes principais:

1. **Dashboard web** em `Server.js` + `public/index.html`.
2. **Automacao WhatsApp** com multiplos telefones usando `whatsapp-web.js`.
3. **Integracao Apify** para rodar scraper de Google Maps, importar leads e atualizar automaticamente a base de disparo.

O painel roda localmente em:

```txt
http://localhost:3001
```

## Como Rodar

Instale as dependencias:

```bash
npm install
```

Inicie o dashboard:

```bash
npm start
```

Tambem existe um modo legado por terminal:

```bash
npm run start:cli
```

O modo principal recomendado e o dashboard web.

## Arquivos Importantes

| Arquivo | Funcao |
| --- | --- |
| `Server.js` | Backend Express, Socket.IO, WhatsApp, Apify e campanha |
| `public/index.html` | Interface do dashboard |
| `config.json` | Configuracoes da campanha, CSV ativo, Apify e mensagem |
| `registro_contatos.json` | Historico de enviados, invalidos, erros e reservas |
| `phones.json` | Telefones cadastrados no dashboard |
| `.apify_token` | Token local da Apify, nao versionado |
| `.wwebjs_auth/` | Sessoes do WhatsApp, nao versionado |
| `.wwebjs_cache/` | Cache do WhatsApp Web, nao versionado |

## Seguranca e Git

O `.gitignore` foi configurado para nao enviar dados sensiveis:

- `node_modules/`
- `.env`
- `.apify_token`
- `.wwebjs_auth/`
- `.wwebjs_cache/`
- `phones.json`
- `registro_contatos.json`
- `qrcode.png`
- arquivos `.log`

Importante: tokens colados em conversa, terminal ou logs devem ser revogados e recriados.

## Fluxo de Leads com Apify

O painel tem uma area **APIFY**.

### API Token

O token da Apify permite que o sistema rode o actor via API. Ele pode ser salvo pelo painel e fica em `.apify_token`, fora do Git.

### Iniciar Scraper

O botao **INICIAR SCRAPER** roda uma unica execucao usando exatamente o JSON do campo **Input JSON**.

Use quando quiser controlar manualmente o `searchStringsArray`.

Quando a run termina com `SUCCEEDED`, a importacao e feita automaticamente para o CSV configurado.

### Rodar Lote por Regioes

O botao **RODAR LOTE POR REGIOES** automatiza varias buscas.

Ele combina:

- **Termos do Segmento**
- **Regioes do Lote**

Exemplo:

```txt
Seguranca do Trabalho
SST
Medicina Ocupacional
Treinamento NR
```

com:

```txt
Sao Paulo SP
Campinas SP
Curitiba PR
```

gera buscas como:

```txt
Seguranca do Trabalho Sao Paulo SP
SST Sao Paulo SP
Medicina Ocupacional Sao Paulo SP
Treinamento NR Sao Paulo SP
```

Depois repete para as proximas regioes.

### Logs da Apify

O painel mostra um **Log da Apify** com:

- inicio do lote;
- regiao atual;
- ID da run;
- status da run;
- importacao de dataset;
- quantidade de leads importados;
- erros.

### Falhas Parciais

Se uma regiao terminar como `FAILED`, mas a Apify tiver gerado dataset parcial, o sistema importa os leads disponiveis e continua para a proxima regiao.

O lote so para quando:

- o usuario clica em **PARAR LOTE**;
- acaba a lista/maximo de regioes;
- ocorre erro real de API, token ou credito.

## CSV Ativo

Ao importar leads da Apify, o sistema atualiza automaticamente o `arquivoCSV` em `config.json`.

Todos os telefones passam a usar a mesma base mais recente.

O importador evita duplicar telefones no CSV acumulado.

## Campanhas WhatsApp

Cada telefone cadastrado no painel pode iniciar, pausar, retomar ou parar uma campanha.

O bot le o CSV ativo e para cada lead:

1. Normaliza o telefone.
2. Verifica se ja foi enviado, invalido ou erro no historico.
3. Reserva o lead para o telefone atual.
4. Valida se o numero existe no WhatsApp.
5. Envia a mensagem.
6. Registra o resultado no historico.

## Reservas de Leads

Foi adicionada uma memoria de trabalho chamada `reservado` dentro de `registro_contatos.json`.

Ela evita que dois ou mais numeros de WhatsApp disparem para o mesmo lead ao mesmo tempo.

Fluxo:

1. Telefone A encontra um lead disponivel.
2. Sistema grava uma reserva para o Telefone A.
3. Telefone B passa pelo mesmo lead e ignora.
4. Quando o lead vira `enviado`, `invalido` ou `erro`, a reserva e removida.

Reservas antigas sao liberadas automaticamente depois de 12 horas para nao travar leads caso o servidor caia.

## Limite Diario

O limite diario nao zera mais ao trocar tabela ou reiniciar campanha.

Agora o sistema conta quantas mensagens aquele `phoneId` ja enviou no dia atual, olhando o historico `enviado`.

Exemplo:

- limite diario: 40;
- telefone ja enviou 18 hoje;
- nova campanha ou nova tabela inicia em 18/40;
- restam 22 envios para esse telefone no dia.

## Evitar Reenvio

O historico central impede reenvio para o mesmo lead mesmo usando outro telefone.

O numero e considerado bloqueado quando aparece em:

- `enviado`
- `invalido`
- `erro`
- `reservado` por outro telefone enquanto esta em andamento

## WhatsApp Business: Etiqueta e Arquivo

Apos enviar mensagem, o sistema tenta:

1. Detectar se a sessao conectada e WhatsApp Business.
2. Identificar o segmento do lead.
3. Procurar uma etiqueta existente com nome parecido.
4. Aplicar a etiqueta.
5. Arquivar a conversa.

Essa etapa so roda se a conta for Business. Em conta comum, o sistema registra no log e segue sem quebrar a campanha.

Observacao: a biblioteca permite aplicar etiquetas existentes, mas nao fornece criacao confiavel de novas etiquetas. Portanto, crie previamente no WhatsApp Business etiquetas como:

- `SST`
- `Seguranca do Trabalho`
- `Medicina Ocupacional`
- `Treinamento NR`
- `Consultoria NR`

## Configuracoes Principais

As configuracoes de Apify continuam globais, porque a Apify gera a base compartilhada.

As configuracoes de campanha agora podem ser separadas por telefone em `phoneConfigs`.

Exemplo de campos em `config.json`:

```json
{
  "arquivoCSV": "SST.csv",
  "limiteDiario": 40,
  "pausaEntreMensagens": 90,
  "pausaInicial": 45,
  "mensagem": "Ola, tudo bem?...",
  "apifyActorId": "nwua9Gu5YrADL7ZDj",
  "apifyOutputCSV": "SST.csv",
  "apifyAutoMaxRuns": 25,
  "etiquetaArquivarBusiness": true,
  "phoneConfigs": {
    "phone_1778587565422": {
      "arquivoCSV": "SST.csv",
      "limiteDiario": 40,
      "pausaEntreMensagens": 90,
      "pausaInicial": 45,
      "mensagem": "Mensagem especifica deste telefone"
    }
  }
}
```

Quando uma busca da Apify importa um CSV novo, o sistema atualiza o CSV ativo global e tambem o `arquivoCSV` das configuracoes de todos os telefones.

## Linha do Tempo

### 2026-05-12 - Analise inicial

- Projeto analisado por completo.
- Identificado dashboard em `Server.js`.
- Identificado disparador legado em `app.js`.
- Identificada dependencia de pacotes Node instalados fora do projeto.
- Identificado risco de enviar sessoes/cache/historico para Git.

### 2026-05-12 - Preparacao para GitHub

- Criado `.gitignore`.
- Criado `package.json`.
- Inicializado repositorio local.
- Enviado projeto para `https://github.com/wendersounet-netizen/botzap`.
- Mantidos fora do Git:
  - sessoes WhatsApp;
  - cache;
  - historico;
  - telefones cadastrados;
  - token Apify.

### 2026-05-12 - Integracao Apify

- Adicionado painel **APIFY**.
- Adicionado salvamento local de token em `.apify_token`.
- Adicionados endpoints:
  - `GET /api/apify/state`
  - `POST /api/apify/token`
  - `POST /api/apify/run`
  - `GET /api/apify/run/:id`
  - `POST /api/apify/run/:id/import`
- Implementada conversao de dataset Apify para CSV compativel com o bot.
- Importacao atualiza automaticamente o `arquivoCSV`.

### 2026-05-12 - Lote por regioes

- Adicionados termos de segmento.
- Adicionada lista de regioes.
- Adicionado maximo de regioes por rodada.
- Implementado lote automatico que combina termos + regioes.
- Leads novos sao anexados ao mesmo CSV.
- Duplicados por telefone sao evitados.

### 2026-05-12 - Limite diario e reserva de leads

- Limite diario passou a ser calculado pelo historico do dia por `phoneId`.
- Campanha nao zera mais contagem ao trocar CSV ou reiniciar.
- Adicionada memoria `reservado`.
- Dois telefones nao pegam mais o mesmo lead ao mesmo tempo.
- Reservas sao liberadas ao finalizar, desconectar ou apos expirar.

### 2026-05-12 - Logs e resiliencia Apify

- Adicionado log visual da Apify no painel.
- Busca unica passou a importar automaticamente ao finalizar.
- Lote passou a importar dataset parcial quando uma run termina como `FAILED`.
- Corrigido bug em que o frontend importava runs do lote como busca avulsa.

### 2026-05-12 - WhatsApp Business

- Implementada tentativa de aplicar etiqueta apos envio.
- Implementado arquivamento da conversa apos envio.
- Regra protegida para rodar apenas em WhatsApp Business.
- Quando etiqueta compativel nao existe, o sistema arquiva e registra aviso no log.

### 2026-05-12 - Configuracao por telefone

- Configuracoes de campanha deixaram de ser somente globais.
- Cada telefone pode ter propria mensagem, limite diario, pausa entre mensagens, pausa inicial e CSV ativo.
- O dashboard passou a salvar configuracao em `POST /api/phones/:id/config`.
- O snapshot de cada telefone passou a incluir sua propria `config`.
- O disparo usa `campaignConfigForPhone(phoneId)`.
- Configuracoes globais continuam como fallback para telefones sem configuracao propria.
- Apify continua global e, ao importar novo CSV, atualiza o CSV ativo de todos os telefones.

## Politica de Documentacao Continua

Sempre que uma nova funcionalidade, ajuste ou correcao for finalizada, este README deve ser atualizado mantendo a linha do tempo.

Cada entrada futura deve conter:

- data;
- resumo do que mudou;
- arquivos principais afetados;
- impacto no fluxo de uso;
- observacoes de seguranca ou limitacoes, quando houver.
