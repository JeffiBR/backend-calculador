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
app.use(express.static('.')); // Serve arquivos estáticos da pasta atual

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
    res.status(200).json({ 
        message: "Servidor acordado e pronto!",
        timestamp: new Date().toISOString(),
        status: "online"
    });
});

// Rota para verificar status do Supabase
app.get('/api/supabase-status', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('clientes_iptv')
            .select('count')
            .limit(1);

        if (error) throw error;

        res.status(200).json({
            supabase: "conectado",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            supabase: "erro",
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// =============================================
// ROTAS PARA CLIENTES IPTV
// =============================================

// Rota para salvar clientes IPTV
app.post('/api/clientes', async (req, res) => {
    try {
        console.log('Recebendo requisição para salvar cliente IPTV...');
        
        const {
            nome,
            telefone,
            valor_plano,
            tipo,
            tipo_plano,
            data_vencimento,
            revendedor,
            servidor,
            observacoes,
            data_cadastro
        } = req.body;

        console.log('Dados do cliente recebidos:', {
            nome,
            telefone,
            valor_plano,
            tipo,
            tipo_plano,
            data_vencimento,
            revendedor,
            servidor,
            observacoes
        });

        // Validar dados obrigatórios
        if (!nome || !telefone || !valor_plano || !tipo || !tipo_plano || !data_vencimento || !servidor) {
            return res.status(400).json({ 
                error: "Dados obrigatórios faltando: nome, telefone, valor_plano, tipo, tipo_plano, data_vencimento e servidor são necessários" 
            });
        }

        // Preparar dados para inserção
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
            data_cadastro: data_cadastro || new Date().toISOString(),
            status: 'ativo'
        };

        console.log('Inserindo cliente no banco de dados...');

        // Inserir no Supabase
        const { data, error } = await supabase
            .from('clientes_iptv')
            .insert([dadosParaInserir])
            .select();

        if (error) {
            console.error('Erro ao inserir cliente no Supabase:', error);
            throw error;
        }

        console.log('Cliente salvo com sucesso! ID:', data[0]?.id);

        res.status(200).json({ 
            message: "Cliente salvo com sucesso!", 
            id: data[0]?.id,
            data: data[0]
        });

    } catch (error) {
        console.error("Erro completo ao salvar cliente:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Rota para listar clientes
app.get('/api/clientes', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('clientes_iptv')
            .select('*')
            .order('data_cadastro', { ascending: false });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota para obter um cliente específico
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
        console.error('Erro ao buscar cliente:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota para atualizar um cliente
app.put('/api/clientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log(`Atualizando cliente ID: ${id}`);

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
            message: "Cliente atualizado com sucesso!", 
            data: data[0]
        });

    } catch (error) {
        console.error("Erro ao atualizar cliente:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Rota para excluir um cliente
app.delete('/api/clientes/:id', async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`Excluindo cliente ID: ${id}`);

        const { error } = await supabase
            .from('clientes_iptv')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.status(200).json({ 
            message: "Cliente excluído com sucesso!" 
        });

    } catch (error) {
        console.error("Erro ao excluir cliente:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// =============================================
// ROTA PARA REGISTRAR RENOVAÇÕES
// =============================================

// Rota para registrar uma renovação
app.post('/api/renovacoes', async (req, res) => {
    try {
        console.log('Recebendo requisição para registrar renovação...');
        
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

        console.log('Dados da renovação recebidos:', {
            cliente_id,
            cliente_nome,
            plano_anterior,
            plano_novo,
            valor_renovacao,
            data_vencimento_anterior,
            data_vencimento_novo
        });

        // Validar dados obrigatórios
        if (!cliente_id || !cliente_nome || !plano_novo || !valor_renovacao) {
            return res.status(400).json({ 
                error: "Dados obrigatórios faltando: cliente_id, cliente_nome, plano_novo e valor_renovacao são necessários" 
            });
        }

        // Preparar dados para inserção
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

        console.log('Registrando renovação no banco de dados...');

        // Inserir no Supabase
        const { data, error } = await supabase
            .from('renovacoes_iptv')
            .insert([dadosParaInserir])
            .select();

        if (error) {
            console.error('Erro ao registrar renovação no Supabase:', error);
            throw error;
        }

        console.log('Renovação registrada com sucesso! ID:', data[0]?.id);

        res.status(200).json({ 
            message: "Renovação registrada com sucesso!", 
            id: data[0]?.id,
            data: data[0]
        });

    } catch (error) {
        console.error("Erro completo ao registrar renovação:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Rota para listar todas as renovações
app.get('/api/renovacoes', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('renovacoes_iptv')
            .select('*')
            .order('data_renovacao', { ascending: false });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao buscar renovações:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota para obter renovações de um cliente específico
app.get('/api/renovacoes/cliente/:cliente_id', async (req, res) => {
    try {
        const { cliente_id } = req.params;

        const { data, error } = await supabase
            .from('renovacoes_iptv')
            .select('*')
            .eq('cliente_id', cliente_id)
            .order('data_renovacao', { ascending: false });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao buscar renovações do cliente:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota para obter renovações por período
app.get('/api/renovacoes/periodo', async (req, res) => {
    try {
        const { data_inicio, data_fim } = req.query;

        if (!data_inicio || !data_fim) {
            return res.status(400).json({ 
                error: "Parâmetros data_inicio e data_fim são obrigatórios" 
            });
        }

        const { data, error } = await supabase
            .from('renovacoes_iptv')
            .select('*')
            .gte('data_renovacao', data_inicio)
            .lte('data_renovacao', data_fim)
            .order('data_renovacao', { ascending: false });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao buscar renovações por período:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota para obter estatísticas de renovações
app.get('/api/renovacoes/estatisticas', async (req, res) => {
    try {
        const { periodo } = req.query; // 'hoje', 'semana', 'mes', 'ano'
        
        let dataInicio = new Date();
        let dataFim = new Date();

        switch(periodo) {
            case 'hoje':
                dataInicio.setHours(0, 0, 0, 0);
                dataFim.setHours(23, 59, 59, 999);
                break;
            case 'semana':
                dataInicio.setDate(dataInicio.getDate() - 7);
                break;
            case 'mes':
                dataInicio.setMonth(dataInicio.getMonth() - 1);
                break;
            case 'ano':
                dataInicio.setFullYear(dataInicio.getFullYear() - 1);
                break;
            default:
                // Últimos 30 dias por padrão
                dataInicio.setDate(dataInicio.getDate() - 30);
        }

        // Buscar renovações no período
        const { data: renovacoes, error } = await supabase
            .from('renovacoes_iptv')
            .select('*')
            .gte('data_renovacao', dataInicio.toISOString())
            .lte('data_renovacao', dataFim.toISOString());

        if (error) throw error;

        // Calcular estatísticas
        const totalRenovacoes = renovacoes.length;
        const totalValor = renovacoes.reduce((sum, r) => sum + (r.valor_renovacao || 0), 0);
        const mediaValor = totalRenovacoes > 0 ? totalValor / totalRenovacoes : 0;

        // Agrupar por revendedor
        const porRevendedor = {};
        renovacoes.forEach(r => {
            const rev = r.revendedor || 'Sem Revendedor';
            if (!porRevendedor[rev]) {
                porRevendedor[rev] = { quantidade: 0, valor: 0 };
            }
            porRevendedor[rev].quantidade++;
            porRevendedor[rev].valor += r.valor_renovacao || 0;
        });

        // Agrupar por servidor
        const porServidor = {};
        renovacoes.forEach(r => {
            const serv = r.servidor || 'Sem Servidor';
            if (!porServidor[serv]) {
                porServidor[serv] = { quantidade: 0, valor: 0 };
            }
            porServidor[serv].quantidade++;
            porServidor[serv].valor += r.valor_renovacao || 0;
        });

        res.status(200).json({
            periodo: periodo || '30_dias',
            total_renovacoes: totalRenovacoes,
            total_valor: totalValor,
            media_valor: parseFloat(mediaValor.toFixed(2)),
            por_revendedor: porRevendedor,
            por_servidor: porServidor,
            renovacoes: renovacoes.slice(0, 100) // Retorna as últimas 100 renovações
        });

    } catch (error) {
        console.error('Erro ao buscar estatísticas de renovações:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota para obter relatório financeiro de renovações
app.get('/api/renovacoes/relatorio-financeiro', async (req, res) => {
    try {
        const { ano, mes } = req.query;
        
        let dataInicio, dataFim;
        
        if (ano && mes) {
            // Relatório por mês específico
            dataInicio = new Date(ano, mes - 1, 1);
            dataFim = new Date(ano, mes, 0);
            dataFim.setHours(23, 59, 59, 999);
        } else if (ano) {
            // Relatório por ano
            dataInicio = new Date(ano, 0, 1);
            dataFim = new Date(ano, 11, 31);
            dataFim.setHours(23, 59, 59, 999);
        } else {
            // Últimos 12 meses por padrão
            dataFim = new Date();
            dataInicio = new Date();
            dataInicio.setFullYear(dataInicio.getFullYear() - 1);
        }

        const { data: renovacoes, error } = await supabase
            .from('renovacoes_iptv')
            .select('*')
            .gte('data_renovacao', dataInicio.toISOString())
            .lte('data_renovacao', dataFim.toISOString());

        if (error) throw error;

        // Agrupar por mês
        const porMes = {};
        renovacoes.forEach(r => {
            const data = new Date(r.data_renovacao);
            const mesKey = `${data.getFullYear()}-${(data.getMonth() + 1).toString().padStart(2, '0')}`;
            
            if (!porMes[mesKey]) {
                porMes[mesKey] = {
                    mes: mesKey,
                    quantidade: 0,
                    valor_total: 0,
                    renovacoes: []
                };
            }
            
            porMes[mesKey].quantidade++;
            porMes[mesKey].valor_total += r.valor_renovacao || 0;
            porMes[mesKey].renovacoes.push(r);
        });

        // Converter para array e ordenar
        const relatorioMensal = Object.values(porMes).sort((a, b) => b.mes.localeCompare(a.mes));

        res.status(200).json({
            periodo: {
                inicio: dataInicio.toISOString(),
                fim: dataFim.toISOString()
            },
            total_renovacoes: renovacoes.length,
            total_valor: renovacoes.reduce((sum, r) => sum + (r.valor_renovacao || 0), 0),
            relatorio_mensal: relatorioMensal
        });

    } catch (error) {
        console.error('Erro ao gerar relatório financeiro:', error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// ROTAS PARA PRODUTOS
// =============================================

// Rota para salvar produtos
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

        // 1. Upload da Imagem (se houver)
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

        // 2. Mapear dados do frontend para a estrutura da tabela
        const dadosParaInserir = {
            nome_produto: dados.nome_produto,
            imagem_url: publicUrl,
            
            // Dados do tecido
            tipo_tecido: dados.tecido_tipo,
            valor_total_tecido: dados.valor_total_tecido,
            comprimento_total_tecido: dados.comprimento_total_tecido,
            largura_tecido: dados.largura_tecido,
            metragem_utilizada: dados.metragem_utilizada,
            
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
            .select();

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

// Rota para listar produtos
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

// Rota para obter um produto específico
app.get('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: "Produto não encontrado" });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota para atualizar um produto
app.put('/api/products/:id', upload.single('produtoFoto'), async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!req.body.data) {
            return res.status(400).json({ error: "Dados do produto não fornecidos" });
        }

        const dados = JSON.parse(req.body.data);
        const file = req.file;
        
        let updateData = { ...dados };
        
        // Se há uma nova imagem, fazer upload
        if (file) {
            console.log('Processando upload de nova imagem...');
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
            
            updateData.imagem_url = urlData.publicUrl;
        }

        const { data, error } = await supabase
            .from('products')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({ error: "Produto não encontrado" });
        }

        res.status(200).json({ 
            message: "Produto atualizado com sucesso!", 
            data: data[0]
        });

    } catch (error) {
        console.error("Erro ao atualizar produto:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Rota para excluir um produto
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`Excluindo produto ID: ${id}`);

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.status(200).json({ 
            message: "Produto excluído com sucesso!" 
        });

    } catch (error) {
        console.error("Erro ao excluir produto:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// =============================================
// ROTAS PARA INVESTIMENTOS
// =============================================

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

// =============================================
// ROTAS PARA DASHBOARD E ESTATÍSTICAS
// =============================================

// Rota para obter estatísticas gerais
app.get('/api/dashboard/estatisticas', async (req, res) => {
    try {
        // Buscar totais
        const { data: clientes, error: errorClientes } = await supabase
            .from('clientes_iptv')
            .select('*');

        const { data: renovações, error: errorRenovacoes } = await supabase
            .from('renovacoes_iptv')
            .select('*')
            .gte('data_renovacao', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Últimos 30 dias

        const { data: investimentos, error: errorInvestimentos } = await supabase
            .from('investments')
            .select('*');

        if (errorClientes || errorRenovacoes || errorInvestimentos) {
            throw new Error('Erro ao buscar dados para dashboard');
        }

        // Calcular estatísticas
        const clientesAtivos = clientes.filter(c => {
            const dias = Math.ceil((new Date(c.data_vencimento) - new Date()) / (1000 * 60 * 60 * 24));
            return dias > 0;
        }).length;

        const clientesExpirados = clientes.filter(c => {
            const dias = Math.ceil((new Date(c.data_vencimento) - new Date()) / (1000 * 60 * 60 * 24));
            return dias < 0;
        }).length;

        const receitaMensal = renovações.reduce((sum, r) => sum + (r.valor_renovacao || 0), 0);
        const totalInvestido = investimentos.reduce((sum, i) => sum + (i.valor_total || 0), 0);

        res.status(200).json({
            total_clientes: clientes.length,
            clientes_ativos: clientesAtivos,
            clientes_expirados: clientesExpirados,
            renovacoes_30_dias: renovações.length,
            receita_mensal: receitaMensal,
            total_investido: totalInvestido,
            lucro_estimado: receitaMensal - totalInvestido,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Erro ao buscar estatísticas do dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota para obter gráfico de renovações por dia
app.get('/api/dashboard/grafico-renovacoes', async (req, res) => {
    try {
        const { dias = 30 } = req.query;
        
        const dataInicio = new Date();
        dataInicio.setDate(dataInicio.getDate() - parseInt(dias));

        const { data: renovacoes, error } = await supabase
            .from('renovacoes_iptv')
            .select('*')
            .gte('data_renovacao', dataInicio.toISOString())
            .order('data_renovacao', { ascending: true });

        if (error) throw error;

        // Agrupar por dia
        const porDia = {};
        renovacoes.forEach(r => {
            const data = new Date(r.data_renovacao);
            const diaKey = data.toISOString().split('T')[0];
            
            if (!porDia[diaKey]) {
                porDia[diaKey] = {
                    data: diaKey,
                    quantidade: 0,
                    valor: 0
                };
            }
            
            porDia[diaKey].quantidade++;
            porDia[diaKey].valor += r.valor_renovacao || 0;
        });

        // Converter para array
        const dadosGrafico = Object.values(porDia);

        res.status(200).json({
            periodo_dias: parseInt(dias),
            dados: dadosGrafico
        });

    } catch (error) {
        console.error('Erro ao buscar dados para gráfico:', error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// ROTAS PARA BACKUP E RESTAURAÇÃO
// =============================================

// Rota para exportar dados como backup
app.get('/api/backup/exportar', async (req, res) => {
    try {
        const { tabelas } = req.query;
        const tabelasArray = tabelas ? tabelas.split(',') : ['clientes_iptv', 'renovacoes_iptv', 'investments', 'products'];
        
        const backupData = {};
        
        for (const tabela of tabelasArray) {
            const { data, error } = await supabase
                .from(tabela)
                .select('*');
            
            if (error) {
                console.error(`Erro ao exportar tabela ${tabela}:`, error);
                continue;
            }
            
            backupData[tabela] = data;
        }
        
        // Formatar data para o nome do arquivo
        const dataAtual = new Date();
        const nomeArquivo = `backup_${dataAtual.getFullYear()}-${(dataAtual.getMonth() + 1).toString().padStart(2, '0')}-${dataAtual.getDate().toString().padStart(2, '0')}.json`;
        
        res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
        res.setHeader('Content-Type', 'application/json');
        
        res.status(200).json({
            timestamp: new Date().toISOString(),
            tabelas: tabelasArray,
            dados: backupData
        });
        
    } catch (error) {
        console.error('Erro ao exportar backup:', error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// ROTA DE FALLBACK PARA ARQUIVOS HTML
// =============================================

// Serve o arquivo HTML principal
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Serve outras páginas HTML
app.get('/:page', (req, res) => {
    const page = req.params.page;
    const validPages = [
        'index.html', 'dashboard.html', 'calculator.html', 'clientes.html',
        'clientesrenovacao.html', 'investimentos.html', 'products.html'
    ];
    
    if (validPages.includes(page)) {
        res.sendFile(__dirname + '/' + page);
    } else {
        res.status(404).send('Página não encontrada');
    }
});

// =============================================
// INICIALIZAÇÃO DO SERVIDOR
// =============================================

app.listen(port, () => {
    console.log(`╔═══════════════════════════════════════════════════════════╗`);
    console.log(`║                                                           ║`);
    console.log(`║   🚀 Servidor IPTV Manager iniciado com sucesso!         ║`);
    console.log(`║                                                           ║`);
    console.log(`║   📍 URL: http://localhost:${port}                       ║`);
    console.log(`║   ⏰ Data: ${new Date().toLocaleString('pt-BR')}          ║`);
    console.log(`║                                                           ║`);
    console.log(`╚═══════════════════════════════════════════════════════════╝`);
    console.log('');
    console.log('📋 Rotas disponíveis:');
    console.log('');
    console.log('🔧 Sistema:');
    console.log('   GET  /api/wake-up              - Healthcheck do servidor');
    console.log('   GET  /api/supabase-status      - Status da conexão Supabase');
    console.log('');
    console.log('👥 Clientes IPTV:');
    console.log('   POST /api/clientes             - Salvar cliente');
    console.log('   GET  /api/clientes             - Listar clientes');
    console.log('   GET  /api/clientes/:id         - Obter cliente específico');
    console.log('   PUT  /api/clientes/:id         - Atualizar cliente');
    console.log('   DELETE /api/clientes/:id       - Excluir cliente');
    console.log('');
    console.log('🔄 Renovações:');
    console.log('   POST /api/renovacoes           - Registrar renovação');
    console.log('   GET  /api/renovacoes           - Listar renovações');
    console.log('   GET  /api/renovacoes/cliente/:id - Renovações por cliente');
    console.log('   GET  /api/renovacoes/periodo   - Renovações por período');
    console.log('   GET  /api/renovacoes/estatisticas - Estatísticas de renovações');
    console.log('   GET  /api/renovacoes/relatorio-financeiro - Relatório financeiro');
    console.log('');
    console.log('📦 Produtos:');
    console.log('   POST /api/products             - Salvar produto (com imagem)');
    console.log('   GET  /api/products             - Listar produtos');
    console.log('   GET  /api/products/:id         - Obter produto específico');
    console.log('   PUT  /api/products/:id         - Atualizar produto');
    console.log('   DELETE /api/products/:id       - Excluir produto');
    console.log('');
    console.log('💰 Investimentos:');
    console.log('   POST /api/investments          - Salvar investimento');
    console.log('   GET  /api/investments          - Listar investimentos');
    console.log('   GET  /api/investments/:id      - Obter investimento específico');
    console.log('   PUT  /api/investments/:id      - Atualizar investimento');
    console.log('   DELETE /api/investments/:id    - Excluir investimento');
    console.log('');
    console.log('📊 Dashboard:');
    console.log('   GET  /api/dashboard/estatisticas - Estatísticas gerais');
    console.log('   GET  /api/dashboard/grafico-renovacoes - Dados para gráfico');
    console.log('');
    console.log('💾 Backup:');
    console.log('   GET  /api/backup/exportar      - Exportar backup dos dados');
    console.log('');
    console.log('🌐 Páginas HTML:');
    console.log('   GET  /                         - Página inicial');
    console.log('   GET  /dashboard.html           - Dashboard');
    console.log('   GET  /calculator.html          - Calculadora');
    console.log('   GET  /clientes.html            - Registrar cliente');
    console.log('   GET  /clientesrenovacao.html   - Renovação de clientes');
    console.log('   GET  /investimentos.html       - Investimentos');
    console.log('   GET  /products.html            - Produtos');
    console.log('');
    console.log(`╔═══════════════════════════════════════════════════════════╗`);
    console.log(`║           ✅ Servidor pronto para receber requisições    ║`);
    console.log(`╚═══════════════════════════════════════════════════════════╝`);
});
