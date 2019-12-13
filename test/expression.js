var expect = require("chai").expect;
var {parse, createContext, evaluate} = require("../lib/expression");



class ExceptionExpected extends Error {}

async function expectError (testFn, message) {
    try {
        await testFn();
        throw new ExceptionExpected();
    } catch (e) {
        expect(e).to.be.not.instanceof(ExceptionExpected);
        expect(e.message).to.equal(message);
    }    
}


describe("expression", () => {
    
    describe("numeric literals", () => {
        
        it("should evaluate numeric literals", async () => {
            var ctx = createContext();
            expect(await evaluate("10", ctx)).to.equal(10);
        });
    });
    
    describe("string literals", () => {
        
        it("should evaluate string literals", async () => {
            var ctx = createContext();
            expect(await evaluate(`"abc"`, ctx)).to.equal("abc");
            expect(await evaluate(`'def'`, ctx)).to.equal("def");
            expect(await evaluate("`ghi`", ctx)).to.equal("ghi");
        });        
    });
    
    describe("tuples: X,Y", () => {
        
        it("should return the comma-separated values as an iterable", async () => {
            var ctx = createContext();
            var tuple = await evaluate("10,'abc'", ctx);
            expect(tuple[Symbol.iterator]).to.be.a("function");
            expect(Array.from(tuple)).to.deep.equal([10,"abc"]);            
        });

        it("should flatten tuples of tuples: `(X,Y),Z` results in `X,Y,Z`", async () => {
            var ctx = createContext();
            var tuple = await evaluate("1,(2,3),4,(5,(6,7)),8,9", ctx);
            expect(tuple[Symbol.iterator]).to.be.a("function");
            expect(Array.from(tuple)).to.deep.equal([1,2,3,4,5,6,7,8,9]);
        });

        it("should evaluate empty tuples `()` as null", async () => {
            var ctx = createContext();
            expect(await evaluate("", ctx)).to.equal(null);
            expect(await evaluate("()", ctx)).to.equal(null);
        });

        it("should ignore empty tuples when flattening tuples: `X,(),Y` results in `X,Y`", async () => {
            var ctx = createContext();
            var tuple = await evaluate("1,(),3", ctx);
            expect(tuple[Symbol.iterator]).to.be.a("function");
            expect(Array.from(tuple)).to.deep.equal([1,3]);
        });
    });
    
    describe("names", () => {
        
        it("should return the value mapped to the name in the current context", async () => {
            var ctx = createContext({a:10, _b:20});
            expect(await evaluate("a", ctx)).to.equal(10);
            expect(await evaluate("_b", ctx)).to.equal(20);
        });
        
        it("should return `null` (empty tuple) if the name is not mapped", async () => {
            var ctx = createContext({a:10, _b:20});
            expect(await evaluate("d", ctx)).to.equal(null);
        });        
        
        describe("when in a child context", () => {
            
            it("should return the child name value if name is mapped in the child context", async () => {
                var ctx = createContext({a:10, b:20});
                var cctx = ctx.createChildContext({a:100});
                expect(await evaluate("a", cctx)).to.equal(100);
            });

            it("should return the parent name value if name is not mapped in the child context", async () => {
                var ctx = createContext({a:10, b:20});
                var cctx = ctx.createChildContext({a:100});
                expect(await evaluate("b", cctx)).to.equal(20);
            });

            it("should return null if name is not mapped in the child context nor in the parent context", async () => {
                var ctx = createContext({a:10, b:20});
                var cctx = ctx.createChildContext({a:100});
                expect(await evaluate("c", cctx)).to.equal(null);                            
            });
        });
    });
    
    describe("lists: [X,Y]", () => {
        
        it("should return an array", async () => {
            var ctx = createContext();
            expect(await evaluate("[1,2,3]", ctx)).to.deep.equal([1,2,3]);
            expect(await evaluate("[1]", ctx)).to.deep.equal([1]);
            expect(await evaluate("[]", ctx)).to.deep.equal([]);
        });
        
        it("should not flatten deep lists", async () => {
            var ctx = createContext();
            expect(await evaluate("[[1,2],3,4,[]]", ctx)).to.deep.equal([[1,2],3,4,[]]);            
        });
    });
    
    describe("assignment operation: name = X", () => {
        
        it("should return null", async () => {
            var ctx = createContext();
            expect(await evaluate("x = 10", ctx)).to.be.null;            
        });

        it("should create a new name in the current context and map it to the given value", async () => {
            var ctx = createContext();            
            await evaluate("x = 10", ctx);
            expect(ctx.unwrap().x).to.equal(10);            
        });
        
        it("should assign a tuple of values to a tuple of names", async () => {
            var ctx = createContext();            
            await evaluate("(a,b,c) = (1,2,3)", ctx);
            expect(ctx.unwrap().a).to.equal(1);        
            expect(ctx.unwrap().b).to.equal(2);        
            expect(ctx.unwrap().c).to.equal(3);        
        });
        
        it("should assign null to the last names if the values tuple is smaller than the names tuple", async () => {
            var ctx = createContext();
            await evaluate("(a,b,c) = (10,20)", ctx);
            expect(ctx.unwrap().a).to.equal(10);        
            expect(ctx.unwrap().b).to.equal(20);        
            expect(ctx.unwrap().c).to.be.null;                    
        });
        
        it("should assign to the last name the tuple of remaining values if the names tuple is smaller than the values tuple", async () => {            
            var ctx = createContext();
            
            await evaluate("(a,b) = (100,200,300)", ctx);
            expect(ctx.unwrap().a).to.equal(100);        
            var b = ctx.unwrap().b;
            expect(b[Symbol.iterator]).to.be.a("function");
            expect(Array.from(b)).to.deep.equal([200,300]);
            
            await evaluate("c = (10,20,30)", ctx);
            var c = ctx.unwrap().c;
            expect(c[Symbol.iterator]).to.be.a("function");
            expect(Array.from(c)).to.deep.equal([10,20,30]);
        });
    });

    describe("namespace definition: {X,Y,X}", () => {

        it("return an object with the mapped names", async () => {
            var ctx = createContext();                    
            expect(await evaluate("{x=1, y=2, z=3}", ctx)).to.deep.equal({x:1,y:2,z:3});
        });
        
        it("should ignore the non-assignment operations", async () => {
            var ctx = createContext();                    
            expect(await evaluate("{x=1, 10, y=2, z=3}", ctx)).to.deep.equal({x:1,y:2,z:3});
        });

        it("should not assign the names to the parent context", async () => {
            var ctx = createContext({x:10});                    
            expect(await evaluate("{x=20}", ctx)).to.deep.equal({x:20});
            expect(ctx.unwrap().x).to.equal(10);
        });
    });

    describe("function definition: name -> expression", () => {

        it("return a function resolving the expression in a context augumented with the argument names", async () => {
            var ctx = createContext();        
            var foo = await evaluate("(x, y) -> [y,x]", ctx);
            expect(foo).to.be.a("function");
            expect(await foo(10,20)).to.deep.equal([20,10]);
        });
        
        it("should follow the assignment rules when mapping argument names to parameters", async () => {
            var ctx = createContext();        

            var foo = await evaluate("(x, y) -> {a=x,b=y}", ctx);
            expect(await foo(10)).to.deep.equal({a:10, b:null});            

            var retval = await foo(10,20,30);
            expect(retval.a).to.equal(10);
            expect(retval.b[Symbol.iterator]).to.be.a("function");
            expect(Array.from(retval.b)).to.deep.equal([20,30]);
        });
    });
    
    describe("'apply' operation: X Y", async () => {
        
        it("should call X with the parameter Y, if X is a function", async () => {
            var ctx = createContext({
                double: x => 2 * x,
                sum: (x,y) => x + y
            });                    
            expect(await evaluate("(x -> [x]) 10", ctx)).to.deep.equal([10]);
            expect(await evaluate("((x, y) -> [y,x])(10, 20)", ctx)).to.deep.equal([20,10]);
            expect(await evaluate("double 25", ctx)).to.equal(50);
            expect(await evaluate("sum(10, 20)", ctx)).to.equal(30);
        });
        
        it("should return the Y-th item if X is a list", async () => {
            var ctx = createContext({
                x: [10,20,30]
            });                    
            expect(await evaluate("x 1", ctx)).to.equal(10);            
            expect(await evaluate("x 2", ctx)).to.equal(20);            
            expect(await evaluate("x 3", ctx)).to.equal(30);                        
            expect(await evaluate("x 4", ctx)).to.equal(null);                        
            expect(await evaluate("x (-1)", ctx)).to.equal(30);                        
            expect(await evaluate("x (-2)", ctx)).to.equal(20);                        
            expect(await evaluate("x (-3)", ctx)).to.equal(10);                        
            expect(await evaluate("x (-4)", ctx)).to.equal(null);                        
            expect(await evaluate("x [1,2,3]", ctx)).to.equal(null);                        
            expect(await evaluate("x (3,2,1)", ctx)).to.equal(null);                        
        });
        
        it("should return the Y-th character if X is a string", async () => {
            var ctx = createContext({x:"abc"});                    
            expect(await evaluate("x 1", ctx)).to.equal('a');            
            expect(await evaluate("x 2", ctx)).to.equal('b');            
            expect(await evaluate("x 3", ctx)).to.equal('c');                        
            expect(await evaluate("x 4", ctx)).to.equal('');                        
            expect(await evaluate("x (-1)", ctx)).to.equal('c');                        
            expect(await evaluate("x (-2)", ctx)).to.equal('b');                        
            expect(await evaluate("x (-3)", ctx)).to.equal('a');                        
            expect(await evaluate("x (-4)", ctx)).to.equal('');                        
            expect(await evaluate("x [1,2,3]", ctx)).to.equal('');                        
            expect(await evaluate("x (3,2,1)", ctx)).to.equal('');                        
        });
        
        it("should return the value mapped to Y if X is a namespace", async () => {
            var ctx = createContext({x: {a:1,b:2,c:3}});                    
            expect(await evaluate("x 'a'", ctx)).to.equal(1);            
            expect(await evaluate("x 'b'", ctx)).to.equal(2);            
            expect(await evaluate("x 'c'", ctx)).to.equal(3);                        
            expect(await evaluate("x 'd'", ctx)).to.equal(null);                        
            expect(await evaluate("x ['a','b','c']", ctx)).to.equal(null);                        
            expect(await evaluate("x ('a','b','c')", ctx)).to.equal(null);                        
        });
        
        it("should return a tuple obtained by calling the items of X if X is a tuple", async () => {
            var ctx = createContext({
                x2: a => 2*a,
                x3: a => 3*a,
                x4: a => 4*a,
            });
            var retval = await evaluate("(x2,x3,x4) 2", ctx);
            expect(retval[Symbol.iterator]).to.be.a("function");
            expect(Array.from(retval)).to.deep.equal([4,6,8]);
        });

        it("should return X if it is of any other type", async () => {
            var ctx = createContext({T:true, F:false});              
            expect(await evaluate("() 'param'", ctx)).to.equal(null);                        
            expect(await evaluate("T 'param'", ctx)).to.equal(true);                        
            expect(await evaluate("F 'param'", ctx)).to.equal(false);                        
            expect(await evaluate("10 'param'", ctx)).to.equal(10);                        
        });
    });    
    
    describe("sub-context evaluation: X.Y", () => {
        
        it("should evaluate 'Y' in the 'X' context if 'X' is a namespace", async () => {
            var ctx = createContext({x:10});
            await evaluate("ns = {y=20, z=30, _h=40}", ctx);
            expect(await evaluate("ns.y", ctx)).to.equal(20);
            expect(await evaluate("ns.[1,y,z]", ctx)).to.deep.equal([1,20,30]);
            expect(await evaluate("ns.x", ctx)).to.equal(10);
            expect(await evaluate("ns._h", ctx)).to.equal(40);

            var ctx = createContext({ns:{x:10,y:20,z:30}});
            expect(await evaluate("ns.[x,y,z]", ctx)).to.deep.equal([10,20,30]);
        });

        it("should throw an error if 'X' is of any other type", async () => {
            var ctx = createContext();
            await expectError(() => evaluate("().name", ctx), "Namespace expected on the left size of the '.' operator");
            await expectError(() => evaluate("(10).name", ctx), "Namespace expected on the left size of the '.' operator");
            await expectError(() => evaluate("[].name", ctx), "Namespace expected on the left size of the '.' operator");
            await expectError(() => evaluate("(x->x).name", ctx), "Namespace expected on the left size of the '.' operator");
        });
    });
    
    describe("size X", () => {
        
        it("should return 0 if X is nothing", async () => {
            var ctx = createContext();
            expect(await evaluate("size()", ctx)).to.equal(0);
        });
        
        it("should return 0 if x is `false` and 1 if x is `true`", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("size T", ctx)).to.equal(1);
            expect(await evaluate("size F", ctx)).to.equal(0);
        });
        
        it("should return |x| if X is a number", async () => {
            var ctx = createContext();
            expect(await evaluate("size 0", ctx)).to.equal(0);
            expect(await evaluate("size 3.5", ctx)).to.equal(3.5);
            expect(await evaluate("size(-4)", ctx)).to.equal(4);
        });
        
        it("should return the numer of characters of X if it is a string", async () => {
            var ctx = createContext();
            expect(await evaluate("size 'abc'", ctx)).to.equal(3);
            expect(await evaluate("size ''", ctx)).to.equal(0);
        });
        
        it("should return the numer of items of X if it is a list", async () => {
            var ctx = createContext();
            expect(await evaluate("size [10,20,30]", ctx)).to.equal(3);
            expect(await evaluate("size []", ctx)).to.equal(0);
        });

        it("should return the numer of names of X if it is a namespace", async () => {
            var ctx = createContext({ns:{x:'abc',y:'def'}});
            expect(await evaluate("size {a=10,b=20,c=30}", ctx)).to.equal(3);
            expect(await evaluate("size {}", ctx)).to.equal(0);
            expect(await evaluate("size ns", ctx)).to.equal(2);
        });
        
        it("should return 1 if X is a function", async () => {
            var ctx = createContext({jsFn:x=>2*x});
            expect(await evaluate("size (x->x)", ctx)).to.equal(1);
            expect(await evaluate("size jsFn", ctx)).to.equal(1);
        });

        it("should return the sum of the item sizes if X is a tuple", async () => {
            var ctx = createContext();
            expect(await evaluate("size(2,'abc',[1,2,3,4])", ctx)).to.equal(9);
        });
    });    

    describe("bool X", () => {
        
        it("should return `true` if `size x` is not 0, otherwise `false`", async () => {
            var ctx = createContext({T:true, F:false, jsFn:x=>2*x});
            
            expect(await evaluate("bool ()", ctx)).to.equal(false);
            
            expect(await evaluate("bool F", ctx)).to.equal(false);
            expect(await evaluate("bool T", ctx)).to.equal(true);

            expect(await evaluate("bool 0", ctx)).to.equal(false);
            expect(await evaluate("bool 10", ctx)).to.equal(true);
            expect(await evaluate("bool (-1)", ctx)).to.equal(true);

            expect(await evaluate("bool ''", ctx)).to.equal(false);
            expect(await evaluate("bool 'abc'", ctx)).to.equal(true);

            expect(await evaluate("bool []", ctx)).to.equal(false);
            expect(await evaluate("bool [1,2,3]", ctx)).to.equal(true);

            expect(await evaluate("bool {}", ctx)).to.equal(false);
            expect(await evaluate("bool {a=1,b=2,c=3}", ctx)).to.equal(true);

            expect(await evaluate("bool (x->x)", ctx)).to.equal(true);
            expect(await evaluate("bool jsFn", ctx)).to.equal(true);

            expect(await evaluate("bool (0,0,0)", ctx)).to.equal(false);
            expect(await evaluate("bool (0,1,-1)", ctx)).to.equal(true);
        });
    });

    describe("not X", () => {
        
        it("should return `true` if `size x` is 0, otherwise `false`", async () => {
            var ctx = createContext({T:true, F:false, jsFn:x=>2*x});
            
            expect(await evaluate("not ()", ctx)).to.equal(true);
            
            expect(await evaluate("not F", ctx)).to.equal(true);
            expect(await evaluate("not T", ctx)).to.equal(false);

            expect(await evaluate("not 0", ctx)).to.equal(true);
            expect(await evaluate("not 10", ctx)).to.equal(false);
            expect(await evaluate("not (-1)", ctx)).to.equal(false);

            expect(await evaluate("not ''", ctx)).to.equal(true);
            expect(await evaluate("not 'abc'", ctx)).to.equal(false);

            expect(await evaluate("not []", ctx)).to.equal(true);
            expect(await evaluate("not [1,2,3]", ctx)).to.equal(false);

            expect(await evaluate("not {}", ctx)).to.equal(true);
            expect(await evaluate("not {a=1,b=2,c=3}", ctx)).to.equal(false);

            expect(await evaluate("not (x->x)", ctx)).to.equal(false);
            expect(await evaluate("not jsFn", ctx)).to.equal(false);

            expect(await evaluate("not (0,0,0)", ctx)).to.equal(true);
            expect(await evaluate("not (0,1,-1)", ctx)).to.equal(false);
        });
    });

    describe("X or Y", () => {
        
        it("should return true only if any of `bool X` or `bool Y` is true", async () => {
            var ctx = createContext({T:true, F:false});
            
            // true or true
            expect(await evaluate("T or T", ctx)).to.be.true;
            expect(await evaluate("T or 10", ctx)).to.be.true;
            expect(await evaluate("10 or T", ctx)).to.be.true;
            expect(await evaluate("10 or 10", ctx)).to.be.true;
            
            // true or false
            expect(await evaluate("T or F", ctx)).to.be.true;
            expect(await evaluate("T or 0", ctx)).to.be.true;
            expect(await evaluate("10 or F", ctx)).to.be.true;
            expect(await evaluate("10 or 0", ctx)).to.be.true;
            
            // false or true
            expect(await evaluate("F or T", ctx)).to.be.true;
            expect(await evaluate("F or 10", ctx)).to.be.true;
            expect(await evaluate("0 or T", ctx)).to.be.true;
            expect(await evaluate("0 or 10", ctx)).to.be.true;
            
            // false or false
            expect(await evaluate("F or F", ctx)).to.be.false;
            expect(await evaluate("F or 0", ctx)).to.be.false;
            expect(await evaluate("0 or F", ctx)).to.be.false;
            expect(await evaluate("0 or 0", ctx)).to.be.false;
        })
    });

    describe("X and Y", () => {
        
        it("should return true only if both of `bool X` and `bool Y` are true", async () => {
            var ctx = createContext({T:true, F:false});
            
            // true and true
            expect(await evaluate("T and T", ctx)).to.be.true;
            expect(await evaluate("T and 10", ctx)).to.be.true;
            expect(await evaluate("10 and T", ctx)).to.be.true;
            expect(await evaluate("10 and 10", ctx)).to.be.true;
            
            // true and false
            expect(await evaluate("T and F", ctx)).to.be.false;
            expect(await evaluate("T and 0", ctx)).to.be.false;
            expect(await evaluate("10 and F", ctx)).to.be.false;
            expect(await evaluate("10 and 0", ctx)).to.be.false;
            
            // false and true
            expect(await evaluate("F and T", ctx)).to.be.false;
            expect(await evaluate("F and 10", ctx)).to.be.false;
            expect(await evaluate("0 and T", ctx)).to.be.false;
            expect(await evaluate("0 and 10", ctx)).to.be.false;
            
            // false and false
            expect(await evaluate("F and F", ctx)).to.be.false;
            expect(await evaluate("F and 0", ctx)).to.be.false;
            expect(await evaluate("0 and F", ctx)).to.be.false;
            expect(await evaluate("0 and 0", ctx)).to.be.false;
        })
    });
    
    describe("X if Y", () => {
        
        it("should return X is `bool Y` is true, or else null", async () => {
            var ctx = createContext({T:true, F:false});
            
            // Y is true
            expect(await evaluate("[1,2,3] if T", ctx)).to.deep.equal([1,2,3]);
            expect(await evaluate("[1,2,3] if 10", ctx)).to.deep.equal([1,2,3]);
            
            // Y is false
            expect(await evaluate("[1,2,3] if F", ctx)).to.be.null;
            expect(await evaluate("[1,2,3] if 0", ctx)).to.be.null;
        })
    });    

    describe("X else Y", () => {
        
        it("should return X if not `null`, otherwise Y", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("[1,2,3] else [3,4,5]", ctx)).to.deep.equal([1,2,3]);
            expect(await evaluate("() else [3,4,5]", ctx)).to.deep.equal([3,4,5]);
        });
    });    

    describe("map fn", () => {
        
        it("should return a function that maps its arguments one by one via fn", async () => {
            var ctx = createContext({T:true, F:false, fn:x=>2*x});
            const mappingFn = await evaluate("map fn", ctx);
            expect(mappingFn).to.be.a("function");
            const mappedValues = await evaluate("map fn (1,2,3,4)", ctx);
            expect(mappedValues[Symbol.iterator]).to.be.a("function");
            expect(Array.from(mappedValues)).to.deep.equal([2,4,6,8]);
        });

        it("should work with any type", async () => {
            var ctx = createContext({T:true, F:false, fn:x=>2*x});
            expect(await evaluate("map () (1,2,3)", ctx)).to.be.null;
            expect(Array.from(await evaluate("map F (1,2,3)", ctx))).to.deep.equal([false, false, false]);
            expect(Array.from(await evaluate("map T (1,2,3)", ctx))).to.deep.equal([true, true, true]);
            expect(Array.from(await evaluate("map 10 (1,2,3)", ctx))).to.deep.equal([10, 10, 10]);
            expect(Array.from(await evaluate("map 'abcdef' (1,3,5)", ctx))).to.deep.equal(['a', 'c', 'e']);
            expect(Array.from(await evaluate("map [10,20,30,40,50] (1,3,5)", ctx))).to.deep.equal([10, 30, 50]);
            expect(Array.from(await evaluate("map {a=1,b=2,c=3} ('a','c')", ctx))).to.deep.equal([1, 3]);
            expect(Array.from(await evaluate("map (fn,20,'abc') (1,2)", ctx))).to.deep.equal([2,20,'a', 4,20,'b']);
        });
    });
    
    describe("red fn", () => {

        it("should return a reducer function based on f(x,y)", async () => {
            var ctx = createContext({T:true, F:false, fn:(x,y)=>x+y});
            expect(await evaluate("red fn", ctx)).to.be.a("function");
            expect(await evaluate("red fn (1,2,3,4)", ctx)).to.equal(1+2+3+4);
        });

        it("should work with any type", async () => {
            var ctx = createContext({T:true, F:false});
            
            expect(await evaluate("red ()", ctx)).to.be.a("function");
            expect(await evaluate("red () (1,2,3)", ctx)).to.equal(null);
            
            expect(await evaluate("red F", ctx)).to.be.a("function");
            expect(await evaluate("red F (1,2,3)", ctx)).to.equal(false);

            expect(await evaluate("red T", ctx)).to.be.a("function");
            expect(await evaluate("red T (1,2,3)", ctx)).to.equal(true);

            expect(await evaluate("red 10", ctx)).to.be.a("function");
            expect(await evaluate("red 10 (1,2,3)", ctx)).to.equal(10);

            expect(await evaluate("red 'abc'", ctx)).to.be.a("function");
            expect(await evaluate("red 'abc' (1,2,3)", ctx)).to.equal("");

            expect(await evaluate("red [10,20,30]", ctx)).to.be.a("function");
            expect(await evaluate("red [10,20,30] (1,2,3)", ctx)).to.equal(30);

            expect(await evaluate("red {a=1,b=2}", ctx)).to.be.a("function");            
            expect(await evaluate("red {a=1,b=2,c=3} ('a','b','c')", ctx)).to.equal(3);            
        });
    });
    
    describe("X + Y", () => {
        
        it("should return Y if X is nothing", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("() + ()", ctx)).to.equal(null);
            expect(await evaluate("() + T", ctx)).to.equal(true);
            expect(await evaluate("() + F", ctx)).to.equal(false);
            expect(await evaluate("() + 10", ctx)).to.equal(10);
            expect(await evaluate("() + 'abc'", ctx)).to.equal("abc");
            expect(await evaluate("() + fn", ctx)).to.equal(ctx.unwrap().fn);
            expect(await evaluate("() + ls", ctx)).to.deep.equal([1,2,3]);
            expect(await evaluate("() + ns", ctx)).to.deep.equal({a:1,b:2,c:3});
            
            var tuple = await evaluate("() + (1,2,3)", ctx);
            expect(tuple[Symbol.iterator]).to.be.a("function");
            expect(Array.from(tuple)).to.deep.equal([1,2,3]);
        });
        
        it("should return X if Y is nothing", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("() + ()", ctx)).to.equal(null);
            expect(await evaluate("T + ()", ctx)).to.equal(true);
            expect(await evaluate("F + ()", ctx)).to.equal(false);
            expect(await evaluate("10 + ()", ctx)).to.equal(10);
            expect(await evaluate("'abc' + ()", ctx)).to.equal("abc");
            expect(await evaluate("fn + ()", ctx)).to.equal(ctx.unwrap().fn);
            expect(await evaluate("ls + ()", ctx)).to.deep.equal([1,2,3]);
            expect(await evaluate("ns + ()", ctx)).to.deep.equal({a:1,b:2,c:3});
            
            var tuple = await evaluate("(1,2,3) + ()", ctx);
            expect(tuple[Symbol.iterator]).to.be.a("function");
            expect(Array.from(tuple)).to.deep.equal([1,2,3]);
        });
        
        it("should return `X||Y` if both X and Y are booleans", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("T + T", ctx)).to.be.true;
            expect(await evaluate("T + F", ctx)).to.be.true;
            expect(await evaluate("F + T", ctx)).to.be.true;
            expect(await evaluate("F + F", ctx)).to.be.false;
        });
        
        it("should return `X+Y` if both X and Y are numbers", async () => {
            var ctx = createContext();
            expect(await evaluate("10 + 1", ctx)).to.equal(11);
            expect(await evaluate("10 + 0", ctx)).to.equal(10);
            expect(await evaluate("10 + (-2)", ctx)).to.equal(8);
        });
        
        it("should concatenate X and Y if they are both strings", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("'abc' + 'def'", ctx)).to.equal("abcdef");
            expect(await evaluate("'abc' + ''", ctx)).to.equal("abc");
            expect(await evaluate("'' + 'def'", ctx)).to.equal("def");
        });
        
        it("should concatenate X and Y if they are both lists", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("[1,2,3] + [4,5,6]", ctx)).to.deep.equal([1,2,3,4,5,6]);
            expect(await evaluate("[1,2,3] + []", ctx)).to.deep.equal([1,2,3]);
            expect(await evaluate("[] + [4,5,6]", ctx)).to.deep.equal([4,5,6]);
        });
        
        it("should merge X and Y if they are both namespaces", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("{a=1,b=2} + {b=20,c=30}", ctx)).to.deep.equal({a:1,b:20,c:30});
            expect(await evaluate("{a=1,b=2} + {}", ctx)).to.deep.equal({a:1,b:2});
            expect(await evaluate("{} + {b=20,c=30}", ctx)).to.deep.equal({b:20,c:30});
        });
        
        it("should throw a runtime error for all the other singleton types", async () => {
            var ctx0 = createContext({T:true, F:false});
            var expectSumError = (expression, XType, YType) => expectError(() => evaluate(expression,ctx), `Sum operation not defined between ${XType} and ${YType}`);
            
            var LTYPE = "BOOLEAN", ctx = ctx0.createChildContext({L:true}); 
            await expectSumError("L + 1"       , LTYPE, "NUMBER");
            await expectSumError("L + 'abc'"   , LTYPE, "STRING");
            await expectSumError("L + [1,2,3]" , LTYPE, "LIST");
            await expectSumError("L + {a=1}"   , LTYPE, "NAMESPACE");
            await expectSumError("L + (x->x)"  , LTYPE, "FUNCTION");
            
            var LTYPE = "BOOLEAN", ctx = ctx0.createChildContext({L:false});
            await expectSumError("L + 1"       , LTYPE, "NUMBER");
            await expectSumError("L + 'abc'"   , LTYPE, "STRING");
            await expectSumError("L + [1,2,3]" , LTYPE, "LIST");
            await expectSumError("L + {a=1}"   , LTYPE, "NAMESPACE");
            await expectSumError("L + (x->x)"  , LTYPE, "FUNCTION");
            
            var LTYPE = "NUMBER", ctx = ctx0.createChildContext({L:10});
            await expectSumError("L + T"       , LTYPE, "BOOLEAN");
            await expectSumError("L + F"       , LTYPE, "BOOLEAN");
            await expectSumError("L + 'abc'"   , LTYPE, "STRING");
            await expectSumError("L + [1,2,3]" , LTYPE, "LIST");
            await expectSumError("L + {a=1}"   , LTYPE, "NAMESPACE");
            await expectSumError("L + (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "STRING", ctx = ctx0.createChildContext({L:"abc"});
            await expectSumError("L + T"       , LTYPE, "BOOLEAN");
            await expectSumError("L + F"       , LTYPE, "BOOLEAN");
            await expectSumError("L + 1"       , LTYPE, "NUMBER");
            await expectSumError("L + [1,2,3]" , LTYPE, "LIST");
            await expectSumError("L + {a=1}"   , LTYPE, "NAMESPACE");
            await expectSumError("L + (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "LIST", ctx = ctx0.createChildContext({L:[1,2,3]});
            await expectSumError("L + T"       , LTYPE, "BOOLEAN");
            await expectSumError("L + F"       , LTYPE, "BOOLEAN");
            await expectSumError("L + 1"       , LTYPE, "NUMBER");
            await expectSumError("L + 'abc'"   , LTYPE, "STRING");
            await expectSumError("L + {a=1}"   , LTYPE, "NAMESPACE");
            await expectSumError("L + (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "NAMESPACE", ctx = ctx0.createChildContext({L:{a:1,b:2}});
            await expectSumError("L + T"       , LTYPE, "BOOLEAN");
            await expectSumError("L + F"       , LTYPE, "BOOLEAN");
            await expectSumError("L + 1"       , LTYPE, "NUMBER");
            await expectSumError("L + 'abc'"   , LTYPE, "STRING");
            await expectSumError("L + [1,2,3]" , LTYPE, "LIST");
            await expectSumError("L + (x->x)"  , LTYPE, "FUNCTION");
            
            var LTYPE = "FUNCTION", ctx = ctx0.createChildContext({L:x=>x});
            await expectSumError("L + T"       , LTYPE, "BOOLEAN");
            await expectSumError("L + F"       , LTYPE, "BOOLEAN");
            await expectSumError("L + 1"       , LTYPE, "NUMBER");
            await expectSumError("L + 'abc'"   , LTYPE, "STRING");
            await expectSumError("L + [1,2,3]" , LTYPE, "LIST");
            await expectSumError("L + {a=1}"   , LTYPE, "NAMESPACE");
            await expectSumError("L + (x->x)"  , LTYPE, "FUNCTION");
        });
        
        it("should return (x1+y1, x2+y2, ...) if X and/or Y is a tuple", async () => {
            var ctx = createContext({T:true, F:false});
            expect(Array.from(await evaluate("(T, 1, 'a', [1], {a=1}) + (F, 2, 'b', [2], {b=2})", ctx))).to.deep.equal([true, 3, "ab", [1,2], {a:1,b:2}])
            expect(Array.from(await evaluate("(T, 1, 'a', [1], {a=1}) + (F, 2, 'b')", ctx))).to.deep.equal([true, 3, "ab", [1], {a:1}])
            expect(Array.from(await evaluate("(T, 1, 'a') + (F, 2, 'b', [2], {b=2})", ctx))).to.deep.equal([true, 3, "ab", [2], {b:2}])
            expect(Array.from(await evaluate("10 + (1, 2, 3)", ctx))).to.deep.equal([11, 2, 3])
            expect(Array.from(await evaluate("(1, 2, 3) + 10", ctx))).to.deep.equal([11, 2, 3])
        });
    });  
    
    describe("X - Y", () => {
        
        it("should return NOTHING if X is nothing", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("() - ()", ctx)).to.equal(null);
            expect(await evaluate("() - T", ctx)).to.equal(null);
            expect(await evaluate("() - F", ctx)).to.equal(null);
            expect(await evaluate("() - 10", ctx)).to.equal(null);
            expect(await evaluate("() - 'abc'", ctx)).to.equal(null);
            expect(await evaluate("() - fn", ctx)).to.equal(null);
            expect(await evaluate("() - ls", ctx)).to.equal(null);
            expect(await evaluate("() - ns", ctx)).to.equal(null);
            expect(await evaluate("() - (1,2,3)", ctx)).to.equal(null);
        });
        
        it("should return Y if X is nothing", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("() - ()", ctx)).to.equal(null);
            expect(await evaluate("T - ()", ctx)).to.equal(true);
            expect(await evaluate("F - ()", ctx)).to.equal(false);
            expect(await evaluate("10 - ()", ctx)).to.equal(10);
            expect(await evaluate("'abc' - ()", ctx)).to.equal("abc");
            expect(await evaluate("fn - ()", ctx)).to.equal(ctx.unwrap().fn);
            expect(await evaluate("ls - ()", ctx)).to.deep.equal(ctx.unwrap().ls);
            expect(await evaluate("ns - ()", ctx)).to.deep.equal(ctx.unwrap().ns);
            expect(Array.from(await evaluate("(1,2,3) - ()", ctx))).to.deep.equal([1,2,3]);
        });
        
        it("should return `X-Y` if both X and Y are numbers", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("10 - 1", ctx)).to.equal(9);
            expect(await evaluate("20 - 0", ctx)).to.equal(20);
            expect(await evaluate("10 - (-7)", ctx)).to.equal(17);
        });
        
        it("should throw a runtime error for all the other singleton types", async () => {
            var ctx0 = createContext({T:true, F:false});
            var expectSubError = (expression, XType, YType) => expectError(() => evaluate(expression,ctx), `Subtraction operation not defined between ${XType} and ${YType}`);

            var LTYPE = "BOOLEAN", ctx = ctx0.createChildContext({L:true});
            await expectSubError("L - 10"      , LTYPE, "NUMBER");
            await expectSubError("L - 'abc'"   , LTYPE, "STRING");
            await expectSubError("L - [1,2,3]" , LTYPE, "LIST");
            await expectSubError("L - {a=1}"   , LTYPE, "NAMESPACE");
            await expectSubError("L - (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "BOOLEAN", ctx = ctx0.createChildContext({L:false});
            await expectSubError("L - 10"      , LTYPE, "NUMBER");
            await expectSubError("L - 'abc'"   , LTYPE, "STRING");
            await expectSubError("L - [1,2,3]" , LTYPE, "LIST");
            await expectSubError("L - {a=1}"   , LTYPE, "NAMESPACE");
            await expectSubError("L - (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "NUMBER", ctx = ctx0.createChildContext({L:10});
            await expectSubError("L - T"       , LTYPE, "BOOLEAN");
            await expectSubError("L - F"       , LTYPE, "BOOLEAN");
            await expectSubError("L - 'abc'"   , LTYPE, "STRING");
            await expectSubError("L - [1,2,3]" , LTYPE, "LIST");
            await expectSubError("L - {a=1}"   , LTYPE, "NAMESPACE");
            await expectSubError("L - (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "STRING", ctx = ctx0.createChildContext({L:"abc"});
            await expectSubError("L - T"       , LTYPE, "BOOLEAN");
            await expectSubError("L - F"       , LTYPE, "BOOLEAN");
            await expectSubError("L - 1"       , LTYPE, "NUMBER");
            await expectSubError("L - 'abc'"   , LTYPE, "STRING");
            await expectSubError("L - [1,2,3]" , LTYPE, "LIST");
            await expectSubError("L - {a=1}"   , LTYPE, "NAMESPACE");
            await expectSubError("L - (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "LIST", ctx = ctx0.createChildContext({L:[1,2,3]});
            await expectSubError("L - T"       , LTYPE, "BOOLEAN");
            await expectSubError("L - F"       , LTYPE, "BOOLEAN");
            await expectSubError("L - 1"       , LTYPE, "NUMBER");
            await expectSubError("L - 'abc'"   , LTYPE, "STRING");
            await expectSubError("L - [1,2,3]" , LTYPE, "LIST");
            await expectSubError("L - {a=1}"   , LTYPE, "NAMESPACE");
            await expectSubError("L - (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "NAMESPACE", ctx = ctx0.createChildContext({L:{a:1,b:2}});
            await expectSubError("L - T"       , LTYPE, "BOOLEAN");
            await expectSubError("L - F"       , LTYPE, "BOOLEAN");
            await expectSubError("L - 1"       , LTYPE, "NUMBER");
            await expectSubError("L - 'abc'"   , LTYPE, "STRING");
            await expectSubError("L - [1,2,3]" , LTYPE, "LIST");
            await expectSubError("L - {a=1}"   , LTYPE, "NAMESPACE");
            await expectSubError("L - (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "FUNCTION", ctx = ctx0.createChildContext({L:x=>x});
            await expectSubError("L - T"       , LTYPE, "BOOLEAN");
            await expectSubError("L - F"       , LTYPE, "BOOLEAN");
            await expectSubError("L - 1"       , LTYPE, "NUMBER");
            await expectSubError("L - 'abc'"   , LTYPE, "STRING");
            await expectSubError("L - [1,2,3]" , LTYPE, "LIST");
            await expectSubError("L - {a=1}"   , LTYPE, "NAMESPACE");
            await expectSubError("L - (x->x)"  , LTYPE, "FUNCTION");
        });
        
        it("should return (x1-y1, x2-y2, ...) if X and/or Y is a tuple", async () => {
            var ctx = createContext({T:true, F:false});
            expect(Array.from(await evaluate("(10,20,30) - (1,2,3)", ctx))).to.deep.equal([9,18,27]);
            expect(Array.from(await evaluate("(10,20,30) - (1,2)", ctx))).to.deep.equal([9,18,30]);
            expect(Array.from(await evaluate("(10,20) - (1,2,3)", ctx))).to.deep.equal([9,18]);
            expect(Array.from(await evaluate("(10,20,30) - 1", ctx))).to.deep.equal([9,20,30]);
            expect(await evaluate("10 - (1,2,3)", ctx)).to.equal(9);
        });
    });      

    describe("X * Y", () => {
        
        it("should return () if either X or Y is nothing", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            
            expect(await evaluate("() * ()", ctx)).to.equal(null);
            expect(await evaluate("() * T", ctx)).to.equal(null);
            expect(await evaluate("() * F", ctx)).to.equal(null);
            expect(await evaluate("() * 10", ctx)).to.equal(null);
            expect(await evaluate("() * 'abc'", ctx)).to.equal(null);
            expect(await evaluate("() * fn", ctx)).to.equal(null);
            expect(await evaluate("() * ls", ctx)).to.equal(null);
            expect(await evaluate("() * ns", ctx)).to.equal(null);
            expect(await evaluate("() * (1,2,3)", ctx)).to.equal(null);
            
            expect(await evaluate("() * ()", ctx)).to.equal(null);
            expect(await evaluate("T * ()", ctx)).to.equal(null);
            expect(await evaluate("F * ()", ctx)).to.equal(null);
            expect(await evaluate("10 * ()", ctx)).to.equal(null);
            expect(await evaluate("'abc' * ()", ctx)).to.equal(null);
            expect(await evaluate("fn * ()", ctx)).to.equal(null);
            expect(await evaluate("ls * ()", ctx)).to.equal(null);
            expect(await evaluate("ns * ()", ctx)).to.equal(null);
            expect(await evaluate("(1,2,3) * ()", ctx)).to.equal(null);
        });
        
        it("should return `X&&Y` if both X and Y are booleans", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("T * T", ctx)).to.equal(true);
            expect(await evaluate("T * F", ctx)).to.equal(false);
            expect(await evaluate("F * T", ctx)).to.equal(false);
            expect(await evaluate("F * F", ctx)).to.equal(false);
        });
        
        it("should return `X*Y` if both X and Y are numbers", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("10 * 2", ctx)).to.equal(20);
            expect(await evaluate("10 * 0", ctx)).to.equal(0);
            expect(await evaluate("10 * (-2)", ctx)).to.equal(-20);
        });
        
        it("should concatenate X times Y if X is a number and Y is a string", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("3 * 'Abc'", ctx)).to.equal("AbcAbcAbc");
            expect(await evaluate("3.1 * 'Abc'", ctx)).to.equal("AbcAbcAbc");
            expect(await evaluate("3.9 * 'Abc'", ctx)).to.equal("AbcAbcAbc");
            expect(await evaluate("0 * 'Abc'", ctx)).to.equal("");
            expect(await evaluate("-2 * 'Abc'", ctx)).to.equal("");
        });
        
        it("should concatenate Y times X if Y is a number and X is a string", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("'Abc' * 3", ctx)).to.equal("AbcAbcAbc");
            expect(await evaluate("'Abc' * 3.1", ctx)).to.equal("AbcAbcAbc");
            expect(await evaluate("'Abc' * 3.9", ctx)).to.equal("AbcAbcAbc");
            expect(await evaluate("'Abc' * 0", ctx)).to.equal("");
            expect(await evaluate("'Abc' * (-2)", ctx)).to.equal("");
        });

        it("should concatenate X times Y if X is a number and Y is a list", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("3 * [1,2,3]", ctx)).to.deep.equal([1,2,3,1,2,3,1,2,3]);
            expect(await evaluate("3.1 * [1,2,3]", ctx)).to.deep.equal([1,2,3,1,2,3,1,2,3]);
            expect(await evaluate("3.9 * [1,2,3]", ctx)).to.deep.equal([1,2,3,1,2,3,1,2,3]);
            expect(await evaluate("0 * [1,2,3]", ctx)).to.deep.equal([]);
            expect(await evaluate("-2 * [1,2,3]", ctx)).to.deep.equal([]);
        });
        
        it("should concatenate Y times X if Y is a number and X is a list", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("[1,2,3] * 3", ctx)).to.deep.equal([1,2,3,1,2,3,1,2,3]);
            expect(await evaluate("[1,2,3] * 3.1", ctx)).to.deep.equal([1,2,3,1,2,3,1,2,3]);
            expect(await evaluate("[1,2,3] * 3.9", ctx)).to.deep.equal([1,2,3,1,2,3,1,2,3]);
            expect(await evaluate("[1,2,3] * 0", ctx)).to.deep.equal([]);
            expect(await evaluate("[1,2,3] * (-2)", ctx)).to.deep.equal([]);
        });

        it("should throw a runtime error for all the other singleton types", async () => {
            var ctx0 = createContext({T:true, F:false});
            var expectMulError = (expression, XType, YType) => expectError(() => evaluate(expression,ctx), `Product operation not defined between ${XType} and ${YType}`);
            
            var LTYPE = "BOOLEAN", ctx = ctx0.createChildContext({L:true}); 
            await expectMulError("L * 10"      , LTYPE, "NUMBER");
            await expectMulError("L * {a=1}"   , LTYPE, "NAMESPACE");
            await expectMulError("L * (x->x)"  , LTYPE, "FUNCTION");
            
            var LTYPE = "BOOLEAN", ctx = ctx0.createChildContext({L:false}); 
            await expectMulError("L * 10"      , LTYPE, "NUMBER");
            await expectMulError("L * {a=1}"   , LTYPE, "NAMESPACE");
            await expectMulError("L * (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "NUMBER", ctx = ctx0.createChildContext({L:10}); 
            await expectMulError("L * T"       , LTYPE, "BOOLEAN");
            await expectMulError("L * F"       , LTYPE, "BOOLEAN");
            await expectMulError("L * {a=1}"   , LTYPE, "NAMESPACE");
            await expectMulError("L * (x->x)"  , LTYPE, "FUNCTION");
            
            var LTYPE = "STRING", ctx = ctx0.createChildContext({L:"abc"}); 
            await expectMulError("L * T"       , LTYPE, "BOOLEAN");
            await expectMulError("L * F"       , LTYPE, "BOOLEAN");
            await expectMulError("L * 'def'"   , LTYPE, "STRING");
            await expectMulError("L * [1,2,3]" , LTYPE, "LIST");
            await expectMulError("L * {a=1}"   , LTYPE, "NAMESPACE");
            await expectMulError("L * (x->x)"  , LTYPE, "FUNCTION");
            
            var LTYPE = "LIST", ctx = ctx0.createChildContext({L:[1,2,3]}); 
            await expectMulError("L * T"       , LTYPE, "BOOLEAN");
            await expectMulError("L * F"       , LTYPE, "BOOLEAN");
            await expectMulError("L * 'abc'"   , LTYPE, "STRING");
            await expectMulError("L * [4,5]"   , LTYPE, "LIST");
            await expectMulError("L * {a=1}"   , LTYPE, "NAMESPACE");
            await expectMulError("L * (x->x)"  , LTYPE, "FUNCTION");
            
            var LTYPE = "NAMESPACE", ctx = ctx0.createChildContext({L:{a:1,b:2}}); 
            await expectMulError("L * T"       , LTYPE, "BOOLEAN");
            await expectMulError("L * F"       , LTYPE, "BOOLEAN");
            await expectMulError("L * 1"       , LTYPE, "NUMBER");
            await expectMulError("L * 'abc'"   , LTYPE, "STRING");
            await expectMulError("L * [1,2,3]" , LTYPE, "LIST");
            await expectMulError("L * {a=1}"   , LTYPE, "NAMESPACE");
            await expectMulError("L * (x->x)"  , LTYPE, "FUNCTION");
            
            var LTYPE = "FUNCTION", ctx = ctx0.createChildContext({L:x=>x}); 
            await expectMulError("L * T"       , LTYPE, "BOOLEAN");
            await expectMulError("L * F"       , LTYPE, "BOOLEAN");
            await expectMulError("L * 1"       , LTYPE, "NUMBER");
            await expectMulError("L * 'abc'"   , LTYPE, "STRING");
            await expectMulError("L * [1,2,3]" , LTYPE, "LIST");
            await expectMulError("L * {a=1}"   , LTYPE, "NAMESPACE");
            await expectMulError("L * (x->x)"  , LTYPE, "FUNCTION");
        });
        
        it("should return (x1*y1, x2*y2, ...) if X and/or Y is a tuple", async () => {
            var ctx = createContext({T:true, F:false});
            expect(Array.from(await evaluate("(T, 3, 'a', [1]) * (F, 2, 2, 2)",ctx))).to.deep.equal([false, 6, "aa", [1,1]]);
            expect(Array.from(await evaluate("(10,20,30) * (2,3,4)",ctx))).to.deep.equal([20,60,120]);
            expect(Array.from(await evaluate("(10,20,30) * (2,3)",ctx))).to.deep.equal([20,60]);
            expect(Array.from(await evaluate("(10,20) * (2,3,4)",ctx))).to.deep.equal([20,60]);
            expect(await evaluate("10 * (2,3,4)",ctx)).to.equal(20);
            expect(await evaluate("(10,20,30) * 2",ctx)).to.equal(20);
        });
    });

    describe("X / Y", () => {
        
        it("should return nothing if X is nothing", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("() / ()", ctx)).to.equal(null);
            expect(await evaluate("() / T", ctx)).to.equal(null);
            expect(await evaluate("() / F", ctx)).to.equal(null);
            expect(await evaluate("() / 10", ctx)).to.equal(null);
            expect(await evaluate("() / 'abc'", ctx)).to.equal(null);
            expect(await evaluate("() / fn", ctx)).to.equal(null);
            expect(await evaluate("() / ls", ctx)).to.equal(null);
            expect(await evaluate("() / ns", ctx)).to.equal(null);
        });
        
        it("should return `X/Y` if both X and Y are numbers", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("10 / 2", ctx)).to.equal(5);
            expect(await evaluate("20 / 0", ctx)).to.equal(Infinity);
            expect(await evaluate("10 / (-2)", ctx)).to.equal(-5);
        });
        
        it("should throw a runtime error for all the other singleton types", async () => {
            var ctx0 = createContext({T:true, F:false});
            var expectDivError = (expression, XType, YType) => expectError(() => evaluate(expression,ctx), `Division operation not defined between ${XType} and ${YType}`);

            var LTYPE = "BOOLEAN", ctx = ctx0.createChildContext({L:true});
            await expectDivError("L / ()"      , LTYPE, "NOTHING");
            await expectDivError("L / 10"      , LTYPE, "NUMBER");
            await expectDivError("L / 'abc'"   , LTYPE, "STRING");
            await expectDivError("L / [1,2,3]" , LTYPE, "LIST");
            await expectDivError("L / {a=1}"   , LTYPE, "NAMESPACE");
            await expectDivError("L / (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "BOOLEAN", ctx = ctx0.createChildContext({L:false});
            await expectDivError("L / ()"      , LTYPE, "NOTHING");
            await expectDivError("L / 10"      , LTYPE, "NUMBER");
            await expectDivError("L / 'abc'"   , LTYPE, "STRING");
            await expectDivError("L / [1,2,3]" , LTYPE, "LIST");
            await expectDivError("L / {a=1}"   , LTYPE, "NAMESPACE");
            await expectDivError("L / (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "NUMBER", ctx = ctx0.createChildContext({L:10});
            await expectDivError("L / ()"      , LTYPE, "NOTHING");
            await expectDivError("L / T"       , LTYPE, "BOOLEAN");
            await expectDivError("L / F"       , LTYPE, "BOOLEAN");
            await expectDivError("L / 'abc'"   , LTYPE, "STRING");
            await expectDivError("L / [1,2,3]" , LTYPE, "LIST");
            await expectDivError("L / {a=1}"   , LTYPE, "NAMESPACE");
            await expectDivError("L / (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "STRING", ctx = ctx0.createChildContext({L:"abc"});
            await expectDivError("L / ()"      , LTYPE, "NOTHING");
            await expectDivError("L / T"       , LTYPE, "BOOLEAN");
            await expectDivError("L / F"       , LTYPE, "BOOLEAN");
            await expectDivError("L / 1"       , LTYPE, "NUMBER");
            await expectDivError("L / 'abc'"   , LTYPE, "STRING");
            await expectDivError("L / [1,2,3]" , LTYPE, "LIST");
            await expectDivError("L / {a=1}"   , LTYPE, "NAMESPACE");
            await expectDivError("L / (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "LIST", ctx = ctx0.createChildContext({L:[1,2,3]});
            await expectDivError("L / ()"      , LTYPE, "NOTHING");
            await expectDivError("L / T"       , LTYPE, "BOOLEAN");
            await expectDivError("L / F"       , LTYPE, "BOOLEAN");
            await expectDivError("L / 1"       , LTYPE, "NUMBER");
            await expectDivError("L / 'abc'"   , LTYPE, "STRING");
            await expectDivError("L / [1,2,3]" , LTYPE, "LIST");
            await expectDivError("L / {a=1}"   , LTYPE, "NAMESPACE");
            await expectDivError("L / (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "NAMESPACE", ctx = ctx0.createChildContext({L:{a:1,b:2}});
            await expectDivError("L / ()"      , LTYPE, "NOTHING");
            await expectDivError("L / T"       , LTYPE, "BOOLEAN");
            await expectDivError("L / F"       , LTYPE, "BOOLEAN");
            await expectDivError("L / 1"       , LTYPE, "NUMBER");
            await expectDivError("L / 'abc'"   , LTYPE, "STRING");
            await expectDivError("L / [1,2,3]" , LTYPE, "LIST");
            await expectDivError("L / {a=1}"   , LTYPE, "NAMESPACE");
            await expectDivError("L / (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "FUNCTION", ctx = ctx0.createChildContext({L:x=>x});
            await expectDivError("L / ()"      , LTYPE, "NOTHING");
            await expectDivError("L / T"       , LTYPE, "BOOLEAN");
            await expectDivError("L / F"       , LTYPE, "BOOLEAN");
            await expectDivError("L / 1"       , LTYPE, "NUMBER");
            await expectDivError("L / 'abc'"   , LTYPE, "STRING");
            await expectDivError("L / [1,2,3]" , LTYPE, "LIST");
            await expectDivError("L / {a=1}"   , LTYPE, "NAMESPACE");
            await expectDivError("L / (x->x)"  , LTYPE, "FUNCTION");
        });
        
        it("should return (x1/y1, x2/y2, ...) if X and/or Y is a tuple", async () => {
            var ctx = createContext({T:true, F:false});
            var expectDivError = (expression, XType, YType) => expectError(() => evaluate(expression,ctx), `Division operation not defined between ${XType} and ${YType}`);
            expect(Array.from(await evaluate("(10,20,30) / (2,5,3)",ctx))).to.deep.equal([5,4,10]);
            expect(Array.from(await evaluate("(10,20) / (2,5,3)",ctx))).to.deep.equal([5,4]);
            expect(await evaluate("10 / (2,5,3)",ctx)).to.equal(5);
            expect(await evaluate("() / (2,4,3)",ctx)).to.equal(null);
            await expectDivError("(10,20,30) / (2,4)", "NUMBER","NOTHING");
            await expectDivError("(10,20,30) / 2", "NUMBER","NOTHING");
        });
    });

    describe("X ^ Y", () => {
        
        it("should return nothing if X is nothing", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("() ^ ()", ctx)).to.equal(null);
            expect(await evaluate("() ^ T", ctx)).to.equal(null);
            expect(await evaluate("() ^ F", ctx)).to.equal(null);
            expect(await evaluate("() ^ 10", ctx)).to.equal(null);
            expect(await evaluate("() ^ 'abc'", ctx)).to.equal(null);
            expect(await evaluate("() ^ fn", ctx)).to.equal(null);
            expect(await evaluate("() ^ ls", ctx)).to.equal(null);
            expect(await evaluate("() ^ ns", ctx)).to.equal(null);
        });
        
        it("should return `X**Y` if both X and Y are numbers", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("10 ^ 2", ctx)).to.equal(100);
            expect(await evaluate("20 ^ 0", ctx)).to.equal(1);
            expect(await evaluate("10 ^ (-2)", ctx)).to.equal(0.01);
        });
        
        it("should throw a runtime error for all the other singleton types", async () => {
            var ctx0 = createContext({T:true, F:false});
            var expectPowError = (expression, XType, YType) => expectError(() => evaluate(expression,ctx), `Exponentiation operation not defined between ${XType} and ${YType}`);

            var LTYPE = "BOOLEAN", ctx = ctx0.createChildContext({L:true});
            await expectPowError("L ^ ()"      , LTYPE, "NOTHING");
            await expectPowError("L ^ 10"      , LTYPE, "NUMBER");
            await expectPowError("L ^ 'abc'"   , LTYPE, "STRING");
            await expectPowError("L ^ [1,2,3]" , LTYPE, "LIST");
            await expectPowError("L ^ {a=1}"   , LTYPE, "NAMESPACE");
            await expectPowError("L ^ (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "BOOLEAN", ctx = ctx0.createChildContext({L:false});
            await expectPowError("L ^ ()"      , LTYPE, "NOTHING");
            await expectPowError("L ^ 10"      , LTYPE, "NUMBER");
            await expectPowError("L ^ 'abc'"   , LTYPE, "STRING");
            await expectPowError("L ^ [1,2,3]" , LTYPE, "LIST");
            await expectPowError("L ^ {a=1}"   , LTYPE, "NAMESPACE");
            await expectPowError("L ^ (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "NUMBER", ctx = ctx0.createChildContext({L:10});
            await expectPowError("L ^ ()"      , LTYPE, "NOTHING");
            await expectPowError("L ^ T"       , LTYPE, "BOOLEAN");
            await expectPowError("L ^ F"       , LTYPE, "BOOLEAN");
            await expectPowError("L ^ 'abc'"   , LTYPE, "STRING");
            await expectPowError("L ^ [1,2,3]" , LTYPE, "LIST");
            await expectPowError("L ^ {a=1}"   , LTYPE, "NAMESPACE");
            await expectPowError("L ^ (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "STRING", ctx = ctx0.createChildContext({L:"abc"});
            await expectPowError("L ^ ()"      , LTYPE, "NOTHING");
            await expectPowError("L ^ T"       , LTYPE, "BOOLEAN");
            await expectPowError("L ^ F"       , LTYPE, "BOOLEAN");
            await expectPowError("L ^ 1"       , LTYPE, "NUMBER");
            await expectPowError("L ^ 'abc'"   , LTYPE, "STRING");
            await expectPowError("L ^ [1,2,3]" , LTYPE, "LIST");
            await expectPowError("L ^ {a=1}"   , LTYPE, "NAMESPACE");
            await expectPowError("L ^ (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "LIST", ctx = ctx0.createChildContext({L:[1,2,3]});
            await expectPowError("L ^ ()"      , LTYPE, "NOTHING");
            await expectPowError("L ^ T"       , LTYPE, "BOOLEAN");
            await expectPowError("L ^ F"       , LTYPE, "BOOLEAN");
            await expectPowError("L ^ 1"       , LTYPE, "NUMBER");
            await expectPowError("L ^ 'abc'"   , LTYPE, "STRING");
            await expectPowError("L ^ [1,2,3]" , LTYPE, "LIST");
            await expectPowError("L ^ {a=1}"   , LTYPE, "NAMESPACE");
            await expectPowError("L ^ (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "NAMESPACE", ctx = ctx0.createChildContext({L:{a:1,b:2}});
            await expectPowError("L ^ ()"      , LTYPE, "NOTHING");
            await expectPowError("L ^ T"       , LTYPE, "BOOLEAN");
            await expectPowError("L ^ F"       , LTYPE, "BOOLEAN");
            await expectPowError("L ^ 1"       , LTYPE, "NUMBER");
            await expectPowError("L ^ 'abc'"   , LTYPE, "STRING");
            await expectPowError("L ^ [1,2,3]" , LTYPE, "LIST");
            await expectPowError("L ^ {a=1}"   , LTYPE, "NAMESPACE");
            await expectPowError("L ^ (x->x)"  , LTYPE, "FUNCTION");

            var LTYPE = "FUNCTION", ctx = ctx0.createChildContext({L:x=>x});
            await expectPowError("L ^ ()"      , LTYPE, "NOTHING");
            await expectPowError("L ^ T"       , LTYPE, "BOOLEAN");
            await expectPowError("L ^ F"       , LTYPE, "BOOLEAN");
            await expectPowError("L ^ 1"       , LTYPE, "NUMBER");
            await expectPowError("L ^ 'abc'"   , LTYPE, "STRING");
            await expectPowError("L ^ [1,2,3]" , LTYPE, "LIST");
            await expectPowError("L ^ {a=1}"   , LTYPE, "NAMESPACE");
            await expectPowError("L ^ (x->x)"  , LTYPE, "FUNCTION");
        });
        
        it("should return (x1^y1, x2^y2, ...) if X and/or Y is a tuple", async () => {
            var ctx = createContext({T:true, F:false});
            var expectPowError = (expression, XType, YType) => expectError(() => evaluate(expression,ctx), `Exponentiation operation not defined between ${XType} and ${YType}`);
            expect(Array.from(await evaluate("(10,20,30) ^ (2,3,4)",ctx))).to.deep.equal([10**2,20**3,30**4]);
            expect(Array.from(await evaluate("(10,20) ^ (2,3,4)",ctx))).to.deep.equal([10**2,20**3]);
            expect(await evaluate("10 ^ (2,3,4)",ctx)).to.equal(10**2);
            expect(await evaluate("() ^ (2,3,4)",ctx)).to.equal(null);
            await expectPowError("(10,20,30) ^ (2,4)", "NUMBER","NOTHING");
            await expectPowError("(10,20,30) ^ 2", "NUMBER","NOTHING");
        });
    });
    
    describe("str X", () => {
        
        it("should return an empty string if X is nothing", async () => {
            var ctx = createContext();
            expect(await evaluate("str ()", ctx)).to.equal("");
        });
        
        it("should return 'TRUE' if X is true", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("str T", ctx)).to.equal("TRUE");
        });
        
        it("should return 'FALSE' if X is false", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("str F", ctx)).to.equal("FALSE");
        });
        
        it("should return String(X) if X is a number", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("str 123.4", ctx)).to.equal("123.4");
        });
        
        it("should return X itself if it is a string", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("str 'abc'", ctx)).to.equal("abc");
        });
        
        it("should return the expression source if X is a function", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("str(x -> ())", ctx)).to.equal("(x) -> (())");
            expect(await evaluate("str(x -> name)", ctx)).to.equal("(x) -> (name)");
            expect(await evaluate("str(x -> 10)", ctx)).to.equal("(x) -> (10)");
            expect(await evaluate("str(x -> `abc`)", ctx)).to.equal("(x) -> (`abc`)");
            expect(await evaluate(`str(x -> 'abc')`, ctx)).to.equal("(x) -> ('abc')");
            expect(await evaluate(`str(x -> "abc")`,ctx)).to.equal(`(x) -> ("abc")`);
            expect(await evaluate("str(x -> [1,2,3])", ctx)).to.equal("(x) -> ([1,2,3])");
            expect(await evaluate("str(x -> {a=1,b=2,c=3})", ctx)).to.equal("(x) -> ({(a) = (1),(b) = (2),(c) = (3)})");
            expect(await evaluate("str(x -> a/2+b*c)", ctx)).to.equal("(x) -> (((a) / (2)) + ((b) * (c)))");
        });
        
        it("should return '[n]' when X is a list with n items", async () => {
            var ctx = createContext({T:true, F:false});            
            expect(await evaluate("str[1,2,'abc']", ctx)).to.equal("[3]")
        });

        it("should return '{n}' when n is the number of items", async () => {
            var ctx = createContext({T:true, F:false});            
            expect(await evaluate("str{a=1,b=2,c=3}", ctx)).to.equal("{3}")
        });

        it("should concatenate the serialized item if X is a tuple", async () => {
            var ctx = createContext({T:true, F:false});
            expect(await evaluate("str('it is ',T,' that 1+2 is ',1+2)", ctx)).to.equal("it is TRUE that 1+2 is 3");
        });
    });    
    
    describe("X == Y", () => {
        
        it("should return true if both X and Y are nothing", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("() == ()", ctx)).to.equal(true);            
        });

        it("should return true if X and Y are both true or both false", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("T == T", ctx)).to.equal(true);            
            expect(await evaluate("F == F", ctx)).to.equal(true);            
            expect(await evaluate("T == F", ctx)).to.equal(false);            
            expect(await evaluate("F == T", ctx)).to.equal(false);            
        });

        it("should return true if X and Y are the same number", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("3 == 3", ctx)).to.equal(true);            
            expect(await evaluate("0 == 0", ctx)).to.equal(true);            
            expect(await evaluate("-3 == -3", ctx)).to.equal(true);            
            expect(await evaluate("3 == 2", ctx)).to.equal(false);            
            expect(await evaluate("0 == -4", ctx)).to.equal(false);            
        });

        it("should return true if X and Y are the same string", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("'abc' == 'abc'", ctx)).to.equal(true);            
            expect(await evaluate("'' == ''", ctx)).to.equal(true);            
            expect(await evaluate("'abc' == 'def'", ctx)).to.equal(false);                        
            expect(await evaluate("'abc' == ''", ctx)).to.equal(false);                        
        });
        
        it("should return true if X and Y are both lists with equal items", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("[1,2,3] == [1,2,3]", ctx)).to.equal(true);                        
            expect(await evaluate("[] == []", ctx)).to.equal(true);            
            expect(await evaluate("[1,2,3] == [4,5,6]", ctx)).to.equal(false);                        
            expect(await evaluate("[1,2,3] == []", ctx)).to.equal(false);                        
        });

        it("should return true if X and Y are both namespace with sname name:value pairs", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("{a=1,b=2} == {a=1,b=2}", ctx)).to.equal(true);                        
            expect(await evaluate("{} == {}", ctx)).to.equal(true);            
            expect(await evaluate("{a=1,b=2} == {a=1,c=2}", ctx)).to.equal(false);                        
            expect(await evaluate("{a=1,b=2} == {a=1,b=3}", ctx)).to.equal(false);                        
            expect(await evaluate("{a=1,b=2} == {a=1}", ctx)).to.equal(false);                        
            expect(await evaluate("{a=1,b=2} == {}", ctx)).to.equal(false);                        
            expect(await evaluate("{a=1} == {a=1,b=2}", ctx)).to.equal(false);                        
            expect(await evaluate("{} == {a=1,b=2}", ctx)).to.equal(false);                        
        });

        it("should compare str X with str Y if both X and Y are functions", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("(x->2*x) == (x->2*x)", ctx)).to.equal(true);                                    
            expect(await evaluate("fn == fn", ctx)).to.equal(true);                                    
            expect(await evaluate("(x->2*x) == (x->3*x)", ctx)).to.equal(false);                                    
            expect(await evaluate("(x->2*x) == fn", ctx)).to.equal(false);                                    
            expect(await evaluate("fn == (x->2*x)", ctx)).to.equal(false);                                    
        });
        
        it("should return false if X and Y are of different types", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});

            expect(await evaluate("() == T", ctx)).to.equal(false);                                    
            expect(await evaluate("() == F", ctx)).to.equal(false);                                    
            expect(await evaluate("() == 1", ctx)).to.equal(false);                                    
            expect(await evaluate("() == 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("() == ls", ctx)).to.equal(false);                                    
            expect(await evaluate("() == ns", ctx)).to.equal(false);                                    
            expect(await evaluate("() == fn", ctx)).to.equal(false);                                    
            
            expect(await evaluate("T == ()", ctx)).to.equal(false);                                    
            expect(await evaluate("T == 1", ctx)).to.equal(false);                                    
            expect(await evaluate("T == 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("T == ls", ctx)).to.equal(false);                                    
            expect(await evaluate("T == ns", ctx)).to.equal(false);                                    
            expect(await evaluate("T == fn", ctx)).to.equal(false);                                    
            
            expect(await evaluate("F == ()", ctx)).to.equal(false);                                    
            expect(await evaluate("F == 1", ctx)).to.equal(false);                                    
            expect(await evaluate("F == 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("F == ls", ctx)).to.equal(false);                                    
            expect(await evaluate("F == ns", ctx)).to.equal(false);                                    
            expect(await evaluate("F == fn", ctx)).to.equal(false);                                    
            
            expect(await evaluate("1 == ()", ctx)).to.equal(false);                                    
            expect(await evaluate("1 == T", ctx)).to.equal(false);                                    
            expect(await evaluate("1 == F", ctx)).to.equal(false);                                    
            expect(await evaluate("1 == 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("1 == ls", ctx)).to.equal(false);                                    
            expect(await evaluate("1 == ns", ctx)).to.equal(false);                                    
            expect(await evaluate("1 == fn", ctx)).to.equal(false);                                    
            
            expect(await evaluate("'abc' == ()", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' == T", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' == F", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' == 1", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' == ls", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' == ns", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' == fn", ctx)).to.equal(false);                                    
            
            expect(await evaluate("ls == ()", ctx)).to.equal(false);                                    
            expect(await evaluate("ls == T", ctx)).to.equal(false);                                    
            expect(await evaluate("ls == F", ctx)).to.equal(false);                                    
            expect(await evaluate("ls == 1", ctx)).to.equal(false);                                    
            expect(await evaluate("ls == 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("ls == ns", ctx)).to.equal(false);                                    
            expect(await evaluate("ls == fn", ctx)).to.equal(false);                                    
            
            expect(await evaluate("ns == ()", ctx)).to.equal(false);                                    
            expect(await evaluate("ns == T", ctx)).to.equal(false);                                    
            expect(await evaluate("ns == F", ctx)).to.equal(false);                                    
            expect(await evaluate("ns == 1", ctx)).to.equal(false);                                    
            expect(await evaluate("ns == 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("ns == ls", ctx)).to.equal(false);                                    
            expect(await evaluate("ns == fn", ctx)).to.equal(false);                                    
            
            expect(await evaluate("fn == ()", ctx)).to.equal(false);                                    
            expect(await evaluate("fn == T", ctx)).to.equal(false);                                    
            expect(await evaluate("fn == F", ctx)).to.equal(false);                                    
            expect(await evaluate("fn == 1", ctx)).to.equal(false);                                    
            expect(await evaluate("fn == 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("fn == ls", ctx)).to.equal(false);                                    
            expect(await evaluate("fn == ns", ctx)).to.equal(false);                                    
        });

        it("should compare tuples with lexicographical criteria", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("(1,2,3) == (1,2,3)", ctx)).to.equal(true);                        
            expect(await evaluate("(1,2,3) == (1,2)", ctx)).to.equal(false);                        
            expect(await evaluate("(1,2) == (1,2,3)", ctx)).to.equal(false);                                    
            expect(await evaluate("1 == (1,2,3)", ctx)).to.equal(false);                                    
            expect(await evaluate("(1,2,3) == 1", ctx)).to.equal(false);                                    
        });
    });

    describe("X != Y", () => {
        
        it("should return false if both X and Y are nothing", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("() != ()", ctx)).to.equal(false);            
        });

        it("should return false if X and Y are both false or both true", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("T != T", ctx)).to.equal(false);            
            expect(await evaluate("F != F", ctx)).to.equal(false);            
            expect(await evaluate("T != F", ctx)).to.equal(true);            
            expect(await evaluate("F != T", ctx)).to.equal(true);            
        });

        it("should return false if X and Y are the same number", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("3 != 3", ctx)).to.equal(false);            
            expect(await evaluate("0 != 0", ctx)).to.equal(false);            
            expect(await evaluate("-3 != -3", ctx)).to.equal(false);            
            expect(await evaluate("3 != 2", ctx)).to.equal(true);            
            expect(await evaluate("0 != -4", ctx)).to.equal(true);            
        });

        it("should return false if X and Y are the same string", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("'abc' != 'abc'", ctx)).to.equal(false);            
            expect(await evaluate("'' != ''", ctx)).to.equal(false);            
            expect(await evaluate("'abc' != 'def'", ctx)).to.equal(true);                        
            expect(await evaluate("'abc' != ''", ctx)).to.equal(true);                        
        });
        
        it("should return false if X and Y are both lists with equal items", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("[1,2,3] != [1,2,3]", ctx)).to.equal(false);                        
            expect(await evaluate("[] != []", ctx)).to.equal(false);            
            expect(await evaluate("[1,2,3] != [4,5,6]", ctx)).to.equal(true);                        
            expect(await evaluate("[1,2,3] != []", ctx)).to.equal(true);                        
        });

        it("should return false if X and Y are both namespace with sname name:value pairs", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("{a=1,b=2} != {a=1,b=2}", ctx)).to.equal(false);                        
            expect(await evaluate("{} != {}", ctx)).to.equal(false);            
            expect(await evaluate("{a=1,b=2} != {a=1,c=2}", ctx)).to.equal(true);                        
            expect(await evaluate("{a=1,b=2} != {a=1,b=3}", ctx)).to.equal(true);                        
            expect(await evaluate("{a=1,b=2} != {a=1}", ctx)).to.equal(true);                        
            expect(await evaluate("{a=1,b=2} != {}", ctx)).to.equal(true);                        
            expect(await evaluate("{a=1} != {a=1,b=2}", ctx)).to.equal(true);                        
            expect(await evaluate("{} != {a=1,b=2}", ctx)).to.equal(true);                        
        });

        it("should compare str X with str Y if both X and Y are functions", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("(x->2*x) != (x->2*x)", ctx)).to.equal(false);                                    
            expect(await evaluate("fn != fn", ctx)).to.equal(false);                                    
            expect(await evaluate("(x->2*x) != (x->3*x)", ctx)).to.equal(true);                                    
            expect(await evaluate("(x->2*x) != fn", ctx)).to.equal(true);                                    
            expect(await evaluate("fn != (x->2*x)", ctx)).to.equal(true);                                    
        });
        
        it("should return true if X and Y are of different types", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});

            expect(await evaluate("() != T", ctx)).to.equal(true);                                    
            expect(await evaluate("() != F", ctx)).to.equal(true);                                    
            expect(await evaluate("() != 1", ctx)).to.equal(true);                                    
            expect(await evaluate("() != 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("() != ls", ctx)).to.equal(true);                                    
            expect(await evaluate("() != ns", ctx)).to.equal(true);                                    
            expect(await evaluate("() != fn", ctx)).to.equal(true);                                    
            
            expect(await evaluate("T != ()", ctx)).to.equal(true);                                    
            expect(await evaluate("T != 1", ctx)).to.equal(true);                                    
            expect(await evaluate("T != 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("T != ls", ctx)).to.equal(true);                                    
            expect(await evaluate("T != ns", ctx)).to.equal(true);                                    
            expect(await evaluate("T != fn", ctx)).to.equal(true);                                    
            
            expect(await evaluate("F != ()", ctx)).to.equal(true);                                    
            expect(await evaluate("F != 1", ctx)).to.equal(true);                                    
            expect(await evaluate("F != 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("F != ls", ctx)).to.equal(true);                                    
            expect(await evaluate("F != ns", ctx)).to.equal(true);                                    
            expect(await evaluate("F != fn", ctx)).to.equal(true);                                    
            
            expect(await evaluate("1 != ()", ctx)).to.equal(true);                                    
            expect(await evaluate("1 != T", ctx)).to.equal(true);                                    
            expect(await evaluate("1 != F", ctx)).to.equal(true);                                    
            expect(await evaluate("1 != 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("1 != ls", ctx)).to.equal(true);                                    
            expect(await evaluate("1 != ns", ctx)).to.equal(true);                                    
            expect(await evaluate("1 != fn", ctx)).to.equal(true);                                    
            
            expect(await evaluate("'abc' != ()", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' != T", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' != F", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' != 1", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' != ls", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' != ns", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' != fn", ctx)).to.equal(true);                                    
            
            expect(await evaluate("ls != ()", ctx)).to.equal(true);                                    
            expect(await evaluate("ls != T", ctx)).to.equal(true);                                    
            expect(await evaluate("ls != F", ctx)).to.equal(true);                                    
            expect(await evaluate("ls != 1", ctx)).to.equal(true);                                    
            expect(await evaluate("ls != 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("ls != ns", ctx)).to.equal(true);                                    
            expect(await evaluate("ls != fn", ctx)).to.equal(true);                                    
            
            expect(await evaluate("ns != ()", ctx)).to.equal(true);                                    
            expect(await evaluate("ns != T", ctx)).to.equal(true);                                    
            expect(await evaluate("ns != F", ctx)).to.equal(true);                                    
            expect(await evaluate("ns != 1", ctx)).to.equal(true);                                    
            expect(await evaluate("ns != 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("ns != ls", ctx)).to.equal(true);                                    
            expect(await evaluate("ns != fn", ctx)).to.equal(true);                                    
            
            expect(await evaluate("fn != ()", ctx)).to.equal(true);                                    
            expect(await evaluate("fn != T", ctx)).to.equal(true);                                    
            expect(await evaluate("fn != F", ctx)).to.equal(true);                                    
            expect(await evaluate("fn != 1", ctx)).to.equal(true);                                    
            expect(await evaluate("fn != 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("fn != ls", ctx)).to.equal(true);                                    
            expect(await evaluate("fn != ns", ctx)).to.equal(true);                                    
        });

        it("should compare tuples with lexicographical criteria", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("(1,2,3) != (1,2,3)", ctx)).to.equal(false);                        
            expect(await evaluate("(1,2,3) != (1,2)", ctx)).to.equal(true);                        
            expect(await evaluate("(1,2) != (1,2,3)", ctx)).to.equal(true);                                    
            expect(await evaluate("1 != (1,2,3)", ctx)).to.equal(true);                                    
            expect(await evaluate("(1,2,3) != 1", ctx)).to.equal(true);                                    
        });
    });    

    describe("X < Y", () => {
        
        it("should return false if both X and Y are nothing", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("() < ()", ctx)).to.equal(false);            
        });

        it("should return true if X is false and Y is true", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("T < T", ctx)).to.equal(false);            
            expect(await evaluate("F < F", ctx)).to.equal(false);            
            expect(await evaluate("T < F", ctx)).to.equal(false);            
            expect(await evaluate("F < T", ctx)).to.equal(true);            
        });

        it("should return true if X is a lower number than Y", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("1 < 2", ctx)).to.equal(true);            
            expect(await evaluate("0 < 2", ctx)).to.equal(true);            
            expect(await evaluate("-1 < 2", ctx)).to.equal(true);            
            expect(await evaluate("2 < 1", ctx)).to.equal(false);            
            expect(await evaluate("2 < 0", ctx)).to.equal(false);            
            expect(await evaluate("2 < (-2)", ctx)).to.equal(false);            
            expect(await evaluate("2 < 2", ctx)).to.equal(false);            
        });

        it("should return true if X and Y are both strings and X precedes Y alphabetically", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("'abc' < 'def'", ctx)).to.equal(true);            
            expect(await evaluate("'abc' < 'abd'", ctx)).to.equal(true);            
            expect(await evaluate("'ab' < 'abc'", ctx)).to.equal(true);            
            expect(await evaluate("'' < 'abc'", ctx)).to.equal(true);            
            expect(await evaluate("'abc' < 'abc'", ctx)).to.equal(false);                        
            expect(await evaluate("'abd' < 'abc'", ctx)).to.equal(false);                        
            expect(await evaluate("'abc' < 'ab'", ctx)).to.equal(false);                        
            expect(await evaluate("'abc' < ''", ctx)).to.equal(false);                        
        });
        
        it("should return true if X and Y are both lists and X precedes Y lexicographically", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("[1,2,3] < [4,5,6]", ctx)).to.equal(true);            
            expect(await evaluate("[1,2,3] < [1,2,4]", ctx)).to.equal(true);            
            expect(await evaluate("[1,2] < [1,2,4]", ctx)).to.equal(true);            
            expect(await evaluate("[] < [1,2,3]", ctx)).to.equal(true);            
            expect(await evaluate("[1,2,3] < [1,2,3]", ctx)).to.equal(false);                        
            expect(await evaluate("[1,2,4] < [1,2,3]", ctx)).to.equal(false);                        
            expect(await evaluate("[1,2,4] < [1,2]", ctx)).to.equal(false);                        
            expect(await evaluate("[1,2,3] < []", ctx)).to.equal(false);                        
        });

        it("should return true if X and Y are both namespaces and X precedes Y lexicographically", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("{a=1,b=2} < {a=3,b=4}", ctx)).to.equal(true);            
            expect(await evaluate("{a=1,b=2} < {c=1,d=2}", ctx)).to.equal(true);            
            expect(await evaluate("{a=1} < {a=1,b=2}", ctx)).to.equal(true);            
            expect(await evaluate("{a=1} < {a=1,b=2}", ctx)).to.equal(true);            
            expect(await evaluate("{} < {a=1,b=2}", ctx)).to.equal(true);            
            expect(await evaluate("{a=1,b=2} < {a=1,b=2}", ctx)).to.equal(false);            
            expect(await evaluate("{a=3,b=4} < {a=1,b=2}", ctx)).to.equal(false);            
            expect(await evaluate("{c=1,d=2} < {a=1,b=2}", ctx)).to.equal(false);            
            expect(await evaluate("{a=1,b=2} < {a=1}", ctx)).to.equal(false);            
            expect(await evaluate("{a=1,b=2} < {a=1}", ctx)).to.equal(false);            
            expect(await evaluate("{a=1,b=2} < {}", ctx)).to.equal(false);            
        });

        it("should compare str X with str Y if both X and Y are functions", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("(x->2*x) < (x->2*x)", ctx)).to.equal(false);                                    
            expect(await evaluate("(x->2*x) < (x->3*x)", ctx)).to.equal(true);                                    
            expect(await evaluate("(x->3*x) < (x->2*x)", ctx)).to.equal(false);                                    
        });
        
        it("should order differnt type as follows: NOTHING < BOOLEAN < NUMBER < STRING < LIST < NAMESPACE < FUNCTION", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});

            expect(await evaluate("() < T", ctx)).to.equal(true);                                    
            expect(await evaluate("() < F", ctx)).to.equal(true);                                    
            expect(await evaluate("() < 1", ctx)).to.equal(true);                                    
            expect(await evaluate("() < 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("() < ls", ctx)).to.equal(true);                                    
            expect(await evaluate("() < ns", ctx)).to.equal(true);                                    
            expect(await evaluate("() < fn", ctx)).to.equal(true);                                    
            
            expect(await evaluate("T < ()", ctx)).to.equal(false);                                    
            expect(await evaluate("T < 1", ctx)).to.equal(true);                                    
            expect(await evaluate("T < 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("T < ls", ctx)).to.equal(true);                                    
            expect(await evaluate("T < ns", ctx)).to.equal(true);                                    
            expect(await evaluate("T < fn", ctx)).to.equal(true);                                    
            
            expect(await evaluate("F < ()", ctx)).to.equal(false);                                    
            expect(await evaluate("F < 1", ctx)).to.equal(true);                                    
            expect(await evaluate("F < 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("F < ls", ctx)).to.equal(true);                                    
            expect(await evaluate("F < ns", ctx)).to.equal(true);                                    
            expect(await evaluate("F < fn", ctx)).to.equal(true);                                    
            
            expect(await evaluate("1 < ()", ctx)).to.equal(false);                                    
            expect(await evaluate("1 < T", ctx)).to.equal(false);                                    
            expect(await evaluate("1 < F", ctx)).to.equal(false);                                    
            expect(await evaluate("1 < 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("1 < ls", ctx)).to.equal(true);                                    
            expect(await evaluate("1 < ns", ctx)).to.equal(true);                                    
            expect(await evaluate("1 < fn", ctx)).to.equal(true);                                    

            expect(await evaluate("'abc' < ()", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' < T", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' < F", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' < 1", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' < ls", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' < ns", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' < fn", ctx)).to.equal(true);                                    

            expect(await evaluate("ls < ()", ctx)).to.equal(false);                                    
            expect(await evaluate("ls < T", ctx)).to.equal(false);                                    
            expect(await evaluate("ls < F", ctx)).to.equal(false);                                    
            expect(await evaluate("ls < 1", ctx)).to.equal(false);                                    
            expect(await evaluate("ls < 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("ls < ns", ctx)).to.equal(true);                                    
            expect(await evaluate("ls < fn", ctx)).to.equal(true);                                    

            expect(await evaluate("ns < ()", ctx)).to.equal(false);                                    
            expect(await evaluate("ns < T", ctx)).to.equal(false);                                    
            expect(await evaluate("ns < F", ctx)).to.equal(false);                                    
            expect(await evaluate("ns < 1", ctx)).to.equal(false);                                    
            expect(await evaluate("ns < 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("ns < ls", ctx)).to.equal(false);                                    
            expect(await evaluate("ns < fn", ctx)).to.equal(true);                                    

            expect(await evaluate("fn < ()", ctx)).to.equal(false);                                    
            expect(await evaluate("fn < T", ctx)).to.equal(false);                                    
            expect(await evaluate("fn < F", ctx)).to.equal(false);                                    
            expect(await evaluate("fn < 1", ctx)).to.equal(false);                                    
            expect(await evaluate("fn < 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("fn < ls", ctx)).to.equal(false);                                    
            expect(await evaluate("fn < ns", ctx)).to.equal(false);                                    
        });

        it("should compare tuples with lexicographical criteria", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("(1,2,3) < (4,5,6)", ctx)).to.equal(true);            
            expect(await evaluate("(1,2,3) < (1,2,4)", ctx)).to.equal(true);            
            expect(await evaluate("(1,2) < (1,2,4)", ctx)).to.equal(true);            
            expect(await evaluate("() < (1,2,3)", ctx)).to.equal(true);            
            expect(await evaluate("(1,2,3) < (1,2,3)", ctx)).to.equal(false);                        
            expect(await evaluate("(1,2,4) < (1,2,3)", ctx)).to.equal(false);                        
            expect(await evaluate("(1,2,4) < (1,2)", ctx)).to.equal(false);                        
            expect(await evaluate("(1,2,3) < ()", ctx)).to.equal(false);                        
        });
    });

    describe("X >= Y", () => {
        
        it("should return true if both X and Y are nothing", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("() >= ()", ctx)).to.equal(true);            
        });

        it("should return false if X is false and Y is true", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("T >= T", ctx)).to.equal(true);            
            expect(await evaluate("F >= F", ctx)).to.equal(true);     
            expect(await evaluate("T >= F", ctx)).to.equal(true);            
            expect(await evaluate("F >= T", ctx)).to.equal(false);            
        });

        it("should return false if X is a lower number than Y", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("1 >= 2", ctx)).to.equal(false);            
            expect(await evaluate("0 >= 2", ctx)).to.equal(false);            
            expect(await evaluate("-1 >= 2", ctx)).to.equal(false);            
            expect(await evaluate("2 >= 1", ctx)).to.equal(true);            
            expect(await evaluate("2 >= 0", ctx)).to.equal(true);            
            expect(await evaluate("2 >= (-2)", ctx)).to.equal(true);            
            expect(await evaluate("2 >= 2", ctx)).to.equal(true);            
        });

        it("should return false if X and Y are both strings and X precedes Y alphabetically", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("'abc' >= 'def'", ctx)).to.equal(false);            
            expect(await evaluate("'abc' >= 'abd'", ctx)).to.equal(false);            
            expect(await evaluate("'ab' >= 'abc'", ctx)).to.equal(false);            
            expect(await evaluate("'' >= 'abc'", ctx)).to.equal(false);            
            expect(await evaluate("'abc' >= 'abc'", ctx)).to.equal(true);                        
            expect(await evaluate("'abd' >= 'abc'", ctx)).to.equal(true);                        
            expect(await evaluate("'abc' >= 'ab'", ctx)).to.equal(true);                        
            expect(await evaluate("'abc' >= ''", ctx)).to.equal(true);                        
        });
        
        it("should return false if X and Y are both lists and X precedes Y lexicographically", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("[1,2,3] >= [4,5,6]", ctx)).to.equal(false);            
            expect(await evaluate("[1,2,3] >= [1,2,4]", ctx)).to.equal(false);            
            expect(await evaluate("[1,2] >= [1,2,4]", ctx)).to.equal(false);            
            expect(await evaluate("[] >= [1,2,3]", ctx)).to.equal(false);            
            expect(await evaluate("[1,2,3] >= [1,2,3]", ctx)).to.equal(true);                        
            expect(await evaluate("[1,2,4] >= [1,2,3]", ctx)).to.equal(true);                        
            expect(await evaluate("[1,2,4] >= [1,2]", ctx)).to.equal(true);                        
            expect(await evaluate("[1,2,3] >= []", ctx)).to.equal(true);                        
        });

        it("should return false if X and Y are both namespaces and X precedes Y lexicographically", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("{a=1,b=2} >= {a=3,b=4}", ctx)).to.equal(false);            
            expect(await evaluate("{a=1,b=2} >= {c=1,d=2}", ctx)).to.equal(false);            
            expect(await evaluate("{a=1} >= {a=1,b=2}", ctx)).to.equal(false);            
            expect(await evaluate("{a=1} >= {a=1,b=2}", ctx)).to.equal(false);            
            expect(await evaluate("{} >= {a=1,b=2}", ctx)).to.equal(false);            
            expect(await evaluate("{a=1,b=2} >= {a=1,b=2}", ctx)).to.equal(true);            
            expect(await evaluate("{a=3,b=4} >= {a=1,b=2}", ctx)).to.equal(true);            
            expect(await evaluate("{c=1,d=2} >= {a=1,b=2}", ctx)).to.equal(true);            
            expect(await evaluate("{a=1,b=2} >= {a=1}", ctx)).to.equal(true);            
            expect(await evaluate("{a=1,b=2} >= {a=1}", ctx)).to.equal(true);            
            expect(await evaluate("{a=1,b=2} >= {}", ctx)).to.equal(true);            
        });

        it("should compare str X with str Y if both X and Y are functions", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("(x->2*x) >= (x->2*x)", ctx)).to.equal(true);                                    
            expect(await evaluate("(x->2*x) >= (x->3*x)", ctx)).to.equal(false);                                    
            expect(await evaluate("(x->3*x) >= (x->2*x)", ctx)).to.equal(true);                                    
        });
        
        it("should order differnt type as follows: NOTHING >= BOOLEAN >= NUMBER >= STRING >= LIST >= NAMESPACE >= FUNCTION", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});

            expect(await evaluate("() >= T", ctx)).to.equal(false);                                    
            expect(await evaluate("() >= F", ctx)).to.equal(false);                                    
            expect(await evaluate("() >= 1", ctx)).to.equal(false);                                    
            expect(await evaluate("() >= 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("() >= ls", ctx)).to.equal(false);                                    
            expect(await evaluate("() >= ns", ctx)).to.equal(false);                                    
            expect(await evaluate("() >= fn", ctx)).to.equal(false);                                    
            
            expect(await evaluate("T >= ()", ctx)).to.equal(true);                                    
            expect(await evaluate("T >= 1", ctx)).to.equal(false);                                    
            expect(await evaluate("T >= 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("T >= ls", ctx)).to.equal(false);                                    
            expect(await evaluate("T >= ns", ctx)).to.equal(false);                                    
            expect(await evaluate("T >= fn", ctx)).to.equal(false);                                    
            
            expect(await evaluate("F >= ()", ctx)).to.equal(true);                                    
            expect(await evaluate("F >= 1", ctx)).to.equal(false);                                    
            expect(await evaluate("F >= 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("F >= ls", ctx)).to.equal(false);                                    
            expect(await evaluate("F >= ns", ctx)).to.equal(false);                                    
            expect(await evaluate("F >= fn", ctx)).to.equal(false);                                    
            
            expect(await evaluate("1 >= ()", ctx)).to.equal(true);                                    
            expect(await evaluate("1 >= T", ctx)).to.equal(true);                                    
            expect(await evaluate("1 >= F", ctx)).to.equal(true);                                    
            expect(await evaluate("1 >= 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("1 >= ls", ctx)).to.equal(false);                                    
            expect(await evaluate("1 >= ns", ctx)).to.equal(false);                                    
            expect(await evaluate("1 >= fn", ctx)).to.equal(false);                                    

            expect(await evaluate("'abc' >= ()", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' >= T", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' >= F", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' >= 1", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' >= ls", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' >= ns", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' >= fn", ctx)).to.equal(false);                                    

            expect(await evaluate("ls >= ()", ctx)).to.equal(true);                                    
            expect(await evaluate("ls >= T", ctx)).to.equal(true);                                    
            expect(await evaluate("ls >= F", ctx)).to.equal(true);                                    
            expect(await evaluate("ls >= 1", ctx)).to.equal(true);                                    
            expect(await evaluate("ls >= 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("ls >= ns", ctx)).to.equal(false);                                    
            expect(await evaluate("ls >= fn", ctx)).to.equal(false);                                    

            expect(await evaluate("ns >= ()", ctx)).to.equal(true);                                    
            expect(await evaluate("ns >= T", ctx)).to.equal(true);                                    
            expect(await evaluate("ns >= F", ctx)).to.equal(true);                                    
            expect(await evaluate("ns >= 1", ctx)).to.equal(true);                                    
            expect(await evaluate("ns >= 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("ns >= ls", ctx)).to.equal(true);                                    
            expect(await evaluate("ns >= fn", ctx)).to.equal(false);                                    

            expect(await evaluate("fn >= ()", ctx)).to.equal(true);                                    
            expect(await evaluate("fn >= T", ctx)).to.equal(true);                                    
            expect(await evaluate("fn >= F", ctx)).to.equal(true);                                    
            expect(await evaluate("fn >= 1", ctx)).to.equal(true);                                    
            expect(await evaluate("fn >= 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("fn >= ls", ctx)).to.equal(true);                                    
            expect(await evaluate("fn >= ns", ctx)).to.equal(true);                                    
        });

        it("should compare tuples with lexicographical criteria", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("(1,2,3) >= (4,5,6)", ctx)).to.equal(false);            
            expect(await evaluate("(1,2,3) >= (1,2,4)", ctx)).to.equal(false);            
            expect(await evaluate("(1,2) >= (1,2,4)", ctx)).to.equal(false);            
            expect(await evaluate("() >= (1,2,3)", ctx)).to.equal(false);            
            expect(await evaluate("(1,2,3) >= (1,2,3)", ctx)).to.equal(true);                        
            expect(await evaluate("(1,2,4) >= (1,2,3)", ctx)).to.equal(true);                        
            expect(await evaluate("(1,2,4) >= (1,2)", ctx)).to.equal(true);                        
            expect(await evaluate("(1,2,3) >= ()", ctx)).to.equal(true);                        
        });
    });    

    describe("X > Y", () => {
        
        it("should return false if both X and Y are nothing", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("() > ()", ctx)).to.equal(false);            
        });

        it("should return true if X is true and Y is false", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("T > T", ctx)).to.equal(false);            
            expect(await evaluate("F > F", ctx)).to.equal(false);            
            expect(await evaluate("T > F", ctx)).to.equal(true);            
            expect(await evaluate("F > T", ctx)).to.equal(false);            
        });

        it("should return true if X is a higher number than Y", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("1 > 2", ctx)).to.equal(false);            
            expect(await evaluate("0 > 2", ctx)).to.equal(false);            
            expect(await evaluate("-1 > 2", ctx)).to.equal(false);            
            expect(await evaluate("2 > 1", ctx)).to.equal(true);            
            expect(await evaluate("2 > 0", ctx)).to.equal(true);            
            expect(await evaluate("2 > (-2)", ctx)).to.equal(true);            
            expect(await evaluate("2 > 2", ctx)).to.equal(false);            
        });

        it("should return true if X and Y are both strings and X follows Y alphabetically", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("'abc' > 'def'", ctx)).to.equal(false);            
            expect(await evaluate("'abc' > 'abd'", ctx)).to.equal(false);            
            expect(await evaluate("'ab' > 'abc'", ctx)).to.equal(false);            
            expect(await evaluate("'' > 'abc'", ctx)).to.equal(false);            
            expect(await evaluate("'abc' > 'abc'", ctx)).to.equal(false);                        
            expect(await evaluate("'abd' > 'abc'", ctx)).to.equal(true);                        
            expect(await evaluate("'abc' > 'ab'", ctx)).to.equal(true);                        
            expect(await evaluate("'abc' > ''", ctx)).to.equal(true);                        
        });
        
        it("should return true if X and Y are both lists and X follows Y lexicographically", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("[1,2,3] > [4,5,6]", ctx)).to.equal(false);            
            expect(await evaluate("[1,2,3] > [1,2,4]", ctx)).to.equal(false);            
            expect(await evaluate("[1,2] > [1,2,4]", ctx)).to.equal(false);            
            expect(await evaluate("[] > [1,2,3]", ctx)).to.equal(false);            
            expect(await evaluate("[1,2,3] > [1,2,3]", ctx)).to.equal(false);                        
            expect(await evaluate("[1,2,4] > [1,2,3]", ctx)).to.equal(true);                        
            expect(await evaluate("[1,2,4] > [1,2]", ctx)).to.equal(true);                        
            expect(await evaluate("[1,2,3] > []", ctx)).to.equal(true);                        
        });

        it("should return true if X and Y are both namespaces and X follows Y lexicographically", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("{a=1,b=2} > {a=3,b=4}", ctx)).to.equal(false);            
            expect(await evaluate("{a=1,b=2} > {c=1,d=2}", ctx)).to.equal(false);            
            expect(await evaluate("{a=1} > {a=1,b=2}", ctx)).to.equal(false);            
            expect(await evaluate("{a=1} > {a=1,b=2}", ctx)).to.equal(false);            
            expect(await evaluate("{} > {a=1,b=2}", ctx)).to.equal(false);            
            expect(await evaluate("{a=1,b=2} > {a=1,b=2}", ctx)).to.equal(false);            
            expect(await evaluate("{a=3,b=4} > {a=1,b=2}", ctx)).to.equal(true);            
            expect(await evaluate("{c=1,d=2} > {a=1,b=2}", ctx)).to.equal(true);            
            expect(await evaluate("{a=1,b=2} > {a=1}", ctx)).to.equal(true);            
            expect(await evaluate("{a=1,b=2} > {a=1}", ctx)).to.equal(true);            
            expect(await evaluate("{a=1,b=2} > {}", ctx)).to.equal(true);            
        });

        it("should compare str X with str Y if both X and Y are functions", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("(x->2*x) > (x->2*x)", ctx)).to.equal(false);                                    
            expect(await evaluate("(x->2*x) > (x->3*x)", ctx)).to.equal(false);                                    
            expect(await evaluate("(x->3*x) > (x->2*x)", ctx)).to.equal(true);                                    
        });
        
        it("should order differnt type as follows: NOTHING > BOOLEAN > NUMBER > STRING > LIST > NAMESPACE > FUNCTION", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});

            expect(await evaluate("() > T", ctx)).to.equal(false);                                    
            expect(await evaluate("() > F", ctx)).to.equal(false);                                    
            expect(await evaluate("() > 1", ctx)).to.equal(false);                                    
            expect(await evaluate("() > 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("() > ls", ctx)).to.equal(false);                                    
            expect(await evaluate("() > ns", ctx)).to.equal(false);                                    
            expect(await evaluate("() > fn", ctx)).to.equal(false);                                    
            
            expect(await evaluate("T > ()", ctx)).to.equal(true);                                    
            expect(await evaluate("T > 1", ctx)).to.equal(false);                                    
            expect(await evaluate("T > 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("T > ls", ctx)).to.equal(false);                                    
            expect(await evaluate("T > ns", ctx)).to.equal(false);                                    
            expect(await evaluate("T > fn", ctx)).to.equal(false);                                    
            
            expect(await evaluate("F > ()", ctx)).to.equal(true);                                    
            expect(await evaluate("F > 1", ctx)).to.equal(false);                                    
            expect(await evaluate("F > 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("F > ls", ctx)).to.equal(false);                                    
            expect(await evaluate("F > ns", ctx)).to.equal(false);                                    
            expect(await evaluate("F > fn", ctx)).to.equal(false);                                    
            
            expect(await evaluate("1 > ()", ctx)).to.equal(true);                                    
            expect(await evaluate("1 > T", ctx)).to.equal(true);                                    
            expect(await evaluate("1 > F", ctx)).to.equal(true);                                    
            expect(await evaluate("1 > 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("1 > ls", ctx)).to.equal(false);                                    
            expect(await evaluate("1 > ns", ctx)).to.equal(false);                                    
            expect(await evaluate("1 > fn", ctx)).to.equal(false);                                    

            expect(await evaluate("'abc' > ()", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' > T", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' > F", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' > 1", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' > ls", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' > ns", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' > fn", ctx)).to.equal(false);                                    

            expect(await evaluate("ls > ()", ctx)).to.equal(true);                                    
            expect(await evaluate("ls > T", ctx)).to.equal(true);                                    
            expect(await evaluate("ls > F", ctx)).to.equal(true);                                    
            expect(await evaluate("ls > 1", ctx)).to.equal(true);                                    
            expect(await evaluate("ls > 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("ls > ns", ctx)).to.equal(false);                                    
            expect(await evaluate("ls > fn", ctx)).to.equal(false);                                    

            expect(await evaluate("ns > ()", ctx)).to.equal(true);                                    
            expect(await evaluate("ns > T", ctx)).to.equal(true);                                    
            expect(await evaluate("ns > F", ctx)).to.equal(true);                                    
            expect(await evaluate("ns > 1", ctx)).to.equal(true);                                    
            expect(await evaluate("ns > 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("ns > ls", ctx)).to.equal(true);                                    
            expect(await evaluate("ns > fn", ctx)).to.equal(false);                                    

            expect(await evaluate("fn > ()", ctx)).to.equal(true);                                    
            expect(await evaluate("fn > T", ctx)).to.equal(true);                                    
            expect(await evaluate("fn > F", ctx)).to.equal(true);                                    
            expect(await evaluate("fn > 1", ctx)).to.equal(true);                                    
            expect(await evaluate("fn > 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("fn > ls", ctx)).to.equal(true);                                    
            expect(await evaluate("fn > ns", ctx)).to.equal(true);                                    
        });

        it("should compare tuples with lexicographical criteria", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("(1,2,3) > (4,5,6)", ctx)).to.equal(false);            
            expect(await evaluate("(1,2,3) > (1,2,4)", ctx)).to.equal(false);            
            expect(await evaluate("(1,2) > (1,2,4)", ctx)).to.equal(false);            
            expect(await evaluate("() > (1,2,3)", ctx)).to.equal(false);            
            expect(await evaluate("(1,2,3) > (1,2,3)", ctx)).to.equal(false);                        
            expect(await evaluate("(1,2,4) > (1,2,3)", ctx)).to.equal(true);                        
            expect(await evaluate("(1,2,4) > (1,2)", ctx)).to.equal(true);                        
            expect(await evaluate("(1,2,3) > ()", ctx)).to.equal(true);                        
        });
    });

    describe("X <= Y", () => {
        
        it("should return true if both X and Y are nothing", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("() <= ()", ctx)).to.equal(true);            
        });

        it("should return false if X is true and Y is false", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("T <= T", ctx)).to.equal(true);            
            expect(await evaluate("F <= F", ctx)).to.equal(true);            
            expect(await evaluate("T <= F", ctx)).to.equal(false);            
            expect(await evaluate("F <= T", ctx)).to.equal(true);            
        });

        it("should return false if X is a higher number than Y", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("1 <= 2", ctx)).to.equal(true);            
            expect(await evaluate("0 <= 2", ctx)).to.equal(true);            
            expect(await evaluate("-1 <= 2", ctx)).to.equal(true);            
            expect(await evaluate("2 <= 1", ctx)).to.equal(false);            
            expect(await evaluate("2 <= 0", ctx)).to.equal(false);            
            expect(await evaluate("2 <= (-2)", ctx)).to.equal(false);            
            expect(await evaluate("2 <= 2", ctx)).to.equal(true);            
        });

        it("should return false if X and Y are both strings and X follows Y alphabetically", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("'abc' <= 'def'", ctx)).to.equal(true);            
            expect(await evaluate("'abc' <= 'abd'", ctx)).to.equal(true);            
            expect(await evaluate("'ab' <= 'abc'", ctx)).to.equal(true);            
            expect(await evaluate("'' <= 'abc'", ctx)).to.equal(true);            
            expect(await evaluate("'abc' <= 'abc'", ctx)).to.equal(true);                        
            expect(await evaluate("'abd' <= 'abc'", ctx)).to.equal(false);                        
            expect(await evaluate("'abc' <= 'ab'", ctx)).to.equal(false);                        
            expect(await evaluate("'abc' <= ''", ctx)).to.equal(false);                        
        });
        
        it("should return false if X and Y are both lists and X follows Y lexicographically", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("[1,2,3] <= [4,5,6]", ctx)).to.equal(true);            
            expect(await evaluate("[1,2,3] <= [1,2,4]", ctx)).to.equal(true);            
            expect(await evaluate("[1,2] <= [1,2,4]", ctx)).to.equal(true);            
            expect(await evaluate("[] <= [1,2,3]", ctx)).to.equal(true);            
            expect(await evaluate("[1,2,3] <= [1,2,3]", ctx)).to.equal(true);                        
            expect(await evaluate("[1,2,4] <= [1,2,3]", ctx)).to.equal(false);                        
            expect(await evaluate("[1,2,4] <= [1,2]", ctx)).to.equal(false);                        
            expect(await evaluate("[1,2,3] <= []", ctx)).to.equal(false);                        
        });

        it("should return false if X and Y are both namespaces and X follows Y lexicographically", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("{a=1,b=2} <= {a=3,b=4}", ctx)).to.equal(true);            
            expect(await evaluate("{a=1,b=2} <= {c=1,d=2}", ctx)).to.equal(true);            
            expect(await evaluate("{a=1} <= {a=1,b=2}", ctx)).to.equal(true);            
            expect(await evaluate("{a=1} <= {a=1,b=2}", ctx)).to.equal(true);            
            expect(await evaluate("{} <= {a=1,b=2}", ctx)).to.equal(true);            
            expect(await evaluate("{a=1,b=2} <= {a=1,b=2}", ctx)).to.equal(true);            
            expect(await evaluate("{a=3,b=4} <= {a=1,b=2}", ctx)).to.equal(false);            
            expect(await evaluate("{c=1,d=2} <= {a=1,b=2}", ctx)).to.equal(false);            
            expect(await evaluate("{a=1,b=2} <= {a=1}", ctx)).to.equal(false);            
            expect(await evaluate("{a=1,b=2} <= {a=1}", ctx)).to.equal(false);            
            expect(await evaluate("{a=1,b=2} <= {}", ctx)).to.equal(false);            
        });

        it("should compare str X with str Y if both X and Y are functions", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("(x->2*x) <= (x->2*x)", ctx)).to.equal(true);                                    
            expect(await evaluate("(x->2*x) <= (x->3*x)", ctx)).to.equal(true);                                    
            expect(await evaluate("(x->3*x) <= (x->2*x)", ctx)).to.equal(false);                                    
        });
        
        it("should order differnt type as follows: NOTHING <= BOOLEAN <= NUMBER <= STRING <= LIST <= NAMESPACE <= FUNCTION", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});

            expect(await evaluate("() <= T", ctx)).to.equal(true);                                    
            expect(await evaluate("() <= F", ctx)).to.equal(true);                                    
            expect(await evaluate("() <= 1", ctx)).to.equal(true);                                    
            expect(await evaluate("() <= 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("() <= ls", ctx)).to.equal(true);                                    
            expect(await evaluate("() <= ns", ctx)).to.equal(true);                                    
            expect(await evaluate("() <= fn", ctx)).to.equal(true);                                    
            
            expect(await evaluate("T <= ()", ctx)).to.equal(false);                                    
            expect(await evaluate("T <= 1", ctx)).to.equal(true);                                    
            expect(await evaluate("T <= 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("T <= ls", ctx)).to.equal(true);                                    
            expect(await evaluate("T <= ns", ctx)).to.equal(true);                                    
            expect(await evaluate("T <= fn", ctx)).to.equal(true);                                    
            
            expect(await evaluate("F <= ()", ctx)).to.equal(false);                                    
            expect(await evaluate("F <= 1", ctx)).to.equal(true);                                    
            expect(await evaluate("F <= 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("F <= ls", ctx)).to.equal(true);                                    
            expect(await evaluate("F <= ns", ctx)).to.equal(true);                                    
            expect(await evaluate("F <= fn", ctx)).to.equal(true);                                    
            
            expect(await evaluate("1 <= ()", ctx)).to.equal(false);                                    
            expect(await evaluate("1 <= T", ctx)).to.equal(false);                                    
            expect(await evaluate("1 <= F", ctx)).to.equal(false);                                    
            expect(await evaluate("1 <= 'abc'", ctx)).to.equal(true);                                    
            expect(await evaluate("1 <= ls", ctx)).to.equal(true);                                    
            expect(await evaluate("1 <= ns", ctx)).to.equal(true);                                    
            expect(await evaluate("1 <= fn", ctx)).to.equal(true);                                    

            expect(await evaluate("'abc' <= ()", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' <= T", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' <= F", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' <= 1", ctx)).to.equal(false);                                    
            expect(await evaluate("'abc' <= ls", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' <= ns", ctx)).to.equal(true);                                    
            expect(await evaluate("'abc' <= fn", ctx)).to.equal(true);                                    

            expect(await evaluate("ls <= ()", ctx)).to.equal(false);                                    
            expect(await evaluate("ls <= T", ctx)).to.equal(false);                                    
            expect(await evaluate("ls <= F", ctx)).to.equal(false);                                    
            expect(await evaluate("ls <= 1", ctx)).to.equal(false);                                    
            expect(await evaluate("ls <= 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("ls <= ns", ctx)).to.equal(true);                                    
            expect(await evaluate("ls <= fn", ctx)).to.equal(true);                                    

            expect(await evaluate("ns <= ()", ctx)).to.equal(false);                                    
            expect(await evaluate("ns <= T", ctx)).to.equal(false);                                    
            expect(await evaluate("ns <= F", ctx)).to.equal(false);                                    
            expect(await evaluate("ns <= 1", ctx)).to.equal(false);                                    
            expect(await evaluate("ns <= 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("ns <= ls", ctx)).to.equal(false);                                    
            expect(await evaluate("ns <= fn", ctx)).to.equal(true);                                    

            expect(await evaluate("fn <= ()", ctx)).to.equal(false);                                    
            expect(await evaluate("fn <= T", ctx)).to.equal(false);                                    
            expect(await evaluate("fn <= F", ctx)).to.equal(false);                                    
            expect(await evaluate("fn <= 1", ctx)).to.equal(false);                                    
            expect(await evaluate("fn <= 'abc'", ctx)).to.equal(false);                                    
            expect(await evaluate("fn <= ls", ctx)).to.equal(false);                                    
            expect(await evaluate("fn <= ns", ctx)).to.equal(false);                                    
        });

        it("should compare tuples with lexicographical criteria", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("(1,2,3) <= (4,5,6)", ctx)).to.equal(true);            
            expect(await evaluate("(1,2,3) <= (1,2,4)", ctx)).to.equal(true);            
            expect(await evaluate("(1,2) <= (1,2,4)", ctx)).to.equal(true);            
            expect(await evaluate("() <= (1,2,3)", ctx)).to.equal(true);            
            expect(await evaluate("(1,2,3) <= (1,2,3)", ctx)).to.equal(true);                        
            expect(await evaluate("(1,2,4) <= (1,2,3)", ctx)).to.equal(false);                        
            expect(await evaluate("(1,2,4) <= (1,2)", ctx)).to.equal(false);                        
            expect(await evaluate("(1,2,3) <= ()", ctx)).to.equal(false);                        
        });
    });

    describe("int X", () => {

        it("should return the integer part of X if it is a number", async () => {
            var ctx = createContext({fn:()=>{}, ls:[1,2,3], ns:{a:1,b:2,c:3}, T:true, F:false});
            expect(await evaluate("int 10.2", ctx)).to.equal(10);
            expect(await evaluate("int 10.9", ctx)).to.equal(10);
            expect(await evaluate("int 0", ctx)).to.equal(0);
            expect(await evaluate("int (-10.2)", ctx)).to.equal(-10);
            expect(await evaluate("int (-10.9)", ctx)).to.equal(-10);
        });
        
        it("should return the size of X if it is not a number", async () => {
            var ctx = createContext({T:true, F:false, jsFn:x=>2*x});
            expect(await evaluate("int F", ctx)).to.equal(0);
            expect(await evaluate("int T", ctx)).to.equal(1);
            expect(await evaluate("int 'abc'", ctx)).to.equal(3);
            expect(await evaluate("int ''", ctx)).to.equal(0);
            expect(await evaluate("int [10,20,30]", ctx)).to.equal(3);
            expect(await evaluate("int []", ctx)).to.equal(0);
            expect(await evaluate("int {a=1,b=2,c=3}", ctx)).to.equal(3);
            expect(await evaluate("int {}", ctx)).to.equal(0);
            expect(await evaluate("int (x -> 2*x+1)", ctx)).to.equal(1);
            expect(await evaluate("int jsFn", ctx)).to.equal(1);
            expect(await evaluate("int(2,'abc',[1,2,3,4])", ctx)).to.equal(9);            
        });
    });
});
