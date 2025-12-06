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

// Configuração do Multer para uploads genéricos
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Configuração do Multer para upload de produtos (imagens)
const storageProdutos = multer.memoryStorage();
const uploadProduto = multer({ 
  storage: storageProdutos,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'), false);
    }
  }
});

// =============================================
// FUNÇÕES AUXILIARES
// =============================================

// Função para garantir que a tabela gastos existe
async function garantirTabelaGastos() {
    try {
        // Verificar se a tabela existe
        const { error: checkError } = await supabase
            .from('gastos_mensais')
            .select('id')
            .limit(1);

        if (checkError && checkError.code === '42P01') {
            // Tabela não existe, criar
            console.log('Criando tabela gastos_mensais...');
            
            // Usar SQL raw para criar a tabela
            const { error: createError } = await supabase.rpc('exec_sql', {
                sql: `
                    CREATE TABLE gastos_mensais (
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
                        valor_pago DECIMAL(10,2) DEFAULT 0,
                        ultima_fatura_paga DATE,
                        data_cadastro TIMESTAMPTZ DEFAULT NOW(),
                        data_atualizacao TIMESTAMPTZ DEFAULT NOW()
                    );
                    
                    CREATE INDEX idx_gastos_cartao ON gastos_mensais(cartao);
                    CREATE INDEX idx_gastos_status ON gastos_mensais(status);
                    CREATE INDEX idx_gastos_data_compra ON gastos_mensais(data_compra);
                `
            });

            if (createError) {
                console.error('Erro ao criar tabela:', createError);
                return false;
            }
            
            console.log('Tabela gastos_mensais criada com sucesso!');
        }
        
        return true;
    } catch (error) {
        console.error('Erro ao verificar/criar tabela:', error);
        return false;
    }
}

// Função para garantir que a tabela produtos existe (conforme imagem)
async function garantirTabelaProdutos() {
    try {
        // Verificar se a tabela existe
        const { error: checkError } = await supabase
            .from('productu')
            .select('id')
            .limit(1);

        if (checkError && checkError.code === '42P01') {
            // Tabela não existe, criar conforme imagem
            console.log('Criando tabela productu (conforme imagem)...');
            
            const { error: createError } = await supabase.rpc('exec_sql', {
                sql: `
                    CREATE TABLE productu (
                        id BIGSERIAL PRIMARY KEY,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        nome_produto TEXT NOT NULL,
                        imagem_url TEXT,
                        tipo_tecido TEXT NOT NULL,
                        valor_total_tecido DECIMAL(10,2) NOT NULL,
                        comprimento_total_tecido DECIMAL(10,2) NOT NULL,
                        largura_tecido DECIMAL(10,2) NOT NULL,
                        metragem_utilizada DECIMAL(10,2) NOT NULL,
                        custo_tecido DECIMAL(10,2) NOT NULL,
                        custo_mao_obra DECIMAL(10,2) NOT NULL,
                        custo_embalagem DECIMAL(10,2) NOT NULL,
                        custo_transporte DECIMAL(10,2) NOT NULL,
                        custo_aviamentos DECIMAL(10,2) NOT NULL DEFAULT 0,
                        custo_materiais DECIMAL(10,2) NOT NULL,
                        custo_produto_total DECIMAL(10,2) NOT NULL,
                        porcentagem_lucro DECIMAL(10,2) NOT NULL,
                        valor_lucro DECIMAL(10,2) NOT NULL,
                        preco_venda_final DECIMAL(10,2) NOT NULL,
                        quantidade_lote INTEGER NOT NULL DEFAULT 1,
                        valor_total_lote DECIMAL(10,2) NOT NULL,
                        detalhes_aviamentos JSONB,
                        sold_at TIMESTAMPTZ
                    );
                    
                    CREATE INDEX idx_productu_nome ON productu(nome_produto);
                    CREATE INDEX idx_productu_data ON productu(created_at);
                `
            });

            if (createError) {
                console.error('Erro ao criar tabela productu:', createError);
                return false;
            }
            
            console.log('Tabela productu criada com sucesso!');
        }
        
        return true;
    } catch (error) {
        console.error('Erro ao verificar/criar tabela productu:', error);
        return false;
    }
}

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
        // Garantir que as tabelas existem
        await garantirTabelaGastos();
        await garantirTabelaProdutos();
        
        const [clientesCheck, gastosCheck, produtosCheck] = await Promise.all([
            supabase.from('clientes_iptv').select('count', { count: 'exact' }).limit(1),
            supabase.from('gastos_mensais').select('count', { count: 'exact' }).limit(1),
            supabase.from('productu').select('count', { count: 'exact' }).limit(1)
        ]);

        res.status(200).json({
            status: "conectado",
            tabelas: {
                clientes_iptv: clientesCheck.error ? "erro" : "ok",
                gastos_mensais: gastosCheck.error ? "erro" : "ok",
                productu: produtosCheck.error ? "erro" : "ok"
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
// ROTAS DE GASTOS MENSAL
// =============================================

// Garantir tabela antes de todas as rotas de gastos
app.use('/api/gastos*', async (req, res, next) => {
    try {
        await garantirTabelaGastos();
        next();
    } catch (error) {
        console.error('Erro ao garantir tabela:', error);
        res.status(500).json({ 
            error: "Erro interno do servidor - tabela não disponível",
            details: error.message 
        });
    }
});

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
            primeira_parcela: primeira_parcela || data_compra,
            ultima_parcela: ultima_parcela || data_compra,
            valor_parcela: parseFloat(valor_parcela) || (parseFloat(valor_total) / parseInt(num_parcelas) || 0),
            observacoes: observacoes || null,
            status: status || 'pendente',
            parcelas_pagas: status === 'pago' ? parseInt(num_parcelas) || 1 : 0,
            parcelas_restantes: status === 'pago' ? 0 : parseInt(num_parcelas) || 1,
            valor_em_aberto: valorEmAberto,
            valor_pago: status === 'pago' ? parseFloat(valor_total) || 0 : 0,
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

// Marcar gasto como pago (todas as parcelas)
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
            valor_pago: compra.valor_total,
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

// Pagar uma parcela específica
app.put('/api/gastos/:id/pagar-parcela', async (req, res) => {
    try {
        const { id } = req.params;
        const { mes_fatura, ano_fatura } = req.body;

        console.log(`💰 Pagando fatura do mês ${mes_fatura}/${ano_fatura} para compra ID: ${id}`);

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

        // Verificar se há faturas em aberto
        if (compra.status === 'pago') {
            return res.status(400).json({ error: "Esta compra já está totalmente paga" });
        }

        const numParcelas = compra.num_parcelas || 1;
        const parcelasPagas = compra.parcelas_pagas || 0;
        const valorParcela = compra.valor_parcela || (compra.valor_total / numParcelas);
        
        // Calcular nova fatura
        const novasParcelasPagas = parcelasPagas + 1;
        const novasParcelasRestantes = Math.max(0, numParcelas - novasParcelasPagas);
        const novoValorEmAberto = valorParcela * novasParcelasRestantes;
        const novoValorPago = valorParcela * novasParcelasPagas;
        const novoStatus = novasParcelasRestantes === 0 ? 'pago' : 'pendente';

        // Calcular data da próxima fatura
        let proximoMes = mes_fatura;
        let proximoAno = ano_fatura;
        
        if (novoStatus === 'pendente') {
            proximoMes = parseInt(mes_fatura) + 1;
            proximoAno = parseInt(ano_fatura);
            
            if (proximoMes > 12) {
                proximoMes = 1;
                proximoAno += 1;
            }
        }

        const updateData = {
            parcelas_pagas: novasParcelasPagas,
            parcelas_restantes: novasParcelasRestantes,
            valor_em_aberto: novoValorEmAberto,
            valor_pago: novoValorPago,
            status: novoStatus,
            ultima_fatura_paga: `${ano_fatura}-${String(mes_fatura).padStart(2, '0')}-01`,
            data_atualizacao: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('gastos_mensais')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;

        res.status(200).json({ 
            message: `✅ Fatura de ${mes_fatura}/${ano_fatura} paga com sucesso!`, 
            data: data[0],
            proxima_fatura: novoStatus === 'pendente' ? {
                mes: proximoMes,
                ano: proximoAno,
                valor: valorParcela
            } : null
        });

    } catch (error) {
        console.error("❌ Erro ao pagar fatura:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Obter faturas pendentes por cartão
app.get('/api/gastos/faturas-pendentes', async (req, res) => {
    try {
        const { cartao } = req.query;
        
        let query = supabase
            .from('gastos_mensais')
            .select('*')
            .eq('status', 'pendente')
            .order('data_compra', { ascending: true });

        if (cartao) {
            query = query.eq('cartao', cartao);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Simplificar o agrupamento
        const faturasPorCartaoMes = {};
        const hoje = new Date();
        const mesAtual = hoje.getMonth() + 1;
        const anoAtual = hoje.getFullYear();

        if (data && data.length > 0) {
            data.forEach(gasto => {
                const cartao = gasto.cartao;
                const parcelasPagas = gasto.parcelas_pagas || 0;
                const numParcelas = gasto.num_parcelas || 1;
                
                if (parcelasPagas >= numParcelas) return;
                
                // Calcular mês da próxima fatura
                const dataCompra = new Date(gasto.data_compra);
                let mesFatura = dataCompra.getMonth() + 1 + parcelasPagas;
                let anoFatura = dataCompra.getFullYear();
                
                // Ajustar se passar de dezembro
                while (mesFatura > 12) {
                    mesFatura -= 12;
                    anoFatura += 1;
                }
                
                const chave = `${cartao}-${anoFatura}-${String(mesFatura).padStart(2, '0')}`;
                
                if (!faturasPorCartaoMes[chave]) {
                    faturasPorCartaoMes[chave] = {
                        cartao: cartao,
                        mes: mesFatura,
                        ano: anoFatura,
                        valor_total: 0,
                        compras: []
                    };
                }
                
                const valorParcela = gasto.valor_parcela || (gasto.valor_total / numParcelas);
                faturasPorCartaoMes[chave].valor_total += valorParcela;
                faturasPorCartaoMes[chave].compras.push({
                    id: gasto.id,
                    nome_produto: gasto.nome_produto,
                    valor_parcela: valorParcela
                });
            });
        }

        // Converter para array
        const faturasArray = Object.values(faturasPorCartaoMes);
        
        // Ordenar por cartão, ano e mês
        faturasArray.sort((a, b) => {
            if (a.cartao !== b.cartao) return a.cartao.localeCompare(b.cartao);
            if (a.ano !== b.ano) return a.ano - b.ano;
            return a.mes - b.mes;
        });

        res.status(200).json(faturasArray);

    } catch (error) {
        console.error('❌ Erro ao buscar faturas pendentes:', error);
        res.status(500).json({ error: error.message });
    }
});

// Pagar fatura completa de um cartão
app.put('/api/gastos/pagar-fatura-cartao', async (req, res) => {
    try {
        const { cartao, mes, ano } = req.body;

        console.log(`💰 Pagando fatura completa do cartão ${cartao} - ${mes}/${ano}`);

        if (!cartao || !mes || !ano) {
            return res.status(400).json({ error: "Cartão, mês e ano são obrigatórios" });
        }

        // Buscar compras pendentes deste cartão
        const { data: compras, error: fetchError } = await supabase
            .from('gastos_mensais')
            .select('*')
            .eq('cartao', cartao)
            .eq('status', 'pendente');

        if (fetchError) throw fetchError;

        if (!compras || compras.length === 0) {
            return res.status(404).json({ error: "Nenhuma compra pendente encontrada para este cartão" });
        }

        let totalPago = 0;
        const comprasAtualizadas = [];

        // Processar cada compra
        for (const compra of compras) {
            const numParcelas = compra.num_parcelas || 1;
            const parcelasPagas = compra.parcelas_pagas || 0;
            
            if (parcelasPagas >= numParcelas) continue;
            
            // Calcular mês da próxima fatura
            const dataCompra = new Date(compra.data_compra);
            let mesProximaFatura = dataCompra.getMonth() + 1 + parcelasPagas;
            let anoProximaFatura = dataCompra.getFullYear();
            
            // Ajustar se passar de dezembro
            while (mesProximaFatura > 12) {
                mesProximaFatura -= 12;
                anoProximaFatura += 1;
            }
            
            // Se a próxima fatura é a que estamos pagando
            if (mesProximaFatura === parseInt(mes) && anoProximaFatura === parseInt(ano)) {
                const valorParcela = compra.valor_parcela || (compra.valor_total / numParcelas);
                
                // Atualizar valores
                const novasParcelasPagas = parcelasPagas + 1;
                const novasParcelasRestantes = numParcelas - novasParcelasPagas;
                const novoValorEmAberto = valorParcela * novasParcelasRestantes;
                const novoValorPago = valorParcela * novasParcelasPagas;
                const novoStatus = novasParcelasRestantes === 0 ? 'pago' : 'pendente';
                
                const updateData = {
                    parcelas_pagas: novasParcelasPagas,
                    parcelas_restantes: novasParcelasRestantes,
                    valor_em_aberto: novoValorEmAberto,
                    valor_pago: novoValorPago,
                    status: novoStatus,
                    ultima_fatura_paga: `${ano}-${String(mes).padStart(2, '0')}-01`,
                    data_atualizacao: new Date().toISOString()
                };
                
                const { data: updatedData, error: updateError } = await supabase
                    .from('gastos_mensais')
                    .update(updateData)
                    .eq('id', compra.id)
                    .select();
                
                if (updateError) {
                    console.error(`Erro ao atualizar compra ${compra.id}:`, updateError);
                    continue;
                }
                
                totalPago += valorParcela;
                comprasAtualizadas.push(compra.id);
            }
        }

        if (comprasAtualizadas.length === 0) {
            return res.status(400).json({ error: `Nenhuma fatura encontrada para ${cartao} em ${mes}/${ano}` });
        }

        res.status(200).json({ 
            message: `✅ Fatura de ${mes}/${ano} do cartão ${cartao} paga com sucesso!`,
            total_pago: totalPago,
            quantidade_compras: comprasAtualizadas.length,
            compras_atualizadas: comprasAtualizadas
        });

    } catch (error) {
        console.error("❌ Erro ao pagar fatura do cartão:", error);
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
        const todosCartoes = [
            "Banco Pan", "Atacadão", "Nubank", "Santander", "Riachuello", 
            "Le Bescuit", "C&A", "Renner", "Mercado Livre", 
            "Cartão Mais", "Mais", "Brasil Card", "Azul Atacarejo"
        ];

        // Inicializar todos os cartões
        todosCartoes.forEach(cartao => {
            resumo[cartao] = {
                total: 0,
                compras: 0,
                parcelas_pendentes: 0,
                valor_pendente: 0,
                valor_pago: 0,
                valor_aberto: 0,
                parcelas_pagas_total: 0,
                parcelas_total: 0
            };
        });

        // Processar os gastos
        if (data && data.length > 0) {
            data.forEach(gasto => {
                const cartao = gasto.cartao;
                if (!resumo[cartao]) {
                    resumo[cartao] = {
                        total: 0,
                        compras: 0,
                        parcelas_pendentes: 0,
                        valor_pendente: 0,
                        valor_pago: 0,
                        valor_aberto: 0,
                        parcelas_pagas_total: 0,
                        parcelas_total: 0
                    };
                }

                const valorTotal = parseFloat(gasto.valor_total || 0);
                const numParcelas = parseInt(gasto.num_parcelas || 1);
                const parcelasPagas = parseInt(gasto.parcelas_pagas || 0);
                const valorEmAberto = parseFloat(gasto.valor_em_aberto || 0);
                const valorPago = parseFloat(gasto.valor_pago || 0);

                resumo[cartao].total += valorTotal;
                resumo[cartao].compras += 1;
                resumo[cartao].parcelas_total += numParcelas;
                resumo[cartao].parcelas_pagas_total += parcelasPagas;

                if (gasto.status === 'pendente') {
                    resumo[cartao].valor_pendente += valorEmAberto;
                    resumo[cartao].valor_aberto += valorEmAberto;
                    resumo[cartao].parcelas_pendentes += (numParcelas - parcelasPagas);
                    resumo[cartao].valor_pago += valorPago;
                } else {
                    resumo[cartao].valor_pago += valorTotal;
                }
            });
        }

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

        if (data && data.length > 0) {
            data.forEach(gasto => {
                const valorTotal = parseFloat(gasto.valor_total || 0);
                const valorEmAberto = parseFloat(gasto.valor_em_aberto || 0);
                const valorPago = parseFloat(gasto.valor_pago || 0);

                resumo.total_gasto += valorTotal;
                resumo.total_compras += 1;

                if (gasto.status === 'pendente') {
                    resumo.total_aberto += valorEmAberto;
                    resumo.compras_pendentes += 1;
                    resumo.total_pago += valorPago;
                } else {
                    resumo.total_pago += valorTotal;
                    resumo.compras_pagas += 1;
                }

                // Agrupar por cartão
                const cartao = gasto.cartao;
                if (!resumo.por_cartao[cartao]) {
                    resumo.por_cartao[cartao] = {
                        total: 0,
                        aberto: 0,
                        pago: 0,
                        compras: 0
                    };
                }
                
                resumo.por_cartao[cartao].total += valorTotal;
                resumo.por_cartao[cartao].compras += 1;
                
                if (gasto.status === 'pendente') {
                    resumo.por_cartao[cartao].aberto += valorEmAberto;
                    resumo.por_cartao[cartao].pago += valorPago;
                } else {
                    resumo.por_cartao[cartao].pago += valorTotal;
                }
            });
        }

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
// ROTAS DE PRODUTOS (CALCULADORA) - CONFORME IMAGEM
// =============================================

// Garantir tabela antes de todas as rotas de produtos
app.use('/api/products*', async (req, res, next) => {
    try {
        await garantirTabelaProdutos();
        next();
    } catch (error) {
        console.error('Erro ao garantir tabela produtos:', error);
        res.status(500).json({ 
            error: "Erro interno do servidor - tabela não disponível",
            details: error.message 
        });
    }
});

// Salvar produto da calculadora (conforme estrutura da imagem)
app.post('/api/products', uploadProduto.single('produtoFoto'), async (req, res) => {
    try {
        console.log('📦 Recebendo dados do produto...');
        
        // Verificar se há dados JSON
        if (!req.body.data) {
            return res.status(400).json({ 
                error: "Dados do produto não fornecidos" 
            });
        }

        // Parse dos dados JSON
        const produtoData = JSON.parse(req.body.data);
        
        // Validação básica
        if (!produtoData.nome_produto) {
            return res.status(400).json({ 
                error: "Nome do produto é obrigatório" 
            });
        }

        // Processar upload da imagem se existir
        let imagemUrl = null;
        if (req.file) {
            console.log('📸 Processando upload da imagem...');
            
            // Gerar nome único para o arquivo
            const fileExt = req.file.originalname.split('.').pop();
            const fileName = `produto_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            
            // Em ambiente de produção, você faria upload para um serviço de storage
            // Por enquanto, vamos salvar apenas o nome do arquivo
            imagemUrl = fileName;
            
            console.log(`✅ Imagem processada: ${fileName}`);
        }

        // Calcular campos que podem ser derivados se não fornecidos
        const custoMateriais = produtoData.custo_materiais || 
            ((produtoData.custo_tecido || 0) + 
             (produtoData.custo_aviamentos || 0) + 
             (produtoData.custo_embalagem || 0) + 
             (produtoData.custo_transporte || 0));
        
        const custoProdutoTotal = produtoData.custo_produto_total || 
            (custoMateriais + (produtoData.custo_mao_obra || 0));
        
        const valorTotalLote = produtoData.valor_total_lote || 
            ((produtoData.preco_venda_final || 0) * (produtoData.quantidade_lote || 1));

        // Preparar dados para inserção (conforme estrutura da imagem)
        const dadosParaInserir = {
            nome_produto: produtoData.nome_produto,
            imagem_url: imagemUrl,
            tipo_tecido: produtoData.tipo_tecido || produtoData.tecido_tipo || '',
            valor_total_tecido: produtoData.valor_total_tecido || 0,
            comprimento_total_tecido: produtoData.comprimento_total_tecido || 0,
            largura_tecido: produtoData.largura_tecido || 0,
            metragem_utilizada: produtoData.metragem_utilizada || 0,
            custo_tecido: produtoData.custo_tecido || produtoData.custo_unitario_tecido || 0,
            custo_mao_obra: produtoData.custo_mao_obra || produtoData.custo_unitario_mo || 0,
            custo_embalagem: produtoData.custo_embalagem || produtoData.custo_unitario_embalagem || 0,
            custo_transporte: produtoData.custo_transporte || produtoData.custo_unitario_transporte || 0,
            custo_aviamentos: produtoData.custo_aviamentos || produtoData.custo_unitario_aviamentos || 0,
            custo_materiais: custoMateriais,
            custo_produto_total: custoProdutoTotal,
            porcentagem_lucro: produtoData.porcentagem_lucro || 0,
            valor_lucro: produtoData.valor_lucro || produtoData.lucro_unitario || 0,
            preco_venda_final: produtoData.preco_venda_final || produtoData.preco_venda_unitario || 0,
            quantidade_lote: produtoData.quantidade_lote || produtoData.quantidade_produtos || 1,
            valor_total_lote: valorTotalLote,
            detalhes_aviamentos: produtoData.detalhes_aviamentos || produtoData.aviamentos_data || []
        };

        console.log('💾 Salvando produto no banco de dados...', dadosParaInserir.nome_produto);

        const { data, error } = await supabase
            .from('productu')
            .insert([dadosParaInserir])
            .select();

        if (error) {
            console.error('❌ Erro ao inserir no Supabase:', error);
            throw error;
        }

        console.log('✅ Produto salvo com sucesso! ID:', data[0]?.id);

        res.status(200).json({ 
            message: "✅ Produto salvo com sucesso!", 
            id: data[0]?.id,
            data: data[0]
        });

    } catch (error) {
        console.error("❌ Erro ao salvar produto:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Listar todos os produtos
app.get('/api/products', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('productu')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.status(200).json(data || []);
    } catch (error) {
        console.error('❌ Erro ao buscar produtos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Buscar produto por ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('productu')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: "Produto não encontrado" });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('❌ Erro ao buscar produto:', error);
        res.status(500).json({ error: error.message });
    }
});

// Atualizar produto
app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log(`🔄 Atualizando produto ID: ${id}`, updateData);

        const { data, error } = await supabase
            .from('productu')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({ error: "Produto não encontrado" });
        }

        res.status(200).json({ 
            message: "✅ Produto atualizado com sucesso!", 
            data: data[0]
        });

    } catch (error) {
        console.error("❌ Erro ao atualizar produto:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Marcar produto como vendido
app.put('/api/products/:id/vender', async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`💰 Marcando produto ID: ${id} como vendido`);

        const updateData = {
            sold_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('productu')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({ error: "Produto não encontrado" });
        }

        res.status(200).json({ 
            message: "✅ Produto marcado como vendido com sucesso!", 
            data: data[0]
        });

    } catch (error) {
        console.error("❌ Erro ao marcar produto como vendido:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Excluir produto
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`🗑️ Excluindo produto ID: ${id}`);

        const { error } = await supabase
            .from('productu')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.status(200).json({ 
            message: "✅ Produto excluído com sucesso!" 
        });

    } catch (error) {
        console.error("❌ Erro ao excluir produto:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Obter estatísticas de produtos
app.get('/api/products/estatisticas', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('productu')
            .select('*');

        if (error) throw error;

        const estatisticas = {
            total_produtos: 0,
            produtos_vendidos: 0,
            produtos_disponiveis: 0,
            valor_total_estoque: 0,
            valor_total_vendido: 0,
            lucro_total: 0
        };

        if (data && data.length > 0) {
            data.forEach(produto => {
                estatisticas.total_produtos++;
                
                if (produto.sold_at) {
                    estatisticas.produtos_vendidos++;
                    estatisticas.valor_total_vendido += parseFloat(produto.valor_total_lote || 0);
                    estatisticas.lucro_total += parseFloat(produto.valor_lucro || 0) * parseFloat(produto.quantidade_lote || 1);
                } else {
                    estatisticas.produtos_disponiveis++;
                    estatisticas.valor_total_estoque += parseFloat(produto.valor_total_lote || 0);
                }
            });
        }

        res.status(200).json(estatisticas);

    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// ROTAS PARA CRIAR TABELAS
// =============================================

// Rota para criar tabela de gastos
app.get('/api/criar-tabela-gastos', async (req, res) => {
    try {
        const tabelaCriada = await garantirTabelaGastos();
        
        if (tabelaCriada) {
            res.status(200).json({ 
                message: "✅ Tabela 'gastos_mensais' verificada/criada com sucesso!" 
            });
        } else {
            res.status(500).json({ 
                error: "Erro ao criar/verificar tabela" 
            });
        }
    } catch (error) {
        console.error('❌ Erro ao verificar/criar tabela:', error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Rota para criar tabela de produtos (conforme imagem)
app.get('/api/criar-tabela-produtos', async (req, res) => {
    try {
        const tabelaCriada = await garantirTabelaProdutos();
        
        if (tabelaCriada) {
            res.status(200).json({ 
                message: "✅ Tabela 'productu' verificada/criada com sucesso!" 
            });
        } else {
            res.status(500).json({ 
                error: "Erro ao criar/verificar tabela" 
            });
        }
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

app.listen(port, async () => {
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
    - GET  /api/criar-tabela-produtos - Criar tabela de produtos
    
    💳 GASTOS MENSAL:
    - POST /api/gastos               - Salvar compra
    - GET  /api/gastos               - Listar compras
    - GET  /api/gastos/:id           - Obter compra específica
    - PUT  /api/gastos/:id           - Atualizar compra
    - PUT  /api/gastos/:id/pagar     - Marcar como pago
    - PUT  /api/gastos/:id/pagar-parcela - Pagar fatura específica
    - PUT  /api/gastos/pagar-fatura-cartao - Pagar fatura completa do cartão
    - GET  /api/gastos/faturas-pendentes - Listar faturas pendentes
    - DELETE /api/gastos/:id         - Excluir compra
    - GET  /api/gastos/resumo/cartoes - Resumo por cartão
    - GET  /api/gastos/resumo/geral  - Resumo geral
    
    👥 CLIENTES IPTV:
    - POST /api/clientes             - Salvar cliente
    - GET  /api/clientes             - Listar clientes
    - GET  /api/clientes/:id         - Obter cliente específico
    - PUT  /api/clientes/:id         - Atualizar cliente
    - DELETE /api/clientes/:id       - Excluir cliente
    
    📦 PRODUTOS (CALCULADORA) - CONFORME IMAGEM:
    - POST /api/products             - Salvar produto
    - GET  /api/products             - Listar produtos
    - GET  /api/products/:id         - Obter produto específico
    - PUT  /api/products/:id         - Atualizar produto
    - PUT  /api/products/:id/vender  - Marcar como vendido
    - DELETE /api/products/:id       - Excluir produto
    - GET  /api/products/estatisticas - Estatísticas de produtos
    
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
    
    // Garantir que as tabelas existem ao iniciar
    try {
        await garantirTabelaGastos();
        console.log('✅ Tabela de gastos verificada/criada com sucesso!');
        
        await garantirTabelaProdutos();
        console.log('✅ Tabela de produtos (productu) verificada/criada com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao verificar/criar tabelas:', error);
    }
});
