using System;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Espeto.Models // Ajuste para o namespace do seu projeto
{
    public class Pagamento
    {
        public int Id { get; set; }
        public decimal Valor { get; set; }
        public string Metodo { get; set; } // "CREDITO", "DEBITO", "PIX"
        public decimal Taxa { get; set; }  // A taxa calculada para ESSE valor
        public DateTime DataHora { get; set; } = DateTime.Now;

        // Relacionamento com o Pedido
        public int PedidoId { get; set; }
        [JsonIgnore] // Para não criar loop infinito no JSON
        public Pedido Pedido { get; set; }
    }
}