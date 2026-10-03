import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";

export default defineConfig({
	source: ["src", "addon"],
	dist: "build",
	name: pkg.config.addonName,
	id: pkg.config.addonID,
	namespace: pkg.config.addonRef,
	server: {
		asProxy: true,
	},

	build: {
		assets: ["addon/**/*.*"],
		define: {
			...pkg.config,
			author: pkg.author,
			description: pkg.description,
			homepage: pkg.homepage,
			buildVersion: pkg.version,
			buildTime: "{{buildTime}}",
		},
		esbuildOptions: [
			{
				entryPoints: ["src/index.ts"],
				define: {
					__env__: `"${process.env.NODE_ENV}"`,
				},
				bundle: true,
				target: "firefox115",
				outfile: `build/addon/chrome/content/scripts/${pkg.config.addonRef}.js`,
				sourcemap:
					process.env.NODE_ENV == "development"
						? "linked"
						: undefined,
			},
		],
	},
});
