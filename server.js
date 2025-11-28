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
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  }
});

// Rota de Healthcheck (Para acordar o servidor)
app.get('/api/wake-up', (req, res) => {
    res.status(200).json({ message: "Servidor acordado e pronto!" });
});

// Rota de Salvamento de Produtos - CORRIGIDA
app.post('/api/products', upload.single('produtoFoto'), async (req, res) => {
    try {
        console.log('Recebendo requisição para salvar produto...');
        
        if (!req.body.data) {
            return res.status(400).json({ error: "Dados do produto não fornecidos" });
        }

        const dados = JSON.parse(req.body.data);
        const file = req.file;
        let publicUrl = null;

        console.log('Dados recebidos:', dados.nome_produto);

        // 1. Upload da Imagem (se houver) - CORRIGIDO: campo 'produtoFoto'
        if (file) {
            console.log('Processando upload de imagem...');
            const fileName = `foto_${Date.now()}_${file.originalname.replace(/\s/g, '_')}`;
            
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('produtos')
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype
                });

            if (uploadError) {
                console.error('Erro no upload da imagem:', uploadError);
                throw uploadError;
            }

            // Gerar URL pública
            const { data: urlData } = supabase
                .storage
                .from('produtos')
                .getPublicUrl(fileName);
            
            publicUrl = urlData.publicUrl;
            console.log('Imagem salva com URL:', publicUrl);
        }

        // 2. Mapear dados do frontend para a estrutura da tabela - CORRIGIDO
        const dadosParaInserir = {
            nome_produto: dados.nome_produto,
            imagem_url: publicUrl,
            
            // Dados do tecido
            tipo_tecido: dados.tecido_tipo,
            valor_total_tecido: dados.valor_total_tecido, // Adicione este campo no frontend se necessário
            comprimento_total_tecido: dados.comprimento_total_tecido, // Adicione este campo
            largura_tecido: dados.largura_tecido, // Adicione este campo
            metragem_utilizada: dados.metragem_utilizada, // Adicione este campo
            
            // Custos unitários
            custo_tecido: dados.custo_unitario_tecido,
            custo_mao_obra: dados.custo_unitario_mo,
            custo_embalagem: dados.custo_unitario_embalagem,
            custo_transporte: dados.custo_unitario_transporte,
            custo_aviamentos: dados.custo_unitario_aviamentos,
            
            // Lucro e preço
            porcentagem_lucro: dados.porcentagem_lucro,
            valor_lucro: dados.lucro_unitario,
            preco_venda_final: dados.preco_venda_unitario,
            
            // Lote
            quantidade_lote: dados.quantidade_produtos,
            valor_total_lote: dados.preco_venda_unitario * dados.quantidade_produtos,
            
            // Detalhes adicionais
            custo_materiais: dados.custo_unitario_tecido + dados.custo_unitario_aviamentos,
            custo_producao_total: dados.custo_unitario_tecido + dados.custo_unitario_aviamentos + 
                                 dados.custo_unitario_mo + dados.custo_unitario_embalagem + 
                                 dados.custo_unitario_transporte,
            
            // Aviamentos em JSON
            detalhes_aviamentos: dados.aviamentos_data || []
        };

        console.log('Inserindo no banco de dados:', dadosParaInserir.nome_produto);

        // 3. Salvar no Banco de Dados
        const { data, error } = await supabase
            .from('products')
            .insert([dadosParaInserir])
            .select(); // Adiciona .select() para retornar os dados inseridos

        if (error) {
            console.error('Erro ao inserir no Supabase:', error);
            throw error;
        }

        console.log('Produto salvo com sucesso! ID:', data[0]?.id);

        res.status(200).json({ 
            message: "Produto salvo com sucesso!", 
            id: data[0]?.id,
            data: data[0]
        });

    } catch (error) {
        console.error("Erro completo ao salvar:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Nova rota para listar produtos (para teste)
app.get('/api/products', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota para salvar investimentos
app.post('/api/investments', async (req, res) => {
    try {
        console.log('Recebendo requisição para salvar investimento...');
        
        const {
            data_compra,
            fornecedor,
            forma_pagamento,
            numero_parcelas,
            data_primeira_parcela,
            observacoes,
            itens,
            valor_total
        } = req.body;

        console.log('Dados do investimento recebidos:', {
            data_compra,
            fornecedor,
            forma_pagamento,
            numero_parcelas,
            data_primeira_parcela,
            observacoes,
            quantidade_itens: itens?.length,
            valor_total
        });

        // Validar dados obrigatórios
        if (!data_compra || !forma_pagamento || !itens || itens.length === 0) {
            return res.status(400).json({ 
                error: "Dados obrigatórios faltando: data_compra, forma_pagamento e itens são necessários" 
            });
        }

        // Preparar dados para inserção
        const dadosParaInserir = {
            data_compra,
            fornecedor: fornecedor || null,
            forma_pagamento,
            numero_parcelas: numero_parcelas || 1,
            data_primeira_parcela: data_primeira_parcela || null,
            observacoes: observacoes || null,
            itens, // Armazenar como JSONB
            valor_total: parseFloat(valor_total) || 0
        };

        console.log('Inserindo investimento no banco de dados...');

        // Inserir no Supabase
        const { data, error } = await supabase
            .from('investments')
            .insert([dadosParaInserir])
            .select();

        if (error) {
            console.error('Erro ao inserir investimento no Supabase:', error);
            throw error;
        }

        console.log('Investimento salvo com sucesso! ID:', data[0]?.id);

        res.status(200).json({ 
            message: "Investimento salvo com sucesso!", 
            id: data[0]?.id,
            data: data[0]
        });

    } catch (error) {
        console.error("Erro completo ao salvar investimento:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Rota para listar investimentos
app.get('/api/investments', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('investments')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao buscar investimentos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota para obter um investimento específico
app.get('/api/investments/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('investments')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: "Investimento não encontrado" });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao buscar investimento:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota para atualizar um investimento
app.put('/api/investments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log(`Atualizando investimento ID: ${id}`);

        const { data, error } = await supabase
            .from('investments')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({ error: "Investimento não encontrado" });
        }

        res.status(200).json({ 
            message: "Investimento atualizado com sucesso!", 
            data: data[0]
        });

    } catch (error) {
        console.error("Erro ao atualizar investimento:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Rota para excluir um investimento
app.delete('/api/investments/:id', async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`Excluindo investimento ID: ${id}`);

        const { error } = await supabase
            .from('investments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.status(200).json({ 
            message: "Investimento excluído com sucesso!" 
        });

    } catch (error) {
        console.error("Erro ao excluir investimento:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});

