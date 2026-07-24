using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IFSWeather.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class EnrichDailyWeatherData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AverageHumidity",
                table: "Weather_Info_Tab",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MaximumTemperature",
                table: "Weather_Info_Tab",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MaximumWindSpeedKph",
                table: "Weather_Info_Tab",
                type: "numeric(6,2)",
                precision: 6,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MinimumTemperature",
                table: "Weather_Info_Tab",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PrecipitationProbability",
                table: "Weather_Info_Tab",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AverageHumidity",
                table: "Weather_Info_Tab");

            migrationBuilder.DropColumn(
                name: "MaximumTemperature",
                table: "Weather_Info_Tab");

            migrationBuilder.DropColumn(
                name: "MaximumWindSpeedKph",
                table: "Weather_Info_Tab");

            migrationBuilder.DropColumn(
                name: "MinimumTemperature",
                table: "Weather_Info_Tab");

            migrationBuilder.DropColumn(
                name: "PrecipitationProbability",
                table: "Weather_Info_Tab");
        }
    }
}
