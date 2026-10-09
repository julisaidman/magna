// Módulo compartido: conexión con la API de Andreani (los archivos con _ no son rutas públicas).
// Las credenciales NUNCA van en el HTML: se cargan como variables de entorno en Vercel
// (Project → Settings → Environment Variables):
//
//   ANDREANI_USUARIO             usuario de la API que te da Andreani
//   ANDREANI_CLAVE               contraseña de la API
//   ANDREANI_CLIENTE             número de cliente (ej. CL0003750)
//   ANDREANI_CONTRATO_DOMICILIO  contrato de envío a domicilio
//   ANDREANI_CONTRATO_SUCURSAL   (opcional) contrato de envío a sucursal
//   ANDREANI_ENTORNO             "prod" para producción; si no, usa el entorno de pruebas (QA)

const BASE = process.env.ANDREANI_ENTORNO === 'prod'
  ? 'https://apis.andreani.com'
  : 'https://apisqa.andreani.com';

// Peso aproximado de 1 metro lineal de rollo, en kg, por espesor.
// ⚠ Calculado para un rollo de ~62 cm de ancho. Pesá un metro real de cada uno y corregí.
const KG_POR_METRO = { '0,3': 0.7, '0,4': 0.95, '0,8': 1.85, '0,9': 2.1 };
const KG_EMBALAJE = 0.3;

let token = null, tokenHasta = 0;

async function obtenerToken(forzar = false) {
  if (!forzar && token && Date.now() < tokenHasta) return token;
  const basic = Buffer.from(`${process.env.ANDREANI_USUARIO}:${process.env.ANDREANI_CLAVE}`).toString('base64');
  const r = await fetch(`${BASE}/login`, { headers: { Authorization: `Basic ${basic}` } });
  if (!r.ok) throw new Error(`Login Andreani falló (${r.status})`);
  token = r.headers.get('x-authorization-token');
  if (!token) throw new Error('Andreani no devolvió token');
  tokenHasta = Date.now() + 12 * 60 * 60 * 1000; // se renueva cada 12 h
  return token;
}

async function andreani(path) {
  let t = await obtenerToken();
  let r = await fetch(BASE + path, { headers: { 'x-authorization-token': t } });
  if (r.status === 401 || r.status === 403) {          // token vencido: reintenta una vez
    t = await obtenerToken(true);
    r = await fetch(BASE + path, { headers: { 'x-authorization-token': t } });
  }
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error((body && (body.detail || body.title || body.mensaje)) || `Andreani respondió ${r.status}`);
  return body;
}

const limpiarCP = cp => (String(cp || '').match(/\d{4}/) || [])[0];


function configurado() {
  return ['ANDREANI_USUARIO','ANDREANI_CLAVE','ANDREANI_CLIENTE','ANDREANI_CONTRATO_DOMICILIO'].filter(k => !process.env[k]);
}

async function cotizar({ cp, modo = 'domicilio', valor = 0, items = [] }) {
  const cpOk = limpiarCP(cp);
  if (!cpOk) throw Object.assign(new Error('Código postal inválido'), { status: 400 });
  if (!Array.isArray(items) || !items.length) throw Object.assign(new Error('Pedido vacío'), { status: 400 });
  const contrato = modo === 'sucursal' ? process.env.ANDREANI_CONTRATO_SUCURSAL : process.env.ANDREANI_CONTRATO_DOMICILIO;
  if (!contrato) throw Object.assign(new Error('Envío a sucursal no disponible'), { status: 400 });
  let kilos = KG_EMBALAJE;
  for (const it of items) {
    const kg = KG_POR_METRO[it.esp];
    const m = Math.min(Math.max(parseInt(it.m, 10) || 0, 0), 2000);
    if (!kg || !m) throw Object.assign(new Error('Producto inválido'), { status: 400 });
    kilos += kg * m;
  }
  const q = new URLSearchParams({
    cpDestino: cpOk, contrato, cliente: process.env.ANDREANI_CLIENTE,
    'bultos[0][kilos]': kilos.toFixed(2),
    'bultos[0][valorDeclarado]': String(Math.round(Math.max(+valor || 0, 1)))
  });
  const data = await andreani(`/v1/tarifas?${q}`);
  const total = Number((data.tarifaConIva && data.tarifaConIva.total) ?? data.total);
  if (!Number.isFinite(total)) throw new Error('Respuesta de tarifa inesperada');
  return { total: Math.round(total), kilos: +kilos.toFixed(2), modo };
}

async function sucursales(cpTxt) {
  const cp = limpiarCP(cpTxt);
  if (!cp) throw Object.assign(new Error('Código postal inválido'), { status: 400 });
  const data = await andreani(`/v2/sucursales?codigoPostal=${cp}&canal=B2C`);
  return (Array.isArray(data) ? data : (data.sucursales || [])).slice(0, 8).map(s => ({
    id: s.id || s.codigo || s.numero,
    nombre: s.descripcion || s.nombre || 'Sucursal Andreani',
    direccion: s.direccion ? [s.direccion.calle, s.direccion.numero, s.direccion.localidad].filter(Boolean).join(' ') : ''
  }));
}

module.exports = { cotizar, sucursales, configurado, limpiarCP };
