using Microsoft.EntityFrameworkCore;
using Espeto.Models; // <--- Verifique se está usando o nome da pasta correta

namespace Espeto.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        // Apenas declaramos quais classes viram tabelas
        public DbSet<Cliente> Clientes { get; set; }
        public DbSet<Produto> Produtos { get; set; }
        public DbSet<Pedido> Pedidos { get; set; }
        public DbSet<ItemPedido> ItensPedido { get; set; }
        public DbSet<Pagamento> Pagamentos { get; set; }

        // Configuração mínima e global apenas para evitar bugs com Dinheiro
        protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
        {
            // Define que TODO campo 'decimal' no sistema terá 18 digitos e 2 casas decimais
            // Assim você não precisa configurar um por um.
            configurationBuilder.Properties<decimal>()
                .HavePrecision(18, 2);
        }
    }
}