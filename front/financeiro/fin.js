const API_URL = "http://localhost:5186/api"; 

// Ao abrir a tela, define as datas de hoje e carrega
document.addEventListener("DOMContentLoaded", () => {
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('dataInicio').value = hoje;
    document.getElementById('dataFim').value = hoje;
    
    gerarRelatorio();
});

async function gerarRelatorio() {
    const dtInicio = document.getElementById('dataInicio').value;
    const dtFim = document.getElementById('dataFim').value;

    if(!dtInicio || !dtFim) return alert("Selecione as datas!");

    const inicio = new Date(dtInicio + "T00:00:00");
    const fim = new Date(dtFim + "T23:59:59");

    try {
        const [resPedidos, resProdutos] = await Promise.all([
            fetch(`${API_URL}/pedidos`), 
            fetch(`${API_URL}/produto`)
        ]);

        const listaPedidos = await resPedidos.json();
        const listaProdutos = await resProdutos.json();

        // Filtra pedidos pela data e status
        const pedidosFiltrados = listaPedidos.filter(pedido => {
            const dataPedido = new Date(pedido.dataPedido); 
            // Ignora cancelados
            return dataPedido >= inicio && dataPedido <= fim && pedido.status !== 'CANCELADO';
        });

        let faturamentoTotal = 0;
        let custoTotal = 0;
        const resumoProdutos = {};

        pedidosFiltrados.forEach(pedido => {
            pedido.itens.forEach(item => {
                const prodOriginal = listaProdutos.find(p => p.id === item.produtoId);
                
                // --- AQUI ESTÁ A CORREÇÃO FINANCEIRA ---
                
                // 1. Tenta pegar o Custo Real que gravamos na hora da venda (Histórico)
                let custoValido = item.custoUnitario;

                // 2. Se for venda ANTIGA (antes dessa atualização), o custo vai ser 0.
                // Nesse caso, usamos o custo atual do cadastro como "quebra-galho".
                if ((!custoValido || custoValido === 0) && prodOriginal) {
                    custoValido = prodOriginal.custoMedio;
                }

                // Cálculos
                const totalItemVenda = item.quantidade * item.precoUnitarioVenda; // Valor que vendeu
                const totalItemCusto = item.quantidade * custoValido;             // Quanto custou

                faturamentoTotal += totalItemVenda;
                custoTotal += totalItemCusto;

                // Agrupamento para a Tabela
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
        });

        const lucroTotal = faturamentoTotal - custoTotal;

        // Atualizar Cards
        document.getElementById('txtFaturamento').innerText = formatarMoeda(faturamentoTotal);
        document.getElementById('txtCusto').innerText = formatarMoeda(custoTotal);
        
        const elLucro = document.getElementById('txtLucro');
        elLucro.innerText = formatarMoeda(lucroTotal);
        elLucro.style.color = lucroTotal >= 0 ? '#28a745' : '#dc3545';

        // Preencher Tabela
        preencherTabelaDetalhada(resumoProdutos);

    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        alert("Erro ao calcular financeiro.");
    }
}

function preencherTabelaDetalhada(dados) {
    const tbody = document.getElementById('tabelaFinanceira');
    tbody.innerHTML = '';

    for (const [nome, info] of Object.entries(dados)) {
        const lucro = info.venda - info.custo;
        const margem = info.venda > 0 ? ((lucro / info.venda) * 100).toFixed(1) : 0;
        const precoMedio = info.venda / info.qtd;

        tbody.innerHTML += `
            <tr>
                <td>${nome}</td>
                <td>${info.qtd}</td>
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

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}