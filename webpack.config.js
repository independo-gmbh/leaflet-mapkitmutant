const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
	mode: "development",
	devtool: "inline-source-map",
	entry: {
		main: "./src/Leaflet.MapkitMutant.ts",
	},
	optimization: {
		minimize: true,
		minimizer: [new TerserPlugin()],
	},
	output: {
		path: path.resolve(__dirname, "./dist"),
		filename: "Leaflet.MapkitMutant.js",
	},
	resolve: {
		extensions: [".ts", ".tsx", ".js"],
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				loader: "ts-loader",
			},
		],
	},
};
