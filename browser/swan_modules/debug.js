(window.webpackJsonp=window.webpackJsonp||[]).push([[2],{26:function(a,t){var n=0;t.log=async function(...a){const t=this.$Tuple(...a).normalize();return n++,console.log(`Log ${n}:`,t),`[[Log ${n}]]`};const e=t.inspect=async function(...a){const t=this,n=t.$Tuple(...a).normalize();if(n instanceof t.$Tuple)return{type:"Tuple",data:Array.from(await n.mapAsync(a=>e.call(t,a)))};if(n instanceof Error)return{type:"Error",data:n};const c=await t.type(n);switch(c){case"Undefined":return{type:c,data:Array.from(await n.args.mapAsync(a=>e.call(t,a)))};case"List":return{type:c,data:await Promise.all(n.map(a=>e.call(t,a)))};case"Namespace":return{type:c,data:await r(n,a=>e.call(t,a))};default:return{type:c,data:n}}};async function r(a,t){const n={};for(let e in a)n[e]=await t(a[e]);return n}}}]);