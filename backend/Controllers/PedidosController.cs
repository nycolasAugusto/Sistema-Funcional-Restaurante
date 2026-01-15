using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Espeto.Data;
using Espeto.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Espeto.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PedidosController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PedidosController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/pedidos
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Pedido>>> GetPedidos()
        {
            return await _context.Pedidos
                .Include(p => p.Cliente)
                .Include(p => p.Itens)
                .ThenInclude(i => i.Produto)
                .OrderByDescending(p => p.Id) // Mais recentes primeiro
                .ToListAsync();
        }

        // POST: api/pedidos (Criar Pedido Novo)
        [HttpPost]
        public async Task<ActionResult<Pedido>> PostPedido(CriarPedidoDto dto)
        {
            // Valida se o cliente existe
            var clienteExiste = await _context.Clientes.AnyAsync(c => c.Id == dto.ClienteId);
            if (!clienteExiste)
            {
                return BadRequest($"Cliente {dto.ClienteId} não encontrado.");
            }

            // 1. Cria o Pedido (Cabeçalho)
            var pedido = new Pedido
            {
                ClienteId = dto.ClienteId, // <--- USA O ID, NÃO O NOME
                DataPedido = DateTime.Now,
                Status = "ABERTO",
                Itens = new List<ItemPedido>()
            };

            decimal totalPedido = 0;

            // 2. Processa os Itens
            foreach (var itemDto in dto.Itens)
            {
                var produto = await _context.Produtos.FindAsync(itemDto.ProdutoId);

                if (produto == null) return BadRequest($"Produto {itemDto.ProdutoId} não encontrado.");
                
                if (produto.SaldoEstoque < itemDto.Quantidade) 
                    return BadRequest($"Estoque insuficiente para: {produto.Nome}");

                // Cria o Item do Pedido
                var novoItem = new ItemPedido
                {
                    ProdutoId = produto.Id,
                    Quantidade = itemDto.Quantidade,
                    
                    // --- FINANCEIRO ---
                    PrecoUnitarioVenda = produto.ValorVenda, 
                    CustoUnitario = produto.CustoMedio // Grava o custo aqui!
                };

                // Atualiza totais e estoque
                totalPedido += (novoItem.PrecoUnitarioVenda * novoItem.Quantidade);
                produto.SaldoEstoque -= itemDto.Quantidade;

                pedido.Itens.Add(novoItem);
            }

            pedido.ValorTotal = totalPedido;

            _context.Pedidos.Add(pedido);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetPedidos), new { id = pedido.Id }, pedido);
        }

        // POST: api/pedidos/5/itens (Adicionar Item Extra)
        [HttpPost("{id}/itens")]
        public async Task<IActionResult> AdicionarItemAoPedido(int id, [FromBody] ItemPedidoDto itemDto)
        {
            var pedido = await _context.Pedidos.Include(p => p.Itens).FirstOrDefaultAsync(p => p.Id == id);
            if (pedido == null) return NotFound("Pedido não encontrado.");

            if (pedido.Status == "PAGO" || pedido.Status == "CANCELADO") 
                return BadRequest("Pedido fechado não aceita itens.");

            var produto = await _context.Produtos.FindAsync(itemDto.ProdutoId);
            if (produto == null) return BadRequest("Produto não existe.");
            
            if (produto.SaldoEstoque < itemDto.Quantidade) 
                return BadRequest($"Estoque insuficiente. Restam {produto.SaldoEstoque}.");

            produto.SaldoEstoque -= itemDto.Quantidade;

            var novoItem = new ItemPedido
            {
                PedidoId = id,
                ProdutoId = produto.Id, // Mudei para usar ID direto, é mais seguro
                Quantidade = itemDto.Quantidade,
                
                // --- FINANCEIRO NO ITEM EXTRA TAMBÉM ---
                PrecoUnitarioVenda = produto.ValorVenda,
                CustoUnitario = produto.CustoMedio 
            };

            pedido.ValorTotal += (novoItem.Quantidade * novoItem.PrecoUnitarioVenda);
            
            _context.ItensPedido.Add(novoItem); // Adiciona direto na tabela de itens
            // pedido.Itens.Add(novoItem); // (Opcional se já salvou no contexto acima)
            
            await _context.SaveChangesAsync();

            return Ok(new { mensagem = "Item adicionado!", novoTotal = pedido.ValorTotal });
        }

        [HttpGet("cliente/{clienteId}")]
        public async Task<ActionResult<IEnumerable<Pedido>>> GetPedidosPorCliente(int clienteId)
        {
            return await _context.Pedidos
                .Include(p => p.Itens)
                .Where(p => p.ClienteId == clienteId)
                .OrderByDescending(p => p.DataPedido)
                .ToListAsync();
        }

        [HttpPut("{id}/pagar")]
        public async Task<IActionResult> ConfirmarPagamento(int id, [FromQuery] string metodo)
        {
            var pedido = await _context.Pedidos.FindAsync(id);
            if (pedido == null) return NotFound();

            if (string.IsNullOrEmpty(metodo)) 
                return BadRequest("Informe o método de pagamento.");

            pedido.Status = "PAGO";
            pedido.MetodoPagamento = metodo;
            pedido.DataPagamento = DateTime.Now;
            
            await _context.SaveChangesAsync();
            return Ok(new { mensagem = "Pedido pago com sucesso!" });
        }
    }

    // --- DTOs ATUALIZADOS ---
    public class CriarPedidoDto
    {
        // Corrigido: Usa ID do cliente
        public int ClienteId { get; set; } 
        public List<ItemPedidoDto> Itens { get; set; }
    }

    public class ItemPedidoDto
    {
        public int ProdutoId { get; set; }
        public int Quantidade { get; set; }
    }
}