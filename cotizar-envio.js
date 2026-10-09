// GET  /api/cotizar-envio?sucursales=1884  → sucursales Andreani cercanas
// POST /api/cotizar-envio { cp, modo, valor, items } → tarifa de envío
const { cotizar, sucursales, configurado } = require('./_andreani');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const faltan = configurado();
  if (faltan.length) return res.status(503).json({ ok: false, error: 'Envíos Andreani sin configurar', faltan });
  try {
    if (req.method === 'GET' && req.query.sucursales) return res.json({ ok: true, sucursales: await sucursales(req.query.sucursales) });
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });
    return res.json({ ok: true, ...(await cotizar(req.body || {})) });
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ ok: false, error: e.message });
    console.error('Andreani:', e.message);
    return res.status(502).json({ ok: false, error: 'No pudimos cotizar con Andreani en este momento' });
  }
};
