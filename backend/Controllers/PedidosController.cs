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
                ClienteId = dto.ClienteId,
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
                    CustoUnitario = produto.CustoMedio 
                };

                // CORREÇÃO: Cast explícito para (decimal) na quantidade
                totalPedido += (novoItem.PrecoUnitarioVenda * (decimal)novoItem.Quantidade);
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
                ProdutoId = produto.Id,
                Quantidade = itemDto.Quantidade,
                
                // --- FINANCEIRO ---
                PrecoUnitarioVenda = produto.ValorVenda,
                CustoUnitario = produto.CustoMedio 
            };

            // CORREÇÃO: Cast explícito para (decimal)
            pedido.ValorTotal += ((decimal)novoItem.Quantidade * novoItem.PrecoUnitarioVenda);
            
            _context.ItensPedido.Add(novoItem); 
            
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

        // PUT: api/pedidos/5/itens/10 (Editar Quantidade do Item)
        [HttpPut("{pedidoId}/itens/{itemId}")]
        public async Task<IActionResult> AtualizarItemPedido(int pedidoId, int itemId, [FromBody] ItemPedidoDto dto)
        {
            if (dto.Quantidade <= 0)
                return BadRequest("A quantidade deve ser maior que zero.");

            // 1. Busca o item e o produto (para mexer no estoque)
            var item = await _context.ItensPedido
                .Include(i => i.Produto)
                .FirstOrDefaultAsync(i => i.Id == itemId && i.PedidoId == pedidoId);

            if (item == null) return NotFound("Item não encontrado.");

            // 2. Busca o pedido para validar status e atualizar total
            var pedido = await _context.Pedidos.FindAsync(pedidoId);
            if (pedido.Status == "PAGO" || pedido.Status == "CANCELADO")
                return BadRequest("Pedido fechado não pode ser alterado.");

            // 3. LÓGICA DE ESTOQUE
            // CORREÇÃO: Usar double para a diferença
            double diferenca = dto.Quantidade - item.Quantidade;

            if (diferenca > 0) // Aumentando quantidade
            {
                if (item.Produto.SaldoEstoque < diferenca)
                    return BadRequest($"Estoque insuficiente. Só restam {item.Produto.SaldoEstoque}.");
                
                item.Produto.SaldoEstoque -= diferenca;
            }
            else if (diferenca < 0) // Diminuindo quantidade
            {
                item.Produto.SaldoEstoque += Math.Abs(diferenca); 
            }

            // 4. Atualiza o TOTAL do Pedido
            // CORREÇÃO: Cast explícito para (decimal)
            pedido.ValorTotal -= ((decimal)item.Quantidade * item.PrecoUnitarioVenda);
            pedido.ValorTotal += ((decimal)dto.Quantidade * item.PrecoUnitarioVenda);

            // Garante que não fique negativo por erro de arredondamento
            if (pedido.ValorTotal < 0) pedido.ValorTotal = 0;

            // 5. Atualiza o item
            item.Quantidade = dto.Quantidade;

            await _context.SaveChangesAsync();

            return Ok(new { mensagem = "Quantidade atualizada!", novoTotal = pedido.ValorTotal });
        }

        // DELETE: api/pedidos/5/itens/10 (Remover Item do Pedido)
        [HttpDelete("{pedidoId}/itens/{itemId}")]
        public async Task<IActionResult> RemoverItemDoPedido(int pedidoId, int itemId)
        {
            // 1. Busca o Item no banco (incluindo o Produto para devolver estoque)
            var item = await _context.ItensPedido
                .Include(i => i.Produto)
                .FirstOrDefaultAsync(i => i.Id == itemId && i.PedidoId == pedidoId);

            if (item == null) return NotFound("Item não encontrado neste pedido.");

            // 2. Verifica se o pedido ainda está aberto
            var pedido = await _context.Pedidos.FindAsync(pedidoId);
            if (pedido.Status == "PAGO" || pedido.Status == "CANCELADO")
                return BadRequest("Não é possível remover itens de um pedido fechado.");

            // 3. DEVOLVE O ESTOQUE
            if (item.Produto != null)
            {
                item.Produto.SaldoEstoque += item.Quantidade;
            }

            // 4. ATUALIZA O VALOR TOTAL DO PEDIDO
            // CORREÇÃO: Cast explícito para (decimal)
            pedido.ValorTotal -= ((decimal)item.Quantidade * item.PrecoUnitarioVenda);
            
            if (pedido.ValorTotal < 0) pedido.ValorTotal = 0;

            // 5. REMOVE O ITEM DO BANCO
            _context.ItensPedido.Remove(item);
            
            await _context.SaveChangesAsync();

            return Ok(new { mensagem = "Item removido, total atualizado e estoque devolvido!" });
        }
    }

    // --- DTOs ATUALIZADOS ---
    public class CriarPedidoDto
    {
        public int ClienteId { get; set; } 
        public List<ItemPedidoDto> Itens { get; set; }
    }

    public class ItemPedidoDto
    {
        public int ProdutoId { get; set; }
        // CORREÇÃO: Alterado para double para aceitar 0.5, 0.3, etc.
        public double Quantidade { get; set; } 
    }
}