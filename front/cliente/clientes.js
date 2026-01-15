const API_URL = "http://localhost:5186/api"; 
let listaGlobalClientes = [];

// 1. CARREGAR CLIENTES
async function carregarClientes() {
    try {
        const res = await fetch(`${API_URL}/cliente`);
        listaGlobalClientes = await res.json();
        renderizarTabela(listaGlobalClientes);
    } catch (error) {
        console.error("Erro ao buscar clientes", error);
    }
}

// 2. RENDERIZAR TABELA
function renderizarTabela(lista) {
    const tbody = document.getElementById('tabelaClientes');
    tbody.innerHTML = '';

    lista.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td>${c.id}</td>
                <td>${c.nome}</td>
                <td>${c.telefone}</td>
                <td>${c.endereco || '-'}</td>
                <td style="text-align: center;">
                    <button class="btn-hist" onclick="verHistorico(${c.id}, '${c.nome}')">Historico Pedidos</button>
                    <button class="btn-editar" onclick="abrirEdicao(${c.id})">Editar</button>
                    <button class="btn-apagar" onclick="excluirCliente(${c.id})">Apagar</button>
                </td>
            </tr>
        `;
    });
}

// 3. FILTRO DE PESQUISA (LOCAL)
function filtrarTabela() {
    const termo = document.getElementById('campoBusca').value.toLowerCase();
    
    const filtrados = listaGlobalClientes.filter(c => 
        c.nome.toLowerCase().includes(termo) || 
        c.telefone.includes(termo)
    );

    renderizarTabela(filtrados);
}

// 4. LÓGICA DE EDIÇÃO
function abrirEdicao(id) {
    const cliente = listaGlobalClientes.find(c => c.id === id);
    document.getElementById('editId').value = cliente.id;
    document.getElementById('editNome').value = cliente.nome;
    document.getElementById('editTelefone').value = cliente.telefone;
    document.getElementById('editEndereco').value = cliente.endereco;
    
    document.getElementById('modalEditar').style.display = 'flex';
}

async function salvarEdicao() {
    const id = document.getElementById('editId').value;
    const dados = {
        id: parseInt(id),
        nome: document.getElementById('editNome').value,
        telefone: document.getElementById('editTelefone').value,
        endereco: document.getElementById('editEndereco').value
    };

    try {
        const res = await fetch(`${API_URL}/cliente/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (res.ok) {
            alert("Cliente atualizado!");
            fecharModais();
            carregarClientes();
        } else {
            alert("Erro ao atualizar.");
        }
    } catch (error) { console.error(error); }
}

// 5. LÓGICA DE EXCLUSÃO
async function excluirCliente(id) {
    if (!confirm("Tem certeza? Isso apaga o cliente para sempre.")) return;

    try {
        const res = await fetch(`${API_URL}/cliente/${id}`, { method: 'DELETE' });
        
        if (res.ok) {
            alert("Cliente apagado.");
            carregarClientes();
        } else {
            // Aqui capturamos aquele erro do Backend se ele tiver pedidos
            const msg = await res.text();
            alert("Não foi possível apagar: " + msg);
        }
    } catch (error) { console.error(error); }
}

// 6. LÓGICA DE HISTÓRICO (AQUI ESTÁ O QUE VOCÊ PEDIU)
async function verHistorico(id, nome) {
    document.getElementById('nomeClienteHist').innerText = nome;
    const divLista = document.getElementById('listaHistorico');
    divLista.innerHTML = 'Carregando...';
    
    document.getElementById('modalHistorico').style.display = 'flex';

    try {
        // Chama a rota especial que criamos no PedidosController
        const res = await fetch(`${API_URL}/pedidos/cliente/${id}`);
        const pedidos = await res.json();

        divLista.innerHTML = '';

        if (pedidos.length === 0) {
            divLista.innerHTML = '<p>Este cliente nunca fez pedidos.</p>';
            return;
        }

        pedidos.forEach(p => {
            // Formata data
            const data = new Date(p.dataPedido).toLocaleDateString('pt-BR');
            const hora = new Date(p.dataPedido).toLocaleTimeString('pt-BR');

            // Cor do status
            let corStatus = p.status === 'PAGO' ? 'green' : 'orange';

            divLista.innerHTML += `
                <div class="item-hist">
                    <strong>Pedido #${p.id}</strong> - ${data} às ${hora}<br>
                    Status: <span style="color:${corStatus}; font-weight:bold">${p.status}</span><br>
                    Total: <strong>R$ ${p.valorTotal.toFixed(2)}</strong>
                </div>
            `;
        });

    } catch (error) {
        console.error(error);
        divLista.innerHTML = 'Erro ao carregar histórico.';
    }
}

// Auxiliar
function fecharModais() {
    document.getElementById('modalEditar').style.display = 'none';
    document.getElementById('modalHistorico').style.display = 'none';
}

// Iniciar
carregarClientes();