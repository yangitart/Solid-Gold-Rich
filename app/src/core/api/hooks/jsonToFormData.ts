export default function jsonToFormData(payload: any) {
  const formData = new FormData();

  if (payload instanceof File || payload instanceof Blob) {
    formData.append('document', payload);
    return formData;
  }

  if (payload instanceof ArrayBuffer) {
    const blob = new Blob([payload]);
    formData.append('document', blob, 'document');
    return formData;
  }

  for (const key in payload) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const value = payload[key];

      if (value instanceof File || value instanceof Blob) {
        formData.append(key, value);
      } else if (value instanceof ArrayBuffer) {
        const blob = new Blob([value]);
        formData.append(key, blob, 'document');
      } else if (Array.isArray(value)) {
        // Si es un array de objetos, lo convertimos a JSON
        if (value.length && typeof value[0] === 'object') {
          formData.append(key, JSON.stringify(value));
        } else {
          value.forEach((item) => formData.append(key, item));
        }
      } else {
        formData.append(key, value);
      }
    }
  }

  return formData;
}
