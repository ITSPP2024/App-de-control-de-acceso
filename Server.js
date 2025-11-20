// server.js
// Servidor central para Desktop + integración TTLock (Gateway G2) + WebSocket bridge
import express from "express";
import dotenv from "dotenv";
dotenv.config();

import mysql from "mysql2/promise";
import cors from "cors";
import bodyParser from "body-parser";
import crypto from "crypto";
import axios from "axios";
import qs from "qs";
import { WebSocketServer } from "ws";
import { refreshTTLockToken, ttlockLogin } from "./ttlock/auth.js";

const app = express();
const PORT = process.env.PORT_DESKTOP || 5002;
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const lastAccessEvent = new Map();

// -------------------------
// DB pool (mysql2/promise)
// -------------------------
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "admin",
  database: process.env.DB_NAME || "sistema_control_acceso",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// -------------------------
// Util: md5
// -------------------------
function md5(value) {
  return crypto.createHash("md5").update(value).digest("hex");
}

// -------------------------
// WebSocket server (para notificar app de escritorio / bridges)
// -------------------------
let wss;
function startWebSocketServer(httpServer) {
const wss = new WebSocketServer({
  server: httpServer,
  path: "/bridge",
});
  wss.on("connection", (ws) => {
    console.log("📡 Bridge conectado (WebSocket)");
    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        console.log("← bridge:", data);
      } catch (e) {}
    });
    ws.on("close", () => console.log("📴 Bridge desconectado (WebSocket)"));
  });
}
function broadcastToBridges(payload) {
  if (!wss) return;
  const json = JSON.stringify(payload);
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(json);
  });
}

// -------------------------
// TTLock helper: get access token (usa auth.js refreshTTLockToken)
// -------------------------
async function getAccessTokenSafe() {
  try {
    const tokenData = await refreshTTLockToken(); // devuelve objeto con access_token (según tu auth.js)
    // refreshTTLockToken en tu auth.js guarda tokens en BD y retorna tokenData
    return tokenData.access_token || tokenData.access_token === 0 ? tokenData.access_token : tokenData;
  } catch (err) {
    console.warn("⚠️ refreshTTLockToken falló, intentando login directo...");
    const data = await ttlockLogin();
    return data.access_token;
  }
}

// -------------------------
// TTLock helpers (fingerprint/card lists + unlock)
// -------------------------
async function getFingerprintList(lockId) {
  const token = await getAccessTokenSafe();
  const url = `${process.env.TTLOCK_BASE_URL}/v3/fingerprint/list`;
  const params = {
    clientId: process.env.TTLOCK_CLIENT_ID,
    accessToken: token,
    lockId,
    pageNo: 1,
    pageSize: 200,
    orderBy: 1,
    date: Date.now(),
  };
  try {
    const resp = await axios.get(url, { params });
    return resp.data.list || [];
  } catch (err) {
    console.error("❌ getFingerprintList error:", err.response?.data || err.message);
    return [];
  }
}

async function getCardList(lockId) {
  const token = await getAccessTokenSafe();
  const url = `${process.env.TTLOCK_BASE_URL}/v3/card/list`;
  const params = {
    clientId: process.env.TTLOCK_CLIENT_ID,
    accessToken: token,
    lockId,
    pageNo: 1,
    pageSize: 200,
    orderBy: 1,
    date: Date.now(),
  };
  try {
    const resp = await axios.get(url, { params });
    return resp.data.list || [];
  } catch (err) {
    console.error("❌ getCardList error:", err.response?.data || err.message);
    return [];
  }
}

// Intentar unlock vía cloud (requiere Gateway emparejado)
async function unlockViaCloud(lockId) {
  const token = await getAccessTokenSafe();
  const url = `${process.env.TTLOCK_BASE_URL}/v3/lock/unlock`;
  const body = qs.stringify({
    clientId: process.env.TTLOCK_CLIENT_ID,
    accessToken: token,
    lockId,
    date: Date.now(),
  });
  try {
    const resp = await axios.post(url, body, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    return resp.data;
  } catch (err) {
    console.error("❌ unlockViaCloud error:", err.response?.data || err.message);
    throw err;
  }
}

// Intentar activar modo "agregar huella" (no existe un estándar universal en la API pública, se hace con fingerprint/add o lock/operate según docs)
async function activarModoAgregarHuella(lockId, fingerprintName) {
  // Intentamos el path más directo: llamar a fingerprint/add para crear un "placeholder" que hace que el lock entre en modo enroll.
  // NOTA: algunos firmwares requieren que la app TTLock móvil inicie la captura; el Gateway soporta add card/fingerprint via cloud cuando está emparejado.
  const token = await getAccessTokenSafe();
  const url = `${process.env.TTLOCK_BASE_URL}/v3/fingerprint/add`;
  const now = Date.now();
  const startDate = now;
  const endDate = now + 1000 * 3600 * 24 * 365 * 5; // +5 años
  const body = qs.stringify({
    clientId: process.env.TTLOCK_CLIENT_ID,
    accessToken: token,
    lockId,
    fingerprintName,
    startDate,
    endDate,
    createDate: now,
  });

  try {
    const resp = await axios.post(url, body, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    return resp.data;
  } catch (err) {
    // si falla, intentamos lock/operate (algunos modelos usan command 7 etc)
    try {
      console.warn("fingerprint/add falló, intentando lock/operate fallback...");
      const urlOp = `${process.env.TTLOCK_BASE_URL}/v3/lock/operate`;
      const bodyOp = qs.stringify({
        clientId: process.env.TTLOCK_CLIENT_ID,
        accessToken: token,
        lockId,
        command: 7,
        date: Date.now(),
      });
      const resp2 = await axios.post(urlOp, bodyOp, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      return resp2.data;
    } catch (err2) {
      console.error("❌ activarModoAgregarHuella error:", err.response?.data || err2.response?.data || err.message);
      throw err2;
    }
  }
}

// -------------------------
// Helpers DB: buscar usuario por huella o tarjeta o por nombre
// -------------------------
async function findUserByFingerprintOrCardOrName(poolConn, key) {
  // key puede ser fingerprintNumber (string/num), cardNumber, o nombre completo (fingerprintName)
  const sql = `
    SELECT * FROM usuarios
    WHERE huella_usuario = ?
      OR targeta_usuario = ?
      OR CONCAT(nombre_usuario, ' ', apellido_usuario) = ?
    LIMIT 1
  `;
  const [rows] = await poolConn.query(sql, [key, key, key]);
  return rows[0] || null;
}

async function getZoneForDevice(poolConn, deviceId) {
  const sql = `
    SELECT z.*
    FROM dispositivo d
    LEFT JOIN zonas z ON d.Idzona_dispositivo = z.idzonas
    WHERE d.idDispositivo = ?
    LIMIT 1
  `;
  const [rows] = await poolConn.query(sql, [deviceId]);
  return rows[0] || null;
}

// verificar horario
function isWithinSchedule(zone, now = new Date()) {
  if (!zone || !zone.horario_inicio_zona || !zone.horario_fin_zona) return true;
  const toSeconds = (hms) => {
    if (!hms) return 0;
    const [h, m, s] = ("" + hms).split(":").map((x) => parseInt(x, 10) || 0);
    return h * 3600 + m * 60 + s;
  };
  const secondsNow = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const start = toSeconds(zone.horario_inicio_zona);
  const end = toSeconds(zone.horario_fin_zona);
  if (start <= end) return secondsNow >= start && secondsNow <= end;
  return secondsNow >= start || secondsNow <= end;
}
function hasRequiredLevel(user, zone) {
  if (!zone || !zone.nivel_seguridad_zona) return true;
  const zoneLevel = parseInt(zone.nivel_seguridad_zona || "1", 10) || 1;
  const userLevel = parseInt(user?.nivel_acceso || "0", 10) || 0;
  return userLevel >= zoneLevel;
}

// registrar acceso
async function registerAccess(poolConn, {
  userId = null,
  zoneId = null,
  tipo_acceso = 'Huella',
  tipo_dispositivo_acceso = 'TTLock Callback',
  deviceId = null,
  estado_acceso = 'Denegado',
  motivo = null,
  tarjeta_id = null,
}) {
  const sql = `
    INSERT INTO acceso 
      (idUsuario, idZona, tipo_acceso, tipo_dispositivo_acceso, idDispositivo, estado_acceso, motivo_rechazo_acceso, tarjeta_id, fecha_inicio_acceso)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;
  await poolConn.query(sql, [userId, zoneId, tipo_acceso, tipo_dispositivo_acceso, deviceId, estado_acceso, motivo, tarjeta_id]);
}

// -------------------------
// ENDPOINTS básicos (zonas / dispositivos / login) - compatibles con tu front
// -------------------------
app.get("/api/zonas", async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT idzonas, nombre_zona, nivel_seguridad_zona, capacidad_maxima_zona, horario_inicio_zona, horario_fin_zona, descripcion_zona, estado_zona, requiresEscort FROM zonas`);
    res.json(rows);
  } catch (err) {
    console.error("Error /api/zonas:", err);
    res.status(500).json({ error: "Error al obtener zonas" });
  }
});

app.get("/api/dispositivos", async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT idDispositivo, nombre_dispositivo FROM dispositivo WHERE Estado = 'Activo'`);
    res.json(rows);
  } catch (err) {
    console.error("Error /api/dispositivos:", err);
    res.status(500).json({ error: "Error al obtener dispositivos" });
  }
});

// login admin (mantengo tu esquema: bcrypt en tu otro server, aquí demo simple)
import bcrypt from "bcrypt";
app.post("/api/login", async (req, res) => {
  const { correo, contraseña } = req.body;
  if (!correo || !contraseña) return res.status(400).json({ error: "Faltan datos" });
  try {
    const [rows] = await pool.query("SELECT * FROM administradores WHERE Correo_Administrador = ? LIMIT 1", [correo]);
    if (rows.length === 0) return res.status(401).json({ error: "Correo no encontrado" });
    const admin = rows[0];
    const ok = await bcrypt.compare(contraseña, admin.Contraseña_Administrador);
    if (!ok) return res.status(401).json({ error: "Contraseña incorrecta" });
    res.json({ idAdministrador: admin.idAdministrador, nombre: admin.Nombre_Administrador, apellido: admin.Apellido_Administrador, correo: admin.Correo_Administrador });
  } catch (err) {
    console.error("Error /api/login:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// registrar acceso (endpoint que usaba tu front)
app.post("/api/accesos", async (req, res) => {
  const { idUsuario, idZona, tipo_acceso, metodo } = req.body;
  if (!idUsuario || !idZona || !tipo_acceso || !metodo) return res.status(400).json({ error: "Faltan datos obligatorios" });
  try {
    await pool.query(`INSERT INTO acceso (idUsuario, idZona, tipo_acceso, tipo_dispositivo_acceso, fecha_inicio_acceso) VALUES (?, ?, ?, ?, NOW())`, [idUsuario, idZona, tipo_acceso, metodo]);
    res.json({ message: "Acceso registrado correctamente" });
  } catch (err) {
    console.error("Error /api/accesos:", err);
    res.status(500).json({ error: "Error al registrar acceso" });
  }
});

// -------------------------
// TTLock: Request Fingerprint (activa enroll en cerradura y crea solicitud en BD)
// -------------------------
app.post("/api/ttlock/requestFingerprint", async (req, res) => {
  const { correo_usuario } = req.body;
  if (!correo_usuario) return res.status(400).json({ error: "correo_usuario requerido" });

  try {
    const [users] = await pool.query("SELECT idUsuarios, nombre_usuario, apellido_usuario FROM usuarios WHERE correo_usuario = ? LIMIT 1", [correo_usuario]);
    if (users.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    const user = users[0];

    // limpiar solicitudes previas (si existe la tabla ttlock_solicitudes)
    try {
      await pool.query("DELETE FROM ttlock_solicitudes WHERE correo_usuario = ?", [correo_usuario]);
    } catch (_) {
      // tabla puede no existir; no fatal
    }

    // crear solicitud (si existe la tabla)
    try {
      await pool.query("INSERT INTO ttlock_solicitudes (correo_usuario, tipo, status, fecha_creacion) VALUES (?, 'fingerprint', 'PENDING', NOW())", [correo_usuario]);
    } catch (_) { /* ignora si tabla no existe */ }

    // activar modo agregar huella con nombre completo (intento)
    const fullName = `${(user.nombre_usuario||"").trim()} ${(user.apellido_usuario||"").trim()}`.trim() || correo_usuario;
    const lockId = process.env.TTLOCK_LOCK_ID;
    try {
      const resp = await activarModoAgregarHuella(lockId, fullName);
      console.log("activarModoAgregarHuella resp:", resp);
    } catch (err) {
      console.warn("No se pudo activar modo agregar huella (la cerradura/gateway puede requerir la app TTLock móvil):", err.response?.data || err.message);
    }

    try {
      const [admins] = await pool.query("SELECT idAdministrador FROM administradores LIMIT 1");
      const adminId = (admins[0]?.idAdministrador) || null;
      await pool.query("INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, fecha) VALUES (?, 'SOLICITAR_HUELLA', 'USUARIO', ?, ?, NOW())", [adminId ?? user.idUsuarios, user.idUsuarios, `Solicitud de huella iniciada para ${fullName}`]);
    } catch (e) {
      console.warn("No fue posible insertar auditoría (tabla auditoria o columnas distintas):", e.message);
    }

    res.json({ success: true, message: "Solicitud registrada. Acerca la huella a la cerradura.", userId: user.idUsuarios });
  } catch (err) {
    console.error("Error requestFingerprint:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// -------------------------
// TTLock: Add Card (activa enroll tarjeta en cerradura)
// -------------------------
app.post("/api/ttlock/addCard", async (req, res) => {
  const { correo_usuario } = req.body;
  if (!correo_usuario) return res.status(400).json({ error: "correo_usuario requerido" });

  try {
    const [users] = await pool.query("SELECT idUsuarios, nombre_usuario, apellido_usuario FROM usuarios WHERE correo_usuario = ? LIMIT 1", [correo_usuario]);
    if (users.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    const user = users[0];

    // crear solicitud (si existe la tabla)
    try {
      await pool.query("INSERT INTO ttlock_solicitudes (correo_usuario, tipo, status, fecha_creacion) VALUES (?, 'card', 'PENDING', NOW())", [correo_usuario]);
    } catch (_) {}

    // intentar comando card/add
    try {
      const token = await getAccessTokenSafe();
      const url = `${process.env.TTLOCK_BASE_URL}/v3/card/add`;
      const now = Date.now();
      const fullName = `${(user.nombre_usuario||"").trim()} ${(user.apellido_usuario||"").trim()}`.trim() || correo_usuario;
      const body = qs.stringify({
        clientId: process.env.TTLOCK_CLIENT_ID,
        accessToken: token,
        lockId: process.env.TTLOCK_LOCK_ID,
        cardName: fullName,
        addType: 1,
        startDate: now,
        endDate: now + 1000 * 3600 * 24 * 365 * 5,
      });
      const resp = await axios.post(url, body, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      console.log("card/add resp:", resp.data);
    } catch (err) {
      console.warn("card/add falló (tal vez requiere sincronización móvil):", err.response?.data || err.message);
    }

    // auditoría
    try {
      const [admins] = await pool.query("SELECT idAdministrador FROM administradores LIMIT 1");
      const adminId = (admins[0]?.idAdministrador) || null;
      await pool.query("INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, fecha) VALUES (?, 'SOLICITAR_TARJETA', 'USUARIO', ?, ?, NOW())", [adminId ?? user.idUsuarios, user.idUsuarios, `Solicitud de tarjeta iniciada para ${user.nombre_usuario} ${user.apellido_usuario}`]);
    } catch (e) {}

    res.json({ success: true, message: "Solicitud para agregar tarjeta enviada. Acerca la tarjeta al sensor en la cerradura." });
  } catch (err) {
    console.error("Error addCard:", err);
    res.status(500).json({ error: "Error interno" });
  }
});
// -------------------------
// TTLock Callback endpoint
// -------------------------
app.post("/api/ttlock/callback", async (req, res) => {
  try {
    const data = req.body;
    console.log("📬 Callback recibido de TTLock:", data);

    let record = null;
    if (data.records) {
      try {
        const parsed = JSON.parse(data.records);
        record = parsed[0];
      } catch (e) {
        record = null;
      }
    }

    const extractedLockId =
      data.lockId ||
      record?.lockId ||
      record?.doorId ||
      null;

    if (!extractedLockId) {
      return res.status(400).json({ success: false, message: "Falta lockId" });
    }

    const now = Date.now();
    const last = lastAccessEvent.get(extractedLockId);

    if (last && now - last < 3000) {
      console.log("⏳ Callback duplicado ignorado");
      return res.json({ message: "Callback duplicado ignorado" });
    }

    lastAccessEvent.set(extractedLockId, now);

    const usernameFromLock =
      data.username ||
      record?.senderUsername ||
      record?.username ||
      record?.fingerprintName ||
      record?.cardName ||
      null;

    const fingerprintNumber =
      record?.fingerprintNumber ||
      record?.fingerprintId ||
      null;

    const cardNumber =
      record?.cardNumber ||
      record?.cardId ||
      null;

    // ============================================================
    // 🔧 Registrar/Actualizar Dispositivo
    // ============================================================
    try {
      const [rows] = await pool.query(
        "SELECT * FROM dispositivo WHERE idDispositivo = ? LIMIT 1",
        [extractedLockId]
      );

      if (rows.length === 0) {
        await pool.query(
          `INSERT INTO dispositivo 
          (idDispositivo, nombre_dispositivo, tipo_dispositivo, Estado, lock_key, wifi_lock)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [
            extractedLockId,
            `Cerradura-${extractedLockId}`,
            "TTLock",
            "Activo",
            record?.lockMac || data.lockMac || null,
            1,
          ]
        );
        console.log(`✅ Cerradura ${extractedLockId} registrada.`);
      } else {
        await pool.query(
          `UPDATE dispositivo 
           SET Estado = ?, lock_key = ?, wifi_lock = ? 
           WHERE idDispositivo = ?`,
          [
            "Activo",
            record?.lockMac || data.lockMac || rows[0].lock_key,
            1,
            extractedLockId,
          ]
        );
      }
    } catch (err) {
      console.warn("⚠ No se pudo actualizar dispositivo:", err.message);
    }

    // ============================================================
    // 🔍 Identificar Usuario
    // ============================================================
    const currentZone = await getZoneForDevice(pool, extractedLockId);

    let user = null;

    if (fingerprintNumber) {
      user = await findUserByFingerprintOrCardOrName(
        pool,
        fingerprintNumber.toString()
      );
    }

    if (!user && cardNumber) {
      user = await findUserByFingerprintOrCardOrName(
        pool,
        cardNumber.toString()
      );
    }

    if (!user && usernameFromLock) {
      user = await findUserByFingerprintOrCardOrName(
        pool,
        usernameFromLock
      );
    }

    // ============================================================
    // 🧠 Determinar Autorización
    // ============================================================
    let estado = "Denegado";
    let motivo = "Usuario no autorizado";

    if (user) {
      if (!isWithinSchedule(currentZone)) {
        motivo = "Fuera de horario";
      } else if (!hasRequiredLevel(user, currentZone)) {
        motivo = "Nivel de acceso insuficiente";
      } else {
        estado = "Autorizado";
        motivo = null;
      }
    } else {
      motivo = "Usuario no encontrado";
    }

    // ============================================================
    // ⛔ FILTRO ANTI-BASURA (Eventos locales por 2FA)
    // ============================================================
    if (estado === "Denegado" && !user) {
      const lastAuthorized = lastAccessEvent.get(`authorized_${extractedLockId}`);

      if (lastAuthorized && Date.now() - lastAuthorized < 5000) {
        console.log("⛔ Evento local denegado ignorado (2FA + cloud unlock)");
        return res.json({ success: true, ignored: true });
      }
    }

    // Guardar marca de acceso válido
    if (estado === "Autorizado") {
      lastAccessEvent.set(`authorized_${extractedLockId}`, Date.now());
    }

    // ============================================================
    // 📝 Registro de acceso
    // ============================================================
    // Registro SOLO si existe un usuario válido
if (!user?.idUsuarios) {
  console.log("⚠ Acceso local ignorado: no hay usuario asignado (primer factor)");
  return res.json({ success: true, ignored: true });
}

try {
  await registerAccess(pool, {
    userId: user.idUsuarios,
    zoneId: currentZone?.idzonas || null,
    tipo_acceso: record?.type || "Huella",
    tipo_dispositivo_acceso: "TTLock Callback",
    deviceId: extractedLockId,
    estado_acceso: estado,
    motivo,
    tarjeta_id: cardNumber || null,
  });
} catch (err) {
  console.error("Error registrando acceso:", err.message);
}
    // ============================================================
    // 📡 Notificación a Bridges
    // ============================================================
    broadcastToBridges({
      event: "access_attempt",
      lockId: extractedLockId,
      user: user
        ? {
            id: user.idUsuarios,
            nombre: `${user.nombre_usuario} ${user.apellido_usuario}`,
          }
        : null,
      estado,
      motivo,
      timestamp: Date.now(),
    });

    // ============================================================
    // 🔓 Acceso Autorizado → Abrir Cerradura
    // ============================================================
    if (estado === "Autorizado") {
      if (process.env.HAS_GATEWAY === "true") {
        try {
          const unlockResp = await unlockViaCloud(extractedLockId);
          console.log("🔓 Unlock via cloud solicitado:", unlockResp);
        } catch (err) {
          console.error(
            "Error unlockViaCloud:",
            err.response?.data || err.message
          );
        }
      } else {
        broadcastToBridges({
          action: "unlock",
          lockId: extractedLockId,
          userId: user?.idUsuarios || null,
        });
      }
    }

    res.json({ success: true });

  } catch (err) {
    console.error(
      "Error en /api/ttlock/callback:",
      err.response?.data || err.message || err
    );
    res.status(500).json({ success: false, error: "Error interno" });
  }
});

// -------------------------
// Registrar o vincular dispositivo (POST /api/dispositivo)
// -------------------------
app.post("/api/dispositivo", async (req, res) => {
  try {
    const {
      Idzona_dispositivo,
      idDispositivo,
      nombre_dispositivo,
      tipo_dispositivo,
      nombre_zona_dispositivo,
      ubicacion,
      Estado,
      lock_key,
      wifi_lock
    } = req.body;

    // Validaciones básicas
    if (!Idzona_dispositivo || !idDispositivo) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    // Comprobar si existe el dispositivo por idDispositivo
    const [existing] = await pool.query("SELECT * FROM dispositivo WHERE idDispositivo = ? LIMIT 1", [idDispositivo]);

    if (existing.length > 0) {
      // Actualizar dispositivo existente
      const updateSql = `
        UPDATE dispositivo SET
          Idzona_dispositivo = ?,
          nombre_dispositivo = ?,
          tipo_dispositivo = ?,
          nombre_zona_dispositivo = ?,
          ubicacion = ?,
          Estado = ?,
          lock_key = ?,
          wifi_lock = ?
        WHERE idDispositivo = ?
      `;
      await pool.query(updateSql, [
        Idzona_dispositivo,
        nombre_dispositivo || existing[0].nombre_dispositivo,
        tipo_dispositivo || existing[0].tipo_dispositivo,
        nombre_zona_dispositivo || existing[0].nombre_zona_dispositivo,
        ubicacion || existing[0].ubicacion,
        Estado || existing[0].Estado,
        typeof lock_key !== "undefined" ? lock_key : existing[0].lock_key,
        typeof wifi_lock !== "undefined" ? wifi_lock : existing[0].wifi_lock,
        idDispositivo
      ]);

      // opcional: registrar auditoría si quieres (no agregué creado_por)
      return res.json({ message: "✅ Dispositivo actualizado correctamente", idDispositivo });
    } else {
      // Insertar nuevo dispositivo (si tu esquema permite insertar con idDispositivo manualmente)
      // Si idDispositivo es AUTO_INCREMENT en tu BD y NO quieres setear id manualmente, elimina idDispositivo del INSERT.
      const insertSql = `
        INSERT INTO dispositivo (
          idDispositivo,
          Idzona_dispositivo,
          nombre_dispositivo,
          tipo_dispositivo,
          nombre_zona_dispositivo,
          ubicacion,
          Estado,
          lock_key,
          wifi_lock
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await pool.query(insertSql, [
        idDispositivo,
        Idzona_dispositivo,
        nombre_dispositivo || `Device-${idDispositivo}`,
        tipo_dispositivo || "Lector biométrico",
        nombre_zona_dispositivo || null,
        ubicacion || null,
        Estado || "Activo",
        lock_key || null,
        typeof wifi_lock !== "undefined" ? wifi_lock : 0
      ]);

      return res.json({ message: "✅ Nuevo dispositivo registrado correctamente", idDispositivo });
    }
  } catch (err) {
    console.error("❌ Error al guardar dispositivo:", err);
    // Si es error de BD que revele info (p.ej. columnas incorrectas), lo devolvemos para debugging
    return res.status(500).json({ error: "Error al guardar dispositivo", details: err.message });
  }
});

// -------------------------
// Iniciar servidor + WS
// -------------------------
const server = app.listen(PORT, async () => {
  console.log(`🟢 Servidor de escritorio corriendo en http://localhost:${PORT}`);
  // iniciar WS
  startWebSocketServer(server);

  // simple check TTLock token on startup (no bloqueante)
  try {
    const token = await getAccessTokenSafe();
    console.log("🔐 Token TTLock listo (startup).");
  } catch (err) {
    console.warn("⚠️ No se pudo obtener token TTLock en startup:", err.message || err);
  }
});
