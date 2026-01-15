const API_URL = "/api";
let pedidoAtivo = null;
let clienteIdSelecionado = null;
let todosProdutosCache = []; // Guarda a lista completa vinda do banco

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
    lista.innerHTML = '<p style="color:white; padding:10px;">Carregando...</p>';

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

    // --- CORREÇÃO: Usar FETCH para o Back-end (Nada de localStorage!) ---
    const payload = {
        produtoId: parseInt(idProduto),
        quantidade: qtd
    };

    try {
        const res = await fetch(`${API_URL}/pedidos/${pedidoAtivo.id}/itens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            // Recarrega TUDO para garantir sincronia com o banco
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

/* ===== 5. CARREGAR SELECT DE PRODUTOS ===== */


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
        alert("Por favor, selecione a forma de pagamento.");
        return;
    }

    if (!confirm(`Confirma o pagamento de R$ ${pedidoAtivo.valorTotal.toFixed(2)} no ${metodo}?`)) {
        return;
    }

    try {
        // Envia ao backend: /api/pedidos/5/pagar?metodo=PIX
        const response = await fetch(`${API_URL}/pedidos/${pedidoAtivo.id}/pagar?metodo=${metodo}`, {
            method: 'PUT'
        });

        if (response.ok) {
            alert("Pagamento Realizado com Sucesso!");
            
            fecharModalPagamento();
            
            // Limpa a seleção da tela
            pedidoAtivo = null;
            document.getElementById('pedidoNumero').innerText = "-";
            document.getElementById('pedidoCliente').innerText = "-";
            document.getElementById('listaItens').innerHTML = '<p class="vazio">Nenhum item adicionado</p>';
            document.getElementById('pedidoTotal').innerText = "0,00";

            // Atualiza a lista (O pedido vai sumir pois agora é status PAGO)
            renderPedidos();
        } else {
            alert("Erro ao processar pagamento.");
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

// INICIALIZAÇÃO
document.addEventListener("DOMContentLoaded", () => {
    carregarProdutosNoSelect();
    renderPedidos();
});