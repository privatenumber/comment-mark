# comment-mark [![Latest version](https://badgen.net/npm/v/comment-mark)](https://npm.im/comment-mark) [![Monthly downloads](https://badgen.net/npm/dm/comment-mark)](https://npm.im/comment-mark) [![Install size](https://packagephobia.now.sh/badge?p=comment-mark)](https://packagephobia.now.sh/result?p=comment-mark) [![Bundle size](https://badgen.net/bundlephobia/minzip/comment-mark)](https://bundlephobia.com/result?p=comment-mark)

Interpolate strings with HTML comment markers!

**Before**

```html
<!-- myMessage:start --><!-- myMessage:end -->
```

```json
{
	"myMessage": "Text inserted!"
}
```

**After <sup>✨</sup>**

```html
<!-- myMessage:start -->Text inserted!<!-- myMessage:end -->
```


## 🙋‍♂️ Why?
- **⚡️ Preserved placeholders** No need for soruce files and compilations!
- **🔥 Great for Markdown** Insert generated data to your Markdown files!
- **🐥 Tiny** Only 467 B!


## 🚀 Install
```sh
npm i comment-mark
```


## 👨🏻‍🏫 Quick demo
`commentMark` injects content between markers, so it can be executed over and over again without compromising the file—it will only update the content between the markers!

The following example demonstrates how `commentMark` can be used to inject the current date to the markdown file:

```js
const fs = require('fs');
const commentMark = require('comment-mark');

let mdStr = fs.readFileSync('./README.md');

mdStr = commentMark(mdStr, {
	lastUpdated: (new Date()).toISOString()
});

fs.writeFileSync('./README.md', mdStr);
```

**Before `README.md`**

```md
# Welcome to my markdown

Last updated: <!-- lastUpdated:start --><!-- lastUpdated:end -->

## About
This file is modified by a script
```

**After `README.md`**

```md
# Welcome to my markdown

Last updated: <!-- lastUpdated:start -->2020-10-25T20:21:28.101Z<!-- lastUpdated:end -->

## About
This file is modified by a script
```

## ⚙️ Options

`commentMark(contentStr: string, data)`
- `contentStr` <`String`>
- `data` - key-value pairs to inject into the string


## 💁‍♀️ FAQ

### Why use HTML comments?

This is primarily designed for Markdown files, where basic HTML is typically supported. HTML comment pairs serve as a convenient placeholder to insert a string in between.


### Why are there pairs of HTML comments instead of just one placeholder?

So that the interpolation positions are preserved throughout interpolations.

If there's only one placeholder that gets replaced during interpolation, the placeholder will be lost after the first interpolation. This kind of approach will require a separation of "source" and "distribution" files.
