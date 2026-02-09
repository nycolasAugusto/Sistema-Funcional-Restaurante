using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Espeto.Migrations
{
    /// <inheritdoc />
    public partial class AdicionarTaxaPagamento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "TaxaPagamento",
                table: "Pedidos",
                type: "TEXT",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TaxaPagamento",
                table: "Pedidos");
        }
    }
}
