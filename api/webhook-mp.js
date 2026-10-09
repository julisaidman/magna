// POST /api/webhook-mp → MercadoPago avisa acá cada cambio de un pago.
// Si el pago está aprobado o pendiente, manda el pedido completo a Make (email + Google Sheets),
// igual que en la web anterior, pero desde el servidor: ya no depende de que el cliente vuelva a la web.
// Variables de entorno en Vercel:
//   MP_ACCESS_TOKEN      el mismo de crear-pago
//   MAKE_WEBHOOK_URL     el webhook de Make que ya usabas
//   MP_WEBHOOK_SECRET    (opcional) clave secreta de notificaciones de MP, para validar la firma
const crypto = require('crypto');

function firmaValida(req, dataId) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;
  const sig = String(req.headers['x-signature'] || '');
  const ts = (sig.match(/ts=([^,]+)/) || [])[1];
  const v1 = (sig.match(/v1=([^,]+)/) || [])[1];
  if (!ts || !v1) return false;
  const manifest = `id:${dataId};request-id:${req.headers['x-request-id'] || ''};ts:${ts};`;
  const calc = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return calc.length === v1.length && crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(v1));
}

const ESTADOS = { approved: 'Pago aprobado ✓', in_process: 'Pago pendiente ⏳', pending: 'Pago pendiente ⏳' };

module.exports = async (req, res) => {
  try {
    const q = req.query || {}, b = req.body || {};
    const tipo = b.type || q.type || q.topic;
    const id = (b.data && b.data.id) || q['data.id'] || q.id;
    if (tipo !== 'payment' || !id) return res.status(200).send('ignorado');
    if (!firmaValida(req, String(id).toLowerCase())) return res.status(401).send('firma inválida');

    const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
    });
    if (!r.ok) { console.error('MP pago', id, r.status); return res.status(200).send('sin pago'); }
    const pago = await r.json();
    const estado = ESTADOS[pago.status];
    if (!estado || !process.env.MAKE_WEBHOOK_URL) return res.status(200).send('ok');

    const m = pago.metadata || {};
    await fetch(process.env.MAKE_WEBHOOK_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: m.ref || pago.external_reference, estado,
        fecha: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
        nombre: m.nombre, telefono: m.telefono, email: m.email || (pago.payer && pago.payer.email), empresa: m.empresa,
        productos: m.productos, metros: m.metros, descuento_pct: m.descuento_pct,
        subtotal_productos: m.subtotal_productos, envio: m.envio, total: m.total,
        entrega: m.entrega, nota: m.nota,
        monto_pagado: pago.transaction_amount, medio_pago: pago.payment_method_id, id_pago_mp: pago.id
      })
    });
    return res.status(200).send('ok');
  } catch (e) {
    console.error('webhook-mp:', e.message);
    return res.status(200).send('error registrado'); // 200 para que MP no reintente en loop
  }
};
