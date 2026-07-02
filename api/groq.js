// api/groq.js — Vercel Serverless Function
// A chave da Groq mora SÓ aqui, como variável de ambiente (GROQ_API_KEY),
// e nunca vai para o navegador do usuário.

export default async function handler(req, res) {
    // CORS: libera chamadas vindas do seu GitHub Pages
    res.setHeader('Access-Control-Allow-Origin', 'https://joaubaron.github.io');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await groqResponse.json();
        return res.status(groqResponse.status).json(data);
    } catch (error) {
        console.error('Erro no proxy Groq:', error);
        return res.status(500).json({ erro: 'Falha ao chamar a API da Groq' });
    }
}
