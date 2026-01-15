// --- CONFIGURAÇÃO ---
const SENHA_CORRETA = "1234"; 

function irParaComanda() {
    // Redireciona para a pasta de comandas
    window.location.href = "../comanda/index.html";
}

function fazerLogin() {
    const input = document.getElementById('inputSenha');
    const msg = document.getElementById('msgErro');
    const areaLogin = document.getElementById('loginArea');
    const menuAdmin = document.getElementById('menuAdmin');

    if (input.value === SENHA_CORRETA) {
        // Senha Certa
        msg.innerText = "";
        areaLogin.classList.add('hidden'); // Esconde a senha
        menuAdmin.classList.remove('hidden'); // Mostra os links
    } else {
        // Senha Errada
        msg.innerText = "Senha incorreta!";
        input.value = "";
        input.focus();
        
        // Efeito de tremer (opcional, visual)
        input.style.border = "1px solid red";
        setTimeout(() => input.style.border = "1px solid #ccc", 1000);
    }
}

function fazerLogout() {
    document.getElementById('inputSenha').value = "";
    document.getElementById('loginArea').classList.remove('hidden');
    document.getElementById('menuAdmin').classList.add('hidden');
}

// Permite apertar ENTER para entrar
function verificarEnter(event) {
    if (event.key === "Enter") {
        fazerLogin();
    }
}