using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Espeto.Migrations
{
    /// <inheritdoc />
    public partial class AddFoiImpressoEmItemPedido : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "FoiImpresso",
                table: "ItensPedido",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FoiImpresso",
                table: "ItensPedido");
        }
    }
}
