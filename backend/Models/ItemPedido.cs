using System.Text.Json.Serialization; // Importante para o JsonIgnore

namespace Espeto.Models
{
    public class ItemPedido
    {
        public int Id { get; set; }

        public int PedidoId { get; set; }
        [JsonIgnore] // Evita travamento (ciclo) ao converter pra JSON
        public Pedido Pedido { get; set; }

        public int ProdutoId { get; set; }
        public Produto Produto { get; set; }

        public int Quantidade { get; set; }

        // Por quanto vendeu (Preço do Cardápio na época)
        public decimal PrecoUnitarioVenda { get; set; }

        // --- NOVO ---
        // Quanto custou pro dono (Custo Médio na época)
        public decimal CustoUnitario { get; set; }
    }
}