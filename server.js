const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuração do Supabase
// Se estiver rodando local sem .env, as chaves abaixo são usadas como fallback (não recomendado para produção)
const supabaseUrl = process.env.SUPABASE_URL || 'https://pcbtgvdcihowmtmqzhns.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjYnRndmRjaWhvd210bXF6aG5zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzIyODk1OSwiZXhwIjoyMDc4ODA0OTU5fQ.2F5YFviXUv5LeQmNKvPgiVAHmeioJ_3ro9K8enZxVsM';
const supabase = createClient(supabaseUrl, supabaseKey);

// Nome do Bucket para Imagens (AJUSTADO PARA 'produtos')
const BUCKET_NAME = 'produtos';

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
// Mantido o nome da variável 'uploadProduto' para as outras rotas que possam usar
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
        const { error: checkError } = await supabase
            .from('gastos_mensais')
            .select('id')
            .limit(1);

        if (checkError && checkError.code === '42P01') {
            console.log('Criando tabela gastos_mensais...');
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
                console.error('Erro ao criar tabela gastos:', createError);
                return false;
            }
            console.log('Tabela gastos_mensais criada com sucesso!');
        }
        return true;
    } catch (error) {
        console.error('Erro ao verificar/criar tabela gastos:', error);
        return false;
    }
}

// Função para garantir que a tabela products existe e tem as colunas corretas (AJUSTADO)
async function garantirTabelaProducts() {
    try {
        const { error: checkError } = await supabase
            .from('products')
            .select('id')
            .limit(1);

        if (checkError && checkError.code === '42P01') {
            // Caso 1: Tabela não existe, criar do zero com o esquema completo
            console.log('Criando tabela products...');
            const { error: createError } = await supabase.rpc('exec_sql', {
                sql: `
                    CREATE TABLE products (
                        id BIGSERIAL PRIMARY KEY,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        nome_produto TEXT NOT NULL,
                        imagem_url TEXT,
                        tipo_tecido TEXT,
                        valor_total_tecido DECIMAL(10,2) DEFAULT 0,
                        comprimento_total_tecido DECIMAL(10,2) DEFAULT 0,
                        largura_tecido DECIMAL(10,2) DEFAULT 0,
                        metragem_utilizada DECIMAL(10,2) DEFAULT 0,
                        custo_tecido DECIMAL(10,2) DEFAULT 0,
                        custo_mao_obra DECIMAL(10,2) DEFAULT 0,
                        custo_embalagem DECIMAL(10,2) DEFAULT 0,
                        custo_transporte DECIMAL(10,2) DEFAULT 0,
                        custo_aviamentos DECIMAL(10,2) DEFAULT 0,
                        custo_materiais DECIMAL(10,2) DEFAULT 0,
                        custo_producao_total DECIMAL(10,2) DEFAULT 0, -- NOVO NOME DA COLUNA
                        porcentagem_lucro DECIMAL(10,2) DEFAULT 0,
                        valor_lucro DECIMAL(10,2) DEFAULT 0,
                        preco_venda_final DECIMAL(10,2) DEFAULT 0,
                        quantidade_lote INTEGER DEFAULT 1,
                        valor_total_lote DECIMAL(10,2) DEFAULT 0,
                        detalhes_aviamentos JSONB,
                        sold_at TIMESTAMPTZ,
                        
                        -- Colunas unitárias
                        quantidade_produtos INTEGER DEFAULT 1,
                        tecido_tipo TEXT,
                        custo_unitario_tecido DECIMAL(10,2) DEFAULT 0,
                        custo_unitario_aviamentos DECIMAL(10,2) DEFAULT 0,
                        custo_unitario_mo DECIMAL(10,2) DEFAULT 0,
                        custo_unitario_embalagem DECIMAL(10,2) DEFAULT 0,
                        custo_unitario_transporte DECIMAL(10,2) DEFAULT 0,
                        lucro_unitario DECIMAL(10,2) DEFAULT 0,
                        preco_venda_unitario DECIMAL(10,2) DEFAULT 0
                    );
                    CREATE INDEX idx_products_nome ON products(nome_produto);
                    CREATE INDEX idx_products_data ON products(created_at);
                    CREATE INDEX idx_products_sold ON products(sold_at);
                `
            });
            if (createError) {
                console.error('Erro ao criar tabela products:', createError);
                return false;
            }
            console.log('Tabela products criada com sucesso!');
        } else {
            // Caso 2: Tabela existe, tentar adicionar colunas que faltam (MIGRATION)
            console.log('Tabela products já existe. Executando correção de esquema (Migration)...');
            
            // Adiciona a nova coluna de custo total (custo_producao_total) e as unitárias
            const { error: alterError } = await supabase.rpc('exec_sql', {
                sql: `
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS custo_producao_total DECIMAL(10,2) DEFAULT 0;
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS custo_materiais DECIMAL(10,2) DEFAULT 0;
                    
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS quantidade_produtos INTEGER DEFAULT 1;
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS tecido_tipo TEXT;
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS custo_unitario_tecido DECIMAL(10,2) DEFAULT 0;
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS custo_unitario_aviamentos DECIMAL(10,2) DEFAULT 0;
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS custo_unitario_mo DECIMAL(10,2) DEFAULT 0;
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS custo_unitario_embalagem DECIMAL(10,2) DEFAULT 0;
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS custo_unitario_transporte DECIMAL(10,2) DEFAULT 0;
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS lucro_unitario DECIMAL(10,2) DEFAULT 0;
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS preco_venda_unitario DECIMAL(10,2) DEFAULT 0;
                `
            });
            
            if (alterError) {
                console.log('⚠️ Aviso: Não foi possível atualizar colunas automaticamente. Se o erro persistir, rode o SQL manualmente no Supabase.');
            } else {
                console.log('✅ Estrutura da tabela products atualizada com sucesso.');
            }
        }
        return true;
    } catch (error) {
        console.error('Erro ao verificar/criar tabela products:', error);
        return false;
    }
}

// Função para Garantir Bucket de Storage para Imagens (AJUSTADO)
async function garantirBucketStorage() {
    try {
        const { data: buckets, error } = await supabase.storage.listBuckets();
        if (error) throw error;

        const bucketExiste = buckets.find(b => b.name === BUCKET_NAME);

        if (!bucketExiste) {
            console.log(`Criando bucket '${BUCKET_NAME}'...`);
            const { data, error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
                public: true, // Importante: O bucket precisa ser público
                fileSizeLimit: 5242880, // 5MB
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
            });
            
            if (createError) {
                console.error('Erro ao criar bucket:', createError.message);
                return false;
            }
            console.log(`Bucket '${BUCKET_NAME}' criado com sucesso!`);
        }
        return true;
    } catch (error) {
        console.error('Erro ao verificar Storage:', error);
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
        // As funções abaixo agora incluem a lógica de criação/migração
        await garantirTabelaGastos();
        await garantirTabelaProducts();
        await garantirBucketStorage(); 
        
        const [clientesCheck, gastosCheck, productsCheck] = await Promise.all([
            supabase.from('clientes_iptv').select('count', { count: 'exact' }).limit(1),
            supabase.from('gastos_mensais').select('count', { count: 'exact' }).limit(1),
            supabase.from('products').select('count', { count: 'exact' }).limit(1)
        ]);

        res.status(200).json({
            status: "conectado",
            tabelas: {
                clientes_iptv: clientesCheck.error ? "erro" : "ok",
                gastos_mensais: gastosCheck.error ? "erro" : "ok",
                products: productsCheck.error ? "erro" : "ok"
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
// (CÓDIGO DE GASTOS MANTIDO)
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

        if (!nome_produto || !local_compra || !valor_total || !data_compra || !cartao || !num_parcelas) {
            return res.status(400).json({ error: "Dados obrigatórios faltando" });
        }

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

        const { data, error } = await supabase.from('gastos_mensais').insert([dadosParaInserir]).select();

        if (error) throw error;

        res.status(200).json({ message: "✅ Compra salva com sucesso!", id: data[0]?.id, data: data[0] });

    } catch (error) {
        console.error("❌ Erro ao salvar compra:", error);
        res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
});

// Listar todos os gastos com filtros
app.get('/api/gastos', async (req, res) => {
    try {
        const { cartao, mes, ano, status } = req.query;
        let query = supabase.from('gastos_mensais').select('*').order('data_compra', { ascending: false });

        if (cartao && cartao !== 'todos') query = query.eq('cartao', cartao);
        if (status && status !== 'todos') query = query.eq('status', status);

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
        const { data, error } = await supabase.from('gastos_mensais').select('*').eq('id', id).single();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Compra não encontrada" });
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
        updateData.data_atualizacao = new Date().toISOString();

        const { data, error } = await supabase.from('gastos_mensais').update(updateData).eq('id', id).select();

        if (error) throw error;
        if (!data || data.length === 0) return res.status(404).json({ error: "Compra não encontrada" });

        res.status(200).json({ message: "✅ Compra atualizada com sucesso!", data: data[0] });
    } catch (error) {
        console.error("❌ Erro ao atualizar compra:", error);
        res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
});

// Marcar gasto como pago (todas as parcelas)
app.put('/api/gastos/:id/pagar', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: compra, error: fetchError } = await supabase.from('gastos_mensais').select('*').eq('id', id).single();
        if (fetchError) throw fetchError;
        if (!compra) return res.status(404).json({ error: "Compra não encontrada" });

        const updateData = {
            status: 'pago',
            parcelas_pagas: compra.num_parcelas,
            parcelas_restantes: 0,
            valor_em_aberto: 0,
            valor_pago: compra.valor_total,
            data_atualizacao: new Date().toISOString()
        };

        const { data, error } = await supabase.from('gastos_mensais').update(updateData).eq('id', id).select();
        if (error) throw error;

        res.status(200).json({ message: "✅ Compra marcada como paga com sucesso!", data: data[0] });
    } catch (error) {
        console.error("❌ Erro ao marcar compra como paga:", error);
        res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
});

// Pagar uma parcela específica
app.put('/api/gastos/:id/pagar-parcela', async (req, res) => {
    try {
        const { id } = req.params;
        const { mes_fatura, ano_fatura } = req.body;

        const { data: compra, error: fetchError } = await supabase.from('gastos_mensais').select('*').eq('id', id).single();
        if (fetchError) throw fetchError;
        if (!compra) return res.status(404).json({ error: "Compra não encontrada" });
        if (compra.status === 'pago') return res.status(400).json({ error: "Esta compra já está totalmente paga" });

        const numParcelas = compra.num_parcelas || 1;
        const parcelasPagas = compra.parcelas_pagas || 0;
        const valorParcela = compra.valor_parcela || (compra.valor_total / numParcelas);
        
        const novasParcelasPagas = parcelasPagas + 1;
        const novasParcelasRestantes = Math.max(0, numParcelas - novasParcelasPagas);
        const novoValorEmAberto = valorParcela * novasParcelasRestantes;
        const novoValorPago = valorParcela * novasParcelasPagas;
        const novoStatus = novasParcelasRestantes === 0 ? 'pago' : 'pendente';

        let proximoMes = mes_fatura;
        let proximoAno = ano_fatura;
        if (novoStatus === 'pendente') {
            proximoMes = parseInt(mes_fatura) + 1;
            proximoAno = parseInt(ano_fatura);
            if (proximoMes > 12) { proximoMes = 1; proximoAno += 1; }
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

        const { data, error } = await supabase.from('gastos_mensais').update(updateData).eq('id', id).select();
        if (error) throw error;

        res.status(200).json({ 
            message: `✅ Fatura de ${mes_fatura}/${ano_fatura} paga com sucesso!`, 
            data: data[0],
            proxima_fatura: novoStatus === 'pendente' ? { mes: proximoMes, ano: proximoAno, valor: valorParcela } : null
        });
    } catch (error) {
        console.error("❌ Erro ao pagar fatura:", error);
        res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
});

// Obter faturas pendentes por cartão
app.get('/api/gastos/faturas-pendentes', async (req, res) => {
    try {
        const { cartao } = req.query;
        let query = supabase.from('gastos_mensais').select('*').eq('status', 'pendente').order('data_compra', { ascending: true });
        if (cartao) query = query.eq('cartao', cartao);

        const { data, error } = await query;
        if (error) throw error;

        const faturasPorCartaoMes = {};

        if (data && data.length > 0) {
            data.forEach(gasto => {
                const cartao = gasto.cartao;
                const parcelasPagas = gasto.parcelas_pagas || 0;
                const numParcelas = gasto.num_parcelas || 1;
                
                if (parcelasPagas >= numParcelas) return;
                
                const dataCompra = new Date(gasto.data_compra);
                let mesFatura = dataCompra.getMonth() + 1 + parcelasPagas;
                let anoFatura = dataCompra.getFullYear();
                
                while (mesFatura > 12) { mesFatura -= 12; anoFatura += 1; }
                
                const chave = `${cartao}-${anoFatura}-${String(mesFatura).padStart(2, '0')}`;
                
                if (!faturasPorCartaoMes[chave]) {
                    faturasPorCartaoMes[chave] = { cartao: cartao, mes: mesFatura, ano: anoFatura, valor_total: 0, compras: [] };
                }
                
                const valorParcela = gasto.valor_parcela || (gasto.valor_total / numParcelas);
                faturasPorCartaoMes[chave].valor_total += valorParcela;
                faturasPorCartaoMes[chave].compras.push({ id: gasto.id, nome_produto: gasto.nome_produto, valor_parcela: valorParcela });
            });
        }

        const faturasArray = Object.values(faturasPorCartaoMes);
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
        if (!cartao || !mes || !ano) return res.status(400).json({ error: "Cartão, mês e ano são obrigatórios" });

        const { data: compras, error: fetchError } = await supabase.from('gastos_mensais').select('*').eq('cartao', cartao).eq('status', 'pendente');
        if (fetchError) throw fetchError;
        if (!compras || compras.length === 0) return res.status(404).json({ error: "Nenhuma compra pendente encontrada" });

        let totalPago = 0;
        const comprasAtualizadas = [];

        for (const compra of compras) {
            const numParcelas = compra.num_parcelas || 1;
            const parcelasPagas = compra.parcelas_pagas || 0;
            
            if (parcelasPagas >= numParcelas) continue;
            
            const dataCompra = new Date(compra.data_compra);
            let mesProximaFatura = dataCompra.getMonth() + 1 + parcelasPagas;
            let anoProximaFatura = dataCompra.getFullYear();
            
            while (mesProximaFatura > 12) { mesProximaFatura -= 12; anoProximaFatura += 1; }
            
            if (mesProximaFatura === parseInt(mes) && anoProximaFatura === parseInt(ano)) {
                const valorParcela = compra.valor_parcela || (compra.valor_total / numParcelas);
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
                
                const { error: updateError } = await supabase.from('gastos_mensais').update(updateData).eq('id', compra.id);
                if (updateError) { console.error(`Erro ao atualizar compra ${compra.id}:`, updateError); continue; }
                
                totalPago += valorParcela;
                comprasAtualizadas.push(compra.id);
            }
        }

        if (comprasAtualizadas.length === 0) return res.status(400).json({ error: `Nenhuma fatura encontrada para ${cartao} em ${mes}/${ano}` });

        res.status(200).json({ 
            message: `✅ Fatura de ${mes}/${ano} do cartão ${cartao} paga com sucesso!`,
            total_pago: totalPago,
            quantidade_compras: comprasAtualizadas.length,
            compras_atualizadas: comprasAtualizadas
        });

    } catch (error) {
        console.error("❌ Erro ao pagar fatura do cartão:", error);
        res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
});

// Excluir gasto
app.delete('/api/gastos/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('gastos_mensais').delete().eq('id', req.params.id);
        if (error) throw error;
        res.status(200).json({ message: "✅ Compra excluída com sucesso!" });
    } catch (error) {
        console.error("❌ Erro ao excluir compra:", error);
        res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
});

// Obter resumo por cartão
app.get('/api/gastos/resumo/cartoes', async (req, res) => {
    try {
        const { data, error } = await supabase.from('gastos_mensais').select('*');
        if (error) throw error;

        const resumo = {};
        const todosCartoes = ["Banco Pan", "Atacadão", "Nubank", "Santander", "Riachuello", "Le Bescuit", "C&A", "Renner", "Mercado Livre", "Cartão Mais", "Mais", "Brasil Card", "Azul Atacarejo"];
        todosCartoes.forEach(c => resumo[c] = { total: 0, compras: 0, parcelas_pendentes: 0, valor_pendente: 0, valor_pago: 0, valor_aberto: 0, parcelas_pagas_total: 0, parcelas_total: 0 });

        if (data && data.length > 0) {
            data.forEach(gasto => {
                const cartao = gasto.cartao;
                if (!resumo[cartao]) resumo[cartao] = { total: 0, compras: 0, parcelas_pendentes: 0, valor_pendente: 0, valor_pago: 0, valor_aberto: 0, parcelas_pagas_total: 0, parcelas_total: 0 };
                
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
        const { data, error } = await supabase.from('gastos_mensais').select('*');
        if (error) throw error;

        const resumo = { total_gasto: 0, total_aberto: 0, total_pago: 0, total_compras: 0, compras_pendentes: 0, compras_pagas: 0, por_cartao: {} };

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

                const cartao = gasto.cartao;
                if (!resumo.por_cartao[cartao]) resumo.por_cartao[cartao] = { total: 0, aberto: 0, pago: 0, compras: 0 };
                
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
// (CÓDIGO DE CLIENTES MANTIDO)
// =============================================

app.post('/api/clientes', async (req, res) => {
    try {
        const { nome, telefone, valor_plano, tipo, tipo_plano, data_vencimento, revendedor, servidor, observacoes } = req.body;
        if (!nome || !telefone || !valor_plano || !tipo || !tipo_plano || !data_vencimento || !servidor) {
            return res.status(400).json({ error: "Dados obrigatórios faltando" });
        }
        const dadosParaInserir = {
            nome, telefone, valor_plano: parseFloat(valor_plano) || 0, tipo, tipo_plano,
            data_vencimento, revendedor: revendedor || null, servidor, observacoes: observacoes || null,
            data_cadastro: new Date().toISOString(), status: 'ativo'
        };
        const { data, error } = await supabase.from('clientes_iptv').insert([dadosParaInserir]).select();
        if (error) throw error;
        res.status(200).json({ message: "✅ Cliente salvo com sucesso!", id: data[0]?.id, data: data[0] });
    } catch (error) {
        console.error("❌ Erro ao salvar cliente:", error);
        res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
});

app.get('/api/clientes', async (req, res) => {
    try {
        const { data, error } = await supabase.from('clientes_iptv').select('*').order('data_cadastro', { ascending: false });
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error('❌ Erro ao buscar clientes:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/clientes/:id', async (req, res) => {
    try {
        const { data, error } = await supabase.from('clientes_iptv').select('*').eq('id', req.params.id).single();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Cliente não encontrado" });
        res.status(200).json(data);
    } catch (error) {
        console.error('❌ Erro ao buscar cliente:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/clientes/:id', async (req, res) => {
    try {
        const { data, error } = await supabase.from('clientes_iptv').update(req.body).eq('id', req.params.id).select();
        if (error) throw error;
        if (!data || data.length === 0) return res.status(404).json({ error: "Cliente não encontrado" });
        res.status(200).json({ message: "✅ Cliente atualizado com sucesso!", data: data[0] });
    } catch (error) {
        console.error("❌ Erro ao atualizar cliente:", error);
        res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
});

app.delete('/api/clientes/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('clientes_iptv').delete().eq('id', req.params.id);
        if (error) throw error;
        res.status(200).json({ message: "✅ Cliente excluído com sucesso!" });
    } catch (error) {
        console.error("❌ Erro ao excluir cliente:", error);
        res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
});

// =============================================
// ROTAS DE PRODUTOS (CALCULADORA) - NOVO CÓDIGO APLICADO
// =============================================

// Garantir tabela antes de todas as rotas de produtos
app.use('/api/products*', async (req, res, next) => {
    try {
        await garantirTabelaProducts();
        await garantirBucketStorage(); 
        next();
    } catch (error) {
        console.error('Erro ao garantir tabela products:', error);
        res.status(500).json({ 
            error: "Erro interno do servidor - tabela não disponível",
            details: error.message 
        });
    }
});

// Rota de Salvamento de Produtos (NOVO CÓDIGO)
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
            
            // ATENÇÃO: Usando o BUCKET_NAME ('produtos')
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from(BUCKET_NAME) 
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
                .from(BUCKET_NAME) 
                .getPublicUrl(fileName);
            
            publicUrl = urlData.publicUrl;
            console.log('Imagem salva com URL:', publicUrl);
        }

        // 2. Mapear dados do frontend para a estrutura da tabela
        // Garante que todos os campos sejam convertidos para número, se necessário
        const custoUnitarioTecido = parseFloat(dados.custo_unitario_tecido || 0);
        const custoUnitarioAviamentos = parseFloat(dados.custo_unitario_aviamentos || 0);
        const custoUnitarioMO = parseFloat(dados.custo_unitario_mo || 0);
        const custoUnitarioEmbalagem = parseFloat(dados.custo_unitario_embalagem || 0);
        const custoUnitarioTransporte = parseFloat(dados.custo_unitario_transporte || 0);
        const quantidadeProdutos = parseInt(dados.quantidade_produtos || 1);
        const precoVendaUnitario = parseFloat(dados.preco_venda_unitario || 0);
        const lucroUnitario = parseFloat(dados.lucro_unitario || 0);
        
        const custoMateriais = custoUnitarioTecido + custoUnitarioAviamentos;
        const custoProducaoTotal = custoMateriais + custoUnitarioMO + custoUnitarioEmbalagem + custoUnitarioTransporte;

        const dadosParaInserir = {
            nome_produto: dados.nome_produto,
            imagem_url: publicUrl,
            
            // Dados do tecido
            tipo_tecido: dados.tecido_tipo,
            valor_total_tecido: parseFloat(dados.valor_total_tecido || 0),
            comprimento_total_tecido: parseFloat(dados.comprimento_total_tecido || 0),
            largura_tecido: parseFloat(dados.largura_tecido || 0),
            metragem_utilizada: parseFloat(dados.metragem_utilizada || 0),
            
            // Custos unitários (salvos também como as colunas custo_...)
            custo_tecido: custoUnitarioTecido,
            custo_mao_obra: custoUnitarioMO,
            custo_embalagem: custoUnitarioEmbalagem,
            custo_transporte: custoUnitarioTransporte,
            custo_aviamentos: custoUnitarioAviamentos,
            
            // Custos Calculados
            custo_materiais: custoMateriais,
            custo_producao_total: custoProducaoTotal, // Corrigido para a soma das variáveis locais
            
            // Lucro e preço
            porcentagem_lucro: parseFloat(dados.porcentagem_lucro || 0),
            valor_lucro: lucroUnitario,
            preco_venda_final: precoVendaUnitario, // Preço de venda unitário
            
            // Lote
            quantidade_lote: quantidadeProdutos,
            valor_total_lote: precoVendaUnitario * quantidadeProdutos,
            
            // Detalhes adicionais
            detalhes_aviamentos: dados.aviamentos_data || [],
            
            // Campos unitários adicionais
            quantidade_produtos: quantidadeProdutos,
            tecido_tipo: dados.tecido_tipo,
            custo_unitario_tecido: custoUnitarioTecido,
            custo_unitario_aviamentos: custoUnitarioAviamentos,
            custo_unitario_mo: custoUnitarioMO,
            custo_unitario_embalagem: custoUnitarioEmbalagem,
            custo_unitario_transporte: custoUnitarioTransporte,
            lucro_unitario: lucroUnitario,
            preco_venda_unitario: precoVendaUnitario
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
            message: "✅ Produto salvo com sucesso!", 
            id: data[0]?.id,
            data: data[0]
        });

    } catch (error) {
        console.error("❌ Erro completo ao salvar:", error);
        res.status(500).json({ 
            error: "Erro interno do servidor",
            details: error.message 
        });
    }
});

// Rota para listar produtos (NOVO CÓDIGO)
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

// Buscar produto por ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const { data, error } = await supabase.from('products').select('*').eq('id', req.params.id).single();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Produto não encontrado" });
        res.status(200).json(data);
    } catch (error) {
        console.error('❌ Erro ao buscar produto:', error);
        res.status(500).json({ error: error.message });
    }
});

// Atualizar produto
app.put('/api/products/:id', async (req, res) => {
    try {
        const { data, error } = await supabase.from('products').update(req.body).eq('id', req.params.id).select();
        if (error) throw error;
        if (!data || data.length === 0) return res.status(404).json({ error: "Produto não encontrado" });
        res.status(200).json({ message: "✅ Produto atualizado com sucesso!", data: data[0] });
    } catch (error) {
        console.error("❌ Erro ao atualizar produto:", error);
        res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
});

// Marcar produto como vendido
app.put('/api/products/:id/vender', async (req, res) => {
    try {
        const { data, error } = await supabase.from('products').update({ sold_at: new Date().toISOString() }).eq('id', req.params.id).select();
        if (error) throw error;
        if (!data || data.length === 0) return res.status(404).json({ error: "Produto não encontrado" });
        res.status(200).json({ message: "✅ Produto marcado como vendido com sucesso!", data: data[0] });
    } catch (error) {
        console.error("❌ Erro ao marcar produto como vendido:", error);
        res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
});

// Excluir produto
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('products').delete().eq('id', req.params.id);
        if (error) throw error;
        res.status(200).json({ message: "✅ Produto excluído com sucesso!" });
    } catch (error) {
        console.error("❌ Erro ao excluir produto:", error);
        res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
});

// Obter estatísticas de produtos
app.get('/api/products/estatisticas', async (req, res) => {
    try {
        const { data, error } = await supabase.from('products').select('*');
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
                    // Aqui, usamos valor_total_lote para o valor de venda
                    estatisticas.valor_total_vendido += parseFloat(produto.valor_total_lote || 0);
                    // O lucro total é calculado com base no valor_lucro unitário * quantidade
                    estatisticas.lucro_total += parseFloat(produto.valor_lucro || 0) * parseFloat(produto.quantidade_lote || 1);
                    estatisticas.produtos_vendidos++;
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
// ROTAS PARA CRIAR TABELAS (MANUAIS)
// =============================================

app.get('/api/criar-tabela-gastos', async (req, res) => {
    try {
        const tabelaCriada = await garantirTabelaGastos();
        if (tabelaCriada) res.status(200).json({ message: "✅ Tabela 'gastos_mensais' verificada/criada com sucesso!" });
        else res.status(500).json({ error: "Erro ao criar/verificar tabela" });
    } catch (error) {
        res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
});

app.get('/api/criar-tabela-products', async (req, res) => {
    try {
        const tabelaCriada = await garantirTabelaProducts();
        if (tabelaCriada) res.status(200).json({ message: "✅ Tabela 'products' verificada/criada com sucesso!" });
        else res.status(500).json({ error: "Erro ao criar/verificar tabela" });
    } catch (error) {
        res.status(500).json({ error: "Erro interno do servidor", details: error.message });
    }
});

// =============================================
// ROTA DE FALLBACK PARA PÁGINAS HTML
// =============================================

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/:page', (req, res) => {
    const page = req.params.page;
    const validPages = ['index.html', 'dashboard.html', 'calculator.html', 'clientes.html', 'clientesrenovacao.html', 'investimentos.html', 'products.html', 'gastos_mensais.html'];
    
    if (validPages.includes(page)) {
        res.sendFile(__dirname + '/' + page);
    } else {
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
    console.log(`🚀 SERVIDOR INICIADO EM http://localhost:${port}`);
    
    try {
        await garantirTabelaGastos();
        console.log('✅ Tabela de gastos verificada!');
        
        await garantirTabelaProducts();
        console.log('✅ Tabela de products verificada!');

        await garantirBucketStorage(); // Garante bucket na inicialização
        console.log(`✅ Bucket de imagens (${BUCKET_NAME}) verificado!`);
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
    }
});
