(window.webpackJsonp=window.webpackJsonp||[]).push([[8],{25:function(r,n){function t(r){if("string"!=typeof r)throw new Error("String type expected")}function e(r){if(Number.isNaN(r))throw new Error("Number type expected")}n.find=function(r,n){return t(r),t(n),r.indexOf(n)},n.rfind=function(r,n){return t(r),t(n),r.lastIndexOf(n)},n.lower=function(r){return t(r),r.toLowerCase()},n.upper=function(r){return t(r),r.toUpperCase()},n.char=function(...r){for(let n of r)e(n);return String.fromCharCode(...r)},n.code=function(r){return t(r),Array.from(r).map(r=>r.charCodeAt(0))},n.slice=function(r,n,i){return t(r),e(n),void 0!==i&&e(i),r.slice(n,i)},n.split=function(r,n){return t(r),t(n),r.split(n)},n.replace=(r,n,e)=>{for(t(r),t(n),t(e);-1!==r.indexOf(n);)r=r.replace(n,e);return r},n.trim=r=>(t(r),r.trim()),n.trimStart=r=>(t(r),r.trimStart()),n.trimEnd=r=>(t(r),r.trimEnd())}}]);