import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Конфиг для прод-сборки под локальный IIS.
// base: "./" — относительные пути к ассетам, чтобы билд работал из ЛЮБОГО
// виртуального каталога IIS (http://localhost/SVdrivers/, http://localhost/app/ и т.д.).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
