// server.js
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import pkg from "whatsapp-web.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { Client, LocalAuth, MessageMedia } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e8
});

app.use(cors());
app.use(express.json());

// ============================================================================
// CONFIGURAÇÕES DE ARMAZENAMENTO DAS CONEXÕES
// ============================================================================
const SESSIONS_DIR = path.join(__dirname, 'sessions');
const CONNECTIONS_FILE = path.join(__dirname, 'connections.json');

if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);

let connections = [];

function loadConnections() {
  try {
    const data = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
    connections = JSON.parse(data);
    connections.forEach(c => {
      c.status = 'disconnected';
      if (c.enabled === undefined) c.enabled = true;
      c.retryCount = 0;
    });
  } catch {
    connections = [];
  }
}

function saveConnections() {
  const toSave = connections.map(({ id, name, color, status, enabled }) => ({
    id, name, color, status, enabled
  }));
  fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(toSave, null, 2));
}

loadConnections();

// ============================================================================
// VARIÁVEIS LEGADAS
// ============================================================================
let legacyClient = null;
let isClientReady = false;
let currentQR = null;
let isLoggingOut = false;

const pendingSurveys = new Set();
const surveyResponses = [];
const surveyTimeouts = new Map();

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================
const formatMessage = async (msg, downloadMedia = false) => {
  let body = msg.body || "";
  let mimetype = msg.mimetype || null;
  let filename = msg.filename || null;
  let caption = msg.caption || null;
  let mediaError = false;
  let hasMedia = msg.hasMedia || false;

  if (downloadMedia) {
    if (msg.hasMedia) {
      try {
        const media = await msg.downloadMedia();
        if (media && media.data) {
          body = media.data;
          mimetype = media.mimetype;
          filename = media.filename;
          caption = msg.caption || msg.body;
          hasMedia = true;
        } else {
          mediaError = true;
        }
      } catch (e) {
        mediaError = true;
        console.log("⚠️ Erro ao baixar mídia:", e.message);
      }
    } else {
      const mediaTypes = ['image', 'video', 'audio', 'ptt', 'document'];
      if (mediaTypes.includes(msg.type) && msg._data) {
        if (msg._data.body) {
          body = msg._data.body;
          mimetype = msg._data.mimetype || mimetype;
          filename = msg._data.filename || filename;
          caption = msg._data.caption || caption;
          hasMedia = true;
          console.log(`📦 Mídia recuperada de _data para ${msg.id._serialized}`);
        }
      }
    }
  } else {
    if (!hasMedia) {
      const mediaTypes = ['image', 'video', 'audio', 'ptt', 'document', 'sticker'];
      if (mediaTypes.includes(msg.type)) {
        hasMedia = true;
      }
    }
  }

  return {
    id: msg.id._serialized,
    body: body,
    fromMe: msg.fromMe,
    timestamp: msg.timestamp,
    type: msg.type,
    ack: msg.ack,
    hasMedia: hasMedia,
    mimetype: mimetype,
    filename: filename,
    mediaError,
    caption,
    isSticker: msg.type === 'sticker',
    location: msg.location || null,
    contact: msg.contact || null,
    poll: msg.poll || null,
    vcard: msg.vcard || null,
    reaction: null,
    mediaKey: msg.mediaKey || null,
    directPath: msg.directPath || null
  };
};

async function getMediaWithRetry(msg, maxRetries = 5, interval = 500) {
  if (!legacyClient) return null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const freshMsg = await legacyClient.getMessageById(msg.id._serialized);
      if (freshMsg.hasMedia) {
        const media = await freshMsg.downloadMedia();
        if (media && media.data) return media;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    } catch (e) {
      console.log(`⚠️ Retry ${i+1} falhou:`, e.message);
    }
  }
  return null;
}

async function emitChatsFromConnection(connId) {
  const conn = connections.find(c => c.id === connId);
  if (!conn || !conn.enabled || conn.status !== 'connected' || !conn.client) return;
  try {
    const chats = await conn.client.getChats();
    const formattedChats = chats
      .filter(c => !c.id._serialized.includes('@g.us'))
      .map(c => ({
        id: c.id._serialized,
        name: c.name || c.id.user || "Desconhecido",
        number: c.id.user,
        unreadCount: c.unreadCount,
        lastMessage: c.lastMessage ? (c.lastMessage.body || "📎 Mídia") : "",
        timestamp: c.timestamp,
        isGroup: c.isGroup,
        picUrl: c.profilePicUrl,
        connectionId: conn.id,
        connectionName: conn.name,
        connectionColor: conn.color
      }));
    formattedChats.sort((a, b) => b.timestamp - a.timestamp);
    io.emit("chats", formattedChats);
  } catch (error) {
    console.error(`Erro ao emitir chats da conexão ${connId}:`, error);
  }
}

function updateLegacyClient() {
  const activeConnected = connections.find(c => c.enabled && c.status === 'connected');
  if (activeConnected && activeConnected.client) {
    legacyClient = activeConnected.client;
    isClientReady = true;
    currentQR = null;
    io.emit('whatsapp_status', 'connected');
    emitChatsFromConnection(activeConnected.id);
  } else {
    legacyClient = null;
    isClientReady = false;
    currentQR = null;
    io.emit('whatsapp_status', 'disconnected');
  }
}

function getClientByConnectionId(connectionId) {
  if (!connectionId) return legacyClient;
  const conn = connections.find(c => c.id === connectionId);
  return (conn && conn.enabled && conn.status === 'connected') ? conn.client : null;
}

// Busca foto de perfil de forma segura, com múltiplos métodos de fallback
async function getProfilePicUrlSafe(client, chatId) {
  if (!client) return null;

  // Método 1: getProfilePicUrl padrão do whatsapp-web.js
  try {
    const url = await client.getProfilePicUrl(chatId);
    if (url) return url;
  } catch (e) {
    // Continua para métodos alternativos
  }

  // Método 2: Acesso direto via pupPage com WidFactory
  if (!client.pupPage) return null;
  try {
    const picUrl = await client.pupPage.evaluate(async (contactId) => {
      try {
        if (!window.Store || !window.Store.ProfilePic) return null;

        // Tenta criar wid e buscar foto
        try {
          let wid = null;
          if (window.Store.WidFactory && window.Store.WidFactory.createWid) {
            wid = window.Store.WidFactory.createWid(contactId);
          } else if (window.Store.createWid) {
            wid = window.Store.createWid(contactId);
          }
          if (wid) {
            // Corrige bug: garante que isNewsletter e isStatusV3 existem
            Object.defineProperty(wid, 'isNewsletter', { value: false, configurable: true, writable: true });
            Object.defineProperty(wid, 'isStatusV3', { value: false, configurable: true, writable: true });
            const result = await window.Store.ProfilePic.profilePicFind(wid);
            if (result && (result.eurl || result.imgFull || result.img)) return result.eurl || result.imgFull || result.img;
          }
        } catch {}

        // Tenta buscar pelo modelo de contato
        try {
          const contact = window.Store.Contact.get(contactId);
          if (contact && contact.profilePicThumb) {
            if (contact.profilePicThumb.imgFull) return contact.profilePicThumb.imgFull;
            if (contact.profilePicThumb.img) return contact.profilePicThumb.img;
            // Tenta forcar o fetch
            try {
              await contact.profilePicThumb.fetchProfilePicture();
              if (contact.profilePicThumb.imgFull) return contact.profilePicThumb.imgFull;
              if (contact.profilePicThumb.img) return contact.profilePicThumb.img;
            } catch {}
          }
        } catch {}

        return null;
      } catch {
        return null;
      }
    }, chatId);
    return picUrl || null;
  } catch {
    return null;
  }
}

// ============================================================================
// CRIAÇÃO DE CONEXÃO
// ============================================================================
function createConnection(connId, name, color) {
  const existingConn = connections.find(c => c.id === connId);
  if (existingConn && existingConn.client) {
    try {
      console.log(`⚠️ Destruindo cliente existente para ${connId} (${name}) antes de recriar.`);
      existingConn.client.destroy().catch(e => console.log('Erro ao destruir cliente existente:', e));
      existingConn.client = null;
    } catch (e) {}
  }

  const sessionPath = path.join(SESSIONS_DIR, connId);
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

  console.log(`🔄 Criando conexão ${connId} (${name}) com sessão em ${sessionPath}`);

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-features=TranslateUI',
        '--disable-features=BlinkGenPropertyTrees',
        '--disable-features=UseOzonePlatform',
        '--disable-features=VaapiVideoDecoder',
        '--disable-features=UseSkiaRenderer',
        '--disable-features=UseChromeOSDirectVideoDecoder',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      protocolTimeout: 600000,
      defaultViewport: null,
    }
  });

  const conn = connections.find(c => c.id === connId);
  if (conn) {
    conn.client = client;
    conn.status = 'connecting';
    conn.retryCount = 0;
  }

  client.on('qr', (qr) => {
    console.log(`📱 QR Code gerado para conexão ${connId} (${name})`);
    const c = connections.find(c => c.id === connId);
    if (c && c.enabled) {
      c.status = 'disconnected';
      io.emit('connection:qr', { connectionId: connId, qr });
    }
    const firstActive = connections.find(c => c.enabled);
    if (firstActive && firstActive.id === connId) {
      currentQR = qr;
      io.emit('qr', qr);
    }
  });

  client.on('ready', () => {
    console.log(`✅ Conexão ${connId} (${name}) conectada!`);
    const c = connections.find(c => c.id === connId);
    if (c && c.enabled) {
      c.status = 'connected';
      c.retryCount = 0;
      saveConnections();
      io.emit('connection:status', { connectionId: connId, status: 'connected' });
      emitChatsFromConnection(connId);
    } else if (c && !c.enabled) {
      c.status = 'connected';
      c.retryCount = 0;
      saveConnections();
    }
    updateLegacyClient();
  });

  client.on('disconnected', async (reason) => {
    console.log(`❌ Conexão ${connId} (${name}) desconectada:`, reason);
    const c = connections.find(c => c.id === connId);
    if (c) {
      c.status = 'disconnected';
      if (c.client) {
        try {
          await c.client.destroy();
        } catch (err) {
          console.error(`Erro ao destruir cliente ${connId}:`, err);
        }
        c.client = null;
      }
      saveConnections();
      io.emit('connection:status', { connectionId: connId, status: 'disconnected' });
    }
    updateLegacyClient();

    if (c && c.enabled && !isLoggingOut) {
      const retryCount = c.retryCount || 0;
      if (retryCount < 5) {
        c.retryCount = retryCount + 1;
        const delay = Math.min(5000 * c.retryCount, 30000);
        console.log(`🔄 Tentando reconectar ${connId} (${name}) em ${delay/1000}s... (tentativa ${c.retryCount}/5)`);
        setTimeout(() => {
          const connNow = connections.find(c => c.id === connId);
          if (connNow && connNow.enabled && connNow.status === 'disconnected') {
            createConnection(connId, connNow.name, connNow.color);
          }
        }, delay);
      } else {
        console.log(`⚠️ Máximo de tentativas atingido para ${connId} (${name}). Reconectando em 60s...`);
        setTimeout(() => {
          const connNow = connections.find(c => c.id === connId);
          if (connNow && connNow.enabled && connNow.status === 'disconnected') {
            connNow.retryCount = 0;
            createConnection(connId, connNow.name, connNow.color);
          }
        }, 60000);
      }
    }
  });

  client.on('auth_failure', (msg) => {
    console.error(`❌ Falha de autenticação na conexão ${connId} (${name}):`, msg);
    const c = connections.find(c => c.id === connId);
    if (c) {
      c.status = 'disconnected';
      if (c.client) {
        c.client.destroy().catch(e => console.log('Erro ao destruir cliente:', e));
        c.client = null;
      }
      saveConnections();
      io.emit('connection:status', { connectionId: connId, status: 'disconnected' });
    }
    updateLegacyClient();
  });

  client.on('error', (err) => {
    console.error(`🚨 Erro no cliente ${connId} (${name}):`, err);
  });

  client.initialize()
    .then(() => {
      console.log(`🟢 Cliente ${connId} (${name}) inicializado com sucesso.`);
    })
    .catch(err => {
      console.error(`🚨 Erro ao inicializar conexão ${connId} (${name}):`, err);
      const c = connections.find(c => c.id === connId);
      if (c) {
        c.status = 'disconnected';
        if (c.client) {
          c.client.destroy().catch(e => console.log('Erro ao destruir cliente:', e));
          c.client = null;
        }
        saveConnections();
        io.emit('connection:status', { connectionId: connId, status: 'disconnected' });

        // Retry automático ao falhar a inicialização
        if (c.enabled) {
          const retryCount = c.retryCount || 0;
          if (retryCount < 5) {
            c.retryCount = retryCount + 1;
            const delay = Math.min(5000 * c.retryCount, 30000);
            console.log(`🔄 Tentando reinicializar ${connId} (${name}) em ${delay/1000}s... (tentativa ${c.retryCount}/5)`);
            setTimeout(() => {
              const connNow = connections.find(c => c.id === connId);
              if (connNow && connNow.enabled && connNow.status === 'disconnected') {
                createConnection(connId, connNow.name, connNow.color);
              }
            }, delay);
          } else {
            console.log(`⚠️ Máximo de tentativas de inicialização atingido para ${connId} (${name}). Reconectando em 60s...`);
            setTimeout(() => {
              const connNow = connections.find(c => c.id === connId);
              if (connNow && connNow.enabled && connNow.status === 'disconnected') {
                connNow.retryCount = 0;
                createConnection(connId, connNow.name, connNow.color);
              }
            }, 60000);
          }
        }
      }
      updateLegacyClient();
    });

  // ================== Eventos de mensagens ==================
  client.on("message_ack", (msg, ack) => {
    const c = connections.find(c => c.client === client);
    if (!c || !c.enabled) return;
    io.emit("message_ack_update", {
      id: msg.id._serialized,
      chatId: msg.fromMe ? msg.to : msg.from,
      ack: ack
    });
    console.log(`📨 ACK ${ack} para mensagem ${msg.id._serialized} (chat ${msg.fromMe ? msg.to : msg.from})`);
  });

  client.on('message_reaction', (reaction) => {
    const c = connections.find(c => c.client === client);
    if (!c || !c.enabled) return;
    try {
      if (!reaction || !reaction.msgId || !reaction.msgId._serialized) return;
      io.emit('message_reaction', {
        messageId: reaction.msgId._serialized,
        chatId: reaction.chatId?._serialized || reaction.chatId,
        reaction: reaction.reaction,
        fromMe: reaction.fromMe,
      });
    } catch (error) {
      console.error('Erro ao processar reação:', error);
    }
  });

  client.on("message", async (msg) => {
    const c = connections.find(c => c.client === client);
    if (!c || !c.enabled) return;
    try {
      if (msg.from.includes('@g.us')) return;
      const chat = await msg.getChat();
      const chatId = chat.id._serialized;

      if (client === legacyClient && pendingSurveys.has(chatId) && !msg.fromMe) {
        const rating = parseInt(msg.body);
        if (!isNaN(rating) && rating >= 1 && rating <= 5) {
          surveyResponses.push({ chatId, rating, timestamp: Date.now() });
          pendingSurveys.delete(chatId);
          clearTimeout(surveyTimeouts.get(chatId));
          surveyTimeouts.delete(chatId);
          await client.sendMessage(chatId, `✅ Obrigado! Sua avaliação ${rating} foi registrada.`);
        } else {
          await client.sendMessage(chatId, "❌ Por favor, responda apenas com um número de 1 a 5.");
        }
      }

      const formatted = await formatMessage(msg, false);
      io.emit("receive_message", { 
        chatId, 
        ...formatted,
        connectionId: c.id,
        connectionName: c.name,
        connectionColor: c.color
      });

      io.emit("chat_updated", {
        id: chatId,
        name: chat.name || chat.id.user,
        unreadCount: chat.unreadCount,
        lastMessage: msg.body || (formatted.hasMedia ? "📎 Mídia" : ""),
        timestamp: msg.timestamp,
        isGroup: chat.isGroup,
        picUrl: chat.profilePicUrl,
        number: chat.id.user,
        connectionId: c.id,
        connectionName: c.name,
        connectionColor: c.color
      });
    } catch (e) {
      console.error("Erro ao processar mensagem recebida:", e);
    }
  });

  client.on("message_create", async (msg) => {
    const c = connections.find(c => c.client === client);
    if (!c || !c.enabled) return;
    try {
      if (msg.from === 'status@broadcast') return;
      if (msg.fromMe) {
        const mediaTypes = ['image', 'video', 'audio', 'ptt', 'document', 'sticker'];
        let formatted;
        if (mediaTypes.includes(msg.type)) {
          const media = await getMediaWithRetry(msg);
          if (media) {
            const msgWithMedia = { ...msg, hasMedia: true, _data: { body: media.data, mimetype: media.mimetype, filename: media.filename } };
            formatted = await formatMessage(msgWithMedia, true);
          } else {
            formatted = await formatMessage(msg, false);
          }
        } else {
          formatted = await formatMessage(msg, false);
        }

        io.emit("receive_message", { 
          chatId: msg.to, 
          ...formatted,
          connectionId: c.id,
          connectionName: c.name,
          connectionColor: c.color
        });

        const chat = await msg.getChat();
        io.emit("chat_updated", {
          id: chat.id._serialized,
          name: chat.name || chat.id.user,
          unreadCount: chat.unreadCount,
          lastMessage: msg.body || (formatted.hasMedia ? "📎 Mídia" : ""),
          timestamp: msg.timestamp,
          isGroup: chat.isGroup,
          picUrl: chat.profilePicUrl,
          number: chat.id.user,
          connectionId: c.id,
          connectionName: c.name,
          connectionColor: c.color
        });
      }
    } catch (e) {
      console.error("Erro ao processar mensagem criada:", e);
    }
  });

  return client;
}

// ============================================================================
// INICIALIZA CONEXÕES SALVAS
// ============================================================================
connections.forEach(conn => {
  if (conn.enabled) {
    createConnection(conn.id, conn.name, conn.color);
  }
});
setTimeout(updateLegacyClient, 1000);

// ============================================================================
// ROTAS REST
// ============================================================================
app.get('/api/connections', (req, res) => {
  const safeList = connections.map(({ id, name, color, status, enabled }) => ({ id, name, color, status, enabled }));
  res.json(safeList);
});

app.post('/api/connections', (req, res) => {
  const { name, color } = req.body;
  if (!name || !color) return res.status(400).json({ error: 'Nome e cor são obrigatórios' });
  const id = Date.now().toString();
  const newConnection = { id, name, color, status: 'connecting', enabled: true, retryCount: 0 };
  connections.push(newConnection);
  saveConnections();
  createConnection(id, name, color);
  res.status(201).json({ id, name, color, status: 'connecting', enabled: true });
});

app.put('/api/connections/:id', (req, res) => {
  const { id } = req.params;
  const { name, color, enabled } = req.body;
  const conn = connections.find(c => c.id === id);
  if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });
  if (name !== undefined) conn.name = name;
  if (color !== undefined) conn.color = color;
  if (enabled !== undefined && conn.enabled !== enabled) {
    conn.enabled = enabled;
    if (enabled) {
      if (conn.status === 'disconnected' || conn.status === 'disabled') {
        conn.status = 'connecting';
        conn.retryCount = 0;
        createConnection(conn.id, conn.name, conn.color);
      } else if (conn.status === 'connected') {
        emitChatsFromConnection(conn.id);
      }
    } else {
      conn.status = 'disabled';
    }
    saveConnections();
    io.emit('connection:status', { connectionId: id, status: conn.status, enabled: conn.enabled });
    updateLegacyClient();
  }
  saveConnections();
  res.json({ id: conn.id, name: conn.name, color: conn.color, status: conn.status, enabled: conn.enabled });
});

app.delete('/api/connections/:id', (req, res) => {
  const { id } = req.params;
  const index = connections.findIndex(c => c.id === id);
  if (index === -1) return res.status(404).json({ error: 'Conexão não encontrada' });
  const [conn] = connections.splice(index, 1);
  saveConnections();
  if (conn.client) {
    conn.client.destroy().catch(e => console.log('Erro ao destruir client:', e));
  }
  const sessionDir = path.join(SESSIONS_DIR, id);
  if (fs.existsSync(sessionDir)) {
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`Erro ao remover pasta ${sessionDir}:`, err);
    }
  }
  updateLegacyClient();
  res.status(204).send();
});

app.post('/api/connections/:id/logout', async (req, res) => {
  const { id } = req.params;
  const conn = connections.find(c => c.id === id);
  if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });
  if (conn.client) {
    try {
      await conn.client.logout();
      conn.status = 'disconnected';
      conn.client = null;
      saveConnections();
      io.emit('connection:status', { connectionId: id, status: 'disconnected' });
      updateLegacyClient();
    } catch (error) {
      console.error(`Erro ao fazer logout da conexão ${id}:`, error);
      return res.status(500).json({ error: error.message });
    }
  }
  res.json({ success: true });
});

app.get('/api/connections/:id/status', (req, res) => {
  const { id } = req.params;
  const conn = connections.find(c => c.id === id);
  if (!conn) return res.status(404).json({ error: 'Conexão não encontrada' });
  res.json({ id: conn.id, status: conn.status, enabled: conn.enabled });
});

app.get('/api/whatsapp/status', (req, res) => {
  let status = 'disconnected';
  if (isClientReady) status = 'connected';
  else if (currentQR) status = 'connecting';
  res.json({ status });
});

app.post('/api/whatsapp/logout', async (req, res) => {
  const activeConnected = connections.find(c => c.enabled && c.status === 'connected');
  if (!activeConnected) return res.status(404).json({ error: 'Nenhuma conexão ativa conectada' });
  try {
    if (isLoggingOut) return res.json({ success: true, message: 'Logout já em andamento' });
    isLoggingOut = true;
    if (activeConnected.client) {
      await activeConnected.client.logout();
      activeConnected.status = 'disconnected';
      activeConnected.client = null;
      saveConnections();
      io.emit('connection:status', { connectionId: activeConnected.id, status: 'disconnected' });
      updateLegacyClient();
    }
    isLoggingOut = false;
    res.json({ success: true });
  } catch (error) {
    isLoggingOut = false;
    console.error("Erro ao processar logout:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SOCKET.IO
// ============================================================================
io.on("connection", (socket) => {
  console.log("🔌 Front conectado:", socket.id);

  connections.forEach(conn => {
    socket.emit('connection:status', { connectionId: conn.id, status: conn.status, enabled: conn.enabled });
  });
  if (isClientReady) socket.emit("whatsapp_status", "connected");
  else socket.emit("whatsapp_status", "disconnected");
  if (currentQR) socket.emit("qr", currentQR);

  socket.on('check_status', () => {
    let status = 'disconnected';
    if (isClientReady) status = 'connected';
    else if (currentQR) status = 'connecting';
    socket.emit('whatsapp_status', status);
  });

  socket.on('logout', async () => {
    const activeConnected = connections.find(c => c.enabled && c.status === 'connected');
    if (!activeConnected) return;
    if (isLoggingOut) return;
    isLoggingOut = true;
    try {
      if (activeConnected.client) {
        await activeConnected.client.logout();
        activeConnected.status = 'disconnected';
        activeConnected.client = null;
        saveConnections();
        io.emit('connection:status', { connectionId: activeConnected.id, status: 'disconnected' });
        updateLegacyClient();
      }
    } catch (error) {
      console.error("Erro logout socket:", error);
    } finally {
      isLoggingOut = false;
    }
  });

  socket.on('logout_connection', async ({ connectionId }) => {
    const conn = connections.find(c => c.id === connectionId);
    if (!conn || !conn.client) return;
    try {
      await conn.client.logout();
      conn.status = 'disconnected';
      conn.client = null;
      saveConnections();
      io.emit('connection:status', { connectionId, status: 'disconnected' });
      updateLegacyClient();
    } catch (error) {
      console.error(`Erro logout socket da conexão ${connectionId}:`, error);
    }
  });

  // ==========================================================================
  // EVENTOS PRINCIPAIS
  // ==========================================================================
  socket.on("get_chats", async () => {
    let allChats = [];
    for (const conn of connections) {
      if (!conn.enabled || conn.status !== 'connected' || !conn.client) continue;
      try {
        const chats = await conn.client.getChats();
        const formatted = chats
          .filter(c => !c.id._serialized.includes('@g.us'))
          .map(c => ({
            id: c.id._serialized,
            name: c.name || c.id.user || "Desconhecido",
            number: c.id.user,
            unreadCount: c.unreadCount,
            lastMessage: c.lastMessage ? (c.lastMessage.body || "📎 Mídia") : "",
            timestamp: c.timestamp,
            isGroup: c.isGroup,
            picUrl: c.profilePicUrl,
            connectionId: conn.id,
            connectionName: conn.name,
            connectionColor: conn.color
          }));
        allChats = allChats.concat(formatted);
      } catch (err) {
        console.error(`Erro ao buscar chats da conexão ${conn.id}:`, err);
      }
    }
    allChats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    socket.emit("chats", allChats);

    // Busca fotos de perfil automaticamente para chats que não têm
    (async () => {
      const chatsNeedingPic = allChats.filter(chat => !chat.picUrl);
      for (let i = 0; i < chatsNeedingPic.length; i++) {
        const chat = chatsNeedingPic[i];
        const client = getClientByConnectionId(chat.connectionId);
        if (client) {
          const picUrl = await getProfilePicUrlSafe(client, chat.id);
          if (picUrl) {
            io.emit("profile_pic_update", { id: chat.id, picUrl });
          }
        }
        // Pequeno delay entre requisições para não sobrecarregar
        if (i < chatsNeedingPic.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }
    })();
  });

  socket.on("get_chat_messages", async (data) => {
    const { chatId, connectionId } = data;
    const client = getClientByConnectionId(connectionId);
    if (!client) {
      console.log("❌ Nenhum cliente disponível para get_chat_messages");
      socket.emit("chat_messages_error", { chatId, error: "Cliente não disponível" });
      return;
    }

    try {
      const chat = await client.getChatById(chatId);
      let allMessages = [];
      let before = undefined;
      let fetchMore = true;
      let attemptCount = 0;
      const MAX_ATTEMPTS = 5;

      while (fetchMore && attemptCount < MAX_ATTEMPTS) {
        attemptCount++;
        const options = { limit: 200 };
        if (before) options.before = before;

        let messages;
        try {
          messages = await chat.fetchMessages(options);
        } catch (fetchErr) {
          console.error(`Erro ao buscar mensagens do chat ${chatId}:`, fetchErr);
          if (fetchErr.message && fetchErr.message.includes('timed out')) {
            console.log(`Timeout ao buscar mensagens do chat ${chatId}, tentativa ${attemptCount}/${MAX_ATTEMPTS}`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            continue;
          } else {
            throw fetchErr;
          }
        }

        if (!messages || messages.length === 0) break;

        allMessages = allMessages.concat(messages);
        before = messages[messages.length - 1].timestamp * 1000;

        if (messages.length < options.limit) fetchMore = false;
      }

      if (attemptCount >= MAX_ATTEMPTS && allMessages.length === 0) {
        throw new Error("Falha ao carregar mensagens após várias tentativas.");
      }

      allMessages.sort((a, b) => a.timestamp - b.timestamp);

      const formattedMessages = [];
      for (const m of allMessages) {
        const fm = await formatMessage(m, false);
        formattedMessages.push(fm);
      }

      socket.emit("chat_messages", { chatId, messages: formattedMessages });
    } catch (error) {
      console.error(`Erro ao ler mensagens de ${chatId}:`, error);
      socket.emit("chat_messages_error", { chatId, error: error.message });
    }
  });

  socket.on("get_media", async (data, callback) => {
    const { chatId, messageId, connectionId } = data;
    const client = getClientByConnectionId(connectionId);
    if (!client) return callback({ error: "Cliente não disponível" });

    console.log(`📥 Requisição de mídia para mensagem ${messageId} do chat ${chatId} (conexão ${connectionId})`);

    try {
      const message = await client.getMessageById(messageId);
      if (!message) return callback({ error: "Mensagem não encontrada" });

      if (!message.hasMedia) {
        if (message._data && message._data.body) {
          console.log(`📦 Mídia encontrada em _data para ${messageId}`);
          return callback({ 
            success: true, 
            media: message._data.body, 
            mimetype: message._data.mimetype || message.mimetype, 
            filename: message._data.filename || message.filename 
          });
        } else {
          return callback({ error: "Mensagem sem mídia" });
        }
      }

      console.log(`📥 Baixando mídia da mensagem ${messageId}`);
      const media = await message.downloadMedia();
      if (media && media.data) {
        console.log(`✅ Mídia baixada com sucesso: ${media.filename || 'sem nome'}`);
        callback({ success: true, media: media.data, mimetype: media.mimetype, filename: media.filename });
      } else {
        callback({ error: "Falha ao baixar mídia" });
      }
    } catch (error) {
      console.error("❌ Erro ao buscar mídia:", error);
      callback({ error: error.message });
    }
  });

  // CORREÇÃO: envio de mensagem com retorno do ID real
  socket.on("send_message", async (data, callback) => {
    const { to, text, file, filename, mimetype, isPtt, quotedMsgId, connectionId } = data;
    const client = getClientByConnectionId(connectionId);
    if (!client) return callback && callback({ error: "Cliente indisponível" });

    try {
      let destinatario = to;
      if (!destinatario.includes('@')) destinatario = `${destinatario}@c.us`;
      console.log(`📤 Enviando mensagem para ${destinatario} (conexão ${connectionId})`);

      let result;
      if (file) {
        const media = new MessageMedia(mimetype, file, filename);
        result = await client.sendMessage(destinatario, media, { sendAudioAsVoice: isPtt || false });
        console.log(`✅ Mensagem com mídia enviada (audio? ${isPtt}), ID: ${result.id._serialized}`);
      } else {
        const options = {};
        if (quotedMsgId) options.quotedMessageId = quotedMsgId;
        result = await client.sendMessage(destinatario, text, options);
        console.log(`✅ Mensagem de texto enviada, ID: ${result.id._serialized}`);
      }
      // Retorna o ID real da mensagem para o frontend
      if (callback) callback({ success: true, messageId: result.id._serialized });
    } catch (error) {
      console.error("❌ Erro no envio:", error.message);
      if (callback) callback({ error: error.message });
    }
  });

  // Eventos legados (usam legacyClient)
  socket.on('request_pairing_code', async (phoneNumber, callback) => {
    if (!legacyClient || isClientReady) return callback({ success: false, error: 'Já conectado ou cliente indisponível.' });
    try {
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      const code = await legacyClient.requestPairingCode(cleanNumber);
      if (callback) callback({ success: true, code });
    } catch (error) {
      if (callback) callback({ success: false, error: error.message });
    }
  });

  socket.on("get_contacts", async () => {
    let allContacts = [];
    for (const conn of connections) {
      if (!conn.enabled || conn.status !== 'connected' || !conn.client) continue;
      try {
        const contacts = await conn.client.getContacts();
        const formatted = contacts
          .filter(c => c.isUser && c.id._serialized)
          .map(c => ({
            id: c.id._serialized,
            name: c.name || c.pushname || c.number,
            number: c.number,
            picUrl: c.profilePicUrl,
            connectionId: conn.id,
            connectionName: conn.name,
            connectionColor: conn.color
          }));
        allContacts = allContacts.concat(formatted);
      } catch (err) {
        console.error(`Erro ao buscar contatos da conexão ${conn.id}:`, err);
      }
    }
    const unique = allContacts.filter((c, idx, self) => self.findIndex(t => t.id === c.id) === idx);
    socket.emit("contacts", unique);
  });

  socket.on('verify_number', async (data, callback) => {
    if (!isClientReady || !legacyClient) return callback({ valid: false, error: 'Offline' });
    try {
      const numberId = await legacyClient.getNumberId(data.number);
      if (numberId) callback({ valid: true, exists: true, id: numberId._serialized });
      else callback({ valid: false, exists: false });
    } catch (e) {
      callback({ valid: false, error: e.message });
    }
  });

  socket.on('send_reaction', async (data) => {
    if (!isClientReady || !legacyClient) return;
    try {
      const { chatId, messageId, emoji } = data;
      const chat = await legacyClient.getChatById(chatId);
      const message = await chat.getMessageById(messageId);
      if (message) await message.react(emoji);
    } catch (error) {
      console.error('Erro ao enviar reação:', error);
    }
  });

  socket.on("end_chat", async (data) => {
    if (!isClientReady || !legacyClient) return;
    const { chatId } = data;
    try {
      const surveyMessage = "🔍 *Pesquisa de Satisfação*\n\nO atendimento foi encerrado. Por favor, avalie nosso atendimento de 1 a 5 estrelas (responda apenas com um número de 1 a 5).\n\n1️⃣ Muito Ruim\n2️⃣ Ruim\n3️⃣ Regular\n4️⃣ Bom\n5️⃣ Excelente";
      await legacyClient.sendMessage(chatId, surveyMessage);
      pendingSurveys.add(chatId);
      const timeoutId = setTimeout(async () => {
        if (pendingSurveys.has(chatId)) {
          try {
            await legacyClient.sendMessage(chatId, "⏰ Não recebemos sua resposta em até 30 minutos. O atendimento será encerrado. Obrigado!");
            pendingSurveys.delete(chatId);
            surveyTimeouts.delete(chatId);
          } catch (e) { console.error("Erro ao enviar mensagem de timeout:", e); }
        }
      }, 30 * 60 * 1000);
      surveyTimeouts.set(chatId, timeoutId);
      console.log(`📝 Pesquisa enviada para ${chatId}`);
    } catch (error) {
      console.error("Erro ao enviar pesquisa:", error);
    }
  });

  socket.on('mark_chat_as_read', async (chatId) => {
    if (!isClientReady || !legacyClient) return;
    try {
      const chat = await legacyClient.getChatById(chatId);
      await chat.sendSeen();
      io.emit('chat_updated', { id: chatId, unreadCount: 0 });
    } catch (error) {
      console.error('Erro ao marcar como lido:', error);
    }
  });

  socket.on("get_profile_pic", async (data) => {
    const { chatId, connectionId } = data;
    const client = getClientByConnectionId(connectionId);
    if (!client) return;
    const picUrl = await getProfilePicUrlSafe(client, chatId);
    if (picUrl) {
      io.emit("profile_pic_update", { id: chatId, picUrl });
    }
  });

  socket.on("get_survey_responses", (data, callback) => {
    const { startDate, endDate } = data;
    const filtered = surveyResponses.filter(r => r.timestamp >= startDate && r.timestamp <= endDate);
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    filtered.forEach(r => counts[r.rating]++);
    const total = filtered.length;
    const percentages = [
      { name: 'Excelente (5)', value: total ? (counts[5] / total) * 100 : 0, color: '#10b981' },
      { name: 'Bom (4)', value: total ? (counts[4] / total) * 100 : 0, color: '#3b82f6' },
      { name: 'Regular (3)', value: total ? (counts[3] / total) * 100 : 0, color: '#f59e0b' },
      { name: 'Ruim (2)', value: total ? (counts[2] / total) * 100 : 0, color: '#ef4444' },
      { name: 'Muito Ruim (1)', value: total ? (counts[1] / total) * 100 : 0, color: '#7f1d1d' }
    ];
    if (callback) callback(percentages);
  });

  socket.on("get_all_chats", async () => {
    let allChats = [];
    for (const conn of connections) {
      if (!conn.enabled || conn.status !== 'connected' || !conn.client) continue;
      try {
        const chats = await conn.client.getChats();
        const formatted = chats
          .filter(c => !c.id._serialized.includes('@g.us'))
          .map(c => ({
            id: c.id._serialized,
            name: c.name || c.id.user || "Desconhecido",
            number: c.id.user,
            unreadCount: c.unreadCount,
            lastMessage: c.lastMessage ? (c.lastMessage.body || "📎 Mídia") : "",
            timestamp: c.timestamp,
            isGroup: c.isGroup,
            picUrl: c.profilePicUrl,
            connectionId: conn.id,
            connectionName: conn.name,
            connectionColor: conn.color
          }));
        allChats = allChats.concat(formatted);
      } catch (err) {
        console.error(`Erro ao buscar chats da conexão ${conn.id}:`, err);
      }
    }
    allChats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    socket.emit("chats", allChats);
  });

  socket.on("get_all_survey_responses", () => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    surveyResponses.forEach(r => counts[r.rating]++);
    const total = surveyResponses.length;
    const percentages = [
      { name: 'Excelente (5)', value: total ? (counts[5] / total) * 100 : 0, color: '#10b981' },
      { name: 'Bom (4)', value: total ? (counts[4] / total) * 100 : 0, color: '#3b82f6' },
      { name: 'Regular (3)', value: total ? (counts[3] / total) * 100 : 0, color: '#f59e0b' },
      { name: 'Ruim (2)', value: total ? (counts[2] / total) * 100 : 0, color: '#ef4444' },
      { name: 'Muito Ruim (1)', value: total ? (counts[1] / total) * 100 : 0, color: '#7f1d1d' }
    ];
    socket.emit("survey_responses", percentages);
  });
});

httpServer.listen(3001, () => {
  console.log("🚀 Server rodando na porta 3001");
});
