(window["webpackJsonp"] = window["webpackJsonp"] || []).push([["/stdlib/text"],{

/***/ "../../lib/expression/stdlib/text.js":
/*!**********************************************************************************************!*\
  !*** /home/marcello/mdb/[ ] Progetti/[ ] OnLabs.org/[ ] olojs/lib/expression/stdlib/text.js ***!
  \**********************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("\n\nexports.find = function (str, subStr) {\n    ensureString(str);\n    ensureString(subStr);\n    return str.indexOf(subStr);\n}\n\nexports.rfind = function (str, subStr) {\n    ensureString(str);\n    ensureString(subStr);\n    return str.lastIndexOf(subStr);\n}\n\nexports.lower = function (str) {\n    ensureString(str);\n    return str.toLowerCase();\n}\n\nexports.upper = function (str) {\n    ensureString(str);    \n    return str.toUpperCase();\n}\n\nexports.char = function (...charCodes) {\n    for (let charCode of charCodes) ensureNumber(charCode);\n    return String.fromCharCode(...charCodes);\n}\nexports.code = function (str) {\n    ensureString(str);    \n    return Array.from(str).map(c => c.charCodeAt(0));\n}\n\nexports.slice = function (str, firstIndex, lastIndex) {\n    ensureString(str);\n    ensureNumber(firstIndex);\n    if (lastIndex !== undefined) ensureNumber(lastIndex);\n    return str.slice(firstIndex, lastIndex);\n}\n\nexports.split = function (str, divider) {\n    ensureString(str);\n    ensureString(divider);\n    return str.split(divider);\n}\n\nexports.replace = (str, subStr, newSubStr) => {\n    ensureString(str);\n    ensureString(subStr);\n    ensureString(newSubStr);\n    while (str.indexOf(subStr) !== -1) {\n        str = str.replace(subStr, newSubStr);\n    }\n    return str;\n}\n\n\n\nfunction ensureString (string) {\n    if (typeof string !== \"string\") throw new Error(\"String type expected\");\n}\n\nfunction ensureNumber (number) {\n    if (Number.isNaN(number)) throw new Error(\"Number type expected\");\n}\n\n\n//# sourceURL=webpack:////home/marcello/mdb/%5B_%5D_Progetti/%5B_%5D_OnLabs.org/%5B_%5D_olojs/lib/expression/stdlib/text.js?");

/***/ })

}]);