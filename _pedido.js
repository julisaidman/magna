// Cálculo del pedido del lado del servidor (no se confía en los precios que manda el navegador).
const { PRECIOS, DESCUENTOS } = require('../precios.js');

function calcularPedido(items) {
  if (!Array.isArray(items) || !items.length || items.length > 20) throw new Error('Pedido vacío o inválido');
  const lineas = items.map(it => {
    const adh = it.adh === 'sin' ? 'sin' : 'con';
    const precio = PRECIOS[adh][it.esp];
    const m = parseInt(it.m, 10);
    if (!precio || !(m >= 1 && m <= 2000)) throw new Error('Producto inválido');
    return { adh, esp: it.esp, m, precio, bruto: precio * m };
  });
  const metros = lineas.reduce((a, l) => a + l.m, 0);
  const d = [...DESCUENTOS].reverse().find(x => metros >= x.desde);
  const pct = d ? d.pct : 0;
  lineas.forEach(l => { l.total = Math.round(l.bruto * (1 - pct / 100)); });
  const productos = lineas.reduce((a, l) => a + l.total, 0);
  return { lineas, metros, pct, productos };
}

const versionTxt = adh => adh === 'sin' ? 'sin adhesivo' : 'con adhesivo';
module.exports = { calcularPedido, versionTxt };
