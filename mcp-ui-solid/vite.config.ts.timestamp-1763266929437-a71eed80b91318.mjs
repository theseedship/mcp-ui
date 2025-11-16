// vite.config.ts
import { defineConfig } from "file:///home/nico/code_source/tss/mcp-ui/node_modules/.pnpm/vite@5.4.21_@types+node@20.19.25/node_modules/vite/dist/node/index.js";
import solidPlugin from "file:///home/nico/code_source/tss/mcp-ui/node_modules/.pnpm/vite-plugin-solid@2.11.10_solid-js@1.9.10_vite@5.4.21/node_modules/vite-plugin-solid/dist/esm/index.mjs";
import { resolve } from "path";
var __vite_injected_original_dirname = "/home/nico/code_source/tss/mcp-ui/mcp-ui-solid";
var vite_config_default = defineConfig({
  plugins: [solidPlugin()],
  build: {
    lib: {
      entry: {
        index: resolve(__vite_injected_original_dirname, "src/index.ts"),
        components: resolve(__vite_injected_original_dirname, "src/components/index.ts"),
        hooks: resolve(__vite_injected_original_dirname, "src/hooks/index.ts"),
        types: resolve(__vite_injected_original_dirname, "src/types/index.ts")
      },
      name: "McpUiSolid",
      formats: ["es", "cjs"]
    },
    rollupOptions: {
      external: ["solid-js", "solid-js/web", "solid-js/store"],
      output: {
        globals: {
          "solid-js": "SolidJS",
          "solid-js/web": "SolidJSWeb",
          "solid-js/store": "SolidJSStore"
        }
      }
    },
    sourcemap: true,
    minify: "esbuild"
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9uaWNvL2NvZGVfc291cmNlL3Rzcy9tY3AtdWkvbWNwLXVpLXNvbGlkXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9uaWNvL2NvZGVfc291cmNlL3Rzcy9tY3AtdWkvbWNwLXVpLXNvbGlkL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL25pY28vY29kZV9zb3VyY2UvdHNzL21jcC11aS9tY3AtdWktc29saWQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHNvbGlkUGx1Z2luIGZyb20gJ3ZpdGUtcGx1Z2luLXNvbGlkJ1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnXG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtzb2xpZFBsdWdpbigpXSxcbiAgYnVpbGQ6IHtcbiAgICBsaWI6IHtcbiAgICAgIGVudHJ5OiB7XG4gICAgICAgIGluZGV4OiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9pbmRleC50cycpLFxuICAgICAgICBjb21wb25lbnRzOiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9jb21wb25lbnRzL2luZGV4LnRzJyksXG4gICAgICAgIGhvb2tzOiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9ob29rcy9pbmRleC50cycpLFxuICAgICAgICB0eXBlczogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvdHlwZXMvaW5kZXgudHMnKSxcbiAgICAgIH0sXG4gICAgICBuYW1lOiAnTWNwVWlTb2xpZCcsXG4gICAgICBmb3JtYXRzOiBbJ2VzJywgJ2NqcyddLFxuICAgIH0sXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgZXh0ZXJuYWw6IFsnc29saWQtanMnLCAnc29saWQtanMvd2ViJywgJ3NvbGlkLWpzL3N0b3JlJ10sXG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgZ2xvYmFsczoge1xuICAgICAgICAgICdzb2xpZC1qcyc6ICdTb2xpZEpTJyxcbiAgICAgICAgICAnc29saWQtanMvd2ViJzogJ1NvbGlkSlNXZWInLFxuICAgICAgICAgICdzb2xpZC1qcy9zdG9yZSc6ICdTb2xpZEpTU3RvcmUnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIHNvdXJjZW1hcDogdHJ1ZSxcbiAgICBtaW5pZnk6ICdlc2J1aWxkJyxcbiAgfSxcbiAgdGVzdDoge1xuICAgIGdsb2JhbHM6IHRydWUsXG4gICAgZW52aXJvbm1lbnQ6ICdqc2RvbScsXG4gICAgc2V0dXBGaWxlczogWycuL3ZpdGVzdC5zZXR1cC50cyddLFxuICAgIGNvdmVyYWdlOiB7XG4gICAgICBwcm92aWRlcjogJ3Y4JyxcbiAgICAgIHJlcG9ydGVyOiBbJ3RleHQnLCAnanNvbicsICdodG1sJ10sXG4gICAgfSxcbiAgfSxcbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTRULFNBQVMsb0JBQW9CO0FBQ3pWLE9BQU8saUJBQWlCO0FBQ3hCLFNBQVMsZUFBZTtBQUZ4QixJQUFNLG1DQUFtQztBQUl6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsWUFBWSxDQUFDO0FBQUEsRUFDdkIsT0FBTztBQUFBLElBQ0wsS0FBSztBQUFBLE1BQ0gsT0FBTztBQUFBLFFBQ0wsT0FBTyxRQUFRLGtDQUFXLGNBQWM7QUFBQSxRQUN4QyxZQUFZLFFBQVEsa0NBQVcseUJBQXlCO0FBQUEsUUFDeEQsT0FBTyxRQUFRLGtDQUFXLG9CQUFvQjtBQUFBLFFBQzlDLE9BQU8sUUFBUSxrQ0FBVyxvQkFBb0I7QUFBQSxNQUNoRDtBQUFBLE1BQ0EsTUFBTTtBQUFBLE1BQ04sU0FBUyxDQUFDLE1BQU0sS0FBSztBQUFBLElBQ3ZCO0FBQUEsSUFDQSxlQUFlO0FBQUEsTUFDYixVQUFVLENBQUMsWUFBWSxnQkFBZ0IsZ0JBQWdCO0FBQUEsTUFDdkQsUUFBUTtBQUFBLFFBQ04sU0FBUztBQUFBLFVBQ1AsWUFBWTtBQUFBLFVBQ1osZ0JBQWdCO0FBQUEsVUFDaEIsa0JBQWtCO0FBQUEsUUFDcEI7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLElBQ0EsV0FBVztBQUFBLElBQ1gsUUFBUTtBQUFBLEVBQ1Y7QUFBQSxFQUNBLE1BQU07QUFBQSxJQUNKLFNBQVM7QUFBQSxJQUNULGFBQWE7QUFBQSxJQUNiLFlBQVksQ0FBQyxtQkFBbUI7QUFBQSxJQUNoQyxVQUFVO0FBQUEsTUFDUixVQUFVO0FBQUEsTUFDVixVQUFVLENBQUMsUUFBUSxRQUFRLE1BQU07QUFBQSxJQUNuQztBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
