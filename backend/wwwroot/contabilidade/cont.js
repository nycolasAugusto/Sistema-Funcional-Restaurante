const API_URL = "/api";
let listaPedidosCache = []; 

// 1. Ao carregar a página, define datas de hoje e carrega
document.addEventListener("DOMContentLoaded", () => {
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('dataInicio').value = hoje;
    document.getElementById('dataFim').value = hoje;

    carregarDados();
});

// 2. Função Principal
async function carregarDados() {
    const dtInicio = document.getElementById('dataInicio').value;
    const dtFim = document.getElementById('dataFim').value;

    if (!dtInicio || !dtFim) return alert("Selecione as datas.");

    const inicio = new Date(dtInicio + "T00:00:00");
    const fim = new Date(dtFim + "T23:59:59");

    try {
        const [resPedidos, resProdutos] = await Promise.all([
            fetch(`${API_URL}/pedidos`),
            fetch(`${API_URL}/produto`)
        ]);

        const todosPedidos = await resPedidos.json();
        const todosProdutos = await resProdutos.json();

        // Salva cache para o modal
        listaPedidosCache = todosPedidos;

        // --- AQUI ESTÁ A REGRA DE OURO ---
        const pedidosFiltrados = todosPedidos.filter(p => {
            
            // 1ª TRAVA: Se não estiver PAGO, ignora imediatamente!
            if (p.status !== 'PAGO') return false;

            // 2ª TRAVA: Filtra pela data que o pagamento ACONTECEU (não a do pedido)
            // Se por acaso a dataPagamento for nula (erro de banco), usa a do pedido
            const dataRef = p.dataPagamento ? new Date(p.dataPagamento) : new Date(p.dataPedido);
            
            return dataRef >= inicio && dataRef <= fim;
        });

        renderizarTabela(pedidosFiltrados, todosProdutos);

    } catch (error) {
        console.error("Erro:", error);
        alert("Erro ao carregar dados.");
    }
}

// 3. Renderiza a Tabela
function renderizarTabela(pedidos, produtos) {
    const tbody = document.getElementById('tabelaContabilidade');
    tbody.innerHTML = '';

    // Variáveis para somar os totais lá embaixo
    let totalBruto = 0;
    let totalTaxas = 0;
    let totalCustos = 0;
    let totalLiquido = 0;

    // Se não tiver pedidos pagos, avisa
    if (pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">Nenhum pagamento confirmado neste período.</td></tr>';
        zerarRodape();
        return;
    }

    pedidos.forEach(pedido => {
        // --- CÁLCULOS DA LINHA ---
        const vendaBruta = pedido.valorTotal;
        const taxa = pedido.taxaPagamento || 0; // Pega a taxa salva na hora do pagamento
        
        // Calcula Custo de Mercadoria (CMV) deste pedido
        let custoPedido = 0;
        pedido.itens.forEach(item => {
            // Tenta pegar custo histórico, se falhar pega do cadastro atual
            let custoUnit = item.custoUnitario;
            if (!custoUnit) {
                const prodCadastrado = produtos.find(p => p.id === item.produtoId);
                custoUnit = prodCadastrado ? prodCadastrado.custoMedio : 0;
            }
            custoPedido += (item.quantidade * custoUnit);
        });

        // Lucro Real = O que entrou - O que a maquininha comeu - O que custou o produto
        const lucroLiquido = vendaBruta - taxa - custoPedido;

        // Soma nos totais gerais
        totalBruto += vendaBruta;
        totalTaxas += taxa;
        totalCustos += custoPedido;
        totalLiquido += lucroLiquido;

        // Cria a linha na tabela
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${pedido.id}</td>
            <td>${formatarData(pedido.dataPagamento)}</td>
            <td>${pedido.cliente ? pedido.cliente.nome : 'Balcão'}</td>
            <td>${getBadge(pedido.metodoPagamento)}</td>
            <td>${formatarMoeda(vendaBruta)}</td>
            <td style="color:#ef4444">- ${formatarMoeda(taxa)}</td>
            <td style="color:#ef4444">- ${formatarMoeda(custoPedido)}</td>
            <td style="font-weight:bold; color:${lucroLiquido >= 0 ? 'green' : 'red'}">
                ${formatarMoeda(lucroLiquido)}
            </td>
            <td>
                <button class="btn-ver" onclick="abrirModal(${pedido.id})">Ver Itens</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Atualiza o Rodapé (Footer) com os totais somados
    document.getElementById('totalBruto').innerText = formatarMoeda(totalBruto);
    document.getElementById('totalTaxas').innerText = "- " + formatarMoeda(totalTaxas);
    document.getElementById('totalCustos').innerText = "- " + formatarMoeda(totalCustos);
    
    const elLiq = document.getElementById('totalLiquido');
    elLiq.innerText = formatarMoeda(totalLiquido);
    elLiq.style.color = totalLiquido >= 0 ? '#10b981' : '#ef4444';
}

function zerarRodape() {
    document.getElementById('totalBruto').innerText = "R$ 0,00";
    document.getElementById('totalTaxas').innerText = "R$ 0,00";
    document.getElementById('totalCustos').innerText = "R$ 0,00";
    document.getElementById('totalLiquido').innerText = "R$ 0,00";
}

// 4. Modal e Utilitários
function abrirModal(id) {
    const pedido = listaPedidosCache.find(p => p.id === id);
    if (!pedido) return;

    document.getElementById('tituloModal').innerText = `Itens do Pedido #${pedido.id}`;
    const tbody = document.getElementById('listaItensModal');
    tbody.innerHTML = '';

    pedido.itens.forEach(item => {
        const nome = item.produto ? item.produto.nome : 'Produto excluído';
        const totalItem = item.quantidade * item.precoUnitarioVenda;
        
        tbody.innerHTML += `
            <tr>
                <td>${nome}</td>
                <td>${item.quantidade}</td>
                <td>${formatarMoeda(item.precoUnitarioVenda)}</td>
                <td><strong>${formatarMoeda(totalItem)}</strong></td>
            </tr>
        `;
    });

    document.getElementById('modalItens').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('modalItens').style.display = 'none';
}

window.onclick = function(event) {
    if (event.target == document.getElementById('modalItens')) {
        fecharModal();
    }
}

function formatarMoeda(val) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataIso) {
    if (!dataIso) return "-";
    return new Date(dataIso).toLocaleString('pt-BR');
}

function getBadge(metodo) {
    if (!metodo) return "-";
    const m = metodo.toUpperCase();
    let classe = 'bg-dinheiro';
    if (m === 'PIX') classe = 'bg-pix';
    if (m.includes('CREDITO') || m.includes('CRÉDITO')) classe = 'bg-credito';
    if (m.includes('DEBITO') || m.includes('DÉBITO')) classe = 'bg-debito';
    
    return `<span class="badge ${classe}">${m}</span>`;
}

async function recalcularTaxasAntigas() {
    // Confirmação para evitar acidentes
    if (!confirm("ATENÇÃO: Isso vai FORÇAR o recálculo de todas as taxas antigas para:\n\nCrédito: 3.5%\nDébito: 1.5%\n\nDeseja continuar?")) return;

    try {
        const res = await fetch(`${API_URL}/pedidos`);
        const pedidos = await res.json();

        let atualizados = 0;

        // Varre pedido por pedido
        for (const p of pedidos) {
            
            // 1. Só interessa pedidos PAGOS ou PARCIAIS
            // RETIREI A TRAVA QUE EXIGIA TAXA ZERO. Agora ele olha tudo.
            if (p.status === 'PAGO' || p.status === 'PARCIAL') {
                
                let novaTaxa = 0;
                const total = p.valorTotal; 
                // Proteção para método nulo
                const metodo = p.metodoPagamento ? p.metodoPagamento.toUpperCase() : '';
                const taxaAtual = p.taxaPagamento || 0;

                // --- NOVAS TAXAS (Ajuste aqui se precisar) ---
                if (metodo.includes('CREDITO') || metodo.includes('CRÉDITO')) {
                    novaTaxa = total * 0.0468; // 3.5%
                } 
                else if (metodo.includes('DEBITO') || metodo.includes('DÉBITO')) {
                    novaTaxa = total * 0.0168; // 1.5%
                }

                // --- O PULO DO GATO ---
                // Verifica se a nova taxa é diferente da que está salva (diferença maior que 1 centavo)
                // Isso evita chamadas desnecessárias no banco
                if (novaTaxa > 0 && Math.abs(novaTaxa - taxaAtual) > 0.01) {
                    
                    await fetch(`${API_URL}/pedidos/${p.id}/taxa`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(novaTaxa)
                    });
                    
                    atualizados++;
                    console.log(`Pedido #${p.id} (${metodo}) corrigido: De R$ ${taxaAtual} para R$ ${novaTaxa.toFixed(2)}`);
                }
            }
        }

        alert(`Processo finalizado!\nTotal de pedidos corrigidos: ${atualizados}`);
        carregarDados(); // Atualiza a tabela na hora

    } catch (erro) {
        console.error(erro);
        alert("Erro ao processar correção.");
    }
}
