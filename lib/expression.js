
const Parser = require("./expression/parser");

const parse = Parser({
     
     binaryOperations: {
         ","  : {precedence:10, handler:"$pair"  },
         "="  : {precedence:11, handler:"$set"   },
         ":"  : {precedence:11, handler:"$label" },
         "->" : {precedence:12, handler:"$def",  right:true},

         ";"  : {precedence:21, handler:"$else"},
         "?"  : {precedence:22, handler:"$if"  },
         "|"  : {precedence:23, handler:"$or"  },
         "&"  : {precedence:23, handler:"$and" },
         "==" : {precedence:24, handler:"$eq"  },
         "!=" : {precedence:24, handler:"$ne"  },
         "<"  : {precedence:24, handler:"$lt"  },
         "<=" : {precedence:24, handler:"$le"  },
         ">"  : {precedence:24, handler:"$gt"  },
         ">=" : {precedence:24, handler:"$ge"  },
         "+"  : {precedence:25, handler:"$add" },
         "-"  : {precedence:25, handler:"$sub" },
         "*"  : {precedence:26, handler:"$mul" },    
         "/"  : {precedence:26, handler:"$div" },
         "%"  : {precedence:26, handler:"$mod" },
         "^"  : {precedence:27, handler:"$pow" },
         
         "."  : {precedence:30, handler:"$dot" },
         ""   : {precedence:30, handler:"$apply" },
     },
     
     voidHandler        : "$nothing",
     nameHandler        : "$name",
     stringHandler0     : "$str0",
     stringHandler1     : "$str1",
     stringHandler2     : "$str2",
     numberHandler      : "$numb",
     squareGroupHandler : "$list",
     curlyGroupHandler  : "$namespace",
 });

const isValidName = name =>  /^[a-z_A-Z]+[a-z_A-Z0-9]*$/.test(name);

class Exception extends Error {};

function raise (message) {
    throw new Exception(message);
}

class Tuple {
    
    constructor (...items) {
        this._items = items.filter(item => !isNothing(item));
    }
    
    isNothing () {
        return this.normalize() === null;
    }
    
    *[Symbol.iterator] () {
        for (let item of this._items) {
            if (item instanceof Tuple) {
                for (let subItem of item) yield subItem;
            } else if (!isNothing(item)) {
                yield item;
            }
        }
    }

    normalize () {
        const iterator = this[Symbol.iterator]();
        const first = iterator.next();
        if (first.done) return null;
        return iterator.next().done ? first.value : this;
    }    
    
    async map (fn) {
        var retVals = NOTHING;
        for (let item of this) {
            retVals = Tuple.from(retVals, await fn(item));
        }
        return retVals;
    }
    
    static from (...items) {
        return new this(...items);
    }
}

const NOTHING = new Tuple();

function* pair (x, y) {
    const iX = Tuple.from(x)[Symbol.iterator]();
    const iY = Tuple.from(y)[Symbol.iterator]();
    while (true) {
        let x = iX.next();
        let y = iY.next();
        if (x.done && y.done) break;
        yield {first:x.value, second:y.value};
    }    
}

function type (value) {
    
    // if Nothing
    if (value === null || value === undefined || Number.isNaN(value)) return "NOTHING";

    // if primitive
    switch (typeof value) {
        case "boolean"  : return "BOOLEAN";
        case "number"   : return "NUMBER";
        case "string"   : return "STRING";
    }    
    
    // It must be an object!
    
    // if Function
    if (typeof value === "function") return "FUNCTION";
    
    // if List
    if (Array.isArray(value)) return "LIST";
    
    // if iterable
    if (value instanceof Tuple) return "TUPLE";

    // if a primitive object
    const tag = Object.prototype.toString.call(value);
    if (tag === '[object Boolean]') return "BOOLEAN";
    if (tag === '[object Number]') return "NUMBER";
    if (tag === '[object String]') return "STRING";
    
    // It is a Namespace!
    return "NAMESPACE";
}

function isNothing (value) {
    const valueType = type(value);
    if (valueType === 'NOTHING') return true;
    if (valueType === 'TUPLE' && value.isNothing()) return true;
    return false; 
}

// function getListItem (list, index) {
//     if (type(index) !== 'NUMBER') return NOTHING;
//     index = index < 0 ? list.length + index : index - 1;
//     return (0 <= index && index < list.length) ? list[Math.trunc(index)] : NOTHING;
// }

function getListItem (list, index) {
    if (type(index) !== 'NUMBER') return NOTHING;
    index = index < 0 ? list.length + index : index;
    return (0 <= index && index < list.length) ? list[Math.trunc(index)] : NOTHING;
}

function countNames (namespace) {
    return Object.getOwnPropertyNames(namespace).length;
}

function apply (x, y) {
    const xType = type(x);
    switch (xType) {
        case 'FUNCTION':  return x.call(this, ...Tuple.from(y));
        case 'STRING':    return getListItem(x, y);
        case 'LIST':      return getListItem(x, y);
        case 'NAMESPACE': {
            if (typeof x.__apply__ === 'function') {
                return apply.call(this, x.__apply__, y);
            }
            if (type(y) !== 'STRING') return NOTHING;
            return isValidName(y) && x.hasOwnProperty(y) ? x[y] : NOTHING;
        };
        case 'TUPLE':     return x.map(xi => apply.call(this, xi, y));
        default:          return raise(`Apply operation not defined on ${xType} type`);
    }
}

function convertToBoolean (x) {
    const xType = type(x);
    switch (xType) {
        case 'BOOLEAN':   return x;
        case 'NUMBER':    return x !== 0;
        case 'FUNCTION':  return true;
        case 'STRING':    return x.length !== 0;
        case 'LIST':      return x.length !== 0;
        case 'NAMESPACE': return countNames(x) !== 0;
        default:          return raise(`${xType} cannot be converted to BOOLEAN`);
    }    
}

function stringify (x) {
    const xType = type(x);
    switch (xType) {
        case 'BOOLEAN':   return x ? "TRUE" : "FALSE";
        case 'NUMBER':    return String(x);
        case 'FUNCTION':  return String.fromCharCode(0x2A0D);
        case 'STRING':    return x;
        case 'LIST':      return `[${x.length}]`;
        case 'NAMESPACE': return type(x.__str__) === 'STRING' ? x.__str__ : `{${countNames(x)}}`;
        default:          return raise(`${xType} cannot be converted to STRING`);
    }        
}

function add (x, y) {
    const xType = type(x); if (xType === 'NOTHING') return y;
    const yType = type(y); if (yType === 'NOTHING') return x;
    switch (`${xType}-${yType}`) {
        case 'BOOLEAN-BOOLEAN': return x || y;
        case 'NUMBER-NUMBER': return x + y;
        case 'STRING-STRING': return x + y;
        case 'LIST-LIST': return x.concat(y);
        case 'NAMESPACE-NAMESPACE': return Object.assign(Object.create(x), y);
        default: return raise(`Sum operation not defined between ${xType} and ${yType}`);
    }
}

function sub (x, y) {
    const xType = type(x); if (xType === 'NOTHING') return NOTHING;
    const yType = type(y); if (yType === 'NOTHING') return x;
    switch (`${xType}-${yType}`) {
        case 'NUMBER-NUMBER': return x - y;
        default: return raise(`Subtraction operation not defined between ${xType} and ${yType}`);
    }
}

function mul (x, y) {
    const xType = type(x); if (xType === 'NOTHING') return NOTHING;
    const yType = type(y); if (yType === 'NOTHING') return NOTHING;
    switch (`${xType}-${yType}`) {
        case 'BOOLEAN-BOOLEAN': return x && y;
        case 'NUMBER-NUMBER': return x * y;
        case 'NUMBER-STRING': return x < 0 ? "" : y.repeat(x); 
        case 'STRING-NUMBER': return y < 0 ? "" : x.repeat(y);
        case 'LIST-NUMBER': return multiplyList(x,y);
        case 'NUMBER-LIST': return multiplyList(y,x);
        default: return raise(`Product operation not defined between ${xType} and ${yType}`);
    }    
}

function multiplyList (list, n) {
    var product = [];
    for (let i=1; i<=n; i++) product = product.concat(list);
    return product;    
}

function div (x, y) {
    const xType = type(x); if (xType === 'NOTHING') return NOTHING;
    const yType = type(y);
    switch (`${xType}-${yType}`) {
        case 'NUMBER-NUMBER': return x / y;
        default: return raise(`Division operation not defined between ${xType} and ${yType}`);
    }    
}

function mod (x, y) {
    const xType = type(x); if (xType === 'NOTHING') return y;
    const yType = type(y);
    switch (`${xType}-${yType}`) {
        case 'NUMBER-NUMBER': return x % y;
        default: return raise(`Modulo operation not defined between ${xType} and ${yType}`);
    }    
}

function pow (x, y) {
    const xType = type(x); if (xType === 'NOTHING') return NOTHING;
    const yType = type(y);
    switch (`${xType}-${yType}`) {
        case 'NUMBER-NUMBER': return x ** y;
        default: return raise(`Exponentiation operation not defined between ${xType} and ${yType}`);
    }    
}

function compare (x, y) {
    const xType = type(x);
    const yType = type(y);
    if (xType === 'NOTHING') return yType === 'NOTHING' ? 0 : -1;
    if (yType === 'NOTHING') return +1;
    switch (`${xType}-${yType}`) {
        case 'BOOLEAN-BOOLEAN': return x === y ? 0 : (x ? +1 : -1);
        case 'NUMBER-NUMBER':   return x === y ? 0 : (x<y ? -1 : +1);
        case 'STRING-STRING':   return x === y ? 0 : [x,y].sort()[0] === x ? -1 : +1;
        case 'LIST-LIST':       return lexCompare(Tuple.from(...x), Tuple.from(...y));
        default: return raise(`Comparison operation not defined between ${xType} and ${yType}`);
    }    
}

function lexCompare (tuple1, tuple2) {
    const pairs = Tuple.from(...pair(tuple1, tuple2));
    for (let pair of pairs) {
        let cmp = compare(pair.first, pair.second);
        if (cmp !== 0) return cmp;
    }
    return 0;
}

function isEqual (x, y) {
    const xType = type(x);
    const yType = type(y);
    if (xType === 'NOTHING') return yType === 'NOTHING';
    switch (`${xType}-${yType}`) {
        case 'BOOLEAN-BOOLEAN':     return x === y;
        case 'NUMBER-NUMBER':       return x === y;
        case 'STRING-STRING':       return x === y;
        case 'FUNCTION-FUNCTION':   return x === y;
        case 'LIST-LIST':           return isLexEqual(Tuple.from(...x), Tuple.from(...y));
        case 'NAMESPACE-NAMESPACE': {
            let xNames = Object.getOwnPropertyNames(x).filter(isValidName);
            let yNames = Object.getOwnPropertyNames(y).filter(isValidName);
            if (xNames.length !== yNames.length) return false;
            for (let xName of xNames) {
                let xValue = x[xName];
                let yValue = y.hasOwnProperty(xName) ? y[xName] : null;
                if (!isEqual(xValue, yValue)) return false;
            }
            return true;
        }
        default: return false;
    }    
}

function isLexEqual (tuple1, tuple2) {
    const pairs = Tuple.from(...pair(tuple1, tuple2));
    for (let pair of pairs) {
        if (!isEqual(pair.first, pair.second)) return false;
    }
    return true;    
}


const context = {
    
    $nothing () {
        return NOTHING;
    },
    
    $str0 (value) {
        return value;
    },
    
    $str1 (value) {
        return value;
    },
    
    $str2 (value) {
        return value;
    },
    
    $numb (value) {
        return value;
    },
    
    async $pair (X, Y) {
        return Tuple.from(await X(this), await Y(this));
    },
    
    async $list (X) {
        return Array.from(Tuple.from(await X(this)));
    },
    
    async $name (name) {
        if (isValidName(name)) {
            let value = this[name];
            if (value !== undefined && value !== Object.prototype[name]) return value;
        }
        return NOTHING;
    },
    
    async $label (X, Y) {
        const x = await X({
            $nothing: this.$nothing,
            $name: name => name,
            $pair: this.$pair
        });
        const names = Array.from(Tuple.from(x));
        const y = await Y(this);
        const values = Array.from(Tuple.from(y));
        if (values.length > names.length) {
            values[names.length-1] = Tuple.from(...values.slice(names.length-1))
        }
        for (var i=0; i<names.length; i++) {
            this[names[i]] = i < values.length ? values[i] : null;
        }            
        return y;
    },
    
    async $set (X, Y) {
        await this.$label(X, Y);
        return NOTHING;
    },

    async $namespace (X) {
        const context = Object.create(this);
        await X(context);
        return Object.assign({}, context);
    },
    
    $def (params, expression) {
        return async (...args) => {
            const functionContext = Object.create(this);
            await functionContext.$set(params, () => Tuple.from(...args));
            return await expression(functionContext);
        }
    },
    
    async $apply (X, Y) {
        const x = await X(this);
        const y = await Y(this);
        return await apply.call(this, x, y);
    },
    
    async $dot (X, Y) {
        const namespaces = Tuple.from(await X(this));
        return namespaces.map(async namespace => {
            if (type(namespace) !== 'NAMESPACE') raise("Namespace expected on the left size of the '.' operator");
            let childContext = Object.assign(Object.create(this), namespace);
            return await Y(childContext);
        });
    },
    
    async $or (X, Y) {
        const x = await X(this);
        if (await this.bool(x)) return x;
        return await Y(this);
    },
    
    async $and (X, Y) {
        const x = await X(this);
        if (await this.not(x)) return x;
        return await Y(this);
    },
    
    async $if (X, Y) {
        const x = await X(this);
        return (await this.bool(x)) ? await Y(this) : NOTHING;
    },

    async $else (X, Y) {
        const x = await X(this);
        return isNothing(x) ? await Y(this) : x;
    },
    
    async $add (X, Y) {
        const x = await X(this);
        const y = await Y(this);
        const pairs = Tuple.from(...pair(x,y));
        return pairs.map(pair => add(pair.first, pair.second));
    },

    async $sub (X, Y) {
        const x = await X(this);
        const y = await Y(this);
        const pairs = Tuple.from(...pair(x,y));
        return pairs.map(pair => sub(pair.first, pair.second));
    },

    async $mul (X, Y) {
        const x = await X(this);
        const y = await Y(this);
        const pairs = Tuple.from(...pair(x,y));
        return pairs.map(pair => mul(pair.first, pair.second));
    },

    async $div (X, Y) {
        const x = await X(this);
        const y = await Y(this);
        const pairs = Tuple.from(...pair(x,y));
        return pairs.map(pair => div(pair.first, pair.second));
    },

    async $mod (X, Y) {
        const x = await X(this);
        const y = await Y(this);
        const pairs = Tuple.from(...pair(x,y));
        return pairs.map(pair => mod(pair.first, pair.second));
    },

    async $pow (X, Y) {
        const x = await X(this);
        const y = await Y(this);
        const pairs = Tuple.from(...pair(x,y));
        return pairs.map(pair => pow(pair.first, pair.second));
    },

    async $eq (X, Y) {
        const x = await X(this);
        const y = await Y(this);
        return isLexEqual(x, y);
    },
     
    async $ne (X, Y) {
        return !(await this.$eq(X, Y));
    },

    async $lt (X, Y) {
        const x = await X(this);
        const y = await Y(this);
        return lexCompare(x, y) == -1;
    },

    async $ge (X, Y) {
        return !(await this.$lt(X, Y));
    },

    async $gt (X, Y) {
        const x = await X(this);
        const y = await Y(this);
        return lexCompare(x, y) == +1;
    },

    async $le (X, Y) {
        return !(await this.$gt(X, Y));
    },   
    
    bool (...items) {
        for (let item of items) {
            if (convertToBoolean(item)) return true;
        }
        return false;
    },
    
    not (...items) {
        for (let item of items) {
            if (convertToBoolean(item)) return false;
        }
        return true;
    },
    
    str (...items) {
        return items.map(item => stringify(item)).join("")
    },
    
    map (fn) {
        return (...items) => Tuple.from(...items).map(fn);
    },
    
    TRUE: true,
    FALSE: false
};


exports.parse = (expression) => {
    const evaluate = parse(expression);
    return async (expressionContext) => {
        if (!context.isPrototypeOf(expressionContext)) {
            throw new Error("Invalid context.")
        };
        const value = await evaluate(expressionContext);
        return value instanceof Tuple ? value.normalize() : value;
    }
}

exports.createContext = (globals={}) => {
    const expressionContext = Object.create(context);
    Object.assign(expressionContext, globals);
    return Object.create(expressionContext);
}

exports.evaluate = (expression, context) => {
    return this.parse(expression)(context);
}

exports.stringify = x => context.str(...Tuple.from(x));

exports.Exception = Exception;

exports.Tuple = Tuple;