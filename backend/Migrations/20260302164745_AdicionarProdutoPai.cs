using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Espeto.Migrations
{
    /// <inheritdoc />
    public partial class AdicionarProdutoPai : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProdutoPaiId",
                table: "Produtos",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ProdutoPaiId",
                table: "Produtos");
        }
    }
}
