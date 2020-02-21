const Environment = require("./environment");
const HTTPStore = require("./stores/http-store");
const stdlibStore = require("./stores/stdlib-browser-store");
const parseParams = require("./tools/parameters-parser");
const DOMPurify = require("dompurify");    


class BrowserEnvironment extends Environment {
    
    constructor (origin, headers={}) {
        super({
            stores: {
                "/":        new HTTPStore(origin, headers),
                "http://":  new HTTPStore("http:/", headers),
                "https://": new HTTPStore("https:/", headers),
                "/bin":     stdlibStore
            }
        })
    }
    
    static get Document () {
        return BrowserDocument;
    }
}


class BrowserDocument extends Environment.Document {
    
    async evaluate (queryString="?") {
        const argv = parseParams(...queryString.slice(1).split("&"));
        const parentContent = await super.evaluate({argv});
        const content = Object.create(parentContent);
        content.render = async () => DOMPurify.sanitize(await parentContent.render());
        return content;
    }
    
    static renderError (error) {
        return `<span style="color:red; font-weight:bold">${super.renderError(error)}</span>`
    }
}



module.exports = BrowserEnvironment;