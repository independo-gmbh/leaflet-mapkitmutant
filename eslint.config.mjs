import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
	{
		ignores: ["dist/**", "node_modules/**"],
	},
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			globals: {
				// Provided at runtime via <script> tags, typed ambiently.
				L: "readonly",
				mapkit: "readonly",
			},
		},
		rules: {
			// The plugin intentionally casts to `any` to augment Leaflet's global `L`.
			"@typescript-eslint/no-explicit-any": "off",
		},
	},
	prettier
);
