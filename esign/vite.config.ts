import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	base: process.env.BASE_PATH || "/",
	resolve: {
		dedupe: ["react", "react-dom"],
	},
	server: {
		proxy: {
			"/v1": {
				target:
					"https://esign-demo-proxy-server-191591660773.us-central1.run.app",
				changeOrigin: true,
				secure: false,
			},
		},
	},
});
