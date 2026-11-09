// api/groq.js — Vercel Serverless Function
// A chave do Gemini mora SÓ aqui, como variável de ambiente (GEMINI_API_KEY),
// e nunca vai para o navegador do usuário.

export default async function handler(req, res) {
    // CORS: libera chamadas vindas do seu GitHub Pages
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    try {
        // MUDANÇA 1: URL do Google
        const groqResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
            method: 'POST',
            headers: {
                // MUDANÇA 2: Chave do Google
                'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await groqResponse.json();
        return res.status(groqResponse.status).json(data);
    } catch (error) {
        console.error('Erro no proxy Gemini:', error);
        return res.status(500).json({ erro: 'Falha ao chamar a API do Gemini' });
    }
}
