// --- CONFIGURAÇÃO ---
const API_URL = "http://localhost:5186/api"; 

// Variáveis Globais
let listaGlobalProdutos = [];
let operacaoEstoqueAtual = 'ENTRADA'; // Define se é + ou -

// 1. Buscar Dados do Backend
async function carregarProdutos() {
    try {
        const response = await fetch(`${API_URL}/produto`);
        if (!response.ok) throw new Error('Erro ao buscar');
        
        listaGlobalProdutos = await response.json();
        filtrarTabela();

    } catch (error) {
        console.error("Erro ao carregar:", error);
    }
}

// 2. Filtrar e Desenhar
function filtrarTabela() {
    const tbody = document.getElementById('tabelaBody');
    
    // Filtros
    const elFiltroTipo = document.getElementById('filtroTipo'); 
    const filtroTipo = elFiltroTipo ? elFiltroTipo.value : "TODOS";
    const elStatus = document.getElementById('filtroStatus');
    const filtroStatus = elStatus ? elStatus.value : 'TODOS';

    tbody.innerHTML = '';

    listaGlobalProdutos.forEach(p => {
        // LÓGICA DE FILTRO
        if (filtroTipo !== "TODOS" && p.tipo !== filtroTipo) return;
        if (filtroStatus === "ATIVOS" && !p.ativo) return;
        if (filtroStatus === "INATIVOS" && p.ativo) return;

        // VISUAL
        const estilo = p.ativo ? '' : 'style="opacity: 0.6; background-color: #f0f0f0;"';
        
        // Estoque vermelho se zerado ou negativo
        const corEstoque = p.saldoEstoque <= 0 ? 'color:red; font-weight:bold;' : 'color:#333; font-weight:bold;';

        const textoStatus = p.ativo 
            ? '<span style="color:#28a745; font-weight:bold;">Ativo</span>' 
            : '<span style="color:#dc3545; font-weight:bold;">Inativo</span>';

        tbody.innerHTML += `
            <tr ${estilo}>
                <td>${p.nome}</td>
                <td>${p.tipo}</td>
                <td>R$ ${p.custoMedio ? p.custoMedio.toFixed(2) : '0.00'}</td>
                <td>R$ ${p.valorVenda.toFixed(2)}</td>
                <td style="${corEstoque}">${p.saldoEstoque}</td>
                <td>${textoStatus}</td>
                <td>
                    <button class="btn-editar" onclick="abrirEdicao(${p.id})">✏️</button>
                    
                    <button class="btn-saida" onclick="abrirEstoque(${p.id}, 'SAIDA')" title="Dar Baixa / Perda">-</button>
                    
                    <button class="btn-entrada" onclick="abrirEstoque(${p.id}, 'ENTRADA')" title="Nova Compra">+</button>
                </td>
            </tr>
        `;
    });
}

// 3. Funções de Modal
function fecharModais() {
    document.getElementById('modalCadastro').style.display = 'none';
    document.getElementById('modalEstoque').style.display = 'none';
}

function abrirModalCadastro() {
    document.getElementById('formCadastro').reset();
    document.getElementById('prodId').value = '';
    document.getElementById('tituloModalCadastro').innerText = 'Novo Produto';
    
    const checkAtivo = document.getElementById('produtoAtivo');
    if(checkAtivo) { checkAtivo.checked = true; checkAtivo.disabled = true; }

    document.getElementById('areaEstoqueInicial').style.display = 'block'; 
    document.getElementById('qtdInicial').required = true;
    document.getElementById('custoInicial').required = true;

    document.getElementById('modalCadastro').style.display = 'flex';
}

function abrirEdicao(id) {
    const p = listaGlobalProdutos.find(x => x.id == id);
    if (!p) return; 

    document.getElementById('prodId').value = p.id;
    document.getElementById('nome').value = p.nome;
    document.getElementById('novoTipo').value = p.tipo;
    document.getElementById('valorVenda').value = p.valorVenda;
    
    const checkAtivo = document.getElementById('produtoAtivo');
    if(checkAtivo) { checkAtivo.checked = p.ativo; checkAtivo.disabled = false; }

    document.getElementById('tituloModalCadastro').innerText = 'Editar Produto';
    document.getElementById('areaEstoqueInicial').style.display = 'none'; 
    document.getElementById('qtdInicial').required = false;
    document.getElementById('custoInicial').required = false;

    document.getElementById('modalCadastro').style.display = 'flex';
}

// --- LÓGICA DE ESTOQUE (Entrada e Saída) ---
function abrirEstoque(id, tipo) {
    const p = listaGlobalProdutos.find(x => x.id == id);
    if (!p) return;

    operacaoEstoqueAtual = tipo; // Guarda se é ENTRADA ou SAIDA

    document.getElementById('estoqueProdId').value = p.id;
    document.getElementById('nomeProdutoEstoque').innerText = `${p.nome} (Atual: ${p.saldoEstoque})`;
    
    // Reseta o formulário
    document.getElementById('formEstoque').reset();

    // Elementos da tela
    const divCusto = document.getElementById('divCustoEstoque');
    const titulo = document.getElementById('tituloModalEstoque');
    const btnSalvar = document.getElementById('btnSalvarEstoque');
    const inputCusto = document.getElementById('novoCusto');

    if (tipo === 'SAIDA') {
        // --- MODO SAÍDA ---
        titulo.innerText = "Registrar Saída / Perda";
        titulo.style.color = "#dc3545"; // Vermelho
        btnSalvar.innerText = "Confirmar Saída (-)";
        btnSalvar.style.backgroundColor = "#dc3545";
        
        divCusto.classList.add('oculto'); // Esconde campo de dinheiro
        inputCusto.required = false;
    } else {
        // --- MODO ENTRADA ---
        titulo.innerText = "Registrar Entrada / Compra";
        titulo.style.color = "#28a745"; // Verde
        btnSalvar.innerText = "Confirmar Entrada (+)";
        btnSalvar.style.backgroundColor = "#28a745";
        
        divCusto.classList.remove('oculto'); // Mostra campo dinheiro
        inputCusto.required = true;
    }

    document.getElementById('modalEstoque').style.display = 'flex';
}

// 4. Salvar Produto (Create / Update)
async function salvarProduto(e) {
    e.preventDefault();
    
    const id = document.getElementById('prodId').value;
    const campoTipo = document.getElementById('novoTipo');
    const checkAtivo = document.getElementById('produtoAtivo');
    const estaAtivo = checkAtivo ? checkAtivo.checked : true;

    const dados = {
        id: id ? parseInt(id) : 0,
        nome: document.getElementById('nome').value,
        tipo: campoTipo.value,
        valorVenda: parseFloat(document.getElementById('valorVenda').value),
        ativo: estaAtivo
    };

    if (!id) {
        dados.saldoEstoque = parseInt(document.getElementById('qtdInicial').value);
        dados.custoMedio = parseFloat(document.getElementById('custoInicial').value);
        dados.ativo = true; 
    }

    try {
        const metodo = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/produto/${id}` : `${API_URL}/produto`;
        
        const response = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (response.ok) {
            alert("Salvo com sucesso!");
            fecharModais();
            carregarProdutos(); 
        } else {
            const erroTexto = await response.text();
            alert("Erro ao salvar: " + erroTexto);
        }
    } catch (err) { 
        console.error(err);
        alert("Erro de conexão.");
    }
}

// 5. Salvar Estoque (Lógica Negativa na Saída)
async function salvarEstoque(e) {
    e.preventDefault();
    const id = document.getElementById('estoqueProdId').value;
    let qtd = Number(document.getElementById('novaQtd').value);
    let custo = Number(document.getElementById('novoCusto').value);

    // SE FOR SAÍDA, MULTIPLICA POR -1
    if (operacaoEstoqueAtual === 'SAIDA') {
        qtd = qtd * -1;
        custo = 0; // Saída não altera custo médio (simplificação)
    }

    const entradaDto = {
        quantidade: qtd,
        valorPagoUnitario: custo
    };

    try {
        const response = await fetch(`${API_URL}/produto/${id}/estoque`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entradaDto)
        });

        if (response.ok) {
            alert(operacaoEstoqueAtual === 'SAIDA' ? "Saída registrada!" : "Entrada registrada!");
            fecharModais();
            carregarProdutos();
        } else {
            alert("Erro ao movimentar estoque.");
        }
    } catch (error) { console.error(error); }
}

// Iniciar
carregarProdutos();