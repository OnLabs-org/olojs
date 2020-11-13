var expect = require("chai").expect;
var MemoryStore = require("../lib/stores/memory");



describe("MemoryStore", () => {
    
    describe("source = await memoryStore.get(path)", () => {
        
        it("should return the document source mapped to the given path", async () => {
            var memStore = new MemoryStore({
                "/path/to/doc1": "doc1 source",
                "doc2": "doc2 source",
            });
            
            expect(await memStore.get("/path/to/doc1")).to.equal("doc1 source");
            expect(await memStore.get("path/to/doc1")).to.equal("doc1 source");
            expect(await memStore.get("/path/to/../to/./doc1")).to.equal("doc1 source");

            expect(await memStore.get("/doc2")).to.equal("doc2 source");
            expect(await memStore.get("doc2")).to.equal("doc2 source");
            expect(await memStore.get("/path/to/../../doc2")).to.equal("doc2 source");
        });

        it("should return an empty string if the path doesn't exist", async () => {
            var memStore = new MemoryStore();
            expect(await memStore.get('/path/to/doc')).to.equal("")                
        });            
    });    
    
    describe("names = await memoryStore.list(path)", () => {
        
        it("should return an array containing the list of the child items of the given path", async () => {
            var memStore = new MemoryStore({
                "/path/to/doc1": "...",
                "/path/to/doc2": "...",
                "/path/to/dir1/": "...",
                "/path/to/dir1/doc1": "...",
                "/path/to/dir1/doc2": "...",
                "/path/to/dir2/": "...",
            });
            
            expect((await memStore.list("/path/to/")).sort()).to.deep.equal(['dir1/', 'dir2/', 'doc1', 'doc2']);
            expect((await memStore.list("path/to/")).sort()).to.deep.equal(['dir1/', 'dir2/', 'doc1', 'doc2']);
            expect((await memStore.list("path/to")).sort()).to.deep.equal(['dir1/', 'dir2/', 'doc1', 'doc2']);
            expect((await memStore.list("/path/../path/to")).sort()).to.deep.equal(['dir1/', 'dir2/', 'doc1', 'doc2']);

            expect(await memStore.list("/path/")).to.deep.equal(['to/']);
            expect(await memStore.list("path/")).to.deep.equal(['to/']);
            expect(await memStore.list("path")).to.deep.equal(['to/']);
            expect(await memStore.list("/path/")).to.deep.equal(['to/']);

            expect(await memStore.list("/")).to.deep.equal(['path/']);
            expect(await memStore.list("")).to.deep.equal(['path/']);
            expect(await memStore.list("/path/..")).to.deep.equal(['path/']);
        });
        
        it("should return an empty array if the given path doesn't exist", async () => {
            var memStore = new MemoryStore({
                "/path/to/doc1": "...",
                "/path/to/doc2": "...",
                "/path/to/dir1/": "...",
                "/path/to/dir1/doc1": "...",
                "/path/to/dir1/doc2": "...",
                "/path/to/dir2/": "...",
            });
            expect(await memStore.list("/path/to/dir3/")).to.deep.equal([]);            
        });
    });
    
    describe("await memoryStore.set(path, source)", () => {        
        
        it("should map the given source to the given path", async () => {
            var memStore = new MemoryStore();
            await memStore.set("/path/to/doc1", "doc1 source");
            await memStore.set("doc2", "doc2 source");
            
            expect(await memStore.get("/path/to/doc1")).to.equal("doc1 source");
            expect(await memStore.get("/doc2")).to.equal("doc2 source");
        });
    });

    describe("await memoryStore.delete(path)", () => {        
        it("should remove the mappng to the given path, if it exists", async () => {
            var memStore = new MemoryStore({
                "/path/to/doc1": "doc1 source",
                "doc2": "doc2 source",
            });
            
            expect(await memStore.get("/path/to/doc1")).to.equal("doc1 source");
            await memStore.delete("/path/to/doc1");
            expect(await memStore.get("/path/to/doc1")).to.equal("");

            expect(await memStore.get("/doc2")).to.equal("doc2 source");
            await memStore.delete("/path/to/../../doc2");
            expect(await memStore.get("/doc2")).to.equal("");
        });
    });
});    
