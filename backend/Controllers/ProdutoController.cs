using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Espeto.Data;
using Espeto.Models;

namespace Espeto.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProdutoController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ProdutoController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/produto (Lista todos)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Produto>>> GetProdutos()
        {
            return await _context.Produtos.ToListAsync();
        }

        // POST: api/produto (Cria novo produto)
        [HttpPost]
        public async Task<ActionResult<Produto>> PostProduto(Produto produto)
        {
            // Inicia com saldo zero se não informado
            if (produto.SaldoEstoque < 0) produto.SaldoEstoque = 0;
            
            _context.Produtos.Add(produto);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetProdutos), new { id = produto.Id }, produto);
        }

        // PUT: api/produto/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutProduto(int id, Produto produto)
        {
            if (id != produto.Id) return BadRequest();

            // Mantém o estoque e custo original, altera apenas dados cadastrais
            var prodBanco = await _context.Produtos.FindAsync(id);
            if (prodBanco == null) return NotFound();

            prodBanco.Nome = produto.Nome;
            prodBanco.Tipo = produto.Tipo;
            prodBanco.ValorVenda = produto.ValorVenda;
            
            // Permite editar Ativo/Inativo
            prodBanco.Ativo = produto.Ativo; 

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // POST: api/produto/5/estoque (Adicionar Estoque e Calcula Média)
        [HttpPost("{id}/estoque")]
        public async Task<IActionResult> AdicionarEstoque(int id, [FromBody] EntradaEstoqueDto entrada)
        {
            var produto = await _context.Produtos.FindAsync(id);
            if (produto == null) return NotFound("Produto não encontrado.");

            // 1. Calcular valor total do estoque ATUAL
            // CORREÇÃO: Converter SaldoEstoque (double) para decimal na conta
            decimal valorTotalAtual = (decimal)produto.SaldoEstoque * produto.CustoMedio;

            // 2. Calcular valor da NOVA entrada
            // CORREÇÃO: Converter entrada.Quantidade (double) para decimal
            decimal valorNovaEntrada = (decimal)entrada.Quantidade * entrada.ValorPagoUnitario;

            // 3. Novo Saldo de Quantidade
            // CORREÇÃO: Agora a soma resulta em double (ex: 50.0 + 0.5)
            double novoSaldoQtd = produto.SaldoEstoque + entrada.Quantidade;

            // 4. Novo Custo Médio (Total em R$ / Total em Qtd)
            if (novoSaldoQtd > 0)
            {
                // CORREÇÃO: Dividir pelo novo saldo convertido para decimal
                produto.CustoMedio = (valorTotalAtual + valorNovaEntrada) / (decimal)novoSaldoQtd;
            }

            // 5. Atualiza Estoque
            produto.SaldoEstoque = novoSaldoQtd;

            await _context.SaveChangesAsync();

            return Ok(new { mensagem = "Estoque atualizado!", novoSaldo = novoSaldoQtd, novoCustoMedio = produto.CustoMedio });
        }
    }

    // DTO simples para receber os dados do JSON sem sujar a classe principal
    public class EntradaEstoqueDto
    {
        // CORREÇÃO: Mudado de int para double para aceitar 0.5, 1.5, etc.
        public double Quantidade { get; set; }
        public decimal ValorPagoUnitario { get; set; }
    }
}