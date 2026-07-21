using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace IFSWeather.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWeatherInfo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WeatherInfos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    WeatherDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CityName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Temperature = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    MainStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    NormalizedCityName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true, computedColumnSql: "lower(\"CityName\")", stored: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WeatherInfos", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WeatherInfos_WeatherDate_NormalizedCityName",
                table: "WeatherInfos",
                columns: new[] { "WeatherDate", "NormalizedCityName" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WeatherInfos");
        }
    }
}
