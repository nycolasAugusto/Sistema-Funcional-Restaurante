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
                    
                    // --- AQUI ESTÁ A MÁGICA DO PREÇO PERSONALIZADO ---
                    // Se veio preço do botão (ex: 8.00), usa ele. Se não, usa o do cadastro.
                    // SEGREDO: Se veio preço personalizado, divide pela quantidade para achar o valor do litro correto
PrecoUnitarioVenda = itemDto.PrecoPersonalizado > 0 
    ? (itemDto.PrecoPersonalizado / (decimal)itemDto.Quantidade) 
    : produto.ValorVenda,
                    
                    CustoUnitario = produto.CustoMedio 
                };

                // Cálculo Financeiro (Convertendo Double para Decimal)
                totalPedido += (novoItem.PrecoUnitarioVenda * (decimal)novoItem.Quantidade);
                
                // Baixa de Estoque
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
                
                // --- MÁGICA DO PREÇO TAMBÉM NO ITEM EXTRA ---
                PrecoUnitarioVenda = itemDto.PrecoPersonalizado > 0 
                ? (itemDto.PrecoPersonalizado / (decimal)itemDto.Quantidade) 
                : produto.ValorVenda,
                
                CustoUnitario = produto.CustoMedio 
            };

            // Atualiza Total
            pedido.ValorTotal += ((decimal)novoItem.Quantidade * novoItem.PrecoUnitarioVenda);
            
            _context.ItensPedido.Add(novoItem); 
            
            await _context.SaveChangesAsync();

            return Ok(new { mensagem = "Item adicionado!", novoTotal = pedido.ValorTotal });
        }

        // GET: api/pedidos/cliente/5
        [HttpGet("cliente/{clienteId}")]
        public async Task<ActionResult<IEnumerable<Pedido>>> GetPedidosPorCliente(int clienteId)
        {
            return await _context.Pedidos
                .Include(p => p.Itens)
                .Where(p => p.ClienteId == clienteId)
                .OrderByDescending(p => p.DataPedido)
                .ToListAsync();
        }

        // PUT: api/pedidos/5/pagar
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

            // 1. Busca o item e o produto
            var item = await _context.ItensPedido
                .Include(i => i.Produto)
                .FirstOrDefaultAsync(i => i.Id == itemId && i.PedidoId == pedidoId);

            if (item == null) return NotFound("Item não encontrado.");

            var pedido = await _context.Pedidos.FindAsync(pedidoId);
            if (pedido.Status == "PAGO" || pedido.Status == "CANCELADO")
                return BadRequest("Pedido fechado não pode ser alterado.");

            // 2. LÓGICA DE ESTOQUE (Aceita Double)
            double diferenca = dto.Quantidade - item.Quantidade;

            if (diferenca > 0) // Aumentando quantidade (Consome Estoque)
            {
                if (item.Produto.SaldoEstoque < diferenca)
                    return BadRequest($"Estoque insuficiente. Só restam {item.Produto.SaldoEstoque}.");
                
                item.Produto.SaldoEstoque -= diferenca;
            }
            else if (diferenca < 0) // Diminuindo quantidade (Devolve Estoque)
            {
                item.Produto.SaldoEstoque += Math.Abs(diferenca); 
            }

            // 3. Atualiza o TOTAL do Pedido
            // Remove o valor antigo
            pedido.ValorTotal -= ((decimal)item.Quantidade * item.PrecoUnitarioVenda);
            // Adiciona o valor novo (Mantém o preço unitário original, seja ele 8 ou 12)
            pedido.ValorTotal += ((decimal)dto.Quantidade * item.PrecoUnitarioVenda);

            if (pedido.ValorTotal < 0) pedido.ValorTotal = 0;

            // 4. Atualiza o item
            item.Quantidade = dto.Quantidade;

            await _context.SaveChangesAsync();

            return Ok(new { mensagem = "Quantidade atualizada!", novoTotal = pedido.ValorTotal });
        }

        // DELETE: api/pedidos/5/itens/10 (Remover Item)
        [HttpDelete("{pedidoId}/itens/{itemId}")]
        public async Task<IActionResult> RemoverItemDoPedido(int pedidoId, int itemId)
        {
            var item = await _context.ItensPedido
                .Include(i => i.Produto)
                .FirstOrDefaultAsync(i => i.Id == itemId && i.PedidoId == pedidoId);

            if (item == null) return NotFound("Item não encontrado neste pedido.");

            var pedido = await _context.Pedidos.FindAsync(pedidoId);
            if (pedido.Status == "PAGO" || pedido.Status == "CANCELADO")
                return BadRequest("Não é possível remover itens de um pedido fechado.");

            // Devolve Estoque (Double)
            if (item.Produto != null)
            {
                item.Produto.SaldoEstoque += item.Quantidade;
            }

            // Atualiza Total
            pedido.ValorTotal -= ((decimal)item.Quantidade * item.PrecoUnitarioVenda);
            
            if (pedido.ValorTotal < 0) pedido.ValorTotal = 0;

            _context.ItensPedido.Remove(item);
            
            await _context.SaveChangesAsync();

            return Ok(new { mensagem = "Item removido, total atualizado e estoque devolvido!" });
        }
    }

    // --- DTOs PARA RECEBER DADOS DO FRONTEND ---
    public class CriarPedidoDto
    {
        public int ClienteId { get; set; } 
        public List<ItemPedidoDto> Itens { get; set; }
    }

    public class ItemPedidoDto
    {
        public int ProdutoId { get; set; }
        
        // Quantidade agora é Double (aceita 0.3, 0.5, 1.0)
        public double Quantidade { get; set; } 
        
        // Preço Opcional (se vier preenchido, o sistema usa esse em vez do cadastro)
        public decimal PrecoPersonalizado { get; set; }
    }
}