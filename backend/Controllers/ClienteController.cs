using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Espeto.Data;
using Espeto.Models;

namespace Espeto.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ClienteController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ClienteController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/cliente
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Cliente>>> GetClientes()
        {
            return await _context.Clientes.ToListAsync();
        }

        // GET: api/cliente/buscar/termo
        [HttpGet("pesquisar/{termo}")]
        public async Task<ActionResult<IEnumerable<Cliente>>> PesquisarClientes(string termo)
        {
            var clientes = await _context.Clientes
                .Where(c => c.Nome.Contains(termo) || (c.Telefone != null && c.Telefone.Contains(termo)))
                .Take(5)
                .ToListAsync();

            return clientes;
        }
        
        // GET: api/cliente/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Cliente>> GetCliente(int id)
        {
            var cliente = await _context.Clientes.FindAsync(id);
            if (cliente == null) return NotFound();
            return cliente;
        }

        // POST: api/cliente
        [HttpPost]
        public async Task<ActionResult<Cliente>> PostCliente(Cliente cliente)
        {
            // Se vier nulo, transforma em texto vazio para ficar bonitinho no banco
            if (cliente.Endereco == null) cliente.Endereco = "";
            if (cliente.Telefone == null) cliente.Telefone = "";

            _context.Clientes.Add(cliente);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetCliente), new { id = cliente.Id }, cliente);
        }

        // PUT: api/cliente/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutCliente(int id, Cliente cliente)
        {
            if (id != cliente.Id) return BadRequest();

            // Proteção para opcionais
            if (cliente.Endereco == null) cliente.Endereco = "";
            if (cliente.Telefone == null) cliente.Telefone = "";

            _context.Entry(cliente).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/cliente/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCliente(int id)
        {
            var cliente = await _context.Clientes.FindAsync(id);
            if (cliente == null) return NotFound();

            try 
            {
                _context.Clientes.Remove(cliente);
                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch 
            {
                return BadRequest("Não é possível apagar cliente que tem pedidos.");
            }
        }
    }
}