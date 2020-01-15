const expect = require("chai").expect;

const Environment = require("../lib/environment");
const Document = require("../lib/document");

describe("env = new Environment(config)", () => {
    
    describe("source = await doc.fetch(path)", () => {
        
        it("should return the source mapped to the given path", async () => {
            var env = new Environment({
                globals: {pi: 3.14},
                loaders: {
                    "/path/to": subPath => `Document at /path/to${subPath}`,
                    "/path/to/store1": subPath => `Document at /path/to/store1${subPath}`,
                }
            });
            
            var source = await env.fetch("/path/to/store1/path/to/doc1");
            expect(source).to.equal("Document at /path/to/store1/path/to/doc1");
                        
            var source = await env.fetch("/path/to/store2/path/to/doc2");
            expect(source).to.equal("Document at /path/to/store2/path/to/doc2");
        });
        
        it("should throw an error if no loader is defined for the given path", async () => {
            var env = new Environment({
                globals: {pi: 3.14},
                loaders: {
                    "/path/to": subPath => `Document at /path/to${subPath}`,
                    "/path/to/store1": subPath => `Document at /path/to/store1${subPath}`,
                }
            });
            
            class ExceptionExpected extends Error {};
            try {
                await env.fetch("/unmapped-store/path/to/doc");
                throw new ExceptionExpected();
            } catch (e) {
                expect(e).to.not.be.instanceof(ExceptionExpected);
                expect(e.message).to.equal("Loader not defined for path /unmapped-store/path/to/doc");
            }
        });
    });
    
    describe("doc = await env.load(path)", () => {
        
        it("should return a document instance", async () => {
            var env = new Environment({
                globals: {pi: 3.14},
                loaders: {
                    "/path/to": subPath => `Document at /path/to${subPath}`,
                }
            });            
            var doc = await env.load("/path/to/store1/path/to/doc1");
            expect(doc).to.be.instanceof(Document);            
        });
        
        it("should set the document globals to the environment globals", async () => {
            var env = new Environment({
                globals: {pi: 3.14},
                loaders: {
                    "/path/to": subPath => `Document at /path/to${subPath}`,
                }
            });
            var doc = await env.load("/path/to/store1/path/to/doc1");
            expect(doc.globals).to.equal(env.globals);
        });

        it("should fill the document locals with the document path", async () => {
            var env = new Environment({
                globals: {pi: 3.14},
                loaders: {
                    "/path/to": subPath => `Document at /path/to${subPath}`,
                }
            });
            var doc = await env.load("/path/to/store1/path/to/doc1");
            expect(doc.locals.path).to.equal("/path/to/store1/path/to/doc1");
        });
    });    
});
