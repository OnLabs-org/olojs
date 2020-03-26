/**
 *  # BrowserEnvironment class
 *
 *  This class extends the [Environment](./environment.md) class in order to
 *  create and olojs environment suitable for browsers.
 */

const Environment = require("../lib/environment");
const document = require("../lib/document");
const HTTPStore = require("../lib/environment/http-store");
const parseParams = require("../lib/tools/parameters-parser");
const DOMPurify = require("dompurify");    


class BrowserEnvironment extends Environment {


    /**
     *  ### new BrowserEnvironment(origin, headers)
     *  This environment creates three stores:
     *  - `/`: backed by the http store under `origin`
     *  - `http://`: generic http reader
     *  - `https://`: generic https reader
     *  The root http reader `/` adds the passed headers to every request
     *  
     *  The environment globals contain a `require` function that loads the
     *  [olojs standard library](./stdlib.md) modules.
     */
    constructor (origin, headers={}) {
        super({
            globals: {
                require: require("../lib/stdlib/browser-require"),
                $renderError (error) {
                    console.error(error);
                    return `<span style="color:red; font-weight:bold">${error.message}</span>`;
                }
            },
            stores: {
                "/":        new HTTPStore(origin, {headers}),
                "http://":  HTTPStore.createReader("http://"),
                "https://": HTTPStore.createReader("https://"),
            }
        })
    }
    
    /**
     *  ### BrowserEnvironment.renderNamespace(namespace)
     *  This method renders and sanitizes a document namespace.
     */
    async renderNamespace (namespace) {
        const html = await super.renderNamespace(namespace);
        return DOMPurify.sanitize(html);
    }
    
    /**
     *  ### BrowserEnvironment.parseURI(uri)
     *  Given an uri in the form `path?var1=val1&var2=val2&...`, returns
     *  a the path and the parameters namespace as a pair [docPath, argns]
     */
    parseURI (uri) {
        let [docPath, args] = uri.split("?");
        let argns = args ? parseParams(...args.split("&")) : {};
        return [docPath, argns];
    }
}


module.exports = BrowserEnvironment;
