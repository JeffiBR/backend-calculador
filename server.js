const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());

// Configuração do Multer (Upload de memória)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Rota de Healthcheck (Para acordar o servidor)
app.get('/api/wake-up', (req, res) => {
    res.status(200).json({ message: "Servidor acordado e pronto!" });
});

// Rota de Salvamento
app.post('/api/products', upload.single('foto'), async (req, res) => {
    try {
        const dados = JSON.parse(req.body.dados);
        const file = req.file;
        let publicUrl = null;

        // 1. Upload da Imagem (se houver)
        if (file) {
            const fileName = `foto_${Date.now()}_${file.originalname.replace(/\s/g, '_')}`;
            
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('produtos')
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype
                });

            if (uploadError) throw uploadError;

            // Gerar URL pública
            const { data: urlData } = supabase
                .storage
                .from('produtos')
                .getPublicUrl(fileName);
            
            publicUrl = urlData.publicUrl;
        }

        // 2. Salvar no Banco de Dados
        const { data, error } = await supabase
            .from('products')
            .insert([
                {
                    ...dados,
                    imagem_url: publicUrl
                }
            ]);

        if (error) throw error;

        res.status(200).json({ message: "Produto salvo com sucesso!", data });

    } catch (error) {
        console.error("Erro ao salvar:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});