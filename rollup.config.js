import babel from 'rollup-plugin-babel';
import {terser} from 'rollup-plugin-terser';
import filesize from 'rollup-plugin-filesize';

const isProd = process.env.NODE_ENV === 'production';

const rollupConfig = {
	input: 'src/comment-mark.js',
	plugins: [
		babel(),
		isProd && terser(),
		isProd && filesize(),
	],
	output: [
		{
			format: 'umd',
			file: 'dist/comment-mark.js',
			name: 'commentMark',
			exports: 'default',
		},
		{
			format: 'es',
			file: 'dist/comment-mark.esm.js',
		},
	],
};

export default rollupConfig;
