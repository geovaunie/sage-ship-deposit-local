import {Buffer} from 'buffer';
export {Buffer};
// Small browser-only compatibility shim for transitive util/assert packages.
// No operating-system environment or filesystem access is exposed.
export const process={env:{},nextTick:(callback,...args)=>Promise.resolve().then(()=>callback(...args))};
