# magna: web completa (landing + pedido + Andreani + MercadoPago)

## Archivos
- `index.html`: la web.
- `precios.js`: precios, espesores y descuentos. **Es el único lugar donde se cambian los precios** (lo usan la web y el cobro).
- `img/`: fotos optimizadas.
- `api/crear-pago.js`: crea el pago en MercadoPago (recalcula precios y envío en el servidor).
- `api/webhook-mp.js`: MercadoPago avisa los pagos acá y se manda el pedido a Make (email + Sheets).
- `api/cotizar-envio.js`, `api/_andreani.js`: cotización y sucursales Andreani.
- `vercel.json`, `package.json`: configuración de Vercel.

## 1. Reemplazar la web anterior
En el repo de GitHub conectado a Vercel (el de maxer-web.vercel.app):
1. Borrá los archivos viejos (dejá solo la carpeta `.git` si lo hacés desde la compu).
2. Subí todo el contenido de este zip a la raíz.
3. Commit. Vercel publica solo en 1 o 2 minutos.

Desde la web de GitHub: "Add file" → "Upload files", arrastrás todo, y borrás el `index.html` viejo si quedó otro nombre.

## 2. Variables de entorno en Vercel
Project → Settings → Environment Variables. Después de cargarlas, hacé "Redeploy".

| Variable | Qué es |
|---|---|
| `MP_ACCESS_TOKEN` | Access Token de producción de MercadoPago. **Generá uno nuevo**: el anterior estuvo visible en el código de la web vieja. |
| `MAKE_WEBHOOK_URL` | La URL del webhook de Make que ya usabas. |
| `MP_WEBHOOK_SECRET` | (Opcional, recomendado) clave secreta de notificaciones de MP. |
| `ANDREANI_USUARIO`, `ANDREANI_CLAVE`, `ANDREANI_CLIENTE`, `ANDREANI_CONTRATO_DOMICILIO` | Datos de la API de Andreani. |
| `ANDREANI_CONTRATO_SUCURSAL` | (Opcional) contrato de envío a sucursal. |
| `ANDREANI_ENTORNO` | `prod` para tarifas reales. |

## 3. MercadoPago
- Token nuevo: MercadoPago Developers → Tus integraciones → tu app → Credenciales de producción → renovar Access Token.
- Webhook (opcional pero recomendado, para validar firma): en la misma app → Webhooks → URL `https://maxer-web.vercel.app/api/webhook-mp`, evento "Pagos". Copiá la clave secreta a `MP_WEBHOOK_SECRET`. Igual, cada pago ya trae esa URL configurada.

## 4. Make
Los datos ahora llegan desde el servidor (ya no se pierden si el cliente no vuelve a la web). Los campos cambiaron, así que en el escenario de Make hay que **volver a mapear** el email y la fila de Sheets. Llegan: `ref`, `estado`, `fecha`, `nombre`, `telefono`, `email`, `empresa`, `productos`, `metros`, `descuento_pct`, `subtotal_productos`, `envio`, `total`, `entrega`, `nota`, `monto_pagado`, `medio_pago`, `id_pago_mp`.
Truco: en Make, "Redetermine data structure" en el webhook y hacé un pago de prueba.
MercadoPago puede avisar el mismo pago más de una vez: si ves filas repetidas, filtrá por `id_pago_mp` en Sheets.

## 5. Antes de abrir al público
- `precios.js`: precios reales y cortes de descuento.
- `index.html` → `CONFIG`: número de WhatsApp.
- `api/_andreani.js` → `KG_POR_METRO`: peso real por metro de cada espesor.
- Hacé una compra real chica y verificá: pago en MP, email, fila en Sheets.
