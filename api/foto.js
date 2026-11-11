export default async function handler(req, res) {
  const prompt = String(req.query.prompt || '').slice(0, 900);
  if (!prompt) return res.status(400).send('sem prompt');

  try {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt, steps: 6 })
      }
    );
    const data = await r.json();
    const b64 = data?.result?.image;
    if (!r.ok || !b64) return res.status(502).send('falha: ' + JSON.stringify(data?.errors || data).slice(0, 300));

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(b64, 'base64'));
  } catch (e) {
    res.status(502).send('falha');
  }
}
