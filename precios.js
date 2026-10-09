// ÚNICA fuente de precios: la usan la web (navegador) y las funciones de Vercel (servidor).
// ⚠ VALORES DE EJEMPLO: reemplazá por tus precios reales antes de publicar.
(function (datos) {
  if (typeof module !== 'undefined' && module.exports) module.exports = datos;
  else window.MAGNA_PRECIOS = datos;
})({
  // Precio por metro en pesos, por versión y espesor
  PRECIOS: {
    con: { '0,3': 4200, '0,4': 4800, '0,8': 7900, '0,9': 8600 },
    sin: { '0,3': 3500, '0,4': 4000, '0,8': 6900, '0,9': 7500 }
  },
  ESPESORES: [
    { mm: '0,3', uso: 'Fotos e imanes finos' },
    { mm: '0,4', uso: 'Imanes y souvenirs' },
    { mm: '0,8', uso: 'Carteles y vehículos' },
    { mm: '0,9', uso: 'Vehículos y exterior' }
  ],
  // Descuento según metros totales del pedido
  DESCUENTOS: [ { desde: 10, pct: 10 }, { desde: 25, pct: 20 }, { desde: 50, pct: 30 } ]
});
