# comment-mark [![Latest version](https://badgen.net/npm/v/comment-mark)](https://npm.im/comment-mark) [![Monthly downloads](https://badgen.net/npm/dm/comment-mark)](https://npm.im/comment-mark) [![Install size](https://packagephobia.now.sh/badge?p=comment-mark)](https://packagephobia.now.sh/result?p=comment-mark) [![Bundle size](https://badgen.net/bundlephobia/minzip/comment-mark)](https://bundlephobia.com/result?p=comment-mark)

Use comment-mark to insert dynamic content in Markdown/HTML:

1. Prepare Markdown content with placeholders

	```js
	const markdownString = `
	## Last updated
	<!-- lastUpdated:start --><!-- lastUpdated:end -->
	`
	```

2. Apply comment-mark to insert data into the placeholders

	```js
	markdownString = commentMark(markdownString, {
	    lastUpdated: (new Date()).toISOString()
	})
	```

3. Done!

	```md
	## Last updated
	<!-- lastUpdated:start -->2021-02-01T02:48:03.797Z<!-- lastUpdated:end -->
	```

## 🚀 Install
```sh
npm i comment-mark
```

## 🙋‍♂️ Why?

Most approaches to interpolating dynamic data into a Markdown file involves maintaining a _Markdown template_ as the source, and a build step that produces the actual Markdown file.

Comment-mark lets you use a single Markdown file as both the template and distribution file by using persistent placeholders.

Real examples:
- [My project index](https://github.com/privatenumber/privatenumber) - Auto-renders `projects.json` as a list in `README.md` on Git commit hook
- [minification-benchmarks](https://github.com/privatenumber/minification-benchmarks) - Benchmarking automatically inserts results in `README.md`

## 👨🏻‍🏫 Quick demo
The following example demonstrates how comment-mark can be used to interpolate a list of the project's Git contributors to `README.md`:

```js
const fs = require('fs')
const { execSync } = require('child_process')
const commentMark = require('comment-mark')

let mdString = fs.readFileSync('./README.md')

mdString = commentMark(mdString, {
    contributors: execSync('git shortlog -se HEAD -- .').toString()
})

fs.writeFileSync('./README.md', mdString)
```

**Before `README.md`**

```md
# Welcome to my project

## Contributors
<!-- contributors:start --><!-- contributors:end -->
```

**After `README.md`<sup>✨</sup>**

```md
# Welcome to my project

## Contributors
<!-- contributors:start -->
    17	John Doe <john.doe@gmail.com>
<!-- contributors:end -->
```

## ⚙️ Options

`commentMark(contentStr, data)`
- `contentStr` `<string>` The input string
- `data` - `<{[key: string]: string}>` Key-value pairs to inject into the string

Output: The input string with the key-value pairs from data interpolated in it

## 💁‍♀️ FAQ

### Why use HTML comments?

This is primarily designed for Markdown files, where basic HTML is typically supported. HTML comment pairs serve as a convenient placeholder to insert a string in between.


### Why are there pairs of HTML comments instead of just one placeholder?

So that the interpolation positions are preserved throughout interpolations.

If there's only one placeholder that gets replaced during interpolation, the placeholder will be lost after the first interpolation. This kind of approach will require a separation of "source" and "distribution" files.
