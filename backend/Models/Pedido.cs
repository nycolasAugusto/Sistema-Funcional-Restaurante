using System;
using System.Collections.Generic;

namespace Espeto.Models
{
    public class Pedido
    {
        public int Id { get; set; }
        
        public int ClienteId { get; set; }
        public Cliente Cliente { get; set; }

        public DateTime DataPedido { get; set; }
        public string? MetodoPagamento { get; set; }
        // Novo campo para controle financeiro (pode ser nulo se não foi pago ainda)
        public DateTime? DataPagamento { get; set; } 
        public decimal TaxaPagamento { get; set; }
        public decimal ValorTotal { get; set; }
        public string Status { get; set; } // PENDENTE, PAGO, CANCELADO

        public List<ItemPedido> Itens { get; set; } = new List<ItemPedido>();
    }
}