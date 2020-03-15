#!/usr/bin/env node

const fs = require('fs');
const path = require("path");


exports.parseDocumentation = function (code) {
    const re = /^\s*\/\*{2}([\s\S]+?)\*\/\s*\n/mg;

    var documentation = "";

    var match;
    while ((match = re.exec(code)) !== null) {
        let docBlock = match[0];
        docBlock = docBlock.replace(/^\s*$/mg, "");                 // remove empty lines
        docBlock = docBlock.replace(/^\s*\/\*{2}.*$/mg, "  \n");    // remove `/**` lines
        docBlock = docBlock.replace(/^\s*\*\/\s*$/mg, "  \n");      // remove ` */` lines
        docBlock = docBlock.replace(/^\s*\*$/mg, "  \n");               // remove leading `*` from empty lines
        docBlock = docBlock.replace(/^\s*\*\s{2}/mg, "");           // remove leading ` *  ` from lines
        documentation += docBlock;
    }

    return documentation;
}


exports.extractDocumentation = function (origPath) {
    const code = fs.readFileSync(origPath, 'utf8');
    return exports.parseDocumentation(code);
}


exports.generateDocumentation = function (origPath, destPath) {
    const documentation = exports.extractDocumentation(origPath);
    fs.writeFileSync(destPath, documentation);
}


if (require.main === module) {
    const filePath = path.join(process.cwd(), process.argv[2]);
    const documentation = exports.extractDocumentation(filePath);
    console.log(documentation);
}
