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
        const [clientesCheck, gastosCheck] = await Promise.all([
            supabase.from('clientes_iptv').select('count', { count: 'exact' }).limit(1),
            supabase.from('gastos_mensais').select('count', { count: 'exact' }).limit(1).catch(() => ({ error: 'Tabela não existe' }))
        ]);

        res.status(200).json({
            status: "conectado",
            tabelas: {
                clientes_iptv: clientesCheck.error ? "erro" : "ok",
                gastos_mensais: gastosCheck.error ? "não existe ou erro" : "ok"
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
// ROTAS DE GASTOS MENSAL - ATUALIZADAS
// =============================================

// Salvar gasto mensal (compra)
app.post('/api/gastos', async (req, res) => {
    try {
        const {
            nome_produto,
            local_compra,
            valor_total,
            data_compra,
            cartao,
            num_parcelas,
            dia_fatura,
            primeira_parcela,
            ultima_parcela,
            valor_parcela,
            observacoes,
            status
        } = req.body;

        // Validação
        if (!nome_produto || !local_compra || !valor_total || !data_compra || !cartao || !num_parcelas) {
            return res.status(400).json({ 
                error: "Dados obrigatórios faltando" 
            });
        }

        // Calcular valor em aberto
        const valorEmAberto = status === 'pago' ? 0 : parseFloat(valor_total) || 0;

        const dadosParaInserir = {
            nome_produto,
            local_compra,
            valor_total: parseFloat(valor_total) || 0,
            data_compra,
            cartao,
            num_parcelas: parseInt(num_parcelas) || 1,
            dia_fatura: parseInt(dia_fatura) || 10,
            primeira_parcela,
            ultima_parcela,
            valor_parcela: parseFloat(valor_parcela) || (parseFloat(valor_total) / parseInt(num_parcelas) || 0),
            observacoes: observacoes || null,
            status: status || 'pendente',
            parcelas_pagas: status === 'pago' ? parseInt(num_parcelas) || 1 : 0,
            parcelas_restantes: status === 'pago' ? 0 : parseInt(num_parcelas) || 1,
            valor_em_aberto: valorEmAberto,
            data_cadastro: new Date().toISOString(),
            data_atualizacao: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('gastos_mensais')
            .insert([dadosParaInserir])
            .select();

        if (error) throw error;

        res.status(200).json({ 
            message: "✅ Compra salva com sucesso!", 
            id: data[0]?.id,
            data: data[0]
        });

    } catch (error) {
        console.error("❌ Erro ao salvar compra:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Listar todos os gastos com filtros
app.get('/api/gastos', async (req, res) => {
    try {
        const { cartao, mes, ano, status } = req.query;
        
        let query = supabase
            .from('gastos_mensais')
            .select('*')
            .order('data_compra', { ascending: false });

        // Aplicar filtros se fornecidos
        if (cartao && cartao !== 'todos') {
            query = query.eq('cartao', cartao);
        }

        if (status && status !== 'todos') {
            query = query.eq('status', status);
        }

        if (mes) {
            // Filtrar por mês da data da compra
            const anoFiltro = ano || new Date().getFullYear();
            const mesFiltro = mes.padStart(2, '0');
            const proximoMes = parseInt(mes) + 1 === 13 ? '01' : (parseInt(mes) + 1).toString().padStart(2, '0');
            const proximoAno = parseInt(mes) + 1 === 13 ? parseInt(anoFiltro) + 1 : anoFiltro;
            
            query = query.gte('data_compra', `${anoFiltro}-${mesFiltro}-01`)
                        .lt('data_compra', `${proximoAno}-${proximoMes}-01`);
        }

        if (ano && !mes) {
            // Filtrar por ano se não houver mês específico
            query = query.gte('data_compra', `${ano}-01-01`)
                        .lt('data_compra', `${parseInt(ano) + 1}-01-01`);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.status(200).json(data || []);
    } catch (error) {
        console.error('❌ Erro ao buscar compras:', error);
        res.status(500).json({ error: error.message });
    }
});

// Buscar gasto por ID
app.get('/api/gastos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('gastos_mensais')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: "Compra não encontrada" });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('❌ Erro ao buscar compra:', error);
        res.status(500).json({ error: error.message });
    }
});

// Atualizar gasto
app.put('/api/gastos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log(`🔄 Atualizando compra ID: ${id}`);

        // Adicionar data de atualização
        updateData.data_atualizacao = new Date().toISOString();

        const { data, error } = await supabase
            .from('gastos_mensais')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({ error: "Compra não encontrada" });
        }

        res.status(200).json({ 
            message: "✅ Compra atualizada com sucesso!", 
            data: data[0]
        });

    } catch (error) {
        console.error("❌ Erro ao atualizar compra:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Marcar gasto como pago
app.put('/api/gastos/:id/pagar', async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`💰 Marcando compra ID: ${id} como paga`);

        // Buscar a compra atual
        const { data: compra, error: fetchError } = await supabase
            .from('gastos_mensais')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        if (!compra) {
            return res.status(404).json({ error: "Compra não encontrada" });
        }

        // Preparar dados de atualização
        const updateData = {
            status: 'pago',
            parcelas_pagas: compra.num_parcelas,
            parcelas_restantes: 0,
            valor_em_aberto: 0,
            data_atualizacao: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('gastos_mensais')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;

        res.status(200).json({ 
            message: "✅ Compra marcada como paga com sucesso!", 
            data: data[0]
        });

    } catch (error) {
        console.error("❌ Erro ao marcar compra como paga:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Marcar parcela como paga
app.put('/api/gastos/:id/pagar-parcela', async (req, res) => {
    try {
        const { id } = req.params;
        const { parcela_num } = req.body;

        console.log(`💰 Marcando parcela ${parcela_num} da compra ID: ${id}`);

        if (!parcela_num) {
            return res.status(400).json({ error: "Número da parcela é obrigatório" });
        }

        // Buscar a compra atual
        const { data: compra, error: fetchError } = await supabase
            .from('gastos_mensais')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        if (!compra) {
            return res.status(404).json({ error: "Compra não encontrada" });
        }

        const numParcelas = compra.num_parcelas || 1;
        const parcelaNum = parseInt(parcela_num);
        
        if (parcelaNum < 1 || parcelaNum > numParcelas) {
            return res.status(400).json({ error: "Número da parcela inválido" });
        }

        // Calcular novo estado
        const parcelasPagas = Math.max(compra.parcelas_pagas || 0, parcelaNum);
        const parcelasRestantes = numParcelas - parcelasPagas;
        const novoStatus = parcelasRestantes === 0 ? 'pago' : 'pendente';
        const valorEmAberto = novoStatus === 'pago' ? 0 : (compra.valor_parcela || (compra.valor_total / numParcelas)) * parcelasRestantes;

        const updateData = {
            parcelas_pagas: parcelasPagas,
            parcelas_restantes: parcelasRestantes,
            status: novoStatus,
            valor_em_aberto: valorEmAberto,
            data_atualizacao: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('gastos_mensais')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;

        res.status(200).json({ 
            message: `✅ Parcela ${parcelaNum} marcada como paga com sucesso!`, 
            data: data[0]
        });

    } catch (error) {
        console.error("❌ Erro ao marcar parcela como paga:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Excluir gasto
app.delete('/api/gastos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`🗑️ Excluindo compra ID: ${id}`);

        const { error } = await supabase
            .from('gastos_mensais')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.status(200).json({ 
            message: "✅ Compra excluída com sucesso!" 
        });

    } catch (error) {
        console.error("❌ Erro ao excluir compra:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Obter resumo por cartão
app.get('/api/gastos/resumo/cartoes', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('gastos_mensais')
            .select('*');

        if (error) throw error;

        const resumo = {};

        // Processar todos os gastos para agrupar por cartão
        data.forEach(gasto => {
            const cartao = gasto.cartao;
            if (!resumo[cartao]) {
                resumo[cartao] = {
                    total: 0,
                    compras: 0,
                    parcelas_pendentes: 0,
                    valor_pendente: 0,
                    valor_pago: 0,
                    valor_aberto: 0
                };
            }

            resumo[cartao].total += parseFloat(gasto.valor_total || 0);
            resumo[cartao].compras += 1;

            if (gasto.status === 'pendente') {
                const valorEmAberto = parseFloat(gasto.valor_em_aberto || 0) || 
                                   (parseFloat(gasto.valor_parcela || 0) * parseFloat(gasto.parcelas_restantes || 0));
                resumo[cartao].valor_pendente += valorEmAberto;
                resumo[cartao].valor_aberto += valorEmAberto;
                resumo[cartao].parcelas_pendentes += parseInt(gasto.parcelas_restantes || 0);
                resumo[cartao].valor_pago += parseFloat(gasto.valor_total || 0) - valorEmAberto;
            } else {
                resumo[cartao].valor_pago += parseFloat(gasto.valor_total || 0);
            }
        });

        res.status(200).json(resumo);
    } catch (error) {
        console.error('❌ Erro ao buscar resumo por cartão:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obter resumo geral
app.get('/api/gastos/resumo/geral', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('gastos_mensais')
            .select('*');

        if (error) throw error;

        const resumo = {
            total_gasto: 0,
            total_aberto: 0,
            total_pago: 0,
            total_compras: 0,
            compras_pendentes: 0,
            compras_pagas: 0,
            por_cartao: {}
        };

        // Processar todos os gastos
        data.forEach(gasto => {
            resumo.total_gasto += parseFloat(gasto.valor_total || 0);
            resumo.total_compras += 1;

            if (gasto.status === 'pendente') {
                resumo.total_aberto += parseFloat(gasto.valor_em_aberto || 0);
                resumo.compras_pendentes += 1;
                resumo.total_pago += parseFloat(gasto.valor_total || 0) - parseFloat(gasto.valor_em_aberto || 0);
            } else {
                resumo.total_pago += parseFloat(gasto.valor_total || 0);
                resumo.compras_pagas += 1;
            }

            // Agrupar por cartão
            const cartao = gasto.cartao;
            if (!resumo.por_cartao[cartao]) {
                resumo.por_cartao[cartao] = {
                    total: 0,
                    aberto: 0,
                    pago: 0
                };
            }
            
            resumo.por_cartao[cartao].total += parseFloat(gasto.valor_total || 0);
            if (gasto.status === 'pendente') {
                resumo.por_cartao[cartao].aberto += parseFloat(gasto.valor_em_aberto || 0);
                resumo.por_cartao[cartao].pago += parseFloat(gasto.valor_total || 0) - parseFloat(gasto.valor_em_aberto || 0);
            } else {
                resumo.por_cartao[cartao].pago += parseFloat(gasto.valor_total || 0);
            }
        });

        res.status(200).json(resumo);
    } catch (error) {
        console.error('❌ Erro ao buscar resumo geral:', error);
        res.status(500).json({ error: error.message });
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
// ROTA PARA CRIAR TABELA DE GASTOS SE NÃO EXISTIR
// =============================================

app.get('/api/criar-tabela-gastos', async (req, res) => {
    try {
        // Verificar se a tabela existe
        const { error: checkError } = await supabase
            .from('gastos_mensais')
            .select('*')
            .limit(1);

        if (checkError && checkError.code === '42P01') {
            // Tabela não existe, criar usando SQL via RPC
            const { error: createError } = await supabase.rpc('exec_sql', {
                sql: `
                    CREATE TABLE IF NOT EXISTS gastos_mensais (
                        id BIGSERIAL PRIMARY KEY,
                        nome_produto TEXT NOT NULL,
                        local_compra TEXT NOT NULL,
                        valor_total DECIMAL(10,2) NOT NULL,
                        data_compra DATE NOT NULL,
                        cartao TEXT NOT NULL,
                        num_parcelas INTEGER NOT NULL DEFAULT 1,
                        dia_fatura INTEGER NOT NULL DEFAULT 10,
                        primeira_parcela DATE,
                        ultima_parcela DATE,
                        valor_parcela DECIMAL(10,2),
                        observacoes TEXT,
                        status TEXT NOT NULL DEFAULT 'pendente',
                        parcelas_pagas INTEGER DEFAULT 0,
                        parcelas_restantes INTEGER,
                        valor_em_aberto DECIMAL(10,2) DEFAULT 0,
                        data_cadastro TIMESTAMPTZ DEFAULT NOW(),
                        data_atualizacao TIMESTAMPTZ DEFAULT NOW()
                    );
                    
                    CREATE INDEX IF NOT EXISTS idx_gastos_cartao ON gastos_mensais(cartao);
                    CREATE INDEX IF NOT EXISTS idx_gastos_status ON gastos_mensais(status);
                    CREATE INDEX IF NOT EXISTS idx_gastos_data_compra ON gastos_mensais(data_compra);
                `
            });

            if (createError) {
                console.error('Erro ao criar tabela:', createError);
                return res.status(500).json({ 
                    error: "Erro ao criar tabela",
                    details: createError.message 
                });
            }

            return res.status(200).json({ 
                message: "✅ Tabela 'gastos_mensais' criada com sucesso!" 
            });
        }

        res.status(200).json({ 
            message: "✅ Tabela 'gastos_mensais' já existe!" 
        });
    } catch (error) {
        console.error('❌ Erro ao verificar/criar tabela:', error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
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
        'clientesrenovacao.html', 'investimentos.html', 'products.html',
        'gastos_mensais.html'
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
    ║   🚀 SERVIDOR INICIADO COM SUCESSO!                      ║
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
    - GET  /api/criar-tabela-gastos  - Criar tabela de gastos
    
    💳 GASTOS MENSAL:
    - POST /api/gastos               - Salvar compra
    - GET  /api/gastos               - Listar compras
    - GET  /api/gastos/:id           - Obter compra específica
    - PUT  /api/gastos/:id           - Atualizar compra
    - PUT  /api/gastos/:id/pagar     - Marcar como pago
    - PUT  /api/gastos/:id/pagar-parcela - Marcar parcela como paga
    - DELETE /api/gastos/:id         - Excluir compra
    - GET  /api/gastos/resumo/cartoes - Resumo por cartão
    - GET  /api/gastos/resumo/geral  - Resumo geral
    
    👥 CLIENTES IPTV:
    - POST /api/clientes             - Salvar cliente
    - GET  /api/clientes             - Listar clientes
    - GET  /api/clientes/:id         - Obter cliente específico
    - PUT  /api/clientes/:id         - Atualizar cliente
    - DELETE /api/clientes/:id       - Excluir cliente
    
    🌐 PÁGINAS HTML:
    - GET  /                         - Página inicial
    - GET  /dashboard.html           - Dashboard
    - GET  /calculator.html          - Calculadora
    - GET  /gastos_mensais.html      - Gastos Mensais
    - GET  /clientes.html            - Registrar cliente
    - GET  /clientesrenovacao.html   - Renovação de clientes
    - GET  /investimentos.html       - Investimentos
    - GET  /products.html            - Produtos
    
    ╔═══════════════════════════════════════════════════════════╗
    ║           ✅ SERVIDOR PRONTO PARA REQUISIÇÕES           ║
    ╚═══════════════════════════════════════════════════════════╝
    `);
});
