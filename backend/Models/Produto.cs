namespace Espeto.Models
{
    public class Produto
    {
        public int Id { get; set; }
        public string Nome { get; set; }
        public string Tipo { get; set; }
        
        public decimal ValorVenda { get; set; }
        public decimal CustoMedio { get; set; }
        
        public int SaldoEstoque { get; set; }
        public bool Ativo { get; set; }
    }
}