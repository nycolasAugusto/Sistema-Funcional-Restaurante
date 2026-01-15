using Microsoft.EntityFrameworkCore;
using Espeto.Data;
using System.Text.Json.Serialization; // Necessário para a correção

var builder = WebApplication.CreateBuilder(args);

// 1. Adicionar Controllers COM A CORREÇÃO DE CICLO
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });

// 2. Configurar Banco de Dados
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(connectionString));

// 3. Configurar CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("PermitirTudo",
        policy =>
        {
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        });
});

// 4. Serviços de Autorização
builder.Services.AddAuthorization();

var app = builder.Build();

// --- APP RODANDO ---

app.UseCors("PermitirTudo");

app.UseAuthorization();

app.MapControllers();

app.Run();