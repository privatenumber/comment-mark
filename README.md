# comment-mark [![Latest version](https://badgen.net/npm/v/vue-frag)](https://npm.im/vue-frag) [![Monthly downloads](https://badgen.net/npm/dm/vue-frag)](https://npm.im/vue-frag) [![Install size](https://packagephobia.now.sh/badge?p=vue-frag)](https://packagephobia.now.sh/result?p=vue-frag) [![Bundle size](https://badgen.net/bundlephobia/minzip/vue-frag)](https://bundlephobia.com/result?p=vue-frag)

Interpolate strings with HTML comment markers!

**Before**

```html
<!-- insert:start --><!-- insert:end -->
```

**After <sup>✨</sup>**

```html
<!-- insert:start -->Text inserted!<!-- insert:end -->
```


## 🙋‍♂️ Why?
- **⚡️ Preserved placeholders** No need for soruce files and compilations!
- **🔥 Great for Markdown** Insert arbitrary data in your Markdown files!
- **🐥 Tiny** Only 429 B!


## 🚀 Install
```sh
npm i comment-mark
```


## 👨🏻‍🏫 Quick demo

```js
const fs = require('fs');
const outdent = require('outdent');
const commentMark = require('comment-mark');

let mdStr = fs.readFileSync('./README.md');

mdStr = commentMark(mdStr, {
	toc: outdent`
	- [Heading 1](#heading-1)
	- [Heading 2](#heading-2)
	`
});

fs.writeFileSync('./README.md', mdStr);
```

**Before `README.md`**

```md
# Title

<!-- toc:start --><!-- toc:end -->

## Heading 1
Text

## Heading 2
Text
```

**After `README.md`**

```md
# Title

<!-- toc:start -->
- [Heading 1](#Heading1)
- [Heading 2](#Heading2)
<!-- toc:end -->

## Heading 1
Text

## Heading 2
Text
```

## ⚙️ Options

`commentMark(contentStr: string, data)`
- `contentStr` <`String`>
- `data` - key-value 


## 💁‍♀️ FAQ

### Why use HTML comments?

This is primarily designed for Markdown files, where basic HTML is typically supported. HTML comment pairs serve as a great placeholder for inserting text between.


### Why are there pairs of HTML comments instead of just one placeholder?

So that the interpolation position is preserved throughout interpolations.

If there's only one placeholder that gets replaced during interpolation, the placeholder will be lost after the first interpolation.
