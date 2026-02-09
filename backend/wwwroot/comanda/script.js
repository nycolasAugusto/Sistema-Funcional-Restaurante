const API_URL = "/api";
let pedidoAtivo = null;
let clienteIdSelecionado = null;
let todosProdutosCache = []; // Guarda a lista completa vinda do banco
let precoOverride = 0;
/* ===== MODAL ===== */
function abrirModal() {
    document.getElementById('modal').style.display = 'flex';
}
function fecharModal() {
    document.getElementById('modal').style.display = 'none';
    document.getElementById('clienteNome').value = '';
    if(document.getElementById('clienteCelular')) document.getElementById('clienteCelular').value = '';
}
function abrirModalPagamento() {
    if (!pedidoAtivo) {
        alert("Selecione um pedido primeiro para pagar!");
        return;
    }

    // Mostra o valor no modal
    document.getElementById('valorPagarModal').innerText = pedidoAtivo.valorTotal.toFixed(2);
    
    // Abre o modal
    document.getElementById('modalPagamento').style.display = 'flex';
}
function fecharModalPagamento() {
    document.getElementById('modalPagamento').style.display = 'none';
    document.getElementById('selectPagamento').value = ""; // Limpa a seleção
}

function definirQtdEPreco(qtd, preco) {
    // 1. Preenche o campo visualmente
    document.getElementById('qtdPedido').value = qtd;
    
    // 2. Salva o preço (8.00 ou 12.00) na variável global
    precoOverride = preco; 
    
    // 3. Chama a função de adicionar
    adicionarAoPedido();
}
/* ===== 1. CRIAR PEDIDO ===== */   
async function criarPedido() {
    const nome = document.getElementById('clienteNome').value;
    const celular = document.getElementById('clienteCelular').value;

    if (!nome) {
        alert("Informe o nome do cliente");
        return;
    }

    try {
        let idFinalDoCliente;

        // --- LÓGICA INTELIGENTE ---
        if (clienteIdSelecionado != null) {
            // CASO 1: O cliente JÁ EXISTE (a busca achou)
            // Não criamos de novo, apenas usamos o ID dele
            idFinalDoCliente = clienteIdSelecionado;
        
        } else {
            // CASO 2: É cliente NOVO
            // Precisamos salvar no banco primeiro
            const resCliente = await fetch(`${API_URL}/cliente`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: nome, telefone: celular })
            });

            if (!resCliente.ok) throw new Error("Erro ao cadastrar cliente");
            const clienteNovo = await resCliente.json();
            idFinalDoCliente = clienteNovo.id;
        }

        // --- DAQUI PRA BAIXO É IGUAL (CRIA O PEDIDO) ---
        const dadosPedido = {
            clienteId: idFinalDoCliente, // Usa o ID (seja o antigo ou o novo)
            itens: [] 
        };

        const resPedido = await fetch(`${API_URL}/pedidos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosPedido)
        });

        if (resPedido.ok) {
            fecharModal();
            renderPedidos(); 
            
            // Limpa a variável global e os estilos
            clienteIdSelecionado = null;
            document.getElementById('clienteNome').disabled = false;
            document.getElementById('clienteNome').style.backgroundColor = "white";
        } else {
            alert("Erro ao abrir pedido.");
        }

    } catch (error) {
        console.error(error);
        alert("Erro no processo.");
    }
}

/* ===== 2. LISTAR PEDIDOS (ORDEM CRESCENTE) ===== */
async function renderPedidos() {
    const lista = document.getElementById('listaPedidos');
    //lista.innerHTML = '<p style="color:white; padding:10px;">Carregando...</p>';

    try {
        const response = await fetch(`${API_URL}/pedidos`);
        
        // DEBUG: Verifique no Console do navegador (F12) o que está chegando
        const pedidosDoBanco = await response.json();
        console.log("Pedidos recebidos do banco:", pedidosDoBanco); 

        lista.innerHTML = ''; 

        // Verificação de segurança: Se não for array, encerra
        if (!Array.isArray(pedidosDoBanco)) {
            console.error("A resposta da API não é um array:", pedidosDoBanco);
            lista.innerHTML = '<p style="color:white;">Erro no formato dos dados.</p>';
            return;
        }

        // Filtra PENDENTES (ou ABERTO, verifique como está salvando no banco)
        // No seu C# está salvando como "ABERTO", mas aqui você filtra "PENDENTE".
        // CORREÇÃO: Vamos aceitar os dois para garantir.
        const pedidosAbertos = pedidosDoBanco.filter(p => p.status === 'PENDENTE' || p.status === 'ABERTO');

        if (pedidosAbertos.length === 0) {
            lista.innerHTML = '<p style="color:#eee; padding:10px;">Nenhum pedido em aberto.</p>';
            return;
        }

        // --- ORDEM CRESCENTE por ID ---
        pedidosAbertos.sort((a, b) => a.id - b.id);

        pedidosAbertos.forEach(p => {
            const div = document.createElement('div');
            div.className = 'pedido-card';
            
            if (pedidoAtivo && pedidoAtivo.id === p.id) {
                div.classList.add('active');
            }

            // Proteção para nome do cliente
            const nomeCliente = p.cliente ? p.cliente.nome : 'Cliente Balcão';

            div.innerHTML = `
                <strong>#${p.id} ${nomeCliente}</strong><br>
                <span style="font-size:0.85em; color:#ddd;">${p.status}</span><br>
                <strong style="color:#90ee90;">R$ ${p.valorTotal.toFixed(2)}</strong>
            `;

            div.onclick = () => selecionarPedido(p);
            lista.appendChild(div);
        });

    } catch (error) {
        console.error("Erro ao renderizar:", error);
        lista.innerHTML = '<p style="color:white;">Erro de conexão com o servidor.</p>';
    }
}

/* ===== 3. SELECIONAR PEDIDO (Visualizar Detalhes) ===== */
function selecionarPedido(pedido) {
    pedidoAtivo = pedido;

    // --- CORREÇÃO: Usar as variáveis certas do Banco de Dados ---
    document.getElementById('pedidoNumero').innerText = pedido.id;      // Era .numero
    document.getElementById('pedidoAddNumero').innerText = pedido.id;   // Era .numero
    
    // Proteção se cliente for nulo
    document.getElementById('pedidoCliente').innerText = pedido.cliente ? pedido.cliente.nome : 'N/A';

    renderPedidoDetalhes();
    renderPedidos(); // Atualiza a lista (para pintar o card de ativo)
}

// Função auxiliar para desenhar os itens do pedido selecionado
function renderPedidoDetalhes() {
    const lista = document.getElementById('listaItens');
    lista.innerHTML = '';
    let total = 0;

    if (!pedidoAtivo || !pedidoAtivo.itens) {
        lista.innerHTML = '<p class="vazio">Sem itens</p>';
        return;
    }

    pedidoAtivo.itens.forEach(i => {
        // No banco, o nome do produto fica dentro do objeto 'produto'
        const nomeProd = i.produto ? i.produto.nome : 'Item';
        const sub = i.quantidade * i.precoUnitarioVenda;
        total += sub;

        lista.innerHTML += `
            <div class="item">
                <span>${i.quantidade}x ${nomeProd}</span>
                <span>R$ ${sub.toFixed(2)}</span>
            </div>
        `;
    });

    if (pedidoAtivo.itens.length === 0) {
        lista.innerHTML = '<p class="vazio">Nenhum item adicionado</p>';
    }

    // Atualiza o total visual
    document.getElementById('pedidoTotal').innerText = total.toFixed(2);
}

/* ===== 4. ADICIONAR ITEM AO PEDIDO (CONECTADO À API) ===== */
/* ===== 4. ADICIONAR ITEM AO PEDIDO (CORRIGIDO) ===== */
async function adicionarAoPedido() {
    if (!pedidoAtivo) {
        alert("Selecione um pedido primeiro");
        return;
    }

    const select = document.getElementById('selectProduto');
    const qtd = Number(document.getElementById('qtdPedido').value);
    const idProduto = select.value;

    if (idProduto === '' || qtd <= 0) {
        alert("Selecione um produto e informe a quantidade");
        return;
    }

    // --- AQUI ESTÁ A CORREÇÃO PRINCIPAL ---
    const payload = {
        produtoId: parseInt(idProduto),
        quantidade: qtd,
        precoPersonalizado: precoOverride // <--- ENVIA O PREÇO DO CHOPP AQUI
    };

    try {
        const res = await fetch(`${API_URL}/pedidos/${pedidoAtivo.id}/itens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            await atualizarPedidoAtivo(pedidoAtivo.id);
            await renderPedidos(); 

            // Limpa campos
            select.value = '';
            document.getElementById('qtdPedido').value = '';
        } else {
            const msg = await res.text();
            alert("Erro: " + msg);
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão.");
    } finally {
        // ZERA O PREÇO PARA NÃO BUGAR O PRÓXIMO PEDIDO
        precoOverride = 0; 
    }
}
// Busca o pedido atualizado do banco para atualizar a lista de itens na hora
async function atualizarPedidoAtivo(id) {
    const response = await fetch(`${API_URL}/pedidos`);
    const pedidos = await response.json();
    const pedidoAtualizado = pedidos.find(p => p.id === id);
    
    if (pedidoAtualizado) {
        pedidoAtivo = pedidoAtualizado;
        renderPedidoDetalhes();
    }
}

/* ==================================================
   LÓGICA DO MODAL DE EDIÇÃO (FALTAVA ISSO!)
   ================================================== */

function abrirModalEditar() {
    // 1. Verifica se tem um pedido selecionado
    if (!pedidoAtivo) {
        alert("Clique em um pedido na lista para editar!");
        return;
    }

    console.log("Abrindo edição para o pedido:", pedidoAtivo.id); // Debug no console

    // 2. Preenche o número do pedido no título do modal
    const elementoTitulo = document.getElementById('tituloEditarPedido');
    if (elementoTitulo) {
        elementoTitulo.innerText = pedidoAtivo.id;
    }
    
    // 3. Desenha os itens na tela
    renderizarItensEdicao();
    
    // 4. Mostra o modal (AQUI É QUE A MÁGICA ACONTECE)
    const modal = document.getElementById('modalEditar');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        alert("Erro: Modal de edição não encontrado no HTML!");
    }
}

function fecharModalEditar() {
    document.getElementById('modalEditar').style.display = 'none';
}

// Função que desenha a lista com botões + e - dentro do modal
function renderizarItensEdicao() {
    const lista = document.getElementById('listaItensEdicao');
    lista.innerHTML = '';

    // Se não tiver itens, avisa
    if (!pedidoAtivo || !pedidoAtivo.itens || pedidoAtivo.itens.length === 0) {
        lista.innerHTML = '<p style="text-align:center; padding:20px;">Este pedido não tem itens.</p>';
        return;
    }

    // Desenha cada item com os botões
    pedidoAtivo.itens.forEach(item => {
        // Proteção caso o produto venha nulo
        const nomeProd = item.produto ? item.produto.nome : 'Produto Indefinido';
        const preco = item.precoUnitarioVenda || 0;
        
        lista.innerHTML += `
            <div class="item-editar-card" style="border-bottom:1px solid #ddd; padding:10px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
                <div style="flex: 1;">
                    <strong>${nomeProd}</strong><br>
                    <small>R$ ${preco.toFixed(2)} un.</small>
                </div>

                <div class="controles-qtd" style="display:flex; align-items:center; gap:10px;">
                    <button class="btn-mini btn-menos" style="background:red; color:white; width:30px; height:30px; border:none; border-radius:50%; font-weight:bold; cursor:pointer;" 
                        onclick="alterarQuantidadeItem(${item.id}, ${item.produtoId}, -1, ${item.quantidade})">-</button>
                    
                    <span class="qtd-display" style="font-size:1.2em; font-weight:bold; width:30px; text-align:center;">${item.quantidade}</span>
                    
                    <button class="btn-mini btn-mais" style="background:green; color:white; width:30px; height:30px; border:none; border-radius:50%; font-weight:bold; cursor:pointer;" 
                        onclick="alterarQuantidadeItem(${item.id}, ${item.produtoId}, 1, ${item.quantidade})">+</button>

                    <button class="btn-mini btn-lixo" style="background:#333; color:white; padding:5px 10px; border:none; border-radius:4px; margin-left:10px; cursor:pointer;" 
                        onclick="removerItemCompleto(${item.id})">🗑️</button>
                </div>
            </div>
        `;
    });
}

/* --- AÇÃO DE AUMENTAR OU DIMINUIR QUANTIDADE --- */
/* --- AÇÃO DE AUMENTAR OU DIMINUIR QUANTIDADE (COM PUT) --- */
async function alterarQuantidadeItem(idItemPedido, idProduto, delta, qtdAtual) {
    // Calcula a nova quantidade desejada
    const novaQtd = qtdAtual + delta;

    // 1. Se for diminuir para zero, cai na lógica de remover
    if (novaQtd <= 0) {
        removerItemCompleto(idItemPedido);
        return;
    }

    try {
        // AGORA USAMOS O PUT (EDITAR)
        const payload = { 
            produtoId: idProduto, // O Backend pede, mas vai ignorar se a lógica for só qtd
            quantidade: novaQtd 
        };

        const res = await fetch(`${API_URL}/pedidos/${pedidoAtivo.id}/itens/${idItemPedido}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            // Sucesso! Atualiza a tela
            await atualizarPedidoAtivo(pedidoAtivo.id);
            
            // Se o modal estiver aberto, redesenha ele
            const modalEdit = document.getElementById('modalEditar');
            if(modalEdit && modalEdit.style.display === 'flex') {
                renderizarItensEdicao(); 
            }

            renderPedidos(); // Atualiza o fundo (cards)
        } else {
            const msg = await res.text();
            alert("Erro: " + msg); // Mostra erro de estoque se houver
        }

    } catch (error) {
        console.error("Erro ao alterar qtd:", error);
        alert("Erro de conexão.");
    }
}
/* --- AÇÃO DE REMOVER O ITEM INTEIRO (LIXEIRA) --- */
async function removerItemCompleto(idItemPedido) {
    if(!confirm("Remover este item do pedido?")) return;

    try {
        const res = await fetch(`${API_URL}/pedidos/${pedidoAtivo.id}/itens/${idItemPedido}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            await atualizarPedidoAtivo(pedidoAtivo.id);
            renderizarItensEdicao(); // Atualiza o modal
            renderPedidos(); // Atualiza a lista principal
        } else {
            alert("Erro ao remover. O pedido pode estar pago ou fechado.");
        }
    } catch (erro) {
        console.error(erro);
        alert("Erro de conexão.");
    }
}
/* ===== 5. CARREGAR PRODUTOS (MODIFICADA) ===== */
async function carregarProdutosNoSelect() {
    try {
        const response = await fetch(`${API_URL}/produto`);
        if (!response.ok) throw new Error('Falha ao buscar produtos');
        
        // Salva na variável global para não precisar ir no banco toda hora que clicar no filtro
        todosProdutosCache = await response.json();

        // Inicializa mostrando TODOS
        filtrarProdutos('TODOS', document.querySelector('.btn-filtro.ativo'));

    } catch (error) {
        console.error("Erro produtos:", error);
    }
}

/* ===== NOVA FUNÇÃO DE FILTRO ===== */
function filtrarProdutos(tipo, botaoClicado) {
    const select = document.getElementById('selectProduto');
    select.innerHTML = '<option value="">Selecione um produto</option>';

    // 1. Atualiza visual dos botões (Tira cor de todos, põe cor no clicado)
    if (botaoClicado) {
        document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('ativo'));
        botaoClicado.classList.add('ativo');
    }

    // 2. Filtra a lista global
    const listaFiltrada = todosProdutosCache.filter(p => {
        // Se for TODOS, retorna sempre true. Se não, compara o tipo.
        // O .toUpperCase() garante que "Bebida" seja igual a "BEBIDA"
        if (tipo === 'TODOS') return true;
        
        // Verifica se p.tipo existe antes de tentar comparar
        return p.tipo && p.tipo.toUpperCase() === tipo.toUpperCase();
    });

    // 3. Preenche o Select
    listaFiltrada.forEach(p => {
        if (p.ativo) {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = `${p.nome} - R$ ${p.valorVenda.toFixed(2)}`;
            select.appendChild(option);
        }
    });

    if (listaFiltrada.length === 0) {
        const option = document.createElement('option');
        option.textContent = "Nenhum produto nessa categoria";
        select.appendChild(option);
    }
}
async function confirmarPagamento() {
    const metodo = document.getElementById('selectPagamento').value;

    if (!metodo) {
        alert("Selecione a forma de pagamento.");
        return;
    }

    const total = pedidoAtivo.valorTotal;
    let valorTaxa = 0;

    // --- AQUI ESTÁ A AUTOMAÇÃO (CONFIGURE SUAS PORCENTAGENS) ---
    // Exemplo: 
    // Crédito = 4.99% (0.0499)
    // Débito = 1.99% (0.0199)
    // Pix/Dinheiro = 0%

    if (metodo === 'CREDITO') {
        valorTaxa = total * 0.035; // 5% de taxa
    } 
    else if (metodo === 'DEBITO') {
        valorTaxa = total * 0.015; // 2% de taxa
    }
    else {
        valorTaxa = 0; // PIX e DINHEIRO não tem taxa
    }

    // Pergunta de confirmação (mostra o valor final para o garçom conferir)
    if (!confirm(`Confirmar pagamento de R$ ${total.toFixed(2)} no ${metodo}?`)) {
        return;
    }

    // Empacota os dados para enviar ao Backend
    const payload = {
        metodo: metodo,
        taxa: parseFloat(valorTaxa.toFixed(2)) // Envia a taxa calculada automaticamente
    };

    try {
        const response = await fetch(`${API_URL}/pedidos/${pedidoAtivo.id}/pagar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Pagamento Realizado!");
            fecharModalPagamento();
            pedidoAtivo = null;
            renderPedidos(); 
        } else {
            const msg = await response.text();
            alert("Erro ao processar: " + msg);
        }

    } catch (error) {
        console.error(error);
        alert("Erro de conexão.");
    }
}

async function pesquisarCliente(termo) {
    const dataList = document.getElementById('sugestoesClientes');
    const inputNome = document.getElementById('clienteNome');

    // 1. Se o campo estiver vazio ou muito curto, limpa tudo
    if (!termo || termo.length < 2) {
        listaClientesEncontrados = [];
        dataList.innerHTML = '';
        return;
    }

    // 2. Verifica se o usuário acabou de selecionar uma opção da lista
    // (Se o que ele digitou é exatamente igual ao telefone de alguém que já buscamos)
    const clienteJaCarregado = listaClientesEncontrados.find(c => c.telefone === termo || c.nome === termo);
    
    if (clienteJaCarregado) {
        // PREENCHE AUTOMATICAMENTE
        inputNome.value = clienteJaCarregado.nome;
        inputNome.disabled = true;
        inputNome.style.backgroundColor = "#e0ffe0"; // Verde
        clienteIdSelecionado = clienteJaCarregado.id;
        return; // Não precisa buscar no banco se já achou
    }

    // 3. Se não é uma seleção, então BUSCA NO BANCO
    try {
        // Zera o ID enquanto digita (para evitar usar ID errado)
        clienteIdSelecionado = null;
        inputNome.disabled = false;
        inputNome.style.backgroundColor = "white";

        const response = await fetch(`${API_URL}/cliente/pesquisar/${termo}`);
        if (response.ok) {
            listaClientesEncontrados = await response.json();
            
            dataList.innerHTML = ''; // Limpa opções antigas

            listaClientesEncontrados.forEach(c => {
                const option = document.createElement('option');
                
                // O value é o que vai para dentro do input quando clica
                option.value = c.telefone; 
                
                // O texto auxiliar (aparece cinza no Chrome)
                option.label = c.nome; 
                
                dataList.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Erro na busca:", error);
    }
}
function imprimirComanda() {
    // Pega o elemento correto pelo ID que está no seu HTML (pedidoTotal)
    const elementoTotal = document.getElementById('pedidoTotal');
    
    // Proteção: Se por acaso não achar o elemento, imprime mesmo assim para não travar
    if (!elementoTotal) {
        console.warn("Elemento de total não encontrado, imprimindo direto...");
        window.print();
        return;
    }

    const totalTexto = elementoTotal.innerText;

    // Se o total for 0,00, avisa e não imprime
    if (totalTexto === "0,00" || totalTexto === "R$ 0,00") {
        alert("O pedido está vazio! Adicione itens antes de imprimir.");
        return;
    }

    // Manda imprimir
    window.print();
}
/* ==================================================
   ATUALIZAÇÃO AUTOMÁTICA (AUTO-REFRESH)
   ================================================== */
// Executa a cada 5 segundos (5000 milissegundos)
setInterval(() => {
    // Chama a função que busca os pedidos no banco
    // ATENÇÃO: Verifique se o nome da sua função é 'carregarPedidos' ou 'listarPedidos'
    if (typeof renderPedidos === "function") {
        renderPedidos(); 
    } else {
        // Se você não souber o nome da função, use o recarregamento da página (mais bruto)
        // Mas cuidado: isso pode atrapalhar se você estiver digitando algo no notebook
        // location.reload(); 
    }
}, 15000);

/* ==================================================
   LÓGICA DO CHOPP (BOTÕES RÁPIDOS)
   ================================================== */

/* ==================================================
   LÓGICA DO CHOPP (LIMPA)
   ================================================== */

function verificarSeEhChopp() {
    const select = document.getElementById('selectProduto');
    const areaAtalhos = document.getElementById('atalhosChopp');
    const inputQtd = document.getElementById('qtdPedido');
    
    // Pega o texto do item selecionado
    // (Proteção: se nada selecionado, texto vazio)
    const textoOpcao = select.selectedIndex >= 0 ? select.options[select.selectedIndex].text : "";

    // Verifica se é Chopp
    if (textoOpcao.toLowerCase().includes('chopp') || textoOpcao.toLowerCase().includes('chop')) {
        // MOSTRA OS ATALHOS
        areaAtalhos.style.display = 'flex'; 
        inputQtd.placeholder = "Litros (ex: 0.3)";
        inputQtd.focus(); // Já põe o cursor lá
    } else {
        // ESCONDE OS ATALHOS (Volta ao normal)
        areaAtalhos.style.display = 'none'; 
        inputQtd.placeholder = "Qtd";
        inputQtd.value = ""; // Limpa se trocou de produto
    }
}


// INICIALIZAÇÃO
document.addEventListener("DOMContentLoaded", () => {
    carregarProdutosNoSelect();
    renderPedidos();
});