import { defineConfig } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import commonjs from '@rollup/plugin-commonjs';
import filesize from 'rollup-plugin-filesize';

const rollupConfig = defineConfig({
	input: 'src/comment-mark.ts',
	plugins: [
		esbuild({
			minify: true,
		}),
		commonjs({
			extensions: ['.ts'],
		}),
		filesize(),
	],
	output: [
		{
			format: 'cjs',
			file: 'dist/comment-mark.js',
			exports: 'default',
		},
		{
			format: 'es',
			file: 'dist/comment-mark.mjs',
		},
	],
});

export default rollupConfig;
