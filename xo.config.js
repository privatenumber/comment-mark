module.exports = {
	rules: {
		'comma-dangle': [
			'error',
			'always-multiline',
		],
	},
	overrides: [
		{
			files: 'test/*',
			env: 'jest',
		},
	],
};
