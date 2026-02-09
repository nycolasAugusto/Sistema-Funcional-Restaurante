const API_URL = "/api";

// When opening the screen, sets today's dates and loads
document.addEventListener("DOMContentLoaded", () => {
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('dataInicio').value = hoje;
    document.getElementById('dataFim').value = hoje;
    
    // Optional: Load automatically on startup
    // gerarRelatorio();
});

// --- HELPER FUNCTIONS (Formatting) ---
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataString) {
    if (!dataString) return "-";
    const data = new Date(dataString);
    return data.toLocaleString('pt-BR');
}

function getBadgePagamento(metodo) {
    if (!metodo) return "";
    const m = metodo.toUpperCase();
    if (m === 'PIX') return `<span style="background:#32bcad; color:white; padding:2px 6px; border-radius:4px; font-size:0.8em">PIX</span>`;
    if (m === 'CREDITO') return `<span style="background:#3b82f6; color:white; padding:2px 6px; border-radius:4px; font-size:0.8em">CRÉDITO</span>`;
    if (m === 'DEBITO') return `<span style="background:#f59e0b; color:white; padding:2px 6px; border-radius:4px; font-size:0.8em">DÉBITO</span>`;
    return `<span style="background:#10b981; color:white; padding:2px 6px; border-radius:4px; font-size:0.8em">${m}</span>`;
}

// --- MAIN FUNCTION ---
async function gerarRelatorio() {
    const dtInicio = document.getElementById('dataInicio').value;
    const dtFim = document.getElementById('dataFim').value;

    if(!dtInicio || !dtFim) return alert("Selecione as datas!");

    // Adjusts time to capture the whole day
    const inicio = new Date(dtInicio + "T00:00:00");
    const fim = new Date(dtFim + "T23:59:59");

    try {
        const [resPedidos, resProdutos] = await Promise.all([
            fetch(`${API_URL}/pedidos`), 
            fetch(`${API_URL}/produto`)
        ]);

        const listaPedidos = await resPedidos.json();
        const listaProdutos = await resProdutos.json();

        // 1. FILTER: Only PAID orders within the selected date
        const pedidosFiltrados = listaPedidos.filter(pedido => {
            // Uses dataPagamento if available, otherwise dataPedido
            const dataRef = pedido.dataPagamento ? new Date(pedido.dataPagamento) : new Date(pedido.dataPedido);
            
            return dataRef >= inicio && 
                   dataRef <= fim && 
                   pedido.status === 'PAGO'; 
        });

        let faturamentoTotal = 0;
        let custoMercadoriaTotal = 0;
        let taxasTotal = 0; 
        const resumoProdutos = {};

        // Clears the NEW Sales History table
        const tbodyHistorico = document.getElementById('tabelaHistoricoVendas');
        if (tbodyHistorico) tbodyHistorico.innerHTML = '';

        // --- MAIN LOOP ---
        pedidosFiltrados.forEach(pedido => {
            
            const taxaDoPedido = pedido.taxaPagamento || 0;
            taxasTotal += taxaDoPedido;
            
            // Calculates cost for this specific order
            let custoDestePedido = 0;

            pedido.itens.forEach(item => {
                const prodOriginal = listaProdutos.find(p => p.id === item.produtoId);
                
                // Historical Cost Logic
                let custoValido = item.custoUnitario;
                if ((!custoValido || custoValido === 0) && prodOriginal) {
                    custoValido = prodOriginal.custoMedio;
                }

                // Calculations
                const totalItemVenda = item.quantidade * item.precoUnitarioVenda;
                const totalItemCusto = item.quantidade * custoValido;

                custoDestePedido += totalItemCusto;
                faturamentoTotal += totalItemVenda;
                custoMercadoriaTotal += totalItemCusto;

                // Grouping for Product Detail Table (Summary)
                const nome = item.produto ? item.produto.nome : (prodOriginal ? prodOriginal.nome : "Item " + item.produtoId);
                
                if(!resumoProdutos[nome]) {
                    resumoProdutos[nome] = { 
                        qtd: 0, 
                        venda: 0, 
                        custo: 0, 
                        custoUnitario: custoValido 
                    };
                }
                
                resumoProdutos[nome].qtd += item.quantidade;
                resumoProdutos[nome].venda += totalItemVenda;
                resumoProdutos[nome].custo += totalItemCusto;
            });

            // --- FILLS THE NEW SALES HISTORY TABLE ---
            if (tbodyHistorico) {
                const lucroRealPedido = pedido.valorTotal - custoDestePedido - taxaDoPedido;
                const clienteNome = pedido.cliente ? pedido.cliente.nome : 'Balcão';
                const dataDisplay = formatarData(pedido.dataPagamento || pedido.dataPedido);

                tbodyHistorico.innerHTML += `
                    <tr>
                        <td>#${pedido.id}</td>
                        <td>${dataDisplay}</td>
                        <td>${clienteNome}</td>
                        <td>${getBadgePagamento(pedido.metodoPagamento)}</td>
                        <td>${formatarMoeda(pedido.valorTotal)}</td>
                        <td style="color: #ef4444;">- ${formatarMoeda(taxaDoPedido)}</td>
                        <td style="color: ${lucroRealPedido >= 0 ? 'green' : 'red'}; font-weight: bold;">
                            ${formatarMoeda(lucroRealPedido)}
                        </td>
                    </tr>
                `;
            }
        });

        // 2. CALCULATE NET PROFIT
        const lucroTotal = faturamentoTotal - (custoMercadoriaTotal + taxasTotal);

        // --- UPDATE SCREEN CARDS ---
        document.getElementById('txtFaturamento').innerText = formatarMoeda(faturamentoTotal);
        
        // Visual Cost = Merchandise + Fees
        const custoVisual = custoMercadoriaTotal + taxasTotal;
        document.getElementById('txtCusto').innerText = formatarMoeda(custoVisual);
        
        const elLucro = document.getElementById('txtLucro');
        elLucro.innerText = formatarMoeda(lucroTotal);
        elLucro.style.color = lucroTotal >= 0 ? '#28a745' : '#dc3545';

        // Fill Product Summary Table
        preencherTabelaDetalhada(resumoProdutos);

    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        alert("Erro ao calcular financeiro.");
    }
}

function preencherTabelaDetalhada(dados) {
    const tbody = document.getElementById('tabelaFinanceira'); // Product Table
    if (!tbody) return;
    tbody.innerHTML = '';

    for (const [nome, info] of Object.entries(dados)) {
        const lucro = info.venda - info.custo;
        const margem = info.venda > 0 ? ((lucro / info.venda) * 100).toFixed(1) : 0;
        const precoMedio = info.qtd > 0 ? info.venda / info.qtd : 0;

        tbody.innerHTML += `
            <tr>
                <td>${nome}</td>
                <td>${parseFloat(info.qtd.toFixed(3))}</td>
                <td>${formatarMoeda(precoMedio)}</td>
                <td style="color:#dc3545">${formatarMoeda(info.custoUnitario)}</td>
                <td style="font-weight:bold; color:${lucro >= 0 ? 'green' : 'red'}">
                    ${formatarMoeda(lucro)}
                </td>
                <td>${margem}%</td>
            </tr>
        `;
    }

    if(Object.keys(dados).length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Nenhuma venda neste período.</td></tr>';
    }
}