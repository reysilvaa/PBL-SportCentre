export function convertBigIntToNumber(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj === 'bigint') {
      return Number(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(convertBigIntToNumber);
    }
    
    if (typeof obj === 'object') {
      const newObj: any = {};
      for (const key in obj) {
        newObj[key] = convertBigIntToNumber(obj[key]);
      }
      return newObj;
    }
    
    return obj;
  }