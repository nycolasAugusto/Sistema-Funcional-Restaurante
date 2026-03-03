// --- CONFIGURAÇÃO ---
const API_URL = "/api";

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
                <td style="${corEstoque}">${parseFloat(p.saldoEstoque.toFixed(3))}</td>
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
    console.log("PASSO 1: Botão clicado! Iniciando salvamento...");

    try {
        const id = document.getElementById('prodId')?.value;
        const nome = document.getElementById('nome')?.value;
        const campoTipo = document.getElementById('novoTipo')?.value;
        const valorVenda = document.getElementById('valorVenda')?.value;
        
        const checkAtivo = document.getElementById('produtoAtivo');
        const estaAtivo = checkAtivo ? checkAtivo.checked : true;

        console.log("PASSO 2: Dados básicos lidos da tela.");

        // --- LÊ A CAIXINHA DE DERIVADO ---
        const chkDerivado = document.getElementById('chkDerivado');
        const isDerivado = chkDerivado ? chkDerivado.checked : false;
        let paiId = null;

        if (isDerivado) {
            paiId = document.getElementById('selProdutoPai')?.value;
            if (!paiId) {
                alert("Selecione o produto base de onde sairá o estoque!");
                return;
            }
        }

        console.log("PASSO 3: Validação do produto derivado passou.");

        // --- MONTA OS DADOS ---
        const dados = {
            id: id ? parseInt(id) : 0,
            nome: nome,
            tipo: campoTipo,
            valorVenda: parseFloat(valorVenda || 0),
            ativo: estaAtivo,
            produtoPaiId: paiId ? parseInt(paiId) : null
        };

        // Se for produto novo, pega estoque e custo
        if (!id || id === "0" || id === "") {
            const elQtd = document.getElementById('qtdInicial');
            const elCusto = document.getElementById('custoInicial');
            
            dados.saldoEstoque = isDerivado ? 0 : parseInt(elQtd?.value || 0);
            dados.custoMedio = parseFloat(elCusto?.value || 0);
        }

        console.log("PASSO 4: Objeto pronto para enviar pro C#:", dados);

        // --- ENVIA PARA O SERVIDOR ---
        const metodo = dados.id ? 'PUT' : 'POST';
        const url = dados.id ? `${API_URL}/produto/${dados.id}` : `${API_URL}/produto`;
        
        console.log(`PASSO 5: Fazendo requisição ${metodo} para a URL: ${url}`);

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
            alert("ERRO DO BACKEND (C#):\n" + erroTexto);
            console.error("Erro do Backend:", erroTexto);
        }

    } catch (erroGrave) { 
        console.error("❌ ERRO GRAVE NO JAVASCRIPT:", erroGrave);
        alert("Ocorreu um erro na tela. Abra o F12 e veja a aba Console!");
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
function toggleDerivado() {
    const isDerivado = document.getElementById('chkDerivado').checked;
    const areaPai = document.getElementById('areaProdutoPai');
    const areaEstoque = document.getElementById('areaEstoqueInicial');

    if (isDerivado) {
        areaPai.style.display = 'block';
        if(areaEstoque) areaEstoque.style.display = 'none'; // Filho não tem estoque inicial
        carregarSelectPais();
    } else {
        areaPai.style.display = 'none';
        if(areaEstoque) areaEstoque.style.display = 'block';
    }
}

// Preenche o Select apenas com produtos que NÃO SÃO derivados (Os Pais)
function carregarSelectPais() {
    const select = document.getElementById('selProdutoPai');
    select.innerHTML = '<option value="">Selecione a base...</option>';

    if(typeof listaGlobalProdutos !== 'undefined') {
        listaGlobalProdutos.forEach(p => {
            // Só lista se for ativo e NÃO tiver um pai (para não virar uma bagunça)
            if (p.ativo && !p.produtoPaiId) {
                select.innerHTML += `<option value="${p.id}">${p.nome} (Estoque: ${p.saldoEstoque})</option>`;
            }
        });
    }
}

// Iniciar
carregarProdutos();