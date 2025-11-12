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
// 🔹 Obtener lista de zonas (incluye nivel de seguridad)
// ======================================================
app.get('/api/zonas', (req, res) => {
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
      console.error('❌ Error al obtener zonas:', err);
      return res.status(500).json({ error: 'Error al obtener zonas' });
    }

    console.log('✅ Zonas obtenidas correctamente:', results.length);
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

  // 🔸 Obtener datos de la zona (nombre y nivel de seguridad)
  const zonaQuery = `
    SELECT nombre_zona, nivel_seguridad_zona 
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

    const { Nombre_Zona, nivel_seguridad_zona } = zonaResults[0];

    // 🔹 Verificar si el dispositivo ya existe
    const checkQuery = "SELECT * FROM dispositivo WHERE nombre_dispositivo = ?";
    db.query(checkQuery, [nombre_dispositivo], (err, results) => {
      if (err) {
        console.error("❌ Error al verificar dispositivo:", err);
        return res.status(500).json({ error: err.message });
      }

      // ======================================================
      // 🟢 Si el dispositivo ya existe → actualizar zona y datos
      // ======================================================
      if (results.length > 0) {
        const updateQuery = `
          UPDATE dispositivo
          SET 
            Idzona_dispositivo = ?, 
            nombre_zona_dispositivo = ?, 
            tipo_dispositivo = ?, 
            ubicacion = ?, 
            Estado = ?,
            nivel_seguridad_zona = ?
          WHERE nombre_dispositivo = ?
        `;
        db.query(
          updateQuery,
          [
            Idzona_dispositivo, 
            Nombre_Zona, 
            tipo_dispositivo || results[0].tipo_dispositivo, 
            ubicacion || results[0].ubicacion, 
            Estado || results[0].Estado, 
            nivel_seguridad_zona,
            nombre_dispositivo
          ],
          (err2) => {
            if (err2) {
              console.error("❌ Error al actualizar dispositivo:", err2);
              return res.status(500).json({ error: err2.message });
            }

            // Registrar auditoría
            const detalle = `Actualizó el dispositivo "${nombre_dispositivo}" vinculado a la zona "${Nombre_Zona}" (Nivel ${nivel_seguridad_zona})`;
            const auditQuery = `
              INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, fecha)
              VALUES (?, 'ACTUALIZAR', 'DISPOSITIVO', ?, ?, NOW())
            `;
            db.query(auditQuery, [creado_por, results[0].idDispositivo, detalle]);

            res.json({ message: "✅ Dispositivo actualizado correctamente y auditoría registrada" });
          }
        );
      } 
      // ======================================================
      // 🔵 Si el dispositivo no existe → insertar nuevo
      // ======================================================
      else {
        const insertQuery = `
          INSERT INTO dispositivo 
          (nombre_dispositivo, tipo_dispositivo, Idzona_dispositivo, nombre_zona_dispositivo, ubicacion, Estado, nivel_seguridad_zona)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        db.query(
          insertQuery,
          [
            nombre_dispositivo, 
            tipo_dispositivo || "Lector biométrico", 
            Idzona_dispositivo, 
            Nombre_Zona, 
            ubicacion || "Sin definir", 
            Estado || "Activo",
            nivel_seguridad_zona
          ],
          (err3, result) => {
            if (err3) {
              console.error("❌ Error al registrar dispositivo:", err3);
              return res.status(500).json({ error: err3.message });
            }

            // Registrar auditoría
            const detalle = `Registró nuevo dispositivo "${nombre_dispositivo}" en zona "${Nombre_Zona}" (Nivel ${nivel_seguridad_zona})`;
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

// ============================================================
// 🚀 INICIAR SERVIDOR
// ============================================================
app.listen(PORT, () => {
  console.log(`🟢 Servidor de escritorio corriendo en http://localhost:${PORT}`);
});
