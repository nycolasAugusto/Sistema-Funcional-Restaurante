using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Espeto.Data;
using Espeto.Models;

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
                .OrderByDescending(p => p.Id) 
                .ToListAsync();
        }

        // POST: api/pedidos (Criar Pedido)
        [HttpPost]
        public async Task<ActionResult<Pedido>> PostPedido(CriarPedidoDto dto)
        {
            var clienteExiste = await _context.Clientes.AnyAsync(c => c.Id == dto.ClienteId);
            if (!clienteExiste) return BadRequest($"Cliente {dto.ClienteId} não encontrado.");

            var pedido = new Pedido
            {
                ClienteId = dto.ClienteId,
                DataPedido = DateTime.Now,
                Status = "ABERTO",
                Itens = new List<ItemPedido>()
            };

            decimal totalPedido = 0;

            foreach (var itemDto in dto.Itens)
            {
                var produto = await _context.Produtos.FindAsync(itemDto.ProdutoId);
                if (produto == null) return BadRequest($"Produto {itemDto.ProdutoId} não encontrado.");
                if (produto.SaldoEstoque < itemDto.Quantidade) return BadRequest($"Estoque insuficiente: {produto.Nome}");

                var novoItem = new ItemPedido
                {
                    ProdutoId = produto.Id,
                    Quantidade = itemDto.Quantidade,
                    PrecoUnitarioVenda = itemDto.PrecoPersonalizado > 0 
                        ? (itemDto.PrecoPersonalizado / (decimal)itemDto.Quantidade) 
                        : produto.ValorVenda,
                    CustoUnitario = produto.CustoMedio 
                };

                totalPedido += (novoItem.PrecoUnitarioVenda * (decimal)novoItem.Quantidade);
                produto.SaldoEstoque -= itemDto.Quantidade;
                pedido.Itens.Add(novoItem);
            }

            pedido.ValorTotal = totalPedido;
            _context.Pedidos.Add(pedido);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetPedidos), new { id = pedido.Id }, pedido);
        }

        // POST: api/pedidos/5/itens (Adicionar Item)
        [HttpPost("{id}/itens")]
        public async Task<IActionResult> AdicionarItemAoPedido(int id, [FromBody] ItemPedidoDto itemDto)
        {
            var pedido = await _context.Pedidos.Include(p => p.Itens).FirstOrDefaultAsync(p => p.Id == id);
            if (pedido == null) return NotFound("Pedido não encontrado.");
            if (pedido.Status == "PAGO" || pedido.Status == "CANCELADO") return BadRequest("Pedido fechado.");

            var produto = await _context.Produtos.FindAsync(itemDto.ProdutoId);
            if (produto == null) return BadRequest("Produto não existe.");
            if (produto.SaldoEstoque < itemDto.Quantidade) return BadRequest($"Estoque insuficiente.");

            produto.SaldoEstoque -= itemDto.Quantidade;

            var novoItem = new ItemPedido
            {
                PedidoId = id,
                ProdutoId = produto.Id,
                Quantidade = itemDto.Quantidade,
                PrecoUnitarioVenda = itemDto.PrecoPersonalizado > 0 
                    ? (itemDto.PrecoPersonalizado / (decimal)itemDto.Quantidade) 
                    : produto.ValorVenda,
                CustoUnitario = produto.CustoMedio 
            };

            pedido.ValorTotal += ((decimal)novoItem.Quantidade * novoItem.PrecoUnitarioVenda);
            _context.ItensPedido.Add(novoItem); 
            await _context.SaveChangesAsync();

            return Ok(new { mensagem = "Item adicionado!", novoTotal = pedido.ValorTotal });
        }

        // PUT: api/pedidos/5/pagar (MÉTODO CORRIGIDO - SEM DUPLICIDADE)
        [HttpPut("{id}/pagar")]
        public async Task<IActionResult> ConfirmarPagamento(int id, [FromBody] DadosPagamentoDto dados)
        {
            var pedido = await _context.Pedidos.FindAsync(id);
            if (pedido == null) return NotFound();

            if (string.IsNullOrEmpty(dados.Metodo)) 
                return BadRequest("Informe o método de pagamento.");

            pedido.Status = "PAGO";
            pedido.MetodoPagamento = dados.Metodo;
            pedido.DataPagamento = DateTime.Now;
            pedido.TaxaPagamento = dados.Taxa; // Salva a taxa aqui
            
            await _context.SaveChangesAsync();
            return Ok(new { mensagem = "Pedido pago com sucesso!" });
        }

        // [MÉTODOS DE GET POR CLIENTE, UPDATE E DELETE CONTINUAM AQUI EMBAIXO IGUAL ANTES]
        // ... (Para economizar espaço, mantive os principais. Se você apagou tudo, me avise que mando o resto) ...
        // Vou assumir que você vai copiar o arquivo inteiro que te mandei na resposta anterior, 
        // mas aqui está o resto para garantir que não falte nada:

        [HttpGet("cliente/{clienteId}")]
        public async Task<ActionResult<IEnumerable<Pedido>>> GetPedidosPorCliente(int clienteId)
        {
            return await _context.Pedidos
                .Include(p => p.Itens)
                .Where(p => p.ClienteId == clienteId)
                .OrderByDescending(p => p.DataPedido)
                .ToListAsync();
        }

        [HttpPut("{pedidoId}/itens/{itemId}")]
        public async Task<IActionResult> AtualizarItemPedido(int pedidoId, int itemId, [FromBody] ItemPedidoDto dto)
        {
            if (dto.Quantidade <= 0) return BadRequest("Qtd deve ser maior que zero.");
            var item = await _context.ItensPedido.Include(i => i.Produto).FirstOrDefaultAsync(i => i.Id == itemId && i.PedidoId == pedidoId);
            if (item == null) return NotFound("Item não encontrado.");
            var pedido = await _context.Pedidos.FindAsync(pedidoId);
            
            double diferenca = dto.Quantidade - item.Quantidade;

            if (diferenca > 0) {
                if (item.Produto.SaldoEstoque < diferenca) return BadRequest($"Estoque insuficiente.");
                item.Produto.SaldoEstoque -= diferenca;
            } else if (diferenca < 0) {
                item.Produto.SaldoEstoque += Math.Abs(diferenca); 
            }

            pedido.ValorTotal -= ((decimal)item.Quantidade * item.PrecoUnitarioVenda);
            pedido.ValorTotal += ((decimal)dto.Quantidade * item.PrecoUnitarioVenda);
            if (pedido.ValorTotal < 0) pedido.ValorTotal = 0;

            item.Quantidade = dto.Quantidade;
            await _context.SaveChangesAsync();
            return Ok(new { mensagem = "Atualizado!", novoTotal = pedido.ValorTotal });
        }

                // PUT: api/pedidos/5/taxa
        [HttpPut("{id}/taxa")]
        public async Task<IActionResult> AtualizarTaxa(int id, [FromBody] decimal novaTaxa)
        {
            var pedido = await _context.Pedidos.FindAsync(id);
            if (pedido == null) return NotFound();

            pedido.TaxaPagamento = novaTaxa;
            await _context.SaveChangesAsync();
            
            return Ok();
        }

        [HttpDelete("{pedidoId}/itens/{itemId}")]
        public async Task<IActionResult> RemoverItemDoPedido(int pedidoId, int itemId)
        {
            var item = await _context.ItensPedido.Include(i => i.Produto).FirstOrDefaultAsync(i => i.Id == itemId && i.PedidoId == pedidoId);
            if (item == null) return NotFound("Item não encontrado.");
            var pedido = await _context.Pedidos.FindAsync(pedidoId);
            
            if (item.Produto != null) item.Produto.SaldoEstoque += item.Quantidade;

            pedido.ValorTotal -= ((decimal)item.Quantidade * item.PrecoUnitarioVenda);
            if (pedido.ValorTotal < 0) pedido.ValorTotal = 0;

            _context.ItensPedido.Remove(item);
            await _context.SaveChangesAsync();
            return Ok(new { mensagem = "Removido!" });
        }
    }
    

    // --- DTOs (Essenciais para funcionar) ---
    public class CriarPedidoDto {
        public int ClienteId { get; set; } 
        public List<ItemPedidoDto> Itens { get; set; }
    }
    public class ItemPedidoDto {
        public int ProdutoId { get; set; }
        public double Quantidade { get; set; } 
        public decimal PrecoPersonalizado { get; set; }
    }
    public class DadosPagamentoDto {
        public string Metodo { get; set; }
        public decimal Taxa { get; set; }
    }
}