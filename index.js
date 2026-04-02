const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const app = express();

// ─── TUS CREDENCIALES ───────────────────────────────────────────
const CLIENT_ID = '4bc5539ece2586740fbb8c104aaa36f9';
const CLIENT_SECRET = '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';
const MAKE_WEBHOOK_URL = 'PEGA_AQUI_TU_WEBHOOK_DE_MAKE'; // lo añadiremos después
const SCOPES = 'write_themes,write_content,write_products,read_themes';
// ────────────────────────────────────────────────────────────────

const HOST = process.env.HOST || 'https://TU-APP.railway.app'; // Railway lo pone automáticamente

// PASO 1 — El cliente llega aquí con su URL de tienda
// Ejemplo: https://TU-APP.railway.app/install?shop=su-tienda.myshopify.com
app.get('/install', (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send('Falta el parámetro shop');

  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${HOST}/callback`;
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=${SCOPES}&redirect_uri=${redirectUri}&state=${state}`;

  res.redirect(authUrl);
});

// PASO 2 — Shopify redirige aquí tras que el cliente acepta
app.get('/callback', async (req, res) => {
  const { shop, code, hmac } = req.query;

  // Verificar que la petición viene de Shopify
  const params = Object.assign({}, req.query);
  delete params.hmac;
  const message = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  const digest = crypto.createHmac('sha256', CLIENT_SECRET).update(message).digest('hex');
  if (digest !== hmac) return res.status(400).send('Petición no válida');

  try {
    // Intercambiar el code por el token permanente
    const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code
    });

    const accessToken = tokenResponse.data.access_token;

    // Mandar el token + shop a Make para que configure la tienda
    await axios.post(MAKE_WEBHOOK_URL, {
      shop,
      access_token: accessToken,
      timestamp: new Date().toISOString()
    });

    // Respuesta al cliente
    res.send(`
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family:sans-serif;text-align:center;padding:60px">
          <h1>✅ ¡Perfecto!</h1>
          <p>Hemos recibido tu tienda. En unos minutos estará configurada.</p>
          <p>Te avisaremos por WhatsApp cuando esté lista 🚀</p>
        </body>
      </html>
    `);

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al procesar la instalación. Contacta con soporte.');
  }
});

// Health check para Railway
app.get('/', (req, res) => res.send('Servidor OAuth de Shopify activo ✅'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
