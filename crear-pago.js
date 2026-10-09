// POST /api/crear-pago → crea la preferencia de MercadoPago y devuelve el link de pago.
// Variables de entorno en Vercel:
//   MP_ACCESS_TOKEN   Access Token de producción de MercadoPago (NUNCA en el HTML)
const crypto = require('crypto');
const { calcularPedido, versionTxt } = require('./_pedido');
const andreani = require('./_andreani');

const txt = (v, max = 200) => String(v || '').trim().slice(0, max);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });
  if (!process.env.MP_ACCESS_TOKEN) return res.status(503).json({ ok: false, error: 'Pago online sin configurar' });

  try {
    const { items, entrega = {}, datos = {} } = req.body || {};
    const pedido = calcularPedido(items);

    // Envío: se recotiza acá, no se usa el número que manda el navegador
    const ent = ['domicilio', 'sucursal', 'retiro'].includes(entrega.ent) ? entrega.ent : 'retiro';
    let envio = 0;
    if (ent !== 'retiro') {
      if (andreani.configurado().length) return res.status(409).json({ ok: false, error: 'No podemos cotizar el envío online. Enviá el pedido por WhatsApp.' });
      try {
        envio = (await andreani.cotizar({ cp: entrega.cp, modo: ent, valor: pedido.productos,
          items: pedido.lineas.map(l => ({ esp: l.esp, m: l.m })) })).total;
      } catch (e) {
        return res.status(409).json({ ok: false, error: 'No pudimos cotizar el envío. Probá de nuevo o enviá el pedido por WhatsApp.' });
      }
    }

    const nom = txt(datos.nom, 80), tel = txt(datos.tel, 30), mail = txt(datos.mail, 120);
    if (nom.length < 2 || tel.replace(/\D/g, '').length < 8) return res.status(400).json({ ok: false, error: 'Faltan tus datos' });

    const ref = 'MG-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
    const entregaTxt = ent === 'retiro' ? 'Retiro por depósito'
      : ent === 'sucursal' ? `Andreani a sucursal: ${txt(entrega.suc, 120)} (CP ${txt(entrega.cp, 10)})`
      : `Andreani a domicilio: ${txt(entrega.dir, 120)}, ${txt(entrega.loc, 60)}, ${txt(entrega.prov, 40)} (CP ${txt(entrega.cp, 10)})`;
    const productosTxt = pedido.lineas.map(l => `${l.m} m de ${l.esp} mm ${versionTxt(l.adh)}`).join(' | ');

    const mpItems = pedido.lineas.map(l => ({
      id: `${l.adh}-${l.esp}`,
      title: `Lámina magnética ${l.esp} mm ${versionTxt(l.adh)} (${l.m} m)`,
      quantity: 1, unit_price: l.total, currency_id: 'ARS'
    }));
    if (envio) mpItems.push({ id: 'envio', title: 'Envío Andreani', quantity: 1, unit_price: envio, currency_id: 'ARS' });

    const origen = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      body: JSON.stringify({
        items: mpItems,
        payer: { name: nom, ...(mail ? { email: mail } : {}), phone: { number: tel } },
        back_urls: { success: `${origen}/?pago=ok`, failure: `${origen}/?pago=error`, pending: `${origen}/?pago=pendiente` },
        auto_return: 'approved',
        binary_mode: false,
        statement_descriptor: 'MAGNA IMANES',
        external_reference: ref,
        notification_url: `${origen}/api/webhook-mp`,
        // Viaja con el pago: el webhook lo usa para mandar el email y la fila de Sheets completos
        metadata: {
          ref, nombre: nom, telefono: tel, email: mail, empresa: txt(datos.emp, 120), nota: txt(datos.nota, 300),
          productos: productosTxt, metros: pedido.metros, descuento_pct: pedido.pct,
          subtotal_productos: pedido.productos, envio, total: pedido.productos + envio, entrega: entregaTxt
        }
      })
    });
    const pref = await r.json();
    if (!r.ok || !pref.init_point) {
      console.error('MP preferencia:', r.status, JSON.stringify(pref).slice(0, 500));
      return res.status(502).json({ ok: false, error: 'MercadoPago no respondió. Probá de nuevo o enviá el pedido por WhatsApp.' });
    }
    return res.json({ ok: true, ref, url: pref.init_point, total: pedido.productos + envio, envio });
  } catch (e) {
    console.error('crear-pago:', e.message);
    return res.status(400).json({ ok: false, error: e.message || 'Pedido inválido' });
  }
};
