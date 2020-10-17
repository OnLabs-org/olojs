const expect = require("chai").expect;
const Path = require('path');
const olojs = require("..");


describe("olojs", () => {
    
    it("should export the `expression` module", () => {
        expect(olojs.expression).to.equal(require("../lib/expression"));
    });

    it("should export the `document` module", () => {
        expect(olojs.expression).to.equal(require("../lib/expression"));
    });
    
    it("should export the `stores/empty` module", () => {
        expect(olojs.stores.Empty).to.equal(require("../lib/stores/empty"));
    });

    it("should export the `stores/memory` module", () => {
        expect(olojs.stores.Memory).to.equal(require("../lib/stores/memory"));
    });

    it("should export the `stores/file` module", () => {
        expect(olojs.stores.File).to.equal(require("../lib/stores/file"));
    });
    
    it("should export the `stores/fs` module", () => {
        expect(olojs.stores.FS).to.equal(require("../lib/stores/fs"));
    });

    it("should export the `stores/http` module exports", () => {
        expect(olojs.stores.HTTP).to.equal(require("../lib/stores/http"));
    });

    it("should export the `stores/http` module exports", () => {
        expect(olojs.stores.Router).to.equal(require("../lib/stores/router"));
    });

    it("should export the `environment` module", () => {
        expect(olojs.Environment).to.equal(require("../lib/environment"));
    });
    
    it("should export the `servers/http` module", () => {
        expect(olojs.servers.http).to.equal(require("../lib/servers/http"));
    });
    
    require("./expression");
    require("./stdlib");    
    require("./document");
    require("./stores");
    require("./environment");
    require("./http-server");    
});
