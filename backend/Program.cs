using Espeto.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ==================================================================
// 1. CONFIGURAÇÃO DE REDE (WIFI)
// ==================================================================
// O "*" permite que qualquer IP da rede acesse. Porta 5000.
builder.WebHost.UseUrls("http://*:5000");

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Banco de Dados
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// CORS (Liberar tudo na rede local)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        builder =>
        {
            builder.AllowAnyOrigin()
                   .AllowAnyMethod()
                   .AllowAnyHeader();
        });
});

var app = builder.Build();

// ==================================================================
// 2. MIGRATIONS AUTOMÁTICAS (Cria o banco sozinho)
// ==================================================================
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var db = services.GetRequiredService<AppDbContext>();
        db.Database.Migrate();
    }
    catch (Exception ex)
    {
        Console.WriteLine("Erro ao criar banco: " + ex.Message);
    }
}

app.UseSwagger();
app.UseSwaggerUI();

// ==================================================================
// 3. SERVIR O FRONTEND (WWWROOT)
// ==================================================================
app.UseDefaultFiles(); // Procura index.html
app.UseStaticFiles();  // Serve os arquivos da pasta wwwroot

app.UseCors("AllowAll");
app.UseAuthorization();
app.MapControllers();

// Redireciona a raiz "/" para a tela inicial
app.MapGet("/", async context =>
{
    context.Response.Redirect("/home/home.html");
    await Task.CompletedTask;
});

// Mensagem de boas vindas no console
Console.WriteLine("=================================================");
Console.WriteLine(" SISTEMA INICIADO! ACESSE:");
Console.WriteLine(" Local:   http://localhost:5000");
Console.WriteLine(" Rede:    Descubra seu IP (ipconfig) e acesse :5000");
Console.WriteLine("=================================================");

app.Run();