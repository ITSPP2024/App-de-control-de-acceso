import express from "express";
import mysql from "mysql2";
import cors from "cors";
import bodyParser from "body-parser";
import crypto from "crypto";
import callbackRouter from './ttlock/callback.js'; // Ajusta la ruta si es necesario

// ✅ Función para generar hash MD5 (necesaria para TTLock)
function md5(value) {
  return crypto.createHash("md5").update(value).digest("hex");
}

// ============================================================
// 🔌 CONFIGURACIÓN DEL SERVIDOR
// ============================================================
const app = express();
const PORT = 5002;
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Agregarlo al servidor
app.use('/api/ttlock/callback', callbackRouter);

// ============================================================
// 🗄️ CONEXIÓN A LA BASE DE DATOS
// ============================================================
const db = mysql.createConnection({
  host: "localhost",
  user: "root",       
  password: "admin",       
  database: "sistema_control_acceso", 
});

db.connect((err) => {
  if (err) {
    console.error("❌ Error al conectar con la base de datos:", err);
  } else {
    console.log("✅ Conectado a la base de datos MySQL (Desktop Server)");
  }
});

// ============================================================
// 🔐 LOGIN DE ADMINISTRADORES
// ============================================================
import bcrypt from "bcrypt"; // asegúrate de instalarlo con: npm install bcrypt

app.post("/api/login", (req, res) => {
  const { correo, contraseña } = req.body;

  if (!correo || !contraseña) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  const query = `
    SELECT * FROM administradores WHERE Correo_Administrador = ?
  `;

  db.query(query, [correo], async (err, results) => {
    if (err) {
      console.error("❌ Error al consultar el administrador:", err);
      return res.status(500).json({ error: "Error interno del servidor" });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: "Correo no encontrado" });
    }

    const admin = results[0];

    // ✅ Comparar contraseñas (hash vs texto plano)
    const isMatch = await bcrypt.compare(contraseña, admin.Contraseña_Administrador);

    if (!isMatch) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    // ✅ Enviar datos seguros del administrador
    res.json({
      idAdministrador: admin.idAdministrador,
      nombre: admin.Nombre_Administrador,
      apellido: admin.Apellido_Administrador,
      correo: admin.Correo_Administrador,
    });
  });
});

// ============================================================
// 🧾 ENDPOINT: Registrar un acceso
// ============================================================
app.post("/api/accesos", (req, res) => {
  const { idUsuario, idZona, tipo_acceso, metodo } = req.body;

  if (!idUsuario || !idZona || !tipo_acceso || !metodo) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  const query = `
    INSERT INTO accesos (idUsuario, idZona, tipo_acceso, metodo, fecha)
    VALUES (?, ?, ?, ?, NOW())
  `;

  db.query(query, [idUsuario, idZona, tipo_acceso, metodo], (err, result) => {
    if (err) {
      console.error("Error al registrar acceso:", err);
      return res.status(500).json({ error: "Error al registrar acceso" });
    }

    console.log(`✅ Acceso registrado -> Usuario: ${idUsuario}, Zona: ${idZona}`);
    res.json({ message: "Acceso registrado correctamente" });
  });
});
// ======================================================
// 🔹 Obtener lista de zonas
// ======================================================
app.get("/api/zonas", (req, res) => {
  const sql = `
    SELECT 
      idzonas,
      nombre_zona,
      nivel_seguridad_zona,
      capacidad_maxima_zona,
      horario_inicio_zona,
      horario_fin_zona,
      descripcion_zona,
      estado_zona,
      requiresEscort
    FROM zonas
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error al obtener zonas:", err);
      return res.status(500).json({ error: "Error al obtener zonas" });
    }

    console.log("✅ Zonas obtenidas correctamente:", results.length);
    res.json(results);
  });
});

// ======================================================
// 🔹 Obtener lista de dispositivos (separado correctamente)
// ======================================================
app.get("/api/dispositivos", (req, res) => {
  const query = `
    SELECT idDispositivo, nombre_dispositivo
    FROM dispositivo
    WHERE Estado = 'Activo'
  `;
  db.query(query, (err, results) => {
    if (err) {
      console.error("❌ Error al obtener dispositivos:", err);
      return res.status(500).json({ error: "Error al obtener dispositivos" });
    }
    console.log("✅ Dispositivos obtenidos:", results.length);
    res.json(results);
  });
});
// ======================================================
// 🔹 Registrar o vincular dispositivo
// ======================================================
app.post("/api/dispositivo", (req, res) => {
  const { 
    Idzona_dispositivo, 
    nombre_dispositivo, 
    tipo_dispositivo, 
    ubicacion, 
    Estado, 
    creado_por 
  } = req.body;

  if (!Idzona_dispositivo || !nombre_dispositivo || !creado_por) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  // 🔸 Obtener datos de la zona
  const zonaQuery = `
    SELECT nombre_zona
    FROM zonas
    WHERE idzonas = ?
  `;
  db.query(zonaQuery, [Idzona_dispositivo], (errZona, zonaResults) => {
    if (errZona) {
      console.error("❌ Error al consultar la zona:", errZona);
      return res.status(500).json({ error: errZona.message });
    }

    if (zonaResults.length === 0) {
      return res.status(404).json({ error: "Zona no encontrada" });
    }

    const { nombre_zona } = zonaResults[0];

    // 🔹 Verificar si el dispositivo ya existe
    const checkQuery = "SELECT * FROM dispositivo WHERE nombre_dispositivo = ?";
    db.query(checkQuery, [nombre_dispositivo], (err, results) => {
      if (err) {
        console.error("❌ Error al verificar dispositivo:", err);
        return res.status(500).json({ error: err.message });
      }

      // ======================================================
      // 🟢 Si el dispositivo ya existe → actualizar
      // ======================================================
      if (results.length > 0) {
        const updateQuery = `
          UPDATE dispositivo
          SET 
            tipo_dispositivo = ?, 
            Idzona_dispositivo = ?, 
            nombre_zona_dispositivo = ?, 
            ubicacion = ?, 
            Estado = ?
          WHERE nombre_dispositivo = ?
        `;
        db.query(
          updateQuery,
          [
            tipo_dispositivo || results[0].tipo_dispositivo,
            Idzona_dispositivo,
            nombre_zona,
            ubicacion || results[0].ubicacion,
            Estado || results[0].Estado,
            nombre_dispositivo
          ],
          (err2) => {
            if (err2) {
              console.error("❌ Error al actualizar dispositivo:", err2);
              return res.status(500).json({ error: err2.message });
            }

            // Registrar auditoría
            const detalle = `Actualizó el dispositivo "${nombre_dispositivo}" vinculado a la zona "${nombre_zona}"`;
            const auditQuery = `
              INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, fecha)
              VALUES (?, 'ACTUALIZAR', 'DISPOSITIVO', ?, ?, NOW())
            `;
            db.query(auditQuery, [creado_por, results[0].idDispositivo, detalle]);

            res.json({ message: "✅ Dispositivo actualizado correctamente" });
          }
        );
      } 
      // ======================================================
      // 🔵 Si el dispositivo no existe → insertar nuevo
      // ======================================================
      else {
        const insertQuery = `
          INSERT INTO dispositivo 
          (nombre_dispositivo, tipo_dispositivo, Idzona_dispositivo, nombre_zona_dispositivo, ubicacion, Estado)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        db.query(
          insertQuery,
          [
            nombre_dispositivo, 
            tipo_dispositivo || "Lector biométrico", 
            Idzona_dispositivo, 
            nombre_zona, 
            ubicacion || "Sin definir", 
            Estado || "Activo"
          ],
          (err3, result) => {
            if (err3) {
              console.error("❌ Error al registrar dispositivo:", err3);
              return res.status(500).json({ error: err3.message });
            }

            // Registrar auditoría
            const detalle = `Registró nuevo dispositivo "${nombre_dispositivo}" en zona "${nombre_zona}"`;
            const auditQuery = `
              INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, fecha)
              VALUES (?, 'CREAR', 'DISPOSITIVO', ?, ?, NOW())
            `;
            db.query(auditQuery, [creado_por, result.insertId, detalle]);

            res.json({ message: "✅ Nuevo dispositivo registrado y auditado correctamente" });
          }
        );
      }
    });
  });
});

// ============================================================
// 🧾 REGISTRO DE AUDITORÍA
// ============================================================
app.post("/api/auditoria", (req, res) => {
  const { usuario_id, accion, entidad, entidad_id, detalle } = req.body;

  if (!usuario_id || !accion || !entidad || !detalle) {
    return res.status(400).json({ error: "Faltan datos obligatorios en la auditoría" });
  }

  const query = `
    INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, fecha)
    VALUES (?, ?, ?, ?, ?, NOW())
  `;

  db.query(query, [usuario_id, accion, entidad, entidad_id || null, detalle], (err, result) => {
    if (err) {
      console.error("❌ Error al registrar auditoría:", err);
      return res.status(500).json({ error: "Error al registrar auditoría" });
    }
    console.log(`🧾 Auditoría registrada -> ${accion} en ${entidad}`);
    res.json({ message: "Auditoría registrada correctamente" });
  });
});

// ============================================================
// 🔐 TTLOCK INTEGRACIÓN DIRECTA (SIN ARCHIVOS EXTERNOS)
// ============================================================
import axios from "axios";
import qs from "qs";
import dotenv from "dotenv";
dotenv.config();

// Variables desde .env
const {
  TTLOCK_CLIENT_ID,
  TTLOCK_CLIENT_SECRET,
  TTLOCK_USERNAME,
  TTLOCK_PASSWORD,
  TTLOCK_BASE_URL,
  TTLOCK_LOCK_ID
} = process.env;

let accessToken = null;
let tokenExpiresAt = 0;

// ============================================================
// 🧠 Función: Obtener Access Token (se renueva automáticamente)
// ============================================================
async function getAccessToken() {
  const now = Date.now();
  if (accessToken && now < tokenExpiresAt) {
    return accessToken;
  }

  const url = `${TTLOCK_BASE_URL}/oauth2/token`;
  const data = qs.stringify({
    clientId: TTLOCK_CLIENT_ID,
    clientSecret: TTLOCK_CLIENT_SECRET,
    username: TTLOCK_USERNAME,
    password: md5(TTLOCK_PASSWORD), // ✅ Se usa MD5 aquí también
    grant_type: "password",
  });

  try {
    const response = await axios.post(url, data, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    accessToken = response.data.access_token;
    tokenExpiresAt = now + response.data.expires_in * 1000;

    console.log("✅ Access Token TTLock obtenido correctamente");
    return accessToken;
  } catch (err) {
    console.error("❌ Error al obtener token TTLock:", err.response?.data || err.message);
    throw err;
  }
}
// ============================================================
// 🖐️ OBTENER LISTA DE HUELLAS DACTILARES
// ============================================================
async function getFingerprintList(lockId) {
  const token = await getAccessToken();
  const url = `${TTLOCK_BASE_URL}/v3/fingerprint/list`;

  const params = {
    clientId: TTLOCK_CLIENT_ID,
    accessToken: token,
    lockId,
    pageNo: 1,
    pageSize: 100,
    orderBy: 1,
    date: Date.now(),
  };

  try {
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error("❌ Error al obtener huellas:", error.response?.data || error.message);
    return { list: [] };
  }
}

// ============================================================
// 💳 OBTENER LISTA DE TARJETAS RFID
// ============================================================
async function getCardList(lockId) {
  const token = await getAccessToken();
  const url = `${TTLOCK_BASE_URL}/v3/card/list`;

  const params = {
    clientId: TTLOCK_CLIENT_ID,
    accessToken: token,
    lockId,
    pageNo: 1,
    pageSize: 100,
    orderBy: 1,
    date: Date.now(),
  };

  try {
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error("❌ Error al obtener tarjetas:", error.response?.data || error.message);
    return { list: [] };
  }
}

// ===============================
// 🔐 Prueba de conexión con TTLock
// ===============================
app.get("/api/test-ttlock", async (req, res) => {
  try {
    console.log("🔄 Solicitando token a TTLock...");

    const tokenResponse = await axios.post(
      `${process.env.TTLOCK_BASE_URL}/oauth2/token`,
      qs.stringify({
        clientId: process.env.TTLOCK_CLIENT_ID,
        clientSecret: process.env.TTLOCK_CLIENT_SECRET,
        username: process.env.TTLOCK_USERNAME,
        password: md5(process.env.TTLOCK_PASSWORD), // ✅ cifrado MD5 con crypto
        grant_type: "password",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    console.log("✅ Respuesta token TTLock:", tokenResponse.data);

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) throw new Error("TTLock no devolvió access_token");

    console.log("🔍 Solicitando lista de cerraduras...");
    const lockResponse = await axios.get(
      `${process.env.TTLOCK_BASE_URL}/v3/lock/list`,
      {
        params: {
          clientId: process.env.TTLOCK_CLIENT_ID,
          accessToken,
          pageNo: 1,
          pageSize: 10,
          date: Date.now(),
        },
      }
    );

    console.log("🔓 Comunicación con TTLock exitosa.");

    // ======================================================
    // ✅ NUEVO: obtener huellas y tarjetas de la primera cerradura
    // ======================================================
    const locks = lockResponse.data.list || [];
    let fingerprintData = null;
    let cardData = null;

    if (locks.length > 0) {
      const lockId = locks[0].lockId;
      console.log(`🧠 Consultando datos de la cerradura ${lockId}...`);

      // Llamar a las funciones ya definidas
      fingerprintData = await getFingerprintList(lockId);
      cardData = await getCardList(lockId);

      console.log(`🖐️ Huellas obtenidas: ${fingerprintData.list?.length || 0}`);
      console.log(`💳 Tarjetas obtenidas: ${cardData.list?.length || 0}`);
    } else {
      console.log("⚠️ No hay cerraduras registradas para consultar huellas o tarjetas.");
    }

    res.json({
      success: true,
      token: accessToken,
      locks,
      fingerprints: fingerprintData?.list || [],
      cards: cardData?.list || [],
    });
  } catch (error) {
    console.error("❌ Error en test TTLock:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Error al comunicarse con TTLock",
      error: error.response?.data || error.message,
    });
  }
});
import WebSocket from 'ws'; // npm i ws
// -----------------------
// Helper: validar usuario por huella o tarjeta
// -----------------------
async function findUserByFingerprintOrCard(db, fingerprintNameOrCardId) {
  // fingerprintNameOrCardId: puede venir como "Nombre Apellido" o un id de tarjeta
  // Buscamos por nombre completo (nombre + apellido) o por huella_usuario o targeta_usuario
  const [rows] = await db.query(
    `SELECT * FROM usuarios WHERE 
       CONCAT(nombre_usuario, ' ', apellido_usuario) = ? 
       OR huella_usuario = ? 
       OR targeta_usuario = ? 
       LIMIT 1`,
    [fingerprintNameOrCardId, fingerprintNameOrCardId, fingerprintNameOrCardId]
  );
  return rows[0] || null;
}

// -----------------------
// Helper: obtener zona actual (la asignada en la app / desktop)
// -----------------------
async function getCurrentZoneForDevice(db, deviceId) {
  // Si el dispositivo (cerradura) está vinculado con Idzona_dispositivo en la tabla dispositivo
  const [rows] = await db.query(
    `SELECT z.* FROM dispositivo d 
       LEFT JOIN zonas z ON d.Idzona_dispositivo = z.idzonas
       WHERE d.idDispositivo = ? LIMIT 1`,
    [deviceId]
  );
  return rows[0] || null;
}

// -----------------------
// Helper: comprobar horario y nivel
// -----------------------
function isWithinSchedule(zone, now = new Date()) {
  if (!zone || !zone.horario_inicio_zona || !zone.horario_fin_zona) return true; // si no tiene horario definido, asumimos OK
  // horario_inicio_zona y horario_fin_zona se guardan como "HH:MM:SS" o TIME
  const pad = s => (s.length === 1 ? '0'+s : s);
  const toSeconds = (hms) => {
    const [h, m, s] = (''+hms).split(':').map(x => parseInt(x,10) || 0);
    return h*3600 + m*60 + s;
  };
  const secondsNow = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
  const start = toSeconds(zone.horario_inicio_zona);
  const end = toSeconds(zone.horario_fin_zona);

  if (start <= end) return secondsNow >= start && secondsNow <= end;
  // periodo que cruza medianoche
  return secondsNow >= start || secondsNow <= end;
}

function hasRequiredLevel(user, zone) {
  if (!zone || !zone.nivel_seguridad_zona) return true;
  // asumo nivel_seguridad_zona es numérico en string; adaptar si es distinto
  const zoneLevel = parseInt(zone.nivel_seguridad_zona, 10) || 1;
  const userLevel = parseInt(user?.nivel_acceso || 0, 10) || 0;
  return userLevel >= zoneLevel;
}

// -----------------------
// Registrar acceso en BD
// -----------------------
async function registerAccess(db, {
  userId = null,
  zoneId = null,
  tipo_acceso = 'Huella',
  tipo_dispositivo_acceso = 'TTLock WiFi',
  deviceId = null,
  estado_acceso = 'Denegado',
  motivo = null,
  tarjeta_id = null,
}) {
  await db.query(
    `INSERT INTO acceso 
      (idUsuario, idZona, tipo_acceso, tipo_dispositivo_acceso, idDispositivo, estado_acceso, motivo_rechazo_acceso, tarjeta_id, fecha_inicio_acceso)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [userId, zoneId, tipo_acceso, tipo_dispositivo_acceso, deviceId, estado_acceso, motivo, tarjeta_id]
  );
}

// -----------------------
// Función para intentar unlock vía TTLock Cloud API (si tienes Gateway emparejado)

async function unlockViaCloud(lockId, pool /* o contexto */) {
  // requisito: getAccessToken() que ya has en tu server.js (usa md5)
  try {
    const token = await getAccessToken(); // reuse función que tienes
    const res = await axios.post(`${process.env.TTLOCK_BASE_URL}/v3/lock/unlock`, qs.stringify({
      clientId: process.env.TTLOCK_CLIENT_ID,
      accessToken: token,
      lockId,
      date: Date.now(),
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }});
    return res.data;
  } catch (err) {
    console.error('unlockViaCloud error:', err.response?.data || err.message);
    throw err;
  }
}

// -----------------------
// WebSocket server para bridge móvil (si usas app puente)
// -----------------------
let wss;
function startBridgeWsServer(httpServer) {
  // Si ya tienes app.listen(PORT), puedes crear un WS server en paralelo:
  wss = new WebSocket.Server({ server: httpServer, path: '/bridge' });
  wss.on('connection', (ws) => {
    console.log('📡 Bridge conectado (mobile)');

    ws.on('message', (msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        console.log('Bridge ->', parsed);
        // manejar eventos desde bridge si hace confirmaciones
      } catch (e) {}
    });

    ws.on('close', () => console.log('📴 Bridge desconectado'));
  });
}

// helper para enviar a todos bridges conectados
function notifyBridges(payload) {
  if (!wss) return;
  const data = JSON.stringify(payload);
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(data);
  });
}

// -----------------------
// Endpoint: recibir evento de TTLock (callback) o procesar cuando polling detecta intento
// -----------------------
app.post('/api/ttlock/callback', async (req, res) => {
  try {
    const data = req.body;
    // Si TTLock envía `records` con json string, parsea
    let record = null;
    if (data.records) {
      try { record = JSON.parse(data.records)[0]; } catch(e) { record = null; }
    }

    const lockId = data.lockId || record?.lockId;
    const usernameFromLock = data.username || record?.username || record?.fingerprintName || record?.cardName || null;
    const deviceId = lockId;

    // 1) obtener zona vinculada al dispositivo
    const currentZone = await getCurrentZoneForDevice(db, deviceId);

    // 2) buscar usuario (por huella o por nombre)
    const user = usernameFromLock ? await findUserByFingerprintOrCard(db, usernameFromLock) : null;

    // 3) validar horarios y nivel
    let estado = 'Denegado';
    let motivo = 'Usuario no autorizado';
    if (user) {
      if (!isWithinSchedule(currentZone)) {
        estado = 'Denegado';
        motivo = 'Fuera de horario';
      } else if (!hasRequiredLevel(user, currentZone)) {
        estado = 'Denegado';
        motivo = 'Nivel de acceso insuficiente';
      } else {
        estado = 'Autorizado';
        motivo = null;
      }
    } else {
      estado = 'Denegado';
      motivo = 'Usuario no encontrado';
    }

    // 4) registrar intento
    await registerAccess(db, {
      userId: user?.idUsuarios || null,
      zoneId: currentZone?.idzonas || null,
      tipo_acceso: record?.type || 'Huella',
      tipo_dispositivo_acceso: 'TTLock Callback',
      deviceId,
      estado_acceso: estado,
      motivo,
      tarjeta_id: record?.cardNumber || null,
    });

    // 5) Si autorizado -> abrir (si hay Gateway/cloud) o notificar bridge para abrir
    if (estado === 'Autorizado') {
      // preferencia: intentar Cloud unlock si tienes gateway
      try {
        if (process.env.HAS_GATEWAY === 'true') {
          await unlockViaCloud(deviceId, db);
          console.log('🔓 Unlock via Cloud solicitado');
        } else {
          // notificar bridge móvil: payload puede contener lockId, action, requestId...
          notifyBridges({ action: 'unlock', lockId: deviceId, idUsuario: user?.idUsuarios || null });
          console.log('📣 Notificado a bridge para unlock');
        }
      } catch (err) {
        console.error('Error al intentar desbloquear tras autorización:', err.response?.data || err.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error procesando callback:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------
// Polling fallback: revisar lockRecord/list periódicamente y procesar nuevos eventos
// -----------------------
let lastRecordTimestamp = 0;
async function pollLockRecordsPeriodically(db, intervalMs = 30000) {
  console.log('🔁 Iniciando polling de lockRecord/list cada', intervalMs/1000,'s');
  setInterval(async () => {
    try {
      const token = await getAccessToken();
      const res = await axios.get(`${process.env.TTLOCK_BASE_URL}/v3/lockRecord/list`, {
        params: {
          clientId: process.env.TTLOCK_CLIENT_ID,
          accessToken: token,
          lockId: process.env.TTLOCK_LOCK_ID,
          pageNo: 1,
          pageSize: 200,
          date: Date.now(),
          // opcionalmente: startTime, endTime filters según API
        },
      });

      const list = res.data.list || [];
      for (const rec of list) {
        // rec.createDate (ms) o rec.date — dependerá de la respuesta
        const timestamp = rec.createDate || rec.date || Date.now();
        if (timestamp <= lastRecordTimestamp) continue;
        lastRecordTimestamp = Math.max(lastRecordTimestamp, timestamp);
        // mapear rec a estructura esperada y llamar al mismo handler que callback
        // construimos un objeto similar al callback
        const faux = {
          records: JSON.stringify([rec]),
          lockId: rec.lockId,
          username: rec.senderUsername || rec.fingerprintName || rec.cardName || null,
        };
        // Llamar al handler reusando el endpoint internamente:
        await axios.post(`http://localhost:${PORT}/api/ttlock/callback`, faux).catch(e => {
          console.error('Error interno procesando registro:', e.response?.data || e.message);
        });
      }
    } catch (err) {
      console.error('Polling lockRecord error:', err.response?.data || err.message);
    }
  }, intervalMs);
}

// ============================================================
// 🚀 INICIAR SERVIDOR
// ============================================================
app.listen(PORT, () => {
  console.log(`🟢 Servidor de escritorio corriendo en http://localhost:${PORT}`);
});
pollLockRecordsPeriodically(db, 30000);
