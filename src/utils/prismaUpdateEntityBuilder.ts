// src/utils/prismaUpdateEntityBuilder.ts

export const prismaUpdateEntityBuilder = (data: any, mapping?: any) => {
    if (!data || typeof data !== "object") return data;
    const result: any = {};
    
    console.log('prismaUpdateEntityBuilder', data)
    for (const key of Object.keys(data)) {
        const map = mapping?.[key];
        const val = data[key];
        console.log('prismaUpdateEntityBuilder', key, val, map)

        // 1. Si no hay mapping para este campo, lo ignoramos (seguridad)
        if (!map) continue;


        // 2. CASO ESPECIAL: Transformación personalizada (La clave para tu inventario)
        // Pasamos 'val' (el valor del campo) y 'data' (el objeto completo por si necesitamos otros campos como 'movementType')
        if (map.transform && typeof map.transform === 'function') {
            const transformedData = map.transform(val, data);
            Object.assign(result, transformedData);
            continue;
        }

        // 3. Lógica Estándar de Relaciones (Arrays)
        if (map.relation && Array.isArray(val)) {
            // En updates, usualmente queremos 'set' para reemplazar la lista de relaciones (ej: Tags)
            result[key] = { 
                set: val.map((item: any) => ({ [map.connectField || "id"]: item.id || item })) 
            };
            continue;
        }

        // 4. Lógica Estándar de Relaciones (Objeto único)
        if (map.relation && val && typeof val === 'object') {
            result[key] = { 
                connect: { [map.connectField || "id"]: val.id || val } 
            };
            continue;
        }

        // 5. Campos simples (Primitivos)
        result[map.field || key] = val;
    }

    return result;
}