const{hasOwnProperty:a}=Object.prototype,m=(e,t)=>new RegExp(`<!--\\s*${e}:${t}\\s*-->`,"g"),s=/\n/;function u(e,t){if(!e||!t)return e;Buffer.isBuffer(e)&&(e=e.toString());for(const o in t){if(!a.call(t,o))continue;let c=t[o];s.test(c)&&(c=`
${c}
`);const r=m(o,"start"),l=m(o,"end");let n,f;do n=r.exec(e),!!n&&(l.lastIndex=n.index,f=l.exec(e),f?(e=e.slice(0,n.index+n[0].length)+c+e.slice(f.index),l.lastIndex+=c.length):console.warn(`[comment-mark] No end comment found for "${o}"`));while(n)}return e}var i=u;export{i as default};
