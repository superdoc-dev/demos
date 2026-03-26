import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	base: process.env.BASE_PATH ?? "/",
	server: {
		port: 3000,
		proxy: {
			"/api": {
				target: "http://localhost:8787",
				changeOrigin: true,
			},
		},
	},
	build: {
		outDir: "dist",
	},
});
