
export const prismaQueryBuilder = (receivedDto: any, mappingRules: any) => {
    const where: any = {};

    for (const key in receivedDto) {
        const value = receivedDto[key];
        
        if (value === undefined || value === null || value === '') continue;
        
        const config = mappingRules[key];
        if (!config) continue; // campo no permitido

        console.log('test', key, value, config)

        if (config.type === 'string') {
            where[config.field] = { contains: value, mode: 'insensitive' };  
        }

        if (config.type === 'boolean') {
            where[config.field] = value === 'true' || value === true;
        }

        if (config.type === 'object') {
            where[config.field] = {
                [config.childField]: { contains: value, mode: 'insensitive'}
            };
        }

        // ARRAY DE STRINGS
        if (config.type === "stringArray") {
            where[config.field] = {};

            // modo básico (buscar que contenga 1 valor)
            if (config.operator === "contains") {
                where[config.field].has = value;
            }

            // contiene alguno
            if (config.operator === "oneOf") {
                where[config.field].hasSome = value;
            }

            // contiene todos
            if (config.operator === "containsAll") {
                where[config.field].hasEvery = value;
            }
        }

        // ARRAY DE OBJETOS (RELACIÓN)
        if (config.type === "relationArray") {
            // console.log('relationArray', value, typeof value, Array.isArray(value))
            if (value.length > 1 && Array.isArray(value)) {
                where['AND'] = value.map((val: string) => ({
                    [config.field]: {
                       some: { [config.childField]: {contains: val, mode: 'insensitive' }}
                    },
                }))
            } else {
                where[config.field] = {
                    some: { [config.childField]: {contains: value, mode: 'insensitive' }}
                };  
            }
        
            console.log('where relationArray', where)
        }
    }
    return where;
}