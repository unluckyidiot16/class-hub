import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc"; // 또는 "@vitejs/plugin-react"

export default defineConfig({
    base: "/class-hub/",   // 레포 이름
    build: {
        outDir: "docs",      // GitHub Pages에서 지정한 폴더
    },
    plugins: [react()],
});
