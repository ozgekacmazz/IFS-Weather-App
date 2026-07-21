using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace IFSWeather.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AlignDatabaseTablesAndAddUserLoginAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_WeatherInfos",
                table: "WeatherInfos");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Users",
                table: "Users");

            migrationBuilder.RenameTable(
                name: "WeatherInfos",
                newName: "Weather_Info_Tab");

            migrationBuilder.RenameTable(
                name: "Users",
                newName: "USER_TAB");

            migrationBuilder.RenameColumn(
                name: "Role",
                table: "USER_TAB",
                newName: "UserType");

            migrationBuilder.RenameColumn(
                name: "DefaultCity",
                table: "USER_TAB",
                newName: "DefaultCityName");

            migrationBuilder.RenameIndex(
                name: "IX_WeatherInfos_WeatherDate_NormalizedCityName",
                table: "Weather_Info_Tab",
                newName: "IX_Weather_Info_Tab_WeatherDate_NormalizedCityName");

            migrationBuilder.RenameIndex(
                name: "IX_Users_Username",
                table: "USER_TAB",
                newName: "IX_USER_TAB_Username");

            migrationBuilder.RenameIndex(
                name: "IX_Users_Email",
                table: "USER_TAB",
                newName: "IX_USER_TAB_Email");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Weather_Info_Tab",
                table: "Weather_Info_Tab",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_USER_TAB",
                table: "USER_TAB",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "USER_LOG_TAB",
                columns: table => new
                {
                    LogId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Username = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    LogTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IPAddress = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    Log = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USER_LOG_TAB", x => x.LogId);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "USER_LOG_TAB");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Weather_Info_Tab",
                table: "Weather_Info_Tab");

            migrationBuilder.DropPrimaryKey(
                name: "PK_USER_TAB",
                table: "USER_TAB");

            migrationBuilder.RenameTable(
                name: "Weather_Info_Tab",
                newName: "WeatherInfos");

            migrationBuilder.RenameTable(
                name: "USER_TAB",
                newName: "Users");

            migrationBuilder.RenameColumn(
                name: "UserType",
                table: "Users",
                newName: "Role");

            migrationBuilder.RenameColumn(
                name: "DefaultCityName",
                table: "Users",
                newName: "DefaultCity");

            migrationBuilder.RenameIndex(
                name: "IX_Weather_Info_Tab_WeatherDate_NormalizedCityName",
                table: "WeatherInfos",
                newName: "IX_WeatherInfos_WeatherDate_NormalizedCityName");

            migrationBuilder.RenameIndex(
                name: "IX_USER_TAB_Username",
                table: "Users",
                newName: "IX_Users_Username");

            migrationBuilder.RenameIndex(
                name: "IX_USER_TAB_Email",
                table: "Users",
                newName: "IX_Users_Email");

            migrationBuilder.AddPrimaryKey(
                name: "PK_WeatherInfos",
                table: "WeatherInfos",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Users",
                table: "Users",
                column: "Id");
        }
    }
}
