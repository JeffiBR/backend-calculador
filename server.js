const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://pcbtgvdcihowmtmqzhns.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjYnRndmRjaWhvd210bXF6aG5zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzIyODk1OSwiZXhwIjoyMDc4ODA0OTU5fQ.2F5YFviXUv5LeQmNKvPgiVAHmeioJ_3ro9K8enZxVsM';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Configuração do Multer
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// =============================================
// ROTAS DO SISTEMA
// =============================================

// Rota de Healthcheck
app.get('/api/wake-up', (req, res) => {
    res.status(200).json({ 
        message: "✅ Servidor acordado e pronto!",
        timestamp: new Date().toISOString(),
        status: "online",
        supabase: "conectado"
    });
});

// Verificar status do Supabase
app.get('/api/supabase-status', async (req, res) => {
    try {
        // Testar várias tabelas
        const [clientesCheck, renovacoesCheck] = await Promise.all([
            supabase.from('clientes_iptv').select('count', { count: 'exact' }).limit(1),
            supabase.from('renovacoes_iptv').select('count', { count: 'exact' }).limit(1).catch(() => ({ error: 'Tabela não existe' }))
        ]);

        res.status(200).json({
            status: "conectado",
            tabelas: {
                clientes_iptv: clientesCheck.error ? "erro" : "ok",
                renovacoes_iptv: renovacoesCheck.error ? "não existe ou erro" : "ok"
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: "erro",
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// =============================================
// ROTAS DE CLIENTES IPTV
// =============================================

// Salvar cliente
app.post('/api/clientes', async (req, res) => {
    try {
        const {
            nome,
            telefone,
            valor_plano,
            tipo,
            tipo_plano,
            data_vencimento,
            revendedor,
            servidor,
            observacoes
        } = req.body;

        // Validação
        if (!nome || !telefone || !valor_plano || !tipo || !tipo_plano || !data_vencimento || !servidor) {
            return res.status(400).json({ 
                error: "Dados obrigatórios faltando" 
            });
        }

        const dadosParaInserir = {
            nome,
            telefone,
            valor_plano: parseFloat(valor_plano) || 0,
            tipo,
            tipo_plano,
            data_vencimento,
            revendedor: revendedor || null,
            servidor,
            observacoes: observacoes || null,
            data_cadastro: new Date().toISOString(),
            status: 'ativo'
        };

        const { data, error } = await supabase
            .from('clientes_iptv')
            .insert([dadosParaInserir])
            .select();

        if (error) throw error;

        res.status(200).json({ 
            message: "✅ Cliente salvo com sucesso!", 
            id: data[0]?.id,
            data: data[0]
        });

    } catch (error) {
        console.error("❌ Erro ao salvar cliente:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Listar todos os clientes
app.get('/api/clientes', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('clientes_iptv')
            .select('*')
            .order('data_cadastro', { ascending: false });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error('❌ Erro ao buscar clientes:', error);
        res.status(500).json({ error: error.message });
    }
});

// Buscar cliente por ID
app.get('/api/clientes/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('clientes_iptv')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: "Cliente não encontrado" });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('❌ Erro ao buscar cliente:', error);
        res.status(500).json({ error: error.message });
    }
});

// Atualizar cliente
app.put('/api/clientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log(`🔄 Atualizando cliente ID: ${id}`, updateData);

        const { data, error } = await supabase
            .from('clientes_iptv')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({ error: "Cliente não encontrado" });
        }

        res.status(200).json({ 
            message: "✅ Cliente atualizado com sucesso!", 
            data: data[0]
        });

    } catch (error) {
        console.error("❌ Erro ao atualizar cliente:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Atualizar parcialmente cliente (PATCH)
app.patch('/api/clientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log(`🔄 Atualizando parcialmente cliente ID: ${id}`, updateData);

        const { data, error } = await supabase
            .from('clientes_iptv')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({ error: "Cliente não encontrado" });
        }

        res.status(200).json({ 
            message: "✅ Cliente atualizado com sucesso!", 
            data: data[0]
        });

    } catch (error) {
        console.error("❌ Erro ao atualizar cliente:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Excluir cliente
app.delete('/api/clientes/:id', async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`🗑️ Excluindo cliente ID: ${id}`);

        const { error } = await supabase
            .from('clientes_iptv')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.status(200).json({ 
            message: "✅ Cliente excluído com sucesso!" 
        });

    } catch (error) {
        console.error("❌ Erro ao excluir cliente:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// =============================================
// ROTAS DE RENOVAÇÕES
// =============================================

// Registrar renovação
app.post('/api/renovacoes', async (req, res) => {
    try {
        console.log('📝 Recebendo requisição para registrar renovação...');
        
        const {
            cliente_id,
            cliente_nome,
            cliente_telefone,
            tipo_cliente,
            plano_anterior,
            plano_novo,
            valor_renovacao,
            data_vencimento_anterior,
            data_vencimento_novo,
            revendedor,
            servidor
        } = req.body;

        console.log('Dados da renovação:', {
            cliente_id,
            cliente_nome,
            plano_novo,
            valor_renovacao
        });

        // Validação
        if (!cliente_id || !cliente_nome || !plano_novo || !valor_renovacao) {
            return res.status(400).json({ 
                error: "Dados obrigatórios faltando" 
            });
        }

        // Verificar se a tabela existe
        try {
            const { error: tableCheckError } = await supabase
                .from('renovacoes_iptv')
                .select('*')
                .limit(1);

            if (tableCheckError && tableCheckError.code === '42P01') {
                console.log('⚠️ Tabela renovacoes_iptv não existe, criando...');
                
                // Tentar criar a tabela via SQL
                const { error: createError } = await supabase.rpc('exec_sql', {
                    sql: `
                        CREATE TABLE IF NOT EXISTS renovacoes_iptv (
                            id BIGSERIAL PRIMARY KEY,
                            cliente_id BIGINT NOT NULL,
                            cliente_nome TEXT NOT NULL,
                            cliente_telefone TEXT,
                            tipo_cliente TEXT,
                            plano_anterior TEXT,
                            plano_novo TEXT NOT NULL,
                            valor_renovacao DECIMAL(10,2) NOT NULL,
                            data_renovacao TIMESTAMPTZ DEFAULT NOW(),
                            data_vencimento_anterior DATE,
                            data_vencimento_novo DATE,
                            revendedor TEXT,
                            servidor TEXT,
                            created_at TIMESTAMPTZ DEFAULT NOW()
                        );
                    `
                });

                if (createError) {
                    console.error('❌ Erro ao criar tabela:', createError);
                }
            }
        } catch (tableError) {
            console.warn('⚠️ Não foi possível verificar/criar tabela:', tableError.message);
        }

        const dadosParaInserir = {
            cliente_id,
            cliente_nome,
            cliente_telefone: cliente_telefone || null,
            tipo_cliente: tipo_cliente || null,
            plano_anterior: plano_anterior || null,
            plano_novo,
            valor_renovacao: parseFloat(valor_renovacao) || 0,
            data_vencimento_anterior: data_vencimento_anterior || null,
            data_vencimento_novo: data_vencimento_novo || null,
            revendedor: revendedor || null,
            servidor: servidor || null,
            data_renovacao: new Date().toISOString()
        };

        console.log('📤 Inserindo renovação...');

        // Tentar inserir na tabela
        const { data, error } = await supabase
            .from('renovacoes_iptv')
            .insert([dadosParaInserir])
            .select();

        if (error) {
            console.error('❌ Erro ao registrar renovação:', error);
            
            // Se a tabela não existe, retornar sucesso sem registrar
            if (error.code === '42P01') {
                console.log('⚠️ Tabela não existe, mas continuando processo...');
                return res.status(200).json({ 
                    message: "✅ Renovação realizada (histórico não registrado - tabela não existe)", 
                    warning: "Tabela de histórico não encontrada"
                });
            }
            
            throw error;
        }

        console.log('✅ Renovação registrada! ID:', data[0]?.id);

        res.status(200).json({ 
            message: "✅ Renovação registrada com sucesso!", 
            id: data[0]?.id,
            data: data[0]
        });

    } catch (error) {
        console.error("❌ Erro completo ao registrar renovação:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message,
            code: error.code
        });
    }
});

// Listar todas as renovações
app.get('/api/renovacoes', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('renovacoes_iptv')
            .select('*')
            .order('data_renovacao', { ascending: false });

        if (error) {
            // Se a tabela não existe, retornar array vazio
            if (error.code === '42P01') {
                return res.status(200).json([]);
            }
            throw error;
        }

        res.status(200).json(data || []);
    } catch (error) {
        console.error('❌ Erro ao buscar renovações:', error);
        res.status(500).json({ error: error.message });
    }
});

// Buscar renovações por cliente
app.get('/api/renovacoes/cliente/:cliente_id', async (req, res) => {
    try {
        const { cliente_id } = req.params;

        const { data, error } = await supabase
            .from('renovacoes_iptv')
            .select('*')
            .eq('cliente_id', cliente_id)
            .order('data_renovacao', { ascending: false });

        if (error) {
            if (error.code === '42P01') {
                return res.status(200).json([]);
            }
            throw error;
        }

        res.status(200).json(data || []);
    } catch (error) {
        console.error('❌ Erro ao buscar renovações do cliente:', error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// ROTAS DE PRODUTOS
// =============================================

app.post('/api/products', upload.single('produtoFoto'), async (req, res) => {
    try {
        if (!req.body.data) {
            return res.status(400).json({ error: "Dados do produto não fornecidos" });
        }

        const dados = JSON.parse(req.body.data);
        const file = req.file;
        let publicUrl = null;

        if (file) {
            const fileName = `foto_${Date.now()}_${file.originalname.replace(/\s/g, '_')}`;
            
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('produtos')
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype
                });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase
                .storage
                .from('produtos')
                .getPublicUrl(fileName);
            
            publicUrl = urlData.publicUrl;
        }

        const dadosParaInserir = {
            nome_produto: dados.nome_produto,
            imagem_url: publicUrl,
            tipo_tecido: dados.tecido_tipo,
            valor_total_tecido: dados.valor_total_tecido,
            comprimento_total_tecido: dados.comprimento_total_tecido,
            largura_tecido: dados.largura_tecido,
            metragem_utilizada: dados.metragem_utilizada,
            custo_tecido: dados.custo_unitario_tecido,
            custo_mao_obra: dados.custo_unitario_mo,
            custo_embalagem: dados.custo_unitario_embalagem,
            custo_transporte: dados.custo_unitario_transporte,
            custo_aviamentos: dados.custo_unitario_aviamentos,
            porcentagem_lucro: dados.porcentagem_lucro,
            valor_lucro: dados.lucro_unitario,
            preco_venda_final: dados.preco_venda_unitario,
            quantidade_lote: dados.quantidade_produtos,
            valor_total_lote: dados.preco_venda_unitario * dados.quantidade_produtos,
            custo_materiais: dados.custo_unitario_tecido + dados.custo_unitario_aviamentos,
            custo_producao_total: dados.custo_unitario_tecido + dados.custo_unitario_aviamentos + 
                                 dados.custo_unitario_mo + dados.custo_unitario_embalagem + 
                                 dados.custo_unitario_transporte,
            detalhes_aviamentos: dados.aviamentos_data || []
        };

        const { data, error } = await supabase
            .from('products')
            .insert([dadosParaInserir])
            .select();

        if (error) throw error;

        res.status(200).json({ 
            message: "✅ Produto salvo com sucesso!", 
            id: data[0]?.id,
            data: data[0]
        });

    } catch (error) {
        console.error("❌ Erro ao salvar produto:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error('❌ Erro ao buscar produtos:', error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// ROTAS DE INVESTIMENTOS
// =============================================

app.post('/api/investments', async (req, res) => {
    try {
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

        if (!data_compra || !forma_pagamento || !itens || itens.length === 0) {
            return res.status(400).json({ 
                error: "Dados obrigatórios faltando" 
            });
        }

        const dadosParaInserir = {
            data_compra,
            fornecedor: fornecedor || null,
            forma_pagamento,
            numero_parcelas: numero_parcelas || 1,
            data_primeira_parcela: data_primeira_parcela || null,
            observacoes: observacoes || null,
            itens,
            valor_total: parseFloat(valor_total) || 0
        };

        const { data, error } = await supabase
            .from('investments')
            .insert([dadosParaInserir])
            .select();

        if (error) throw error;

        res.status(200).json({ 
            message: "✅ Investimento salvo com sucesso!", 
            id: data[0]?.id,
            data: data[0]
        });

    } catch (error) {
        console.error("❌ Erro ao salvar investimento:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

app.get('/api/investments', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('investments')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error('❌ Erro ao buscar investimentos:', error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// ROTA DE BACKUP
// =============================================

app.get('/api/backup/clientes', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('clientes_iptv')
            .select('*');

        if (error) throw error;

        // Formatar para download
        const backupData = {
            timestamp: new Date().toISOString(),
            total_clientes: data.length,
            clientes: data
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="backup_clientes_${Date.now()}.json"`);
        
        res.status(200).json(backupData);
    } catch (error) {
        console.error('❌ Erro ao gerar backup:', error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// ROTA PARA VERIFICAR ESTRUTURA DA TABELA
// =============================================

app.get('/api/tabela-estrutura/:nome', async (req, res) => {
    try {
        const { nome } = req.params;
        
        // Esta query requer permissões especiais no Supabase
        // Alternativa: usar uma função SQL pré-configurada
        const { data, error } = await supabase.rpc('get_table_structure', {
            table_name: nome
        }).catch(async () => {
            // Se a função não existir, tentar consulta direta
            const { data: altData, error: altError } = await supabase
                .from(nome)
                .select('*')
                .limit(1);
            
            if (altError) throw altError;
            
            // Extrair estrutura do primeiro registro
            if (altData && altData.length > 0) {
                return { 
                    data: Object.keys(altData[0]).map(key => ({
                        column_name: key,
                        data_type: typeof altData[0][key]
                    }))
                };
            }
            
            return { data: [] };
        });

        if (error) throw error;

        res.status(200).json({
            tabela: nome,
            estrutura: data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao buscar estrutura:', error);
        res.status(500).json({ 
            error: "Erro ao buscar estrutura da tabela",
            details: error.message 
        });
    }
});

// =============================================
// ROTA DE FALLBACK PARA PÁGINAS HTML
// =============================================

// Serve páginas HTML
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/:page', (req, res) => {
    const page = req.params.page;
    const validPages = [
        'index.html', 'dashboard.html', 'calculator.html', 'clientes.html',
        'clientesrenovacao.html', 'investimentos.html', 'products.html'
    ];
    
    if (validPages.includes(page)) {
        res.sendFile(__dirname + '/' + page);
    } else {
        // Tentar com .html se não encontrou
        const pageWithHtml = page + '.html';
        if (validPages.includes(pageWithHtml)) {
            res.sendFile(__dirname + '/' + pageWithHtml);
        } else {
            res.status(404).json({ error: "Página não encontrada" });
        }
    }
});

// =============================================
// INICIALIZAÇÃO DO SERVIDOR
// =============================================

app.listen(port, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║   🚀 SERVIDOR IPTV MANAGER INICIADO COM SUCESSO!         ║
    ║                                                           ║
    ║   📍 URL: http://localhost:${port}                       ║
    ║   📅 Data: ${new Date().toLocaleString('pt-BR')}         ║
    ║   🔗 Supabase: ${supabaseUrl}                            ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝
    
    📋 ROTAS DISPONÍVEIS:
    
    🔧 SISTEMA:
    - GET  /api/wake-up              - Healthcheck do servidor
    - GET  /api/supabase-status      - Status da conexão Supabase
    - GET  /api/backup/clientes      - Backup dos clientes
    
    👥 CLIENTES IPTV:
    - POST /api/clientes             - Salvar cliente
    - GET  /api/clientes             - Listar clientes
    - GET  /api/clientes/:id         - Obter cliente específico
    - PUT  /api/clientes/:id         - Atualizar cliente
    - PATCH /api/clientes/:id        - Atualizar parcialmente
    - DELETE /api/clientes/:id       - Excluir cliente
    
    🔄 RENOVAÇÕES:
    - POST /api/renovacoes           - Registrar renovação
    - GET  /api/renovacoes           - Listar renovações
    - GET  /api/renovacoes/cliente/:id - Renovações por cliente
    
    📦 PRODUTOS:
    - POST /api/products             - Salvar produto
    - GET  /api/products             - Listar produtos
    
    💰 INVESTIMENTOS:
    - POST /api/investments          - Salvar investimento
    - GET  /api/investments          - Listar investimentos
    
    📊 DIAGNÓSTICO:
    - GET  /api/tabela-estrutura/:nome - Ver estrutura da tabela
    
    🌐 PÁGINAS HTML:
    - GET  /                         - Página inicial
    - GET  /dashboard.html           - Dashboard
    - GET  /calculator.html          - Calculadora
    - GET  /clientes.html            - Registrar cliente
    - GET  /clientesrenovacao.html   - Renovação de clientes
    - GET  /investimentos.html       - Investimentos
    - GET  /products.html            - Produtos
    
    ╔═══════════════════════════════════════════════════════════╗
    ║           ✅ SERVIDOR PRONTO PARA REQUISIÇÕES           ║
    ╚═══════════════════════════════════════════════════════════╝
    `);
});
